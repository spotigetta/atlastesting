(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  function parse() {
    const raw = location.hash.slice(1) || "/";
    const [path, queryString = ""] = raw.split("?");
    const segments = path.split("/").filter(Boolean);
    return { raw, path, segments, name: segments[0] || "home", query: new URLSearchParams(queryString) };
  }
  function go(path) { location.hash = path.startsWith("#") ? path.slice(1) : path; }
  root.router = { parse, go };
})();
