# Claude Code Commands Reference

Quick reference for all available commands in this template.

## Usage

In Claude Code, invoke commands using the Skill tool:
```
Skill: <command-name>
```

Example:
```
Skill: 01_pre_dev:01_generate_project_charter
```

---

## Command Categories

### Pre-Development (Business Foundation)
Commands to establish project foundation before coding.

### Development (Implementation)
Commands to support feature development and testing.

### Post-Development (Documentation & Retrospective)
Commands to capture outcomes and lessons learned.

---

## Pre-Development Commands

### `01_pre_dev:01_generate_project_charter`
**Purpose:** Define business vision, objectives, and success criteria

**Creates:**
- `docs/scratchpad/project_charter_scratchpad.md` (during conversation)
- `docs/core/project_charter.md` (final output)

**Use when:**
- Starting a new project idea
- Defining business case
- Seeking stakeholder approval

**Explores:**
- Project vision and purpose
- Business objectives and KPIs
- Stakeholder identification
- Market analysis and competitive landscape
- Resource constraints and timeline
- Initial risk assessment
- Revenue model and business strategy
- Ethical considerations

**Interactive:** Yes - guides iterative conversation to explore business requirements

---

### `01_pre_dev:02_generate_prd`
**Purpose:** Transform business objectives into detailed product requirements

**Creates:**
- `docs/scratchpad/prd_scratchpad.md` (during conversation)
- `docs/core/prd.md` (final output)

**Use when:**
- Project charter is finalized
- Ready to define what to build

**Explores:**
- Product overview and objectives
- User personas with goals and scenarios
- User journeys and workflows
- Functional requirements (features)
- Non-functional requirements (performance, security, usability)
- Data requirements and relationships
- Interface requirements
- Constraints and assumptions
- Acceptance criteria
- Prioritization (must-have vs nice-to-have)
- Edge cases and error scenarios

**Interactive:** Yes - methodical conversation to define all requirement dimensions

---

### `01_pre_dev:03_generate_architecture_design`
**Purpose:** Design system architecture to fulfill product requirements

**Creates:**
- `docs/scratchpad/add_scratchpad.md` (during conversation)
- `docs/core/add.md` (final output)

**Use when:**
- PRD is complete
- Ready to make technology decisions

**Explores:**
- System components and responsibilities
- Technology stack selection and rationale
- Data architecture and schemas
- API design and integration points
- Infrastructure and deployment strategy
- Security architecture
- Scalability considerations
- Technical risks and mitigation strategies

**Interactive:** Yes - guides architectural decision-making process

---

### `01_pre_dev:04_generate_wbs`
**Purpose:** Break down architecture into concrete, implementable tasks

**Creates:**
- `docs/scratchpad/wbs_scratchpad.md` (during conversation)
- `docs/core/wbs.md` (final output)

**Use when:**
- Architecture is defined
- Ready to plan implementation sequence

**Explores:**
- Hierarchical task breakdown
- Task dependencies and sequencing
- Effort estimates and complexity ratings
- Sprint/iteration planning
- Critical path identification
- Resource allocation
- Risk-adjusted timelines

**Interactive:** Yes - collaborative task planning and estimation

---

### `01_pre_dev:05_generate_dev_environment_guide`
**Purpose:** Document setup for development, testing, and deployment environments

**Creates:**
- `docs/scratchpad/dev_env_scratchpad.md` (during conversation)
- `docs/core/dev_environment_guide.md` (final output)

**Use when:**
- WBS is complete
- Ready to start development

**Explores:**
- Local development setup
- Required tools and versions
- Environment variable configuration
- Database setup and migrations
- Docker container setup
- Testing environment configuration
- CI/CD pipeline setup
- Deployment procedures

**Interactive:** Yes - ensures comprehensive environment documentation

---

## Development Commands

### `02_dev:generate_task_spec`
**Purpose:** Create detailed implementation spec for a feature before coding

**Creates:**
- `docs/specs/<feature>_spec.md`

**Use when:**
- Starting work on a WBS task
- Before writing any code

**Includes:**
- Context (current state vs desired state)
- Data models and types (Pydantic examples)
- Interfaces and contracts (function signatures)
- Implementation plan and steps
- Key algorithms and logic
- Error handling strategy
- Testing requirements
- Edge cases and constraints
- Open questions

**Workflow:**
1. Generate spec
2. Review and refine
3. Implement following spec
4. Move to `docs/features/` after completion

---

