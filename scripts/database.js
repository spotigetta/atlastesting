(function () {
  "use strict";
  const DB_NAME = "atlas-content";
  const DB_VERSION = 1;
  const STORE = "json";
  let connection;

  function open() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => null);
    return connection;
  }

  async function operation(mode, callback) {
    const database = await open();
    if (!database) return undefined;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = callback(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => undefined);
  }

  const api = {
    get: key => operation("readonly", store => store.get(key)),
    put: (key, value) => operation("readwrite", store => store.put({ value, cachedAt: Date.now() }, key)),
    delete: key => operation("readwrite", store => store.delete(key)),
    clear: () => operation("readwrite", store => store.clear())
  };
  window.AtlasDatabase = api;
})();
