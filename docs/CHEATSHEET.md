# Quick Reference Cheat Sheet

One-page reference for common commands and workflows.

---

## When to Run Which Command

```
Starting new project?
  → /generate-charter
  → /generate-prd
  → /generate-architecture
  → /generate-wbs
  → /generate-dev-env

Implementing feature from WBS?
  → /generate-task-spec
  → /generate-unit-tests
  → (write code)
  → /generate-e2e-tests
  → /update-wbs

Building AI feature?
  → /generate-task-spec
  → /generate-prompt
  → /generate-unit-tests
  → (write code)
  → tests/evals/ for quality

Requirements changed?
  → /update-prd
  → /update-wbs

Architecture changed?
  → /update-architecture

Project complete?
  → /update-architecture
  → /update-charter
  → /generate-case-study
```

---

## UV Commands (Dependency Management)

```bash
# Setup
uv sync                     # Install all dependencies from lock file
uv sync --upgrade           # Update dependencies to latest versions

# Adding dependencies
uv add <package>            # Add production dependency
uv add --dev <package>      # Add development dependency
uv add "package>=1.0,<2.0"  # Add with version constraint

# Removing dependencies
uv remove <package>         # Remove dependency

# Running commands
uv run python script.py     # Run Python in virtual environment
uv run pytest tests/ -v     # Run tests
uv run uvicorn app.main:app --reload  # Run app

# Info
uv pip list                 # List installed packages
uv pip check                # Check for conflicts

# NEVER manually edit pyproject.toml - always use uv commands!
```

---

## Docker Commands

```bash
# From project root
cd docker

# Start services
./start.sh                  # Start database + API

# Stop services
./stop.sh                   # Stop all services

# View logs
./logs.sh                   # Follow API logs
docker-compose logs db      # View database logs

# Reset everything (nuclear option)
docker-compose down -v      # Stop and remove volumes
./start.sh                  # Fresh start

# Direct commands
docker ps                   # List running containers
docker-compose ps           # List project containers
docker exec -it <container> bash  # Enter container shell
```

---

## Testing Commands

```bash
# Run all tests
uv run pytest tests/ -v

# Run specific test types
uv run pytest tests/unit/ -v          # Unit tests only
uv run pytest tests/integration/ -v   # Integration tests (needs Docker)
uv run pytest tests/evals/ -v         # LLM evaluation tests

# Run specific file
uv run pytest tests/test_api.py -v

# Run specific test
uv run pytest tests/test_api.py::test_create_user -v

# With coverage
uv run pytest --cov=app tests/

# With debug output
uv run pytest tests/ -v -s     # -s shows print statements

# Show slowest tests
uv run pytest tests/ --durations=10
```

---

## Git Workflow

```bash
# Status
git status                  # See changes
git diff                    # See code changes
git log --oneline           # See commit history

# Committing (after completing WBS task)
git add .
git commit -m "[WBS-123] Brief description

Longer description if needed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Pushing
git push

# Branching
git checkout -b feature/new-feature  # Create branch
git checkout main                    # Switch branch
git merge feature/new-feature        # Merge branch

# Undoing
git restore file.py                  # Discard changes to file
git restore .                        # Discard all changes
git stash                            # Save changes temporarily
git stash pop                        # Restore stashed changes
```

---

## Project Structure Quick Ref

```
project/
├── .claude/
│   ├── COMMANDS.md         # This guide
│   └── commands/           # 15 Claude Code commands
├── app/
│   ├── api/                # FastAPI endpoints
│   ├── database/           # SQLAlchemy models
│   ├── schemas/            # Pydantic models
│   ├── services/           # Business logic
│   ├── workflows/          # AI workflows
│   ├── config.py           # Pydantic Settings
│   ├── main.py             # FastAPI app
│   └── .env                # Secrets (git-ignored!)
├── docs/
│   ├── GETTING_STARTED.md  # Full workflow guide
│   ├── core/               # Charter, PRD, ADD, WBS
│   ├── specs/              # Pre-implementation specs
│   ├── features/           # Post-implementation docs
│   ├── plans/              # Active development plans
│   ├── scratchpad/         # Temporary notes
│   ├── logs/               # Bug reports
│   ├── guides/             # Methodology guides
│   └── templates/          # Spec & prompt templates
├── docker/
│   ├── docker-compose.yml  # Services config
│   ├── start.sh            # Start all services
│   ├── stop.sh             # Stop all services
│   └── logs.sh             # View logs
├── playground/             # Quick test scripts
├── tests/
│   ├── unit/               # Isolated component tests
│   ├── integration/        # Full workflow tests
│   └── evals/              # LLM quality tests
├── pyproject.toml          # Dependencies (USE UV!)
├── uv.lock                 # Locked versions
└── CLAUDE.md               # AI coding instructions
```

---

## File Locations

