import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [id, frameArg] = process.argv.slice(2);
const frame = frameArg ? parseInt(frameArg, 10) : 60;

const CANDIDATE_CHROME_PATHS = [
  "/bin/chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const browserExecutable = process.env.PUPPETEER_EXECUTABLE_PATH ?? CANDIDATE_CHROME_PATHS.find((p) => fs.existsSync(p)) ?? null;

const bundled = await bundle({ entryPoint: path.resolve(__dirname, "../src/index.ts"), webpackOverride: (c) => c });
const browser = await openBrowser("chrome", {
  browserExecutable,
  chromiumOptions: { args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] },
  chromeMode: browserExecutable ? "chrome-for-testing" : "headless-shell",
});

const composition = await selectComposition({ serveUrl: bundled, id, puppeteerInstance: browser });
const outputLocation = path.resolve(__dirname, `../../public/videos/_still_${id}_${frame}.png`);

await renderStill({ composition, serveUrl: bundled, frame, output: outputLocation, puppeteerInstance: browser });
await browser.close({ silent: false });
console.log(`Saved ${outputLocation}`);
