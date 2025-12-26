# Common Pitfalls in AI-Assisted Development

Anti-patterns and mistakes to avoid when coding with AI.

## Critical Principle

**AI is a junior developer with perfect syntax but questionable judgment.** Review everything.

---

## General AI-Assisted Development Pitfalls

### 1. "Vibe Coding" - Auto-Accepting Without Review

**Mistake:** Accepting AI-generated code without reading or testing it.

**Why it fails:**
- AI doesn't understand your full context
- AI makes assumptions about requirements
- AI can introduce subtle bugs or security issues
- Code may work but violate project patterns

**Fix:**
- **Always review code line by line** before accepting
- Run tests after AI generates code
- Check that code matches your spec
- Verify it follows existing patterns

**Detection:**
- You don't understand what the code does
- Tests fail after accepting code
- Code style doesn't match project

---

### 2. Insufficient Specifications

**Mistake:** Asking AI to implement without detailed spec.

**Example:**
```
❌ Bad: "Add user authentication"
✅ Good: Run `/generate-task-spec` first, then implement
```

**Why it fails:**
- AI makes wrong assumptions about requirements
- Missing edge cases and error handling
- Inconsistent with existing patterns
- Hard to verify correctness

**Fix:**
- **Always create spec before implementation**
- Use `/generate-task-spec`
- Define data models, interfaces, and edge cases
- Get spec reviewed before coding

**Detection:**
- AI asks clarifying questions during implementation
- Code doesn't handle obvious edge cases
- Implementation doesn't match expectations

---

### 3. Context Window Mismanagement

**Mistake:** Not tracking or managing conversation context.

**Why it fails:**
- AI forgets earlier decisions
- Contradictory suggestions as conversation grows
- Performance degrades with large context
- Expensive token usage

**Fix:**
- Use scratchpad files to persist decisions
- Reference CLAUDE.md files for persistent patterns
- Start new conversation when context is ~70% full
- Summarize key decisions in files, not just chat

**Detection:**
- AI suggests something contradicting earlier discussion
- AI asks questions you already answered
- Responses become slower or less relevant

---

### 4. Testing Gaps - False Confidence

**Mistake:** Trusting AI-generated code works without testing.

**Why it fails:**
- AI can't run code, only simulate
- Edge cases often missed
- Integration issues not caught
- Type hints don't guarantee runtime correctness

**Fix:**
- **Write tests before or with implementation (TDD)**
- Use `/generate-unit-tests`
- Run tests immediately: `uv run pytest tests/ -v`
- Test edge cases manually if needed

**Detection:**
- Code looks correct but fails at runtime
- Works in isolation but breaks integration
- Unhandled edge cases discovered later

---

### 5. Documentation Drift

**Mistake:** Updating code but not updating specs/docs.

**Why it fails:**
- Specs become misleading
- Future AI interactions use stale context
- Team/future you confused about intent
- Technical debt accumulates

**Fix:**
- Update docs in same commit as code
- Use `/update-prd` when requirements change
- Use `/update-wbs` after completing tasks
- Move specs from `docs/specs/` to `docs/features/` after completion

**Detection:**
- Spec says one thing, code does another
- AI suggests outdated patterns
- Confusion about "current" vs "desired" state

---

### 6. Dependency Management Mistakes

**Mistake:** Manually editing `pyproject.toml` instead of using UV.

**Why it fails:**
- Lock file becomes inconsistent
- Version conflicts
- Breaks reproducibility
- Confuses AI about correct dependency management

**Fix:**
- **Always use UV commands:**
  - `uv add <package>` for dependencies
  - `uv add --dev <package>` for dev dependencies
  - `uv remove <package>` to remove
  - `uv sync` to update environment
- Add note in `CLAUDE.md` to remind AI

**Detection:**
- `uv.lock` out of sync with `pyproject.toml`
- Import errors despite package in pyproject.toml
- Version conflicts

---

## Scenario-Specific Pitfalls

### New Project Pitfalls

#### 7. Skipping Pre-Development Phase

**Mistake:** Jumping straight to coding without charter/PRD/architecture.

**Why it fails:**
- Scope creep mid-development
- Architectural regrets
- Missing requirements discovered late
- Wasted rework

**Fix:**
- **Follow the pre-dev workflow:**
  1. `/generate-charter`
  2. `/generate-prd`
  3. `/generate-architecture`
  4. `/generate-wbs`
- Invest 20% of time in planning saves 80% of rework

**Detection:**
- Constantly changing direction
- Refactoring architecture mid-project
- "We should have thought of that earlier"

---

#### 8. Premature Optimization

**Mistake:** Asking AI to optimize before basic functionality works.

**Why it fails:**
- Wasted effort on wrong bottlenecks
- Over-engineered solutions
- Harder to understand and maintain
- Delays shipping value

