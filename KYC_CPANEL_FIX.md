# KYC Upload Fix for cPanel

## Problem
KYC file uploads fail on cPanel with permission errors or files not saving.

## Root Causes
1. **File permissions** - `uploads/kyc` directory not writable
2. **Path resolution** - `__dirname` may not resolve correctly in cPanel environment
3. **Multer configuration** - Storage path needs absolute path

## Solutions

### Fix 1: Set Correct Permissions via SSH

```bash
cd ~/keohams.com/backend
mkdir -p uploads/kyc
chmod -R 777 uploads/kyc
chown -R your_cpanel_user:your_cpanel_user uploads/
```

### Fix 2: Verify Upload Directory in Code

The route file `backend/src/routes/enhancedKYC.js` creates the directory:
```javascript
const kycUploadsDir = path.join(__dirname, '../../uploads/kyc');
if (!fs.existsSync(kycUploadsDir)) {
  fs.mkdirSync(kycUploadsDir, { recursive: true });
}
```

This should work, but verify the path resolves correctly:

```bash
cd ~/keohams.com/backend
node -e "console.log(require('path').join(__dirname, 'uploads/kyc'))"
```

### Fix 3: Test File Upload Manually

SSH into server and test:
```bash
cd ~/keohams.com/backend/uploads/kyc
touch test.txt
ls -la
```

If you get "Permission denied", run:
```bash
chmod 777 ~/keohams.com/backend/uploads/kyc
```

### Fix 4: Check Server Logs

```bash
cd ~/keohams.com/backend
tail -f logs/error.log
```

Look for errors like:
- `EACCES: permission denied`
- `ENOENT: no such file or directory`

### Fix 5: Verify Multer Limits

Current limits in `enhancedKYC.js`:
- Max file size: 10MB per file
- Max files: 3

Ensure cPanel PHP settings allow this:
- `upload_max_filesize`: 10M
- `post_max_size`: 10M

## Testing

After fixes, test upload:

1. Log into your app
2. Go to KYC page (`/kyc-enhanced.html`)
3. Upload test documents (Government ID, Selfie, Address Proof)
4. Check browser console for errors
5. Check if files appear in `~/keohams.com/backend/uploads/kyc/`

## Common Errors

### "No files uploaded"
- Check form `enctype="multipart/form-data"`
- Verify field names: `id_document`, `live_photo`, `address_proof`

### "Invalid file type"
- Only JPG, PNG, PDF allowed
- Check MIME type

### "Permission denied"
- Run: `chmod -R 777 ~/keohams.com/backend/uploads`

### "Path not found"
- Verify: `cd ~/keohams.com/backend/uploads/kyc` works
- Create manually if needed: `mkdir -p ~/keohams.com/backend/uploads/kyc`
