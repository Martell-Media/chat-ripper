# Testing Guidelines

## Running Tests

```bash
# Run all tests (requires Docker running)
uv run pytest tests/ -v

# Run specific test type
uv run pytest tests/unit/ -v
uv run pytest tests/integration/ -v
uv run pytest tests/evals/ -v
```

## Test Structure

```
tests/
├── unit/           # Unit tests - isolated, no external dependencies
├── integration/    # Integration tests - require Docker running
└── evals/          # LLM evaluation tests - test AI outputs
```