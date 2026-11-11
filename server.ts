import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  reconstructImageTo3D,
  scrapeIkeaProductUrl,
  searchIkeaProducts,
  synthesizeProduct3D,
} from './src/server/ikeaService.js';
import type { IkeaProduct } from './src/types/ikea.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // 1. Live IKEA Catalog Search (Czech & English, always returns 6 matching products)
  app.post('/api/ikea/search', async (req, res) => {
    try {
      const result = await searchIkeaProducts(req.body?.query);
      res.json(result);
    } catch (error) {
      console.error('Search endpoint failed:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // 2. Real IKEA URL Scraper (CORS-Safe via allorigins + r.jina.ai + Gemini)
  app.post('/api/ikea/scrape-url', async (req, res) => {
    try {
      const result = await scrapeIkeaProductUrl(req.body?.url);
      res.json(result);
    } catch (error) {
      console.error('URL scrape endpoint failed:', error);
      res.status(500).json({ error: 'URL scrape failed' });
    }
  });

  // 3. Direct Image Upload / Paste (Ctrl+V) -> Multimodal Gemini Image-to-3D
  app.post('/api/ikea/image-to-3d', async (req, res) => {
    try {
      const result = await reconstructImageTo3D(req.body || {});
      res.json(result);
    } catch (error) {
      console.error('Image-to-3D endpoint failed:', error);
      res.status(500).json({ error: 'Failed to reconstruct 3D model from image' });
    }
  });

  // 4. Multi-Part 3D CAD Synthesis (20 to 40 sub-parts)
  app.post('/api/ikea/generate-3d', async (req, res) => {
    try {
      const { status, payload } = await synthesizeProduct3D(
        req.body as { product?: IkeaProduct; swatchHex?: string; swatchName?: string }
      );
      res.status(status).json(payload);
    } catch (error) {
      console.error('Generate-3D endpoint failed:', error);
      res.status(500).json({ error: 'Failed to synthesize 3D model' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`IKEA Space Planner & Multi-Room Apartment VR Architect running on http://localhost:${PORT}`);
  });
}

startServer();
