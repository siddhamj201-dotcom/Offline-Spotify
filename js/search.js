/**
 * search.js
 * Real-time, case-insensitive, partial match search.
 * Wires to the top search bar input.
 * Note: No DOMContentLoaded wrapper — called after app.js has booted.
 */
(function () {
  let _isBound = false;
  function initSearch() {
    if (_isBound) return;
    _isBound = true;
    const input = document.getElementById('search-input');
    if (!input) return;

    let _debounceTimer = null;

    input.addEventListener('input', () => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        const query = input.value.trim().toLowerCase();

        if (!query) {
          // No query — restore normal view
          App.refresh();
          return;
        }

        const library  = App.getLibrary();
        const filtered = library.filter(t =>
          t.title.toLowerCase().includes(query) ||
          t.filename.toLowerCase().includes(query)
        );

        const nowPlaying = App.getNowPlaying();
        UI.renderMainContent(filtered, 'all', nowPlaying);
        UI.renderSidebar(filtered, 'all', nowPlaying);
      }, 60);
    });

    // Clear search on Escape
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        input.value = '';
        App.refresh();
        input.blur();
      }
    });
  }

  // Expose so App can call it after boot
  window.SearchModule = { init: initSearch };

  // Also wire on DOMContentLoaded as a safety fallback
  document.addEventListener('DOMContentLoaded', () => {
    // Delay slightly to let App.init() run first
    setTimeout(initSearch, 500);
  });
})();
