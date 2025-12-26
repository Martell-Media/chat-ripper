# Agentic Coding Blueprint - Project Template

A complete AI-assisted development template with FastAPI backend, structured workflows, and 14 Claude Code commands.

## What This Is

This template provides:
- **Modern Python stack** (FastAPI, PostgreSQL, SQLAlchemy, Pydantic)
- **14 Claude Code commands** for spec-driven development
- **Structured documentation** (charter, PRD, architecture, WBS)
- **Complete workflows** for project lifecycle (pre-dev, dev, post-dev)
- **Testing framework** (unit, integration, evals)

**Philosophy:** Spec-driven development with AI assistance. Better engineering fundamentals = better AI-assisted coding.

## Getting Started

**New to this template?** Start here: [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md)

**Quick command reference:** [`.claude/COMMANDS.md`](.claude/COMMANDS.md)

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

## Available Commands

This template includes 14 Claude Code commands for the complete project lifecycle:

**Pre-Development (5):** Project charter, PRD, architecture, WBS, dev environment
**Development (6):** Task specs, prompts, unit tests, e2e tests, PRD updates, WBS updates
**Post-Development (3):** Architecture updates, charter updates, case studies

See [`.claude/COMMANDS.md`](.claude/COMMANDS.md) for details.

## Workflows

### Starting a New Project
```
1. Skill: 01_pre_dev:01_generate_project_charter    # Business vision
2. Skill: 01_pre_dev:02_generate_prd                # Product requirements
3. Skill: 01_pre_dev:03_generate_architecture_design # System design
4. Skill: 01_pre_dev:04_generate_wbs                # Task breakdown
5. Skill: 01_pre_dev:05_generate_dev_environment_guide # Setup guide
```

### Implementing a Feature (TDD)
```
1. Skill: 02_dev:generate_task_spec      # Spec before code
2. Skill: 02_dev:generate_unit_tests     # Tests first
3. Implement feature following spec
4. Skill: 02_dev:generate_e2e_tests      # Integration tests
5. Skill: 02_dev:update_wbs              # Track completion
```

See [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) for complete workflows.

## Documentation

### Core Guides
- **[Getting Started](docs/GETTING_STARTED.md)** - Complete workflow guide for starting projects
- **[Commands Reference](.claude/COMMANDS.md)** - All 14 commands with usage patterns
- **[Quick Start Guide](docs/guides/QUICK_START.md)** - Decision trees for common scenarios
- **[AI-Assisted Development](docs/guides/AI_ASSISTED_DEVELOPMENT_GUIDE.md)** - Methodology and philosophy
- **[CLAUDE.md Usage](docs/guides/CLAUDE_MD_USAGE.md)** - Context management patterns

### Templates
- **[Spec Template](docs/templates/specs_template.md)** - Engineering specification structure
- **[Prompt Template](docs/templates/prompt_template.md)** - LLM prompt design

## Resources

- **Tools:** [UV](https://docs.astral.sh/uv/), [FastAPI](https://fastapi.tiangolo.com/), [Pydantic](https://docs.pydantic.dev/)
- **AI Tools:** [Cursor](https://cursor.com), [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- **Original Course:** [Agentic Coding Blueprint](https://github.com/datalumina/agentic-coding-blueprint)
