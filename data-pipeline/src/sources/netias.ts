import * as cheerio from "cheerio";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";
import type { RawNETIASScheme } from "../transforms/normalise-netias.js";

const CALLS_URL = "https://netias.science/calls-for-applications/";
const BASE_URL = "https://netias.science";

export function parseNETIASPage(html: string): RawNETIASScheme[] {
  const $ = cheerio.load(html);
  const schemes: RawNETIASScheme[] = [];

  $(".views-row").each((_i, el) => {
    const $el = $(el);

    // Title from h2 inside .name_node-title
    const title = $el.find("h2").first().text().replace(/\s+/g, " ").trim();
    if (!title) return;

    // IAS/institute name
    const ias = $el.find(".champ.type_entitygroupfield a").first().text().trim();
    const iasHref = $el.find(".champ.type_entitygroupfield a").first().attr("href") ?? "";
    const iasUrl = iasHref.startsWith("http") ? iasHref : `${BASE_URL}${iasHref}`;

    // Status: from .statut element
    const statutText = $el.find(".statut").first().text().trim().toLowerCase();
    const status = statutText === "open" ? "open" : "closed";

    // Deadline: datetime attribute and human-readable text
    const $deadlineTime = $el.find(".champ.name_date-unique time").first();
    const deadlineDatetime = $deadlineTime.attr("datetime") ?? null;
    const deadlineRaw = $deadlineTime.text().trim() || null;

    // URL: prefer "Apply Now" external link; fall back to IAS page
    let url = iasUrl;
    $el.find("a[href]").each((_j, link) => {
      const href = $(link).attr("href") ?? "";
      if (href.startsWith("http") && !href.includes("netias.science")) {
        url = href;
        return false; // break
      }
    });

    // Description from first paragraph in .content
    const description =
      $el.find(".content p").first().text().replace(/\s+/g, " ").trim() || null;

    schemes.push({ title, ias, url, status, deadlineRaw, deadlineDatetime, description });
  });

  if (schemes.length === 0) {
    throw new Error("NETIAS: no calls found — page structure may have changed");
  }

  return schemes;
}

export async function fetchNETIASSchemes(): Promise<RawNETIASScheme[]> {
  console.log(`  Fetching NETIAS calls for applications: ${CALLS_URL}`);

  const response = await fetchWithRetry(CALLS_URL);
  if (!response.ok) {
    throw new Error(`NETIAS error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const schemes = parseNETIASPage(html);
  const open = schemes.filter(s => s.status === "open").length;
  console.log(`  Found ${schemes.length} calls (${open} open) from NETIAS`);
  return schemes;
}
