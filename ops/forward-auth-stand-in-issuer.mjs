// A stand-in OIDC issuer for rehearsing the dashboard's ForwardAuth off the box (Story 5.6,
// `ops/identity-issuer.md` § The Traefik dashboard behind ForwardAuth). Never run on the box.
//
// It serves discovery, a JWKS, an authorization endpoint that signs in whoever `POST /as?email=` last
// named (no login page: the rehearsal drives it with curl), and a token endpoint that checks the client's
// Basic credentials, the redirect URI and the PKCE S256 verifier before issuing an RS256 ID token.
// Configured by ISSUER, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI and PORT. Node's standard library only.
import { createServer } from 'node:http';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

const { ISSUER, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, PORT = '9000' } = process.env;
if (!ISSUER || !CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) throw new Error('ISSUER, CLIENT_ID, CLIENT_SECRET and REDIRECT_URI are required');

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'stand-in', alg: 'RS256', use: 'sig' };
const codes = new Map();
let email = 'owner@example.test';

function jwt(claims) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: jwk.kid }));
  const body = b64url(JSON.stringify(claims));
  return `${head}.${body}.${b64url(sign('sha256', Buffer.from(`${head}.${body}`), privateKey))}`;
}

const json = (res, status, value) => res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(value));
const subject = (address) => `sub-${createHash('sha256').update(address).digest('hex').slice(0, 16)}`;

createServer(async (req, res) => {
  const url = new URL(req.url, ISSUER);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const form = new URLSearchParams(raw);

  if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration')
    return json(res, 200, {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'email', 'profile'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic'],
    });
  if (req.method === 'GET' && url.pathname === '/jwks') return json(res, 200, { keys: [jwk] });
  if (req.method === 'POST' && url.pathname === '/as') {
    email = url.searchParams.get('email') ?? email;
    return json(res, 200, { email });
  }
  if (req.method === 'GET' && url.pathname === '/authorize') {
    const q = url.searchParams;
    if (q.get('client_id') !== CLIENT_ID || q.get('redirect_uri') !== REDIRECT_URI || q.get('response_type') !== 'code')
      return json(res, 400, { error: 'invalid_request' });
    if (q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge')) return json(res, 400, { error: 'invalid_request', error_description: 'PKCE S256 required' });
    const code = b64url(randomBytes(24));
    codes.set(code, { email, nonce: q.get('nonce'), challenge: q.get('code_challenge') });
    const back = new URL(REDIRECT_URI);
    back.searchParams.set('code', code);
    back.searchParams.set('state', q.get('state') ?? '');
    return res.writeHead(302, { location: back.href }).end();
  }
  if (req.method === 'POST' && url.pathname === '/token') {
    const [id, secret] = Buffer.from((req.headers.authorization ?? '').replace(/^Basic /, ''), 'base64').toString().split(':').map(decodeURIComponent);
    if (id !== CLIENT_ID || secret !== CLIENT_SECRET) return json(res, 401, { error: 'invalid_client' });
    const grant = codes.get(form.get('code'));
    codes.delete(form.get('code'));
    if (!grant || form.get('redirect_uri') !== REDIRECT_URI) return json(res, 400, { error: 'invalid_grant' });
    if (b64url(createHash('sha256').update(form.get('code_verifier') ?? '').digest()) !== grant.challenge) return json(res, 400, { error: 'invalid_grant', error_description: 'PKCE' });
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: ISSUER, aud: CLIENT_ID, sub: subject(grant.email), email: grant.email, email_verified: true, iat: now, exp: now + 3600 };
    if (grant.nonce) claims.nonce = grant.nonce;
    return json(res, 200, { access_token: b64url(randomBytes(24)), token_type: 'Bearer', expires_in: 3600, id_token: jwt(claims) });
  }
  json(res, 404, { error: 'not_found' });
}).listen(Number(PORT), () => console.log(`stand-in issuer ${ISSUER} on ${PORT}`));
