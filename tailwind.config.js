/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // 다크모드 설정 추가
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B', // 다크모드 카드 배경
          900: '#0F172A', // 다크모드 메인 배경
          950: '#020617', // 아주 어두운 배경
        },
        primary: {
          500: '#6366F1', // Indigo
          600: '#4F46E5',
        }
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 10px rgba(0, 0, 0, 0.03)',
      }
    },
  },
  plugins: [],
}