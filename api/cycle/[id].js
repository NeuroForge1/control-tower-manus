import { storage } from '../../src/storage.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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

    // Obtener cycle_id de la URL
    const cycle_id = req.query.id;

    if (!cycle_id) {
      return res.status(400).json({ error: 'Missing cycle_id' });
    }

    // Obtener ciclo
    const cycle = storage.getCycle(cycle_id);

    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    // Obtener tasks asociadas
    const tasks = storage.getTasksByCycle(cycle_id);

    // Obtener eventos
    const events = storage.getEventsByCycle(cycle_id);

    return res.status(200).json({
      ok: true,
      cycle,
      tasks,
      events,
      summary: {
        total_tasks: tasks.length,
        completed_tasks: tasks.filter(t => t.status === 'DONE').length,
        pending_tasks: tasks.filter(t => t.status !== 'DONE' && t.status !== 'ERROR').length,
        failed_tasks: tasks.filter(t => t.status === 'ERROR').length
      }
    });

  } catch (error) {
    console.error('Error getting cycle:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
