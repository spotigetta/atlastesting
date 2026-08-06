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
  assert.ok(registered.some(library => library.id === "preparadora-circulos" && library.unlockFeature));
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
