/**
 * shortcuts.js
 * Keyboard shortcuts.
 * Space: Play/Pause
 * Left: Previous
 * Right: Next
 * M: Mute
 * F: Fullscreen
 */
(function () {
  document.addEventListener('keydown', (e) => {
    // Ignore shortcuts if the user is typing in an input field (e.g., search bar)
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault(); // Prevent page scrolling
        if (typeof Player !== 'undefined') Player.togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (typeof Player !== 'undefined') Player.seekTo(Player.getCurrentTime() - 5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (typeof Player !== 'undefined') Player.seekTo(Player.getCurrentTime() + 5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (typeof Player !== 'undefined') {
          const vol = Math.min(1, Player.getVolume() + 0.1);
          Player.setVolume(vol);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (typeof Player !== 'undefined') {
          const vol = Math.max(0, Player.getVolume() - 0.1);
          Player.setVolume(vol);
        }
        break;
      case 'KeyM':
        if (typeof Player !== 'undefined') Player.toggleMute();
        break;
      case 'KeyF':
        // Fullscreen removed
        break;
    }
  });
})();
