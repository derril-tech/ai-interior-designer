#!/bin/bash

# Comprehensive Security and Compliance Audit
set -e

# Configuration
AUDIT_REPORT_DIR="audit_reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$AUDIT_REPORT_DIR/security_audit_$TIMESTAMP.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

# Initialize audit report
init_audit_report() {
    mkdir -p "$AUDIT_REPORT_DIR"
    
    cat > "$REPORT_FILE" << EOF
{
    "audit_metadata": {
        "timestamp": "$TIMESTAMP",
        "date": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
        "hostname": "$(hostname)",
        "auditor": "automated-security-audit",
        "version": "1.0.0"
    },
    "compliance_frameworks": ["OWASP", "GDPR", "SOC2", "ISO27001"],
    "audit_results": {
        "infrastructure": {},
        "application": {},
        "data": {},
        "access_control": {},
        "monitoring": {},
        "compliance": {}
    },
    "vulnerabilities": [],
    "recommendations": [],
    "score": {
        "overall": 0,
        "categories": {}
    }
}
EOF
}

# Add result to audit report
add_audit_result() {
    local category="$1"
    local check_name="$2"
    local status="$3"
    local details="$4"
    local severity="${5:-medium}"
    
    # Update the JSON report using jq
    if command -v jq >/dev/null 2>&1; then
        tmp_file=$(mktemp)
        jq --arg cat "$category" \
           --arg name "$check_name" \
           --arg status "$status" \
           --arg details "$details" \
           --arg severity "$severity" \
           '.audit_results[$cat][$name] = {
               "status": $status,
               "details": $details,
               "severity": $severity,
               "timestamp": now | strftime("%Y-%m-%dT%H:%M:%S.000Z")
           }' "$REPORT_FILE" > "$tmp_file" && mv "$tmp_file" "$REPORT_FILE"
    fi
}

# Add vulnerability to report
add_vulnerability() {
    local title="$1"
    local description="$2"
    local severity="$3"
    local remediation="$4"
    
    if command -v jq >/dev/null 2>&1; then
        tmp_file=$(mktemp)
        jq --arg title "$title" \
           --arg desc "$description" \
           --arg sev "$severity" \
           --arg rem "$remediation" \
           '.vulnerabilities += [{
               "title": $title,
               "description": $desc,
               "severity": $sev,
               "remediation": $rem,
               "discovered_at": now | strftime("%Y-%m-%dT%H:%M:%S.000Z")
           }]' "$REPORT_FILE" > "$tmp_file" && mv "$tmp_file" "$REPORT_FILE"
    fi
}

# Add recommendation to report
add_recommendation() {
    local title="$1"
    local description="$2"
    local priority="$3"
    
    if command -v jq >/dev/null 2>&1; then
        tmp_file=$(mktemp)
        jq --arg title "$title" \
           --arg desc "$description" \
           --arg pri "$priority" \
           '.recommendations += [{
               "title": $title,
               "description": $desc,
               "priority": $pri,
               "category": "security"
           }]' "$REPORT_FILE" > "$tmp_file" && mv "$tmp_file" "$REPORT_FILE"
    fi
}

