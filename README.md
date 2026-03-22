# 가천대 수강 비교기

가천대학교 전공교육과정과 내 이수내역을 비교해서  
무엇을 들었고, 무엇이 부족한지 한눈에 확인할 수 있는 웹앱입니다.

이 프로젝트는 다음 기술로 구성되어 있습니다.

- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **DB**: Prisma + PostgreSQL
- **OCR / AI 분석**: OpenAI API
- **배포용 DB 예시**: Neon
- **배포용 서버 예시**: Render

---

## 1. 이 앱으로 할 수 있는 일

이 앱으로 할 수 있는 핵심 기능은 아래와 같습니다.

1. 가천대학교 요람 페이지에서 전공교육과정 링크를 가져옵니다.
2. 전공교육과정 스크린샷을 OCR로 읽어서 전공 과목 표를 만듭니다.
3. 졸업이수학점 스크린샷을 OCR로 읽어서 졸업이수학점 표를 만듭니다.
4. 이수내역 스크린샷을 OCR로 읽어서 이수내역 표를 만듭니다.
5. OCR 결과를 바로 저장하지 않고, **텍스트/표에서 직접 수정한 뒤 저장**할 수 있습니다.
6. 저장된 전공교육과정과 저장된 이수내역을 다시 불러올 수 있습니다.
7. 저장된 전공교육과정과 저장된 이수내역을 삭제할 수 있습니다.
8. 비교 실행 시 아래처럼 여러 구역으로 나누어 보여줍니다.

- 이수과목 - 계열교양 (제1학과)
- 이수과목 - 전공필수 (제1학과)
- 이수과목 - 전공선택 (제1학과)
- 기초교양
- 융합교양
- 미이수
- 추가이수교양
- 추가 이수 전공(전공필수)
- 추가 이수 전공(전공선택)
- 그외 추가이수과목

즉, 단순히 “맞다/틀리다”만 비교하는 앱이 아니라  
**OCR → 검수 → 저장 → 불러오기 → 삭제 → 비교 분석**까지 한 번에 처리하는 구조입니다.

---

## 2. 프로젝트 폴더 구조

```text
gachon-course-checker/
├─ package.json
├─ package-lock.json
├─ README.md
├─ .gitignore
├─ examples/
│  ├─ completed-courses.csv
│  └─ required-courses.csv
├─ backend/
│  ├─ package.json
│  ├─ .env.example
│  ├─ prisma/
│  │  └─ schema.prisma
│  ├─ src/
│  │  ├─ lib/
│  │  │  └─ prisma.ts
│  │  ├─ routes/
│  │  │  └─ api.ts
│  │  ├─ services/
│  │  │  ├─ gachonScraper.ts
│  │  │  ├─ openaiOcr.ts
│  │  │  └─ usageMeter.ts
│  │  ├─ utils/
│  │  │  ├─ compareCourses.ts
│  │  │  └─ normalize.ts
│  │  └─ server.ts
│  └─ tsconfig.json
└─ frontend/
   ├─ package.json
   ├─ package-lock.json
   ├─ index.html
   ├─ vite.config.ts
   ├─ tsconfig.json
   ├─ tsconfig.node.json
   └─ src/
      ├─ App.tsx
      ├─ main.tsx
      ├─ ocrUtils.ts
      ├─ styles.css
      └─ vite-env.d.ts

3. 먼저 준비해야 하는 것
필수 설치
- Node.js LTS
- Git
- VS Code (권장)
계정 
- OpenAI API Key
- PostgreSQL DB
로컬 PostgreSQL을 직접 설치해도 되고, 가장 간단하게는 Neon 같은 무료 PostgreSQL 서비스를 써도 됩니다.

4. 환경변수
이 프로젝트는 중요한 정보들을 .env 파일로 관리합니다.

실제 비밀 키가 들어가는 backend/.env 파일은 GitHub에 올리면 안 됩니다.
대신 저장소에는 예시 파일인 backend/.env.example만 포함합니다.

PORT=4000
CLIENT_URL=http://localhost:5173

DATABASE_URL="postgresql://YOUR_POOLED_DATABASE_URL"
DIRECT_URL="postgresql://YOUR_DIRECT_DATABASE_URL"

OPENAI_API_KEY="your_openai_api_key"
OPENAI_MODEL="gpt-5.4-mini"
OPENAI_BUDGET_USD="5"