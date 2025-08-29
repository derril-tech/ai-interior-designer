#!/bin/bash

# Comprehensive Disaster Recovery System
set -e

# Configuration
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_LOCATION=${BACKUP_LOCATION:-"/backups"}
S3_BACKUP_BUCKET=${S3_BACKUP_BUCKET:-"ai-interior-designer-backups"}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-""}
NOTIFICATION_WEBHOOK=${NOTIFICATION_WEBHOOK:-""}

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

send_notification() {
    local message="$1"
    local status="$2"
    
    if [[ -n "$NOTIFICATION_WEBHOOK" ]]; then
        curl -X POST "$NOTIFICATION_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"text\":\"🔄 Disaster Recovery: $message\", \"status\":\"$status\"}" \
            >/dev/null 2>&1 || true
    fi
}

create_full_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$BACKUP_LOCATION/full_backup_$timestamp"
    
    log_step "Creating full system backup: $backup_dir"
    mkdir -p "$backup_dir"
    
    # Database backup
    log_info "Backing up PostgreSQL database..."
    docker-compose exec -T postgres pg_dump -U ai_interior_designer ai_interior_designer | \
        gzip > "$backup_dir/database.sql.gz"
    
    # Redis backup
    log_info "Backing up Redis data..."
    docker-compose exec -T redis redis-cli BGSAVE
    sleep 5  # Wait for background save to complete
    docker cp $(docker-compose ps -q redis):/data/dump.rdb "$backup_dir/redis.rdb"
    
    # NATS JetStream backup
    log_info "Backing up NATS JetStream..."
    docker cp $(docker-compose ps -q nats):/data "$backup_dir/nats_data"
    
    # MinIO/S3 data backup
    log_info "Backing up object storage..."
    if docker-compose ps minio >/dev/null 2>&1; then
        docker run --rm \
            -v minio_data:/source \
            -v "$backup_dir":/backup \
            alpine tar czf /backup/minio_data.tar.gz -C /source .
    fi
    
    # Application configuration backup
    log_info "Backing up application configuration..."
    tar czf "$backup_dir/config.tar.gz" \
        docker-compose.prod.yml \
        nginx/ \
        monitoring/ \
        scripts/ \
        .env 2>/dev/null || true
    
    # Container images backup
    log_info "Backing up Docker images..."
    docker images --format "table {{.Repository}}:{{.Tag}}" | \
        grep "ai-interior-designer" | \
        while read image; do
            if [[ "$image" != "REPOSITORY:TAG" ]]; then
                image_name=$(echo "$image" | tr '/:' '_')
                docker save "$image" | gzip > "$backup_dir/image_$image_name.tar.gz"
            fi
        done
    
    # SSL certificates backup
    log_info "Backing up SSL certificates..."
    if [[ -d "certbot/conf" ]]; then
        tar czf "$backup_dir/ssl_certificates.tar.gz" certbot/
    fi
    
    # Create backup manifest
    log_info "Creating backup manifest..."
    cat > "$backup_dir/manifest.json" << EOF
{
    "backup_type": "full",
    "timestamp": "$timestamp",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
    "hostname": "$(hostname)",
    "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "components": {
        "database": "$(stat -f%z "$backup_dir/database.sql.gz" 2>/dev/null || stat -c%s "$backup_dir/database.sql.gz" 2>/dev/null || echo 0)",
        "redis": "$(stat -f%z "$backup_dir/redis.rdb" 2>/dev/null || stat -c%s "$backup_dir/redis.rdb" 2>/dev/null || echo 0)",
        "nats": "$(du -sb "$backup_dir/nats_data" 2>/dev/null | cut -f1 || echo 0)",
        "storage": "$(stat -f%z "$backup_dir/minio_data.tar.gz" 2>/dev/null || stat -c%s "$backup_dir/minio_data.tar.gz" 2>/dev/null || echo 0)",
        "config": "$(stat -f%z "$backup_dir/config.tar.gz" 2>/dev/null || stat -c%s "$backup_dir/config.tar.gz" 2>/dev/null || echo 0)"
    }
}
EOF
    
    # Encrypt backup if encryption key is provided
    if [[ -n "$ENCRYPTION_KEY" ]]; then
        log_info "Encrypting backup..."
        tar czf - -C "$BACKUP_LOCATION" "full_backup_$timestamp" | \
            openssl enc -aes-256-cbc -salt -k "$ENCRYPTION_KEY" > "$backup_dir.enc"
        rm -rf "$backup_dir"
        backup_dir="$backup_dir.enc"
    fi
    
    # Upload to S3 if configured
    if command -v aws >/dev/null 2>&1 && [[ -n "$S3_BACKUP_BUCKET" ]]; then
        log_info "Uploading backup to S3..."
        aws s3 cp "$backup_dir" "s3://$S3_BACKUP_BUCKET/$(basename "$backup_dir")" \
            --storage-class STANDARD_IA
    fi
    
    log_info "Full backup completed: $(basename "$backup_dir")"
    send_notification "Full backup completed successfully" "success"
    
    echo "$backup_dir"
}

