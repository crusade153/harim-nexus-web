// 관리자 판정은 로그인 아이디가 아니라 members.role 로 한다.
// 대리 관리자를 지정할 때도 role 만 'admin' 으로 바꾸면 코드 수정 없이 동작한다.

// 삭제·강등이 막혀 있는 기본 관리자 계정
export const SYSTEM_ADMIN_LOGIN_ID = 'admin'

// currentUser(한글 키: 역할/아이디)와 DB member(role/login_id) 모두 받는다.
export function isAdmin(user) {
  if (!user) return false
  return (user.역할 ?? user.role) === 'admin'
}

export function isSystemAdmin(user) {
  if (!user) return false
  return (user.아이디 ?? user.login_id) === SYSTEM_ADMIN_LOGIN_ID
}
