# Quick Start Guide for Spec-Driven Development

## Which Command Do I Need?

This guide helps you quickly identify which AI command to use based on your current situation. Each section provides clear decision paths and practical examples.

## Decision Trees

### Starting a New Project

When you have a new idea or project to build, follow this sequence:

```
New Project Idea
    ↓
/01_pre_dev:01_generate_project_charter → Define business vision and objectives
    ↓
/01_pre_dev:02_generate_prd → Detail product requirements and user stories
    ↓
/01_pre_dev:03_generate_architecture_design → Design system architecture
    ↓
/01_pre_dev:04_generate_wbs → Break down work into tasks
    ↓
/02_dev:generate_task_spec → Create detailed specifications
    ↓
Implement with AI using specifications
```

### Working on Existing Projects

When you're working with existing code, your path depends on what you need to do:

```
Existing Project
    ├─> Adding New Feature
    │   ├─> Request PRD from Product Management
    │   ├─> Request WBS from Engineering Lead
    │   ├─> /02_dev:generate_task_spec to specify the feature
    │   ├─> Implement using specification
    │   └─> /02_dev:update_wbs to track completion
    │
    ├─> Major Change/Refactor
    │   ├─> Ensure PRD reflects changes needed
    │   ├─> /03_post_dev:update_add if architecture changes
    │   ├─> /02_dev:update_wbs to revise tasks
    │   └─> Implement changes
    │
    └─> Bug Fix/Maintenance
        ├─> Read existing documentation
        ├─> Fix the issue
        └─> Update documentation if needed
```

### At Project Milestones

Different milestones require different updates:

```
Project Milestone
    ├─> Sprint End
    │   ├─> /02_dev:update_wbs to sync tasks with reality
    │   └─> /02_dev:update_prd if scope changed
    │
    ├─> Major Feature Complete
    │   ├─> /03_post_dev:update_add if architecture evolved
    │   └─> Update relevant CLAUDE.md files
    │
    └─> Project Complete
        └─> /03_post_dev:update_project_charter for business outcomes
```

## Essential Command Patterns

### Pattern 1: Greenfield MVP Development

Building a new minimum viable product follows a structured flow. Here's the complete process:

#### Step 1: Define Business Vision

```bash
/01_pre_dev:01_generate_project_charter "Building a customer support automation platform for small businesses"
```

The AI will engage you in consultation about business objectives, target market, success metrics, and constraints. This creates `docs/core/project_charter.md`.

#### Step 2: Detail Requirements

```bash
/01_pre_dev:02_generate_prd "Based on the project charter, create detailed product requirements"
```

Building on the charter, the AI helps define user personas, user journeys, functional requirements, and acceptance criteria. This creates `docs/core/prd.md`.

#### Step 3: Design Architecture

```bash
/01_pre_dev:03_generate_architecture_design "Design system architecture for the requirements in the PRD"
```

The AI consults on technical architecture, helping you make decisions about system topology, technology stack, and integration patterns. This creates `docs/core/add.md`.

#### Step 4: Break Down Work

```bash
/01_pre_dev:04_generate_wbs "Create work breakdown structure from the architecture design"
```

Transform architecture into actionable tasks with complexity ratings and dependencies. This creates `docs/core/wbs.md`.

#### Step 5: Development Loop

```bash
# For each task in WBS:
/02_dev:generate_task_spec "Create specification for user authentication feature"
# Implement using the specification
/02_dev:update_wbs "Update based on last 10 commits"
```

Continue this loop until all tasks are complete.

### Pattern 2: Adding a Feature to Existing Project

When adding new functionality to an existing system, you need targeted specifications that respect existing patterns.

#### Step 1: Understand Current State

```bash
# Read existing documentation
cat docs/core/prd.md
cat docs/core/wbs.md
# Read relevant CLAUDE.md files
cat CLAUDE.md  # Project-wide patterns
cat docs/CLAUDE.md  # Documentation guidelines
```

#### Step 2: Specify New Feature

```bash
/02_dev:generate_task_spec "Add real-time notifications feature to existing chat system"
```

The AI extracts context from existing documentation and helps specify the feature within current constraints.

#### Step 3: Implement and Track

```bash
# Implement using specification
# Then update tracking:
/02_dev:update_wbs "Update based on notification feature implementation"
```

#### Step 4: Update Requirements if Needed

```bash
# If scope expanded:
/02_dev:update_prd "Update requirements based on notification feature additions"
```

### Pattern 3: Architecture Evolution

When implementation reveals the need for architectural changes, document them properly.

#### Step 1: Implement Changes

Make your architectural changes based on discovered requirements or constraints.

#### Step 2: Document Evolution

```bash
/03_post_dev:update_add "Analyze and document architecture changes"
```

The AI analyzes your codebase, detects architectural patterns, and asks about the rationale for changes.

#### Step 3: Update Context

Update relevant CLAUDE.md files with insights about the new architecture, focusing on non-obvious behaviors and integration patterns.

### Pattern 4: Project Retrospective

