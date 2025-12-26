# Templates

Document templates for structured development.

## Available Templates

### [specs_template.md](specs_template.md)
**Engineering specification template**

Complete structure for feature specifications:
- **Context:** Current state vs desired outcome
- **Data Models & Types:** Pydantic schema examples
- **Interfaces & Contracts:** Function signatures and APIs
- **Implementation Plan:** Step-by-step subtasks with order
- **Key Algorithms & Logic:** Pseudocode and design patterns
- **Error Handling:** Strategy and edge cases
- **Testing Requirements:** Given/When/Then format
- **Edge Cases & Constraints:** Boundary conditions
- **Open Questions:** Unresolved decisions

**Use when:**
- Running `/generate-task-spec`
- Manually creating feature specifications
- Need consistent spec structure

**Workflow:**
1. Copy template to `docs/specs/<feature>_spec.md`
2. Fill in each section before coding
3. Review and refine with stakeholders
4. Implement following the spec
5. Move to `docs/features/` after completion

---

### [prompt_template.md](prompt_template.md)
**LLM prompt template specification**

Comprehensive prompt engineering structure:
- **Role:** Specialist identity and expertise definition
- **Purpose:** Mission statement and capabilities
- **Task Description:** Step-by-step process flow
- **Classification/Strategy:** Decision criteria and routing logic
- **Examples:** Typical inputs, edge cases, error scenarios
- **Output Format:** Strict formatting rules and structure
- **Task Input:** Runtime data and validation guardrails

**Use when:**
- Running `/generate-prompt`
- Building LLM-powered features
- Need structured prompt design

**Best Practices:**
- Define clear role with specific expertise
- Provide concrete examples for each case type
- Specify exact output format (JSON, markdown, etc.)
- Include validation rules and constraints
- Test with edge cases

**Workflow:**
1. Copy template for your prompt use case
2. Define role and capabilities
3. Detail task process step-by-step
4. Add examples (at least 3: typical, edge, error)
5. Specify output format precisely
6. Test and iterate

---

## Template Usage Patterns

### For Feature Development
```
1. Use specs_template.md for implementation planning
2. Fill in all sections before coding
3. Review with AI or team
4. Implement following the spec
5. Update spec if implementation diverges
```

### For AI Feature Development
```
1. Use specs_template.md for overall feature
2. Use prompt_template.md for LLM integration
3. Generate unit tests with mocked LLM responses
4. Create evals in tests/evals/ for quality
5. Implement and iterate
```

### For Documentation
```
1. Specs go in docs/specs/ (before implementation)
2. Move to docs/features/ after completion
3. Add usage examples and patterns
4. Keep prompts versioned if they evolve
```

---

## Template Customization

**Adapt templates for your domain:**
- Add sections specific to your use case
- Remove sections that don't apply
- Maintain consistency across team

**Version control:**
- Keep templates in this directory
- Document changes to template structure
- Ensure all team members use latest version

**Integration with commands:**
- Commands may reference these templates
- Use as structure for manual documentation
- Maintain alignment with command outputs

---

## See Also

- [Getting Started](../GETTING_STARTED.md) - Workflow guide
- [Commands Reference](../../.claude/COMMANDS.md) - Command usage
- [Guides](../guides/README.md) - Methodology guides
