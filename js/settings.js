/**
 * settings.js
 * Persists theme, density, radius, and accent color to localStorage.
 * Also wires the Tweaks panel open/close from the original design.
 */
(function () {
  const SETTINGS_KEY = 'offline_spotify_settings';

  function load() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function save(patch) {
    const current = load();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(Object.assign(current, patch)));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const settings = load();

    /* ---- Apply saved settings ---- */
    if (settings.theme && settings.theme !== 'default') {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
    if (settings.density && settings.density !== 'default') {
      document.documentElement.setAttribute('data-density', settings.density);
    }
    if (settings.radius && settings.radius !== 'default') {
      document.documentElement.setAttribute('data-radius', settings.radius);
    }
    if (settings.accent) {
      document.documentElement.style.setProperty('--accent', settings.accent);
    }

    /* ---- Mark active buttons based on saved state ---- */
    const activeTheme = settings.theme || 'nordic';
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === activeTheme);
    });

    /* ---- Tweaks panel toggle ---- */
    const tweaksBtn      = document.getElementById('tweaks-btn');
    const tweaksPanel    = document.getElementById('tweaks-panel');
    const tweaksCloseBtn = document.getElementById('tweaks-close-btn');

    if (tweaksBtn) {
      tweaksBtn.addEventListener('click', () => tweaksPanel?.classList.toggle('active'));
    }
    if (tweaksCloseBtn) {
      tweaksCloseBtn.addEventListener('click', () => tweaksPanel?.classList.remove('active'));
    }

    // Close panel on outside click
    document.addEventListener('click', e => {
      if (tweaksPanel?.classList.contains('active') &&
          !tweaksPanel.contains(e.target) &&
          e.target !== tweaksBtn) {
        tweaksPanel.classList.remove('active');
      }
    });

    /* ---- Theme buttons ---- */
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const theme = this.getAttribute('data-theme');
        if (theme === 'default') {
          document.documentElement.removeAttribute('data-theme');
        } else {
          document.documentElement.setAttribute('data-theme', theme);
        }
        save({ theme });
      });
    });

    /* ---- Density buttons ---- */
    document.querySelectorAll('.density-options .option-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.density-options .option-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const density = this.getAttribute('data-density');
        if (density === 'default') {
          document.documentElement.removeAttribute('data-density');
        } else {
          document.documentElement.setAttribute('data-density', density);
        }
        save({ density });
      });
    });

    /* ---- Radius buttons ---- */
    document.querySelectorAll('.radius-options .option-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.radius-options .option-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const radius = this.getAttribute('data-radius');
        if (radius === 'default') {
          document.documentElement.removeAttribute('data-radius');
        } else {
          document.documentElement.setAttribute('data-radius', radius);
        }
        save({ radius });
      });
    });

    /* ---- Color swatches ---- */
    function _adjustBrightness(hex, pct) {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * pct);
      const R   = Math.min(255, Math.max(0, (num >> 16) + amt));
      const G   = Math.min(255, Math.max(0, (num >> 8 & 0xff) + amt));
      const B   = Math.min(255, Math.max(0, (num & 0xff) + amt));
      return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', function () {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        const color = this.getAttribute('data-color');
        document.documentElement.style.setProperty('--accent', color);
        document.documentElement.style.setProperty('--accent-hover', _adjustBrightness(color, 10));
        save({ accent: color });
      });
    });
  });
})();
