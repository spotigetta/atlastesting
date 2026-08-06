import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const exam = JSON.parse(fs.readFileSync(new URL("../data/examen.json", import.meta.url), "utf8"));
const storageSource = fs.readFileSync(new URL("../scripts/storage.js", import.meta.url), "utf8");

test("el examen tiene un catálogo estable, editable y sin IDs repetidos", () => {
  assert.ok(exam.norms.length >= 30);
  assert.equal(new Set(exam.norms.map(norm => norm.id)).size, exam.norms.length);
  for (const norm of exam.norms) {
    assert.ok(norm.id && norm.name && norm.frequency?.type);
    assert.ok(Array.isArray(norm.periods) && norm.periods.length);
    assert.ok(Array.isArray(norm.tags));
  }
});

test("la biblioteca ofrece ayudas temáticas con procedencia y contexto", () => {
  assert.ok(exam.helps.length >= 700);
  assert.equal(new Set(exam.helps.map(help => help.id)).size, exam.helps.length);
  const quotations = exam.helps.filter(help => help.kind === "quotation");
  assert.ok(quotations.length >= 650);
  for (const quote of quotations) assert.ok(quote.text && quote.author && quote.reference && quote.normIds?.length && quote.relevanceBasis);
  for (const norm of exam.norms) assert.ok(exam.helps.filter(help => help.normIds?.includes(norm.id)).length >= 2, `Faltan ayudas para ${norm.id}`);
  assert.ok(exam.helps.some(help => help.work === "Camino, punto 90" && help.normIds.includes("oracion-manana") && help.sourceDocumentId && help.sourceQuery));
});

test("los consejos editoriales no se presentan como citas", () => {
  const editorial = exam.helps.filter(help => help.author === "Equipo editorial de Atlas");
  assert.ok(editorial.length >= 60);
  assert.ok(editorial.every(help => help.kind !== "quotation"));
});

test("el modelo personal distingue configuración, histórico y notas", () => {
  for (const field of ["config", "normOverrides", "customNorms", "archivedNormIds", "records", "notes", "favoriteHelpIds", "privateDrafts"]) {
    assert.match(storageSource, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(storageSource, /streak|leaderboard|holinessScore|spiritualScore/i);
});
