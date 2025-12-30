// Google Sheets 설정
const SHEET_ID = '1swtCHwbkTb09kOW886N8c4YvM-wM9jz4LI3NHEt5Tlk';

// 샘플 데이터 (API 연결 전까지 사용)
export function getSampleData() {
  return {
    members: [
      {
        ID: '3915',
        이름: '유경덕',
        PIN: '1234',
        이메일: 'yukd2022@harim-foods.com',
        권한: 'admin',
        직위: '팀장',
        부서: '원가팀',
        아바타색상: '#E31E24',
        전문분야: '원가기획',
        업무부하: '75'
      },
      {
        ID: '8197',
        이름: '전승주',
        PIN: '1234',
        이메일: 'jeonyj90@harim-foods.com',
        권한: 'user',
        직위: '팀원',
        부서: '원가팀',
        아바타색상: '#667eea',
        전문분야: '목표원가',
        업무부하: '60'
      },
      {
        ID: '8839',
        이름: '김리아',
        PIN: '1234',
        이메일: 'kimra1324@harim-foods.com',
        권한: 'user',
        직위: '팀원',
        부서: '원가팀',
        아바타색상: '#764ba2',
        전문분야: '목표원가',
        업무부하: '55'
      },
      {
        ID: '7313',
        이름: '박해린',
        PIN: '1234',
        이메일: 'parkhr1983@harim-foods.com',
        권한: 'user',
        직위: '팀원',
        부서: '원가팀',
        아바타색상: '#f093fb',
        전문분야: '목표원가',
        업무부하: '50'
      }
    ],
    tasks: [
      {
        ID: 'TASK-001',
        유형: '업무',
        제목: '4분기 실적 보고서 작성',
        내용: '실적 데이터 수집 및 분석 필요. 수율 데이터와 생산성 지표를 중점적으로 검토.',
        상태: '진행중',
        우선순위: '높음',
        작성자: 'yukd2022@harim-foods.com',
        작성자명: '유경덕',
        담당자: 'yukd2022@harim-foods.com',
        담당자명: '유경덕',
        작성일: '2025-12-30',
        수정일: '2025-12-30',
        마감일: '2025-01-05',
        중단사유: '',
        강조표시: 'TRUE',
        댓글: '[]'
      },
      {
        ID: 'TASK-002',
        유형: '업무',
        제목: '원가 절감 방안 검토',
        내용: 'Q1 원가 절감 아이디어 수집 및 실행 계획 수립',
        상태: '대기',
        우선순위: '보통',
        작성자: 'yukd2022@harim-foods.com',
        작성자명: '유경덕',
        담당자: 'jeonyj90@harim-foods.com',
        담당자명: '전승주',
        작성일: '2025-12-28',
        수정일: '2025-12-28',
        마감일: '2025-01-10',
        중단사유: '',
        강조표시: 'FALSE',
        댓글: '[]'
      },
      {
        ID: 'TASK-003',
        유형: '업무',
        제목: '표준원가 재계산',
        내용: '2025년 1월 적용 표준원가 재계산 작업',
        상태: '완료',
        우선순위: '높음',
        작성자: 'yukd2022@harim-foods.com',
        작성자명: '유경덕',
        담당자: 'kimra1324@harim-foods.com',
        담당자명: '김리아',
        작성일: '2025-12-20',
        수정일: '2025-12-29',
        마감일: '2025-12-30',
        중단사유: '',
        강조표시: 'FALSE',
        댓글: '[]'
      },
      {
        ID: 'TASK-004',
        유형: '이슈',
        제목: 'ERP 시스템 연동 오류',
        내용: 'BigQuery 데이터 동기화 지연 발생',
        상태: '중단',
        우선순위: '높음',
        작성자: 'yukd2022@harim-foods.com',
        작성자명: '유경덕',
        담당자: 'parkhr1983@harim-foods.com',
        담당자명: '박해린',
        작성일: '2025-12-29',
        수정일: '2025-12-30',
        마감일: '2025-12-31',
        중단사유: 'IT팀 협조 대기 중',
        강조표시: 'TRUE',
        댓글: '[]'
      }
    ],
    posts: [
      {
        ID: 'POST-001',
        유형: '공지',
        제목: '신년 업무 계획 공유',
        내용: '2025년 원가팀 주요 업무 계획을 공유드립니다.',
        작성자: 'yukd2022@harim-foods.com',
        작성자명: '유경덕',
        작성일: '2025-12-28',
        수정일: '2025-12-28',
        조회수: '45',
        좋아요수: '12',
        댓글수: '3',
        첨부파일: '[]',
        공지여부: 'TRUE',
        태그: '["공지","계획"]',
        상태: '공개'
      },
      {
        ID: 'POST-002',
        유형: '일반',
        제목: '점심 메뉴 추천해주세요',
        내용: '오늘 점심 뭐 먹을까요? 추천 부탁드립니다!',
        작성자: 'jeonyj90@harim-foods.com',
        작성자명: '전승주',
        작성일: '2025-12-30',
        수정일: '2025-12-30',
        조회수: '23',
        좋아요수: '5',
        댓글수: '8',
        첨부파일: '[]',
        공지여부: 'FALSE',
        태그: '["일상"]',
        상태: '공개'
      }
    ],
    schedules: [
      {
        ID: 'SCH-001',
        이름: '유경덕',
        이메일: 'yukd2022@harim-foods.com',
        유형: '회의',
        날짜: '2025-01-02',
        비고: '원가팀 주간 회의'
      },
      {
        ID: 'SCH-002',
        이름: '전승주',
        이메일: 'jeonyj90@harim-foods.com',
        유형: '연차',
        날짜: '2025-01-03',
        비고: '개인 사유'
      },
      {
        ID: 'SCH-003',
        이름: '김리아',
        이메일: 'kimra1324@harim-foods.com',
        유형: '외근',
        날짜: '2025-01-04',
        비고: '공장 실사'
      }
    ]
  }
}

// Google Sheets API 함수 (나중에 구현)
export async function getSheetData(sheetName) {
  // TODO: Google Sheets API 연동
  console.log('Google Sheets API 연동 예정:', sheetName)
  return []
}

export async function appendSheetData(sheetName, data) {
  // TODO: Google Sheets API 연동
  console.log('Google Sheets API 연동 예정:', sheetName, data)
  return { success: false, message: 'API 연동 전' }
}

export { SHEET_ID }