import express from 'express';
import path from 'node:path';
import { createApiMiddleware } from './apiMiddleware';

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Mount API middleware
app.use(createApiMiddleware());

// Serve static public images and built frontend when in production
const distPath = path.resolve(process.cwd(), 'dist');
app.use('/images', express.static(path.resolve(process.cwd(), 'public', 'images')));
app.use(express.static(distPath));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Two Kids Design server listening on http://localhost:${PORT}`);
});
