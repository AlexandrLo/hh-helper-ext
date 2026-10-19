// Prints the Firefox update manifest for the current package.json version.
// It is attached to each GitHub release; the extension's update_url points at
// the copy in the latest release.
import { readFile } from "node:fs/promises";

const latestSuffix = "/releases/latest/download/updates.json";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const { id, update_url: updateUrl } = JSON.parse(
  await readFile("src/manifest.json", "utf8"),
).browser_specific_settings.gecko;

if (typeof updateUrl !== "string" || !updateUrl.endsWith(latestSuffix)) {
  throw new Error(`update_url must end with ${latestSuffix}: ${updateUrl}`);
}
const repoUrl = updateUrl.slice(0, -latestSuffix.length);

const updates = {
  addons: {
    [id]: {
      updates: [
        {
          version,
          update_link: `${repoUrl}/releases/download/v${version}/hh-helper-ext-${version}.xpi`,
        },
      ],
    },
  },
};

process.stdout.write(JSON.stringify(updates, null, 2) + "\n");
