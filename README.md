# Python AI Backend Boilerplate

A proven project structure for AI-powered Python backend applications.

## Quick start

```bash
# Clone and setup
git clone https://github.com/daveebbelaar/agentic-coding-blueprint.git my-project
cd my-project
cp app/.env.example app/.env
uv sync

# Start database and API
cd docker && ./start.sh

# Run tests
cd ..
uv run pytest tests/ -v
```

## Project structure

```
project/
├── app/                  # Application code
│   ├── api/              # FastAPI routes
│   ├── database/         # Models and sessions
│   ├── schemas/          # Pydantic models
│   ├── config.py         # Settings
│   └── main.py           # Entry point
│
├── docker/               # Docker configuration
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── start.sh
│   ├── stop.sh
│   └── logs.sh
│
├── docs/                 # Project documentation
├── playground/           # Quick validation scripts
├── tests/                # Test suite
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── evals/            # LLM evaluations
├── pyproject.toml        # Dependencies (UV)
└── CLAUDE.md             # AI instructions
```

## Docker commands

```bash
# From docker folder
./start.sh      # Start database and API
./stop.sh       # Stop all services
./logs.sh       # View API logs
```

## Stack

- **FastAPI** — API endpoints
- **PostgreSQL** — Database
- **SQLAlchemy** — ORM
- **Pydantic** — Validation
- **UV** — Dependency management
- **Docker Compose** — Local development

## Resources

- [UV](https://docs.astral.sh/uv/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Pydantic](https://docs.pydantic.dev/)
