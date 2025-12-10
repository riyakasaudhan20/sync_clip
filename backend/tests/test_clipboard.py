"""
Integration tests for clipboard operations
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestClipboard:
    """Test clipboard operations"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        # Register and login
        client.post(
            "/api/v1/auth/register",
            json={"email": "clip@example.com", "password": "ClipPass123"}
        )
        
        # Register device
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "clip@example.com", "password": "ClipPass123"}
        )
        token = login_resp.json()["access_token"]
        
        device_resp = client.post(
            "/api/v1/device/register",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "device_name": "Test Device",
                "device_type": "web",
                "device_info": {"user_agent": "test"}
            }
        )
        device_token = device_resp.json()["access_token"]
        
        return {"Authorization": f"Bearer {device_token}"}
    
    def test_create_clipboard_item(self, auth_headers):
        """Test creating a clipboard item"""
        response = client.post(
            "/api/v1/clipboard/update",
            headers=auth_headers,
            json={
                "encrypted_content": "base64encodedcontent",
                "iv": "base64iv",
                "content_hash": "a" * 64,
                "content_type": "text",
                "content_size": 1024
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["encrypted_content"] == "base64encodedcontent"
    
    def test_get_latest_clipboard(self, auth_headers):
        """Test getting latest clipboard item"""
        # Create an item first
        client.post(
            "/api/v1/clipboard/update",
            headers=auth_headers,
            json={
                "encrypted_content": "latest_content",
                "iv": "test_iv",
                "content_hash": "b" * 64,
                "content_type": "text",
                "content_size": 512
            }
        )
        
        response = client.get(
            "/api/v1/clipboard/latest",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["encrypted_content"] == "latest_content"
    
    def test_get_clipboard_history(self, auth_headers):
        """Test getting clipboard history"""
        response = client.get(
            "/api/v1/clipboard/history",
            headers=auth_headers,
            params={"page": 1, "page_size": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
    
    def test_delete_clipboard_item(self, auth_headers):
        """Test deleting a clipboard item"""
        # Create an item
        create_resp = client.post(
            "/api/v1/clipboard/update",
            headers=auth_headers,
            json={
                "encrypted_content": "to_delete",
                "iv": "delete_iv",
                "content_hash": "c" * 64,
                "content_type": "text",
                "content_size": 256
            }
        )
        item_id = create_resp.json()["id"]
        
        # Delete it
        response = client.delete(
            f"/api/v1/clipboard/{item_id}",
            headers=auth_headers
        )
        assert response.status_code == 204
    
    def test_clear_clipboard_history(self, auth_headers):
        """Test clearing all clipboard history"""
        response = client.delete(
            "/api/v1/clipboard/clear",
            headers=auth_headers
        )
        assert response.status_code == 204
        
        # Verify history is empty
        history = client.get(
            "/api/v1/clipboard/history",
            headers=auth_headers
        )
        assert history.json()["total"] == 0