### `02_dev:generate_prompt`
**Purpose:** Create structured, production-ready prompts for LLM integrations

**Creates:**
- Prompt template (location determined during generation)

**Use when:**
- Building features with LLM API calls
- Need structured prompt design

**Includes:**
- Role definition (specialist identity)
- Purpose and capabilities
- Step-by-step task description
- Classification/strategy criteria
- Examples (typical and edge cases)
- Output format specifications
- Input validation and guardrails

**Best for:** AI workflows, agent systems, LLM-powered features

---

### `02_dev:generate_unit_tests`
**Purpose:** Create unit tests for isolated components

**Creates:**
- Tests in `tests/unit/`

**Use when:**
- Before implementation (Test-Driven Development)
- During implementation
- After implementation (ensure coverage)

**Generates:**
- Test fixtures and setup
- Individual function/method tests
- Edge case coverage
- Error handling tests
- Mock dependencies
- Assertion patterns

**TDD Workflow:**
1. Generate task spec
2. Generate unit tests
3. Run tests (should fail)
4. Implement code
5. Run tests (should pass)
6. Refactor with confidence

---

### `02_dev:generate_e2e_tests`
**Purpose:** Create integration tests for complete workflows

**Creates:**
- Tests in `tests/integration/`

**Use when:**
- After implementing multi-component features
- Need to verify end-to-end workflows

**Generates:**
- API endpoint tests
- Database integration tests
- Multi-component workflow tests
- Error scenario tests
- Performance validation

**Requirements:**
- Docker must be running for database tests
- Run with: `uv run pytest tests/integration/ -v`

---

### `02_dev:update_prd`
**Purpose:** Keep product requirements in sync with implementation reality

**Updates:**
- `docs/core/prd.md` (with version tracking)

**Use when:**
- Requirements change during development
- New requirements discovered
- Scope changes occur
- After completing major features

**Documents:**
- Requirement changes and rationale
- Updated acceptance criteria
- Scope changes
- Requirements traceability

**Why it matters:** Prevents documentation drift, maintains single source of truth

---

### `02_dev:update_wbs`
**Purpose:** Track task completion, complexity changes, and timeline adjustments

**Updates:**
- `docs/core/wbs.md` (with progress tracking)

**Use when:**
- After completing each task
- When discovering new subtasks
- When complexity differs from estimates
- During sprint retrospectives

**Documents:**
- Completed tasks
- Adjusted effort estimates
- Blockers and resolutions
- Updated dependencies
- Re-prioritized work

**Why it matters:** Provides progress visibility, informs future estimates

---

## Post-Development Commands

### `03_post_dev:update_add`
**Purpose:** Document architectural decisions and changes from implementation

**Updates:**
- `docs/core/add.md` (with implementation insights)

**Use when:**
- After major architectural changes
- Discovering better patterns during development
- At project milestones or completion

**Documents:**
- Actual architecture vs planned
- Architectural decision records (ADRs)
- Updated component diagrams
- Technical debt
- Lessons learned

**Why it matters:** Keeps architecture documentation accurate for future work

---

### `03_post_dev:update_project_charter`
**Purpose:** Document business outcomes, lessons learned, and strategic insights

**Updates:**
- `docs/core/project_charter.md` (with retrospective)

**Use when:**
- At project completion
- At major milestones
- When pivoting strategy

**Documents:**
- Actual outcomes vs objectives
- Business metrics achieved
- Strategic lessons learned
- Success factors and challenges
- Updated risk assessment with outcomes

**Why it matters:** Captures business value delivered, informs future projects

---

### `03_post_dev:generate_case_study`
**Purpose:** Create comprehensive project retrospective and knowledge artifact

**Creates:**
- `docs/case_studies/<project>_case_study.md`

**Use when:**
- At project completion
- Documenting significant features
- For portfolio/knowledge sharing

**Includes:**
- Executive summary
- Problem statement and solution overview
- Technical approach and architecture
- Challenges faced and solutions
- Results and metrics
- Lessons learned and best practices
- Recommendations for similar projects

**Why it matters:** Transforms experience into reusable knowledge

---

## Legacy Command

### `generate-spec`
**Purpose:** Original task spec generator (superseded by `02_dev:generate_task_spec`)

**Note:** Use `02_dev:generate_task_spec` for new projects. This is kept for backward compatibility.

---

## Command Decision Tree

