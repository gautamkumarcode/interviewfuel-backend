# AWS S3 Setup Guide

## Overview

This guide will help you set up AWS S3 for avatar uploads in the InterviewFuel application.

## Step 1: Create AWS Account

1. Go to [AWS Console](https://aws.amazon.com/)
2. Click "Create an AWS Account"
3. Follow the registration process
4. You'll need a credit card (free tier available)

## Step 2: Create S3 Bucket

1. **Login to AWS Console**
2. **Navigate to S3**:

   - Search for "S3" in the services search bar
   - Click on "S3"

3. **Create Bucket**:

   - Click "Create bucket"
   - **Bucket name**: Choose a unique name (e.g., `interviewfuel-avatars`)
   - **Region**: Select your preferred region (e.g., `us-east-1`)
   - **Block Public Access settings**:
     - ⚠️ **UNCHECK** "Block all public access"
     - Check the acknowledgment box
   - Click "Create bucket"

4. **Configure Bucket Policy**:
   - Click on your bucket name
   - Go to "Permissions" tab
   - Scroll to "Bucket policy"
   - Click "Edit"
   - Paste this policy (replace `YOUR-BUCKET-NAME`):

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "PublicReadGetObject",
			"Effect": "Allow",
			"Principal": "*",
			"Action": "s3:GetObject",
			"Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
		}
	]
}
```

5. **Enable CORS** (for web uploads):
   - In "Permissions" tab, scroll to "Cross-origin resource sharing (CORS)"
   - Click "Edit"
   - Paste this configuration:

```json
[
	{
		"AllowedHeaders": ["*"],
		"AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
		"AllowedOrigins": ["*"],
		"ExposeHeaders": ["ETag"]
	}
]
```

## Step 3: Create IAM User

1. **Navigate to IAM**:

   - Search for "IAM" in services
   - Click "Users" in the left sidebar
   - Click "Create user"

2. **User Details**:

   - **User name**: `interviewfuel-s3-user`
   - Click "Next"

3. **Set Permissions**:

   - Select "Attach policies directly"
   - Search for and select: `AmazonS3FullAccess`
   - Click "Next"
   - Click "Create user"

4. **Create Access Keys**:
   - Click on the user you just created
   - Go to "Security credentials" tab
   - Scroll to "Access keys"
   - Click "Create access key"
   - Select "Application running outside AWS"
   - Click "Next"
   - Add description (optional): "InterviewFuel Backend"
   - Click "Create access key"
   - **⚠️ IMPORTANT**: Copy both:
     - Access key ID
     - Secret access key
   - Store them securely (you won't see the secret again!)

## Step 4: Configure Environment Variables

Update `backend/.env`:

```env
# Change storage provider to S3
STORAGE_PROVIDER=s3

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
AWS_S3_BUCKET_NAME=your_bucket_name_here
```

## Step 5: Test the Integration

1. Restart your backend server
2. Go to `/profile` page
3. Upload an avatar
4. Check your S3 bucket to see the uploaded image in the `avatars` folder

## Features

### Image Processing

- **Resize**: 400x400 pixels
- **Format**: JPEG with 85% quality
- **Smart Crop**: Focuses on interesting areas
- **Optimization**: Compressed for web delivery

### Security

- Public read access for avatars
- Secure upload with IAM credentials
- CORS enabled for web uploads

### Storage Structure

```
your-bucket-name/
└── avatars/
    ├── userId-timestamp1.jpg
    ├── userId-timestamp2.jpg
    └── ...
```

## Cost Estimation

### AWS S3 Free Tier (First 12 months)

- **Storage**: 5 GB
- **Requests**: 20,000 GET, 2,000 PUT
- **Data Transfer**: 15 GB out

### After Free Tier (us-east-1)

- **Storage**: $0.023 per GB/month
- **PUT requests**: $0.005 per 1,000 requests
- **GET requests**: $0.0004 per 1,000 requests

**Example**: 1,000 users with 100KB avatars

- Storage: ~100 MB = $0.002/month
- Very affordable! 💰

## Switching Between Cloudinary and S3

Simply change the `STORAGE_PROVIDER` in `.env`:

```env
# Use Cloudinary
STORAGE_PROVIDER=cloudinary

# OR use S3
STORAGE_PROVIDER=s3
```

No code changes needed! The storage service automatically uses the configured provider.

## Security Best Practices

### 1. IAM User Permissions

Instead of `AmazonS3FullAccess`, create a custom policy:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
			"Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
		}
	]
}
```

### 2. Bucket Versioning

Enable versioning to recover deleted files:

- Go to bucket → Properties → Bucket Versioning → Enable

### 3. Encryption

Enable default encryption:

- Go to bucket → Properties → Default encryption → Enable

### 4. Access Logging

Monitor bucket access:

- Go to bucket → Properties → Server access logging → Enable

### 5. Lifecycle Rules

Auto-delete old avatars:

- Go to bucket → Management → Lifecycle rules
- Create rule to delete files older than X days

## Troubleshooting

### Error: "Access Denied"

- Check IAM user has correct permissions
- Verify bucket policy allows public read
- Ensure access keys are correct in .env

### Error: "Bucket not found"

- Verify bucket name in .env matches actual bucket
- Check region is correct

### Images not loading

- Check bucket policy allows public read
- Verify CORS configuration
- Test URL directly in browser

### Upload fails

- Check file size (max 5MB)
- Verify IAM credentials
- Check network connectivity

## Monitoring

### CloudWatch Metrics

- Go to S3 → Your bucket → Metrics
- Monitor:
  - Storage size
  - Number of objects
  - Request metrics

### Cost Explorer

- Go to AWS Cost Explorer
- Filter by S3 service
- Monitor monthly costs

## Production Recommendations

1. **Use CloudFront CDN**:

   - Faster global delivery
   - Reduced S3 costs
   - Better performance

2. **Enable Transfer Acceleration**:

   - Faster uploads from distant locations
   - Additional cost but better UX

3. **Set up Backup**:

   - Enable Cross-Region Replication
   - Backup to another bucket

4. **Implement Image Optimization**:
   - Use Lambda@Edge for on-the-fly resizing
   - Serve WebP to supported browsers

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [S3 Pricing Calculator](https://calculator.aws/)
- [AWS Free Tier](https://aws.amazon.com/free/)

## Support

- [AWS Support Center](https://console.aws.amazon.com/support/)
- [AWS Forums](https://forums.aws.amazon.com/)
- [Stack Overflow - AWS S3](https://stackoverflow.com/questions/tagged/amazon-s3)
