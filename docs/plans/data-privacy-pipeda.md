# Data Privacy - PIPEDA Considerations

## Context
ChatRipper AI Chrome extension sends prospect sales conversations (containing PII) to three external backends for AI processing. Martell Media operates in British Columbia, Canada.

## Applicable Legislation

### PIPEDA (Federal)
Personal Information Protection and Electronic Documents Act governs how Canadian businesses handle personal information in commercial activities.

**Key principles:**
- **Consent** - Prospects didn't consent to having their messages sent to AI backends. For an internal tool, this falls under "reasonable business use," but should be monitored.
- **Limiting collection** - Only collect what's needed. The "Analyze & Reply" mode scrapes full pages, which could pull in more than necessary.
- **Retention** - Are conversations stored on any of the three backends, or processed and discarded? Big difference legally.
- **Safeguards** - Data in transit (HTTPS, which we have) and at rest.

### PIPA (Provincial - BC)
British Columbia's Personal Information Protection Act may layer on top of PIPEDA depending on Martell Media's corporate structure.

## Action Items

1. **Data flow documentation** - Map exactly what data goes where (GCR, Railway, n8n) and what gets stored vs. discarded after processing
2. **No conversation logging by default** - If backends aren't storing conversations, document that. If they are, decide if they should be.
3. **Internal use policy** - Simple one-pager for the revenue team: what the extension sends, where it goes, don't use it for sensitive personal matters outside sales
4. **BC-specific review** - Determine if PIPA applies on top of PIPEDA given Martell's structure

## Priority
Fast-follow after initial Chrome Web Store launch. Does not block the March 9-10 rollout for internal unlisted distribution, but should be addressed promptly after.
