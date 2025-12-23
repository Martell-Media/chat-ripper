# Minimal API Boilerplate

A minimal FastAPI application with PostgreSQL database, designed as a cookie-cutter template for quick prototyping.

## Features

- FastAPI with automatic OpenAPI docs
- PostgreSQL 17 database
- SQLAlchemy ORM with automatic table creation
- Docker Compose orchestration
- Simple message API endpoints
- Health checks and automatic restart policies

## Quick Start

```bash
cd docker
./start.sh
```

The API will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Database: localhost:5432

## API Endpoints

### Root
```bash
curl http://localhost:8000/
```

### Create Message
```bash
curl -X POST http://localhost:8000/messages \
  -H 'Content-Type: application/json' \
  -d '{"content": "Hello world"}'
```

Response:
```json
{
  "id": 1,
  "content": "Hello world",
  "created_at": "2025-12-17T10:25:37.207147Z"
}
```

### Get Message by ID
```bash
curl http://localhost:8000/messages/1
```

Returns 404 if message doesn't exist.

## Management Commands

### Start Services
```bash
./start.sh
```
Creates network if needed and starts all services in detached mode.

### Stop Services
```bash
./stop.sh
```
Gracefully stops all services.

### View Logs
```bash
# All services
./logs.sh

# Specific service
./logs.sh api
./logs.sh db
```

## Project Structure

```
agentic-coding-blueprint/
├── app/
│   ├── .env                     # Environment variables (gitignored)
│   ├── .env.example             # Environment template
│   ├── api/
│   │   └── messages.py          # API endpoints
│   ├── database/
│   │   ├── session.py           # Database session
│   │   └── models.py            # SQLAlchemy models
│   ├── schemas/
│   │   └── message.py           # Pydantic schemas
│   ├── config.py                # Settings
│   └── main.py                  # FastAPI app
├── docker/
│   ├── Dockerfile               # API container
│   ├── docker-compose.yml       # Services definition
│   ├── start.sh                 # Start script
│   ├── stop.sh                  # Stop script
│   └── logs.sh                  # Logs script
├── playground/
│   └── example_db_connection.py # Example playground script
└── pyproject.toml               # Dependencies
```

## Configuration

Environment variables are in `app/.env`:

```env
PROJECT_NAME=agentic-coding-blueprint

# Database connection
# Use "db" for Docker Compose (service name)
# Use "localhost" for local development (playground scripts)
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

**For local development** (running playground scripts outside Docker):

- Change `POSTGRES_HOST=db` to `POSTGRES_HOST=localhost` in `app/.env`
- This allows connecting to the database running in Docker from your host machine

## Database

- PostgreSQL 17
- Tables created automatically on startup via SQLAlchemy
- No migrations needed for this minimal setup
- Data persisted in Docker volume `docker_postgres_data`

## Development

The setup is intentionally minimal:
- No authentication
- No migrations (tables auto-created)
- No caching layer
- Basic error handling only
- Single database table

This is a foundation to build upon - add features incrementally as needed.

## Cleanup

To stop and remove all containers, networks, and volumes:

```bash
cd docker
docker compose down -v
```

This will delete all data in the database.
