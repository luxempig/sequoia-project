# AWS S3 Integration Setup

This document contains instructions for setting up S3 permissions for the Sequoia project.

## Problem
The `sequoia-ingest-bot` IAM user needs permission to access S3 buckets for the media file browser functionality.

**Current Error:**
```
User: arn:aws:iam::987708559122:user/sequoia-ingest-bot is not authorized to perform: s3:ListBucket on resource: "arn:aws:s3:::sequoia-canonical"
```

## Solution

### Step 1: Access AWS IAM Console
1. Log into AWS Management Console
2. Navigate to IAM → Users
3. Find and click on `sequoia-ingest-bot`

### Step 2: Apply S3 Policy
1. Click "Add permissions" → "Attach policies directly"
2. Click "Create policy"
3. Click the "JSON" tab
4. Copy and paste the contents of `aws-iam-s3-policy.json`
5. Name the policy: `SequoiaS3ReadAccess`
6. Description: `Allows read access to Sequoia S3 buckets for media file browsing`
7. Click "Create policy"
8. Attach the new policy to the `sequoia-ingest-bot` user

### Step 3: Verify
- Wait 1-2 minutes for AWS permissions to propagate
- Test the Media tab in the application
- Check backend logs for S3 errors (should be resolved)

## Policy Details

The policy grants the following permissions:

### Buckets Covered:
- `sequoia-canonical` - Main media archive
- `uss-sequoia-bucket` - Additional media bucket  
- `sequoia-public` - Public assets

### Permissions Granted:
- `s3:ListBucket` - Browse folder structure
- `s3:GetObject` - Download/view files
- `s3:GetBucketLocation` - Get bucket region info

## Testing

After applying the policy:

1. **Frontend Test**: Visit http://localhost:3000 → Media tab
2. **Backend Test**: `curl http://localhost:8000/api/curator/s3-structure`
3. **Logs Test**: Check backend logs for S3 errors

Expected result: Real S3 file structure instead of fallback data.

## Files in this Directory
- `aws-iam-s3-policy.json` - The IAM policy JSON
- `AWS_S3_SETUP.md` - This instruction file

## Security Notes
- Policy follows principle of least privilege (read-only access)
- Only grants access to specific Sequoia buckets
- No write permissions granted