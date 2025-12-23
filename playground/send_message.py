"""Send a message to the API."""
import requests

API_URL = "http://localhost:8000"

response = requests.post(f"{API_URL}/messages", json={"content": "Hello from playground!"})
print(f"POST /messages: {response.status_code}")
print(response.json())

message_id = response.json()["id"]
response = requests.get(f"{API_URL}/messages/{message_id}")
print(f"\nGET /messages/{message_id}: {response.status_code}")
print(response.json())
