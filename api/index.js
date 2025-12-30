export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  return res.status(200).json({
    name: 'Control Tower - Manus API',
    version: '0.1.0',
    endpoints: {
      'POST /api/cycle/start': 'Iniciar un nuevo ciclo de contenido',
      'GET /api/cycle/:id': 'Obtener estado de un ciclo',
      'POST /api/webhook/manus': 'Recibir webhooks de Manus',
      'POST /api/admin/retry': 'Reintentar una fase del ciclo'
    },
    documentation: 'https://github.com/NeuroForge1/control-tower-manus#readme'
  });
}
