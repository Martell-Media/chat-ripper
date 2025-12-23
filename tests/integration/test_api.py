"""Integration tests for the API (requires Docker running)."""
import httpx

API_URL = "http://localhost:8000"


def test_health():
    response = httpx.get(f"{API_URL}/")
    assert response.status_code == 200


def test_create_message():
    response = httpx.post(f"{API_URL}/messages", json={"content": "Test message"})
    assert response.status_code == 201
    assert response.json()["content"] == "Test message"
    assert "id" in response.json()


def test_get_message():
    create = httpx.post(f"{API_URL}/messages", json={"content": "Fetch me"})
    message_id = create.json()["id"]
    
    response = httpx.get(f"{API_URL}/messages/{message_id}")
    assert response.status_code == 200
    assert response.json()["content"] == "Fetch me"


def test_get_message_not_found():
    response = httpx.get(f"{API_URL}/messages/99999")
    assert response.status_code == 404
