# Getting Started: Agentic Coding Blueprint Workflow

This guide walks you through starting a new project from scratch using AI-assisted development principles.

## Overview

The workflow follows a **spec-driven development** approach:

```
Business Vision → Product Requirements → System Architecture → Task Breakdown → Implementation → Review → Deploy
```

Each phase has dedicated Claude Code commands to guide you through conversations that generate documentation.

---

## Phase 1: Pre-Development (Business Foundation)

### Step 1: Generate Project Charter

**Command:** `/generate-charter`

**Purpose:** Establish business vision, objectives, and success criteria before any technical work.

**What happens:**
- Claude engages you in an interactive conversation exploring:
  - Project vision and purpose
  - Business objectives and KPIs
  - Stakeholder identification
  - Market analysis and competitive landscape
  - Resource constraints and timeline
  - Initial risk assessment
  - Revenue model and business strategy
- Creates scratchpad at `docs/scratchpad/project_charter_scratchpad.md`
- Generates final charter at `docs/core/project_charter.md`

**When to use:** At the very start of a new project idea.

**Key questions to prepare:**
- What problem does this solve?
- Who are the users?
- What defines success?
- What are the constraints (time, budget, resources)?

---

### Step 2: Generate Product Requirements Document (PRD)

**Command:** `/generate-prd`

**Purpose:** Transform business objectives into detailed, actionable product requirements.

**What happens:**
- Claude guides you through defining:
  - User personas and their goals
  - User journeys and workflows
  - Functional requirements (what the system does)
  - Non-functional requirements (performance, security, usability)
  - Data requirements and relationships
  - Interface requirements
  - Constraints and assumptions
  - Acceptance criteria
  - Prioritization (must-have vs nice-to-have)
- Creates scratchpad at `docs/scratchpad/prd_scratchpad.md`
- Generates final PRD at `docs/core/prd.md`

**When to use:** After the project charter is finalized.

**Key questions to prepare:**
- Who are the primary users?
- What are their main workflows?
- What are the must-have features vs nice-to-haves?
- What are the performance/security requirements?

---

### Step 3: Generate Architecture Design Document (ADD)

**Command:** `/generate-architecture`

**Purpose:** Design the system architecture that will fulfill the product requirements.

**What happens:**
- Claude helps you define:
  - System components and their responsibilities
  - Technology stack selection and rationale
  - Data architecture and schemas
  - API design and integration points
  - Infrastructure and deployment strategy
  - Security architecture
  - Scalability considerations
  - Technical risks and mitigation strategies
- Creates scratchpad at `docs/scratchpad/add_scratchpad.md`
- Generates final ADD at `docs/core/add.md`

**When to use:** After the PRD is complete and you understand what needs to be built.

**Key questions to prepare:**
- What technologies fit the requirements?
- What are the main system components?
- How will data flow through the system?
- What are the integration points?

---

### Step 4: Generate Work Breakdown Structure (WBS)

**Command:** `/generate-wbs`

**Purpose:** Break down the architecture into concrete, implementable tasks.

**What happens:**
- Claude helps you create:
  - Hierarchical task breakdown
  - Task dependencies and sequencing
  - Effort estimates and complexity ratings
  - Sprint/iteration planning
  - Critical path identification
  - Resource allocation
  - Risk-adjusted timelines
- Creates scratchpad at `docs/scratchpad/wbs_scratchpad.md`
- Generates final WBS at `docs/core/wbs.md`

**When to use:** After architecture is defined and you're ready to plan implementation.

**Key questions to prepare:**
- What's the logical sequence of implementation?
- What tasks depend on others?
- What's the complexity of each task?
- What's the MVP scope?

---

### Step 5: Generate Development Environment Guide

**Command:** `/generate-dev-env`

**Purpose:** Document setup instructions for development, testing, and deployment environments.

