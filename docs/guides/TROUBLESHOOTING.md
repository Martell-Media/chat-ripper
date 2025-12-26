# Troubleshooting Guide

Common issues and solutions when developing with this template.

---

## AI-Generated Code Issues

### AI Code Doesn't Work

**Symptoms:**
- Code looks correct but fails at runtime
- Import errors
- Type errors
- Logic errors

**Diagnostic Steps:**
1. **Read the error message carefully** - AI can't see runtime errors
2. **Check the spec** - Does code match what was specified?
3. **Verify imports** - Are all modules available?
4. **Check type hints** - Do they match actual types?
5. **Test in playground** - Isolate the problem

**Common Causes:**

**Missing imports:**
```python
# AI generated this but forgot import
user = User(email="test@test.com")  # NameError: User not defined

# Fix: Add import
from app.database.models import User
```

**Wrong assumptions:**
```python
# AI assumed this exists
config.api_key  # AttributeError

# Fix: Check what actually exists
print(dir(config))  # See available attributes
```

**Type mismatches:**
```python
# AI said this returns int, actually returns Optional[int]
result: int = get_value()  # Might be None

# Fix: Handle None case
result = get_value()
if result is not None:
    # use result
```

**Solution Pattern:**
1. Add debugging: `print()` or `logger.debug()`
2. Test in playground first
3. Fix and verify
4. Update spec if it was wrong
5. Update tests

---

### AI Doesn't Understand My Request

**Symptoms:**
- AI asks repeated clarifying questions
- Generates wrong code
- Misinterprets requirements

**Causes:**
- Insufficient context
- Ambiguous requirements
- Missing spec

**Solutions:**

**Create a spec first:**
```bash
# Instead of: "Add user login"
# Do this:
/generate-task-spec
# Then implement based on spec
```

**Provide examples:**
```
Bad:  "Add validation"
Good: "Add validation: email must be valid format,
       age must be 0-150, name must be 1-100 chars.
       Example valid: {email: 'test@test.com', age: 25, name: 'John'}"
```

**Reference existing code:**
```
"Follow the same pattern as in app/api/users.py lines 10-30"
```

**Show, don't just tell:**
```
"Use this Pydantic model structure:
class UserCreate(BaseModel):
    email: EmailStr
    age: int = Field(ge=0, le=150)"
```

---

## Environment & Setup Issues

### Docker Containers Won't Start

**Symptom:**
```bash
./start.sh
# Error: container exits immediately
```

**Diagnostic:**
```bash
# Check logs
docker-compose logs

# Check specific service
docker-compose logs api
docker-compose logs db
```

**Common Causes:**

**Port already in use:**
```
Error: port 5432 already in use
```
**Fix:**
```bash
# Find what's using port
lsof -i :5432

# Kill it or change port in docker-compose.yml
```

**Database initialization failed:**
```
Error: database "mydb" does not exist
```
**Fix:**
```bash
# Remove volumes and restart
cd docker
./stop.sh
docker-compose down -v  # Remove volumes
./start.sh
```

**Environment variables missing:**
```
Error: DATABASE_URL not set
```
**Fix:**
```bash
# Ensure app/.env exists
cp app/.env.example app/.env
# Edit app/.env with correct values
```

---

### Database Connection Fails

**Symptom:**
```python
sqlalchemy.exc.OperationalError: could not connect to server
```

**Diagnostic:**
```bash
# Is Docker running?
docker ps

# Is database container healthy?
docker-compose ps

# Can you connect manually?
docker exec -it <container> psql -U <user> -d <database>
```

**Common Causes:**

**Docker not running:**
```bash
cd docker && ./start.sh
```

**Wrong DATABASE_URL:**
```python
# In playground scripts, use localhost
DATABASE_URL = "postgresql://user:pass@localhost:5432/db"

# In Docker containers, use service name
DATABASE_URL = "postgresql://user:pass@db:5432/db"
```

**Fix in** `app/config.py`:
```python
class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql://user:pass@localhost:5432/db",
        env="DATABASE_URL"
    )

    @property
    def db_url(self) -> str:
        # Auto-switch between Docker and local
        import os
        if os.path.exists("/.dockerenv"):
            return self.database_url.replace("localhost", "db")
        return self.database_url
```

---

### Import Errors

**Symptom:**
```python
ModuleNotFoundError: No module named 'fastapi'
```

**Diagnostic:**
```bash
# Are dependencies installed?
uv sync

# Are you in virtual environment?
which python  # Should show .venv path

# Check what's installed
uv pip list
```

**Common Causes:**

**Not in virtual environment:**
```bash
# Activate it
source .venv/bin/activate  # or just use `uv run`
```

**Dependencies not installed:**
```bash
uv sync  # Install all dependencies
```

**Wrong Python path in playground:**
```python
# Add this at top of playground scripts
import sys
from pathlib import Path
# Add app/ to path
sys.path.insert(0, str(Path(__file__).parent.parent / "app"))
```

**Circular imports:**
```python
# File A imports from B, B imports from A
# Fix: Reorganize or use TYPE_CHECKING
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from module import Class  # Only for type hints
```

