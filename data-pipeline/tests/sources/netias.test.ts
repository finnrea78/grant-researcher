import { parseNETIASPage } from "../../src/sources/netias";
import { normaliseNETIAS } from "../../src/transforms/normalise-netias";
import type { RawNETIASScheme } from "../../src/transforms/normalise-netias";

const OPEN_ROW_HTML = `
<div class="views-row">
  <div class="teaser modal call">
    <div class="trigger">
      <div class="group_header">
        <div class="infos">
          <div class="champ type_entitygroupfield name_entitygroupfield unique">
            <a href="/ias/hanse-wissenschaftskolleg" hreflang="en">Hanse-Wissenschaftskolleg</a>
          </div>
          <div class="champ type_datetime name_date-unique label_inline unique">
            <div class="field__label">Deadline</div>
            <div class="field__content">
              <time datetime="2026-07-14T22:00:00Z" class="datetime">15.07.2026 (12.00am Paris Time)</time>
              <div class="statut open">open</div>
            </div>
          </div>
        </div>
      </div>
      <div class="champ type_ds name_node-title unique">
        <h2>Annual Call 2026 for Regular and Junior Fellows</h2>
      </div>
    </div>
    <div class="content">
      <p>The Hanse-Wissenschaftskolleg (HWK) in Delmenhorst is an Institute for Advanced Study.</p>
      <a href="https://hanse-ias.de/apply?mtm_campaign=Annual%20Call%202026">Apply Now!</a>
    </div>
  </div>
</div>
`;

const CLOSED_ROW_HTML = `
<div class="views-row">
  <div class="teaser modal call">
    <div class="trigger">
      <div class="group_header">
        <div class="infos">
          <div class="champ type_entitygroupfield name_entitygroupfield unique">
            <a href="/ias/centre-advanced-study-sofia" hreflang="en">Centre for Advanced Study Sofia</a>
          </div>
          <div class="champ type_datetime name_date-unique label_inline unique">
            <div class="field__label">Deadline</div>
            <div class="field__content">
              <time datetime="2026-03-31T22:00:00Z" class="datetime">31.03.2026 (11.00pm Paris Time)</time>
              <div class="statut closed">closed</div>
            </div>
          </div>
        </div>
      </div>
      <div class="champ type_ds name_node-title unique">
        <h2>CAS Sofia Fellowships for 2026/2027</h2>
      </div>
    </div>
    <div class="content">
      <p>The Centre for Advanced Study Sofia invites applications for residential fellowships.</p>
    </div>
  </div>
</div>
`;

const MULTI_ROWS_HTML = `<div>${OPEN_ROW_HTML}${CLOSED_ROW_HTML}</div>`;

describe("parseNETIASPage", () => {
  it("extracts title from h2", () => {
    const schemes = parseNETIASPage(OPEN_ROW_HTML);
    expect(schemes).toHaveLength(1);
    expect(schemes[0].title).toBe("Annual Call 2026 for Regular and Junior Fellows");
  });

  it("detects open status", () => {
    const schemes = parseNETIASPage(OPEN_ROW_HTML);
    expect(schemes[0].status).toBe("open");
  });

  it("detects closed status", () => {
    const schemes = parseNETIASPage(CLOSED_ROW_HTML);
    expect(schemes[0].status).toBe("closed");
  });

  it("extracts deadline text and datetime", () => {
    const schemes = parseNETIASPage(OPEN_ROW_HTML);
    expect(schemes[0].deadlineRaw).toContain("15.07.2026");
    expect(schemes[0].deadlineDatetime).toBe("2026-07-14T22:00:00Z");
  });

  it("extracts IAS name", () => {
    const schemes = parseNETIASPage(OPEN_ROW_HTML);
    expect(schemes[0].ias).toBe("Hanse-Wissenschaftskolleg");
  });

  it("prefers external Apply URL over IAS page", () => {
    const schemes = parseNETIASPage(OPEN_ROW_HTML);
    expect(schemes[0].url).toContain("hanse-ias.de");
  });

  it("falls back to IAS page URL when no external apply link", () => {
    const schemes = parseNETIASPage(CLOSED_ROW_HTML);
    expect(schemes[0].url).toContain("netias.science");
  });

  it("extracts description from first paragraph", () => {
    const schemes = parseNETIASPage(OPEN_ROW_HTML);
    expect(schemes[0].description).toContain("Hanse-Wissenschaftskolleg");
  });

  it("parses multiple rows", () => {
    const schemes = parseNETIASPage(MULTI_ROWS_HTML);
    expect(schemes).toHaveLength(2);
  });

  it("throws if no views-row elements found", () => {
    expect(() => parseNETIASPage("<html><body><p>No content</p></body></html>")).toThrow(
      "NETIAS: no calls found"
    );
  });
});

describe("normaliseNETIAS", () => {
  const SAMPLE_RAW: RawNETIASScheme = {
    title: "Annual Call 2026 for Regular and Junior Fellows",
    ias: "Hanse-Wissenschaftskolleg",
    url: "https://hanse-ias.de/apply",
    status: "open",
    deadlineRaw: "15.07.2026 (12.00am Paris Time)",
    deadlineDatetime: "2026-07-14T22:00:00Z",
    description: "The HWK offers fellowships for outstanding researchers.",
  };

  it("maps funder_slug to netias", () => {
    const result = normaliseNETIAS(SAMPLE_RAW);
    expect(result.funder_slug).toBe("netias");
  });

  it("uses IAS name as funder_name", () => {
    const result = normaliseNETIAS(SAMPLE_RAW);
    expect(result.funder_name).toBe("Hanse-Wissenschaftskolleg");
  });

  it("maps title and slug", () => {
    const result = normaliseNETIAS(SAMPLE_RAW);
    expect(result.name).toBe("Annual Call 2026 for Regular and Junior Fellows");
    expect(result.slug).toMatch(/annual/);
  });

  it("sets source to netias", () => {
    const result = normaliseNETIAS(SAMPLE_RAW);
    expect(result.source).toBe("netias");
  });

  it("sets currency to EUR", () => {
    const result = normaliseNETIAS(SAMPLE_RAW);
    expect(result.amount_currency).toBe("EUR");
  });

  it("sets funding_type to fellowship", () => {
    const result = normaliseNETIAS(SAMPLE_RAW);
    expect(result.funding_type).toBe("fellowship");
  });

  it("extracts date from datetime ISO string", () => {
    const result = normaliseNETIAS(SAMPLE_RAW);
    expect(result.deadline_date).toBe("2026-07-14");
  });

  it("stores IAS in source_metadata", () => {
    const result = normaliseNETIAS(SAMPLE_RAW);
    expect(result.source_metadata).toMatchObject({ ias: "Hanse-Wissenschaftskolleg" });
  });

  it("handles null deadline gracefully", () => {
    const result = normaliseNETIAS({ ...SAMPLE_RAW, deadlineDatetime: null, deadlineRaw: null });
    expect(result.deadline_date).toBeNull();
    expect(result.deadline_raw).toBeNull();
  });
});
