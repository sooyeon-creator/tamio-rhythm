// Stores video files the user picks locally in this browser's IndexedDB, so
// "저장" once means it shows up in a picker on future visits — no upload,
// no server, no repo: the bytes never leave this device.
const VideoStore = (() => {
  const DB_NAME = "tamio-video-store";
  const STORE = "videos";
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function keyFor(file) {
    return `${file.name}::${file.size}`;
  }

  async function saveVideo(file) {
    const db = await openDb();
    const key = keyFor(file);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ key, name: file.name, size: file.size, type: file.type, blob: file, savedAt: Date.now() });
      tx.oncomplete = () => resolve(key);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function listVideos() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result.map((v) => ({ key: v.key, name: v.name, size: v.size })));
      req.onerror = () => reject(req.error);
    });
  }

  async function getVideo(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function deleteVideo(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return { keyFor, saveVideo, listVideos, getVideo, deleteVideo };
})();