**What happens:**
- Claude guides you through documenting:
  - Local development setup
  - Required tools and versions
  - Environment variable configuration
  - Database setup and migrations
  - Docker container setup
  - Testing environment configuration
  - CI/CD pipeline setup
  - Deployment procedures
- Creates scratchpad at `docs/scratchpad/dev_env_scratchpad.md`
- Generates final guide at `docs/core/dev_environment_guide.md`

**When to use:** After WBS is complete and you're ready to start coding.

**Key questions to prepare:**
- What tools are needed?
- How do new developers get started?
- What environment variables are required?
- How do we deploy?

---

## Phase 2: Development (Implementation)

### Step 6: Generate Task Specification

**Command:** `/generate-task-spec`

**Purpose:** Create detailed implementation specs for individual features before coding.

**What happens:**
- Claude helps you define:
  - Context (current state vs desired state)
  - Data models and types (Pydantic examples)
  - Interfaces and contracts (function signatures)
  - Implementation plan and steps
  - Key algorithms and logic
  - Error handling strategy
  - Testing requirements
  - Edge cases and constraints
  - Open questions
- Generates spec at `docs/specs/<feature>_spec.md`

**When to use:** Before implementing each feature from the WBS.

**Workflow:**
1. Pick a task from WBS
2. Generate task spec using this command
3. Review and refine the spec
4. Implement following the spec
5. Move spec to `docs/features/` after completion

---

### Step 7: Generate Unit Tests

**Command:** `/generate-unit-tests`

**Purpose:** Create unit tests for isolated components before or during implementation.

**What happens:**
- Claude generates:
  - Test fixtures and setup
  - Individual function/method tests
  - Edge case coverage
  - Error handling tests
  - Mock dependencies
  - Assertion patterns
- Creates tests in `tests/unit/`

**When to use:**
- Before implementation (Test-Driven Development)
- During implementation (parallel with code)
- After implementation (ensure coverage)

**Test-Driven Development workflow:**
1. Generate task spec
2. Generate unit tests based on spec
3. Run tests (they should fail)
4. Implement code until tests pass
5. Refactor with confidence

---

### Step 8: Generate End-to-End Tests

**Command:** `/generate-e2e-tests`

**Purpose:** Create integration tests that verify complete workflows.

**What happens:**
- Claude generates:
  - API endpoint tests
  - Database integration tests
  - Multi-component workflow tests
  - Error scenario tests
  - Performance validation
- Creates tests in `tests/integration/`

**When to use:** After implementing features that involve multiple components.

**Requirements:**
- Docker must be running for database-dependent tests
- Run with: `uv run pytest tests/integration/ -v`

---

### Step 9: Generate LLM Prompt

**Command:** `/generate-prompt`

**Purpose:** Create structured, production-ready prompts for LLM integrations.

**What happens:**
- Claude helps you design:
  - Role definition (specialist identity)
  - Purpose and capabilities
  - Step-by-step task description
  - Classification/strategy criteria
  - Examples (typical and edge cases)
  - Output format specifications
  - Input validation and guardrails
- Generates prompt template for your use

**When to use:** When building features that use LLM API calls.

**Best practices:**
- Define clear role and expertise
- Provide specific examples
- Specify exact output format
- Include edge cases
- Add validation rules

---

### Step 10: Update PRD

**Command:** `/update-prd`

**Purpose:** Keep product requirements in sync with implementation reality.

**What happens:**
- Claude helps you:
  - Document requirement changes discovered during development
  - Update acceptance criteria based on implementation
  - Record scope changes and rationale
  - Maintain requirements traceability
- Updates `docs/core/prd.md` with version tracking

**When to use:**
- When requirements change during development
- When new requirements are discovered
- After completing major features

**Why it matters:** Prevents documentation drift and maintains single source of truth.

---

### Step 11: Update WBS

**Command:** `/update-wbs`

**Purpose:** Track task completion, complexity changes, and timeline adjustments.

