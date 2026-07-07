const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/

export function normalizeLoginId(value) {
  return String(value || '').trim().toLowerCase()
}

export function validateLoginId(value) {
  const loginId = normalizeLoginId(value)

  if (!loginId) {
    return { ok: false, loginId, message: '아이디를 입력하세요.' }
  }

  if (loginId.includes('@')) {
    return {
      ok: false,
      loginId,
      message: '아이디에는 이메일 주소를 넣지 마세요. 회사 이메일은 이메일 칸에 입력하세요.',
    }
  }

  if (!LOGIN_ID_PATTERN.test(loginId)) {
    return {
      ok: false,
      loginId,
      message: '아이디는 영문 소문자, 숫자, 점(.), 밑줄(_), 하이픈(-)만 3~32자로 입력하세요.',
    }
  }

  return { ok: true, loginId, message: '' }
}

export function getSystemEmail(loginId) {
  return `${normalizeLoginId(loginId)}@harim-nexus.com`
}
