# data-pipeline

CLI for ingesting grant opportunities into Supabase.

## Running

All commands require env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`). The `.env` file in this workspace root is loaded automatically.

```bash
# Ingest a single source
npm run ingest -w data-pipeline -- <source>

# Ingest all sources sequentially
npm run ingest-all -w data-pipeline

# Examples
npm run ingest -w data-pipeline -- wellcome
npm run ingest -w data-pipeline -- raeng
npm run ingest -w data-pipeline -- ukri-finder
```

## Maintenance commands

```bash
# Close expired opportunities + backfill missing embeddings
npm run ingest -w data-pipeline -- cleanup

# Permanently delete closed/past-deadline opportunities (destructive)
npm run ingest -w data-pipeline -- purge

# Show DB record counts and recent ingestion runs
npm run ingest -w data-pipeline -- status

# Backfill embeddings only
npm run embed -w data-pipeline
```

## Available sources

| Command | Funder |
|---------|--------|
| `ukri-finder` | UKRI Funding Finder |
| `find-a-grant` | UK Find a Grant (GOV.UK) |
| `wellcome` | Wellcome Trust |
| `leverhulme` | Leverhulme Trust |
| `royal-society` | Royal Society |
| `nuffield` | Nuffield Foundation |
| `wolfson` | Wolfson Foundation |
| `heritage-fund` | National Lottery Heritage Fund |
| `carnegie-trust` | Carnegie Trust |
| `henry-moore` | Henry Moore Foundation |
| `erc` | European Research Council |
| `msca` | Marie Skłodowska-Curie Actions |
| `hias-hamburg` | HIAS Hamburg |
| `netias` | NETIAS |
| `innovate-uk` | Innovate UK |
| `blood-cancer-uk` | Blood Cancer UK |
| `newton-fellowship` | Newton International Fellowship |
| `rse` | Royal Society of Edinburgh |
| `action-medical` | Action Medical Research |
| `vivensa` | Vivensa Foundation |
| `embo` | EMBO |
| `hfsp` | HFSP |
| `biochemical-society` | Biochemical Society |
| `humboldt` | Alexander von Humboldt Foundation |
| `geolsoc` | Geological Society of London |
| `acmedsci` | Academy of Medical Sciences |
| `rgs` | Royal Geographical Society |
| `bps` | British Psychological Society |
| `genetics-society` | Genetics Society |
| `microbiology-society` | Microbiology Society |
| `royensoc` | Royal Entomological Society |
| `lms` | London Mathematical Society |
| `physoc` | Physiological Society |
| `ima` | Institute of Mathematics and its Applications |
| `eseb` | European Society for Evolutionary Biology |
| `endocrinology` | Society for Endocrinology |
| `royal-historical-society` | Royal Historical Society |
| `royal-commission-1851` | Royal Commission for the Exhibition of 1851 |
| `asab` | Association for the Study of Animal Behaviour |
| `sci` | Society of Chemical Industry |
| `sal` | Society of Antiquaries of London |
| `bshs` | British Society for the History of Science |
| `bsbi` | Botanical Society of Britain & Ireland |
| `febs` | FEBS |
| `palass` | Palaeontological Association |
| `challenger-society` | Challenger Society for Marine Science |
| `bou` | British Ornithological Union |
| `classical-association` | Classical Association |
| `benhs` | BENHS |
| `raeng` | Royal Academy of Engineering |
| `rsc` | Royal Society of Chemistry |
| `iolanthe` | Iolanthe Midwifery Trust |
| `bhf` | British Heart Foundation |
| `natgeo` | National Geographic Society |
| `diabetes-uk` | Diabetes UK |

## Testing

```bash
npm test -w data-pipeline
```
