# Cloudinary Setup Guide

## Overview
This guide will help you set up Cloudinary for avatar uploads in the InterviewFuel application.

## Step 1: Create a Cloudinary Account

1. Go to [Cloudinary](https://cloudinary.com/)
2. Click "Sign Up for Free"
3. Create your account (you can use GitHub, Google, or email)
4. Verify your email address

## Step 2: Get Your Credentials

1. After logging in, you'll be on the Dashboard
2. You'll see your **Account Details** section with:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

3. Copy these values

## Step 3: Configure Environment Variables

1. Open `backend/.env` file
2. Replace the placeholder values with your actual Cloudinary credentials:

```env
CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
CLOUDINARY_API_KEY=your_actual_api_key
CLOUDINARY_API_SECRET=your_actual_api_secret
```

## Step 4: Test the Integration

1. Start your backend server:
```bash
cd backend
npm run dev
```

2. Try uploading an avatar through the profile page
3. Check your Cloudinary dashboard to see the uploaded image in the `avatars` folder

## Features Implemented

### Avatar Upload
- **Endpoint**: `POST /auth/avatar`
- **Folder**: Images are stored in `avatars` folder
- **Transformations**:
  - Resized to 400x400 pixels
  - Cropped to fill with face detection
  - Auto quality optimization
  - Auto format selection (WebP when supported)

### Avatar Delete
- **Endpoint**: `DELETE /auth/avatar`
- Removes image from Cloudinary
- Updates user record to null

### File Validation
- **Allowed formats**: JPEG, JPG, PNG, GIF, WebP
- **Max file size**: 5MB
- **Storage**: Memory storage (no local files)

## Cloudinary Dashboard

### Viewing Uploaded Images
1. Go to [Cloudinary Console](https://console.cloudinary.com/)
2. Click on "Media Library"
3. Navigate to the `avatars` folder
4. You'll see all uploaded profile pictures

### Managing Storage
- Free tier includes:
  - 25 GB storage
  - 25 GB bandwidth per month
  - 25,000 transformations per month

### Optimization Settings
The upload is configured with:
- Face detection for smart cropping
- Automatic quality optimization
- Automatic format selection (serves WebP to supported browsers)
- Responsive image delivery

## Troubleshooting

### Error: "Invalid credentials"
- Double-check your Cloud Name, API Key, and API Secret
- Make sure there are no extra spaces in the .env file
- Restart your backend server after updating .env

### Error: "File too large"
- Maximum file size is 5MB
- Compress the image before uploading
- Or increase the limit in `backend/middleware/upload.js`

### Error: "Only image files are allowed"
- Make sure you're uploading an image file (JPEG, PNG, GIF, WebP)
- Check the file extension

### Images not showing
- Check if the Cloudinary URL is being saved to the database
- Verify the URL is accessible in a browser
- Check browser console for CORS errors

## Security Best Practices

1. **Never commit .env file**
   - Already in .gitignore
   - Use environment variables in production

2. **Restrict API access**
   - In Cloudinary dashboard, go to Settings > Security
   - Enable "Restrict media access"
   - Set allowed domains

3. **Enable signed uploads** (optional)
   - For additional security
   - Requires backend signature generation

4. **Set upload presets**
   - Create upload presets in Cloudinary dashboard
   - Restrict transformations and formats

## Production Deployment

### Vercel/Netlify
Add environment variables in your deployment platform:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Docker
Add to your docker-compose.yml:
```yaml
environment:
  - CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
  - CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
  - CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
```

## Additional Resources

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Node.js SDK Guide](https://cloudinary.com/documentation/node_integration)
- [Image Transformations](https://cloudinary.com/documentation/image_transformations)
- [Upload API Reference](https://cloudinary.com/documentation/image_upload_api_reference)

## Support

If you encounter any issues:
1. Check the [Cloudinary Status Page](https://status.cloudinary.com/)
2. Review the [Cloudinary Community Forum](https://community.cloudinary.com/)
3. Contact Cloudinary Support (available on paid plans)
