export function sanitizeSearchTerm(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function classifyDueDate(dueDate, today) {
  if (!dueDate) return 'upcoming'
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  return 'upcoming'
}

export function safeStorageFileName(value) {
  const normalized = String(value || '').normalize('NFKC')
  const safe = normalized.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').slice(-120)
  return safe || 'file'
}

