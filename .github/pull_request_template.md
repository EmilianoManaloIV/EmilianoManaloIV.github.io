## What
Round NNN, task NNNN (ADR NNNN), requirements R-xx: "<the request, quoted>"
- <what the visitor or owner gets, one bullet per behaviour>
- Scope: <what is in, what was left out on purpose>

## After the review
- <each must-fix the reviewer found and what changed, or "none">

## Architectural implications, limitations, risks
- <what this changes for the pages, the content pipeline or a convention (the ADR), or "none">
- <known limitations and remaining risks, and what would show them>

## Checks
- [ ] New / changed tests: <names or claims>
- [ ] `node --test` on the offline build: ___ tests, 0 failed
- [ ] `node --test` on the fixture build: ___ tests, 0 failed
- [ ] `node --test` on the live build: ___ tests, 0 failed
- [ ] Budgets: JavaScript ___ KB gzipped (under 32 KB); largest page ___ KB gzipped (under 200 KB)
- [ ] Browser (layout changes): ___ px widths, light and dark, motion on and off, no console errors

## Documentation
- [ ] CHANGELOG entry with the numbers above
- [ ] README count / paragraph; `docs/MANUAL.md` if an owner workflow changed
- [ ] docs/ARCHITECTURE.md, docs/USABILITY.md rows (if applicable)
- [ ] ADR or amendment (if architectural); the task spec marked done with this PR

## Merging
Stacked on #NN (which is stacked on #NN): merging this merges them. | Independent.

Merging is the human's decision; agents never merge.
