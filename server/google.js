import { config, db, filter, HttpError, encrypt, decrypt, hash, randomToken, cookie, setCookie, safeEqual, takeLease, authenticate } from './core.js'

const SCOPES = {
 login: 'openid email profile',
 calendar: 'openid email profile https://www.googleapis.com/auth/calendar.app.created',
 drive: 'openid email profile https://www.googleapis.com/auth/drive.file',
}
async function client() {
  const { OAuth2Client } = await import('google-auth-library')
  const c = config()
  if (!c.googleId || !c.googleSecret || !c.encryptionKey) throw new HttpError(503, 'Google connection is not configured.', 'unconfigured')
  return new OAuth2Client(c.googleId, c.googleSecret, `${c.origin}/api/oauth/callback`)
}
export async function beginOAuth(req, res, purpose = 'login') {
  if (!(purpose in SCOPES)) throw new HttpError(400, 'Unknown connection type.')
  const session = purpose === 'login' ? null : await authenticate(req, true)
  const oauth = await client()
  const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync()
  const state = randomToken(), binding = randomToken(), nonce = randomToken()
  await db('lifeos_oauth_states', { method: 'POST', body: {
    state_hash: hash(state), cookie_hash: hash(binding), verifier: encrypt(codeVerifier), nonce,
    purpose, owner_id: session?.owner_id || null, expires_at: new Date(Date.now() + 600_000).toISOString(),
  } })
  setCookie(res, 'lifeos_oauth', binding, 600)
  const connection = session ? (await db(`lifeos_connections?owner_id=eq.${session.owner_id}&select=refresh_cipher,state`))?.[0] : null
  return { url: oauth.generateAuthUrl({ scope: SCOPES[purpose], state, nonce, code_challenge: codeChallenge, code_challenge_method: 'S256',
    ...(purpose === 'login' ? {} : { access_type: 'offline', include_granted_scopes: true, ...(!connection?.refresh_cipher || connection.state === 'reconnect_required' ? { prompt: 'consent' } : {}) }),
  }) }
}
export async function finishOAuth(req, res, url) {
  const state = url.searchParams.get('state'), binding = cookie(req, 'lifeos_oauth')
  if (!state || !binding) throw new HttpError(400, 'The sign-in request expired. Start again.', 'oauth_state')
  // DELETE … RETURNING makes callback state single-use across instances.
  const states = await db(`lifeos_oauth_states?state_hash=eq.${hash(state)}&cookie_hash=eq.${hash(binding)}&expires_at=gt.${filter(new Date().toISOString())}`, { method: 'DELETE' })
  setCookie(res, 'lifeos_oauth', '', 0)
  const pending = states?.[0]
  if (!pending) throw new HttpError(400, 'Invalid or already-used sign-in request.', 'oauth_state')
  if (url.searchParams.has('error')) throw new HttpError(400, 'Google access was declined. Your local data is unchanged.', 'oauth_denied')
  const code = url.searchParams.get('code')
  if (!code) throw new HttpError(400, 'Missing authorization code.')
  const oauth = await client()
  let tokens
  try { ({ tokens } = await oauth.getToken({ code, codeVerifier: decrypt(pending.verifier) })) }
  catch { throw new HttpError(400, 'Google could not complete authorization. Try connecting again.', 'oauth_exchange') }
  if (!tokens.id_token) throw new HttpError(401, 'Google did not provide a verified identity.')
  const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: config().googleId })
  const identity = ticket.getPayload()
  if (!identity?.sub || !identity.email_verified || !safeEqual(identity.nonce, pending.nonce)) throw new HttpError(401, 'Google identity verification failed.')
  let user
  if (pending.owner_id) {
    const session = await authenticate(req)
    if (session.owner_id !== pending.owner_id) throw new HttpError(403, 'Your LifeOS account changed during connection.')
    user = (await db(`lifeos_users?id=eq.${pending.owner_id}&select=*`))?.[0]
    if (user?.google_sub !== identity.sub) throw new HttpError(409, 'Choose the Google account belonging to this LifeOS account.', 'account_mismatch')
  } else {
    const users = await db('lifeos_users?on_conflict=google_sub', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: { google_sub: identity.sub, name: identity.name || '', email: identity.email || '', picture: identity.picture || null } })
    user = users[0]
    const sessionToken = randomToken()
    await db('lifeos_sessions', { method: 'POST', body: { token_hash: hash(sessionToken), owner_id: user.id, csrf: randomToken(), expires_at: new Date(Date.now() + 30 * 86400_000).toISOString() } })
    setCookie(res, 'lifeos_session', sessionToken, 30 * 86400)
  }
  if (pending.purpose !== 'login') {
    const previous = (await db(`lifeos_connections?owner_id=eq.${user.id}&select=*`))?.[0]
    const refreshCipher = mergedRefreshToken(previous?.refresh_cipher, tokens.refresh_token ? encrypt(tokens.refresh_token) : null)
    if (!refreshCipher) throw new HttpError(409, 'Google did not grant offline access. Reconnect to authorize background refresh.', 'offline_access_missing')
    await db('lifeos_connections?on_conflict=owner_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: {
      owner_id: user.id, google_sub: identity.sub, refresh_cipher: refreshCipher,
      access_cipher: encrypt(tokens.access_token), expires_at: new Date(tokens.expiry_date || Date.now() + 3600_000).toISOString(),
      scopes: tokens.scope || previous?.scopes || '', state: 'connected', calendar_id: previous?.calendar_id || null,
    } })
  }
  res.statusCode = 303; res.setHeader('Location', `${config().origin}/?connected=${pending.purpose}`); res.setHeader('Cache-Control', 'no-store'); res.end()
}
export function mergedRefreshToken(previous, incoming) { return incoming || previous || null }
export function createTokenManager({ storage = db, oauthClient = client, lease = takeLease, now = Date.now } = {}) {
 const refreshing = new Map()
 return async function managedAccessToken(owner, force = false) {
  if (refreshing.has(owner)) return refreshing.get(owner)
  const work = (async () => {
    const read = async () => (await storage(`lifeos_connections?owner_id=eq.${owner}&select=*`))?.[0]
    let connection = await read()
    if (!connection?.refresh_cipher || connection.state === 'reconnect_required') throw new HttpError(409, 'Reconnect Google to restore this integration.', 'reconnect_required')
    if (!force && new Date(connection.expires_at).getTime() > now() + 90_000) return decrypt(connection.access_cipher)
    const release = await lease(`refresh:${owner}`, 60)
    try {
      connection = await read()
      if (!force && new Date(connection.expires_at).getTime() > now() + 90_000) return decrypt(connection.access_cipher)
      const oauth = await oauthClient(); oauth.setCredentials({ refresh_token: decrypt(connection.refresh_cipher) })
      let credentials
      try { ({ credentials } = await oauth.refreshAccessToken()) }
      catch (error) {
        if (error.response?.data?.error === 'invalid_grant') {
          await storage(`lifeos_connections?owner_id=eq.${owner}`, { method: 'PATCH', body: { state: 'reconnect_required', access_cipher: null } })
          throw new HttpError(409, 'Google authorization was revoked or expired. Reconnect when ready.', 'reconnect_required')
        }
        throw new HttpError(503, 'Google is temporarily unavailable. Retry later.', 'provider_unavailable')
      }
      await storage(`lifeos_connections?owner_id=eq.${owner}`, { method: 'PATCH', body: { access_cipher: encrypt(credentials.access_token), refresh_cipher: credentials.refresh_token ? encrypt(credentials.refresh_token) : connection.refresh_cipher, expires_at: new Date(credentials.expiry_date).toISOString(), state: 'connected' } })
      return credentials.access_token
    } finally { await release() }
  })().finally(() => refreshing.delete(owner))
  refreshing.set(owner, work)
  return work
 }
}
export const accessToken = createTokenManager()
export async function googleFetch(owner, path, options = {}) {
  let token = await accessToken(owner)
  let result = await fetch(`https://www.googleapis.com${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
  if (result.status === 401) {
    token = await accessToken(owner, true)
    result = await fetch(`https://www.googleapis.com${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) })
  }
  if (result.status === 403 || result.status === 429) throw new HttpError(result.status, 'Google denied the operation. Check granted scopes, calendar permissions or quota; your app session remains active.', 'provider_permission_or_quota')
  return result
}
export async function disconnect(owner) {
  const connection = (await db(`lifeos_connections?owner_id=eq.${owner}&select=*`))?.[0]
  if (connection?.refresh_cipher) {
    const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: decrypt(connection.refresh_cipher) }), signal: AbortSignal.timeout(15_000) })
    if (!response.ok && response.status !== 400) throw new HttpError(503, 'Google revocation failed. Please retry.')
  }
  await db(`lifeos_connections?owner_id=eq.${owner}`, { method: 'DELETE' })
}
