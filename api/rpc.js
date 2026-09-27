const UPSTREAM = 'https://rpc.mainnet.x1.xyz';
const MAX_BODY_BYTES = 4096;
const PROGRAM_ID = 'BxUNg2yo5371BQMZPkfcxdCptFRDHkhvEXNM1QNPBRYU';
// Only the methods index.html calls
const ALLOWED_METHODS = new Set([
  'getAccountInfo',
  'getProgramAccounts',
  'getBalance',
  'getSlot',
  'getSignaturesForAddress',
  'getTransaction',
  'getTokenAccountBalance'
]);

function rpcError(res, status, code, message, id = null) {
  return res.status(status).json({ jsonrpc: '2.0', id, error: { code, message } });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return rpcError(res, 405, -32600, 'Method not allowed');
  }

  const declaredLength = Number(req.headers['content-length']);
  if (declaredLength > MAX_BODY_BYTES) return rpcError(res, 400, -32600, 'Request too large');

  let body = req.body;
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return rpcError(res, 400, -32600, 'Request too large');
    try { body = JSON.parse(body.toString()); } catch { return rpcError(res, 400, -32700, 'Parse error'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return rpcError(res, 400, -32600, 'Invalid request: single JSON-RPC object required');
  }
  const payload = JSON.stringify(body);
  if (Buffer.byteLength(payload) > MAX_BODY_BYTES) return rpcError(res, 400, -32600, 'Request too large');

  const id = (typeof body.id === 'string' || typeof body.id === 'number') ? body.id : null;
  if (typeof body.method !== 'string' || !ALLOWED_METHODS.has(body.method)) {
    return rpcError(res, 403, -32601, 'Method not allowed', id);
  }
  if (body.method === 'getProgramAccounts') {
    if (!Array.isArray(body.params) || body.params[0] !== PROGRAM_ID) {
      return rpcError(res, 403, -32602, 'Program not allowed', id);
    }
  }

  try {
    const response = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
