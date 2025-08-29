#!/bin/bash

# Automatic SSL Certificate Setup with Let's Encrypt
set -e

# Configuration
DOMAIN=${1:-"your-domain.com"}
EMAIL=${2:-"admin@your-domain.com"}
STAGING=${3:-false}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites for SSL setup..."
    
    # Check if domain is provided
    if [[ "$DOMAIN" == "your-domain.com" ]]; then
        log_error "Please provide a valid domain name"
        echo "Usage: $0 <domain> <email> [staging]"
        echo "Example: $0 myapp.com admin@myapp.com false"
        exit 1
    fi
    
    # Check if email is provided
    if [[ "$EMAIL" == "admin@your-domain.com" ]]; then
        log_error "Please provide a valid email address"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✓"
}

setup_certbot() {
    log_info "Setting up Certbot for SSL certificates..."
    
    # Create directories
    mkdir -p certbot/conf
    mkdir -p certbot/www
    mkdir -p certbot/logs
    
    # Set proper permissions
    chmod 755 certbot/conf
    chmod 755 certbot/www
    chmod 755 certbot/logs
    
    log_info "Certbot directories created ✓"
}

create_dummy_certificate() {
    log_info "Creating dummy certificate for initial nginx startup..."
    
    # Create dummy certificate directory
    mkdir -p certbot/conf/live/$DOMAIN
    
    # Generate dummy certificate
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout certbot/conf/live/$DOMAIN/privkey.pem \
        -out certbot/conf/live/$DOMAIN/fullchain.pem \
        -subj "/CN=$DOMAIN"
    
    # Create chain file
    cp certbot/conf/live/$DOMAIN/fullchain.pem certbot/conf/live/$DOMAIN/chain.pem
    
    log_info "Dummy certificate created ✓"
}

start_nginx() {
    log_info "Starting nginx with dummy certificate..."
    
    # Update nginx configuration with actual domain
    sed -i "s/your-domain.com/$DOMAIN/g" nginx/nginx.conf
    
    # Start nginx
    docker-compose -f docker-compose.prod.yml up -d nginx
    
    # Wait for nginx to start
    sleep 10
    
    log_info "Nginx started ✓"
}

obtain_certificate() {
    log_info "Obtaining SSL certificate from Let's Encrypt..."
    
    # Remove dummy certificate
    rm -rf certbot/conf/live/$DOMAIN
    
    # Set staging flag if needed
    STAGING_FLAG=""
    if [[ "$STAGING" == "true" ]]; then
        STAGING_FLAG="--staging"
        log_warn "Using Let's Encrypt staging environment"
    fi
    
    # Obtain certificate
    docker run --rm \
        -v $(pwd)/certbot/conf:/etc/letsencrypt \
        -v $(pwd)/certbot/www:/var/www/certbot \
        -v $(pwd)/certbot/logs:/var/log/letsencrypt \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        $STAGING_FLAG \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    if [[ $? -eq 0 ]]; then
        log_info "SSL certificate obtained successfully ✓"
    else
        log_error "Failed to obtain SSL certificate"
        exit 1
    fi
}

reload_nginx() {
    log_info "Reloading nginx with real certificate..."
    
    # Reload nginx configuration
    docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
    
    if [[ $? -eq 0 ]]; then
        log_info "Nginx reloaded successfully ✓"
    else
        log_error "Failed to reload nginx"
        exit 1
    fi
}

setup_auto_renewal() {
    log_info "Setting up automatic certificate renewal..."
    
    # Create renewal script
    cat > scripts/renew-ssl.sh << EOF
#!/bin/bash
# SSL Certificate Renewal Script

# Renew certificates
docker run --rm \\
    -v \$(pwd)/certbot/conf:/etc/letsencrypt \\
    -v \$(pwd)/certbot/www:/var/www/certbot \\
    -v \$(pwd)/certbot/logs:/var/log/letsencrypt \\
    certbot/certbot renew --quiet

# Reload nginx if renewal was successful
if [[ \$? -eq 0 ]]; then
    docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
    echo "SSL certificates renewed and nginx reloaded"
else
    echo "SSL certificate renewal failed"
    exit 1
fi
EOF
    
    chmod +x scripts/renew-ssl.sh
    
    # Create systemd timer for auto-renewal (if systemd is available)
    if command -v systemctl >/dev/null 2>&1; then
        cat > /tmp/ssl-renewal.service << EOF
[Unit]
Description=SSL Certificate Renewal
After=network.target

[Service]
Type=oneshot
ExecStart=$(pwd)/scripts/renew-ssl.sh
User=$(whoami)
WorkingDirectory=$(pwd)
EOF

        cat > /tmp/ssl-renewal.timer << EOF
[Unit]
Description=SSL Certificate Renewal Timer
Requires=ssl-renewal.service

[Timer]
OnCalendar=daily
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

        sudo mv /tmp/ssl-renewal.service /etc/systemd/system/
        sudo mv /tmp/ssl-renewal.timer /etc/systemd/system/
        
        sudo systemctl daemon-reload
        sudo systemctl enable ssl-renewal.timer
        sudo systemctl start ssl-renewal.timer
        
        log_info "Systemd timer for SSL renewal created ✓"
    else
        log_warn "Systemd not available. Please set up cron job manually:"
        echo "Add this to your crontab (crontab -e):"
        echo "0 3 * * * $(pwd)/scripts/renew-ssl.sh"
    fi
    
    log_info "Auto-renewal setup complete ✓"
}

