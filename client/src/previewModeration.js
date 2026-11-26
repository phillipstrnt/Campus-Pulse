const BLOCKED_KEY = 'campus-pulse-preview-blocked-users'
const REPORTS_KEY = 'campus-pulse-preview-reports'

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function readPreviewBlocks() {
  return readList(BLOCKED_KEY)
}

export function writePreviewBlocks(ids) {
  localStorage.setItem(BLOCKED_KEY, JSON.stringify([...new Set(ids)]))
}

export function savePreviewReport(report) {
  const reports = readList(REPORTS_KEY)
  const saved = { ...report, id: globalThis.crypto?.randomUUID?.() || `report-${Date.now()}`, createdAt: new Date().toISOString() }
  localStorage.setItem(REPORTS_KEY, JSON.stringify([saved, ...reports].slice(0, 100)))
  return saved
}
