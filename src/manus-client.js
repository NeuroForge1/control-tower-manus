// Cliente para interactuar con Manus API
// Documentación: https://open.manus.im/docs/api-reference

const MANUS_API_BASE = 'https://open.manus.im/v1';

export class ManusClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async createTask(prompt, options = {}) {
    const response = await fetch(`${MANUS_API_BASE}/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        agentProfile: options.agentProfile || 'manus-1.6',
        ...options
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Manus API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  async createWebhook(url, options = {}) {
    const response = await fetch(`${MANUS_API_BASE}/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        events: options.events || ['task_created', 'task_progress', 'task_stopped'],
        ...options
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Manus API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  async getTask(taskId) {
    const response = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Manus API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }
}