---

## Testing Issues

### Tests Fail After AI Generated Code

**Symptom:**
```bash
uv run pytest tests/
# Multiple test failures
```

**Diagnostic Steps:**
1. **Read failure messages** - What's actually failing?
2. **Check what changed** - `git diff`
3. **Test in isolation** - `uv run pytest tests/test_specific.py::test_function -v`
4. **Add debug output** - `print()` in test

**Common Causes:**

**AI changed behavior:**
```python
# Test expects old behavior
assert result == 42

# AI changed function to return 43
# Fix: Update test or fix code
```

**AI didn't update tests:**
```python
# Code signature changed
def get_user(id: int, include_email: bool = False):  # New param

# Test still uses old signature
get_user(1)  # Missing new param

# Fix: Update test
get_user(1, include_email=True)
```

**Test dependencies:**
```python
# Test assumes database in certain state
# Previous test modified it

# Fix: Use fixtures to reset state
@pytest.fixture(autouse=True)
def reset_db():
    # Reset database before each test
    yield
    # Cleanup after
```

**Solution:**
```bash
# Run single test with verbose output
uv run pytest tests/test_file.py::test_name -v -s

# Add debugging
def test_something():
    result = function()
    print(f"Result: {result}")  # Debug output
    assert result == expected
```

---

### Integration Tests Fail But Unit Tests Pass

**Symptom:**
```bash
uv run pytest tests/unit/ -v    # All pass
uv run pytest tests/integration/ -v  # Failures
```

**Diagnostic:**
```bash
# Ensure Docker is running
docker ps

# Check database connection
docker-compose exec db psql -U user -d dbname

# Check API logs
cd docker && ./logs.sh
```

**Common Causes:**

**Docker not running:**
```bash
cd docker && ./start.sh
```

**Database state pollution:**
```python
# Previous test left data
# Fix: Clean database between tests
@pytest.fixture(autouse=True)
def clean_db(session):
    yield
    session.query(Model).delete()
    session.commit()
```

**Wrong base URL:**
```python
# Test uses wrong endpoint
response = client.get("http://localhost:8000/users")  # Wrong port

# Fix: Use correct URL from config
response = client.get(f"{settings.api_url}/users")
```

---

## Type Hint Errors

**Symptom:**
```python
# Mypy or IDE shows type errors
error: Argument 1 has incompatible type "str"; expected "int"
```

**Diagnostic:**
```bash
# Run mypy
uv run mypy app/
```

**Common Causes:**

**AI used wrong type:**
```python
def get_user(user_id: str):  # Should be int
    return db.query(User).filter(User.id == user_id).first()  # Type mismatch

# Fix:
def get_user(user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()
```

**Missing Optional:**
```python
def find_user(id: int) -> User:  # Might return None
    return db.query(User).filter(User.id == id).first()

# Fix:
def find_user(id: int) -> User | None:
    return db.query(User).filter(User.id == id).first()
```

**Pydantic model issues:**
```python
class User(BaseModel):
    name: str
    age: int = None  # Wrong - should be Optional[int] or int | None

# Fix:
from typing import Optional
class User(BaseModel):
    name: str
    age: Optional[int] = None  # or: age: int | None = None
```

---

## Pydantic Validation Errors

**Symptom:**
```python
ValidationError: 1 validation error
  email
    value is not a valid email address
```

**Diagnostic:**
```python
# Print the data being validated
print(f"Data: {data}")
try:
    model = UserCreate(**data)
except ValidationError as e:
    print(e.json())  # Detailed error info
```

**Common Causes:**

**Wrong data type:**
```python
# Sending string instead of int
data = {"age": "25"}  # Should be int

# Fix:
data = {"age": 25}
```

**Missing required field:**
```python
class UserCreate(BaseModel):
    email: str  # Required
    name: str   # Required

data = {"email": "test@test.com"}  # Missing name

# Fix: Provide all required fields or make optional
class UserCreate(BaseModel):
    email: str
    name: str | None = None  # Now optional
```

**Validation constraint:**
```python
age: int = Field(ge=0, le=150)
data = {"age": 200}  # Exceeds max

# Fix: Provide valid data or adjust constraint
```

---

## Git & Version Control Issues

### Uncommitted Changes Blocking Operations

**Symptom:**
```bash
git checkout main
error: Your local changes would be overwritten
```

**Solution:**
```bash
# Option 1: Commit changes
git add .
git commit -m "WIP: work in progress"

# Option 2: Stash changes
git stash
git checkout main
git stash pop  # Restore changes later

# Option 3: Discard changes (careful!)
git restore .
```

---

### Merge Conflicts

**Symptom:**
```bash
git pull
CONFLICT (content): Merge conflict in app/main.py
```

**Solution:**
```bash
# Open conflicted file
# Look for conflict markers:
<<<<<<< HEAD
your changes
=======
their changes
>>>>>>> branch-name

# Manually resolve, keeping what you want

# Mark as resolved
git add app/main.py
git commit -m "Resolve merge conflict"
```

**Prevention:**
- Pull before starting work
- Commit frequently
- Work in feature branches

---

