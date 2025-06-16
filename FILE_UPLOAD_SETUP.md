# File Upload Setup Guide

This chat interface now supports file uploading using UploadThing. Follow these steps to set up file upload functionality:

## 1. UploadThing Setup

1. Go to [UploadThing Dashboard](https://uploadthing.com/dashboard)
2. Create a new account or sign in
3. Create a new app
4. Get your API keys from the dashboard

## 2. Environment Configuration

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your UploadThing credentials to `.env.local`:
   ```env
   UPLOADTHING_SECRET=your_uploadthing_secret_here
   UPLOADTHING_APP_ID=your_uploadthing_app_id_here
   ```

## 3. Supported File Types

### Images
- **Formats**: PNG, JPG, JPEG, GIF, WebP
- **Max Size**: 4MB per file
- **Max Count**: 4 files per upload

### Documents
- **Formats**: PDF, TXT, DOC, DOCX
- **Max Size**: 16MB per file
- **Max Count**: 1 file per upload

## 4. How to Use

1. **Upload Files**: Click the "Attach" button in the message input area
2. **Drag & Drop**: Drag files directly into the upload dialog
3. **Preview**: See uploaded files before sending
4. **Remove**: Click the X button to remove files before sending
5. **Send**: Files are included with your message when you send it

## 5. Features

- **Drag and Drop**: Intuitive file uploading
- **File Preview**: See what files you're about to send
- **Progress Indication**: Visual feedback during upload
- **Error Handling**: Clear error messages for failed uploads
- **File Type Validation**: Only supported file types are accepted
- **Size Limits**: Automatic enforcement of file size limits
- **Clickable Links**: Uploaded files become clickable links in chat history

## 6. Technical Details

- Files are uploaded to UploadThing's CDN
- File URLs are stored in the chat database
- Attachments are preserved in chat history
- Files are accessible via direct links

## 7. Troubleshooting

### Upload Fails
- Check your UploadThing API keys
- Verify file size and type restrictions
- Check network connection

### Files Not Displaying
- Ensure UploadThing service is accessible
- Check browser console for errors
- Verify file URLs are valid

### Environment Issues
- Make sure `.env.local` exists and has correct values
- Restart the development server after changing environment variables
- Check that environment variables are properly loaded

## 8. Security Notes

- Files are uploaded to UploadThing's secure CDN
- File URLs are publicly accessible (don't upload sensitive content)
- UploadThing handles file scanning and security
- Consider implementing additional access controls for production use