**What happens:**
- Claude helps you:
  - Mark tasks as completed
  - Adjust effort estimates based on actual work
  - Document blockers and resolutions
  - Update task dependencies
  - Re-prioritize remaining work
- Updates `docs/core/wbs.md` with progress tracking

**When to use:**
- After completing each task
- When discovering new subtasks
- When complexity differs from estimates
- During sprint retrospectives

**Why it matters:** Provides visibility into progress and informs future estimates.

---

## Phase 3: Post-Development (Documentation & Retrospective)

### Step 12: Update Architecture Design Document (ADD)

**Command:** `/update-architecture`

**Purpose:** Document architectural decisions and changes made during implementation.

**What happens:**
- Claude helps you:
  - Document actual architecture vs planned
  - Record architectural decision records (ADRs)
  - Update component diagrams
  - Document technical debt
  - Capture lessons learned
- Updates `docs/core/add.md` with implementation insights

**When to use:**
- After major architectural changes
- When discovering better patterns during development
- At project milestones or completion

**Why it matters:** Keeps architecture documentation accurate for future work.

---

### Step 13: Update Project Charter

**Command:** `/update-charter`

**Purpose:** Document business outcomes, lessons learned, and strategic insights.

**What happens:**
- Claude helps you:
  - Compare actual outcomes vs objectives
  - Document business metrics achieved
  - Record strategic lessons learned
  - Identify success factors and challenges
  - Update risk assessment with actual outcomes
- Updates `docs/core/project_charter.md` with retrospective

**When to use:**
- At project completion
- At major milestones
- When pivoting strategy

**Why it matters:** Captures business value delivered and informs future projects.

---

### Step 14: Generate Case Study

**Command:** `/generate-case-study`

**Purpose:** Create a comprehensive project retrospective and knowledge artifact.

**What happens:**
- Claude helps you create:
  - Executive summary of the project
  - Problem statement and solution overview
  - Technical approach and architecture
  - Challenges faced and solutions
  - Results and metrics
  - Lessons learned and best practices
  - Recommendations for similar projects
- Generates case study at `docs/case_studies/<project>_case_study.md`

**When to use:**
- At project completion
- When documenting significant features
- For portfolio/knowledge sharing

**Why it matters:** Transforms experience into reusable knowledge.

---

## Quick Reference: Command Usage Patterns

### Starting a New Project (Complete Flow)

```bash
# Phase 1: Foundation (Pre-Development)
/generate-charter    # Business vision
/generate-prd        # Product requirements
/generate-architecture # System design
/generate-wbs        # Task breakdown
/generate-dev-env    # Setup guide

# Phase 2: Implementation (Development)
# For each task in WBS:
/generate-task-spec  # Feature spec
/generate-unit-tests # Tests (TDD)
# ... write code ...
/generate-e2e-tests  # Integration tests

# Keep docs in sync:
/update-prd          # When requirements change
/update-wbs          # After completing tasks

# Phase 3: Completion (Post-Development)
/update-architecture # Architecture changes
/update-charter      # Business outcomes
/generate-case-study # Project retrospective
```

### Adding a Feature to Existing Project

```bash
# 1. Spec the feature
/generate-task-spec

# 2. Write tests first (TDD)
/generate-unit-tests

# 3. Implement the feature
# (write code following the spec)

# 4. Integration tests
/generate-e2e-tests

# 5. Update tracking
/update-wbs
```

### Building AI Features

```bash
# 1. Spec the feature
/generate-task-spec

# 2. Design the prompt
/generate-prompt

# 3. Tests for LLM behavior
/generate-unit-tests  # Mock LLM responses
# Create evals in tests/evals/ for LLM output quality

# 4. Implement
# (write code)

# 5. Integration tests
/generate-e2e-tests
```

---

## Decision Trees

### When Should I Create Documentation?

**Create Project Charter when:**
- Starting a new project idea
- Pitching to stakeholders
- Seeking funding or approval
- Defining business case

