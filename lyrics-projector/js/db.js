/* 极简 IndexedDB 键值存储（IndexedDB 不可用时退回 localStorage） */
(function (g) {
  const LP = g.LP = g.LP || {};
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('lyrics-projector', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    return dbp;
  }
  LP.db = {
    async get(key, def) {
      try {
        const db = await open();
        return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => res(q.result === undefined ? def : q.result); q.onerror = () => rej(q.error); });
      } catch (e) { const v = localStorage.getItem('lp:' + key); return v == null ? def : JSON.parse(v); }
    },
    async set(key, val) {
      try {
        const db = await open();
        await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      } catch (e) { localStorage.setItem('lp:' + key, JSON.stringify(val)); }
    }
  };
})(window);
