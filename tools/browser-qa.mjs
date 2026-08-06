import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const previewPort = 4174;
const debugPort = 9234;
const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const browser = browserCandidates.find(fs.existsSync);
if (!browser) throw new Error("No se encontró Chrome o Edge para la revisión visual.");

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitForJson(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await wait(125);
  }
  throw new Error(`No respondió ${url}`);
}

const profile = path.join(os.tmpdir(), `atlas-browser-qa-${process.pid}`);
const outputDirectory = path.join(root, "generated", "qa");
const screenshotPath = path.join(outputDirectory, "atlas-browser.png");
const examScreenshotPath = path.join(outputDirectory, "atlas-exam.png");
fs.mkdirSync(outputDirectory, { recursive: true });

const preview = spawn(process.execPath, ["tools/preview.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(previewPort) },
  stdio: "ignore",
  windowsHide: true
});
let chrome;
let socket;

try {
  await waitForJson(`http://127.0.0.1:${previewPort}/data/catalog.json`);
  chrome = spawn(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });

  const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
  const target = targets.find(item => item.type === "page");
  if (!target?.webSocketDebuggerUrl) throw new Error("Chrome no expuso una página de diagnóstico.");

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  const consoleErrors = [];
  const networkErrors = [];
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text || "Excepción sin detalle");
    }
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
      consoleErrors.push(message.params.entry.text);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      consoleErrors.push(message.params.args.map(item => item.value || item.description || "").join(" "));
    }
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
      networkErrors.push(`${message.params.response.status} ${message.params.response.url}`);
    }
  });

  function command(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  await Promise.all([
    command("Page.enable"),
    command("Runtime.enable"),
    command("Log.enable"),
    command("Network.enable")
  ]);
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await command("Page.navigate", { url: `http://127.0.0.1:${previewPort}/#/home` });
  await wait(6000);

  async function evaluate(expression) {
    const evaluation = await command("Runtime.evaluate", {
      expression,
      returnByValue: true
    });
    return evaluation.result?.value;
  }
  async function captureTo(file) {
    const capture = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(capture.data, "base64"));
  }

  const home = await evaluate(`({
    title: document.title,
    mainTextLength: document.querySelector("#main")?.innerText.length || 0,
    mainHtmlLength: document.querySelector("#main")?.innerHTML.length || 0,
    tutorialVisible: !document.querySelector("#tutorial-layer")?.hidden,
    introVisible: !document.querySelector("#atlas-intro")?.hidden,
    introScene: document.querySelector("#atlas-intro")?.dataset.scene,
    libraries: document.querySelectorAll("[data-library]").length,
    updateBannerVisible: !document.querySelector("#update-banner")?.hidden
  })`);
  await evaluate(`document.querySelector('[data-action="intro-close"]')?.click()`);
  await wait(400);
  await evaluate(`document.querySelector('[data-action="tutorial-close"]')?.click()`);
  await evaluate(`location.hash = "/discover"`);
  await wait(2500);
  const discover = await evaluate(`({
    title: document.title,
    cards: document.querySelectorAll(".short-card").length,
    types: [...document.querySelectorAll(".short-card")].slice(0, 12).map(card =>
      [...card.classList].find(name => name.startsWith("short-type-"))?.replace("short-type-", "")
    )
  })`);
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await wait(500);
  const discoverMobile = await evaluate(`({
    viewport: [innerWidth, innerHeight],
    pageHeight: document.querySelector(".discover-page")?.getBoundingClientRect().height,
    feedHeight: document.querySelector(".short-feed")?.getBoundingClientRect().height,
    firstCardHeight: document.querySelector(".short-card")?.getBoundingClientRect().height,
    filterTop: document.querySelector(".short-filters")?.getBoundingClientRect().top,
    filterOverflow: document.querySelector(".short-filters .chip-row")?.scrollWidth > document.querySelector(".short-filters .chip-row")?.clientWidth,
    hasVideo: [...document.querySelectorAll(".short-card")].some(card => card.classList.contains("short-type-video")),
    hasInstagram: [...document.querySelectorAll(".short-card")].some(card => card.classList.contains("short-type-instagram"))
  })`);
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate(`location.hash = "/reader/" + encodeURIComponent(window.Atlas.data.documents[0].id)`);
  await wait(3500);
  const reader = await evaluate(`({
    title: document.title,
    contentLength: document.querySelector("#reader-content")?.innerText.length || 0,
    chunks: document.querySelectorAll(".reader-chunk").length,
    outlineItems: document.querySelectorAll("#reader-toc [data-reader-heading]").length
  })`);
  await evaluate(`location.hash = "/examen"`);
  await wait(900);
  const examDashboard = await evaluate(`({
    title: document.title,
    periodCards: document.querySelectorAll(".exam-period-card").length,
    navigationCards: document.querySelectorAll(".exam-dashboard-nav a").length,
    privacyVisible: /Solo en este dispositivo/.test(document.body.innerText),
    sourceCount: window.ATLAS_EXAM?.helps?.length || 0,
    normCount: window.ATLAS_EXAM?.norms?.length || 0
  })`);
  await captureTo(examScreenshotPath);
  const recordsBeforeTutorial = await evaluate(`Object.keys(window.Atlas.storage.get().exam.records).length`);
  await evaluate(`location.hash = "/examen/run?period=night&mode=paused&tutorial=1"`);
  await wait(700);
  const examRun = await evaluate(`({
    card: Boolean(document.querySelector(".exam-swipe-card")),
    answerButtons: document.querySelectorAll("[data-exam-answer]").length,
    help: Boolean(document.querySelector(".exam-help")),
    note: Boolean(document.querySelector("[data-exam-note]")),
    gestureGuide: Boolean(document.querySelector(".exam-gesture-guide")),
    recordsAfterTutorial: Object.keys(window.Atlas.storage.get().exam.records).length
  })`);
  await evaluate(`location.hash = "/examen/run?period=night&mode=paused"`);
  await wait(500);
  await evaluate(`document.querySelector('[data-exam-answer="yes"]')?.click()`);
  await wait(450);
  const examInteraction = await evaluate(`({
    recordDays: Object.keys(window.Atlas.storage.get().exam.records).length,
    answerCount: Object.keys(Object.values(window.Atlas.storage.get().exam.records)[0]?.night?.answers || {}).length,
    currentCard: document.querySelector(".exam-swipe-card h1")?.textContent || ""
  })`);
  await evaluate(`location.hash = "/examen/week"`);
  await wait(500);
  const examWeek = await evaluate(`({ rows: document.querySelectorAll(".exam-grid-table tbody tr").length, cells: document.querySelectorAll(".exam-cell").length })`);
  await evaluate(`location.hash = "/examen/settings"`);
  await wait(450);
  const examSettings = await evaluate(`({ dayControls: document.querySelectorAll(".exam-day-selector input").length, quietControls: document.querySelectorAll('[name="quietFrom"], [name="quietTo"]').length })`);
  let manager = null;
  if (process.env.QA_MANAGER_URL) {
    await command("Page.navigate", { url: process.env.QA_MANAGER_URL });
    await wait(1800);
    manager = await evaluate(`({
      title: document.title,
      version: document.querySelector("#version")?.textContent,
      managedLinks: document.querySelectorAll("#managed-link-list .managed-media").length,
      channelCards: document.querySelectorAll(".channel-card").length,
      searchReady: Boolean(document.querySelector("#manager-search-form")),
      examTab: Boolean(document.querySelector('[data-tab="exam"]')),
      rawJsonVisible: [...document.querySelectorAll(".advanced-editor")].some(item => item.open),
      bodyText: document.body.innerText.slice(0, 3000)
    })`);
    await evaluate(`document.querySelector('[data-tab="exam"]')?.click()`);
    await wait(350);
    manager.exam = await evaluate(`({
      normRows: document.querySelectorAll("#exam-norm-list .managed-row").length,
      sourceRows: document.querySelectorAll("#exam-source-list .managed-row").length,
      hasNormForm: Boolean(document.querySelector("#exam-norm-form")),
      hasHelpForm: Boolean(document.querySelector("#exam-help-form")),
      hasSourceForm: Boolean(document.querySelector("#exam-source-form")),
      text: document.querySelector('[data-panel="exam"]')?.innerText.slice(0, 1000) || ""
    })`);
  }
  await evaluate(`location.hash = "/home"`);
  await wait(1000);

  const evaluation = await command("Runtime.evaluate", {
    expression: `({
      title: document.title,
      mainHtmlLength: document.querySelector("#main")?.innerHTML.length || 0
    })`,
    returnByValue: true
  });
  const result = evaluation.result?.value || {};
  await captureTo(screenshotPath);

  const report = {
    home,
    discover,
    discoverMobile,
    reader,
    examDashboard,
    examRun,
    examInteraction,
    examWeek,
    examSettings,
    manager,
    final: result,
    exceptions,
    consoleErrors: [...new Set(consoleErrors)],
    networkErrors: [...new Set(networkErrors)],
    screenshot: path.relative(root, screenshotPath).replaceAll("\\", "/"),
    examScreenshot: path.relative(root, examScreenshotPath).replaceAll("\\", "/")
  };
  console.log(JSON.stringify(report, null, 2));
  if (
    home.mainHtmlLength < 100 ||
    !home.introVisible ||
    home.updateBannerVisible ||
    discover.cards < 3 ||
    !discoverMobile.hasVideo ||
    Math.abs(discoverMobile.pageHeight - discoverMobile.feedHeight) > 2 ||
    reader.contentLength < 100 ||
    examDashboard.periodCards !== 2 ||
    examDashboard.normCount < 30 ||
    examDashboard.sourceCount < 1000 ||
    examRun.answerButtons < 3 ||
    examRun.recordsAfterTutorial !== recordsBeforeTutorial ||
    examInteraction.answerCount < 1 ||
    examWeek.rows < 30 ||
    examSettings.dayControls !== 14 ||
    examSettings.quietControls !== 2 ||
    (manager && (!manager.searchReady || manager.managedLinks < 1 || !manager.examTab || !manager.exam.hasNormForm || manager.exam.normRows < 30 || /Ruta API no encontrada/.test(manager.bodyText))) ||
    networkErrors.some(item => item.includes(`127.0.0.1:${previewPort}`)) ||
    exceptions.length
  ) process.exitCode = 1;
} finally {
  try { socket?.close(); } catch {}
  if (chrome && !chrome.killed) chrome.kill();
  if (!preview.killed) preview.kill();
}