**Create PRD when:**
- You have business approval
- Ready to define detailed requirements
- Need to communicate with team/stakeholders

**Create ADD when:**
- PRD is finalized
- Ready to make technology decisions
- Need to plan system components

**Create WBS when:**
- Architecture is defined
- Ready to start implementation
- Need to estimate timeline

**Create Task Spec when:**
- Starting work on a WBS task
- Requirements need clarification
- Implementation approach needs definition

**Update PRD when:**
- Requirements change during development
- New requirements discovered
- Scope changes occur

**Update WBS when:**
- Completing tasks
- Complexity differs from estimates
- New subtasks discovered

**Update ADD when:**
- Making architectural changes
- Discovering better patterns
- Completing major refactors

**Create Case Study when:**
- Project is complete
- Major milestone reached
- Want to document learnings

---

## File Organization Reference

```
docs/
├── core/                          # Foundational documents (rarely change)
│   ├── project_charter.md         # Business vision and objectives
│   ├── prd.md                     # Product requirements
│   ├── add.md                     # Architecture design
│   ├── wbs.md                     # Work breakdown structure
│   └── dev_environment_guide.md   # Setup instructions
├── specs/                         # Pre-implementation specs
│   └── <feature>_spec.md          # Written BEFORE coding
├── features/                      # Post-implementation docs
│   └── <feature>_guide.md         # Written AFTER coding (usage)
├── plans/                         # Active development plans
│   └── <initiative>_plan.md       # Current work in progress
├── scratchpad/                    # Temporary working notes
│   └── *_scratchpad.md            # Cleanup regularly
├── logs/                          # Bug reports and gotchas
│   └── <issue>_log.md             # Problems and resolutions
└── case_studies/                  # Project retrospectives
    └── <project>_case_study.md    # Lessons learned
```

---

## Best Practices

### 1. Spec Before Code
- Always generate task spec before implementing
- Specs clarify assumptions and edge cases
- Prevents AI from making wrong guesses

### 2. Test-Driven Development
- Generate tests before implementation
- Run tests (they should fail)
- Implement until tests pass
- Refactor with confidence

### 3. Keep Documentation in Sync
- Update PRD when requirements change
- Update WBS after completing tasks
- Update ADD after architectural changes
- Use scratchpad during conversations

### 4. Use Scratchpads
- Commands create scratchpads automatically
- Persist conversation context across sessions
- Clean up after generating final docs

### 5. Leverage AI Conversations
- Commands guide iterative conversations
- Don't rush to generate final docs
- Explore requirements space thoroughly
- Confirm before finalizing

### 6. Follow the Workflow
- Pre-Development → Development → Post-Development
- Each phase builds on the previous
- Don't skip foundation phases
- Update as reality diverges from plan

### 7. Minimal, Self-Descriptive Code
- Type hints are MANDATORY
- Code should explain itself
- Avoid verbose comments
- Use Pydantic for validation

### 8. UV for Dependencies
- NEVER manually edit pyproject.toml
- Always use `uv add <package>`
- Use `uv sync` to update environment

---

## Common Workflows

### Workflow 1: Brand New Project Idea

```
1. Have project idea
2. /generate-charter
   → Define business case, vision, objectives
3. Review charter, refine as needed
4. /generate-prd
   → Define detailed requirements
5. Review PRD, refine as needed
6. /generate-architecture
   → Design system architecture
7. Review ADD, refine as needed
8. /generate-wbs
   → Break down into tasks
9. /generate-dev-env
   → Document setup
10. Begin development phase (pick first task from WBS)
```

### Workflow 2: Implementing a Feature

```
1. Pick task from WBS
2. /generate-task-spec
   → Create detailed spec
3. /generate-unit-tests
   → Generate tests (TDD)
4. Run tests: uv run pytest tests/unit/ -v
   → Should fail
5. Implement feature following spec
6. Run tests again
   → Should pass
7. /generate-e2e-tests
   → Integration tests
8. Run: uv run pytest tests/integration/ -v
   → Verify end-to-end
9. Move spec to docs/features/
10. /update-wbs
    → Mark task complete
```

