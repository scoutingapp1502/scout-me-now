import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CANDIDATE_CHROME_PATHS = [
  "/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const browserExecutable =
  process.env.PUPPETEER_EXECUTABLE_PATH ?? CANDIDATE_CHROME_PATHS.find((p) => fs.existsSync(p)) ?? null;

const outDir = path.resolve(__dirname, "../../public/videos");
fs.mkdirSync(outDir, { recursive: true });

const compositionIds = process.argv.slice(2);

const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

const browser = await openBrowser("chrome", {
  browserExecutable,
  chromiumOptions: {
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  },
  chromeMode: browserExecutable ? "chrome-for-testing" : "headless-shell",
});

const allCompositions = await import("@remotion/renderer").then((m) =>
  m.getCompositions(bundled, { puppeteerInstance: browser })
);

const targets = compositionIds.length > 0 ? allCompositions.filter((c) => compositionIds.includes(c.id)) : allCompositions;

for (const comp of targets) {
  const composition = await selectComposition({
    serveUrl: bundled,
    id: comp.id,
    puppeteerInstance: browser,
  });

  const outputLocation = path.join(outDir, `${comp.id}.mp4`);
  console.log(`Rendering ${comp.id} -> ${outputLocation}`);

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation,
    puppeteerInstance: browser,
    muted: true,
    concurrency: 1,
  });

  console.log(`Done: ${comp.id}`);
}

await browser.close({ silent: false });
console.log(`Finished rendering ${targets.length} video(s) to public/videos/`);
