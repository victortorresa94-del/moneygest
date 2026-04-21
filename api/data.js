// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  /api/data — MoneyGest data sync endpoint
//  GET  → devuelve todos los datos
//  PATCH → actualiza (merge parcial o total)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const API_KEY      = process.env.MONEYGEST_API_KEY;

const HEADERS = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
};

async function dbGet() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/moneygest_data?id=eq.1&select=*`,
    { headers: HEADERS }
  );
  const rows = await res.json();
  return rows[0] ?? null;
}

async function dbPatch(data) {
  return fetch(
    `${SUPABASE_URL}/rest/v1/moneygest_data?id=eq.1`,
    {
      method:  'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
    }
  );
}

export default async function handler(req, res) {
  // CORS — permite llamadas desde el navegador (mismo dominio y móvil)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const auth = req.headers['authorization'] ?? '';
  if (auth !== `Bearer ${API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    const row = await dbGet();
    return res.status(200).json(row ?? {});
  }

  if (req.method === 'PATCH') {
    await dbPatch(req.body);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
