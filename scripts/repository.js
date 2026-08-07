(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};

  const documents = {
    list(filters = {}) {
      return root.data.accessibleDocuments().filter(document =>
        (!filters.libraryId || document.libraryId === filters.libraryId) &&
        (!filters.category || document.category === filters.category) &&
        (!filters.status || document.status === filters.status)
      );
    },
    get(id) {
      const document = root.data.documentMap.get(id);
      return document && root.data.libraryAccessible(document.libraryId) ? document : null;
    },
    search(query, filters = {}) {
      const filter = filters.libraryId ? `library:${filters.libraryId}` : "all";
      return root.search.run(query, filter).documents;
    },
    searchText(query, filters = {}) {
      const filter = filters.libraryId ? `library:${filters.libraryId}` : "all";
      return root.search.runFullText(query, filter);
    }
  };

  const maintenance = {
    findDuplicates() {
      const titles = new Map();
      for (const document of root.data.accessibleDocuments()) {
        const key = root.data.normalize(document.title).replace(/\s+/g, " ").trim();
        titles.set(key, [...(titles.get(key) || []), document]);
      }
      return [...titles.values()].filter(group => group.length > 1);
    }
  };

  root.repository = {
    libraries: {
      list: () => root.data.catalog.libraries.filter(library => root.data.libraryAccessible(library.id)),
      get: id => root.data.libraryAccessible(id) ? root.data.libraryMap.get(id) || null : null
    },
    documents,
    shorts: {
      list: () => [...root.data.catalog.shorts],
      sample: options => window.AtlasFeedMixer.constrainedShuffle(root.data.catalog.shorts, options)
    },
    providers: {
      status: () => window.AtlasRuntime.fetchJson("data/provider-health.json", { fresh: true })
    },
    maintenance
  };
})();
