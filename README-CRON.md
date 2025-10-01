# Automated Nightly Ingest

The EC2 instance is configured to automatically run the voyage ingest script every night at 3 AM EST.

## Setup

The cron job is configured as:
```bash
0 3 * * * /home/ec2-user/sequoia-project/run-nightly-ingest.sh
```

## Script Location

- **Script**: `/home/ec2-user/sequoia-project/run-nightly-ingest.sh`
- **Logs**: `/home/ec2-user/sequoia-project/logs/nightly-ingest-YYYY-MM-DD.log`

## What It Does

1. Clears Python bytecode cache for fresh code execution
2. Runs the voyage ingest script on `canonical_voyages.json`
3. Logs all output to dated log files
4. Automatically cleans up logs older than 7 days

## Managing the Cron Job

### View current crontab:
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211 "crontab -l"
```

### Edit crontab:
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211 "crontab -e"
```

### View recent logs:
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211 "ls -lth ~/sequoia-project/logs/"
ssh -i sequoia-key.pem ec2-user@3.14.31.211 "tail -50 ~/sequoia-project/logs/nightly-ingest-*.log"
```

### Run manually (test):
```bash
ssh -i sequoia-key.pem ec2-user@3.14.31.211 "~/sequoia-project/run-nightly-ingest.sh"
```

## Workflow

1. **During the day**: Edit `canonical_voyages.json` in the curator tab and save (instant, no ingest)
2. **At 3 AM**: Cron automatically runs ingest, updating the database with all changes
3. **Next morning**: All changes are live on the public website

This allows fast iterative editing without waiting 4+ minutes per save.