create_incremental_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$BACKUP_LOCATION/incremental_backup_$timestamp"
    
    log_step "Creating incremental backup: $backup_dir"
    mkdir -p "$backup_dir"
    
    # Database incremental backup (WAL files)
    log_info "Creating database incremental backup..."
    docker-compose exec -T postgres pg_dump -U ai_interior_designer ai_interior_designer \
        --format=custom --no-owner --no-privileges | \
        gzip > "$backup_dir/database_incremental.dump.gz"
    
    # Redis AOF backup
    log_info "Backing up Redis AOF..."
    if docker-compose exec -T redis redis-cli CONFIG GET appendonly | grep -q yes; then
        docker cp $(docker-compose ps -q redis):/data/appendonly.aof "$backup_dir/" 2>/dev/null || true
    fi
    
    # Application logs backup
    log_info "Backing up application logs..."
    docker-compose logs --no-color --timestamps > "$backup_dir/application.log" 2>/dev/null || true
    
    # Create incremental manifest
    cat > "$backup_dir/manifest.json" << EOF
{
    "backup_type": "incremental",
    "timestamp": "$timestamp",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
    "hostname": "$(hostname)",
    "base_backup": "$(find "$BACKUP_LOCATION" -name "full_backup_*" -type d | sort | tail -1 | xargs basename)"
}
EOF
    
    log_info "Incremental backup completed: $(basename "$backup_dir")"
    echo "$backup_dir"
}

