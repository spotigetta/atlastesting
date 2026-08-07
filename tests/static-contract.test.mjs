import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("todas las bibliotecas registradas están dentro del repositorio", () => {
  const directory = path.join(root, "source", "libraries");
  const libraries = fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{2,}_IA_/.test(entry.name));
  const registered = JSON.parse(fs.readFileSync(path.join(root, "content", "libraries.json"), "utf8"));
  assert.equal(libraries.length, registered.length);
  const preparador = registered.find(library => library.id === "preparadora-circulos");
  assert.equal(preparador.folder, "10_IA_Preparador_de_Circulos");
  assert.equal(preparador.unlockFeature, "preparadora-circulos");
  assert.equal(preparador.notebookUrl, "https://notebook.google.com/notebook/ef6005d5-dacf-4f99-b3c9-b853a0b365d4");
});

test("OrtodoxIA y el Preparador usan infografías diferentes y existentes", () => {
  const app = fs.readFileSync(path.join(root, "scripts", "app.js"), "utf8");
  const sync = fs.readFileSync(path.join(root, "generators", "sync-infographics.mjs"), "utf8");
  assert.match(app, /ortodoxia:\s*\{\s*file:\s*"infoOrtodoxIA\.html"/);
  assert.match(app, /"preparadora-circulos":\s*\{\s*file:\s*"infoCirculos\.html"/);
  for (const file of ["infoOrtodoxIA.html", "infoCirculos.html"]) {
    assert.match(sync, new RegExp(file.replace(".", "\\.")));
    assert.ok(fs.existsSync(path.join(root, "..", "infografiasfinal", file)));
  }
});

test("la PWA no llama a endpoints del servidor local", () => {
  const files = fs.readdirSync(path.join(root, "scripts")).filter(file => file.endsWith(".js"));
  const offending = files.filter(file => /fetch\(\s*[`"']\/api\//.test(fs.readFileSync(path.join(root, "scripts", file), "utf8")));
  assert.deepEqual(offending, []);
});

test("el arranque público usa datos JSON y rutas relativas", () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(index, /scripts\/bootstrap\.js/);
  assert.doesNotMatch(index, /data\/catalog\.js/);
  assert.doesNotMatch(index, /(?:src|href)=["']\/(?!\/)/);
});

test("los workflows no contienen credenciales locales", () => {
  const workflows = fs.readdirSync(path.join(root, ".github", "workflows"))
    .map(file => fs.readFileSync(path.join(root, ".github", "workflows", file), "utf8"))
    .join("\n");
  assert.doesNotMatch(workflows, /ghp_[A-Za-z0-9]+|github_pat_/);
  assert.match(workflows, /secrets\.GITHUB_TOKEN/);
});