# Infrastructure Security Audit
audit_infrastructure() {
    log_check "Auditing infrastructure security..."
    
    # Docker security
    log_info "Checking Docker security configuration..."
    
    # Check if Docker daemon is running as root
    if docker info 2>/dev/null | grep -q "Server Version"; then
        add_audit_result "infrastructure" "docker_daemon_running" "pass" "Docker daemon is running"
        
        # Check Docker version
        docker_version=$(docker version --format '{{.Server.Version}}')
        add_audit_result "infrastructure" "docker_version" "info" "Docker version: $docker_version"
        
        # Check for privileged containers
        privileged_containers=$(docker ps --format "table {{.Names}}\t{{.Status}}" --filter "label=privileged=true" | wc -l)
        if [[ $privileged_containers -gt 1 ]]; then  # Subtract header line
            add_vulnerability "Privileged Containers" "Found $((privileged_containers-1)) privileged containers running" "high" "Review and minimize privileged container usage"
        else
            add_audit_result "infrastructure" "privileged_containers" "pass" "No privileged containers detected"
        fi
        
    else
        add_audit_result "infrastructure" "docker_daemon_running" "fail" "Docker daemon not accessible" "high"
    fi
    
    # Network security
    log_info "Checking network security..."
    
    # Check open ports
    if command -v netstat >/dev/null 2>&1; then
        open_ports=$(netstat -tuln | grep LISTEN | wc -l)
        add_audit_result "infrastructure" "open_ports" "info" "Found $open_ports listening ports"
        
        # Check for dangerous ports
        dangerous_ports=("22" "23" "135" "139" "445" "1433" "3389")
        for port in "${dangerous_ports[@]}"; do
            if netstat -tuln | grep ":$port " >/dev/null; then
                add_vulnerability "Dangerous Port Open" "Port $port is listening and may pose security risk" "medium" "Review necessity of port $port and implement proper access controls"
            fi
        done
    fi
    
    # SSL/TLS configuration
    log_info "Checking SSL/TLS configuration..."
    
    if [[ -d "certbot/conf/live" ]]; then
        cert_dirs=$(find certbot/conf/live -type d -mindepth 1 | wc -l)
        add_audit_result "infrastructure" "ssl_certificates" "pass" "Found $cert_dirs SSL certificate(s)"
        
        # Check certificate expiration
        for cert_dir in certbot/conf/live/*/; do
            if [[ -f "$cert_dir/fullchain.pem" ]]; then
                domain=$(basename "$cert_dir")
                expiry_date=$(openssl x509 -in "$cert_dir/fullchain.pem" -noout -enddate | cut -d= -f2)
                expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || echo 0)
                current_timestamp=$(date +%s)
                days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
                
                if [[ $days_until_expiry -lt 30 ]]; then
                    add_vulnerability "SSL Certificate Expiring" "Certificate for $domain expires in $days_until_expiry days" "medium" "Renew SSL certificate before expiration"
                else
                    add_audit_result "infrastructure" "ssl_cert_$domain" "pass" "Certificate valid for $days_until_expiry days"
                fi
            fi
        done
    else
        add_audit_result "infrastructure" "ssl_certificates" "fail" "No SSL certificates found" "high"
    fi
}

# Application Security Audit
audit_application() {
    log_check "Auditing application security..."
    
    # Environment variables security
    log_info "Checking environment variable security..."
    
    if [[ -f ".env" ]]; then
        add_audit_result "application" "env_file_exists" "pass" "Environment file found"
        
        # Check for weak secrets
        weak_secrets=0
        while IFS= read -r line; do
            if [[ "$line" =~ ^[A-Z_]+.*=.*$ ]]; then
                var_name=$(echo "$line" | cut -d= -f1)
                var_value=$(echo "$line" | cut -d= -f2-)
                
                # Check for default/weak values
                case "$var_name" in
                    *PASSWORD*|*SECRET*|*KEY*)
                        if [[ ${#var_value} -lt 16 ]]; then
                            weak_secrets=$((weak_secrets + 1))
                        elif [[ "$var_value" =~ ^(password|secret|key|admin|test)$ ]]; then
                            weak_secrets=$((weak_secrets + 1))
                        fi
                        ;;
                esac
            fi
        done < .env
        
        if [[ $weak_secrets -gt 0 ]]; then
            add_vulnerability "Weak Secrets" "Found $weak_secrets potentially weak secrets in environment file" "high" "Use strong, randomly generated secrets for all sensitive variables"
        else
            add_audit_result "application" "secret_strength" "pass" "All secrets appear to be strong"
        fi
        
        # Check file permissions
        env_perms=$(stat -c %a .env 2>/dev/null || stat -f %A .env 2>/dev/null || echo "unknown")
        if [[ "$env_perms" != "600" ]] && [[ "$env_perms" != "400" ]]; then
            add_vulnerability "Insecure File Permissions" ".env file has permissions $env_perms (should be 600 or 400)" "medium" "Set secure permissions: chmod 600 .env"
        else
            add_audit_result "application" "env_file_permissions" "pass" "Environment file has secure permissions"
        fi
    else
        add_audit_result "application" "env_file_exists" "fail" "No environment file found" "medium"
    fi
    
    # Docker Compose security
    log_info "Checking Docker Compose security..."
    
    if [[ -f "docker-compose.prod.yml" ]]; then
        # Check for hardcoded secrets
        hardcoded_secrets=$(grep -i "password\|secret\|key" docker-compose.prod.yml | grep -v "\${" | wc -l)
        if [[ $hardcoded_secrets -gt 0 ]]; then
            add_vulnerability "Hardcoded Secrets" "Found $hardcoded_secrets potential hardcoded secrets in Docker Compose file" "high" "Use environment variables for all secrets"
        else
            add_audit_result "application" "compose_secrets" "pass" "No hardcoded secrets found in Docker Compose"
        fi
        
        # Check for privileged mode
        if grep -q "privileged.*true" docker-compose.prod.yml; then
            add_vulnerability "Privileged Containers" "Containers running in privileged mode detected" "high" "Remove privileged mode unless absolutely necessary"
        else
            add_audit_result "application" "compose_privileged" "pass" "No privileged containers in Docker Compose"
        fi
        
        # Check for host network mode
        if grep -q "network_mode.*host" docker-compose.prod.yml; then
            add_vulnerability "Host Network Mode" "Containers using host network mode detected" "medium" "Use bridge networking instead of host mode"
        else
            add_audit_result "application" "compose_network" "pass" "Proper network isolation in Docker Compose"
        fi
    fi
    
    # API security
    log_info "Checking API security..."
    
    # Test API endpoints if service is running
    if curl -s -f http://localhost:3000/api/health >/dev/null 2>&1; then
        add_audit_result "application" "api_accessible" "pass" "API is accessible"
        
        # Check security headers
        headers=$(curl -s -I http://localhost:3000/api/health)
        
        security_headers=("X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection" "Strict-Transport-Security")
        missing_headers=0
        
        for header in "${security_headers[@]}"; do
            if echo "$headers" | grep -qi "$header"; then
                add_audit_result "application" "header_${header,,}" "pass" "Security header $header present"
            else
                missing_headers=$((missing_headers + 1))
                add_audit_result "application" "header_${header,,}" "fail" "Security header $header missing" "medium"
            fi
        done
        
        if [[ $missing_headers -gt 0 ]]; then
            add_recommendation "Add Security Headers" "Implement missing security headers to prevent common attacks" "high"
        fi
        
        # Check for HTTPS redirect
        http_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/ 2>/dev/null || echo "000")
        if [[ "$http_response" == "301" ]] || [[ "$http_response" == "302" ]]; then
            add_audit_result "application" "https_redirect" "pass" "HTTP to HTTPS redirect configured"
        else
            add_audit_result "application" "https_redirect" "fail" "No HTTP to HTTPS redirect detected" "medium"
        fi
        
    else
        add_audit_result "application" "api_accessible" "fail" "API not accessible for testing" "low"
    fi
}

# Data Security Audit
audit_data_security() {
    log_check "Auditing data security..."
    
    # Database security
    log_info "Checking database security..."
    
    if docker-compose ps postgres >/dev/null 2>&1; then
        add_audit_result "data" "database_running" "pass" "Database service is running"
        
        # Check database version
        db_version=$(docker-compose exec -T postgres psql -U ai_interior_designer -d ai_interior_designer -t -c "SELECT version();" 2>/dev/null | head -1 | xargs || echo "unknown")
        add_audit_result "data" "database_version" "info" "Database version: $db_version"
        
        # Check for default passwords (this is a simplified check)
        if grep -q "POSTGRES_PASSWORD.*password" docker-compose.prod.yml 2>/dev/null; then
            add_vulnerability "Default Database Password" "Database may be using default password" "critical" "Change database password to a strong, unique value"
        fi
        
    else
        add_audit_result "data" "database_running" "fail" "Database service not running" "high"
    fi
    
    # Backup security
    log_info "Checking backup security..."
    
    if [[ -d "/backups" ]] || [[ -d "backups" ]]; then
        backup_dir="/backups"
        [[ -d "backups" ]] && backup_dir="backups"
        
        backup_count=$(find "$backup_dir" -name "*backup*" -type f -o -name "*backup*" -type d | wc -l)
        add_audit_result "data" "backups_exist" "pass" "Found $backup_count backup(s)"
        
        # Check backup encryption
        encrypted_backups=$(find "$backup_dir" -name "*.enc" | wc -l)
        if [[ $encrypted_backups -gt 0 ]]; then
            add_audit_result "data" "backup_encryption" "pass" "Found $encrypted_backups encrypted backup(s)"
        else
            add_recommendation "Encrypt Backups" "Enable backup encryption to protect sensitive data" "high"
        fi
        
        # Check backup permissions
        insecure_backups=0
        find "$backup_dir" -name "*backup*" -type f -exec stat -c "%n %a" {} \; | while read file perms; do
            if [[ "$perms" != "600" ]] && [[ "$perms" != "400" ]]; then
                insecure_backups=$((insecure_backups + 1))
            fi
        done
        
        if [[ $insecure_backups -gt 0 ]]; then
            add_vulnerability "Insecure Backup Permissions" "Found backups with insecure file permissions" "medium" "Set secure permissions (600) on all backup files"
        fi
        
    else
        add_audit_result "data" "backups_exist" "fail" "No backup directory found" "medium"
    fi
    
    # Redis security
    log_info "Checking Redis security..."
    
    if docker-compose ps redis >/dev/null 2>&1; then
        add_audit_result "data" "redis_running" "pass" "Redis service is running"
        
        # Check Redis authentication
        if docker-compose exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
            add_vulnerability "Redis No Authentication" "Redis is accessible without authentication" "high" "Enable Redis authentication with requirepass"
        else
            add_audit_result "data" "redis_auth" "pass" "Redis authentication is enabled"
        fi
    fi
}

# Access Control Audit
audit_access_control() {
    log_check "Auditing access control..."
    
    # File permissions audit
    log_info "Checking file permissions..."
    
    # Check for world-writable files
    world_writable=$(find . -type f -perm -002 2>/dev/null | grep -v ".git" | wc -l)
    if [[ $world_writable -gt 0 ]]; then
        add_vulnerability "World-Writable Files" "Found $world_writable world-writable files" "medium" "Remove world-write permissions from sensitive files"
    else
        add_audit_result "access_control" "world_writable_files" "pass" "No world-writable files found"
    fi
    
    # Check for SUID/SGID files
    suid_files=$(find . -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null | wc -l)
    if [[ $suid_files -gt 0 ]]; then
        add_audit_result "access_control" "suid_files" "warn" "Found $suid_files SUID/SGID files" "low"
    else
        add_audit_result "access_control" "suid_files" "pass" "No SUID/SGID files found"
    fi
    
    # SSH security (if applicable)
    if [[ -f "/etc/ssh/sshd_config" ]]; then
        log_info "Checking SSH configuration..."
        
        # Check for root login
        if grep -q "^PermitRootLogin yes" /etc/ssh/sshd_config 2>/dev/null; then
            add_vulnerability "SSH Root Login Enabled" "SSH root login is enabled" "high" "Disable SSH root login: PermitRootLogin no"
        else
            add_audit_result "access_control" "ssh_root_login" "pass" "SSH root login is disabled"
        fi
        
        # Check for password authentication
        if grep -q "^PasswordAuthentication yes" /etc/ssh/sshd_config 2>/dev/null; then
            add_recommendation "Disable SSH Password Auth" "Consider disabling SSH password authentication and using key-based auth only" "medium"
        fi
    fi
}

# Monitoring and Logging Audit
audit_monitoring() {
    log_check "Auditing monitoring and logging..."
    
    # Check monitoring services
    log_info "Checking monitoring services..."
    
    monitoring_services=("prometheus" "grafana" "loki")
    for service in "${monitoring_services[@]}"; do
        if docker-compose ps "$service" >/dev/null 2>&1; then
            add_audit_result "monitoring" "${service}_running" "pass" "$service service is running"
        else
            add_audit_result "monitoring" "${service}_running" "fail" "$service service not running" "medium"
        fi
    done
    
    # Check log retention
    log_info "Checking log retention..."
    
    if [[ -d "/var/log" ]]; then
        large_logs=$(find /var/log -type f -size +100M 2>/dev/null | wc -l)
        if [[ $large_logs -gt 0 ]]; then
            add_recommendation "Log Rotation" "Found $large_logs large log files. Implement log rotation to manage disk space" "medium"
        fi
    fi
    
    # Check for centralized logging
    if docker-compose ps loki >/dev/null 2>&1 && docker-compose ps promtail >/dev/null 2>&1; then
        add_audit_result "monitoring" "centralized_logging" "pass" "Centralized logging is configured"
    else
        add_recommendation "Centralized Logging" "Implement centralized logging for better security monitoring" "medium"
    fi
}

# Compliance Audit
audit_compliance() {
    log_check "Auditing compliance requirements..."
    
    # GDPR compliance checks
    log_info "Checking GDPR compliance..."
    
    # Check for privacy policy
    if [[ -f "PRIVACY_POLICY.md" ]] || [[ -f "privacy-policy.md" ]]; then
        add_audit_result "compliance" "privacy_policy" "pass" "Privacy policy document found"
    else
        add_audit_result "compliance" "privacy_policy" "fail" "Privacy policy document not found" "high"
        add_recommendation "Create Privacy Policy" "Create and maintain a comprehensive privacy policy for GDPR compliance" "high"
    fi
    
    # Check for data retention policy
    if grep -r "retention" . --include="*.md" --include="*.txt" >/dev/null 2>&1; then
        add_audit_result "compliance" "data_retention_policy" "pass" "Data retention policy mentioned in documentation"
    else
        add_recommendation "Data Retention Policy" "Document data retention policies and implement automated cleanup" "medium"
    fi
    
    # SOC2 compliance checks
    log_info "Checking SOC2 compliance..."
    
    # Check for audit logging
    if docker-compose logs api 2>/dev/null | grep -i "audit\|login\|access" >/dev/null; then
        add_audit_result "compliance" "audit_logging" "pass" "Audit logging appears to be implemented"
    else
        add_recommendation "Audit Logging" "Implement comprehensive audit logging for SOC2 compliance" "high"
    fi
    
    # Check for access controls
    if grep -r "role\|permission" apps/api/src --include="*.ts" >/dev/null 2>&1; then
        add_audit_result "compliance" "access_controls" "pass" "Access control implementation found"
    else
        add_audit_result "compliance" "access_controls" "fail" "Access control implementation not found" "high"
    fi
}

# Calculate security score
calculate_security_score() {
    log_info "Calculating security score..."
    
    if command -v jq >/dev/null 2>&1; then
        # Count pass/fail results
        total_checks=$(jq '[.audit_results[][] | select(.status)] | length' "$REPORT_FILE")
        passed_checks=$(jq '[.audit_results[][] | select(.status == "pass")] | length' "$REPORT_FILE")
        failed_checks=$(jq '[.audit_results[][] | select(.status == "fail")] | length' "$REPORT_FILE")
        
        # Count vulnerabilities by severity
        critical_vulns=$(jq '[.vulnerabilities[] | select(.severity == "critical")] | length' "$REPORT_FILE")
        high_vulns=$(jq '[.vulnerabilities[] | select(.severity == "high")] | length' "$REPORT_FILE")
        medium_vulns=$(jq '[.vulnerabilities[] | select(.severity == "medium")] | length' "$REPORT_FILE")
        low_vulns=$(jq '[.vulnerabilities[] | select(.severity == "low")] | length' "$REPORT_FILE")
        
        # Calculate base score
        if [[ $total_checks -gt 0 ]]; then
            base_score=$((passed_checks * 100 / total_checks))
        else
            base_score=0
        fi
        
        # Apply vulnerability penalties
        penalty=$((critical_vulns * 20 + high_vulns * 10 + medium_vulns * 5 + low_vulns * 2))
        final_score=$((base_score - penalty))
        [[ $final_score -lt 0 ]] && final_score=0
        
        # Update report with scores
        tmp_file=$(mktemp)
        jq --argjson total "$total_checks" \
           --argjson passed "$passed_checks" \
           --argjson failed "$failed_checks" \
           --argjson score "$final_score" \
           --argjson critical "$critical_vulns" \
           --argjson high "$high_vulns" \
           --argjson medium "$medium_vulns" \
           --argjson low "$low_vulns" \
           '.score.overall = $score |
            .score.categories = {
                "total_checks": $total,
                "passed_checks": $passed,
                "failed_checks": $failed,
                "vulnerabilities": {
                    "critical": $critical,
                    "high": $high,
                    "medium": $medium,
                    "low": $low
                }
            }' "$REPORT_FILE" > "$tmp_file" && mv "$tmp_file" "$REPORT_FILE"
        
        echo "$final_score"
    else
        echo "0"
    fi
}

# Generate audit report
generate_report() {
    log_info "Generating audit report..."
    
    local score=$(calculate_security_score)
    
    echo ""
    echo "🔒 SECURITY AUDIT REPORT"
    echo "========================"
    echo "Timestamp: $(date)"
    echo "Overall Security Score: $score/100"
    echo ""
    
    if command -v jq >/dev/null 2>&1; then
        echo "📊 Summary:"
        echo "-----------"
        jq -r '.score.categories | 
               "Total Checks: \(.total_checks)",
               "Passed: \(.passed_checks)",
               "Failed: \(.failed_checks)",
               "",
               "Vulnerabilities:",
               "  Critical: \(.vulnerabilities.critical)",
               "  High: \(.vulnerabilities.high)", 
               "  Medium: \(.vulnerabilities.medium)",
               "  Low: \(.vulnerabilities.low)"' "$REPORT_FILE"
        
        echo ""
        echo "🚨 Critical Issues:"
        echo "-------------------"
        jq -r '.vulnerabilities[] | select(.severity == "critical") | "- \(.title): \(.description)"' "$REPORT_FILE"
        
        echo ""
        echo "⚠️  High Priority Issues:"
        echo "-------------------------"
        jq -r '.vulnerabilities[] | select(.severity == "high") | "- \(.title): \(.description)"' "$REPORT_FILE"
        
        echo ""
        echo "💡 Recommendations:"
        echo "-------------------"
        jq -r '.recommendations[] | "- \(.title): \(.description)"' "$REPORT_FILE"
    fi
    
    echo ""
    echo "📄 Full report saved to: $REPORT_FILE"
    echo ""
    
    # Security score interpretation
    if [[ $score -ge 90 ]]; then
        echo -e "${GREEN}✅ EXCELLENT: Your security posture is very strong${NC}"
    elif [[ $score -ge 75 ]]; then
        echo -e "${BLUE}✅ GOOD: Your security is solid with minor improvements needed${NC}"
    elif [[ $score -ge 60 ]]; then
        echo -e "${YELLOW}⚠️  FAIR: Several security issues need attention${NC}"
    elif [[ $score -ge 40 ]]; then
        echo -e "${YELLOW}⚠️  POOR: Significant security improvements required${NC}"
    else
        echo -e "${RED}❌ CRITICAL: Immediate security action required${NC}"
    fi
}

# Main audit execution
main() {
    log_info "Starting comprehensive security audit..."
    
    init_audit_report
    
    audit_infrastructure
    audit_application
    audit_data_security
    audit_access_control
    audit_monitoring
    audit_compliance
    
    generate_report
    
    log_info "Security audit completed!"
}

# Run the audit
main "$@"
