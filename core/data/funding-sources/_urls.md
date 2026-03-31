# Funding Source URLs

Master list of URLs for the grant-scanner to harvest from.
Each URL maps to a file in funding-sources/.
Add new URLs here, create a placeholder file, then run /scan.

---

## UK Research Councils

| File | URL |
|------|-----|
| ahrc.md | https://www.ukri.org/opportunity/?filter_council[]=814 |
| ahrc.md | https://www.ukri.org/opportunity/ |

## Trusts and Foundations

| File | URL |
|------|-----|
| leverhulme.md | https://www.leverhulme.ac.uk/schemes-at-a-glance |
| british-academy.md | https://www.thebritishacademy.ac.uk/funding/ |
| henry-moore.md | https://www.henrymoore.org/grants |
| nuffield.md | https://www.nuffieldfoundation.org/funding |

## International — Art History Specific

| File | URL |
|------|-----|
| getty.md | https://www.getty.edu/funding/opportunities/ |
| getty.md | https://www.getty.edu/research/scholars/ |
| nga.md | https://www.nga.gov/research/center/fellowships |
| clark.md | https://www.clarkart.edu/research-academic/fellowship-program |
| sainsbury.md | https://www.sainsburyinstitute.org/ |

## UK Arts

| File | URL |
|------|-----|
| arts-council-england.md | https://www.artscouncil.org.uk/funding |

## European

| File | URL |
|------|-----|
| horizon-europe.md | https://erc.europa.eu/apply-grant |
| horizon-europe.md | https://heranet.info/ |

## Institution-Specific (University of Leeds)

| File | URL |
|------|-----|
| leeds-internal.md | https://ahc.leeds.ac.uk/dir/research-projects |

---

## Adding a New Source

1. Add a row to the relevant section above
2. Create a placeholder file: `funding-sources/<funder>.md`
3. Run `/scan` or `/scan --force` to harvest