### Workflow 3: Requirements Changed

```
1. Identify changed requirements
2. /update-prd
   → Document changes
3. /update-wbs
   → Adjust task breakdown
4. Continue with development workflow
```

### Workflow 4: Major Refactor

```
1. Document reason for refactor in docs/plans/
2. /generate-task-spec
   → Spec the refactoring approach
3. Generate tests to ensure behavior preservation
4. Implement refactor
5. /update-architecture
   → Document architectural changes
6. /update-wbs
   → Update task status
```

### Workflow 5: Project Completion

```
1. Complete all WBS tasks
2. /update-architecture
   → Final architecture documentation
3. /update-charter
   → Document business outcomes
4. /generate-case-study
   → Create comprehensive retrospective
5. Archive project or plan next phase
```

---

## Tips for Success

### Maximize AI Effectiveness
- Read existing code before asking AI to modify
- Provide context through CLAUDE.md files
- Use type hints everywhere (mandatory)
- Keep functions small and focused
- Favor simple over clever

### Documentation Strategy
- Core docs (charter, PRD, ADD, WBS) are foundation
- Specs are written before code
- Features are documented after implementation
- Plans track current work
- Scratchpad is temporary (clean up regularly)
- Logs capture problems and solutions

### Testing Strategy
- Unit tests: isolated component testing
- Integration tests: multi-component workflows (requires Docker)
- Evals: LLM output quality testing
- Run specific test types: `uv run pytest tests/<type>/ -v`

### Git Workflow
- Commit after each completed task
- Include WBS task ID in commit messages
- Keep commits focused and atomic
- Update docs in same commit as code changes

### When Stuck
- Check docs/CLAUDE.md for guidance
- Review existing code patterns in app/
- Use scratchpad to organize thoughts
- Generate task spec to clarify approach
- Ask AI to explain existing code

---

## Environment Setup

### Initial Setup

```bash
# 1. Clone or copy template
git clone <template-url> my-new-project
cd my-new-project

# 2. Set Python version
echo "3.12" > .python-version

# 3. Install UV (if not installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 4. Create virtual environment and install dependencies
uv sync

# 5. Configure environment
cp app/.env.example app/.env
# Edit app/.env with your settings

# 6. Start Docker services
cd docker
./start.sh

# 7. Verify setup
uv run pytest tests/integration/ -v
```

### Daily Development

```bash
# Start services
cd docker && ./start.sh

# Run tests
uv run pytest tests/unit/ -v           # Unit tests
uv run pytest tests/integration/ -v    # Integration tests

# Add dependencies
uv add <package>                       # Production dependency
uv add --dev <package>                 # Development dependency

# Run application
uv run uvicorn app.main:app --reload

# View logs
cd docker && ./logs.sh

# Stop services
cd docker && ./stop.sh
```

---

## Summary

This template and workflow system transforms AI-assisted development from ad-hoc prompting to a structured, repeatable process:

1. **Foundation First** - Establish business vision, requirements, architecture, and task breakdown before coding
2. **Spec-Driven Development** - Write detailed specs before implementation to guide AI effectively
3. **Test-Driven Development** - Generate tests first, implement until they pass
4. **Documentation in Sync** - Keep requirements, architecture, and task tracking current
5. **Iterative Refinement** - Use conversations to explore thoroughly before finalizing
6. **Evidence-Based Updates** - Update docs based on implementation reality, not assumptions
7. **Knowledge Capture** - Generate case studies to transform experience into reusable knowledge

The 15 commands guide you through structured conversations that generate comprehensive documentation at each phase, ensuring AI agents have the context they need to generate high-quality code.

**Start with the project charter and follow the flow. Each document builds on the previous, creating a complete picture of your project from vision to implementation.**
