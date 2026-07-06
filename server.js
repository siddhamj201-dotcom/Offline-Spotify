/**
 * server.js
 * Offline Spotify — Local Express Server
 *
 * Serves index.html and provides API endpoints for:
 *   GET /api/scan    — Scans songs/ folder, syncs library.json, returns library
 *   GET /api/library — Returns current library.json contents
 *   PUT /api/library — Writes updated library.json (for favorites, play count, etc.)
 *   GET /songs/:file — Streams MP4 files from songs/ folder
 */

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const app  = express();
const PORT = 3000;

const ROOT_DIR    = __dirname;
const SONGS_DIR   = path.join(ROOT_DIR, 'songs');
const LIBRARY_FILE = path.join(ROOT_DIR, 'library.json');

app.use(express.json());

// Serve all static files (index.html, js/, css/, cache/, assets/)
app.use(express.static(ROOT_DIR));

// Serve MP4 files from songs/ with range-request support (for seeking)
app.get('/songs/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(SONGS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end   = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunkSize,
      'Content-Type':   'video/mp4',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type':   'video/mp4',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// GET /api/library — return current library
app.get('/api/library', (req, res) => {
  try {
    const data = fs.readFileSync(LIBRARY_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.json([]);
  }
});

// PUT /api/library — overwrite library.json (for play count, favorites, resume)
app.put('/api/library', (req, res) => {
  try {
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/scan — scan songs/ folder and sync library.json
app.get('/api/scan', (req, res) => {
  try {
    // Ensure songs folder exists
    if (!fs.existsSync(SONGS_DIR)) {
      fs.mkdirSync(SONGS_DIR, { recursive: true });
    }

    // Read current library
    let library = [];
    try {
      library = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
    } catch (e) {
      library = [];
    }

    // Build a map of existing entries by filename
    const existingMap = {};
    library.forEach(track => {
      existingMap[track.filename] = track;
    });

    // Read all .mp4 files in songs/
    const files = fs.readdirSync(SONGS_DIR).filter(f =>
      f.toLowerCase().endsWith('.mp4')
    );

    // Build updated library (add new, keep existing metadata)
    const updatedLibrary = files.map(filename => {
      if (existingMap[filename]) {
        // Existing track — preserve metadata
        return existingMap[filename];
      }
      // New track — create entry
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      const title = filename.replace(/\.mp4$/i, '').replace(/[_-]/g, ' ');
      return {
        id,
        filename,
        title,
        path: `songs/${filename}`,
        duration: 0,
        thumbnail: null,
        favorite: false,
        playCount: 0,
        lastPlayed: null,
        resumePosition: 0
      };
    });

    // Write updated library
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(updatedLibrary, null, 2), 'utf8');

    res.json(updatedLibrary);
  } catch (e) {
    console.error('Scan error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎵 Offline Spotify running at http://localhost:${PORT}\n`);
});
