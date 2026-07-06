/**
 * app.js
 * Main orchestrator — boots the app, wires all modules together.
 * Exposed as window.App so inline onclick handlers can call App.playTrack() etc.
 */
const App = (() => {
  let _library       = [];
  let _currentFilter = 'all';
  let _selectedPlaylistId = null;
  let _nowPlayingId  = null;

  /* ---- Boot ---- */

  async function init() {
    // Load any saved library from localStorage into memory
    _library = Library.load();

    // ONE-TIME STAT CLEAR
    if (!localStorage.getItem('stats_cleared_2026_07_03')) {
      _library.forEach(track => {
        Library.update(track.id, {
          timeSpent: 0,
          playCount: 0,
          lastPlayed: null
        });
      });
      localStorage.setItem('stats_cleared_2026_07_03', 'true');
      _library = Library.load(); // Reload to get fresh data
    }

    // Render immediately so user sees their library instantly
    _render();

    // Try to restore directory access from IndexedDB silently
    try {
      const autoGranted = await Scanner.tryRestoreHandle();
      if (autoGranted) {
        await _doScan();
      } else if (!Scanner.hasHandle() && _library.length === 0) {
        // Only show welcome screen if there is no library and no saved handle
        UI.showWelcome(false);
      }
    } catch (e) {
      console.error('Init error:', e);
    }

    // Boot player with existing library (file objects may not be ready yet)
    Player.init(_library);
    Player.setPlaylist(_library);

    _bindEvents();

    // Init search after library is ready
    if (window.SearchModule) window.SearchModule.init();

    // Start background thumbnail extraction
    if (typeof ThumbnailExtractor !== 'undefined') ThumbnailExtractor.processLibrary();
  }

  /* ---- Folder scanning ---- */

  async function _doScan() {
    UI.showLoading('main-scroll-area');
    try {
      const filenames = await Scanner.scan();
      _library        = Library.sync(filenames);
      Player.setPlaylist(_library);
      _render();
      UI.hideWelcome();
      if (window.SearchModule) window.SearchModule.init();
      if (typeof ThumbnailExtractor !== 'undefined') ThumbnailExtractor.processLibrary();
    } catch (e) {
      console.error('Scan failed:', e);
      // Clear the library since the folder is missing or access is denied
      _library = Library.sync([]);
      Player.setPlaylist(_library);
      _render();
      UI.showWelcome();
    }
  }

  /* ---- Rendering ---- */

  function _render() {
    UI.renderSidebar(_library, _currentFilter, _nowPlayingId, _selectedPlaylistId);
    UI.renderMainContent(_library, _currentFilter, _nowPlayingId, _selectedPlaylistId);
  }

  /* ---- Event Binding ---- */

  function _bindEvents() {
    // Welcome overlay — "Select Songs Folder" / "Grant Access" button
    const btnSelect = document.getElementById('btn-select-folder');
    if (btnSelect) {
      btnSelect.addEventListener('click', async () => {
        btnSelect.textContent = 'Opening…';
        btnSelect.disabled    = true;
        
        let ok = false;
        if (Scanner.hasHandle() && btnSelect.dataset.action === 'restore') {
          ok = await Scanner.requestPermission();
          if (!ok) {
            // If they cancel the prompt, let them select a folder normally
            ok = await Scanner.selectFolder();
          }
        } else {
          ok = await Scanner.selectFolder();
        }

        if (ok) {
          await _doScan();
          // Re-init player with new file objects
          Player.init(_library);
          Player.setPlaylist(_library);
          UI.hideWelcome();
        } else {
          UI.showWelcome(Scanner.hasHandle());
          btnSelect.disabled = false;
        }
      });
    }

    // Sidebar header "+" button (re-select or change folder)
    const btnScan = document.getElementById('btn-scan');
    if (btnScan) {
      btnScan.addEventListener('click', async () => {
        const ok = await Scanner.selectFolder();
        if (ok) {
          await _doScan();
          Player.init(_library);
          Player.setPlaylist(_library);
        }
      });
    }

    // Sidebar filter pills (All / Liked)
    document.getElementById('sidebar-filter-row')
      ?.querySelectorAll('.filter-pill')
      .forEach(btn => btn.addEventListener('click', () => {
        document.getElementById('sidebar-filter-row')
          .querySelectorAll('.filter-pill')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _currentFilter = btn.dataset.filter;
        _render();
      }));

    // Main header filter pills (All / Favorites)
    document.querySelector('.main-header')
      ?.querySelectorAll('.filter-pill')
      .forEach(btn => btn.addEventListener('click', () => {
        document.querySelector('.main-header')
          .querySelectorAll('.filter-pill')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _currentFilter = btn.dataset.view;
        
        // Sync sidebar
        document.getElementById('sidebar-filter-row')
          ?.querySelectorAll('.filter-pill')
          .forEach(b => {
            b.classList.toggle('active', b.dataset.filter === _currentFilter);
          });
          
        _render();
      }));

    // Home button — reset filter to all
    const homeBtn = document.getElementById('btn-home');
    if (homeBtn) {
      homeBtn.addEventListener('click', showHome);
    }

    // Favorite buttons (mini player + right sidebar)
    ['btn-favorite-mini', 'btn-favorite-large'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', _toggleFavorite);
    });
    
    // Close context menu on outside click
    document.addEventListener('click', () => {
      if (typeof App !== 'undefined' && App.closeMenu) App.closeMenu();
    });
  }

  /* ---- Public Actions ---- */

  async function playTrack(id) {
    if (!Scanner.hasFiles()) {
      let ok = await Scanner.tryRestoreHandle();
      if (!ok && Scanner.hasHandle()) {
        ok = await Scanner.requestPermission();
      }
      if (ok) {
        await _doScan();
      } else {
        // Show welcome overlay to let them select/restore folder
        UI.showWelcome(Scanner.hasHandle());
        return;
      }
    }

    _nowPlayingId = id;
    
    // Set context-aware playlist
    if (_currentFilter === 'playlists' && _selectedPlaylistId) {
      const pl = Library.getPlaylists().find(p => p.id === _selectedPlaylistId);
      if (pl) {
        const tracks = pl.tracks.map(tid => _library.find(t => t.id === tid)).filter(Boolean);
        Player.setPlaylist(tracks);
      }
    } else if (_currentFilter === 'favorites') {
      Player.setPlaylist(_library.filter(t => t.favorite));
    } else {
      Player.setPlaylist(_library);
    }
    
    Player.playTrackById(id);
    
    setTimeout(() => {
      _library = Library.get();
      _render();
    }, 80);
  }

  function showHome() {
    _currentFilter = 'all';
    // Clear any active search
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    document.querySelectorAll('.main-header .filter-pill').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.main-header .filter-pill[data-view="all"]');
    if (allBtn) allBtn.classList.add('active');
    document.querySelectorAll('#sidebar-filter-row .filter-pill').forEach(b => b.classList.remove('active'));
    const sAllBtn = document.querySelector('#sidebar-filter-row .filter-pill[data-filter="all"]');
    if (sAllBtn) sAllBtn.classList.add('active');
    _render();
  }

  function _toggleFavorite() {
    const track = Player.getCurrentTrack();
    if (!track) return;
    const updated = Library.update(track.id, { favorite: !track.favorite });
    _library = Library.get();
    
    // Update the currently playing list in place if it's the main library
    if (_currentFilter === 'all') {
      Player.setPlaylist(_library);
    }
    
    UI.updateFavoriteUI(updated ? updated.favorite : false);
    _render();
  }

  function refresh() {
    _library = Library.get();
    _nowPlayingId = Player.getCurrentTrack()?.id || null;
    _render();
  }

  function clearStats() {
    if (!confirm('Are you sure you want to clear your listening stats?')) return;
    _library.forEach(t => {
      if (t.playCount || t.timeSpent) {
        Library.update(t.id, { playCount: 0, timeSpent: 0 });
      }
    });
    refresh();
  }

  function queueTrack(id) {
    if (typeof Player !== 'undefined') {
      Player.addToQueue(id);
      refresh();
    }
  }

  function unqueueTrack(id) {
    if (typeof Player !== 'undefined') {
      Player.removeFromQueue(id);
      refresh();
    }
  }

  async function playQueueTrack(idx) {
    if (typeof Player === 'undefined') return;
    const qIds = Player.getQueue();
    if (idx < 0 || idx >= qIds.length) return;

    if (!Scanner.hasFiles()) {
      let ok = await Scanner.tryRestoreHandle();
      if (!ok && Scanner.hasHandle()) {
        ok = await Scanner.requestPermission();
      }
      if (ok) {
        await _doScan();
      } else {
        UI.showWelcome(Scanner.hasHandle());
        return;
      }
    }

    Player.playQueueTrack(idx);
    refresh();
  }

  function toggleLoopQueue() {
    if (typeof Player !== 'undefined') {
      Player.toggleLoopQueue();
      refresh();
    }
  }

  function promptRepeat(idx) {
    if (typeof Player === 'undefined') return;
    const current = Player.getQueue()[idx].repeatTarget || 0;
    const input = prompt(`Enter number of times to loop this song (currently ${current}x):`, current);
    if (input !== null) {
      const parsed = parseInt(input, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        Player.setQueueItemRepeat(idx, parsed);
        refresh();
      }
    }
  }

  // Drag and Drop handlers for Queue
  function dragStart(e, idx) {
    e.dataTransfer.setData('text/plain', idx);
    e.target.style.opacity = '0.5';
  }
  function dragOver(e) {
    e.preventDefault();
  }
  function drop(e, dropIdx) {
    e.preventDefault();
    e.target.closest('.sidebar-list-item').style.opacity = '1';
    const dragIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(dragIdx) && dragIdx !== dropIdx && typeof Player !== 'undefined') {
      Player.reorderQueue(dragIdx, dropIdx);
      refresh();
    }
  }
  function dragEnd(e) {
    e.target.style.opacity = '1';
  }

  /* ---- Playlist Handlers ---- */

  function createPlaylist(trackIdToAdd = null) {
    const name = prompt("Enter new playlist name:");
    if (name && name.trim()) {
      const pl = Library.createPlaylist(name);
      if (trackIdToAdd) {
        Library.addTrackToPlaylist(trackIdToAdd, pl.id);
      }
      _selectedPlaylistId = pl.id;
      _currentFilter = 'playlists';
      
      // Update UI pills
      document.querySelectorAll('.filter-pill').forEach(b => {
        const type = b.dataset.view || b.dataset.filter;
        b.classList.toggle('active', type === 'playlists');
      });
      _render();
    }
  }

  function openPlaylist(id) {
    _selectedPlaylistId = id;
    _render();
  }

  function deletePlaylist(id) {
    if (confirm("Are you sure you want to delete this playlist?")) {
      Library.deletePlaylist(id);
      if (_selectedPlaylistId === id) _selectedPlaylistId = null;
      _render();
    }
  }

  function renamePlaylistPrompt(id) {
    const pl = Library.getPlaylists().find(p => p.id === id);
    if (!pl) return;
    const newName = prompt("Enter new name for playlist:", pl.name);
    if (newName && newName.trim()) {
      Library.renamePlaylist(id, newName);
      _render();
    }
  }

  /* ---- Context Menu ---- */
  
  function openMenu(trackId, event) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    const safeId = trackId.replace(/'/g, "\\'");
    
    menu.innerHTML = `
      <div class="context-menu-item" onclick="App.queueTrack('${safeId}'); App.closeMenu()">Add to Queue</div>
      <div class="context-menu-item" onclick="event.stopPropagation(); App.showPlaylistSubmenu('${safeId}')">Add to Playlist &rarr;</div>
    `;
    
    menu.style.display = 'block';
    
    // Position near the mouse click
    const x = event.clientX;
    const y = event.clientY;
    
    // Keep it on screen
    const rect = menu.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 10;
    const maxY = window.innerHeight - rect.height - 10;
    
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
  }
  
  function closeMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) menu.style.display = 'none';
  }
  
  function showPlaylistSubmenu(trackId) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    
    const playlists = Library.getPlaylists();
    
    const safeTrackId = trackId.replace(/'/g, "\\'");

    if (playlists.length === 0) {
      menu.innerHTML = `
        <div class="context-menu-item" style="color:var(--fg-muted); cursor:default;">No playlists found</div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-item" onclick="App.createPlaylist('${safeTrackId}'); App.closeMenu()">+ Create Playlist</div>
      `;
      return;
    }
    
    menu.innerHTML = playlists.map(pl => {
      const safePlId = pl.id.replace(/'/g, "\\'");
      const safePlName = (pl.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="context-menu-item" onclick="Library.addTrackToPlaylist('${safeTrackId}', '${safePlId}'); App.refresh(); App.closeMenu();">
        ${safePlName}
      </div>`;
    }).join('') + `
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" onclick="App.createPlaylist('${safeTrackId}'); App.closeMenu()">+ Create Playlist</div>
    `;
  }

  function removeTrackFromPlaylist(trackId, playlistId) {
    Library.removeTrackFromPlaylist(trackId, playlistId);
    _render();
  }

  function getLibrary()    { return _library; }
  function getFilter()     { return _currentFilter; }
  function getNowPlaying() { return _nowPlayingId; }

  return { 
    init, playTrack, showHome, refresh, clearStats, 
    queueTrack, unqueueTrack, playQueueTrack,
    toggleLoopQueue, promptRepeat,
    dragStart, dragOver, drop, dragEnd,
    createPlaylist, openPlaylist, renamePlaylistPrompt, deletePlaylist, removeTrackFromPlaylist,
    openMenu, closeMenu, showPlaylistSubmenu,
    getLibrary, getFilter, getNowPlaying 
  };
})();

/* ---- Bootstrap ---- */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