test_ssl() {
    log_info "Testing SSL certificate..."
    
    # Wait for nginx to fully reload
    sleep 5
    
    # Test SSL certificate
    if curl -sSf https://$DOMAIN/api/health >/dev/null; then
        log_info "SSL certificate test passed ✓"
    else
        log_warn "SSL certificate test failed - checking configuration..."
        
        # Check certificate details
        echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
    fi
    
    # Test SSL rating (optional)
    log_info "You can test your SSL configuration at:"
    echo "https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
}

create_security_txt() {
    log_info "Creating security.txt file..."
    
    mkdir -p www/.well-known
    
    cat > www/.well-known/security.txt << EOF
Contact: security@$DOMAIN
Expires: $(date -d '+1 year' -u +%Y-%m-%dT%H:%M:%S.000Z)
Encryption: https://$DOMAIN/pgp-key.txt
Preferred-Languages: en
Canonical: https://$DOMAIN/.well-known/security.txt
Policy: https://$DOMAIN/security-policy
Acknowledgments: https://$DOMAIN/security-acknowledgments
EOF
    
    log_info "Security.txt created ✓"
}

show_ssl_info() {
    log_info "🔒 SSL Setup completed successfully!"
    echo ""
    echo "📋 SSL Certificate Information:"
    echo "==============================="
    echo "Domain: $DOMAIN"
    echo "Email: $EMAIL"
    echo "Certificate Path: certbot/conf/live/$DOMAIN/"
    echo "Staging Mode: $STAGING"
    echo ""
    echo "🔍 Certificate Details:"
    openssl x509 -in certbot/conf/live/$DOMAIN/fullchain.pem -noout -text | grep -A2 "Validity"
    echo ""
    echo "🔄 Auto-Renewal:"
    echo "- Renewal script: scripts/renew-ssl.sh"
    echo "- Runs daily at 3 AM (with random delay)"
    echo "- Certificates are valid for 90 days"
    echo ""
    echo "🧪 Testing:"
    echo "- Local test: curl -I https://$DOMAIN/api/health"
    echo "- SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
    echo ""
    echo "📝 Next Steps:"
    echo "1. Update DNS records to point to your server"
    echo "2. Test all endpoints with HTTPS"
    echo "3. Update application URLs to use HTTPS"
    echo "4. Monitor certificate expiration"
    echo ""
}

# Main SSL setup flow
main() {
    log_info "Starting SSL certificate setup for $DOMAIN"
    
    check_prerequisites
    setup_certbot
    create_dummy_certificate
    start_nginx
    obtain_certificate
    reload_nginx
    setup_auto_renewal
    test_ssl
    create_security_txt
    show_ssl_info
    
    log_info "🔒 SSL setup completed successfully!"
}

# Handle script interruption
trap 'log_error "SSL setup interrupted"; exit 1' INT TERM

# Show usage if no arguments
if [[ $# -eq 0 ]]; then
    echo "Usage: $0 <domain> <email> [staging]"
    echo ""
    echo "Arguments:"
    echo "  domain   - Your domain name (e.g., myapp.com)"
    echo "  email    - Your email address for Let's Encrypt"
    echo "  staging  - Use staging environment (true/false, default: false)"
    echo ""
    echo "Examples:"
    echo "  $0 myapp.com admin@myapp.com false"
    echo "  $0 test.myapp.com admin@myapp.com true"
    exit 1
fi

# Run main function
main "$@"
