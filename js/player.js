/**
 * player.js
 * Audio/Video playback controller.
 * Uses the hidden <video id="audio-player"> element.
 * Supports: play, pause, seek, volume, mute, prev, next, shuffle, repeat.
 */
const Player = (() => {
  let _media        = null;
  let _playlist     = [];
  let _queue        = [];
  try { 
    const saved = JSON.parse(localStorage.getItem('user_queue') || '[]'); 
    _queue = saved.map(q => typeof q === 'string' ? { id: q, repeatTarget: 0, playCount: 0 } : q);
  } catch(e){}
  let _isQueueActive = false;
  let _queueIndex   = -1;
  let _loopQueue    = false;
  let _currentIndex = -1;
  let _isPlaying    = false;
  let _isSeeking    = false;
  let _isMuted      = false;
  let _isShuffled   = false;
  let _repeatMode   = 0;     // 0=none, 1=all, 2=one
  let _volume       = 0.8;
  let _hasCountedCurrentTrack = false;
  let _timerInterval = null;

  const $ = id => document.getElementById(id);

  let _initialized  = false;

  /* ---- Init ---- */

  function init(playlist) {
    _playlist = playlist || [];
    if (!_initialized) {
      _media    = $('audio-player');
      _media.volume = _volume;
      _bindMediaEvents();
      _bindControlEvents();
      _setupMediaSession();
      _initialized = true;
    }
    _updatePlayPauseBtn();
    UI.resetProgress();
  }

  /* ---- Media Events ---- */

  function _bindMediaEvents() {
    _media.addEventListener('loadedmetadata', () => {
      UI.updateDuration(_media.duration);
      // Save duration to library
      if (_currentIndex >= 0 && _playlist[_currentIndex]) {
        Library.update(_playlist[_currentIndex].id, {
          duration: Math.floor(_media.duration)
        });
      }
    });

    _media.addEventListener('timeupdate', () => {
      if (_isSeeking || !_media.duration) return;
      UI.updateProgress(_media.currentTime, _media.duration);

      if (!_hasCountedCurrentTrack && _media.currentTime / _media.duration >= 0.8) {
        _hasCountedCurrentTrack = true;
        if (_currentIndex >= 0 && _playlist[_currentIndex]) {
          const track = _playlist[_currentIndex];
          Library.update(track.id, {
            playCount: (track.playCount || 0) + 1,
            lastPlayed: new Date().toISOString()
          });
          _playlist[_currentIndex] = Library.getById(track.id) || track;
          if (typeof App !== 'undefined') App.refresh();
        }
      }
    });

    _media.addEventListener('play', () => {
      _isPlaying = true;
      _updatePlayPauseBtn();
      _startTimer();
    });

    _media.addEventListener('pause', () => {
      _isPlaying = false;
      _updatePlayPauseBtn();
      _stopTimer();
    });

    _media.addEventListener('ended', () => {
      _stopTimer();
      if (_repeatMode === 2) {
        // Repeat one
        loadTrack(_currentIndex, true);
      } else if (_isQueueActive || _repeatMode === 1 || _currentIndex < _playlist.length - 1) {
        next(true);
      } else {
        _isPlaying = false;
        _updatePlayPauseBtn();
      }
    });

    _media.addEventListener('error', e => {
      console.error('Media error:', e);
      _isPlaying = false;
      _updatePlayPauseBtn();
      _stopTimer();
    });
  }

  /* ---- Time Tracking ---- */

  function _startTimer() {
    _stopTimer();
    _timerInterval = setInterval(() => {
      if (_currentIndex >= 0 && _playlist[_currentIndex]) {
        const track = _playlist[_currentIndex];
        const newTime = (track.timeSpent || 0) + 1;
        
        // Update in-memory playlist
        _playlist[_currentIndex].timeSpent = newTime;
        
        // Only save to localStorage every 10 seconds to prevent thread blocking
        if (newTime % 10 === 0) {
          Library.update(track.id, { timeSpent: newTime });
        } else {
          // Keep library in sync in memory if update isn't called
          const libTrack = Library.getById(track.id);
          if (libTrack) libTrack.timeSpent = newTime;
        }

        // Dispatch live event to update Stats view without full refresh
        window.dispatchEvent(new CustomEvent('statsUpdated', { detail: { id: track.id, timeSpent: newTime } }));
      }
    }, 1000);
  }

  function _stopTimer() {
    if (_timerInterval) clearInterval(_timerInterval);
    _timerInterval = null;
  }

  /* ---- Control Events ---- */

  function _bindControlEvents() {
    // Play / Pause
    const ppBtn = $('play-pause-btn');
    if (ppBtn) ppBtn.addEventListener('click', togglePlay);

    // Prev / Next
    const prevBtn = $('btn-prev');
    const nextBtn = $('btn-next');
    if (prevBtn) prevBtn.addEventListener('click', () => prev());
    if (nextBtn) nextBtn.addEventListener('click', () => next(true));

    // Shuffle
    const shuffleBtn = $('btn-shuffle');
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);

    // Repeat
    const repeatBtn = $('btn-repeat');
    if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);

    // Mute
    const muteBtn = $('btn-mute');
    if (muteBtn) muteBtn.addEventListener('click', toggleMute);

    // Progress bar
    const track = $('player-track');
    if (track) {
      track.addEventListener('mousedown', e => { _isSeeking = true; _doSeek(e); });
      track.addEventListener('click', e => _doSeek(e));
    }
    document.addEventListener('mousemove', e => { if (_isSeeking) _doSeek(e); });
    document.addEventListener('mouseup',   () => { _isSeeking = false; });

    // Volume bar
    const volTrack = $('volume-track');
    if (volTrack) {
      let _volDragging = false;
      volTrack.addEventListener('mousedown', e => { _volDragging = true; _doVolume(e); });
      volTrack.addEventListener('click',     e => _doVolume(e));
      document.addEventListener('mousemove', e => { if (_volDragging) _doVolume(e); });
      document.addEventListener('mouseup',   () => { _volDragging = false; });
    }
  }

  function _setupMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', () => prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => next(true));
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.fastSeek && 'fastSeek' in _media) {
          _media.fastSeek(details.seekTime);
          return;
        }
        _media.currentTime = details.seekTime;
      });
    }
  }

  /* ---- Playback ---- */

  function loadTrack(index, autoplay) {
    if (index < 0 || index >= _playlist.length) return;
    _stopTimer();
    _currentIndex = index;
    const track   = _playlist[index];
    const url     = Scanner.getObjectURL(track.filename);

    if (!url) {
      console.error('No object URL for:', track.filename);
      return;
    }

    _media.src = url;
    _media.load();

    _hasCountedCurrentTrack = false;

    if (autoplay) {
      _media.play().catch(_onPlayError);
    }

    // Update UI
    UI.updatePlayer(track);
    UI.resetProgress();
  }

  function playTrackById(id, fromQueue = false) {
    if (!fromQueue) _isQueueActive = false;
    const idx = _playlist.findIndex(t => t.id === id);
    if (idx >= 0) loadTrack(idx, true);
  }

  function togglePlay() {
    if (!_media) return;
    if (_media.paused) {
      if (_currentIndex === -1 && _queue.length > 0) {
        playQueueTrack(0);
      } else {
        _media.play().catch(_onPlayError);
      }
    } else {
      _media.pause();
    }
  }

  function prev() {
    if (_currentIndex > 0) {
      loadTrack(_currentIndex - 1, _isPlaying);
    } else if (_repeatMode === 1) {
      loadTrack(_playlist.length - 1, _isPlaying);
    }
  }

  function next(autoplay) {
    const shouldPlay = autoplay !== undefined ? autoplay : _isPlaying;
    
    if (_isQueueActive && _queueIndex >= 0 && _queueIndex < _queue.length) {
      const qItem = _queue[_queueIndex];
      if (qItem.playCount < qItem.repeatTarget) {
        qItem.playCount++;
        _saveQueue();
        loadTrack(_currentIndex, shouldPlay);
        return;
      }

      // Reset playCount for next time if we loop
      qItem.playCount = 0;
      _saveQueue();
      
      if (_queueIndex < _queue.length - 1) {
        _queueIndex++;
        playTrackById(_queue[_queueIndex].id, true);
        if (typeof App !== 'undefined') App.refresh();
        return;
      } else if (_loopQueue) {
        // Loop back to start of queue
        _queueIndex = 0;
        playTrackById(_queue[_queueIndex].id, true);
        if (typeof App !== 'undefined') App.refresh();
        return;
      } else {
        _isQueueActive = false;
      }
    } else if (_isQueueActive) {
      _isQueueActive = false;
    }

    if (_isShuffled) {
      const idx = Math.floor(Math.random() * _playlist.length);
      loadTrack(idx, true);
    } else if (_currentIndex < _playlist.length - 1) {
      loadTrack(_currentIndex + 1, shouldPlay);
    } else if (_repeatMode > 0) {
      loadTrack(0, true);
    }
  }

  function seekTo(seconds) {
    if (_media && _media.duration) {
      _media.currentTime = Math.max(0, Math.min(_media.duration, seconds));
    }
  }

  function seekByPercent(pct) {
    if (_media && _media.duration) {
      _media.currentTime = pct * _media.duration;
    }
  }

  /* ---- Controls ---- */

  function toggleShuffle() {
    _isShuffled = !_isShuffled;
    const btn = $('btn-shuffle');
    if (btn) btn.classList.toggle('active', _isShuffled);
  }

  function toggleRepeat() {
    _repeatMode = (_repeatMode + 1) % 3;
    const btn = $('btn-repeat');
    if (!btn) return;
    
    btn.classList.toggle('active', _repeatMode > 0);
    
    if (_repeatMode === 2) {
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="17 1 21 5 17 9"></polyline>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
        <polyline points="7 23 3 19 7 15"></polyline>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        <text x="12" y="16" text-anchor="middle" font-size="10" stroke="none" fill="currentColor" font-weight="bold">1</text>
      </svg>`;
    } else {
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="17 1 21 5 17 9"></polyline>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
        <polyline points="7 23 3 19 7 15"></polyline>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
      </svg>`;
    }

    const titles = ['Enable repeat', 'Repeat all', 'Repeat one'];
    btn.title = titles[_repeatMode];
  }

  function toggleMute() {
    if (!_media) return;
    _isMuted       = !_isMuted;
    _media.muted   = _isMuted;
    _updateMuteIcon();
  }

  function setVolume(v) {
    _volume = Math.max(0, Math.min(1, v));
    if (_media) _media.volume = _volume;
    _isMuted = false;
    if (_media) _media.muted = false;
    _updateVolumeBar(_volume);
    _updateMuteIcon();
  }

  /* ---- Seek / Volume drag handlers ---- */

  function _doSeek(e) {
    if (!_media || !_media.duration) return;
    const track = $('player-track');
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    _media.currentTime = pct * _media.duration;
    UI.updateProgress(_media.currentTime, _media.duration);
  }

  function _doVolume(e) {
    const vt = $('volume-track');
    if (!vt) return;
    const rect = vt.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(pct);
  }

  function _updateVolumeBar(pct) {
    const fill   = $('volume-fill');
    const handle = $('volume-handle');
    if (fill)   fill.style.width  = (pct * 100) + '%';
    if (handle) handle.style.left = (pct * 100) + '%';
  }

  function _updateMuteIcon() {
    const btn = $('btn-mute');
    if (!btn) return;
    if (_isMuted || _volume === 0) {
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>`;
      btn.title = 'Unmute';
    } else {
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>`;
      btn.title = 'Mute';
    }
  }

  /* ---- Play/Pause button UI ---- */

  function _updatePlayPauseBtn() {
    const btn = $('play-pause-btn');
    if (!btn) return;
    if (_isPlaying) {
      btn.innerHTML = `<svg class="icon" style="width:16px;height:16px;" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="4" height="16"></rect>
        <rect x="16" y="4" width="4" height="16"></rect>
      </svg>`;
      btn.title = 'Pause';
      btn.setAttribute('aria-label', 'Pause');
    } else {
      btn.innerHTML = `<svg class="icon" style="width:16px;height:16px;margin-left:2px;" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>`;
      btn.title = 'Play';
      btn.setAttribute('aria-label', 'Play');
    }
  }

  function _onPlayError(e) {
    console.error('Play failed:', e);
    _isPlaying = false;
    _updatePlayPauseBtn();
  }

  /* ---- Public API ---- */

  function setPlaylist(list) {
    _playlist = list;
  }

  function getCurrentIndex() { return _currentIndex; }
  function getCurrentTrack()  { return _playlist[_currentIndex] || null; }
  function isPlaying()        { return _isPlaying; }
  function getVolume()        { return _volume; }
  function getCurrentTime()   { return _media ? _media.currentTime : 0; }
  function getDuration()      { return _media ? _media.duration   : 0; }
  function getQueue()         { return _queue; }
  function isLoopQueue()      { return _loopQueue; }
  
  function toggleLoopQueue() {
    _loopQueue = !_loopQueue;
  }

  function _saveQueue() {
    localStorage.setItem('user_queue', JSON.stringify(_queue));
  }

  function addToQueue(id) {
    if (!_queue.some(q => q.id === id)) {
      _queue.push({ id, repeatTarget: 0, playCount: 0 });
      _saveQueue();
    }
  }

  function removeFromQueue(id) {
    _queue = _queue.filter(q => q.id !== id);
    _saveQueue();
  }

  function reorderQueue(oldIdx, newIdx) {
    if (oldIdx < 0 || oldIdx >= _queue.length || newIdx < 0 || newIdx >= _queue.length) return;
    const item = _queue.splice(oldIdx, 1)[0];
    _queue.splice(newIdx, 0, item);
    _saveQueue();
  }

  function playQueueTrack(index) {
    if (index >= 0 && index < _queue.length) {
      _isQueueActive = true;
      _queueIndex = index;
      _queue[index].playCount = 0;
      _saveQueue();
      playTrackById(_queue[index].id, true);
    }
  }

  function setQueueItemRepeat(index, target) {
    if (index >= 0 && index < _queue.length) {
      _queue[index].repeatTarget = target;
      _queue[index].playCount = 0; // Reset active count
      _saveQueue();
    }
  }

  return {
    init,
    setPlaylist,
    loadTrack,
    playTrackById,
    togglePlay,
    prev,
    next,
    seekTo,
    seekByPercent,
    toggleShuffle,
    toggleRepeat,
    toggleMute,
    setVolume,
    getCurrentIndex,
    getCurrentTrack,
    isPlaying,
    getVolume,
    getCurrentTime,
    getDuration,
    getQueue,
    isLoopQueue,
    toggleLoopQueue,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    playQueueTrack,
    setQueueItemRepeat
  };
})();
