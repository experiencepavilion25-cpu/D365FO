// api/d365.js - diagnostic version
let cachedToken = null;
let cachedExpiry = 0;

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < cachedExpiry - 60000) return cachedToken;
  const tenantId = process.env.D365_TENANT_ID;
  const clientId = process.env.D365_CLIENT_ID;
  const clientSecret = process.env.D365_CLIENT_SECRET;
  const foUrl = (process.env.D365_FO_URL || "").replace(/\/$/, "");
  if (!tenantId || !clientId || !clientSecret || !foUrl) {
    throw new Error("Missing env vars");
  }
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: `${foUrl}/.default`,
  });
  let r;
  try {
    r = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  } catch (e) {
    throw new Error("TOKEN_FETCH_FAILED: " + e.message);
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    throw new Error(`TOKEN_FAILED: ${r.status} ${JSON.stringify(data).slice(0, 800)}`);
  }
  cachedToken = data.access_token;
  cachedExpiry = now + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const entity = req.query.entity;
    if (!entity) return res.status(400).json({ error: "Missing ?entity=" });
    const foUrl = (process.env.D365_FO_URL || "").replace(/\/$/, "");
    const token = await getToken();
    const url = `${foUrl}/data/${entity}`;
    let r;
    try {
      r = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, redirect: "follow" });
    } catch (e) {
      return res.status(500).json({ stage: "D365_FETCH_FAILED", foUrl, attemptedUrl: url, error: e.message, cause: String(e.cause || "") });
    }
    const text = await r.text();
    res.status(r.status);
    try { return res.json(JSON.parse(text)); }
    catch { return res.status(r.status).json({ stage: "D365_RETURNED_NON_JSON", status: r.status, foUrl, attemptedUrl: url, bodyPreview: text.slice(0, 1000) }); }
  } catch (e) {
    return res.status(500).json({ stage: "TOKEN_OR_OTHER", foUrl: process.env.D365_FO_URL, error: e.message });
  }
}
