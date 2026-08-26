from __future__ import annotations

import json
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.edge.service import Service

ROOT = Path(__file__).resolve().parents[1]
DRIVER = ROOT / "generated" / "qa-5.9" / "driver" / "msedgedriver.exe"
BASE = "http://127.0.0.1:8775/"

options = Options()
options.add_argument("--headless=new")
options.add_argument("--window-size=390,844")
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
    if close_buttons:
        close_buttons[0].click()

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

    route("preguntar?q=matrimonio")
    report["checks"]["askRecommendsSpecialist"] = "CanonIA" in text("#main")
    report["checks"]["specialistsOpenByDefault"] = len(driver.find_elements("css selector", ".v7-specialist-direct")) >= 10
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
        cinematic[0].click()
        time.sleep(0.5)
    report["checks"]["salvationCinematic"] = bool(driver.find_elements("css selector", ".salvation-app.is-cinematic"))

    route("opus-dei")
    unlock = driver.find_elements("css selector", "#feature-unlock-form")
    if unlock:
        unlock[0].find_element("css selector", "input").send_keys("OD")
        unlock[0].find_element("css selector", "button").click()
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
        lock[0].click()
        time.sleep(0.7)
    route("examen")
    report["checks"]["generalExamAfterRelock"] = "Comenzar examen breve" in text("#main")
    route("examen/general")
    report["checks"]["generalExamQuestions"] = len(driver.find_elements("css selector", ".v7-general-session li")) == 9

    route("")
    search = driver.find_elements("css selector", ".v7-global-search")
    if search:
        search[0].click()
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
    print(json.dumps(report, ensure_ascii=True, indent=2))
finally:
    driver.quit()
