// api/d365.js - Vercel proxy: Browser -> Vercel -> D365 F&O OData
// UI unchanged. Secrets only from Vercel Env Vars, never in frontend/Git.

let cachedToken = null;
let cachedExpiry = 0;

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < cachedExpiry - 60000) return cachedToken;

  const tenantId = process.env.D365_TENANT_ID;
  const clientId = process.env.D365_CLIENT_ID;
  const clientSecret = process.env.D365_CLIENT_SECRET;
  const foUrl = process.env.D365_FO_URL;

  if (!tenantId || !clientId || !clientSecret || !foUrl) {
    throw new Error("Missing env vars: D365_FO_URL / D365_TENANT_ID / D365_CLIENT_ID / D365_CLIENT_SECRET");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: `${foUrl}/.default`,
  });

  const r = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await r.json();
  if (!r.ok || !data.access_token) {
    throw new Error(`Token failed: ${r.status} ${JSON.stringify(data).slice(0, 500)}`);
  }
  cachedToken = data.access_token;
  cachedExpiry = now + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const entity = req.query.entity;
    if (!entity) {
      return res.status(400).json({ error: "Missing ?entity= . Example: /api/d365?entity=LegalEntities" });
    }

    const foUrl = process.env.D365_FO_URL.replace(/\/$/, "");
    const token = await getToken();

    // Build OData URL: /data/{entity}?$filter=... etc - pass through all other query params
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === "entity" || k === "key") continue;
      params.append(k, v);
    }
    let url = `${foUrl}/data/${entity}`;
    if (req.query.key) url += `(${req.query.key})`;
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (req.method !== "GET") headers["Content-Type"] = "application/json";

    const r = await fetch(url, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : JSON.stringify(req.body || {}),
    });

    const text = await r.text();
    res.status(r.status);
    try {
      return res.json(JSON.parse(text));
    } catch {
      return res.send(text);
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}