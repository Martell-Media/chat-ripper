#!/bin/bash

set -e

echo "Starting services..."
docker compose --env-file ../app/.env up --build -d

echo ""
echo "Services started successfully!"
echo "API available at: http://localhost:8000"
echo "API docs available at: http://localhost:8000/docs"
