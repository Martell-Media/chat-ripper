#!/bin/bash

set -e

if [ -z "$1" ]; then
    echo "Showing logs for all services..."
    docker compose --env-file ../app/.env logs -f
else
    echo "Showing logs for service: $1"
    docker compose --env-file ../app/.env logs -f "$1"
fi
