# CLAUDE.md

This file provides guidance to AI Assistants when working with Python AI backend projects.

## Philosophy

**Code Quality Principles:**

- **Minimize code** - Solve problems with as little code as possible
- **Self-descriptive code** - Code should be clear without excessive comments
- **Simple first** - Use basic Python primitives before advanced techniques
- **Type-safe by default** - Leverage Pydantic for validated data flow
- **AI-friendly** - Structure code for optimal AI agent comprehension

**Documentation:**

- Code should be self-explanatory through clear naming and structure
- Add docstrings only when behavior isn't obvious from the code
- Avoid verbose or redundant comments
- Document complex algorithms and non-obvious design decisions

## Project Structure

```
root/
├── app/                   # Main application code
│   ├── api/               # FastAPI endpoints and routers
│   ├── database/          # Database models and sessions
│   ├── schemas/           # Pydantic models for validation
│   ├── services/          # Business logic and integrations
│   ├── workflows/         # AI workflows and orchestrations
│   ├── alembic/           # Database migrations
│   ├── config.py          # Configuration and settings
│   ├── main.py            # Application entry point
│   ├── .env               # Environment variables (git ignored)
│   └── .env.example       # Environment template
├── docker/                # Docker configurations
│   ├── start.sh           # Start services
│   ├── stop.sh            # Stop services
│   └── logs.sh            # View logs
├── docs/                  # Project documentation (see docs/CLAUDE.md)
├── playground/            # Quick validation scripts
├── tests/                 # Test suite (see tests/CLAUDE.md)
├── pyproject.toml         # Dependencies (managed by UV)
├── uv.lock                # Locked dependency versions
└── CLAUDE.md              # AI instructions (this file)
```

## Development Workflow

**Follow: Spec → Code → Review**

1. **Spec** - Write implementation spec before coding
2. **Code** - Implement following the spec
3. **Review** - Verify behavior matches spec

See `docs/CLAUDE.md` for document placement guidelines.

## Python Standards

**Version:** Python 3.12+

**Style:**

- Follow PEP 8
- Line length: 88 characters
- Use Ruff for formatting and linting

## Type Hints (MANDATORY)

All code must use type hints:

```python
def process_request(user_id: str, data: UserRequest) -> UserResponse:
    pass
```

- All function parameters must have type hints
- All return types must be annotated
- Use Pydantic models for structured data

## Dependency Management

**CRITICAL: Always use UV commands**

Never manually edit `pyproject.toml` for dependencies.

```bash
uv add <package>           # Add dependency
uv add --dev pytest        # Add dev dependency
uv remove <package>        # Remove dependency
uv sync                    # Sync environment
uv run python script.py    # Run in environment
```

## Docker Commands

```bash
cd docker
./start.sh    # Start database and API
./stop.sh     # Stop all services
./logs.sh     # View API logs
```

## Environment Variables

- Store `.env` in `app/` directory
- Copy `.env.example` to `.env` for setup
- Use Pydantic Settings for validation
- Never commit `.env` to git

## Code Patterns

**Favor:**

- Simple functions and classes
- List/dict comprehensions
- Built-in functions (`map`, `filter`, `zip`)
- Pydantic models for data validation

**Avoid:**

- Premature abstraction
- Deep inheritance
- Global mutable state
- Circular imports

## Key Reminders

- **Read before writing** - Understand existing patterns first
- **Spec before code** - Write implementation spec first
- **Type hints everywhere** - Critical for AI understanding
- **Use UV for dependencies** - Never edit pyproject.toml directly
- **Check docs/CLAUDE.md** - For document placement
- **Check tests/CLAUDE.md** - For testing guidelines
