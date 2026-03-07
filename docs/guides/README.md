# Guides

Comprehensive guides for AI-assisted development.

## Available Guides

### [COMMON_PITFALLS.md](COMMON_PITFALLS.md)
**Anti-patterns and mistakes to avoid**

22 common pitfalls organized by scenario:
- General AI-assisted development mistakes
- Scenario-specific pitfalls (new projects, existing code, features, bugs, refactoring)
- Process pitfalls
- LLM-specific issues
- Detection checklist and recovery strategies

**Use when:** Preventing mistakes, debugging issues, improving process

---

### [QUICK_START.md](QUICK_START.md)
**Decision trees and command patterns for common scenarios**

Essential quick reference with:
- Decision trees for different project types (greenfield MVP, existing projects, major milestones)
- Command selection guidance
- Common scenarios with specific solutions
- Quick reference table

**Use when:** Need to quickly decide which commands to run for your scenario

---

### [AI_ASSISTED_DEVELOPMENT_GUIDE.md](AI_ASSISTED_DEVELOPMENT_GUIDE.md)
**Comprehensive methodology and philosophy**

Deep dive into spec-driven development:
- Why spec-driven development matters
- The problem with unguided AI coding
- Control system explanation
- Evidence-based decision making
- Working with existing projects (brownfield)
- Documentation strategy

**Use when:** Understanding the methodology behind spec-driven development

---

### [CLAUDE_MD_USAGE.md](CLAUDE_MD_USAGE.md)
**CLAUDE.md integration patterns and best practices**

Complete guide to CLAUDE.md files:
- What CLAUDE.md is and why it matters
- Hierarchy and file placement
- When to read CLAUDE.md during workflows
- What to document (non-obvious behaviors, patterns, gotchas)
- Integration with command lifecycle
- Examples and patterns

**Use when:** Creating or maintaining CLAUDE.md files in your project

---

### [genai_launchpad_workflow_architecture.md](../examples/genai_launchpad_workflow_architecture.md)
**DAG-based workflow orchestration framework patterns (Reference Architecture)**

Architecture guide for building AI-powered processing pipelines:
- TaskContext pattern for state management
- WorkflowSchema for type-safe workflows
- NodeConfig for DAG node configuration
- Agent, Concurrent, and Router node patterns
- Workflow validation and execution patterns

**Note:** This is a reference architecture example for systems you might build on this project.

**Use when:** Building AI pipelines, workflow systems, or DAG-based architectures

---

### [SPEC_DRIVEN_DEVELOPMENT_PRESENTATION.md](SPEC_DRIVEN_DEVELOPMENT_PRESENTATION.md)
**Presentation-ready overview of spec-driven development methodology**

21-slide format covering the complete workflow:
- Why spec-driven development matters
- The specification cascade (Charter→PRD→Architecture→WBS→Tasks)
- Command flow with examples
- CLAUDE.md best practices
- Visual organization for training/onboarding

**Use when:** Onboarding new team members, presenting methodology, training sessions

---

## Guide Selection

**Getting started?**
1. Start with QUICK_START.md for immediate action
2. Read AI_ASSISTED_DEVELOPMENT_GUIDE.md to understand why
3. Reference CLAUDE_MD_USAGE.md when working with context files

**Starting a new project?**
- Use QUICK_START.md decision trees
- Follow the greenfield MVP workflow

**Working with existing code?**
- Check AI_ASSISTED_DEVELOPMENT_GUIDE.md brownfield section
- Use "request documentation" approach

**Need to document patterns?**
- Read CLAUDE_MD_USAGE.md for what to capture
- Create CLAUDE.md files at appropriate levels

---

## See Also

- [Commands Reference](../../.claude/COMMANDS.md) - All available commands
- [Templates](../templates/README.md) - Document templates
