import assert from "node:assert/strict";
import test from "node:test";

await import("../scripts/feed-mixer.js");
const { constrainedShuffle } = globalThis.AtlasFeedMixer;

const types = ["quote", "video", "fact", "music", "question", "news"];
const items = Array.from({ length: 180 }, (_, index) => ({
  id: `item-${index}`,
  type: types[index % types.length],
  source: `source-${index % 12}`
}));

const seededRandom = seed => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

const longestRun = (values, selector) => {
  let longest = 0;
  let current = 0;
  let previous;
  for (const value of values) {
    const selected = selector(value);
    current = selected === previous ? current + 1 : 1;
    previous = selected;
    longest = Math.max(longest, current);
  }
  return longest;
};

test("la mezcla conserva IDs únicos", () => {
  const result = constrainedShuffle(items, { random: seededRandom(1) });
  assert.equal(result.length, items.length);
  assert.equal(new Set(result.map(item => item.id)).size, items.length);
});

test("la mezcla limita rachas de tipo y proveedor", () => {
  const result = constrainedShuffle(items, { random: seededRandom(2), maxTypeRun: 2, maxSourceRun: 2 });
  assert.ok(longestRun(result, item => item.type) <= 2);
  assert.ok(longestRun(result, item => item.source) <= 2);
});

test("dos recargas producen órdenes distintos", () => {
  const first = constrainedShuffle(items, { random: seededRandom(3) }).map(item => item.id);
  const second = constrainedShuffle(items, { random: seededRandom(4) }).map(item => item.id);
  assert.notDeepEqual(first, second);
});

test("la ventana reciente se excluye", () => {
  const result = constrainedShuffle(items, { recent: ["item-1", "item-2"], random: seededRandom(5) });
  assert.ok(!result.some(item => item.id === "item-1" || item.id === "item-2"));
});
