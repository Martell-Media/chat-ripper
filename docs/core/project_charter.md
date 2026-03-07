# Project Charter: ChatRipper AI

## Executive Summary

ChatRipper AI is an internal Chrome extension that provides Martell Media's revenue team with AI-powered sales reply suggestions. Reps highlight a prospect's message on any platform (LinkedIn, Gmail, Instagram, etc.) and receive an instant, context-aware reply they can copy-paste directly into the conversation. Built during a company hackathon, ChatRipper is now being formalized for managed distribution and ongoing iteration.

## Project Vision

Give Martell Media's SDRs and closers an AI sales co-pilot that generates higher-quality reply suggestions than existing tools (Revio's native co-pilot), grounded in real closed-won DM conversations and proven sales frameworks.

## Business Objectives

| Objective | How We Measure |
|-----------|---------------|
| Improve close rates | Compare close rates before and after adoption |
| Faster prospect response times | Reps spend less time crafting replies |
| Accelerate SDR ramp-up | New SDRs perform at a higher level sooner |
| Outperform Revio co-pilot | Rep preference and output quality feedback |
| Track usage and impact | Observability dashboard linked to closed-won outcomes |

## Stakeholders

| Name | Role | Responsibility |
|------|------|---------------|
| Alfie Loh | Automation Developer | Extension development, GCR backend, distribution, primary support |
| Eric Larocque | Head of Revenue | Project sponsor, adoption champion |
| Chris Rigoudis | Top Closer | Co-developer, owns Railway/n8n backends, sales frameworks, KB curation |
| Adam | SDR/Closer | Early adopter, active user since hackathon |
| Revenue Team | End Users | 2 FTE SDRs + 3.5 FTE closers |

## Competitive Positioning

ChatRipper operates alongside Revio's built-in co-pilot as the preferred AI reply tool for the revenue team. Native Revio integration would be required for full replacement. Key differentiators:

- **Grounded in real data**: Replies are informed by 1,230+ real closed-won DM conversations (KB1) and proven sales frameworks (KB2)
- **Multi-platform**: Works across LinkedIn, Gmail, Instagram, Salesforce, Facebook, X — not locked to one CRM
- **Multiple engines**: Three backend options (deeprip, quickrip, smartrip) offering different speed/depth tradeoffs
- **Full conversation analysis**: "Analyze & Reply" mode scrapes entire conversation threads for deeper context
- **Coaching and roleplay**: Side panel includes coach chat and roleplay modes beyond simple reply generation

## Technical Architecture

### Extension (Chrome MV3)
- Content script: text selection detection, floating action button, inline reply panel
- Side panel: reply display, coach chat, roleplay, conversation scoring
- Popup: enable/disable toggle, engine selection
- Background service worker: message routing, API calls to backends

### Backend Services

| Engine | Service | Owner | Speed |
|--------|---------|-------|-------|
| deeprip | Railway API | Chris Rigoudis | ~8s |
| quickrip | Railway API | Chris Rigoudis | ~4s |
| smartrip | Google Cloud Run | Alfie Loh / Martell Media | ~6s |

Additional services:
- **Coach chat**: n8n webhook (Chris)
- **Roleplay**: n8n webhook (Chris)
- **Closer contacts API**: close.alfredloh.com (Alfie)

### Knowledge Bases
- **KB1**: 1,230+ real closed-won DM conversations. Two versions exist — one owned by Chris (server-side), one by Alfie (with growth planned). Data pipeline in hackathon project: export -> fetch -> classify -> vectorize -> assemble training.
- **KB2**: Sales frameworks and objection handling playbooks. Owned by Chris.

## Scope

### In Scope (Launch)
- Publish extension as unlisted Chrome Web Store listing
- Privacy policy (publicly accessible URL) — required for CWS submission
- Current functionality: text selection replies, analyze & reply, side panel, coach chat, roleplay, scoring
- All three backend engines operational

### In Scope (Post-Launch)
- Graceful degradation: auto-fallback between engines when one fails
- Data privacy policy review (PIPEDA/PIPA compliance) — see `docs/plans/data-privacy-pipeda.md`
- Knowledge base growth (Alfie's version of KB1)
- Feedback-driven feature iteration

### Out of Scope
- Public Chrome Web Store listing
- External/client-facing distribution
- Billing or monetization
- Replacing or modifying Chris's backend services

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Chris dependency — owns 2/3 backends, AI prompts, and KB2 | Medium | High | Discuss ownership/continuity plan with Chris. Smartrip (GCR) is fully Martell-controlled fallback. Build graceful degradation. |
| Hardcoded API key in extension source | Low (unlisted) | Medium | Acceptable for unlisted internal distribution. Must be addressed before any wider distribution. |
| Data privacy gap — prospect PII sent to external backends | Medium | Medium | Fast-follow PIPEDA review. Document data flows. See `docs/plans/data-privacy-pipeda.md`. |
| Backend downtime during sales conversations | Low | Medium | Build engine auto-fallback (graceful degradation). |
| Tight launch timeline (4-5 days) | Medium | Low | Scope limited to CWS listing of current functionality. No new features for launch. |

## Ethical Considerations

ChatRipper generates AI-assisted replies designed to sound like they were written by the rep personally. Prospects are not aware they are interacting with AI-assisted responses. This is consistent with industry-standard practice for sales enablement tools (auto-suggested replies, AI drafting), but the team acknowledges:

- The tool is an **assistant, not a replacement** — reps review and choose to send each reply
- The AI is explicitly trained to match natural human communication patterns
- Reply quality and authenticity are grounded in real sales conversations, not generic templates
- If ChatRipper expands beyond internal use, this stance should be revisited

## Budget

| Item | Owner | Cost |
|------|-------|------|
| Google Cloud Run (smartrip) | Martell Media | Hosting costs (existing infrastructure) |
| Railway + n8n (deeprip, quickrip, coach, roleplay) | Chris Rigoudis | Covered by Chris |
| Chrome Web Store developer registration | Martell Media | $5 one-time |
| Alfie's development time | Martell Media | As-needed based on impact |

## Timeline

| Milestone | Target Date |
|-----------|------------|
| Repo setup and code management | March 5, 2026 (complete) |
| Privacy policy drafted and hosted (GitHub Pages) | March 7-8, 2026 |
| Chrome Web Store unlisted submission | March 9-10, 2026 |
| Team rollout (all reps install) | March 10-11, 2026 |
| Graceful degradation built | TBD (post-launch) |
| PIPEDA/data privacy review | TBD (post-launch fast-follow) |
| KB1 growth (Alfie's version) | Ongoing |

## Support Model

- **Primary support**: Alfie Loh
- **Chris's services (Railway, n8n)**: Escalate to Chris Rigoudis
- **Channel**: TBD (likely Slack)

## Rollout Plan

- Adam already has the extension (sideloaded from hackathon)
- Remaining revenue team members install via Chrome Web Store unlisted link once published
- No phased rollout — all reps get access simultaneously
- Extension UX is self-explanatory (highlight text, get reply); no formal training planned

## Future Considerations

- **Expansion beyond Martell**: Possible but not currently planned. Would require addressing API key security, public privacy policy, and broader ethical review.
- **Feature roadmap**: Feedback-driven. No predefined roadmap — iterate based on rep usage patterns and requests.
- **KB growth**: Alfie's version of KB1 will grow over time, increasing the data advantage of the smartrip engine.
- **Backend consolidation**: Long-term, reducing dependency on three separate services may improve reliability and simplify maintenance.
