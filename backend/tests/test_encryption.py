"""
Tests for encryption utilities
"""
import pytest
from app.lib.encryption import EncryptionService


class TestEncryption:
    """Test encryption and decryption"""
    
    def test_encrypt_decrypt_roundtrip(self):
        """Test that encryption and decryption work correctly"""
        plaintext = "Hello, World!"
        
        # Encrypt
        encrypted, iv = EncryptionService.encrypt(plaintext)
        
        # Decrypt
        decrypted = EncryptionService.decrypt(encrypted, iv)
        
        assert decrypted == plaintext
    
    def test_different_ivs(self):
        """Test that same plaintext produces different ciphertexts"""
        plaintext = "Test message"
        
        encrypted1, iv1 = EncryptionService.encrypt(plaintext)
        encrypted2, iv2 = EncryptionService.encrypt(plaintext)
        
        # Different IVs
        assert iv1 != iv2
        # Different ciphertexts
        assert encrypted1 != encrypted2
    
    def test_hash_consistency(self):
        """Test that hash is consistent"""
        content = "Consistent content"
        
        hash1 = EncryptionService.hash(content)
        hash2 = EncryptionService.hash(content)
        
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 hex length
    
    def test_decrypt_invalid_iv(self):
        """Test decryption with invalid IV fails"""
        plaintext = "Secret message"
        encrypted, _ = EncryptionService.encrypt(plaintext)
        
        with pytest.raises(Exception):
            EncryptionService.decrypt(encrypted, "invalid_iv")
