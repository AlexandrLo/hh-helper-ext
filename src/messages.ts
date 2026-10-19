import type { Fields } from "./fields.ts";

/** Background -> content script: counters parsed from a search SPA response of this tab. */
export interface SearchFieldsMessage {
  type: "hh-helper/search-fields";
  entries: [vacancyId: string, fields: Fields][];
}
