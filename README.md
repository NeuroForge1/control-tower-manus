# Control Tower - Manus Orchestrator Bridge

Backend de orquestación que permite ejecutar ciclos completos de creación de contenido vía API de Manus.

## 🎯 Objetivo

Orquestar automáticamente el flujo:
1. **Arquitecto LinkedIn** → genera estrategia y copy para LinkedIn
2. **Arquitecto Facebook** → genera estrategia y secuencia visual para Facebook
3. **Creador** → produce assets finales basándose en los outputs de arquitectos
4. **Cierre** → verifica criterios y marca ciclo como completo

## 🏗️ Arquitectura

```
Cliente → Control Tower (Vercel) → Manus API
          ↓
      Storage (in-memory)
      - Cycles
      - Tasks
      - Events
```

## 📋 Endpoints

### 1. `POST /api/cycle/start`
Inicia un nuevo ciclo de contenido.

**Headers:**
```
Authorization: Bearer <ORCHESTRATOR_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "mode": "NORMAL|FORZAR_NUEVO|NUEVO_TEMA",
  "topic": "tema opcional"
}
```

**Response:**
```json
{
  "ok": true,
  "cycle_id": "cycle_abc123...",
  "status": "RUNNING",
  "mode": "NORMAL",
  "topic": "tendencias actuales de tecnología y IA",
  "created_at": "2025-12-30T10:00:00.000Z"
}
```

### 2. `GET /api/cycle/:id`
Obtiene el estado completo de un ciclo.

**Headers:**
```
Authorization: Bearer <ORCHESTRATOR_TOKEN>
```

**Response:**
```json
{
  "ok": true,
  "cycle": {
    "cycle_id": "cycle_abc123...",
    "mode": "NORMAL",
    "status": "RUNNING",
    "topic_selected": "...",
    "created_at": "...",
    "updated_at": "..."
  },
  "tasks": [
    {
      "task_id": "task_xyz...",
      "cycle_id": "cycle_abc123...",
      "agent_type": "ARCH_LINKEDIN",
      "status": "SENT",
      "manus_task_id": "..."
    }
  ],
  "events": [
    {
      "cycle_id": "cycle_abc123...",
      "type": "CYCLE_CREATED",
      "timestamp": "...",
      "payload": {}
    }
  ],
  "summary": {
    "total_tasks": 3,
    "completed_tasks": 0,
    "pending_tasks": 3,
    "failed_tasks": 0
  }
}
```

### 3. `POST /api/webhook/manus`
Endpoint público para recibir webhooks de Manus.

**Headers:**
```
X-Manus-Signature: <signature>
X-Manus-Timestamp: <timestamp>
Content-Type: application/json
```

**Body:**
```json
{
  "type": "task_stopped",
  "data": {
    "task_id": "...",
    "status": "completed",
    "output": {}
  }
}
```

**Response:**
```json
{
  "ok": true,
  "event_type": "task_stopped",
  "received_at": "2025-12-30T10:00:00.000Z"
}
```

### 4. `POST /api/admin/retry`
Reintenta una fase del ciclo si falló.

**Headers:**
```
Authorization: Bearer <ORCHESTRATOR_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "cycle_id": "cycle_abc123...",
  "phase": "architect|creator"
}
```

**Response:**
```json
{
  "ok": true,
  "cycle_id": "cycle_abc123...",
  "status": "RUNNING",
  "retried_phase": "architect"
}
```

## 🔐 Variables de Entorno

Configurar en Vercel:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MANUS_API_KEY` | API key de Manus (OBLIGATORIO) | `sk-...` |
| `ORCHESTRATOR_TOKEN` | Token para autenticar requests | `999048e3...` |
| `WEBHOOK_SECRET` | Secret para verificar webhooks | `bef8796e...` |
| `BASE_URL` | URL del deployment Vercel | `https://control-tower-manus.vercel.app` |

## 🚀 Deployment

### Prerequisitos
- Cuenta de GitHub
- Cuenta de Vercel
- API Key de Manus

### Pasos

1. **Clonar repositorio**
```bash
git clone https://github.com/NeuroForge1/control-tower-manus.git
cd control-tower-manus
```

