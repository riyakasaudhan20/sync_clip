# Google OAuth Setup Guide

## Prerequisites
- A Google account
- Access to Google Cloud Console

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **NEW PROJECT**
3. Enter project name (e.g., "Clipboard Sync")
4. Click **CREATE**

## Step 2: Enable Google+ API

1. In the Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google+ API"
3. Click on it and click **ENABLE**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** user type → Click **CREATE**
3. Fill in the required fields:
   - **App name**: Clipboard Sync
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click **SAVE AND CONTINUE**
5. Skip the sc Scopes step → Click **SAVE AND CONTINUE**
6. Skip Test users (for now) → Click **SAVE AND CONTINUE**
7. Review and click **BACK TO DASHBOARD**

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **CREATE CREDENTIALS** → **OAuth client ID**
3. Choose application type: **Web application**
4. Enter name (e.g., "Clipboard Sync Web Client")
5. Add **Authorized redirect URIs**:
   - For development: `http://localhost:3000/oauth-callback`
   - For production: `https://yourdomain.com/oauth-callback`
6. Click **CREATE**
7. Copy the **Client ID** and **Client Secret**

## Step 5: Configure Environment Variables

### Backend (.env)

Add to `d:\Attempts\sync-clip\backend\.env`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth-callback
```

### Docker Environment

If using Docker, also add to `docker-compose.yml` environment section:

```yaml
services:
  backend:
    environment:
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
```

##  Step 6: Run Database Migration

Navigate to the backend directory and run:

```bash
cd d:\Attempts\sync-clip\backend
python migrate_oauth_images.py
```

## Step 7: Restart Services

### If using Docker:
```bash
docker-compose restart backend
```

### If running locally:
Restart your backend server

## Step 8: Test the Integration

1. Start the web client (`npm run dev`)
2. Go to `http://localhost:3000/login`
3. Click "Continue with Google"
4. You should be redirected to Google's consent screen
5. After authorizing, you'll be redirected back to the dashboard

## Troubleshooting

### "redirect_uri_mismatch" Error
- Make sure the redirect URI in Google Cloud Console exactly matches `GOOGLE_REDIRECT_URI`
- Check for trailing slashes, http vs https

### "OAuth is not configured" Error
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env`
- Restart the backend after adding environment variables

### Database Migration Fails
- Ensure PostgreSQL is running
- Check database connection in `.env`
- Verify `DATABASE_URL` is correct

##  Production Deployment

For production:

1. Update redirect URI to your production domain
2. Add production redirect URI to Google Cloud Console
3. Update `GOOGLE_REDIRECT_URI` in production environment
4. Enable HTTPS (required by Google OAuth)
5. Remove test users restriction in OAuth consent screen

## Security Notes

- **Never commit** `.env` file with actual credentials
- Use environment variables in production (not hardcoded)
- Keep `GOOGLE_CLIENT_SECRET` secure
- Regularly rotate credentials if compromised
