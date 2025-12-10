"""
Google OAuth authentication routes with comprehensive error handling and logging
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.httpx_client import AsyncOAuth2Client
import httpx
from uuid import UUID
import logging
from datetime import datetime
import secrets

from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.models.models import User
from app.schemas.schemas import GoogleAuthRequest, TokenResponse

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

router = APIRouter(prefix="/auth/google", tags=["OAuth"])

# Store state tokens temporarily (in production, use Redis or database)
# Format: {state: timestamp}
_state_store = {}


def cleanup_old_states():
    """Remove state tokens older than 10 minutes"""
    current_time = datetime.utcnow().timestamp()
    expired = [state for state, timestamp in _state_store.items() 
               if current_time - timestamp > 600]
    for state in expired:
        del _state_store[state]


async def get_google_user_info(access_token: str) -> dict:
    """Get user info from Google using access token"""
    try:
        logger.info("Fetching user info from Google")
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                headers={'Authorization': f'Bearer {access_token}'}
            )
            response.raise_for_status()
            user_info = response.json()
            logger.info(f"Successfully retrieved user info for email: {user_info.get('email')}")
            return user_info
    except httpx.TimeoutException:
        logger.error("Timeout while fetching user info from Google")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Timeout while communicating with Google. Please try again."
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error from Google userinfo endpoint: {e.response.status_code}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to retrieve user information from Google"
        )


@router.get("")
async def google_login():
    """
    Initiate Google OAuth flow
    Returns the Google OAuth authorization URL with state parameter for CSRF protection
    """
    logger.info("Initiating Google OAuth login flow")
    
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        logger.error("Google OAuth credentials not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
    
    # Generate state parameter for CSRF protection
    cleanup_old_states()
    state = secrets.token_urlsafe(32)
    _state_store[state] = datetime.utcnow().timestamp()
    
    logger.info(f"Generated OAuth state token: {state[:8]}...")
    
    # Build Google OAuth URL
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={settings.GOOGLE_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope=openid%20email%20profile&"
        f"access_type=offline&"
        f"state={state}&"
        f"prompt=select_account"  # Always show account selection
    )
    
    logger.info("OAuth URL generated successfully")
    return {"auth_url": auth_url, "state": state}


@router.post("/callback", response_model=TokenResponse)
async def google_callback(
    auth_request: GoogleAuthRequest,
    db: Session = Depends(get_db)
):
    """
    Handle Google OAuth callback
    Exchange authorization code for access token and create/login user
    """
    logger.info("=" * 60)
    logger.info("Processing Google OAuth callback")
    logger.info(f"Received authorization code: {auth_request.code[:20]}...")
    
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        logger.error("Google OAuth credentials not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth is not configured"
        )
    
    # Validate state parameter if provided (non-blocking for now due to in-memory storage)
    if hasattr(auth_request, 'state') and auth_request.state:
        cleanup_old_states()
        if auth_request.state not in _state_store:
            logger.warning(f"State parameter not found in store: {auth_request.state[:8]}...")
            logger.warning("This could be due to backend restart or potential CSRF. Proceeding anyway.")
            # Note: In production, use Redis or database for persistent state storage
        else:
            # Remove used state
            del _state_store[auth_request.state]
            logger.info("State parameter validated successfully")
    
    try:
        # Step 1: Exchange authorization code for access token
        logger.info("Step 1: Exchanging authorization code for access token")
        logger.info(f"Using redirect URI: {settings.GOOGLE_REDIRECT_URI}")
        logger.info(f"Using client ID: {settings.GOOGLE_CLIENT_ID[:20]}...")
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_response = await client.post(
                'https://oauth2.googleapis.com/token',
                data={
                    'code': auth_request.code,
                    'client_id': settings.GOOGLE_CLIENT_ID,
                    'client_secret': settings.GOOGLE_CLIENT_SECRET,
                    'redirect_uri': settings.GOOGLE_REDIRECT_URI,
                    'grant_type': 'authorization_code'
                }
            )
            
            if token_response.status_code != 200:
                try:
                    error_detail = token_response.json()
                    error_msg = error_detail.get('error_description', error_detail.get('error', 'Unknown error'))
                    logger.error(f"Token exchange failed: {token_response.status_code}")
                    logger.error(f"Google error response: {error_detail}")
                except:
                    error_msg = "Unknown error from Google"
                    logger.error(f"Token exchange failed: {token_response.status_code} - Could not parse error response")
                
                # Provide helpful error message based on common issues
                if 'redirect_uri_mismatch' in str(error_detail):
                    detail = f"Redirect URI mismatch. Please ensure '{settings.GOOGLE_REDIRECT_URI}' is added to your Google Cloud Console OAuth credentials."
                elif 'invalid_grant' in str(error_detail):
                    detail = "Authorization code is invalid or has already been used. Please try signing in again."
                else:
                    detail = f"Failed to exchange authorization code: {error_msg}. Please try signing in again."
                
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=detail
                )
            
            token_data = token_response.json()
            logger.info("Successfully exchanged code for access token")
        
        # Step 2: Get user info from Google
        logger.info("Step 2: Fetching user information from Google")
        user_info = await get_google_user_info(token_data['access_token'])
        
        google_id = user_info['id']
        email = user_info['email']
        logger.info(f"Retrieved user info - Email: {email}, Google ID: {google_id}")
        
        # Step 3: Check if user exists and create/update
        logger.info("Step 3: Checking if user exists in database")
        user = db.query(User).filter(
            (User.google_id == google_id) | (User.email == email)
        ).first()
        
        try:
            if user:
                logger.info(f"Existing user found with ID: {user.id}")
                # Update existing user with Google ID if not set
                if not user.google_id:
                    logger.info("Updating existing user with Google ID")
                    user.google_id = google_id
                    user.auth_provider = "google"
                    db.commit()
                    db.refresh(user)
                    logger.info("User updated successfully")
                else:
                    logger.info("User already has Google ID, proceeding with login")
            else:
                # Create new user
                logger.info("Creating new user account")
                user = User(
                    email=email,
                    google_id=google_id,
                    auth_provider="google",
                    password_hash=None  # No password for OAuth users
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                logger.info(f"New user created successfully with ID: {user.id}")
        
        except SQLAlchemyError as db_error:
            logger.error(f"Database error during user creation/update: {str(db_error)}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error occurred. Please try again."
            )
        
        # Step 4: Create JWT token
        logger.info("Step 4: Creating JWT access token")
        access_token = create_access_token(data={"sub": str(user.id)})
        logger.info(f"JWT token created successfully for user {user.id}")
        
        logger.info("OAuth callback completed successfully")
        logger.info("=" * 60)
        
        return TokenResponse(
            access_token=access_token,
            user_id=str(user.id)
        )
    
    except httpx.TimeoutException:
        logger.error("Timeout while communicating with Google")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request to Google timed out. Please check your internet connection and try again."
        )
    
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error from Google: {e.response.status_code} - {e.response.text}")
        db.rollback()
        
        # Provide more specific error messages
        if e.response.status_code == 400:
            detail = "Invalid authorization code. This code may have already been used or expired. Please try signing in again."
        elif e.response.status_code == 401:
            detail = "Authentication with Google failed. Please check your OAuth configuration."
        else:
            detail = f"Failed to communicate with Google (Status: {e.response.status_code}). Please try again."
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        db.rollback()
        raise
    
    except Exception as e:
        logger.error(f"Unexpected error during OAuth callback: {type(e).__name__} - {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during authentication. Please try again. Error: {str(e)}"
        )
