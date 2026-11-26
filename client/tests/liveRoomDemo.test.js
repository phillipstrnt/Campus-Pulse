import test from 'node:test'
import assert from 'node:assert/strict'
import { appendDemoRoomMessage, LIVE_ROOMS_KEY, readDemoRoomChat, readDemoRooms, saveDemoRooms } from '../src/liveRoomDemo.js'

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

test('includes useful sample campus rooms and group chat messages', () => {
  const storage = new MemoryStorage()
  const rooms = readDemoRooms(storage)
  assert.ok(rooms.length >= 3)
  assert.ok(readDemoRoomChat('room-1', storage).length >= 2)
})

test('persists scheduled rooms and room messages across reloads', () => {
  const storage = new MemoryStorage()
  const rooms = readDemoRooms(storage)
  rooms.unshift({ id: 'room-new', title: 'Film club', status: 'scheduled' })
  saveDemoRooms(rooms, storage)
  appendDemoRoomMessage('room-1', { id: 'm-1', sender: 'Test Student', body: 'I am here', createdAt: '2026-11-26T12:00:00.000Z' }, storage)

  assert.equal(JSON.parse(storage.getItem(LIVE_ROOMS_KEY))[0].id, 'room-new')
  assert.equal(readDemoRoomChat('room-1', storage).at(-1).body, 'I am here')
})
