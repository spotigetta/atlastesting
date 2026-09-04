from pathlib import Path
from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.support.ui import WebDriverWait
import time

root = Path(__file__).resolve().parents[1] / "generated" / "qa"
root.mkdir(parents=True, exist_ok=True)
options = Options()
options.add_argument("--headless=new")
options.add_argument("--window-size=1440,1000")
driver = webdriver.Edge(options=options)
try:
    for name, url in (
        ("home-clear", "http://127.0.0.1:8766/#/"),
        ("ask-clear", "http://127.0.0.1:8766/#/preguntar"),
    ):
        driver.get(url)
        WebDriverWait(driver, 15).until(lambda item: item.execute_script("return document.readyState") == "complete")
        WebDriverWait(driver, 15).until(lambda item: item.find_elements("css selector", "#main .page"))
        close = driver.find_elements("css selector", "[data-action='intro-close']")
        if close and close[0].is_displayed():
            close[0].click()
            WebDriverWait(driver, 5).until(lambda item: not item.find_element("id", "atlas-intro").is_displayed())
        time.sleep(1.4)
        driver.save_screenshot(str(root / f"{name}.png"))
finally:
    driver.quit()