## Performance Issues

### Slow Tests

**Symptom:**
```bash
uv run pytest tests/  # Takes > 30 seconds
```

**Diagnostic:**
```bash
# Profile test execution time
uv run pytest tests/ --durations=10
```

**Common Causes:**

**Database operations:**
```python
# Creating fresh database for each test
# Fix: Use transaction rollback
@pytest.fixture
def session():
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()  # Fast rollback instead of delete
    connection.close()
```

**Too many fixtures:**
```python
# Loading entire database
# Fix: Create minimal fixtures
```

---

### Slow API Response

**Symptom:**
```bash
curl http://localhost:8000/users  # Takes > 1 second
```

**Diagnostic:**
```python
import time

@app.get("/users")
def get_users():
    start = time.time()
    users = db.query(User).all()
    print(f"Query took: {time.time() - start}s")
    return users
```

**Common Causes:**

**N+1 queries:**
```python
# Fetches users, then queries for each user's posts
users = db.query(User).all()
for user in users:
    posts = db.query(Post).filter(Post.user_id == user.id).all()  # N queries

# Fix: Use joinedload
from sqlalchemy.orm import joinedload
users = db.query(User).options(joinedload(User.posts)).all()  # 1 query
```

**Missing indexes:**
```python
# Add index to frequently queried columns
class User(Base):
    __tablename__ = "users"
    email = Column(String, index=True)  # Add index
```

---

## Dependency Conflicts

**Symptom:**
```bash
uv add new-package
error: No solution found when resolving dependencies
```

**Diagnostic:**
```bash
# Check what's conflicting
uv pip check
```

**Solution:**
```bash
# Try updating all dependencies
uv sync --upgrade

# Or pin conflicting versions
uv add "package>=1.0,<2.0"

# Worst case: remove conflict
uv remove conflicting-package
```

---

## Common Error Messages & Fixes

### "CLAUDE.md not found"

**Cause:** AI looking for context file that doesn't exist

**Fix:**
```bash
# Create the file
touch CLAUDE.md
# Add project-specific patterns
```

---

### "Circular dependency detected"

**Cause:** Module A imports B, B imports A

**Fix:**
```python
# Use TYPE_CHECKING
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from module_b import ClassB

# Or reorganize imports
```

---

### "DatabaseError: relation does not exist"

**Cause:** Database table not created

**Fix:**
```python
# Create all tables
from app.database import Base, engine
Base.metadata.create_all(bind=engine)

# Or use migrations (better)
```

---

### "PermissionError: [Errno 13]"

**Cause:** File/directory permission issue

**Fix:**
```bash
# Check permissions
ls -la file

# Fix permissions
chmod 644 file  # For files
chmod 755 directory  # For directories
```

---

## Debugging Strategies

### 1. Reproduce in Playground

```python
# playground/debug_issue.py
from app.module import function

# Test with exact inputs that fail
result = function(problematic_input)
print(f"Result: {result}")
```

### 2. Add Logging

```python
import logging
logger = logging.getLogger(__name__)

def function():
    logger.debug("Starting function")
    logger.debug(f"Variable: {variable}")
    # ... code
    logger.debug("Function complete")
```

### 3. Use Debugger

```python
# Add breakpoint
breakpoint()  # Python 3.7+

# Or use pdb
import pdb; pdb.set_trace()
```

### 4. Isolate the Problem

```bash
# Test one component at a time
# Database connection works?
# API endpoint works?
# Business logic works?
# Integration works?
```

### 5. Check Git History

```bash
# When did this break?
git log --oneline
git diff <commit>  # Compare to working version
git bisect  # Binary search for breaking commit
```

---

## When to Ask for Help

**Ask AI when:**
- Error message unclear
- Need code examples
- Want to understand patterns
- Exploring solutions

**Ask humans when:**
- Business logic questions
- Architectural decisions
- Unwritten conventions
- Persistent bugs after trying fixes

**Check documentation when:**
- Library-specific issues
- Configuration questions
- Best practices

---

## Prevention Checklist

Before asking "why doesn't this work?", check:

- [ ] Did I read the error message?
- [ ] Did I check the spec matches implementation?
- [ ] Are all dependencies installed? (`uv sync`)
- [ ] Is Docker running? (`docker ps`)
- [ ] Did I test in isolation (playground)?
- [ ] Are there tests I can run?
- [ ] Did I check recent git changes? (`git diff`)
- [ ] Did I add logging/debugging output?
- [ ] Have I tried it in a fresh environment?
- [ ] Did I check CLAUDE.md for guidance?

---

## Emergency Recovery

**If everything is broken:**

```bash
# 1. Check git status
git status

# 2. Stash changes
git stash

# 3. Return to known good state
git checkout <last-working-commit>

# 4. Verify it works
uv run pytest tests/

# 5. Carefully reapply changes
git stash pop
# Fix issues one at a time
```

---

## See Also

- [Common Pitfalls](COMMON_PITFALLS.md) - Prevention strategies
- [Security Guide](SECURITY_GUIDE.md) - Security issues
- [Getting Started](../GETTING_STARTED.md) - Correct workflows
