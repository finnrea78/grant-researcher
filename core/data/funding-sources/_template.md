# Funding Source Template

> This file defines the schema that ALL funding source files must follow.
> Every file in funding-sources/ (except files starting with _) must use this structure.

---

# [Funder Name]

> Last updated: YYYY-MM-DD
> Source URL: [url]
> Funder type: research_council | trust | foundation | government | international

## Scheme: [Scheme Name]

- **Status:** open | closed | upcoming | rolling
- **Deadline:** YYYY-MM-DD or "rolling" or "TBC"
- **Amount:** £X — £Y (or "varies")
- **Duration:** X months/years
- **Career stage:** early_career | mid_career | established | any
- **Eligibility:**
  - Must be based at UK HEI: yes/no
  - Nationality restrictions: none / UK only / etc
  - Prior grant restrictions: [details or "none"]
  - Other: [details or "none"]
- **Themes/priorities:** [what they fund, any strategic priorities]
- **What they're looking for:** [brief description of ideal project]
- **Application process:** [outline vs full, stages, peer review, etc]
- **URL:** [direct link to scheme page]
- **Notes:** [anything else relevant — e.g. "50% match funding required from host institution"]

## Scheme: [Next Scheme Name]

[Repeat structure above for each scheme]

---

## HARVESTING NOTES

- Use WebFetch on the source URL listed in `_urls.md`
- Extract only what is explicitly stated on the page — do NOT infer or guess
- If a URL returns unhelpful or empty content, write:
  `> Harvest failed: [date] — [reason]. Manual check required.`
- Update `_last-harvested.json` after writing this file
- Status values: use "open" only if a deadline is current or rolling; use "upcoming" if announced but not yet open; use "closed" if deadline has passed
