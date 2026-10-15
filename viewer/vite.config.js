import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

async function forwardToOfflineTranslator(payload) {
  const offlineApiUrl = process.env.OFFLINE_TRANSLATION_URL || 'http://127.0.0.1:8000';
  const res = await fetch(`${offlineApiUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: payload.text || '',
      src_lang: payload.src_lang || payload.sourceLanguage || 'auto'
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    throw new Error(`Offline translator returned status ${res.status}`);
  }
  return await res.json();
}

async function forwardToOfflineSpeechProcessor(payload) {
  const offlineApiUrl = process.env.OFFLINE_TRANSLATION_URL || 'http://127.0.0.1:8000';
  const res = await fetch(`${offlineApiUrl}/process_speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: payload.text || null,
      audio_base64: payload.audio_base64 || payload.audioContent || null,
      src_lang: payload.src_lang || payload.sourceLanguage || 'auto'
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) {
    throw new Error(`Offline speech processor returned status ${res.status}`);
  }
  return await res.json();
}

export default defineConfig({
  server: {
    port: 5173,
    host: '127.0.0.1',
    fs: {
      allow: [path.resolve('..')]
    }
  },
  plugins: [
    {
      name: 'serve-workspace-assets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const rawUrl = req.url.split('?')[0];

          // Offline Speech & Multilingual Processing API endpoint (Whisper + IndicTrans2)
          if (req.method === 'POST' && (rawUrl === '/api/process_speech' || rawUrl === '/api/asr')) {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                const result = await forwardToOfflineSpeechProcessor(payload);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify(result));
              } catch (err) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 503;
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
            return;
          }

          // Offline Translation Pipeline API endpoint (IndicTrans2)
          if (req.method === 'POST' && rawUrl === '/api/translate') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const payload = JSON.parse(body || '{}');
                const result = await forwardToOfflineTranslator(payload);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  translated_text: result.translated_text,
                  detected_lang: result.detected_lang,
                  src_lang: result.src_lang,
                  original_text: result.original_text
                }));
              } catch (err) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 503;
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
            return;
          }

          let targetRelPath = null;

          // Helper to find file case-insensitively and with extension variations (.png, .jpeg, .jpg)
          const resolveMediaFile = (dirPath, filename) => {
            if (!fs.existsSync(dirPath)) return null;
            const direct = path.join(dirPath, filename);
            if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;

            const baseName = path.parse(filename).name.toLowerCase();
            const files = fs.readdirSync(dirPath);
            const found = files.find(f => path.parse(f).name.toLowerCase() === baseName);
            if (found) {
              const matchedPath = path.join(dirPath, found);
              if (fs.existsSync(matchedPath) && fs.statSync(matchedPath).isFile()) {
                return matchedPath;
              }
            }
            return null;
          };

          const sendMatchedFile = (filePath) => {
            if (filePath.endsWith('.glb')) res.setHeader('Content-Type', 'model/gltf-binary');
            else if (filePath.endsWith('.bvh')) res.setHeader('Content-Type', 'text/plain');
            else if (filePath.endsWith('.json')) res.setHeader('Content-Type', 'application/json');
            else if (filePath.endsWith('.npy')) res.setHeader('Content-Type', 'application/octet-stream');
            else if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
            else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
            if (req.method === 'HEAD') {
              res.setHeader('Content-Length', fs.statSync(filePath).size);
              return res.end();
            }
            return fs.createReadStream(filePath).pipe(res);
          };

          if (rawUrl.startsWith('/alphabets/')) {
            const fname = decodeURIComponent(rawUrl.replace('/alphabets/', ''));
            const dir = path.resolve('..', 'beginner sign lang', 'ALPHABETS');
            const match = resolveMediaFile(dir, fname);
            if (match) return sendMatchedFile(match);
          } else if (rawUrl.startsWith('/numbers/')) {
            const fname = decodeURIComponent(rawUrl.replace('/numbers/', ''));
            const dir = path.resolve('..', 'beginner sign lang', 'NUMBERS');
            const match = resolveMediaFile(dir, fname);
            if (match) return sendMatchedFile(match);
          } else if (rawUrl.startsWith('/archive-data/')) {
            targetRelPath = decodeURIComponent(rawUrl.replace('/archive-data/', ''));
          } else if (rawUrl.startsWith('/Train/')) {
            targetRelPath = decodeURIComponent(rawUrl.substring(1)); // "Train/..."
          } else if (rawUrl.startsWith('/beginner sign lang/') || rawUrl.startsWith('/beginner%20sign%20lang/')) {
            targetRelPath = decodeURIComponent(rawUrl.substring(1));
          } else if (rawUrl === '/character_clean.glb') {
            targetRelPath = 'character_clean.glb';
          }

          if (targetRelPath) {
            const filePath = path.resolve('..', targetRelPath);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              return sendMatchedFile(filePath);
            }
            // Check case/extension variations within parent dir
            const dir = path.dirname(filePath);
            const base = path.basename(filePath);
            const fallback = resolveMediaFile(dir, base);
            if (fallback) {
              return sendMatchedFile(fallback);
            }
          }
          next();
        });
      }
    }
  ]
});
