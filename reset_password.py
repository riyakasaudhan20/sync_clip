"""
Quick script to generate a bcrypt password hash for resetting user password
"""
from passlib.context import CryptContext

# Same password context as the application
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Simple password to hash
simple_password = "password123"

# Generate hash
hashed = pwd_context.hash(simple_password)

print(f"Password: {simple_password}")
print(f"Bcrypt Hash: {hashed}")
print("\n" + "="*80)
print("SQL Command to update user password:")
print("="*80)
print(f"\nUPDATE users SET password_hash = '{hashed}' WHERE email = 'YOUR_EMAIL_HERE';")
print("\nReplace 'YOUR_EMAIL_HERE' with your actual email address")
print(f"\nAfter running this, you can login with password: {simple_password}")