restore_from_backup() {
    local backup_path="$1"
    local restore_type="${2:-full}"
    
    if [[ ! -e "$backup_path" ]]; then
        log_error "Backup not found: $backup_path"
        exit 1
    fi
    
    log_step "Starting restore from backup: $(basename "$backup_path")"
    send_notification "Starting system restore from backup" "warning"
    
    # Stop all services
    log_info "Stopping all services..."
    docker-compose down
    
    # Decrypt backup if needed
    local restore_dir="$backup_path"
    if [[ "$backup_path" == *.enc ]]; then
        if [[ -z "$ENCRYPTION_KEY" ]]; then
            log_error "Encryption key required for encrypted backup"
            exit 1
        fi
        
        log_info "Decrypting backup..."
        restore_dir="${backup_path%.enc}"
        openssl enc -aes-256-cbc -d -salt -k "$ENCRYPTION_KEY" -in "$backup_path" | \
            tar xzf - -C "$BACKUP_LOCATION"
    fi
    
    if [[ "$restore_type" == "full" ]]; then
        # Full restore
        log_info "Performing full system restore..."
        
        # Restore database
        if [[ -f "$restore_dir/database.sql.gz" ]]; then
            log_info "Restoring PostgreSQL database..."
            docker-compose up -d postgres
            sleep 30  # Wait for database to start
            
            zcat "$restore_dir/database.sql.gz" | \
                docker-compose exec -T postgres psql -U ai_interior_designer ai_interior_designer
        fi
        
        # Restore Redis
        if [[ -f "$restore_dir/redis.rdb" ]]; then
            log_info "Restoring Redis data..."
            docker volume rm redis_data 2>/dev/null || true
            docker volume create redis_data
            docker run --rm -v redis_data:/data -v "$restore_dir":/backup alpine \
                cp /backup/redis.rdb /data/dump.rdb
        fi
        
        # Restore NATS
        if [[ -d "$restore_dir/nats_data" ]]; then
            log_info "Restoring NATS JetStream..."
            docker volume rm nats_data 2>/dev/null || true
            docker volume create nats_data
            docker run --rm -v nats_data:/data -v "$restore_dir/nats_data":/backup alpine \
                cp -r /backup/* /data/
        fi
        
        # Restore MinIO/S3 data
        if [[ -f "$restore_dir/minio_data.tar.gz" ]]; then
            log_info "Restoring object storage..."
            docker volume rm minio_data 2>/dev/null || true
            docker volume create minio_data
            docker run --rm -v minio_data:/data -v "$restore_dir":/backup alpine \
                tar xzf /backup/minio_data.tar.gz -C /data
        fi
        
        # Restore configuration
        if [[ -f "$restore_dir/config.tar.gz" ]]; then
            log_info "Restoring configuration..."
            tar xzf "$restore_dir/config.tar.gz"
        fi
        
        # Restore SSL certificates
        if [[ -f "$restore_dir/ssl_certificates.tar.gz" ]]; then
            log_info "Restoring SSL certificates..."
            tar xzf "$restore_dir/ssl_certificates.tar.gz"
        fi
        
        # Restore Docker images
        log_info "Restoring Docker images..."
        find "$restore_dir" -name "image_*.tar.gz" -exec docker load -i {} \;
        
    else
        # Incremental restore
        log_info "Performing incremental restore..."
        
        if [[ -f "$restore_dir/database_incremental.dump.gz" ]]; then
            log_info "Restoring incremental database backup..."
            docker-compose up -d postgres
            sleep 30
            
            zcat "$restore_dir/database_incremental.dump.gz" | \
                docker-compose exec -T postgres pg_restore -U ai_interior_designer -d ai_interior_designer
        fi
    fi
    
    # Start all services
    log_info "Starting all services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 60
    
    # Verify restore
    if curl -f -s http://localhost:3000/api/health >/dev/null; then
        log_info "✅ Restore completed successfully!"
        send_notification "System restore completed successfully" "success"
    else
        log_error "❌ Restore completed but health check failed"
        send_notification "System restore completed but health check failed" "error"
    fi
}

cleanup_old_backups() {
    log_step "Cleaning up old backups (older than $BACKUP_RETENTION_DAYS days)"
    
    # Local cleanup
    find "$BACKUP_LOCATION" -name "*backup_*" -type d -mtime +$BACKUP_RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
    find "$BACKUP_LOCATION" -name "*backup_*.enc" -type f -mtime +$BACKUP_RETENTION_DAYS -delete 2>/dev/null || true
    
    # S3 cleanup
    if command -v aws >/dev/null 2>&1 && [[ -n "$S3_BACKUP_BUCKET" ]]; then
        log_info "Cleaning up old S3 backups..."
        aws s3 ls "s3://$S3_BACKUP_BUCKET/" | \
            awk '{print $4}' | \
            while read file; do
                if [[ -n "$file" ]]; then
                    file_date=$(echo "$file" | grep -o '[0-9]\{8\}' | head -1)
                    if [[ -n "$file_date" ]]; then
                        file_timestamp=$(date -d "$file_date" +%s 2>/dev/null || echo 0)
                        cutoff_timestamp=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%s)
                        
                        if [[ $file_timestamp -lt $cutoff_timestamp ]]; then
                            aws s3 rm "s3://$S3_BACKUP_BUCKET/$file"
                            log_info "Deleted old S3 backup: $file"
                        fi
                    fi
                fi
            done
    fi
    
    log_info "Backup cleanup completed"
}

test_backup_integrity() {
    local backup_path="$1"
    
    log_step "Testing backup integrity: $(basename "$backup_path")"
    
    if [[ ! -e "$backup_path" ]]; then
        log_error "Backup not found: $backup_path"
        return 1
    fi
    
    # Test encrypted backup
    if [[ "$backup_path" == *.enc ]]; then
        if [[ -z "$ENCRYPTION_KEY" ]]; then
            log_error "Cannot test encrypted backup without encryption key"
            return 1
        fi
        
        log_info "Testing encrypted backup integrity..."
        if openssl enc -aes-256-cbc -d -salt -k "$ENCRYPTION_KEY" -in "$backup_path" | tar tzf - >/dev/null 2>&1; then
            log_info "✅ Encrypted backup integrity test passed"
        else
            log_error "❌ Encrypted backup integrity test failed"
            return 1
        fi
    else
        # Test unencrypted backup
        if [[ -d "$backup_path" ]]; then
            log_info "Testing backup directory structure..."
            
            # Check manifest
            if [[ -f "$backup_path/manifest.json" ]]; then
                if jq . "$backup_path/manifest.json" >/dev/null 2>&1; then
                    log_info "✅ Backup manifest is valid"
                else
                    log_error "❌ Backup manifest is invalid"
                    return 1
                fi
            fi
            
            # Check database backup
            if [[ -f "$backup_path/database.sql.gz" ]]; then
                if zcat "$backup_path/database.sql.gz" | head -1 | grep -q "PostgreSQL database dump"; then
                    log_info "✅ Database backup is valid"
                else
                    log_error "❌ Database backup is invalid"
                    return 1
                fi
            fi
            
            log_info "✅ Backup integrity test passed"
        else
            log_error "❌ Backup directory not found"
            return 1
        fi
    fi
    
    return 0
}

show_backup_status() {
    log_step "Backup Status Report"
    
    echo "📊 Local Backups:"
    echo "=================="
    
    local backup_count=0
    local total_size=0
    
    for backup in "$BACKUP_LOCATION"/*backup_*; do
        if [[ -e "$backup" ]]; then
            backup_count=$((backup_count + 1))
            if [[ -d "$backup" ]]; then
                size=$(du -sh "$backup" | cut -f1)
            else
                size=$(ls -lh "$backup" | awk '{print $5}')
            fi
            echo "  $(basename "$backup"): $size"
        fi
    done
    
    echo ""
    echo "📈 Summary:"
    echo "==========="
    echo "  Total backups: $backup_count"
    echo "  Retention period: $BACKUP_RETENTION_DAYS days"
    echo "  Backup location: $BACKUP_LOCATION"
    
    if [[ -n "$S3_BACKUP_BUCKET" ]]; then
        echo "  S3 bucket: $S3_BACKUP_BUCKET"
    fi
    
    echo ""
    echo "🔧 Available Commands:"
    echo "====================="
    echo "  Full backup:        $0 backup full"
    echo "  Incremental backup: $0 backup incremental"
    echo "  Restore:           $0 restore <backup_path>"
    echo "  Test integrity:    $0 test <backup_path>"
    echo "  Cleanup:           $0 cleanup"
    echo "  Status:            $0 status"
}

# Main command handler
case "${1:-status}" in
    "backup")
        case "${2:-full}" in
            "full")
                create_full_backup
                cleanup_old_backups
                ;;
            "incremental")
                create_incremental_backup
                ;;
            *)
                log_error "Unknown backup type: $2"
                echo "Usage: $0 backup [full|incremental]"
                exit 1
                ;;
        esac
        ;;
    
    "restore")
        if [[ -z "$2" ]]; then
            log_error "Backup path required"
            echo "Usage: $0 restore <backup_path> [full|incremental]"
            exit 1
        fi
        restore_from_backup "$2" "${3:-full}"
        ;;
    
    "test")
        if [[ -z "$2" ]]; then
            log_error "Backup path required"
            echo "Usage: $0 test <backup_path>"
            exit 1
        fi
        test_backup_integrity "$2"
        ;;
    
    "cleanup")
        cleanup_old_backups
        ;;
    
    "status")
        show_backup_status
        ;;
    
    *)
        log_error "Unknown command: $1"
        echo "Usage: $0 [backup|restore|test|cleanup|status]"
        exit 1
        ;;
esac