**Fix:**
- Make it work first (simple implementation)
- Make it right second (tests, refactor)
- Make it fast third (only if needed)
- Profile before optimizing

**Detection:**
- Complex code for simple features
- No performance metrics to justify optimization
- Code hard to understand

---

### Existing Project Pitfalls

#### 9. Insufficient Codebase Reading

**Mistake:** Asking AI to modify code without reading existing patterns.

**Why it fails:**
- New code inconsistent with existing style
- Duplicates existing functionality
- Breaks assumptions in other code
- Violates project conventions

**Fix:**
- **Read before writing:**
  - Use `Read` tool on related files
  - Search for similar patterns with `Grep`
  - Check CLAUDE.md files for patterns
- Ask AI to analyze patterns before suggesting changes

**Detection:**
- Code works but "feels wrong"
- Team feedback: "That's not how we do it"
- Style inconsistencies

---

#### 10. Missing Context from Team

**Mistake:** Not consulting human team members about non-obvious context.

**Why it fails:**
- AI doesn't know business rules not in code
- Unwritten conventions violated
- Historical context missed
- Rework after team review

**Fix:**
- Identify questions AI can't answer
- Ask team before major decisions
- Document answers in CLAUDE.md files
- Use AI for implementation, humans for strategy

**Detection:**
- Team says "we tried that, it doesn't work because..."
- Violations of unwritten rules
- Solutions that ignore business context

---

### Feature Development Pitfalls

#### 11. Pattern Mismatch with Existing Code

**Mistake:** AI uses different patterns than existing codebase.

**Example:**
- Existing code uses Pydantic models
- AI suggests dictionary validation
- Inconsistency creates confusion

**Fix:**
- Show AI examples of existing patterns
- Reference CLAUDE.md for conventions
- Ask AI to match style before implementation
- Review generated code for consistency

**Detection:**
- New code looks different
- Multiple ways to do the same thing
- Increased cognitive load

---

#### 12. Incomplete Edge Case Handling

**Mistake:** Only testing happy path, missing error scenarios.

**Why it fails:**
- Production failures on unexpected input
- Poor user experience
- Data corruption
- Security vulnerabilities

**Fix:**
- **Define edge cases in spec:**
  - What if input is empty?
  - What if input is too large?
  - What if database is unavailable?
  - What if external API fails?
- Generate tests for edge cases
- Ask AI: "What could go wrong?"

**Detection:**
- Works in demo, fails in production
- Error messages not user-friendly
- Crashes instead of graceful degradation

---

### Bug Fix Pitfalls

#### 13. Treating Symptoms, Not Root Cause

**Mistake:** Asking AI to fix error message instead of underlying issue.

**Example:**
```
❌ Bad: "Fix this KeyError"
✅ Good: "Why is this key missing? Trace the data flow."
```

**Why it fails:**
- Bug reappears elsewhere
- Bandaid over real issue
- Accumulates technical debt

**Fix:**
- Ask AI to explain root cause
- Trace data flow to source
- Add tests that would catch root cause
- Fix cause, not symptom

**Detection:**
- Same bug in different place
- Fix feels hacky
- Tests don't cover the actual issue

---

#### 14. Inadequate Testing Post-Fix

**Mistake:** Fixing bug without adding regression test.

**Why it fails:**
- Bug returns in future refactors
- No guarantee fix works
- No documentation of issue

**Fix:**
- **Always add test for fixed bug:**
  1. Write test that reproduces bug (should fail)
  2. Fix the bug
  3. Test should now pass
  4. Commit fix + test together

**Detection:**
- Same bug reported multiple times
- Fear of refactoring (might reintroduce bug)

---

### Refactoring Pitfalls

#### 15. Scope Creep During Refactor

**Mistake:** Refactoring turns into feature addition.

**Why it fails:**
- Refactor takes 10x longer than planned
- Hard to verify correctness
- Mixes concerns in commit history
- Higher risk of breaking changes

**Fix:**
- **Refactor = behavior-preserving transformation**
- No new features during refactor
- Tests should pass before and after
- Separate commits: refactor, then features

**Detection:**
- Refactor PR has feature changes
- Tests need updates for refactor
- Can't easily revert

---

#### 16. Inadequate Test Coverage Before Refactoring

**Mistake:** Refactoring code without existing tests.

**Why it fails:**
- No way to verify behavior unchanged
- Silent breakage
- Fear prevents future refactoring

**Fix:**
- **Add tests first:**
  1. Write tests for current behavior
  2. Ensure tests pass
  3. Refactor
  4. Ensure tests still pass
- Measure coverage: `uv run pytest --cov=app tests/`

**Detection:**
- Not confident refactor worked
- Manual testing required after refactor
- Bugs discovered later

---

## Process Pitfalls

### 17. Skipping Code Review

