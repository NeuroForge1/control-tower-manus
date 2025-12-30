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
    const { cycle_id, phase } = req.body;

    if (!cycle_id) {
      return res.status(400).json({ error: 'Missing cycle_id' });
    }

    if (!phase || !['architect', 'creator'].includes(phase)) {
      return res.status(400).json({ 
        error: 'Invalid phase. Must be architect or creator' 
      });
    }

    // Crear orquestador
    const orchestrator = new Orchestrator(process.env.MANUS_API_KEY);

    // Reintentar fase
    const cycle = await orchestrator.retryCyclePhase(cycle_id, phase);

    return res.status(200).json({
      ok: true,
      cycle_id: cycle.cycle_id,
      status: cycle.status,
      retried_phase: phase
    });

  } catch (error) {
    console.error('Error retrying phase:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
