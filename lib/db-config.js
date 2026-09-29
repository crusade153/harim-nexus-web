// 넥서스 표는 공유 Supabase 프로젝트의 public 이 아니라 별도 스키마에 있다.
// (public 은 기말재고 등 다른 용도로 쓰인다)
export const NEXUS_DB_SCHEMA = process.env.NEXT_PUBLIC_NEXUS_DB_SCHEMA || 'harim_nexus'
