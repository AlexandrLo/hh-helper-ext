import { parseSearchState } from "./fields.ts";
import type { SearchFieldsMessage } from "./messages.ts";

const MAX_COPY_BYTES = 8 * 1024 * 1024;

/**
 * Reads the JSON hh.ru loads on SPA navigation of the search page.
 * The response always reaches the page unchanged: every chunk is written
 * through immediately, parsing happens on a copy after the stream is closed.
 */
function observeSearchResponse(
  details: browser.webRequest._OnBeforeRequestDetails,
): browser.webRequest.BlockingResponse {
  if (details.tabId < 0) return {};

  let filter: browser.webRequest.StreamFilter;
  try {
    filter = browser.webRequest.filterResponseData(details.requestId);
  } catch (error) {
    console.warn("hh-helper: filterResponseData failed", error);
    return {};
  }

  const chunks: ArrayBuffer[] = [];
  let copiedBytes = 0;
  let copying = true;

  filter.ondata = (event) => {
    try {
      filter.write(event.data);
    } catch (error) {
      console.warn("hh-helper: write failed, disconnecting", error);
      copying = false;
      filter.disconnect();
      return;
    }
    if (!copying) return;
    copiedBytes += event.data.byteLength;
    if (copiedBytes > MAX_COPY_BYTES) {
      copying = false;
      chunks.length = 0;
      return;
    }
    chunks.push(event.data);
  };

  filter.onstop = () => {
    try {
      filter.close();
    } catch (error) {
      console.warn("hh-helper: close failed", error);
      return;
    }
    if (copying) publish(details.tabId, chunks);
  };

  filter.onerror = () => {
    console.debug("hh-helper: stream filter error", filter.error);
  };

  return {};
}

function publish(tabId: number, chunks: ArrayBuffer[]): void {
  const decoder = new TextDecoder();
  let state: unknown;
  try {
    const text = chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") + decoder.decode();
    state = JSON.parse(text);
  } catch {
    return; // not JSON: show nothing
  }
  const fields = parseSearchState(state);
  console.debug(`hh-helper: ${fields.size} vacancies parsed from SPA response`);
  if (fields.size === 0) return;

  const message: SearchFieldsMessage = { type: "hh-helper/search-fields", entries: [...fields] };
  browser.tabs.sendMessage(tabId, message).catch(() => {
    // Tab closed or navigated away from a matching page: nothing to update.
  });
}

// Pagination reloads the page URL as JSON; filter changes go through the shards endpoint.
// Both return the same `vacancySearchResult`.
browser.webRequest.onBeforeRequest.addListener(
  observeSearchResponse,
  {
    urls: ["https://hh.ru/search/vacancy*", "https://hh.ru/shards/vacancy/search*"],
    types: ["xmlhttprequest"],
  },
  ["blocking"],
);
