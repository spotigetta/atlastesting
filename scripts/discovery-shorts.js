(function () {
  "use strict";
  const A = window.Atlas = window.Atlas || {};
  function build(catalog, discovery) {
    const sources = new Map((catalog.libraries || []).flatMap(library => (library.documents || []).map(doc => [doc.id, {doc, library}])));
    return (discovery?.topics || []).flatMap(topic => {
      const source = topic.sources?.find(item => {
        const entry = sources.get(item.id);
        return item.quote && entry && !entry.library.unlockFeature && !entry.doc.unlockFeature;
      });
      if (!source || !topic.question || !topic.answer) return [];
      return [{id:`library-question-${topic.id}`, type:"question", libraryId:sources.get(source.id).library.id,
        title:topic.question, text:"Una pregunta para leer con más atención.", reveal:topic.answer,
        reference:`${source.title} · ${source.location || "Pasaje enlazado"} · Síntesis editorial de Atlas`,
        sourceDocumentId:source.id, sourceReaderUrl:source.readerUrl,
        url:`#/mapa-tematico?topic=${encodeURIComponent(topic.id)}`, verified:true, editorial:true}];
    });
  }
  A.discoveryShorts = {build};
  if (window.ATLAS_CATALOG && window.ATLAS_DISCOVERY_LIBRARY) {
    const shorts = window.ATLAS_CATALOG.shorts || (window.ATLAS_CATALOG.shorts = []);
    const ids = new Set(shorts.map(item => item.id));
    for (const item of build(window.ATLAS_CATALOG, window.ATLAS_DISCOVERY_LIBRARY)) if (!ids.has(item.id)) shorts.push(item);
  }
})();
