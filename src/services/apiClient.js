let csrf = null
let currentOwner = null
export function setApiSession(session) { csrf = session?.csrf || null; currentOwner = session?.user?.id || null }
export function getApiOwner() { return currentOwner }
export async function apiRequest(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
    ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-LifeOS-CSRF': csrf } : {}), ...options.headers },
    ...(options.body === undefined ? {} : { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    const error = new Error(data?.error || 'The cloud service is unavailable. Your local work is retained.')
    error.code = data?.code || 'unavailable'; error.status = response.status
    throw error
  }
  return data
}
