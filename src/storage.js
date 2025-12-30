// Storage en memoria para ciclos, tasks y eventos
// En producción, esto debería ser reemplazado por una DB real (Upstash Redis, Vercel KV, etc.)

const cycles = new Map();
const tasks = new Map();
const events = [];

export const storage = {
  // Cycles
  createCycle(cycle) {
    cycles.set(cycle.cycle_id, cycle);
    return cycle;
  },

  getCycle(cycle_id) {
    return cycles.get(cycle_id);
  },

  updateCycle(cycle_id, updates) {
    const cycle = cycles.get(cycle_id);
    if (!cycle) return null;
    
    const updated = { ...cycle, ...updates, updated_at: new Date().toISOString() };
    cycles.set(cycle_id, updated);
    return updated;
  },

  getAllCycles() {
    return Array.from(cycles.values());
  },

  // Tasks
  createTask(task) {
    tasks.set(task.task_id, task);
    return task;
  },

  getTask(task_id) {
    return tasks.get(task_id);
  },

  updateTask(task_id, updates) {
    const task = tasks.get(task_id);
    if (!task) return null;
    
    const updated = { ...task, ...updates };
    tasks.set(task_id, updated);
    return updated;
  },

  getTasksByCycle(cycle_id) {
    return Array.from(tasks.values()).filter(t => t.cycle_id === cycle_id);
  },

  // Events
  addEvent(event) {
    const eventWithTimestamp = {
      ...event,
      timestamp: new Date().toISOString()
    };
    events.push(eventWithTimestamp);
    return eventWithTimestamp;
  },

  getEventsByCycle(cycle_id) {
    return events.filter(e => e.cycle_id === cycle_id);
  },

  getAllEvents() {
    return events;
  }
};
