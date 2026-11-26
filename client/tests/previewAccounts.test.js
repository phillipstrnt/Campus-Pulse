import test from 'node:test'
import assert from 'node:assert/strict'
import { authenticatePreviewUser, createPreviewSession, PREVIEW_USERS_KEY, readPreviewUsers, registerPreviewUser } from '../src/previewAccounts.js'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

const validAccount = { email: '  Student@Example.edu ', password: 'campus-pass-123', displayName: 'Campus Student', username: '@Campus_User', interests: ['Sports'] }

test('registers a normalized preview account and stores only a salted password hash', async () => {
  const storage = new MemoryStorage()
  const result = await registerPreviewUser(validAccount, storage)

  assert.equal(result.error, undefined)
  assert.equal(result.user.email, 'student@example.edu')
  assert.equal(result.user.username, 'campus_user')
  assert.notEqual(result.user.passwordHash, validAccount.password)
  assert.ok(result.user.salt)
  assert.equal(readPreviewUsers(storage).length, 1)
  assert.equal(JSON.parse(storage.getItem(PREVIEW_USERS_KEY))[0].passwordHash, result.user.passwordHash)
})

test('signs in after reloading the persisted preview account', async () => {
  const storage = new MemoryStorage()
  await registerPreviewUser(validAccount, storage)
  const result = await authenticatePreviewUser({ email: 'STUDENT@example.edu', password: validAccount.password }, storage)

  assert.equal(result.error, undefined)
  assert.equal(result.user.username, 'campus_user')
  assert.equal(createPreviewSession(result.user).user.app_metadata.provider, 'local-preview')
})

test('rejects incorrect passwords and duplicate emails or usernames', async () => {
  const storage = new MemoryStorage()
  await registerPreviewUser(validAccount, storage)

  assert.match((await authenticatePreviewUser({ email: validAccount.email, password: 'wrong-password' }, storage)).error, /incorrect/)
  assert.match((await registerPreviewUser({ ...validAccount, username: 'another_user' }, storage)).error, /email already/)
  assert.match((await registerPreviewUser({ ...validAccount, email: 'other@example.edu' }, storage)).error, /username is already taken/)
})

test('rejects malformed email and username values', async () => {
  const storage = new MemoryStorage()
  assert.match((await registerPreviewUser({ ...validAccount, email: 'not-an-email' }, storage)).error, /valid email/)
  assert.match((await registerPreviewUser({ ...validAccount, username: 'x!' }, storage)).error, /username/)
  assert.equal(readPreviewUsers(storage).length, 0)
})
