import { Orchestrator } from '../../src/orchestrator.js';
import { createHmac } from 'crypto';

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');
  return signature === expectedSignature;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Manus-Signature, X-Manus-Timestamp');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;
    const signature = req.headers['x-manus-signature'];
    const timestamp = req.headers['x-manus-timestamp'];

    // Verificar firma (si está presente)
    if (signature && process.env.WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    // Verificar timestamp (no más de 5 minutos de antigüedad)
    if (timestamp) {
      const now = Date.now();
      const webhookTime = parseInt(timestamp) * 1000;
      const diff = Math.abs(now - webhookTime);
      
      if (diff > 5 * 60 * 1000) {
        return res.status(400).json({ error: 'Webhook timestamp too old' });
      }
    }

    // Procesar evento
    const orchestrator = new Orchestrator(process.env.MANUS_API_KEY);
    await orchestrator.handleWebhookEvent(payload);

    return res.status(200).json({
      ok: true,
      event_type: payload.type,
      received_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
