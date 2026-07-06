/**
 * library.js
 * localStorage-based library management.
 * Stores track metadata (title, favorite, playCount, etc.)
 */
const Library = (() => {
  const STORAGE_KEY = 'offline_spotify_library';
  const PLAYLISTS_KEY = 'offline_spotify_playlists_v1';
  let _data = [];
  let _playlists = [];

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      _data = saved ? JSON.parse(saved) : [];
      
      const savedPlaylists = localStorage.getItem(PLAYLISTS_KEY);
      _playlists = savedPlaylists ? JSON.parse(savedPlaylists) : [];
    } catch (e) {
      _data = [];
      _playlists = [];
    }
    return _data;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_data));
      localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(_playlists));
    } catch (e) {
      console.warn('Library save failed:', e);
    }
  }

  function get() {
    return _data;
  }

  /**
   * Sync filenames array with existing library.
   * New files get fresh entries; existing files keep their metadata.
   * Removed files are dropped.
   */
  function sync(filenames) {
    const existingMap = {};
    _data.forEach(t => { existingMap[t.filename] = t; });

    _data = filenames.map(filename => {
      if (existingMap[filename]) return existingMap[filename];
      return {
        id: _uid(),
        filename,
        title: _cleanTitle(filename),
        duration: 0,
        thumbnail: null,
        favorite: false,
        playCount: 0,
        lastPlayed: null,
        resumePosition: 0
      };
    });

    save();
    return _data;
  }

  function update(id, changes) {
    const track = _data.find(t => t.id === id);
    if (track) {
      Object.assign(track, changes);
      save();
    }
    return track || null;
  }

  function getById(id) {
    return _data.find(t => t.id === id) || null;
  }

  function _cleanTitle(filename) {
    return filename
      .replace(/\.mp4$/i, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  /* ---- Playlists ---- */

  function getPlaylists() {
    return _playlists;
  }

  function createPlaylist(name) {
    if (!name || !name.trim()) return;
    const pl = { id: 'pl_' + _uid(), name: name.trim(), tracks: [] };
    _playlists.push(pl);
    save();
    return pl;
  }

  function renamePlaylist(id, newName) {
    if (!newName || !newName.trim()) return;
    const pl = _playlists.find(p => p.id === id);
    if (pl) {
      pl.name = newName.trim();
      save();
    }
  }

  function deletePlaylist(id) {
    _playlists = _playlists.filter(p => p.id !== id);
    save();
  }

  function addTrackToPlaylist(trackId, playlistId) {
    const pl = _playlists.find(p => p.id === playlistId);
    if (pl && !pl.tracks.includes(trackId)) {
      pl.tracks.push(trackId);
      save();
    }
  }

  function removeTrackFromPlaylist(trackId, playlistId) {
    const pl = _playlists.find(p => p.id === playlistId);
    if (pl) {
      pl.tracks = pl.tracks.filter(id => id !== trackId);
      save();
    }
  }

  return { load, save, sync, get, getById, update, getPlaylists, createPlaylist, renamePlaylist, deletePlaylist, addTrackToPlaylist, removeTrackFromPlaylist };
})();
