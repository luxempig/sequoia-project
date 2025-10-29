# Backend Utility Scripts

This directory contains maintenance, debugging, and one-off utility scripts for the USS Sequoia backend.

## 📋 Script Categories

### Database Maintenance

#### `clear_database.py`
**Purpose:** Delete all data from the database while preserving the schema structure.

**Usage:**
```bash
python clear_database.py
```

**⚠️ Warning:** This is destructive and will delete all voyages, passengers, media, and presidents. Use only for development/testing.

#### `deduplicate_passengers.py`
**Purpose:** Merge duplicate person records in the database. Identifies duplicates by similar names and consolidates their voyage participation.

**Usage:**
```bash
python deduplicate_passengers.py
```

**Use Case:** Run after bulk imports or data migrations that may have created duplicate passenger entries.

---

### Data Fixes (One-off Scripts)

These scripts were created to fix specific data issues. They contain hardcoded identifiers and are kept for reference/documentation.

#### `delete_phantom_records.py`
**Purpose:** Delete specific phantom media records (database entries without corresponding S3 files).

**Hardcoded Records:**
- `1933-04-01-to-1933-04-30-e3e991e3`
- `1933-04-01-to-1933-04-30-6dfa14cb`

**Usage:**
```bash
python delete_phantom_records.py
```

**Note:** This is a completed one-off fix. The hardcoded slugs were removed on October 28, 2024.

#### `fix_broken_media.py`
**Purpose:** Fix specific media record where `media_type` didn't match S3 file location.

**Hardcoded Record:**
- `1933-04-22-the-piqua-daily-call-ee9ad66a` (media_type='article' but files in image/ folder)

**Usage:**
```bash
python fix_broken_media.py
```

**Note:** This is a completed one-off fix from October 28, 2024.

---

### S3 Maintenance

#### `clear_s3_media.py`
**Purpose:** Delete all media files from S3 buckets (public and canonical).

**Usage:**
```bash
python clear_s3_media.py
```

**⚠️ Warning:** This is destructive and will delete all media files from S3. Requires AWS credentials in `.env`.

#### `fix_s3_content_disposition.py`
**Purpose:** Update Content-Disposition headers for all S3 objects to enable inline viewing in browsers.

**Usage:**
```bash
python fix_s3_content_disposition.py
```

**Use Case:** Run after bulk S3 uploads to ensure proper browser display behavior.

#### `regenerate_missing_thumbnails.py`
**Purpose:** Check for missing PDF thumbnails in S3 and regenerate them.

**Usage:**
```bash
python regenerate_missing_thumbnails.py
```

**Use Case:** Run after PDF uploads or if thumbnail generation failed.

#### `reorganize_s3_bucket.py`
**Purpose:** Migrate S3 files from old structure to new organized structure by media type.

**Usage:**
```bash
python reorganize_s3_bucket.py
```

**⚠️ Note:** This script contains hardcoded EC2 paths and may need adjustment for local use.

**Use Case:** One-time migration script used on October 15, 2024.

---

### Debugging & Exploration

#### `debug_voyage_media.py`
**Purpose:** Debug media issues for specific voyages. Shows detailed media information, S3 status, and database records.

**Usage:**
```bash
python debug_voyage_media.py voyage-slug-here
```

**Example:**
```bash
python debug_voyage_media.py roosevelt-franklin-1938-01
```

**Output:** Detailed report of media files, S3 existence, database records, and potential issues.

#### `find_passenger_example.py`
**Purpose:** Find example passengers with multiple voyage participations for testing/debugging.

**Usage:**
```bash
python find_passenger_example.py
```

**Output:** List of passengers who appear on multiple voyages, useful for testing passenger detail pages.

---

### Site Generation

#### `generate_sitemap.py`
**Purpose:** Generate `sitemap.xml` for search engine optimization (SEO).

**Usage:**
```bash
python generate_sitemap.py > sitemap.xml
```

**⚠️ Production Use:** This script is called automatically by `deploy-unified.sh` during deployment. Do not move or rename without updating the deployment script.

**Output:** XML sitemap with all voyages, people, and static pages for Google/Bing indexing.

---

## 🔧 Common Requirements

All scripts require:

1. **Environment Variables** - Create a `.env` file in the `backend/` directory with:
   ```bash
   DB_HOST=your-database-host
   DB_PORT=5432
   DB_NAME=sequoia_db
   DB_USER=sequoia
   DB_PASSWORD=your-password
   DB_SCHEMA=sequoia

   # For S3 scripts
   AWS_REGION=us-east-2
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   PUBLIC_BUCKET=sequoia-public
   PRIVATE_BUCKET=sequoia-canonical
   ```

2. **Python Dependencies** - Install via:
   ```bash
   pip install -r ../requirements.txt
   ```

3. **Database Access** - Most scripts require connection to the production PostgreSQL database.

---

## ⚠️ Safety Warnings

### Destructive Scripts (Use with Caution!)
- `clear_database.py` - Deletes all data
- `clear_s3_media.py` - Deletes all S3 files
- `delete_phantom_records.py` - Deletes specific media records

### Production Scripts (Used in Deployment)
- `generate_sitemap.py` - Called by `deploy-unified.sh`

### One-off Scripts (Completed Tasks)
- `delete_phantom_records.py` - Completed Oct 28, 2024
- `fix_broken_media.py` - Completed Oct 28, 2024
- `reorganize_s3_bucket.py` - Completed Oct 15, 2024

---

## 📝 Best Practices

1. **Always test on a development database first** before running on production
2. **Backup data** before running destructive scripts
3. **Check hardcoded values** in one-off scripts before running
4. **Review script output** before confirming destructive actions
5. **Update this README** when adding new scripts

---

## 🗂️ Script Organization

- **Maintenance scripts** - Safe to run multiple times (idempotent)
- **One-off scripts** - Created for specific data issues (kept for reference)
- **Debugging scripts** - No side effects, read-only operations
- **Production scripts** - Automated via deployment pipeline

---

Last updated: October 29, 2024
