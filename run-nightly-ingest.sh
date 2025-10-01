#!/bin/bash
# Nightly voyage ingest script
# Runs at 3 AM daily via cron

LOG_DIR=/home/ec2-user/sequoia-project/logs
LOG_FILE=${LOG_DIR}/nightly-ingest-$(date +%Y-%m-%d).log

# Create logs directory if it doesn't exist
mkdir -p ${LOG_DIR}

# Log start time
echo "===== Nightly Ingest Started at $(date) =====" >> ${LOG_FILE}

# Change to backend directory
cd /home/ec2-user/sequoia-project/backend

# Clear Python cache to ensure fresh code
find . -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
find . -type f -name '*.pyc' -delete 2>/dev/null || true

# Run ingest script
PYTHONDONTWRITEBYTECODE=1 python3 -m voyage_ingest.main --source json --file canonical_voyages.json >> ${LOG_FILE} 2>&1

# Log completion
EXIT_CODE=$?
echo "===== Nightly Ingest Completed at $(date) with exit code ${EXIT_CODE} =====" >> ${LOG_FILE}

# Keep only last 7 days of logs
find ${LOG_DIR} -name 'nightly-ingest-*.log' -mtime +7 -delete

exit ${EXIT_CODE}
