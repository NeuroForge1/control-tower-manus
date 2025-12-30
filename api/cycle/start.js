import { Orchestrator } from '../../src/orchestrator.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.ORCHESTRATOR_TOKEN;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Parsear body
    const { mode, topic } = req.body;

    if (!mode || !['NORMAL', 'FORZAR_NUEVO', 'NUEVO_TEMA'].includes(mode)) {
      return res.status(400).json({ 
        error: 'Invalid mode. Must be NORMAL, FORZAR_NUEVO, or NUEVO_TEMA' 
      });
    }

    // Crear orquestador
    const orchestrator = new Orchestrator(process.env.MANUS_API_KEY);

    // Iniciar ciclo
    const cycle = await orchestrator.startCycle(mode, topic);

    return res.status(200).json({
      ok: true,
      cycle_id: cycle.cycle_id,
      status: cycle.status,
      mode: cycle.mode,
      topic: cycle.topic_selected,
      created_at: cycle.created_at
    });

  } catch (error) {
    console.error('Error starting cycle:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
