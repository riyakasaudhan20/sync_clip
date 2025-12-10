"""
Database migration script for OAuth and Image support
Run this script to add new columns to existing database
"""
from sqlalchemy import create_engine, text
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_migration():
    """Execute database migration"""
    engine = create_engine(settings.DATABASE_URL)
    
    migrations = [
        # Add OAuth columns to users table
        """
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
        ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email';
        """,
        
        # Make password_hash nullable for OAuth users
        """
        ALTER TABLE users 
        ALTER COLUMN password_hash DROP NOT NULL;
        """,
        
        # Create index on google_id
        """
        CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
        """,
        
        # Add image metadata columns to clipboard_items table
        """
        ALTER TABLE clipboard_items
        ADD COLUMN IF NOT EXISTS image_format VARCHAR(20),
        ADD COLUMN IF NOT EXISTS image_width INTEGER,
        ADD COLUMN IF NOT EXISTS image_height INTEGER;
        """
    ]
    
    try:
        with engine.connect() as conn:
            for i, migration in enumerate(migrations, 1):
                logger.info(f"Running migration {i}/{len(migrations)}...")
                conn.execute(text(migration))
                conn.commit()
                logger.info(f"Migration {i} completed successfully")
        
        logger.info("All migrations completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    logger.info("Starting database migration...")
    run_migration()
    logger.info("Migration complete!")
