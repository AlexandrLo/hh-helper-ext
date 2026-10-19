import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const outdir = "dist";

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
  },
  outdir,
  bundle: true,
  format: "iife",
  target: "firefox142",
  logLevel: "info",
});

// package.json is the only source of the extension version.
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("src/manifest.json", "utf8"));
await writeFile(
  `${outdir}/manifest.json`,
  JSON.stringify({ ...manifest, version }, null, 2) + "\n",
);

await cp("src/icons", `${outdir}/icons`, { recursive: true });
