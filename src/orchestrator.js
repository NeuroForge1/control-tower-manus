// Orquestador de ciclos de contenido
import { storage } from './storage.js';
import { ManusClient } from './manus-client.js';
import { randomBytes } from 'crypto';

export class Orchestrator {
  constructor(manusApiKey) {
    this.manus = new ManusClient(manusApiKey);
  }

  generateId(prefix) {
    return `${prefix}_${randomBytes(16).toString('hex')}`;
  }

  async startCycle(mode, topic = null) {
    const cycle_id = this.generateId('cycle');
    
    // Crear ciclo
    const cycle = storage.createCycle({
      cycle_id,
      mode,
      topic_selected: topic,
      status: 'PENDING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Registrar evento
    storage.addEvent({
      cycle_id,
      type: 'CYCLE_CREATED',
      payload: { mode, topic }
    });

    // Iniciar fase de arquitectos
    try {
      await this.startArchitectPhase(cycle_id, topic);
      storage.updateCycle(cycle_id, { status: 'RUNNING' });
    } catch (error) {
      storage.updateCycle(cycle_id, { status: 'ERROR', error: error.message });
      storage.addEvent({
        cycle_id,
        type: 'ERROR',
        payload: { error: error.message }
      });
      throw error;
    }

    return storage.getCycle(cycle_id);
  }

  async startArchitectPhase(cycle_id, topic) {
    const cycle = storage.getCycle(cycle_id);
    if (!cycle) throw new Error('Cycle not found');

    // Crear task para Arquitecto LinkedIn
    const linkedinTask = await this.createArchitectTask(cycle_id, 'ARCH_LINKEDIN', topic);
    
    // Crear task para Arquitecto Facebook
    const facebookTask = await this.createArchitectTask(cycle_id, 'ARCH_FACEBOOK', topic);

    storage.addEvent({
      cycle_id,
      type: 'ARCHITECT_PHASE_STARTED',
      payload: {
        linkedin_task_id: linkedinTask.task_id,
        facebook_task_id: facebookTask.task_id
      }
    });

    return { linkedinTask, facebookTask };
  }

  async createArchitectTask(cycle_id, agent_type, topic) {
    const task_id = this.generateId('task');
    
    // Construir prompt según el tipo de arquitecto
    const prompt = this.buildArchitectPrompt(agent_type, topic);

    // Crear task en Manus
    const manusResponse = await this.manus.createTask(prompt, {
      agentProfile: 'manus-1.6'
    });

    // Guardar task en storage
    const task = storage.createTask({
      task_id,
      cycle_id,
      agent_type,
      status: 'CREATED',
      manus_task_id: manusResponse.id || manusResponse.task_id,
      manus_response: manusResponse,
      created_at: new Date().toISOString()
    });

    storage.addEvent({
      cycle_id,
      type: 'TASK_CREATED',
      payload: { task_id, agent_type, manus_task_id: task.manus_task_id }
    });

    // Actualizar estado a SENT
    storage.updateTask(task_id, { status: 'SENT' });

    return task;
  }

  buildArchitectPrompt(agent_type, topic) {
    const baseTopic = topic || 'tendencias actuales de tecnología y IA';

    if (agent_type === 'ARCH_LINKEDIN') {
      return `Eres un arquitecto de contenido para LinkedIn. 

Tema: ${baseTopic}

Genera:
1. Una imagen profesional (describe la imagen que debe crearse)
2. Copy en inglés (150-200 palabras, tono profesional)
3. Copy en español (150-200 palabras, tono profesional)

Formato de salida:
---
IMAGEN: [descripción detallada de la imagen]
---
COPY_EN:
[texto en inglés]
---
COPY_ES:
[texto en español]
---`;
    }

    if (agent_type === 'ARCH_FACEBOOK') {
      return `Eres un arquitecto de contenido para Facebook.

Tema: ${baseTopic}

Genera:
1. Secuencia visual de 3 piezas (describe cada imagen)
2. Copy final optimizado para Facebook (100-150 palabras)

Formato de salida:
---
PIEZA_1: [descripción de imagen 1]
---
PIEZA_2: [descripción de imagen 2]
---
PIEZA_3: [descripción de imagen 3]
---
COPY_FINAL:
[texto optimizado para Facebook]
---`;
    }

    throw new Error(`Unknown agent type: ${agent_type}`);
  }

  async handleWebhookEvent(event) {
    const { type, data } = event;

    // Buscar task asociada al manus_task_id
    const allTasks = Array.from(storage.getAllCycles()).flatMap(cycle => 
      storage.getTasksByCycle(cycle.cycle_id)
    );

    const task = allTasks.find(t => t.manus_task_id === data.task_id);
    if (!task) {
      console.log('Task not found for webhook event:', data.task_id);
      return;
    }

    const cycle_id = task.cycle_id;

    // Registrar evento
    storage.addEvent({
      cycle_id,
      type: `WEBHOOK_${type.toUpperCase()}`,
      payload: data
    });

    // Procesar según tipo de evento
    if (type === 'task_stopped') {
      await this.handleTaskCompleted(task, data);
    } else if (type === 'task_progress') {
      storage.updateTask(task.task_id, { 
        status: 'IN_PROGRESS',
        progress: data.progress 
      });
    }
  }

  async handleTaskCompleted(task, data) {
    // Actualizar task
    storage.updateTask(task.task_id, {
      status: 'DONE',
      output_refs: data.output || data.result,
      completed_at: new Date().toISOString()
    });

    const cycle = storage.getCycle(task.cycle_id);
    if (!cycle) return;

    // Verificar si todas las tasks de arquitectos están completas
    const cycleTasks = storage.getTasksByCycle(task.cycle_id);
    const architectTasks = cycleTasks.filter(t => 
      t.agent_type === 'ARCH_LINKEDIN' || t.agent_type === 'ARCH_FACEBOOK'
    );

    const allArchitectsDone = architectTasks.every(t => t.status === 'DONE');

    if (allArchitectsDone && !cycleTasks.some(t => t.agent_type === 'CREATOR')) {
      // Iniciar fase de creador
      await this.startCreatorPhase(task.cycle_id, architectTasks);
    }

    // Verificar si el creador terminó
    const creatorTask = cycleTasks.find(t => t.agent_type === 'CREATOR');
    if (creatorTask && creatorTask.status === 'DONE') {
      // Verificar criterios de cierre
      await this.checkCompletionCriteria(task.cycle_id);
    }
  }

  async startCreatorPhase(cycle_id, architectTasks) {
    const task_id = this.generateId('task');

    // Construir prompt para creador con outputs de arquitectos
    const linkedinOutput = architectTasks.find(t => t.agent_type === 'ARCH_LINKEDIN')?.output_refs;
    const facebookOutput = architectTasks.find(t => t.agent_type === 'ARCH_FACEBOOK')?.output_refs;

    const prompt = `Eres un creador de contenido. Basándote en los siguientes outputs de los arquitectos, genera el contenido final:

LINKEDIN OUTPUT:
${JSON.stringify(linkedinOutput, null, 2)}

FACEBOOK OUTPUT:
${JSON.stringify(facebookOutput, null, 2)}

Genera:
1. Assets finales (imágenes, videos, etc.)
2. Textos optimizados
3. Hashtags y llamados a la acción

Entrega todo en formato estructurado y listo para publicar.`;

    // Crear task en Manus
    const manusResponse = await this.manus.createTask(prompt);

    // Guardar task
    const task = storage.createTask({
      task_id,
      cycle_id,
      agent_type: 'CREATOR',
      status: 'SENT',
      manus_task_id: manusResponse.id || manusResponse.task_id,
      manus_response: manusResponse,
      created_at: new Date().toISOString()
    });

    storage.addEvent({
      cycle_id,
      type: 'CREATOR_PHASE_STARTED',
      payload: { task_id, manus_task_id: task.manus_task_id }
    });

    return task;
  }

  async checkCompletionCriteria(cycle_id) {
    const tasks = storage.getTasksByCycle(cycle_id);
    
    // Verificar que todos los tasks estén completos
    const allDone = tasks.every(t => t.status === 'DONE');
    
    if (allDone) {
      // Verificar criterios mínimos
      const linkedinTask = tasks.find(t => t.agent_type === 'ARCH_LINKEDIN');
      const facebookTask = tasks.find(t => t.agent_type === 'ARCH_FACEBOOK');
      const creatorTask = tasks.find(t => t.agent_type === 'CREATOR');

      const hasLinkedinOutputs = linkedinTask && linkedinTask.output_refs;
      const hasFacebookOutputs = facebookTask && facebookTask.output_refs;
      const hasCreatorOutputs = creatorTask && creatorTask.output_refs;

      if (hasLinkedinOutputs && hasFacebookOutputs && hasCreatorOutputs) {
        storage.updateCycle(cycle_id, { status: 'COMPLETE' });
        storage.addEvent({
          cycle_id,
          type: 'CYCLE_COMPLETED',
          payload: { 
            linkedin: linkedinTask.output_refs,
            facebook: facebookTask.output_refs,
            creator: creatorTask.output_refs
          }
        });
      } else {
        storage.updateCycle(cycle_id, { status: 'ERROR', error: 'Missing outputs' });
      }
    }
  }

  async retryCyclePhase(cycle_id, phase) {
    const cycle = storage.getCycle(cycle_id);
    if (!cycle) throw new Error('Cycle not found');

    storage.addEvent({
      cycle_id,
      type: 'RETRY_REQUESTED',
      payload: { phase }
    });

    if (phase === 'architect') {
      await this.startArchitectPhase(cycle_id, cycle.topic_selected);
    } else if (phase === 'creator') {
      const architectTasks = storage.getTasksByCycle(cycle_id).filter(t => 
        t.agent_type === 'ARCH_LINKEDIN' || t.agent_type === 'ARCH_FACEBOOK'
      );
      await this.startCreatorPhase(cycle_id, architectTasks);
    }

    return storage.getCycle(cycle_id);
  }
}
