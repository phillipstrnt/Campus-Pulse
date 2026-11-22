const DB_NAME = 'campus-pulse-local'
const STORE_NAME = 'media'
const PREFIX = 'local-media:'

function openMediaStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveLocalMedia(file) {
  const key = `${PREFIX}${crypto.randomUUID()}`
  const db = await openMediaStore()
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(file, key)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  db.close()
  return key
}

export async function getLocalMediaUrl(key) {
  if (!key?.startsWith(PREFIX)) return ''
  const db = await openMediaStore()
  const media = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return media ? URL.createObjectURL(media) : ''
}
