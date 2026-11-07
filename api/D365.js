// api/d365.js - Vercel Serverless -> D365 F&O OData
// Secrets come ONLY from Vercel Env Vars, never from frontend

const FO_URL = process.env.D365_FO_URL;
const TENANT_ID = process.env.D365_TENANT_ID;
const CLIENT_ID = process.env.D365_CLIENT_ID;
const CLIENT_SECRET = process.env.D365_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: `${FO_URL}/.default`,
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    { method: 'POST', body: params }
  );

  if (!res.ok) throw new Error('Token failed: ' + await res.text());

  const json = await res.json();
  cachedToken = json.access_token;
  tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  try {
    const { entity, key, ...odata } = req.query;
    if (!entity) {
      return res.status(400).json({ error: 'Missing ?entity= e.g. ?entity=CustomersV3' });
    }

    const token = await getToken();

    const qs = new URLSearchParams(odata).toString();
    let url = `${FO_URL}/data/${entity}`;
    if (key) url += `(${key})`;
    if (qs) url += `?${qs}`;

    const foRes = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: ['POST', 'PATCH', 'PUT'].includes(req.method)
        ? JSON.stringify(req.body)
        : undefined,
    });

    const text = await foRes.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return res.status(foRes.status).json(data);
  } catch (e) {
    console.error('D365 proxy error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}