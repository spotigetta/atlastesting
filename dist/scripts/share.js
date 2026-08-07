(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  async function copy(text) {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement("textarea");
      area.value = text; document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
    }
  }

  async function share({ title, text, url = location.href }) {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return "shared"; }
      catch (error) { if (error.name === "AbortError") return "cancelled"; }
    }
    await copy(`${text}\n${url}`);
    return "copied";
  }

  function whatsapp(text, url = location.href) {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  }

  root.share = { copy, share, whatsapp };
})();
