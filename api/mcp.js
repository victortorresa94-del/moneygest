// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  /api/mcp — MoneyGest MCP server (Streamable HTTP)
//  Protocolo: MCP 2025-03-26
//
//  Registra este endpoint en Claude → Integrations:
//  URL: https://<tu-dominio>.vercel.app/api/mcp?key=<MONEYGEST_API_KEY>
//  (La clave va en la URL porque Claude.ai no soporta headers custom)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const API_KEY      = process.env.MONEYGEST_API_KEY;

const DB_HEADERS = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
};

// ── Supabase helpers ──────────────────────────────────

async function dbGet() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/moneygest_data?id=eq.1&select=*`, { headers: DB_HEADERS });
  const rows = await r.json();
  return rows[0] ?? { tx: [], exp: [], sub: [], bills: [], savings: [], invoices: [], cats_personal: null, cats_business: null };
}

async function dbPatch(updates) {
  await fetch(`${SUPABASE_URL}/rest/v1/moneygest_data?id=eq.1`, {
    method: 'PATCH',
    headers: { ...DB_HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  });
}

// ── Helpers ───────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function today() { return new Date().toISOString().split('T')[0]; }
function fmt(n) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }

function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function txInMonth(tx, y, m) {
  const d = new Date(tx.date + 'T12:00:00');
  return d.getFullYear() === y && d.getMonth() === m;
}

// ── Tool definitions ──────────────────────────────────

const TOOLS = [
  {
    name: 'get_summary',
    description: 'Resumen financiero actual: patrimonio total, gastos del mes, pagos pendientes e ingresos pendientes. Úsalo siempre para responder preguntas sobre el estado de las finanzas.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_transaction',
    description: 'Añade un ingreso o gasto a MoneyGest.',
    inputSchema: {
      type: 'object',
      required: ['type', 'description', 'amount'],
      properties: {
        type:        { type: 'string', enum: ['income', 'expense'], description: 'income = ingreso, expense = gasto' },
        description: { type: 'string', description: 'Descripción breve' },
        amount:      { type: 'number', description: 'Importe en euros (positivo)' },
        category:    { type: 'string', description: 'Categoría: Alimentación, Transporte, Vivienda, Salud, Ocio, Streaming, Suministros, Software, Servicios, Freelance, Inversiones...' },
        date:        { type: 'string', description: 'Fecha YYYY-MM-DD (por defecto hoy)' },
        profile:     { type: 'string', enum: ['personal', 'business'], description: 'personal o business (empresa). Por defecto personal.' },
        note:        { type: 'string', description: 'Nota opcional' },
      },
    },
  },
  {
    name: 'list_transactions',
    description: 'Lista los movimientos recientes de MoneyGest.',
    inputSchema: {
      type: 'object',
      properties: {
        limit:   { type: 'number', description: 'Número de resultados (por defecto 10)' },
        type:    { type: 'string', enum: ['income', 'expense', 'all'], description: 'Filtrar por tipo (por defecto all)' },
        profile: { type: 'string', enum: ['personal', 'business', 'all'], description: 'Filtrar por perfil' },
      },
    },
  },
  {
    name: 'add_bill',
    description: 'Añade un pago pendiente (factura, recibo, etc.).',
    inputSchema: {
      type: 'object',
      required: ['name', 'amount'],
      properties: {
        name:     { type: 'string', description: 'Nombre del pago' },
        amount:   { type: 'number', description: 'Importe en euros' },
        emoji:    { type: 'string', description: 'Emoji representativo, ej: 💡 🏠 💳' },
        dueDate:  { type: 'string', description: 'Fecha de vencimiento YYYY-MM-DD' },
        note:     { type: 'string', description: 'Nota opcional' },
        profile:  { type: 'string', enum: ['personal', 'business'] },
      },
    },
  },
  {
    name: 'list_bills',
    description: 'Lista los pagos pendientes.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'paid', 'all'], description: 'Filtrar por estado (por defecto pending)' },
      },
    },
  },
  {
    name: 'mark_bill_paid',
    description: 'Marca un pago pendiente como pagado.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Nombre o parte del nombre del pago' },
      },
    },
  },
  {
    name: 'add_recurring',
    description: 'Añade un pago recurrente (suscripción, alquiler, autónomo, luz, etc.).',
    inputSchema: {
      type: 'object',
      required: ['name', 'amount', 'cycle', 'day'],
      properties: {
        name:    { type: 'string', description: 'Nombre del pago recurrente' },
        amount:  { type: 'number', description: 'Importe en euros' },
        cycle:   { type: 'string', enum: ['monthly', 'annual', 'weekly', 'quarterly'], description: 'Frecuencia' },
        day:     { type: 'number', description: 'Día del mes en que se cobra (1-31)' },
        emoji:   { type: 'string', description: 'Emoji, ej: 🏠 ⚡ 📺 💻' },
        profile: { type: 'string', enum: ['personal', 'business'] },
        note:    { type: 'string' },
      },
    },
  },
  {
    name: 'list_recurring',
    description: 'Lista los pagos recurrentes activos.',
    inputSchema: {
      type: 'object',
      properties: {
        active_only: { type: 'boolean', description: 'Solo mostrar activos (por defecto true)' },
      },
    },
  },
  {
    name: 'add_expected_income',
    description: 'Añade un ingreso esperado / pendiente de cobrar.',
    inputSchema: {
      type: 'object',
      required: ['source', 'amount'],
      properties: {
        source:       { type: 'string', description: 'Nombre o fuente del ingreso' },
        amount:       { type: 'number', description: 'Importe esperado en euros' },
        expectedDate: { type: 'string', description: 'Fecha esperada de cobro YYYY-MM-DD' },
        profile:      { type: 'string', enum: ['personal', 'business'] },
        note:         { type: 'string' },
      },
    },
  },
  {
    name: 'delete_transaction',
    description: 'Elimina un movimiento por descripción (búsqueda parcial). Pide confirmación al usuario antes.',
    inputSchema: {
      type: 'object',
      required: ['description'],
      properties: {
        description: { type: 'string', description: 'Descripción o parte del nombre del movimiento a eliminar' },
      },
    },
  },
];

// ── Tool execution ────────────────────────────────────

async function callTool(name, args = {}) {
  const data = await dbGet();
  const tx      = Array.isArray(data.tx)      ? data.tx      : [];
  const exp     = Array.isArray(data.exp)     ? data.exp     : [];
  const sub     = Array.isArray(data.sub)     ? data.sub     : [];
  const bills   = Array.isArray(data.bills)   ? data.bills   : [];
  const savings = Array.isArray(data.savings) ? data.savings : [];

  switch (name) {

    case 'get_summary': {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      const savingsExt  = savings.filter(s => !s.fromIncome).reduce((a, s) => a + s.amount, 0);
      const allIncome   = tx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      const allExpense  = tx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
      const patrimonio  = savingsExt + allIncome - allExpense;
      const monthTx     = tx.filter(t => txInMonth(t, y, m));
      const gastosM     = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
      const ingresosM   = monthTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
      const pendingBills = bills.filter(b => b.status === 'pending');
      const totalBills   = pendingBills.reduce((a, b) => a + b.amount, 0);
      const pendingExp   = exp.filter(e => e.status === 'pending' || e.status === 'overdue');
      const totalExp     = pendingExp.reduce((a, e) => a + e.amount, 0);
      const activeSubs   = sub.filter(s => s.active);
      const monthlyRecurring = activeSubs.reduce((a, s) => {
        const r = { monthly: 1, quarterly: 1/3, annual: 1/12, weekly: 4.33 };
        return a + s.amount * (r[s.cycle] || 1);
      }, 0);
      return {
        patrimonio_total:      fmt(patrimonio),
        gastos_este_mes:       fmt(gastosM),
        ingresos_este_mes:     fmt(ingresosM),
        balance_mes:           fmt(ingresosM - gastosM),
        pagos_pendientes:      fmt(totalBills),
        pagos_pendientes_n:    pendingBills.length,
        ingresos_pendientes:   fmt(totalExp),
        ingresos_pendientes_n: pendingExp.length,
        pagos_recurrentes_mes: fmt(monthlyRecurring),
        pagos_recurrentes_n:   activeSubs.length,
        movimientos_totales:   tx.length,
        periodo: `${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m]} ${y}`,
      };
    }

    case 'add_transaction': {
      const newTx = {
        id: uid(), type: args.type, description: args.description,
        amount: parseFloat(args.amount), category: args.category || '',
        date: args.date || today(), note: args.note || '', profile: args.profile || 'personal',
      };
      tx.unshift(newTx);
      await dbPatch({ tx });
      return { ok: true, message: `${args.type === 'income' ? 'Ingreso' : 'Gasto'} de ${fmt(newTx.amount)} añadido: "${newTx.description}" (${fmtDate(newTx.date)})` };
    }

    case 'list_transactions': {
      const limit = args.limit ?? 10;
      const typeF = args.type ?? 'all';
      const profileF = args.profile ?? 'all';
      let list = [...tx];
      if (typeF    !== 'all') list = list.filter(t => t.type    === typeF);
      if (profileF !== 'all') list = list.filter(t => t.profile === profileF);
      list = list.slice(0, limit);
      return {
        total: list.length,
        transactions: list.map(t => ({
          tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
          descripcion: t.description, importe: fmt(t.amount),
          fecha: fmtDate(t.date), categoria: t.category || '—',
          perfil: t.profile || 'personal', nota: t.note || '',
        })),
      };
    }

    case 'add_bill': {
      const newBill = {
        id: uid(), name: args.name, emoji: args.emoji || '💳',
        amount: parseFloat(args.amount), dueDate: args.dueDate || '',
        status: 'pending', note: args.note || '', profile: args.profile || 'personal', recurring: false,
      };
      bills.push(newBill);
      await dbPatch({ bills });
      return { ok: true, message: `Pago pendiente añadido: "${newBill.name}" por ${fmt(newBill.amount)}${newBill.dueDate ? ` (vence ${fmtDate(newBill.dueDate)})` : ''}` };
    }

    case 'list_bills': {
      const statusF = args.status ?? 'pending';
      let list = [...bills];
      if (statusF !== 'all') list = list.filter(b => b.status === statusF);
      return {
        total: list.length,
        bills: list.map(b => ({
          nombre: b.name, importe: fmt(b.amount),
          vencimiento: b.dueDate ? fmtDate(b.dueDate) : 'Sin fecha',
          estado: b.status === 'paid' ? 'Pagado' : 'Pendiente', perfil: b.profile || 'personal',
        })),
      };
    }

    case 'mark_bill_paid': {
      const match = bills.find(b => b.name.toLowerCase().includes(args.name.toLowerCase()));
      if (!match) return { ok: false, message: `No encontré ningún pago con nombre "${args.name}"` };
      match.status = 'paid';
      await dbPatch({ bills });
      return { ok: true, message: `"${match.name}" marcado como pagado ✓` };
    }

    case 'add_recurring': {
      const newSub = {
        id: uid(), name: args.name, emoji: args.emoji || '📦',
        amount: parseFloat(args.amount), cycle: args.cycle, day: parseInt(args.day),
        note: args.note || '', active: true, profile: args.profile || 'personal',
      };
      sub.push(newSub);
      await dbPatch({ sub });
      const cycleLabel = { monthly: 'mensual', annual: 'anual', weekly: 'semanal', quarterly: 'trimestral' };
      return { ok: true, message: `Pago recurrente añadido: "${newSub.name}" ${fmt(newSub.amount)} ${cycleLabel[newSub.cycle]}, día ${newSub.day}` };
    }

    case 'list_recurring': {
      const activeOnly = args.active_only ?? true;
      let list = activeOnly ? sub.filter(s => s.active) : [...sub];
      list.sort((a, b) => a.day - b.day);
      const cycleLabel = { monthly: 'Mensual', annual: 'Anual', weekly: 'Semanal', quarterly: 'Trimestral' };
      const total = list.reduce((a, s) => {
        const r = { monthly: 1, quarterly: 1/3, annual: 1/12, weekly: 4.33 };
        return a + s.amount * (r[s.cycle] || 1);
      }, 0);
      return {
        total_mes: fmt(total), n: list.length,
        recurrentes: list.map(s => ({
          nombre: s.name, importe: fmt(s.amount),
          ciclo: cycleLabel[s.cycle] || s.cycle, dia: `Día ${s.day}`,
          activo: s.active, perfil: s.profile || 'personal',
        })),
      };
    }

    case 'add_expected_income': {
      const newExp = {
        id: uid(), source: args.source, amount: parseFloat(args.amount),
        expectedDate: args.expectedDate || '', status: 'pending',
        note: args.note || '', profile: args.profile || 'personal', category: '',
      };
      exp.push(newExp);
      await dbPatch({ exp });
      return { ok: true, message: `Ingreso esperado añadido: "${newExp.source}" por ${fmt(newExp.amount)}${newExp.expectedDate ? ` para el ${fmtDate(newExp.expectedDate)}` : ''}` };
    }

    case 'delete_transaction': {
      const match = tx.find(t => t.description.toLowerCase().includes(args.description.toLowerCase()));
      if (!match) return { ok: false, message: `No encontré ningún movimiento con descripción "${args.description}"` };
      const filtered = tx.filter(t => t.id !== match.id);
      await dbPatch({ tx: filtered });
      return { ok: true, message: `Eliminado: "${match.description}" ${fmt(match.amount)} (${fmtDate(match.date)})` };
    }

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

// ── MCP HTTP handler ──────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Auth: acepta ?key= en la URL (Claude.ai no soporta headers custom)
  //         o Authorization: Bearer <key> como fallback
  const urlKey = req.query?.key;
  const bearerKey = (req.headers['authorization'] ?? '').replace('Bearer ', '');
  const providedKey = urlKey || bearerKey;

  if (API_KEY && providedKey !== API_KEY) {
    return res.status(401).json({
      jsonrpc: '2.0', id: null,
      error: { code: -32001, message: 'Unauthorized — añade ?key=TU_CLAVE a la URL del MCP' },
    });
  }

  // ── GET → health check / SSE (Claude.ai lo usa para verificar que el server existe)
  if (req.method === 'GET') {
    return res.status(200).json({ name: 'MoneyGest MCP', version: '1.0', protocol: '2025-03-26', status: 'ok' });
  }

  // ── POST → JSON-RPC 2.0
  const { id, method, params } = req.body ?? {};

  // Session header (MCP 2025-03-26 streamable HTTP)
  const sessionId = req.headers['mcp-session-id'] || `ses_${uid()}`;
  res.setHeader('Mcp-Session-Id', sessionId);

  try {
    switch (method) {

      case 'initialize':
        return res.status(200).json({
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'MoneyGest', version: '1.0.0' },
          },
        });

      case 'notifications/initialized':
        return res.status(204).end();

      case 'tools/list':
        return res.status(200).json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments ?? {};
        const result   = await callTool(toolName, toolArgs);
        return res.status(200).json({
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
            isError: false,
          },
        });
      }

      case 'ping':
        return res.status(200).json({ jsonrpc: '2.0', id, result: {} });

      default:
        return res.status(200).json({
          jsonrpc: '2.0', id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
    }
  } catch (err) {
    console.error('[mcp] error:', err);
    return res.status(200).json({
      jsonrpc: '2.0', id,
      error: { code: -32603, message: err.message },
    });
  }
}
