// 구글 캘린더 "URL로 추가"용 iCalendar(ICS) 문서. 종일 일정만 만든다.
const escapeText = value => String(value ?? '')
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// RFC 5545: 한 줄 75옥텟을 넘으면 접는다. 한글이 끊기지 않게 글자 단위로 자른다.
function fold(line) {
  const encoder = new TextEncoder()
  const out = []
  let current = ''
  for (const ch of line) {
    if (encoder.encode(current + ch).length > (out.length ? 74 : 75)) { out.push(current); current = ch }
    else current += ch
  }
  out.push(current)
  return out.join('\r\n ')
}

const compactDate = date => date.replaceAll('-', '')
function nextDay(date) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

// events: [{ uid, date:'YYYY-MM-DD', endDate?:'YYYY-MM-DD'(포함), title, description?, url? }]
export function buildIcs(events, { name = 'Harim Nexus', now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Harim Nexus//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`, 'X-WR-TIMEZONE:Asia/Seoul',
  ]
  for (const event of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date || '')) continue
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(event.endDate && event.endDate >= event.date ? event.endDate : event.date))}`,
      `SUMMARY:${escapeText(event.title)}`,
    )
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    if (event.url) lines.push(`URL:${escapeText(event.url)}`)
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
