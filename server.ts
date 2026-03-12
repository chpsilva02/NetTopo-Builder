import express from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { parseRawData } from './src/server/services/parser';
import { applyLayout } from './src/server/services/layout';
import { generateDrawioXml } from './src/server/services/drawio';
import { COMMAND_PROFILES } from './src/server/services/profiles';
import { executeCommands } from './src/server/services/ssh';
import path from 'path';

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/profiles', (req, res) => {
    res.json(COMMAND_PROFILES);
  });

  app.post('/api/discovery', async (req, res) => {
    const { ip, username, password, vendor, customCommands } = req.body;
    
    try {
      // Flatten all commands to execute
      const allCommands = [
        ...(customCommands.l1 || []),
        ...(customCommands.l2 || []),
        ...(customCommands.l3 || []),
        ...(customCommands.hardware || [])
      ].filter(Boolean);

      let rawOutputs: Record<string, string> = {};
      let rawText = '';

      try {
        // Execute real SSH commands
        rawOutputs = await executeCommands(ip, username, password, allCommands);
        rawText = Object.entries(rawOutputs)
          .map(([cmd, out]) => `--- COMMAND: ${cmd} ---\n${out}\n`)
          .join('\n');
      } catch (sshError: any) {
        console.error('SSH Error:', sshError);
        return res.status(500).json({ 
          error: `Falha na conexão SSH com ${ip}. Verifique se o IP é acessível a partir da nuvem e se as credenciais estão corretas. Detalhes: ${sshError.message}` 
        });
      }

      const topology = parseRawData(rawText, vendor);
      const positionedTopology = applyLayout(topology);
      const xml = generateDrawioXml(positionedTopology);

      res.json({ xml, topology: positionedTopology, rawOutputs });
    } catch (error: any) {
      console.error('Discovery Error:', error);
      res.status(500).json({ error: 'Erro interno ao processar a topologia.' });
    }
  });

  app.post('/api/upload', upload.array('files'), (req, res) => {
    const vendor = req.body.vendor || 'cisco_ios';
    // Parse uploaded files
    const topology = parseRawData(`Simulated file parsing`, vendor);
    const positionedTopology = applyLayout(topology);
    const xml = generateDrawioXml(positionedTopology);

    res.json({ xml, topology: positionedTopology });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