2. **Conectar con Vercel**
- Ve a https://vercel.com/new
- Importa el repositorio `control-tower-manus`
- Configura las variables de entorno

3. **Configurar variables de entorno en Vercel**
```
MANUS_API_KEY=<tu-api-key>
ORCHESTRATOR_TOKEN=999048e3214bf276b6d220c39cc452927025f40aa06a0d2e4cace7f302601298
WEBHOOK_SECRET=bef8796e5c76b05f05c8d21e76d31ced6d4565d40f18cdf362d7f7c9a4f68a84
BASE_URL=https://tu-deployment.vercel.app
```

4. **Deploy**
Vercel desplegará automáticamente al hacer push a `main`.

## 🧪 Testing

### Test 1: Iniciar ciclo
```bash
curl -X POST https://control-tower-manus.vercel.app/api/cycle/start \
  -H "Authorization: Bearer 999048e3214bf276b6d220c39cc452927025f40aa06a0d2e4cace7f302601298" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "NORMAL",
    "topic": "Inteligencia Artificial y automatización"
  }'
```

### Test 2: Ver estado del ciclo
```bash
curl https://control-tower-manus.vercel.app/api/cycle/<CYCLE_ID> \
  -H "Authorization: Bearer 999048e3214bf276b6d220c39cc452927025f40aa06a0d2e4cace7f302601298"
```

### Test 3: Simular webhook
```bash
curl -X POST https://control-tower-manus.vercel.app/api/webhook/manus \
  -H "Content-Type: application/json" \
  -d '{
    "type": "task_stopped",
    "data": {
      "task_id": "task_abc123",
      "status": "completed",
      "output": {
        "content": "..."
      }
    }
  }'
```

## 📊 Flujo de Ejecución

```
1. Cliente llama POST /api/cycle/start
   ↓
2. Control Tower crea ciclo y tasks para arquitectos
   ↓
3. Arquitectos ejecutan en Manus (paralelo)
   ↓
4. Webhooks notifican cuando terminan
   ↓
5. Control Tower inicia fase de Creador
   ↓
6. Creador ejecuta en Manus
   ↓
7. Webhook notifica cuando termina
   ↓
8. Control Tower verifica criterios y marca COMPLETE
```

## 🔧 Criterios de Cierre

### LinkedIn
- ✅ 1 imagen final (link/asset)
- ✅ Copy EN (150-200 palabras)
- ✅ Copy ES (150-200 palabras)

### Facebook
- ✅ Secuencia visual (3 piezas por defecto)
- ✅ Copy final optimizado

## 📝 Entidades

### Cycle
```typescript
{
  cycle_id: string;
  mode: "NORMAL" | "FORZAR_NUEVO" | "NUEVO_TEMA";
  topic_selected: string | null;
  status: "PENDING" | "RUNNING" | "WAITING_WEBHOOK" | "COMPLETE" | "ERROR";
  created_at: string;
  updated_at: string;
}
```

### Task
```typescript
{
  task_id: string;
  cycle_id: string;
  agent_type: "ARCH_LINKEDIN" | "ARCH_FACEBOOK" | "CREATOR";
  status: "CREATED" | "SENT" | "IN_PROGRESS" | "DONE" | "ERROR";
  manus_task_id: string;
  output_refs: any;
  created_at: string;
  completed_at?: string;
}
```

### Event
```typescript
{
  cycle_id: string;
  type: string;
  timestamp: string;
  payload: any;
}
```

## 🐛 Troubleshooting

### Error 401: Unauthorized
- Verifica que el `ORCHESTRATOR_TOKEN` sea correcto
- Verifica que estés enviando el header `Authorization: Bearer <token>`

### Error 500: Manus API error
- Verifica que `MANUS_API_KEY` sea válido
- Revisa los logs en Vercel

### Webhook no recibe eventos
- Verifica que el webhook esté registrado en Manus
- Verifica que la URL sea accesible públicamente
- Revisa los logs del endpoint `/api/webhook/manus`

## 📚 Referencias

- [Manus API Documentation](https://open.manus.im/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Repository](https://github.com/NeuroForge1/control-tower-manus)

## 📄 Licencia

MIT
