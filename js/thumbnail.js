/**
 * thumbnail.js
 * Video thumbnail extraction & caching.
 * Uses a hidden canvas to draw a frame from the video and saves it as a base64 JPEG to the Library.
 */
const ThumbnailExtractor = (() => {
  let _isProcessing = false;
  let _video = null;
  let _canvas = null;
  let _ctx = null;

  function _init() {
    if (_video) return;
    _video = document.createElement('video');
    _video.muted = true;
    _video.playsInline = true;
    _video.preload = 'auto';
    _video.style.display = 'none';
    document.body.appendChild(_video);
    _canvas = document.createElement('canvas');
    // Set a reasonable thumbnail size for the cards
    _canvas.width = 320;
    _canvas.height = 180;
    _ctx = _canvas.getContext('2d');
  }

  function _extractSingle(track) {
    return new Promise((resolve, reject) => {
      const url = Scanner.getObjectURL(track.filename);
      if (!url) return reject('No object URL for track');

      const cleanup = () => {
        _video.onloadeddata = null;
        _video.onseeked = null;
        _video.onerror = null;
        _video.src = '';
      };

      _video.onerror = (e) => {
        cleanup();
        reject('Video load error');
      };

      _video.onloadeddata = () => {
        // Seek to 15% of the way in to avoid black fade-in frames
        const seekTime = _video.duration > 5 ? _video.duration * 0.15 : 0;
        _video.currentTime = seekTime;
      };

      _video.onseeked = () => {
        try {
          _ctx.drawImage(_video, 0, 0, _canvas.width, _canvas.height);
          const dataUrl = _canvas.toDataURL('image/jpeg', 0.6); // 60% quality is fine for small thumbs
          cleanup();
          resolve(dataUrl);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };

      _video.src = url;
    });
  }

  async function processLibrary() {
    if (_isProcessing) return;
    _isProcessing = true;
    _init();

    const library = Library.get();
    let updatedCount = 0;

    for (let i = 0; i < library.length; i++) {
      const track = library[i];
      // Only extract if no thumbnail exists and we have the file
      if (!track.thumbnail && Scanner.hasFiles()) {
        try {
          const dataUrl = await _extractSingle(track);
          if (dataUrl) {
            Library.update(track.id, { thumbnail: dataUrl });
            updatedCount++;
            
            // Refresh UI periodically so user sees them popping in
            if (updatedCount % 3 === 0 && typeof App !== 'undefined') {
              App.refresh();
            }
          }
        } catch (e) {
          console.warn('Could not extract thumbnail for', track.filename, e);
        }
      }
    }

    // Final refresh
    if (updatedCount > 0 && typeof App !== 'undefined') {
      App.refresh();
    }
    
    _isProcessing = false;
  }

  return { processLibrary };
})();
