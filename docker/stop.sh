#!/bin/bash

set -e

echo "Stopping services..."
docker compose --env-file ../app/.env down

echo "Services stopped successfully!"
