from __future__ import annotations

import json
import os
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.edge.service import Service

ROOT = Path(__file__).resolve().parents[1]
DRIVER = ROOT / "generated" / "qa-5.9" / "driver" / "msedgedriver.exe"
BASE = os.environ.get("ATLAS_QA_BASE", "http://127.0.0.1:8775/")
WINDOW_SIZE = os.environ.get("ATLAS_QA_SIZE", "390,844")

options = Options()
options.add_argument("--headless=new")
options.add_argument(f"--window-size={WINDOW_SIZE}")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

driver = webdriver.Edge(service=Service(str(DRIVER)), options=options)
report: dict[str, object] = {"routes": [], "checks": {}}

def route(value: str, wait: float = 0.6) -> None:
    driver.execute_script("location.hash = arguments[0]", f"#/{value}")
    time.sleep(wait)

def text(selector: str) -> str:
    nodes = driver.find_elements("css selector", selector)
    return nodes[0].text if nodes else ""

try:
    started = time.perf_counter()
    driver.get(BASE)
    for _ in range(40):
        if driver.find_elements("css selector", "#main h1"):
            break
        time.sleep(0.1)
    report["firstHeadingSeconds"] = round(time.perf_counter() - started, 3)
    close_buttons = driver.find_elements("css selector", "[data-action=tutorial-close]")
    if close_buttons and close_buttons[0].is_displayed():
        driver.execute_script("arguments[0].click()", close_buttons[0])
    intro_buttons = driver.find_elements("css selector", "[data-action=intro-close]")
    if intro_buttons:
        driver.execute_script("arguments[0].click()", intro_buttons[-1])
        time.sleep(0.35)
        driver.execute_script("const intro=document.querySelector('#atlas-intro'); if(intro) intro.hidden=true; document.body.classList.remove('modal-open')")

    routes = [
        "", "biblioteca", "preguntar?q=matrimonio", "rezar", "formarse", "formarse/estudiar",
        "opus-dei", "mi-atlas", "more", "descubre-atlas", "examen", "explore", "library/doctrine/documents",
        "bible", "salvation", "discover", "spiritual/saints", "saved", "notifications"
    ]
    for value in routes:
        route(value)
        headings = driver.find_elements("css selector", "#main h1, #main h2")
        report["routes"].append({
            "route": value or "home",
            "heading": headings[0].text if headings else "NONE",
            "overflow": driver.execute_script("return document.documentElement.scrollWidth > innerWidth + 1"),
        })

    # Audit the principal interfaces in both themes. The contrast detector only
    # evaluates text whose effective background can be resolved to a solid colour;
    # artistic gradients are covered by the screenshots and explicit CSS tokens.
    contrast_routes = [
        "", "biblioteca", "preguntar", "rezar", "formarse", "opus-dei",
        "mi-atlas", "spiritual/gospel", "spiritual/saints", "examen",
        "bible", "salvation", "discover", "faq"
    ]
    report["themes"] = {}
    contrast_script = r"""
        const parse = value => {
          const match = value.match(/[\d.]+/g);
          if (!match) return null;
          const nums = match.map(Number);
          return {r:nums[0], g:nums[1], b:nums[2], a:nums.length > 3 ? nums[3] : 1};
        };
        const luminance = c => {
          const channel = n => { n /= 255; return n <= .04045 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4); };
          return .2126 * channel(c.r) + .7152 * channel(c.g) + .0722 * channel(c.b);
        };
        const ratio = (a,b) => { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
        const visible = el => {
          const s=getComputedStyle(el), r=el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > .05 && r.width > 1 && r.height > 1;
        };
        const findings=[];
        for (const el of document.querySelectorAll('#main *')) {
          if (!visible(el) || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          const style=getComputedStyle(el), fg=parse(style.color);
          if (!fg) continue;
          let node=el, bg=null, gradient=false;
          while (node && node !== document.documentElement) {
            const ns=getComputedStyle(node);
            if (ns.backgroundImage !== 'none') gradient=true;
            const candidate=parse(ns.backgroundColor);
            if (candidate && candidate.a > .92) { bg=candidate; break; }
            node=node.parentElement;
          }
          if (!bg || gradient) continue;
          const size=parseFloat(style.fontSize), weight=parseInt(style.fontWeight,10) || 400;
          const large=size >= 24 || (size >= 18.66 && weight >= 700);
          const value=ratio(fg,bg), minimum=large ? 3 : 4.5;
          if (value + .05 < minimum) findings.push({
            text:el.textContent.trim().replace(/\s+/g,' ').slice(0,90),
            selector:el.className ? String(el.className).split(/\s+/).slice(0,3).join('.') : el.tagName.toLowerCase(),
            parent:el.parentElement?.className ? String(el.parentElement.className).split(/\s+/).slice(0,3).join('.') : '',
            color:style.color, background:`rgb(${bg.r}, ${bg.g}, ${bg.b})`,
            ratio:+value.toFixed(2), minimum
          });
        }
        return findings.slice(0,30);
    """
    for theme in ("light", "dark"):
        theme_rows = []
        for value in contrast_routes:
            route(value)
            driver.execute_script("document.documentElement.dataset.theme=arguments[0]", theme)
            time.sleep(0.15)
            theme_rows.append({
                "route": value or "home",
                "heading": text("#main h1, #main h2") or "NONE",
                "overflow": driver.execute_script("return document.documentElement.scrollWidth > innerWidth + 1"),
                "lowContrast": driver.execute_script(contrast_script),
            })
            if value in ("formarse", "rezar", "spiritual/gospel", "preguntar"):
                safe_route = value.replace("/", "-")
                scroll_positions = {"formarse": 720, "rezar": 760, "spiritual/gospel": 700, "preguntar": 780}
                driver.execute_script("scrollTo(0, arguments[0])", scroll_positions[value])
                time.sleep(0.12)
                driver.save_screenshot(str(ROOT / "generated" / "qa" / f"{safe_route}-{theme}-{WINDOW_SIZE.replace(',', 'x')}.png"))
                driver.execute_script("scrollTo(0, 0)")
        report["themes"][theme] = theme_rows

    route("preguntar?q=matrimonio")
    report["checks"]["askRecommendsSpecialist"] = "CanonIA" in text("#main")
    report["checks"]["specialistsOpenByDefault"] = len(driver.find_elements("css selector", ".v7-specialist-direct")) >= 10
    report["checks"]["specialistsExplainSources"] = len(driver.find_elements("css selector", ".v7-source-preview")) >= 10
    report["checks"]["specialistsOpenNotebook"] = all("notebook" in (node.get_attribute("href") or "") for node in driver.find_elements("css selector", ".v7-specialist-direct"))

    route("")
    report["checks"]["homeDailyAudio"] = bool(driver.find_elements("css selector", ".v7-daily-listen audio"))
    route("rezar")
    report["checks"]["prayerDailyAudioAndMass"] = bool(driver.find_elements("css selector", ".v7-prayer-now audio")) and "misas.org" in (driver.find_elements("css selector", ".v7-prayer-now>a")[0].get_attribute("href") or "")
    route("library/doctrine/documents")
    report["checks"]["combinedShelfAndDocuments"] = bool(driver.find_elements("css selector", ".library-visual-block .shelf")) and bool(driver.find_elements("css selector", ".library-documents-block .document-grid"))
    route("salvation", 1.0)
    cinematic = driver.find_elements("css selector", "[data-salvation-action=cinematic]")
    if cinematic:
        driver.execute_script("arguments[0].click()", cinematic[0])
        time.sleep(0.5)
    report["checks"]["salvationCinematic"] = bool(driver.find_elements("css selector", ".salvation-app.is-cinematic"))

    route("opus-dei")
    unlock = driver.find_elements("css selector", "#feature-unlock-form")
    if unlock:
        unlock[0].find_element("css selector", "input").send_keys("OD")
        driver.execute_script("arguments[0].click()", unlock[0].find_element("css selector", "button"))
        time.sleep(0.8)
    report["checks"]["odUnlock"] = "Preparador de Círculos" in text("#main") and "activos" in text("#main").lower()
    report["checks"]["opusOfficialVideos"] = "youtube.com/@opusdei/videos" in (driver.find_elements("css selector", ".v7-opus-grid a")[2].get_attribute("href") or "")
    report["checks"]["opusMarkdownResources"] = len(driver.find_elements("css selector", ".v7-opus-resources a")) == 38

    route("salvation", 1.0)
    source_links = driver.find_elements("css selector", ".salvation-source a")
    report["checks"]["hahnLinkedToSalvation"] = bool(source_links) and "history-un-padre-fiel-a-sus-promesas-scott-hahn" in (source_links[0].get_attribute("href") or "")

    route("examen")
    report["checks"]["memberExamAfterUnlock"] = "Semana" in text("#main") and "Mi plan de vida" in text("#main")

    route("mi-atlas")
    lock = driver.find_elements("css selector", "[data-lock-feature]")
    if lock:
        driver.execute_script("arguments[0].scrollIntoView({block:'center'})", lock[0])
        time.sleep(0.2)
        driver.execute_script("arguments[0].click()", lock[0])
        time.sleep(0.7)
    route("examen")
    report["checks"]["generalExamAfterRelock"] = "Comenzar examen breve" in text("#main")
    route("examen/general")
    report["checks"]["generalExamQuestions"] = len(driver.find_elements("css selector", ".v7-general-session li")) == 9

    route("")
    search = driver.find_elements("css selector", ".v7-global-search")
    if search:
        driver.execute_script("arguments[0].click()", search[0])
        time.sleep(0.3)
    search_input = driver.find_elements("id", "global-search")
    if search_input:
        search_input[0].send_keys("matrimonio")
        time.sleep(0.7)
    report["checks"]["globalSearch"] = bool(driver.find_elements("css selector", "#search-results article, #search-results a"))

    driver.execute_script("document.querySelector('[data-action=close-search]')?.click()")
    first_document = driver.execute_script("return window.Atlas?.data?.documents?.[0]?.id || ''")
    if first_document:
        route(f"reader/{first_document}", 2.0)
    report["checks"]["reader"] = bool(driver.find_elements("css selector", ".reader-app, .reader-document"))

    route("descubre-atlas")
    driver.save_screenshot(str(ROOT / "generated" / "qa" / "architecture-story-mobile.png"))
    errors = [entry for entry in driver.get_log("browser") if entry["level"] == "SEVERE"]
    report["errors"] = errors
    report_json = json.dumps(report, ensure_ascii=True, indent=2)
    (ROOT / "generated" / "qa").mkdir(parents=True, exist_ok=True)
    (ROOT / "generated" / "qa" / "architecture-report.json").write_text(report_json, encoding="utf-8")
    print(report_json)
finally:
    driver.quit()
