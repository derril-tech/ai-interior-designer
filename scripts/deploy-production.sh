#!/bin/bash

# Production Deployment Script for AI Interior Designer
set -e

echo "🚀 Starting production deployment..."

# Configuration
ENVIRONMENT=${1:-production}
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
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
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file $ENV_FILE not found"
        log_info "Please copy env.production.example to .env and configure it"
        exit 1
    fi
    
    # Check required environment variables
    source "$ENV_FILE"
    required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "MINIO_ACCESS_KEY"
        "MINIO_SECRET_KEY"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_info "Prerequisites check passed ✓"
}

build_images() {
    log_info "Building Docker images..."
    
    # Build all services
    docker-compose -f "$COMPOSE_FILE" build --parallel
    
    log_info "Docker images built successfully ✓"
}

setup_infrastructure() {
    log_info "Setting up infrastructure..."
    
    # Create necessary directories
    mkdir -p data/{postgres,redis,nats,minio,prometheus,grafana,loki}
    mkdir -p logs
    mkdir -p ssl
    
    # Set proper permissions
    chmod 755 data/*
    chmod 755 logs
    
    # Create networks
    docker network create ai-interior-designer-network 2>/dev/null || true
    
    log_info "Infrastructure setup complete ✓"
}

run_database_migrations() {
    log_info "Running database migrations..."
    
    # Start only database first
    docker-compose -f "$COMPOSE_FILE" up -d postgres
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 30
    
    # Run migrations
    docker-compose -f "$COMPOSE_FILE" run --rm api npm run migration:run
    
    # Run seeds
    docker-compose -f "$COMPOSE_FILE" run --rm api npm run seed:run
    
    log_info "Database migrations completed ✓"
}

setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Create monitoring configuration directories
    mkdir -p monitoring/{prometheus,grafana,loki}
    
    # Copy monitoring configurations
    cp -r monitoring/configs/* monitoring/
    
    log_info "Monitoring setup complete ✓"
}

deploy_services() {
    log_info "Deploying services..."
    
    # Deploy all services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    
    services=(
        "postgres"
        "redis"
        "nats"
        "api"
    )
    
    for service in "${services[@]}"; do
        log_info "Checking health of $service..."
        timeout=60
        while [ $timeout -gt 0 ]; do
            if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy\|Up"; then
                log_info "$service is healthy ✓"
                break
            fi
            sleep 5
            timeout=$((timeout - 5))
        done
        
        if [ $timeout -le 0 ]; then
            log_error "$service failed to become healthy"
            exit 1
        fi
    done
    
    log_info "All services deployed successfully ✓"
}

run_health_checks() {
    log_info "Running health checks..."
    
    # API health check
    api_url="http://localhost:3000/api/health"
    if curl -f -s "$api_url" > /dev/null; then
        log_info "API health check passed ✓"
    else
        log_error "API health check failed"
        exit 1
    fi
    
    # Database health check
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U ai_interior_designer; then
        log_info "Database health check passed ✓"
    else
        log_error "Database health check failed"
        exit 1
    fi
    
    # Redis health check
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping | grep -q "PONG"; then
        log_info "Redis health check passed ✓"
    else
        log_error "Redis health check failed"
        exit 1
    fi
    
    log_info "All health checks passed ✓"
}

setup_ssl() {
    log_info "Setting up SSL certificates..."
    
    if [[ ! -f "ssl/cert.pem" ]] || [[ ! -f "ssl/key.pem" ]]; then
        log_warn "SSL certificates not found, generating self-signed certificates..."
        
        mkdir -p ssl
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem \
            -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        log_info "Self-signed SSL certificates generated"
        log_warn "For production, replace with proper SSL certificates"
    else
        log_info "SSL certificates found ✓"
    fi
}

setup_backup() {
    log_info "Setting up backup system..."
    
    # Create backup script
    cat > scripts/backup.sh << 'EOF'
#!/bin/bash
# Automated backup script

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Database backup
docker-compose exec -T postgres pg_dump -U ai_interior_designer ai_interior_designer > "$BACKUP_DIR/db_$DATE.sql"

# Redis backup
docker-compose exec -T redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# MinIO backup (if using local storage)
docker run --rm -v minio_data:/data -v "$BACKUP_DIR":/backup alpine tar czf "/backup/minio_$DATE.tar.gz" -C /data .

# Clean old backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF
    
    chmod +x scripts/backup.sh
    
    # Setup cron job for daily backups
    log_info "To setup daily backups, add this to your crontab:"
    echo "0 2 * * * $(pwd)/scripts/backup.sh"
    
    log_info "Backup system setup complete ✓"
}

show_deployment_info() {
    log_info "🎉 Deployment completed successfully!"
    echo ""
    echo "📋 Deployment Information:"
    echo "=========================="
    echo "Environment: $ENVIRONMENT"
    echo "API URL: http://localhost:3000"
    echo "API Docs: http://localhost:3000/api/docs"
    echo "Grafana: http://localhost:3001 (admin/\$GRAFANA_PASSWORD)"
    echo "Prometheus: http://localhost:9090"
    echo "MinIO Console: http://localhost:9001"
    echo ""
    echo "📊 Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "📝 Next Steps:"
    echo "1. Configure your domain and SSL certificates"
    echo "2. Set up monitoring alerts"
    echo "3. Configure backup retention policies"
    echo "4. Review security settings"
    echo "5. Set up CI/CD pipelines"
    echo ""
    echo "📚 Useful Commands:"
    echo "- View logs: docker-compose -f $COMPOSE_FILE logs -f [service]"
    echo "- Scale service: docker-compose -f $COMPOSE_FILE up -d --scale [service]=N"
    echo "- Update service: docker-compose -f $COMPOSE_FILE up -d [service]"
    echo "- Backup: ./scripts/backup.sh"
    echo ""
}

# Main deployment flow
main() {
    log_info "Starting AI Interior Designer production deployment"
    
    check_prerequisites
    setup_infrastructure
    setup_ssl
    build_images
    run_database_migrations
    setup_monitoring
    deploy_services
    run_health_checks
    setup_backup
    show_deployment_info
    
    log_info "🚀 Production deployment completed successfully!"
}

# Handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"
