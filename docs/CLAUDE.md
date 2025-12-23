# Documentation Guidelines

Where to put documents during the development workflow.

## Document Placement

| Document Type | Location | When |
|--------------|----------|------|
| Project charter | `docs/core/charter.md` | Project start |
| PRD | `docs/core/prd.md` | Project start |
| Architecture | `docs/core/architecture.md` | Project start |
| Work breakdown | `docs/core/wbs.md` | Project start |
| Task spec | `docs/specs/<feature>_spec.md` | Before coding |
| Feature doc | `docs/features/<feature>.md` | After coding |
| Active plan | `docs/plans/<plan>.md` | During development |
| Working notes | `docs/scratchpad/<topic>.md` | Anytime (temporary) |
| Issues/bugs | `docs/logs/<issue>.md` | When discovered |

## Folder Purposes

**Core** (`docs/core/`):
- High-level project documents
- Rarely change after initial creation
- Reference for understanding project scope

**Specs** (`docs/specs/`):
- Written BEFORE implementation
- Detailed task breakdown
- Acceptance criteria
- Delete or archive after feature complete

**Features** (`docs/features/`):
- Written AFTER implementation
- Document how the feature works
- API references, usage examples

**Plans** (`docs/plans/`):
- Active development plans
- Multi-step implementation guides
- Remove when complete

**Scratchpad** (`docs/scratchpad/`):
- Temporary working notes
- Research, experiments, drafts
- Clean up regularly

**Logs** (`docs/logs/`):
- Bug reports and fixes
- AI struggles and solutions
- Gotchas and learnings
