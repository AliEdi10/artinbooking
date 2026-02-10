# Repository Agent Guide

## ⚠️ IMPORTANT: READ FIRST

**This app is PRODUCTION READY (January 2026).** Before asking clarifying questions or suggesting work:

1. Read `README.md` - Shows what's actually complete
2. Read `README.md` - Updated architecture overview
3. **Ignore** the outdated planning docs in `/docs` that mention GCP, missing features, etc.

**Currently deployed:**
- Frontend: Vercel (https://artinbooking.vercel.app)
- Backend: Railway
- Database: Railway PostgreSQL
- Email: Resend API (working)

**All features are complete** including email notifications, booking flow, admin/driver/student portals.

---

These instructions apply to the entire repository. If a more specific AGENTS.md is added in a subdirectory, defer to that file for scoped changes.

## Contribution expectations
- Keep changes focused and well-scoped; prefer incremental commits over large monolithic ones.
- Update relevant documentation or comments when behavior, configuration, or operational procedures change.
- Always document all changes in both the final assistant response and the PR message (include summaries and testing details).
- Follow existing coding styles and conventions in nearby files; avoid introducing new patterns when unnecessary.
- Prefer automation and reproducible commands over manual steps when possible; record any required commands in docs or scripts.
- Validate that added automation scripts are idempotent and safe to re-run in CI and locally.
- Use descriptive commit messages that summarize the change scope and mention any follow-up tasks when relevant.

## Testing and verification
- Run appropriate tests or linters for the areas you modify. If a check is skipped, state why in the final summary.
- Include exact commands run in both the final response and the PR body testing section.
- Prefer fast, targeted checks when iterating; before merging, run the closest approximation of the project’s standard CI suite.
- Capture notable test artifacts (logs, screenshots, recordings) in the PR description or linked attachments when they aid review.

## Documentation expectations
- When touching behavior, configuration, or deployment flows, update the relevant README or playbook in the same change.
- Keep configuration examples realistic and runnable; include environment variable names, sample values, and prerequisites.
- Ensure cross-references stay valid after restructures (e.g., update broken anchors or renamed files).

## PR and review hygiene
- Keep PR summaries concise: list key changes and any notable impacts.
- Mention any migrations, manual steps, or external dependencies required for the change.
- Add a brief “Verification” or “Manual QA” note in the PR description when manual testing was performed.
- Avoid mixing refactors with behavioral changes unless necessary; call out refactors explicitly when they occur.