| Document Type | Location | When |
|--------------|----------|------|
| Project charter | `docs/core/project_charter.md` | Project start |
| PRD | `docs/core/prd.md` | Project start |
| Architecture | `docs/core/add.md` | Project start |
| Work breakdown | `docs/core/wbs.md` | Project start |
| Task spec | `docs/specs/<feature>_spec.md` | Before coding |
| Feature doc | `docs/features/<feature>.md` | After coding |
| Active plan | `docs/plans/<plan>.md` | During dev |
| Working notes | `docs/scratchpad/<topic>.md` | Temporary |
| Issues/bugs | `docs/logs/<issue>.md` | When discovered |

---

## Common Code Patterns

### FastAPI Endpoint

```python
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.user import UserCreate, UserResponse
from app.database.session import get_db

router = APIRouter()

@router.post("/users", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
) -> UserResponse:
    # Validation happens automatically via Pydantic
    user = User(**user_data.dict())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
```

### Database Model

```python
from sqlalchemy import Column, Integer, String
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
```

### Pydantic Schema

```python
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=150)

class UserResponse(BaseModel):
    id: int
    email: str
    name: str

    class Config:
        from_attributes = True  # For SQLAlchemy models
```

### Playground Script

```python
# playground/test_feature.py
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database.session import SessionLocal
from app.database.models import User

def main():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Found {len(users)} users")
        for user in users:
            print(f"  - {user.name} ({user.email})")
    finally:
        db.close()

if __name__ == "__main__":
    main()
```

---

## Environment Variables

```bash
# app/.env (git-ignored!)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
API_KEY=your-secret-key
DEBUG=true

# Load in app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    api_key: str
    debug: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Security Checklist

Before accepting AI code, verify:
- [ ] Input validation with Pydantic
- [ ] Authorization checks for sensitive operations
- [ ] No hardcoded secrets
- [ ] Using SQLAlchemy ORM (not raw SQL)
- [ ] Error messages don't leak sensitive info
- [ ] Rate limiting on sensitive endpoints
- [ ] Type hints on all functions
- [ ] Tests cover security scenarios

---

## Debugging Quick Hits

```python
# Add logging
import logging
logger = logging.getLogger(__name__)
logger.debug(f"Variable: {variable}")

# Add breakpoint
breakpoint()  # Python 3.7+

# Print to console
print(f"Debug: {value}")

# Check type
print(f"Type: {type(variable)}")

# Inspect object
print(dir(object))  # See all attributes
```

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| `ModuleNotFoundError` | `uv sync` |
| `OperationalError: could not connect` | `cd docker && ./start.sh` |
| `ValidationError` | Check Pydantic model constraints |
| `NameError: name not defined` | Missing import |
| `TypeError: X() takes 0 positional arguments` | Wrong function signature |
| `FATAL: database does not exist` | `docker-compose down -v && ./start.sh` |
| `Port 5432 already in use` | `lsof -i :5432` and kill process |

---

## Decision Trees

### Should I create documentation?

```
Is this a new project idea?
├─ Yes → /generate-charter
└─ No → Is this defining what to build?
    ├─ Yes → /generate-prd
    └─ No → Is this system architecture?
        ├─ Yes → /generate-architecture
        └─ No → Is this planning tasks?
            ├─ Yes → /generate-wbs
            └─ No → Am I about to write code?
                ├─ Yes → /generate-task-spec
                └─ No → Requirements changed?
                    ├─ Yes → /update-prd
                    └─ No → Task completed?
                        └─ Yes → /update-wbs
```

### What tests do I need?

```
Testing single function/class in isolation?
├─ Yes → Unit test (tests/unit/)
└─ No → Testing API endpoint?
    ├─ Yes → Integration test (tests/integration/)
    └─ No → Testing LLM output quality?
        └─ Yes → Eval test (tests/evals/)
```

---

## Keyboard Shortcuts (Terminal)

```bash
Ctrl+C      # Stop running process
Ctrl+D      # Exit shell/Python REPL
Ctrl+R      # Search command history
Ctrl+A      # Move to start of line
Ctrl+E      # Move to end of line
Ctrl+L      # Clear screen (or type 'clear')
Tab         # Autocomplete
↑/↓         # Previous/next command
```

---

## Resources

- **Full Guide:** [docs/GETTING_STARTED.md](GETTING_STARTED.md)
- **Commands:** [.claude/COMMANDS.md](.claude/COMMANDS.md)
- **Guides:** [docs/guides/](guides/)
- **Templates:** [docs/templates/](templates/)
- **UV Docs:** https://docs.astral.sh/uv/
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Pydantic Docs:** https://docs.pydantic.dev/

---

## Emergency Commands

```bash
# Everything is broken - start over
git stash                   # Save current work
git checkout <last-working-commit>
uv run pytest tests/        # Verify it works
git stash pop               # Restore work
# Fix issues one at a time

# Docker is broken
cd docker
./stop.sh
docker-compose down -v      # Nuclear option - removes all data
./start.sh

# Dependencies are broken
rm -rf .venv uv.lock
uv sync                     # Fresh install
```

---

**Print this page and keep it handy!**
