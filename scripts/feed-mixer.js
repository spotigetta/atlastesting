(function (global) {
  "use strict";

  function shuffled(items, random = Math.random) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function constrainedShuffle(items, options = {}) {
    const random = options.random || Math.random;
    const maxTypeRun = Math.max(1, Number(options.maxTypeRun || 2));
    const maxSourceRun = Math.max(1, Number(options.maxSourceRun || 2));
    const recent = new Set(options.recent || []);
    const weights = options.weights || {};
    const unique = [...new Map(items.filter(item => item?.id && !recent.has(item.id)).map(item => [item.id, item])).values()];
    const remaining = shuffled(unique, random);
    const result = [];
    const prefix = [...(options.prefix || [])].slice(-Math.max(maxTypeRun, maxSourceRun));

    function runLength(field, value) {
      let count = 0;
      const sequence = [...prefix, ...result];
      for (let index = sequence.length - 1; index >= 0 && (sequence[index]?.[field] || "") === value; index -= 1) count += 1;
      return count;
    }

    while (remaining.length) {
      const eligible = remaining.filter(item =>
        runLength("type", item.type || "other") < maxTypeRun &&
        runLength("source", item.source || item.author || "atlas") < maxSourceRun
      );
      const pool = eligible.length ? eligible : remaining;
      const scored = pool.map(item => ({
        item,
        score: random() * Math.max(.05, Number(weights[item.type] ?? 1))
      })).sort((a, b) => b.score - a.score);
      const selected = scored[0].item;
      result.push(selected);
      remaining.splice(remaining.indexOf(selected), 1);
    }
    return result;
  }

  global.AtlasFeedMixer = { shuffled, constrainedShuffle };
})(globalThis);
