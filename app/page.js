// app/page.js
import { redirect } from 'next/navigation'

export default function Home() {
  // 기존: redirect('/dashboard') 
  // 변경: 로그인 페이지로 리다이렉트
  redirect('/login')
}