import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("todos los schemas son JSON válidos y declaran un identificador", () => {
  const files = fs.readdirSync(path.join(root, "schemas")).filter(file => file.endsWith(".json"));
  assert.ok(files.length >= 4);
  for (const file of files) {
    const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas", file), "utf8"));
    assert.ok(schema.$id);
    assert.equal(schema.type, "object");
  }
});
