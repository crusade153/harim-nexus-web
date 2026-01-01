/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // SaaS 전용 컬러 팔레트 정의
        slate: {
          50: '#F8FAFC',  // 메인 배경
          100: '#F1F5F9', // 보조 배경 (카드 hover 등)
          200: '#E2E8F0', // 테두리 (Border)
          300: '#CBD5E1', // 아이콘/비활성 텍스트
          400: '#94A3B8', // 보조 텍스트
          500: '#64748B', // 본문 텍스트 (연함)
          600: '#475569', // 본문 텍스트 (진함)
          800: '#1E293B', // 제목
          900: '#0F172A', // 강조 제목
        },
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1', // 메인 브랜드 컬러 (Indigo)
          600: '#4F46E5', // Hover 상태
          700: '#4338CA',
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 10px rgba(0, 0, 0, 0.03)', // 아주 은은한 그림자
      }
    },
  },
  plugins: [],
}