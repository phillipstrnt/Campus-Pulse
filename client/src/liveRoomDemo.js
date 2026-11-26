export const LIVE_ROOMS_KEY = 'campus-pulse-demo-live-rooms'

export const sampleRooms = [
  { id: 'room-1', title: 'The 10-minute break', description: 'Study break and random chats.', category: 'Campus life', university: 'Makerere University', status: 'live', listeners: 6 },
  { id: 'room-2', title: 'Match day energy', description: 'Campus football watch party.', category: 'Sports', university: 'Kyambogo University', status: 'live', listeners: 23 },
  { id: 'room-3', title: 'Build night: tiny solar', description: 'Show-and-tell for science and tech projects.', category: 'Science & tech', university: 'Makerere University', status: 'scheduled', listeners: 0 },
]

const messageKey = (roomId) => `campus-pulse-demo-room-chat-${roomId}`
const seedChat = {
  'room-1': [
    { id: 'room-1-seed-1', sender: 'Amina K.', body: 'How is everyone’s week going?', createdAt: '2026-11-26T09:20:00.000Z' },
    { id: 'room-1-seed-2', sender: 'Joel M.', body: 'Finally submitted my studio project 😅', createdAt: '2026-11-26T09:21:00.000Z' },
  ],
  'room-2': [
    { id: 'room-2-seed-1', sender: 'Brian T.', body: 'Who is backing the home team today? ⚽', createdAt: '2026-11-26T09:18:00.000Z' },
    { id: 'room-2-seed-2', sender: 'Zara A.', body: 'I’m here for the halftime snacks 😂', createdAt: '2026-11-26T09:19:00.000Z' },
  ],
}

export function readDemoRooms(storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(LIVE_ROOMS_KEY) || 'null')
    return Array.isArray(saved) ? saved : sampleRooms
  } catch { return sampleRooms }
}

export function saveDemoRooms(rooms, storage = localStorage) {
  storage.setItem(LIVE_ROOMS_KEY, JSON.stringify(rooms))
}

export function readDemoRoomChat(roomId, storage = localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(messageKey(roomId)) || 'null')
    return Array.isArray(saved) ? saved : (seedChat[roomId] || [])
  } catch { return seedChat[roomId] || [] }
}

export function appendDemoRoomMessage(roomId, message, storage = localStorage) {
  const next = [...readDemoRoomChat(roomId, storage), message]
  storage.setItem(messageKey(roomId), JSON.stringify(next))
  return next
}
