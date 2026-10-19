import {
  SEARCH_FIELDS,
  VACANCY_FIELDS,
  formatFields,
  parseSearchState,
  parseVacancyState,
  vacancyIdFromHref,
  type Fields,
} from "./fields.ts";
import type { SearchFieldsMessage } from "./messages.ts";

const BADGE_ATTR = "data-hh-helper-badge";
// Mirrors hh.ru's card label ("Опыт 3-6 лет"): computed styles taken from the live page.
const BADGE_STYLE = `
:host { all: initial; display: block; margin: 0 0 8px; }
span {
  display: inline-flex; align-items: center; box-sizing: border-box; height: 28px;
  padding: 4px 8px; border-radius: 8px; background: rgb(241, 244, 249);
  font-family: "hh sans", "Helvetica Neue", sans-serif; font-size: 14px; font-weight: 400;
  line-height: 20px; letter-spacing: 0.07px; color: rgb(0, 0, 0); white-space: nowrap;
}`;

/** Reads `HH-Lux-InitialState`; its JSON lives in the template's content fragment. */
function readInitialState(): unknown {
  const template = document.getElementById("HH-Lux-InitialState");
  if (!(template instanceof HTMLTemplateElement)) return null;
  try {
    return JSON.parse(template.content.textContent ?? "");
  } catch {
    return null;
  }
}

/**
 * Keeps the badge as a direct child of `parent`, right after `after` (or first when `after` is null);
 * removes it when there is nothing to show. Touches the DOM only on change,
 * so our own mutations settle the observer.
 */
function upsertBadge(parent: Element, after: Element | null, text: string): void {
  const existing = parent.querySelector(`:scope > [${BADGE_ATTR}]`);
  if (!text) {
    existing?.remove();
    return;
  }
  const reference = after ? after.nextSibling : parent.firstChild;
  if (existing && existing === reference && existing.getAttribute(BADGE_ATTR) === text) return;

  const host = existing ?? document.createElement("div");
  if (host.getAttribute(BADGE_ATTR) !== text) {
    host.setAttribute(BADGE_ATTR, text);
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = BADGE_STYLE;
    const label = document.createElement("span");
    label.textContent = text;
    root.replaceChildren(style, label);
  }
  if (host !== reference) parent.insertBefore(host, reference);
}

// Search card: the title link sits (through inline spans) in the card's header block,
// below optional lines such as "Сейчас смотрят N человек". The badge goes first in that block.
function renderSearch(fieldsById: Map<string, Fields>): void {
  for (const title of document.querySelectorAll('[data-qa="vacancy-serp__vacancy"] a[data-qa="serp-item__title"]')) {
    const header = title.closest("div");
    if (!header) continue;
    const id = vacancyIdFromHref(title.getAttribute("href") ?? "");
    const fields = id === null ? undefined : fieldsById.get(id);
    upsertBadge(header, null, fields ? formatFields(fields, SEARCH_FIELDS) : "");
  }
}

// Vacancy page: the badge ends the list of vacancy properties (items marked with data-qa),
// i.e. above an optional unmarked "Сейчас эту вакансию смотрит N человек" line.
// Falls back to right under the title when the list is not found.
function renderVacancy(fields: Fields): void {
  const text = formatFields(fields, VACANCY_FIELDS);
  const properties = document.querySelector('[data-qa="work-experience-text"]')?.parentElement;
  const lastProperty = properties && [...properties.children].filter((child) => child.hasAttribute("data-qa")).at(-1);
  if (properties && lastProperty) {
    upsertBadge(properties, lastProperty, text);
    return;
  }
  const title = document.querySelector('h1[data-qa="vacancy-title"]');
  if (title?.parentElement) upsertBadge(title.parentElement, title, text);
}

/** Re-renders at most once per frame on DOM changes (lazy cards, SPA re-renders, hydration). */
function keepRendered(render: () => void): () => void {
  let scheduled = false;
  const safeRender = () => {
    scheduled = false;
    try {
      render();
    } catch (error) {
      console.debug("hh-helper: render failed", error);
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(safeRender);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  safeRender();
  return schedule;
}

function startSearchPage(): void {
  const fieldsById = parseSearchState(readInitialState());
  const schedule = keepRendered(() => renderSearch(fieldsById));

  browser.runtime.onMessage.addListener((message: SearchFieldsMessage) => {
    if (message?.type !== "hh-helper/search-fields") return;
    for (const [id, fields] of message.entries) fieldsById.set(id, fields);
    schedule();
  });
}

function startVacancyPage(): void {
  const fields = parseVacancyState(readInitialState());
  if (fields) keepRendered(() => renderVacancy(fields));
}

try {
  if (location.pathname.startsWith("/search/vacancy")) startSearchPage();
  else if (location.pathname.startsWith("/vacancy/")) startVacancyPage();
} catch (error) {
  console.debug("hh-helper: disabled on this page", error);
}