**Mistake:** Committing AI code without review (even solo projects).

**Why it fails:**
- No second look at quality
- Subtle issues missed
- Learning opportunities lost

**Fix:**
- Review your own code:
  - Read diff before committing
  - Check tests pass
  - Verify security checklist
- Use `git diff` to see changes
- Consider pairing with another AI agent for review

**Detection:**
- Bugs found immediately after commit
- "How did I miss that?"

---

### 18. Inconsistent Git Workflow

**Mistake:** Random commit messages, mixing concerns in commits.

**Why it fails:**
- Hard to understand history
- Difficult to revert changes
- WBS tracking breaks down

**Fix:**
- **Commit strategy:**
  - One task from WBS = one commit
  - Message format: `[WBS-123] Add user authentication`
  - Include spec + tests + code in same commit
- Commit after completing each task

**Detection:**
- Can't find when feature was added
- Reverting one thing breaks another
- Unclear what changed

---

### 19. Not Using Playground for Quick Validation

**Mistake:** Running full app to test small changes.

**Why it fails:**
- Slow feedback loop
- Debugging harder in full app
- Wastes time

**Fix:**
- **Use playground/ for quick tests:**
  ```python
  # playground/test_feature.py
  from app.services.my_service import my_function

  result = my_function(test_input)
  print(result)
  ```
- Fast iteration before integration

**Detection:**
- Restarting Docker frequently
- Long debug cycles
- Simple bugs take long to fix

---

### 20. Overcomplicating Simple Problems

**Mistake:** Asking AI for complex solutions to simple problems.

**Why it fails:**
- Premature abstraction
- Hard to understand and maintain
- Violates YAGNI (You Aren't Gonna Need It)

**Fix:**
- **Simple first:**
  - Solve with basic Python first
  - Refactor when pattern emerges
  - Three uses before abstraction
- Ask AI: "What's the simplest way?"

**Detection:**
- Code feels over-engineered
- Helper functions used once
- Deep inheritance/abstraction

---

## LLM-Specific Pitfalls

### 21. Blindly Trusting LLM Outputs

**Mistake:** Using LLM-generated content without validation.

**Why it fails:**
- LLMs hallucinate
- Outputs may be harmful/incorrect
- No guarantees on quality

**Fix:**
- **Always validate LLM outputs:**
  - Check format (JSON schema, Pydantic)
  - Verify content makes sense
  - Sanitize before using
  - Add fallbacks for failures
- Use evals/ tests for quality

**Detection:**
- Nonsensical responses in production
- Security issues from unvalidated content

---

### 22. Not Handling LLM Failures Gracefully

**Mistake:** No fallback when LLM API fails.

**Why it fails:**
- App crashes on API timeout
- Poor user experience
- Cascading failures

**Fix:**
- Add error handling for LLM calls:
  ```python
  try:
      response = llm_client.complete(prompt)
      return validate_response(response)
  except Exception as e:
      logger.error(f"LLM error: {e}")
      return fallback_response()
  ```

---

## Detection Checklist

**Signs you're falling into pitfalls:**

- [ ] You don't understand the AI-generated code
- [ ] Tests failing after accepting code
- [ ] Same bugs appearing multiple times
- [ ] Documentation doesn't match code
- [ ] Team confused by your changes
- [ ] Constant refactoring/rewriting
- [ ] Afraid to change code (might break something)
- [ ] Copy-pasting code without reading
- [ ] Skipping test writing
- [ ] Inconsistent code style
- [ ] Long debugging sessions
- [ ] Scope creeping during tasks

**If 3+ are true, slow down and review your process.**

---

## Recovery Strategies

**When you realize you've made a mistake:**

1. **Stop and assess:** What went wrong? Why?
2. **Don't compound:** Don't try to fix with more AI code
3. **Review the spec:** Does it exist? Is it accurate?
4. **Add tests:** Write test that would catch the issue
5. **Fix properly:** Address root cause, not symptom
6. **Document lesson:** Add to CLAUDE.md or this file
7. **Update process:** What will prevent this next time?

---

## Prevention Strategies

**Build these habits:**

1. **Spec before code** - Always
2. **Tests with code** - TDD when possible
3. **Review before commit** - Always read diff
4. **Update docs with code** - Same commit
5. **Small commits** - One task at a time
6. **Read existing code** - Before modifying
7. **Validate AI output** - Never auto-accept
8. **Use playground** - Quick validation
9. **Ask "what could go wrong?"** - Before implementation
10. **Trust your instincts** - If it feels wrong, investigate

---

## See Also

- [Security Guide](SECURITY_GUIDE.md) - Security-specific pitfalls
- [Getting Started](../GETTING_STARTED.md) - Correct workflows
- [AI-Assisted Development Guide](AI_ASSISTED_DEVELOPMENT_GUIDE.md) - Methodology
