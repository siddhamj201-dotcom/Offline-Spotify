/**
 * scanner.js
 * Scans a local songs folder for .mp4 files using the File System Access API.
 * Falls back to <input webkitdirectory> for browsers without showDirectoryPicker.
 * Directory handle is persisted in IndexedDB so permission can be restored.
 */
const Scanner = (() => {
  const DB_NAME    = 'offline_spotify_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'data';
  const HANDLE_KEY = 'dirHandle';

  let _db        = null;
  let _dirHandle = null;
  let _fileMap   = {};   // filename -> File object
  let _objURLs   = {};   // filename -> object URL (cached)

  /* ---- IndexedDB helpers ---- */

  function _openDB() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME);
      req.onsuccess  = e => { _db = e.target.result; resolve(_db); };
      req.onerror    = () => reject(req.error);
    });
  }

  function _dbGet(key) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  function _dbSet(key, value) {
    return _openDB().then(db => new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    }));
  }

  /* ---- Public API ---- */

  /**
   * On startup: try to restore the saved directory handle from IndexedDB.
   * Returns true if permission is already granted (can auto-scan).
   * Returns false if permission is needed (show welcome overlay).
   */
  async function tryRestoreHandle() {
    try {
      const handle = await _dbGet(HANDLE_KEY);
      if (!handle) return false;
      _dirHandle = handle;

      // Check if we still have read permission
      const perm = await handle.queryPermission({ mode: 'read' });
      return perm === 'granted';
    } catch (e) {
      return false;
    }
  }

  /**
   * Re-request permission for a previously saved handle.
   * Must be called from a user-gesture handler.
   */
  async function requestPermission() {
    if (!_dirHandle) return false;
    try {
      const result = await _dirHandle.requestPermission({ mode: 'read' });
      return result === 'granted';
    } catch (e) {
      return false;
    }
  }

  /**
   * Open the OS folder picker. Saves handle to IndexedDB.
   * Must be called from a user-gesture handler.
   * Returns true on success, false if cancelled.
   */
  async function selectFolder() {
    // Modern browsers: File System Access API
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        _dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        await _dbSet(HANDLE_KEY, _dirHandle);
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
        console.warn('showDirectoryPicker failed, falling back:', e);
      }
    }

    // Fallback: <input type="file" webkitdirectory>
    return _selectFolderFallback();
  }

  function _selectFolderFallback() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'video/mp4,.mp4';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');

      input.addEventListener('change', () => {
        const files = Array.from(input.files || [])
          .filter(f => f.name.toLowerCase().endsWith('.mp4'));
        if (files.length === 0) { resolve(false); return; }

        // Revoke old URLs
        _revokeAll();
        _fileMap   = {};
        _dirHandle = null; // no persistent handle in fallback mode

        files.forEach(f => { _fileMap[f.name] = f; });
        resolve(true);
      });

      // Detect cancel (focus returns without change)
      window.addEventListener('focus', function onFocus() {
        window.removeEventListener('focus', onFocus);
        setTimeout(() => {
          if (Object.keys(_fileMap).length === 0) resolve(false);
        }, 500);
      }, { once: true });

      input.click();
    });
  }

  /**
   * Scan the selected directory for .mp4 files.
   * Returns sorted array of filenames.
   */
  async function scan() {
    _revokeAll();
    _fileMap = {};
    _objURLs = {};

    const filenames = [];

    if (_dirHandle) {
      // File System Access API path
      for await (const entry of _dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.mp4')) {
          try {
            const file = await entry.getFile();
            _fileMap[entry.name] = file;
            filenames.push(entry.name);
          } catch (e) {
            console.warn('Could not read file:', entry.name, e);
          }
        }
      }
    } else {
      // Fallback: files already in _fileMap from selectFolderFallback
      filenames.push(...Object.keys(_fileMap));
    }

    filenames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return filenames;
  }

  /** Get a playable object URL for a filename (cached). */
  function getObjectURL(filename) {
    if (_objURLs[filename]) return _objURLs[filename];
    const file = _fileMap[filename];
    if (!file) return null;
    const url = URL.createObjectURL(file);
    _objURLs[filename] = url;
    return url;
  }

  /** Get the raw File object for a filename. */
  function getFile(filename) {
    return _fileMap[filename] || null;
  }

  function hasHandle() {
    return !!(_dirHandle || Object.keys(_fileMap).length > 0);
  }

  function hasFiles() {
    return Object.keys(_fileMap).length > 0;
  }

  function _revokeAll() {
    Object.values(_objURLs).forEach(url => {
      try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
    });
    _objURLs = {};
  }

  return {
    tryRestoreHandle,
    requestPermission,
    selectFolder,
    scan,
    getObjectURL,
    getFile,
    hasHandle,
    hasFiles
  };
})();
