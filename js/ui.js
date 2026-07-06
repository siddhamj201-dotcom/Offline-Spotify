/**
 * ui.js
 * Pure DOM rendering functions.
 * Takes data, updates the DOM. No business logic.
 */
const UI = (() => {

  /* ---- Sidebar ---- */

  function renderSidebar(library, activeFilter, nowPlayingId, selectedPlaylistId) {
    const list = document.getElementById('sidebar-list');
    if (!list) return;

    if (activeFilter === 'playlists') {
      const playlists = typeof Library !== 'undefined' ? Library.getPlaylists() : [];
      let html = `<div style="padding: 12px; border-bottom: 1px solid var(--border);">
        <button onclick="App.createPlaylist()" style="width:100%; padding: 8px; background: var(--bg-card-hover); color: var(--fg); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer;">
          + Create Playlist
        </button>
      </div>`;
      
      if (playlists.length === 0) {
        html += `<div class="sidebar-empty"><p>No playlists yet</p></div>`;
      } else {
        html += playlists.map(pl => {
          const isActive = pl.id === selectedPlaylistId;
          return `<div class="sidebar-list-item${isActive ? ' now-playing' : ''}" style="display:flex; justify-content:space-between; align-items:center;" onclick="App.openPlaylist('${_esc(pl.id)}')">
            <div class="item-title">${_esc(pl.name)}</div>
            <div style="display:flex; align-items:center; gap: 8px;">
              <div class="playlist-actions">
                <button onclick="event.stopPropagation(); App.renamePlaylistPrompt('${_esc(pl.id)}')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button onclick="event.stopPropagation(); App.deletePlaylist('${_esc(pl.id)}')">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
              </div>
              <div style="color:var(--fg-muted); font-size: 0.8rem;">${pl.tracks.length} tracks</div>
            </div>
          </div>`;
        }).join('');
      }
      list.innerHTML = html;
      return;
    }

    let items = library;
    if (activeFilter === 'favorites') items = library.filter(t => t.favorite);

    if (items.length === 0) {
      const msg = library.length === 0
        ? `<div class="sidebar-empty"><span class="se-icon">📁</span><p>Select a songs folder to see your library</p></div>`
        : `<div class="sidebar-empty"><span class="se-icon">❤️</span><p>No liked songs yet</p></div>`;
      list.innerHTML = msg;
      return;
    }

    list.innerHTML = items.map(track => {
      const isNowPlaying = track.id === nowPlayingId;
      const thumbStyle   = track.thumbnail
        ? `background-image:url('${_esc(track.thumbnail)}');background-size:cover;background-position:center;`
        : 'background-color:var(--bg-card-hover);display:flex;align-items:center;justify-content:center;';
      const thumbInner   = track.thumbnail ? '' : _musicIconSm();

      return `<div class="sidebar-list-item${isNowPlaying ? ' now-playing' : ''}"
                   data-id="${_esc(track.id)}"
                   onclick="App.playTrack('${_esc(track.id)}')">
        <div class="artwork-thumb" style="${thumbStyle}">${thumbInner}</div>
        <div class="item-details">
          <div class="item-title">${_esc(track.title)}</div>
          <div class="item-subtitle">
            <span>MP4</span>
            ${track.favorite ? `<span class="dot"></span><svg style="width:11px;height:11px;fill:var(--accent);flex-shrink:0;" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  /* ---- Main Content ---- */

  function renderMainContent(library, filter, nowPlayingId, selectedPlaylistId) {
    const area = document.getElementById('main-scroll-area');
    if (!area) return;

    if (filter === 'playlists') {
      if (!selectedPlaylistId) {
        area.innerHTML = `<div class="empty-state">
          <span class="es-icon">📑</span>
          <h2>Playlists</h2>
          <p>Select a playlist from the sidebar or create a new one.</p>
        </div>`;
        return;
      }
      
      const pl = (typeof Library !== 'undefined') ? Library.getPlaylists().find(p => p.id === selectedPlaylistId) : null;
      if (!pl) return;
      
      const items = pl.tracks.map(id => library.find(t => t.id === id)).filter(Boolean);
      
      area.innerHTML = `<div>
        <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; padding-right: 24px;">
          <h2>${_esc(pl.name)}</h2>
          <button onclick="App.deletePlaylist('${_esc(pl.id)}')" style="padding: 6px 12px; background: transparent; border: 1px solid var(--border); color: var(--fg-muted); border-radius: var(--radius); cursor: pointer;">
            Delete Playlist
          </button>
        </div>
        ${items.length === 0 
          ? `<div class="empty-state" style="margin-top: 40px;"><p>This playlist is empty. Add songs from your library!</p></div>` 
          : `<div class="card-grid">${items.map(t => {
              // Custom music card for playlist view (includes remove button)
              const thumbStyle = t.thumbnail ? `background-image:url('${_esc(t.thumbnail)}');background-size:cover;background-position:center;` : '';
              const thumbContent = t.thumbnail ? '' : _musicIconLg();
              return `<div class="music-card${t.id === nowPlayingId ? ' now-playing' : ''}" data-id="${_esc(t.id)}" onclick="App.playTrack('${_esc(t.id)}')">
                <div class="music-card-img" style="background-color:var(--bg-card-hover);${thumbStyle}display:flex;align-items:center;justify-content:center;">
                  ${thumbContent}
                  <div class="play-btn-circle">
                    <svg style="width:20px;height:20px;" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  </div>
                </div>
                <div class="music-card-title" style="display:flex; justify-content:flex-start; align-items:center; gap:4px;">
                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_esc(t.title)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                  <span class="music-card-desc" style="margin-top:0;">MP4 Video</span>
                  <button onclick="event.stopPropagation(); App.removeTrackFromPlaylist('${_esc(t.id)}', '${_esc(pl.id)}')" style="background:none; border:none; color:var(--fg-muted); cursor:pointer; font-size:0.8rem; text-decoration:underline;">Remove</button>
                </div>
              </div>`;
            }).join('')}</div>`
        }
      </div>`;
      return;
    }

    if (library.length === 0) {
      area.innerHTML = `<div class="empty-state">
        <span class="es-icon">🎵</span>
        <h2>No songs yet</h2>
        <p>Click the <strong>+</strong> button in the sidebar header to select your songs folder.</p>
      </div>`;
      return;
    }

    let items = library;
    if (filter === 'favorites') items = library.filter(t => t.favorite);

    if (filter === 'favorites' && items.length === 0) {
      area.innerHTML = `<div class="empty-state">
        <h2>No favorites yet</h2>
        <p>Click the heart on any track to add it here.</p>
      </div>`;
      return;
    }

    if (filter === 'stats') {
      const statsItems = library.filter(t => t.timeSpent && t.timeSpent > 0);
      if (statsItems.length === 0) {
        area.innerHTML = `<div class="empty-state">
          <h2>No listening stats yet</h2>
          <p>Listen to some songs to see your statistics here.</p>
        </div>`;
        return;
      }

      statsItems.sort((a, b) => (b.timeSpent || 0) - (a.timeSpent || 0));

      area.innerHTML = `<div>
        <div class="section-header"><h2>Listening Stats</h2></div>
        <div class="stats-list" style="padding: 0 24px;">
          ${statsItems.map(t => {
            const timeSpent = t.timeSpent || 0;
            const m = Math.floor(timeSpent / 60);
            const s = Math.floor(timeSpent % 60);
            const timeStr = m > 0 ? `${m} min ${s} sec` : `${s} sec`;
            const thumbStyle = t.thumbnail
              ? `background-image:url('${_esc(t.thumbnail)}');background-size:cover;background-position:center;`
              : 'background-color:var(--bg-card-hover);display:flex;align-items:center;justify-content:center;';
            const thumbInner = t.thumbnail ? '' : _musicIconSm();

            const playText = t.playCount ? `${t.playCount} play${t.playCount > 1 ? 's' : ''} &bull; ` : '';
            return `<div class="sidebar-list-item" style="padding: 12px; border-bottom: 1px solid var(--border); border-radius: 0; cursor: pointer; display: flex; align-items: center; gap: 16px;" onclick="App.playTrack('${_esc(t.id)}')">
              <div class="artwork-thumb" style="${thumbStyle}; width: 64px; height: 48px; border-radius: 4px; flex-shrink: 0;">${thumbInner}</div>
              <div class="item-details" style="display:flex; justify-content: space-between; width: 100%; align-items: center;">
                <div class="item-title" style="font-size: 1rem;">${_esc(t.title)}</div>
                <div class="item-subtitle" data-stat-id="${_esc(t.id)}" data-play-text="${playText}" style="color:var(--accent); font-size: 0.9rem;">${playText}Time spent: ${timeStr}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
      return;
    }

    if (filter === 'queue') {
      const qIds = typeof Player !== 'undefined' ? Player.getQueue() : [];
      if (qIds.length === 0) {
        area.innerHTML = `<div class="empty-state">
          <h2>Your Queue is Empty</h2>
          <p>Click the <strong>+</strong> button on any track to add it to your queue.</p>
        </div>`;
        return;
      }

      const isLooping = typeof Player !== 'undefined' && Player.isLoopQueue();
      const loopColor = isLooping ? 'var(--accent)' : 'var(--fg-muted)';
      area.innerHTML = `<div>
        <style>
          .queue-item .drag-handle { display: none; cursor: grab; color: var(--fg-muted); width: 20px; text-align: right; font-size: 1.2rem; }
          .queue-item:hover .drag-handle { display: block; }
          .queue-item:hover .queue-num { display: none; }
        </style>
        <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; padding-right: 24px;">
          <h2>Up Next</h2>
          <button onclick="App.toggleLoopQueue()" style="padding: 6px 12px; background: transparent; border: 1px solid ${loopColor}; color: ${loopColor}; border-radius: var(--radius); cursor: pointer; display:flex; align-items:center; gap:8px;">
            <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
            Loop Queue
          </button>
        </div>
        <div class="stats-list" style="padding: 0 24px;">
          ${qIds.map((id, idx) => {
            const qItem = typeof Player !== 'undefined' ? Player.getQueue()[idx] : null;
            if (!qItem) return '';
            const t = library.find(x => x.id === qItem.id);
            if (!t) return '';
            const repeats = qItem.repeatTarget || 0;
            const thumbStyle = t.thumbnail
              ? `background-image:url('${_esc(t.thumbnail)}');background-size:cover;background-position:center;`
              : 'background-color:var(--bg-card-hover);display:flex;align-items:center;justify-content:center;';
            const thumbInner = t.thumbnail ? '' : _musicIconSm();

            return `<div class="sidebar-list-item queue-item" style="padding: 12px; border-bottom: 1px solid var(--border); border-radius: 0; cursor: pointer; display: flex; align-items: center; gap: 16px;"
                         onclick="App.playQueueTrack(${idx})"
                         draggable="true" 
                         ondragstart="App.dragStart(event, ${idx})" 
                         ondragover="App.dragOver(event)" 
                         ondrop="App.drop(event, ${idx})"
                         ondragend="App.dragEnd(event)">
              <div class="queue-num" style="color:var(--fg-muted); width: 20px; text-align:right;">${idx + 1}</div>
              <div class="drag-handle" title="Drag to reorder">≡</div>
              <div class="artwork-thumb" style="${thumbStyle}; width: 64px; height: 48px; border-radius: 4px; flex-shrink: 0;">${thumbInner}</div>
              <div class="item-details" style="display:flex; justify-content: space-between; width: 100%; align-items: center;">
                <div class="item-title" style="font-size: 1rem;">${_esc(t.title)}</div>
                <div style="display:flex; align-items:center; gap: 8px;">
                  <button onclick="event.stopPropagation(); App.promptRepeat(${idx})" style="padding: 4px 8px; background: transparent; border: 1px solid var(--border); color: var(--fg-muted); border-radius: var(--radius); cursor: pointer; font-size: 0.85rem;" title="Set loop count">
                    ${repeats}x
                  </button>
                  <button onclick="event.stopPropagation(); App.unqueueTrack('${_esc(t.id)}')" style="padding: 4px; background: transparent; border: none; color: var(--fg-muted); cursor: pointer;" title="Remove">
                    <svg style="width:20px;height:20px;" viewBox="0 0 24 24" fill="currentColor"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
                  </button>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
      return;
    }

    if (filter === 'recent') {
      const recent = [...library]
        .filter(t => t.lastPlayed)
        .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
      
      if (recent.length === 0) {
        area.innerHTML = `<div class="empty-state">
          <span class="es-icon">🕒</span>
          <h2>No recent history</h2>
          <p>Songs you play will appear here.</p>
        </div>`;
        return;
      }

      area.innerHTML = `<div>
        <div class="section-header"><h2>Recently Played</h2></div>
        <div class="card-grid">${recent.map(t => _musicCard(t, t.id === nowPlayingId)).join('')}</div>
      </div>`;
      return;
    }

    let html = '';

    // Song grid
    const sectionTitle = filter === 'favorites' ? 'Liked Songs' : 'All Songs';
    html += `<div>
      <div class="section-header"><h2>${_esc(sectionTitle)}</h2></div>
      <div class="card-grid">${items.map(t => _musicCard(t, t.id === nowPlayingId)).join('')}</div>
    </div>`;

    area.innerHTML = html;
  }

  function _recentCard(track, isActive) {
    const thumbStyle = track.thumbnail
      ? `background-image:url('${_esc(track.thumbnail)}');background-size:cover;background-position:center;`
      : '';
    const thumbContent = track.thumbnail ? '' : _musicIconMd();

    return `<div class="recent-card${isActive ? ' now-playing' : ''}"
                 data-id="${_esc(track.id)}"
                 onclick="App.playTrack('${_esc(track.id)}')">
      <div class="card-img" style="background-color:var(--bg-card);${thumbStyle}display:flex;align-items:center;justify-content:center;">
        ${thumbContent}
      </div>
      <div class="card-info" style="display:flex; justify-content:flex-start; align-items:center; gap:4px;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_esc(track.title)}</span>
      </div>
      <div class="play-btn-overlay">
        <svg style="width:20px;height:20px;" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
      <button class="kebab-btn" onclick="event.stopPropagation(); App.openMenu('${_esc(track.id)}', event)">⋮</button>
    </div>`;
  }

  function _musicCard(track, isActive) {
    const thumbStyle = track.thumbnail
      ? `background-image:url('${_esc(track.thumbnail)}');background-size:cover;background-position:center;`
      : '';
    const thumbContent = track.thumbnail ? '' : _musicIconLg();

    return `<div class="music-card${isActive ? ' now-playing' : ''}"
                 data-id="${_esc(track.id)}"
                 onclick="App.playTrack('${_esc(track.id)}')">
      <div class="music-card-img" style="background-color:var(--bg-card-hover);${thumbStyle}display:flex;align-items:center;justify-content:center;">
        ${thumbContent}
        <div class="play-btn-circle">
          <svg style="width:20px;height:20px;" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div class="music-card-title" style="display:flex; justify-content:flex-start; align-items:center; gap:4px;">
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_esc(track.title)}</span>
      </div>
      <div class="music-card-desc">MP4 Video</div>
      <button class="kebab-btn" onclick="event.stopPropagation(); App.openMenu('${_esc(track.id)}', event)">⋮</button>
    </div>`;
  }

  /* ---- Player ---- */

  function updatePlayer(track) {
    if (!track) return;

    // Mini player (bottom bar)
    const miniTitle  = document.getElementById('mini-title');
    const miniArtist = document.getElementById('mini-artist');
    const miniCover  = document.getElementById('mini-cover-art');
    if (miniTitle)  miniTitle.textContent  = track.title;
    if (miniArtist) miniArtist.textContent = track.filename;
    if (miniCover) {
      if (track.thumbnail) {
        miniCover.style.backgroundImage    = `url('${track.thumbnail}')`;
        miniCover.style.backgroundSize     = 'cover';
        miniCover.style.backgroundPosition = 'center';
        miniCover.innerHTML = '';
      } else {
        miniCover.style.backgroundImage = '';
        miniCover.innerHTML = _musicIconSm();
      }
    }

    // Right sidebar (Now Playing)
    const npTitle  = document.getElementById('np-title');
    const npArtist = document.getElementById('np-artist');
    const video    = document.getElementById('audio-player');
    if (npTitle)  npTitle.textContent  = track.title;
    if (npArtist) npArtist.textContent = track.filename;
    if (video) {
      if (track.thumbnail) {
        video.poster = track.thumbnail;
      } else {
        video.removeAttribute('poster');
      }
    }

    // Sync active states in all card grids
    _syncActiveCards(track.id);
    updateFavoriteUI(track.favorite);
  }

  function _syncActiveCards(id) {
    document.querySelectorAll('.sidebar-list-item').forEach(el => {
      el.classList.toggle('now-playing', el.dataset.id === id);
    });
    document.querySelectorAll('.music-card, .recent-card').forEach(el => {
      el.classList.toggle('now-playing', el.dataset.id === id);
    });
  }

  function updateFavoriteUI(isFavorite) {
    const color = isFavorite ? 'var(--accent)' : 'var(--fg-muted)';
    const fill  = isFavorite ? 'currentColor'  : 'none';

    ['btn-favorite-mini', 'btn-favorite-large'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.style.color = color;
      const path = btn.querySelector('path');
      if (path) path.setAttribute('fill', fill);
    });
  }

  function updateProgress(currentTime, duration) {
    const pct  = duration ? (currentTime / duration) * 100 : 0;
    const fill = document.getElementById('player-fill');
    const handle = document.getElementById('player-handle');
    const cur  = document.getElementById('player-current-time');
    if (fill)   fill.style.width   = pct + '%';
    if (handle) handle.style.left  = pct + '%';
    if (cur)    cur.textContent    = _fmt(currentTime);
  }

  function updateDuration(duration) {
    const el = document.getElementById('player-total-time');
    if (el) el.textContent = _fmt(duration);
  }

  function resetProgress() {
    updateProgress(0, 0);
    const el = document.getElementById('player-current-time');
    if (el) el.textContent = '--:--';
    const tot = document.getElementById('player-total-time');
    if (tot) tot.textContent = '--:--';
  }

  /* ---- Welcome overlay ---- */

  function showWelcome(hasHandle = false) {
    const el = document.getElementById('welcome-overlay');
    if (!el) return;

    const title = el.querySelector('h1');
    const desc = el.querySelector('p');
    const btn = document.getElementById('btn-select-folder');
    if (title && desc && btn) {
      if (hasHandle) {
         title.textContent = "Welcome Back";
         desc.textContent = "Please grant permission to access your saved songs folder to continue.";
         btn.textContent = "Grant Folder Access";
         btn.dataset.action = "restore";
      } else {
         title.textContent = "Offline Spotify";
         desc.textContent = "Select your MP4 songs folder to get started. Your selection will be remembered for next time.";
         btn.textContent = "Select Songs Folder";
         btn.dataset.action = "select";
      }
    }
    el.style.display = 'flex';
  }

  function hideWelcome() {
    const el = document.getElementById('welcome-overlay');
    if (el) el.style.display = 'none';
  }

  function showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="loading-dots">
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
    </div>`;
  }

  /* ---- Live Events ---- */
  window.addEventListener('statsUpdated', (e) => {
    const el = document.querySelector(`[data-stat-id="${e.detail.id}"]`);
    if (el) {
      const timeSpent = e.detail.timeSpent;
      const m = Math.floor(timeSpent / 60);
      const s = Math.floor(timeSpent % 60);
      const timeStr = m > 0 ? `${m} min ${s} sec` : `${s} sec`;
      const playText = el.getAttribute('data-play-text') || '';
      el.innerHTML = `${playText}Time spent: ${timeStr}`;
    }
  });

  /* ---- SVG helpers ---- */

  function _musicIconSm() {
    return `<svg style="width:22px;height:22px;fill:var(--fg-subtle);" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>`;
  }
  function _musicIconMd() {
    return `<svg style="width:28px;height:28px;fill:var(--fg-subtle);" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>`;
  }
  function _musicIconLg() {
    return `<svg style="width:48px;height:48px;fill:var(--fg-subtle);position:absolute;" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>`;
  }
  function _musicIconXl() {
    return `<svg style="width:72px;height:72px;fill:var(--fg-subtle);" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>`;
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _fmt(secs) {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return {
    renderSidebar,
    renderMainContent,
    updatePlayer,
    updateFavoriteUI,
    updateProgress,
    updateDuration,
    resetProgress,
    showWelcome,
    hideWelcome,
    showLoading
  };
})();
