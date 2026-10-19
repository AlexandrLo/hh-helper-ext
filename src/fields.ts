// Field names are hh.ru's own keys, shown to the user verbatim.
export const SEARCH_FIELDS = ["responsesCount", "totalResponsesCount"] as const;
export const VACANCY_FIELDS = ["vacancyResponsesCount", "totalResponsesCount"] as const;

export type Fields = Readonly<Record<string, number>>;
/** vacancyId -> fields present for it. */
export type SearchFields = Map<string, Fields>;

// Expected shapes of hh.ru's undocumented page state. Every leaf is `unknown`
// and checked where read; optional chaining keeps wrong shapes harmless.
type Unverified = Partial<Record<string, unknown>> | null | undefined;
interface SearchState {
  vacancySearchResult?: { vacancies?: unknown };
}
interface VacancyState {
  vacancyView?: { vacancyFull?: { extraVacancyFields?: unknown } };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Copies only valid counters, keeping the source key names. */
function pickFields(source: unknown, names: readonly string[]): Fields | null {
  if (typeof source !== "object" || source === null) return null;
  const record = source as Unverified;
  const out: Record<string, number> = {};
  let found = false;
  for (const name of names) {
    const value = record?.[name];
    if (isCount(value)) {
      out[name] = value;
      found = true;
    }
  }
  return found ? out : null;
}

/**
 * Parses a search page state: either the `HH-Lux-InitialState` template
 * or the JSON the site loads on SPA navigation (same shape).
 */
export function parseSearchState(state: unknown): SearchFields {
  const result: SearchFields = new Map();
  const vacancies = (state as SearchState | null | undefined)?.vacancySearchResult?.vacancies;
  if (!Array.isArray(vacancies)) return result;

  for (const vacancy of vacancies as Unverified[]) {
    const id = vacancy?.["vacancyId"];
    if (!isCount(id)) continue;
    const fields = pickFields(vacancy, SEARCH_FIELDS);
    if (fields) result.set(String(id), fields);
  }
  return result;
}

/** Parses a vacancy page `HH-Lux-InitialState`. */
export function parseVacancyState(state: unknown): Fields | null {
  const extra = (state as VacancyState | null | undefined)?.vacancyView?.vacancyFull?.extraVacancyFields;
  return pickFields(extra, VACANCY_FIELDS);
}

const VACANCY_PATH = /^\/vacancy\/(\d+)\/?$/;

/** Extracts the vacancy id from a `/vacancy/<id>` link on hh.ru. */
export function vacancyIdFromHref(href: string, base = "https://hh.ru/"): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.hostname !== "hh.ru") return null;
  return VACANCY_PATH.exec(url.pathname)?.[1] ?? null;
}

/** `name: value · name: value` in the given field order, skipping absent fields. */
export function formatFields(fields: Fields, order: readonly string[]): string {
  return order
    .filter((name) => fields[name] !== undefined)
    .map((name) => `${name}: ${fields[name]}`)
    .join(" · ");
}
