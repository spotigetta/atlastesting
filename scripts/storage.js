(function () {
  "use strict";
  const root = window.Atlas = window.Atlas || {};
  const KEY = "mercaba-atlas-v2";
  const defaults = {
    favorites: { documents: [], shorts: [], collections: [], routes: [], questions: [] },
    seenDocuments: [],
    seenShorts: [],
    history: [],
    recentSearches: [],
    routeProgress: {},
    readerProgress: {},
    annotations: {},
    study: {},
    notifications: { daily: false, reading: false, news: false, routes: false, updates: true },
    exam: {
      config: {
        middayEnabled: false, middayTime: "14:05", middayDays: [1,2,3,4,5,6,0],
        nightEnabled: true, nightTime: "22:30", nightSecondEnabled: false, nightSecondTime: "23:15",
        nightDays: [1,2,3,4,5,6,0], quietFrom: "23:45", quietTo: "07:30", guardDay: 1,
        defaultMode: "quick", includeInSummaries: true
      },
      normOverrides: {}, customNorms: [], archivedNormIds: [], records: {}, notes: {},
      favoriteHelpIds: [], recentHelpIds: [], purposes: [], privateDrafts: {},
      dataVersion: 1
    },
    quiz: { correct: 0, total: 0 },
    settings: {
      theme: "system", contrast: false, randomShorts: false, onlyNewShorts: false, tutorialSeen: false, showReserveVideos: false,
      disabledVideoChannels: [], disabledMusicChannels: [], disabledInstagramChannels: [],
      magnetEnabled: true, magnetStrength: 34, magnetDelay: 120, magnetDuration: 300,
      auroraIntensity: 88, auroraSize: 100, motionLevel: 100, josemariaPortraitIntensity: 18,
      shortTextScale: 100, shortContentWidth: 720, shortAlignment: "mixed",
      interfaceScale: 100, cornerRadius: 100, fontStyle: "editorial", headingFont: "literata", bodyFont: "dm-sans", palette: "sage", surfaceStyle: "soft",
      compactMode: false, showExternalImages: true,
      homeOrder: ["exam", "today", "libraries", "reading", "history"], exploreOrder: [], exploreColors: {}, customizeHome: false, customizeExplore: false,
      libraryOrder: [], pinnedLibraries: [], hiddenLibraries: [], libraryColors: {}, libraryLabels: {},
      customChannels: { youtube: [], music: [], instagram: [] }, unlockedFeatures: []
    },
    lastLibrary: null,
    version: 5
  };

  function migrate(stored) {
    const value = stored && typeof stored === "object" ? stored : {};
    if (!value.version || value.version < 2) {
      value.settings ||= {};
      value.settings.shortTypeWeights ||= {
        video: .55, music: .7, reading: .8, document: .6,
        quote: 1.2, fact: 1.15, curiosity: 1.2, question: 1.1,
        prayer: 1.05, news: .9
      };
      value.version = 2;
    }
    if (value.version < 3) {
      value.exam ||= {};
      value.exam.dataVersion = 1;
      value.version = 3;
    }
    if (value.version < 4) {
      value.settings ||= {};
      value.settings.homeOrder = ["exam", ...(value.settings.homeOrder || []).filter(id => id !== "exam")];
      value.settings.libraryOrder ||= [];
      value.settings.pinnedLibraries ||= [];
      value.settings.hiddenLibraries ||= [];
      value.settings.libraryColors ||= {};
      value.settings.libraryLabels ||= {};
      value.version = 4;
    }
    if (value.version < 5) {
      value.settings ||= {};
      value.settings.customChannels ||= { youtube: [], music: [], instagram: [] };
      value.settings.unlockedFeatures ||= [];
      value.version = 5;
    }
    return value;
  }

  function merge(base, stored) {
    return {
      ...base, ...stored,
      favorites: { ...base.favorites, ...(stored?.favorites || {}) },
      settings: { ...base.settings, ...(stored?.settings || {}) },
      notifications: { ...base.notifications, ...(stored?.notifications || {}) },
      exam: {
        ...base.exam, ...(stored?.exam || {}),
        config: { ...base.exam.config, ...(stored?.exam?.config || {}) },
        normOverrides: { ...base.exam.normOverrides, ...(stored?.exam?.normOverrides || {}) },
        records: { ...base.exam.records, ...(stored?.exam?.records || {}) },
        notes: { ...base.exam.notes, ...(stored?.exam?.notes || {}) },
        privateDrafts: { ...base.exam.privateDrafts, ...(stored?.exam?.privateDrafts || {}) }
      },
      quiz: { ...base.quiz, ...(stored?.quiz || {}) }
    };
  }

  function load() {
    try { return merge(defaults, migrate(JSON.parse(localStorage.getItem(KEY) || "{}"))); }
    catch { return structuredClone(defaults); }
  }

  let state = load();
  const commit = () => localStorage.setItem(KEY, JSON.stringify(state));
  const uniqueFront = (items, value, max = 40) => [value, ...items.filter(item => item !== value)].slice(0, max);

  root.storage = {
    get: () => state,
    isFavorite(type, id) { return (state.favorites[type] || []).includes(id); },
    toggleFavorite(type, id) {
      const list = state.favorites[type] || [];
      state.favorites[type] = list.includes(id) ? list.filter(item => item !== id) : [id, ...list];
      commit();
      return state.favorites[type].includes(id);
    },
    addHistory(documentId) {
      state.history = uniqueFront(state.history, documentId, 50);
      state.seenDocuments = uniqueFront(state.seenDocuments, documentId, 500);
      commit();
    },
    addSearch(term) {
      const clean = term.trim();
      if (!clean) return;
      state.recentSearches = uniqueFront(state.recentSearches, clean, 12);
      commit();
    },
    markShortSeen(shortId) {
      state.seenShorts = uniqueFront(state.seenShorts || [], shortId, 2000);
      commit();
    },
    setLastLibrary(id) { state.lastLibrary = id; commit(); },
    toggleRouteStep(routeId, documentId) {
      const completed = state.routeProgress[routeId] || [];
      state.routeProgress[routeId] = completed.includes(documentId)
        ? completed.filter(item => item !== documentId)
        : [...completed, documentId];
      commit();
      return state.routeProgress[routeId];
    },
    getReaderProgress(documentId) { return state.readerProgress[documentId] || null; },
    saveReaderProgress(documentId, progress) {
      state.readerProgress[documentId] = { ...(state.readerProgress[documentId] || {}), ...progress, updatedAt: new Date().toISOString() };
      commit();
    },
    getAnnotations(documentId) { return state.annotations[documentId] || []; },
    addAnnotation(documentId, annotation) {
      const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), ...annotation };
      state.annotations[documentId] = [item, ...(state.annotations[documentId] || [])];
      commit();
      return item;
    },
    removeAnnotation(documentId, annotationId) {
      state.annotations[documentId] = (state.annotations[documentId] || []).filter(item => item.id !== annotationId);
      commit();
    },
    recordReading(documentId, milliseconds, collectionIds = []) {
      const day = new Date().toISOString().slice(0, 10);
      const current = state.study[day] || { milliseconds: 0, documents: [], collections: [] };
      current.milliseconds += Math.max(0, milliseconds);
      current.documents = uniqueFront(current.documents, documentId, 200);
      collectionIds.forEach(id => { current.collections = uniqueFront(current.collections, id, 200); });
      state.study[day] = current;
      commit();
    },
    setSetting(key, value) { state.settings[key] = value; commit(); },
    unlockFeature(id) { state.settings.unlockedFeatures = uniqueFront(state.settings.unlockedFeatures || [], id, 30); commit(); },
    isFeatureUnlocked(id) { return (state.settings.unlockedFeatures || []).includes(id); },
    setNotification(key, value) { state.notifications[key] = Boolean(value); commit(); },
    updateExamConfig(patch) { state.exam.config = { ...state.exam.config, ...patch }; commit(); },
    updateExamNorm(normId, patch) {
      state.exam.normOverrides[normId] = { ...(state.exam.normOverrides[normId] || {}), ...patch };
      commit();
    },
    upsertCustomNorm(norm) {
      const existing = state.exam.customNorms.findIndex(item => item.id === norm.id);
      const item = { ...norm, id: norm.id || `personal-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, custom: true, updatedAt: new Date().toISOString() };
      if (existing >= 0) state.exam.customNorms.splice(existing, 1, item); else state.exam.customNorms.push(item);
      commit(); return item;
    },
    archiveExamNorm(normId, archived = true) {
      state.exam.archivedNormIds = archived
        ? uniqueFront(state.exam.archivedNormIds, normId, 500)
        : state.exam.archivedNormIds.filter(id => id !== normId);
      commit();
    },
    setExamAnswer(date, period, normId, answer) {
      state.exam.records[date] ||= {};
      state.exam.records[date][period] ||= { status: "started", mode: "quick", answers: {}, updatedAt: new Date().toISOString() };
      state.exam.records[date][period].answers[normId] = { ...(state.exam.records[date][period].answers[normId] || {}), answer, updatedAt: new Date().toISOString() };
      state.exam.records[date][period].status = "started";
      state.exam.records[date][period].updatedAt = new Date().toISOString();
      commit();
    },
    setExamSession(date, period, patch) {
      state.exam.records[date] ||= {};
      state.exam.records[date][period] = { answers: {}, ...(state.exam.records[date][period] || {}), ...patch, updatedAt: new Date().toISOString() };
      commit();
    },
    setExamNote(date, period, normId, note, review = false) {
      const key = `${date}|${period}|${normId}`;
      state.exam.notes[key] = { text: String(note || ""), review: Boolean(review), updatedAt: new Date().toISOString() };
      commit();
    },
    toggleExamHelp(helpId) {
      const list = state.exam.favoriteHelpIds;
      state.exam.favoriteHelpIds = list.includes(helpId) ? list.filter(id => id !== helpId) : [helpId, ...list];
      commit(); return state.exam.favoriteHelpIds.includes(helpId);
    },
    rememberExamHelp(helpId) { state.exam.recentHelpIds = uniqueFront(state.exam.recentHelpIds, helpId, 120); commit(); },
    setExamPurpose(purpose) {
      const item = { id: purpose.id || `purpose-${Date.now()}`, createdAt: purpose.createdAt || new Date().toISOString(), ...purpose };
      state.exam.purposes = [item, ...state.exam.purposes.filter(current => current.id !== item.id)].slice(0, 200);
      commit(); return item;
    },
    setExamPrivateDraft(key, value) { state.exam.privateDrafts[key] = { ...value, updatedAt: new Date().toISOString() }; commit(); },
    recordQuiz(correct) {
      state.quiz.total += 1;
      if (correct) state.quiz.correct += 1;
      commit();
    },
    export() {
      return JSON.stringify({ exportedAt: new Date().toISOString(), app: "ATLAS", data: state }, null, 2);
    },
    import(text) {
      const parsed = JSON.parse(text);
      if (parsed.app !== "ATLAS" || !parsed.data) throw new Error("Archivo de Atlas no válido");
      state = merge(defaults, parsed.data);
      commit();
    },
    clear() { localStorage.removeItem(KEY); state = structuredClone(defaults); }
  };
})();