At major milestones or project completion, update high-level documentation.

```bash
# At sprint end:
/02_dev:update_wbs "Update based on last 2 weeks of work"

# At major milestone:
/03_post_dev:update_add "Document architecture evolution"

# At project completion:
/03_post_dev:update_project_charter "Update with business outcomes and lessons learned"
```

## Common Scenarios

### Scenario: "I inherited a project with no documentation"

First, understand what exists:

```bash
# Analyze project structure
find . -type f -name "*.md" | grep -E "(README|DESIGN|ARCHITECTURE|API)"

# Look for any documentation
ls -la docs/ wiki/ documentation/ 2>/dev/null

# Check project management tools
echo "Check Jira, Confluence, or similar for requirements"
```

Then gather or create essential documentation:

```bash
# Request from team:
echo "1. Ask Product Management for PRD"
echo "2. Ask Engineering Lead for Architecture docs"
echo "3. Ask Project Management for WBS/roadmap"

# If you must create documentation:
# Generate architecture from code (if no ADD exists)
/03_post_dev:update_add "Analyze existing system architecture"

# Create WBS for your planned work (always needed)
/01_pre_dev:04_generate_wbs "Create task breakdown for planned feature additions"

# Create implementation specs (always do this yourself)
/02_dev:generate_task_spec "Create detailed spec for [specific feature]"
```

Remember: Don't create a PRD unless you're the Product Owner. Request it from the appropriate stakeholders.

### Scenario: "My requirements keep changing"

Use update commands to track evolution systematically:

```bash
# When requirements change:
/02_dev:update_prd "Update based on new customer feedback about search functionality"

# Revise tasks:
/02_dev:update_wbs "Adjust tasks based on PRD changes"

# Track the impact:
/03_post_dev:update_add "Document any architectural impacts from requirement changes"
```

### Scenario: "AI keeps making wrong assumptions"

Create more specific specifications:

```bash
# Instead of vague requests:
/02_dev:generate_task_spec "Create detailed specification for user authentication using OAuth2 with Google provider only, no email/password option"

# Use existing patterns:
cat app/auth/CLAUDE.md  # Understand current auth patterns first
```

### Scenario: "I need to onboard a new developer"

Point them to documentation in order:

```bash
# Business context:
cat docs/core/project_charter.md

# What we're building:
cat docs/core/prd.md

# How it's built:
cat docs/core/add.md

# Work status:
cat docs/core/wbs.md

# Implementation details:
find . -name "CLAUDE.md" -type f
```

## Command Quick Reference

### Pre-Development Commands

These commands create initial documentation through intelligent consultation:

- `/01_pre_dev:01_generate_project_charter [business idea]` - Creates business vision and objectives
- `/01_pre_dev:02_generate_prd [based on charter]` - Creates detailed product requirements  
- `/01_pre_dev:03_generate_architecture_design [based on PRD]` - Creates system architecture
- `/01_pre_dev:04_generate_wbs [based on architecture]` - Creates task breakdown

### Development Commands

These commands support active development:

- `/02_dev:generate_task_spec [feature description]` - Creates detailed implementation specification
- `/02_dev:generate_prompt [use case]` - Creates reusable LLM prompts
- `/02_dev:generate_unit_tests [specification]` - Generates focused unit tests

### Update Commands

These commands maintain documentation accuracy through intelligent analysis:

- `/02_dev:update_wbs [last N commits or days]` - Updates task status and complexity
- `/02_dev:update_prd [reason for update]` - Updates requirements based on discoveries
- `/03_post_dev:update_add [after implementation]` - Updates architecture documentation
- `/03_post_dev:update_project_charter [at completion]` - Updates business outcomes

## Tips for Success

### Start with Clear Business Objectives

Every technical decision should trace back to a business objective. The Project Charter isn't bureaucracy. It's your north star that keeps development aligned with business value.

### Let Specifications Guide Implementation

Don't implement first and document later. Create specifications that guide implementation. This ensures AI generates code that matches your intent.

### Update Regularly, Not Retrospectively

Run `/02_dev:update_wbs` every few days during active development. This catches drift early when it's easy to address. Waiting until sprint end makes updates harder and less accurate.

### Focus CLAUDE.md on Non-Obvious Insights

When updating CLAUDE.md files, document what surprised you or caused bugs. Skip obvious information that anyone can understand from reading code.

### Use Evidence-Based Updates

Let update commands analyze first, then answer their specific questions. This produces better documentation than trying to remember what changed and why.

## Getting Help

If you're unsure which command to use, start with these questions:

1. Am I starting something new? Use generation commands in sequence.
2. Am I changing something existing? Use update commands to track changes.
3. Am I implementing a specific feature? Use `/02_dev:generate_task_spec` for clear specifications.
4. Am I at a milestone? Use update commands to sync documentation with reality.

Remember that Spec-Driven Development is about maintaining control over AI-assisted development. When in doubt, create a specification. When things change, update documentation. When you discover insights, document them in CLAUDE.md. This systematic approach ensures your project remains coherent and understandable as it grows.