```
Starting new project?
├─ Yes → 01_pre_dev:01_generate_project_charter
│        └─ Then → 01_pre_dev:02_generate_prd
│                  └─ Then → 01_pre_dev:03_generate_architecture_design
│                             └─ Then → 01_pre_dev:04_generate_wbs
│                                        └─ Then → 01_pre_dev:05_generate_dev_environment_guide
│
└─ No → What are you doing?
        ├─ Implementing feature → 02_dev:generate_task_spec
        │                         └─ Then → 02_dev:generate_unit_tests
        │                                    └─ Code → 02_dev:generate_e2e_tests
        │
        ├─ Building AI feature → 02_dev:generate_task_spec
        │                        └─ Then → 02_dev:generate_prompt
        │                                   └─ Then → 02_dev:generate_unit_tests
        │                                              └─ Code → 02_dev:generate_e2e_tests
        │
        ├─ Requirements changed → 02_dev:update_prd
        │                         └─ Then → 02_dev:update_wbs
        │
        ├─ Completed task → 02_dev:update_wbs
        │
        ├─ Architecture changed → 03_post_dev:update_add
        │
        ├─ Project complete → 03_post_dev:update_add
        │                     └─ Then → 03_post_dev:update_project_charter
        │                                └─ Then → 03_post_dev:generate_case_study
        │
        └─ Just coding? → Remember: Spec before code!
                          Use 02_dev:generate_task_spec first
```

---

## Quick Patterns

### Pattern: New Project (Complete)
```
1. Skill: 01_pre_dev:01_generate_project_charter
2. Skill: 01_pre_dev:02_generate_prd
3. Skill: 01_pre_dev:03_generate_architecture_design
4. Skill: 01_pre_dev:04_generate_wbs
5. Skill: 01_pre_dev:05_generate_dev_environment_guide
6. Begin development (see Pattern: Feature Development)
```

### Pattern: Feature Development (TDD)
```
1. Pick task from WBS
2. Skill: 02_dev:generate_task_spec
3. Skill: 02_dev:generate_unit_tests
4. Run tests (should fail): uv run pytest tests/unit/ -v
5. Implement feature following spec
6. Run tests (should pass): uv run pytest tests/unit/ -v
7. Skill: 02_dev:generate_e2e_tests
8. Run integration tests: uv run pytest tests/integration/ -v
9. Skill: 02_dev:update_wbs (mark complete)
```

### Pattern: AI Feature Development
```
1. Pick task from WBS
2. Skill: 02_dev:generate_task_spec
3. Skill: 02_dev:generate_prompt
4. Skill: 02_dev:generate_unit_tests (with mocked LLM)
5. Create evals in tests/evals/ for LLM quality
6. Implement feature
7. Skill: 02_dev:generate_e2e_tests
8. Skill: 02_dev:update_wbs
```

### Pattern: Requirements Changed
```
1. Skill: 02_dev:update_prd (document changes)
2. Skill: 02_dev:update_wbs (adjust tasks)
3. Continue development
```

### Pattern: Major Refactor
```
1. Skill: 02_dev:generate_task_spec (refactor approach)
2. Skill: 02_dev:generate_unit_tests (preserve behavior)
3. Implement refactor
4. Skill: 03_post_dev:update_add (architecture changes)
5. Skill: 02_dev:update_wbs (track completion)
```

### Pattern: Project Completion
```
1. Complete all WBS tasks
2. Skill: 03_post_dev:update_add
3. Skill: 03_post_dev:update_project_charter
4. Skill: 03_post_dev:generate_case_study
```

---

## Tips

### Command Usage
- Commands are conversational agents, not templates
- Answer questions thoughtfully to get better output
- Use scratchpads to persist context across sessions
- Don't rush - explore thoroughly before finalizing

### Documentation Flow
- Core docs (charter, PRD, ADD, WBS) → rarely change
- Specs → written before implementation
- Features → written after implementation
- Plans → active work in progress
- Scratchpad → temporary (clean up regularly)
- Logs → problems and resolutions

### Integration with Claude Code
- Commands appear as skills in Claude Code
- Invoke using: `Skill: <command-name>`
- Commands have access to project context
- Follow command guidance - they're domain experts

### When in Doubt
- Start with project charter if new project
- Start with task spec if implementing feature
- Check GETTING_STARTED.md for workflows
- Use decision tree above to navigate

---

## See Also

- `docs/GETTING_STARTED.md` - Complete workflow guide with examples
- `docs/CLAUDE.md` - Document placement guidelines
- `CLAUDE.md` (root) - AI development philosophy
- `tests/CLAUDE.md` - Testing guidelines
