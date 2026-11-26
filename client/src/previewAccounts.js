export const PREVIEW_USERS_KEY = 'campus-pulse-preview-users'
export const PREVIEW_SESSION_KEY = 'campus-pulse-preview-session'

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 120000, hash: 'SHA-256' }, key, 256)
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function readPreviewUsers(storage = localStorage) {
  try {
    const users = JSON.parse(storage.getItem(PREVIEW_USERS_KEY) || '[]')
    return Array.isArray(users) ? users : []
  } catch { return [] }
}

export async function registerPreviewUser({ email, password, displayName, username, interests = [] }, storage = localStorage) {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { error: 'Enter a valid email address.' }
  if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) return { error: 'Choose a username with 3–24 letters, numbers, or underscores.' }
  const users = readPreviewUsers(storage)
  if (users.some((user) => user.email === normalizedEmail)) return { error: 'That email already has a preview account. Sign in instead.' }
  if (users.some((user) => user.username === normalizedUsername)) return { error: 'That username is already taken in this browser.' }

  const salt = crypto.randomUUID()
  const passwordHash = await hashPassword(password, salt)
  const user = { id: `preview-${crypto.randomUUID()}`, email: normalizedEmail, displayName: displayName.trim(), username: normalizedUsername, interests, salt, passwordHash }
  storage.setItem(PREVIEW_USERS_KEY, JSON.stringify([...users, user]))
  return { user }
}

export async function authenticatePreviewUser({ email, password }, storage = localStorage) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = readPreviewUsers(storage).find((item) => item.email === normalizedEmail)
  if (!user || await hashPassword(password, user.salt) !== user.passwordHash) return { error: 'Email or password is incorrect.' }
  return { user }
}

export function createPreviewSession(user) {
  return { user: { id: user.id, email: user.email, user_metadata: { display_name: user.displayName, username: user.username, interests: user.interests || [] }, app_metadata: { provider: 'local-preview' } } }
}
