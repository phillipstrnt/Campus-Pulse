import test from 'node:test'
import assert from 'node:assert/strict'

const store = new Map()
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
}

const { readPreviewBlocks, writePreviewBlocks, savePreviewReport } = await import('../src/previewModeration.js')

test('preview block list persists and deduplicates ids', () => {
  writePreviewBlocks(['demo-1', 'demo-1', 'demo-2'])
  assert.deepEqual(readPreviewBlocks(), ['demo-1', 'demo-2'])
})

test('preview reports persist with timestamps and cap storage', () => {
  for (let i = 0; i < 105; i += 1) savePreviewReport({ reportedUserId: `user-${i}`, reason: 'safety' })
  const saved = JSON.parse(store.get('campus-pulse-preview-reports'))
  assert.equal(saved.length, 100)
  assert.equal(saved[0].reportedUserId, 'user-104')
  assert.ok(saved[0].createdAt)
})
