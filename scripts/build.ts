import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";

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

await copyFile("src/manifest.json", `${outdir}/manifest.json`);
