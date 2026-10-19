import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SEARCH_FIELDS,
  VACANCY_FIELDS,
  formatFields,
  parseSearchState,
  parseVacancyState,
  vacancyIdFromHref,
} from "../src/fields.ts";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

test("search initial state: counters keyed by vacancyId, zero kept", () => {
  const parsed = parseSearchState(fixture("search-initial-state.json"));
  assert.equal(parsed.size, 4);
  assert.deepEqual(parsed.get("138480763"), { responsesCount: 20, totalResponsesCount: 1042 });
  assert.deepEqual(parsed.get("137535328"), { responsesCount: 0, totalResponsesCount: 1484 });
});

test("search SPA response has the same shape", () => {
  const parsed = parseSearchState(fixture("search-spa-response.json"));
  assert.equal(parsed.size, 3);
  assert.deepEqual(parsed.get("138355705"), { responsesCount: 773, totalResponsesCount: 870 });
});

test("search state without counter fields yields nothing", () => {
  assert.equal(parseSearchState(fixture("search-no-counters.json")).size, 0);
});

test("search: one field missing or invalid keeps the other", () => {
  const parsed = parseSearchState({
    vacancySearchResult: {
      vacancies: [
        { vacancyId: 1, totalResponsesCount: 5 },
        { vacancyId: 2, responsesCount: "7", totalResponsesCount: 9 },
        { vacancyId: 3, responsesCount: -1, totalResponsesCount: 1.5 },
        { vacancyId: "4", responsesCount: 1 },
        null,
      ],
    },
  });
  assert.deepEqual([...parsed], [
    ["1", { totalResponsesCount: 5 }],
    ["2", { totalResponsesCount: 9 }],
  ]);
});

test("search: garbage input yields empty map", () => {
  for (const input of [null, 42, "x", [], {}, { vacancySearchResult: [] }, { vacancySearchResult: { vacancies: {} } }]) {
    assert.equal(parseSearchState(input).size, 0);
  }
});

test("vacancy state: both fields with original names", () => {
  assert.deepEqual(parseVacancyState(fixture("vacancy-state.json")), {
    totalResponsesCount: 1630,
    vacancyResponsesCount: 1672,
  });
});

test("vacancy state: missing fields or unknown shape yields null", () => {
  assert.equal(parseVacancyState({ vacancyView: { vacancyFull: { extraVacancyFields: {} } } }), null);
  assert.equal(parseVacancyState({ vacancyView: { vacancyFull: { extraVacancyFields: { totalResponsesCount: null } } } }), null);
  assert.equal(parseVacancyState(fixture("search-initial-state.json")), null);
  assert.equal(parseVacancyState("garbage"), null);
});

test("vacancyIdFromHref: relative and absolute hh.ru links", () => {
  assert.equal(vacancyIdFromHref("/vacancy/138480763?query=python&hhtmFrom=vacancy_search_list"), "138480763");
  assert.equal(vacancyIdFromHref("https://hh.ru/vacancy/138480763"), "138480763");
  assert.equal(vacancyIdFromHref("https://hh.ru/vacancy/138480763/"), "138480763");
});

test("vacancyIdFromHref: foreign or broken links", () => {
  assert.equal(vacancyIdFromHref("https://example.com/vacancy/1"), null);
  assert.equal(vacancyIdFromHref("https://adsrv.hh.ru/click?to=/vacancy/1"), null);
  assert.equal(vacancyIdFromHref("/vacancy/abc"), null);
  assert.equal(vacancyIdFromHref("/vacancy/1/similar"), null);
  assert.equal(vacancyIdFromHref("/search/vacancy?text=1"), null);
  assert.equal(vacancyIdFromHref("http://[broken"), null);
});

test("formatFields: fixed order with original names, absent skipped", () => {
  assert.equal(
    formatFields({ totalResponsesCount: 65, responsesCount: 40 }, SEARCH_FIELDS),
    "responsesCount: 40 · totalResponsesCount: 65",
  );
  assert.equal(formatFields({ totalResponsesCount: 82 }, VACANCY_FIELDS), "totalResponsesCount: 82");
  assert.equal(formatFields({ responsesCount: 0 }, SEARCH_FIELDS), "responsesCount: 0");
});
