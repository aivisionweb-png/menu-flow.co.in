import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import 'dotenv/config';
import { initDatabase } from './server/db';
import { createApiRouter } from './server/routes';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function bootstrap() {
  initDatabase();

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Channel-scoped WebSocket subscriptions
  const subscriptions = new Map<WebSocket, Set<string>>();

  wss.on('connection', (ws) => {
    subscriptions.set(ws, new Set());

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; channel?: string };
        if (msg.type === 'subscribe' && msg.channel) {
          subscriptions.get(ws)?.add(msg.channel);
          ws.send(JSON.stringify({ type: 'subscribed', channel: msg.channel }));
        } else if (msg.type === 'unsubscribe' && msg.channel) {
          subscriptions.get(ws)?.delete(msg.channel);
        }
      } catch {
        // Ignore malformed client frames
      }
    });

    ws.on('close', () => {
      subscriptions.delete(ws);
    });
  });

  function broadcast(channel: string, event: string, payload: unknown) {
    const frame = JSON.stringify({ type: 'event', channel, event, payload });
    for (const [client, channels] of subscriptions.entries()) {
      if (client.readyState === WebSocket.OPEN && channels.has(channel)) {
        client.send(frame);
      }
    }
  }

  app.use('/api', createApiRouter(broadcast));

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`MenuFlow server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start MenuFlow server:', err);
  process.exit(1);
});
