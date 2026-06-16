# 세종 빈칸 프로젝트 — AI 도시상권 디지털트윈

> 제1회 세종특별자치시 AI 혁신 경진대회(트랙2) 출품작 데모
> **추천이 아닌 예측** — 공실(도시의 빈칸)을 AI가 분석해 용도별로 채웠을 때의 1년 후(매출·유동인구·고용·세수)를 시뮬레이션합니다.
>
> 🔗 배포: https://sejong-space.vercel.app

세종엔 이미 세 개의 빛(낙화축제·국립세종도서관·국립세종수목원)이 있습니다. 꺼진 건 네 번째 빛 — 맛집·쇼핑 거리(공실)입니다. 이 데모는 AI가 그 불을 켜는 과정을 보여줍니다.

> ⚠️ 화면의 모든 공실·매출·세수 수치는 **시뮬레이션 데이터**이며 실제 개인정보·실주소·실상호가 아닙니다.

---

## 기술 스택

| 영역 | 사용 |
|------|------|
| 배포 | GitHub → **Vercel** 자동배포 (정적 + `/api` 서버리스) |
| AI | **Google Gemini** (`gemini-1.5-flash`) — 서버리스 함수에서만 호출 |
| DB | **Supabase** (anon key + RLS) — 공실 조회 / 매칭 기록 |
| 지도 | **Leaflet + OpenStreetMap** (API 키 불필요) |
| 프런트 | 바닐라 HTML/CSS/JS (빌드 도구 없음) |

## 파일 구조

```
sejong-space/
├── index.html          # 메인 (스토리 인트로 + 지도/보드 + AI 진단 패널)
├── css/style.css       # 스타일 (디자인 토큰)
├── js/
│   ├── app.js          # 보드/패널/상태 + 부트스트랩
│   ├── map.js          # Leaflet 지도 + 공실/명소 마커
│   ├── data.js         # Supabase 조회/기록 (anon key)
│   └── ai.js           # /api/simulate 호출 래퍼 (캐시·폴백)
├── api/
│   └── simulate.js     # Vercel 서버리스: Gemini 호출 (키는 env)
├── supabase/
│   └── schema.sql      # 테이블 + RLS + 시드 12건
├── og-image.svg        # 공유 썸네일
└── .gitignore
```

---

## 1. Vercel 환경변수 — `GEMINI_API_KEY` ★보안 핵심

**키를 코드/레포에 절대 넣지 마세요.** Vercel 환경변수에만 저장하고, 서버리스 함수 `api/simulate.js`가 `process.env.GEMINI_API_KEY`로만 읽습니다. 브라우저는 키를 모릅니다.

1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료 등급 API 키 발급
2. Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables**
3. 추가:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: 발급받은 키
   - **Environment**: Production / Preview / Development 모두 체크
4. **Deployments → 최신 배포 → Redeploy** (환경변수는 재배포해야 적용)

> 키가 없거나 호출이 실패하면 화면이 깨지지 않고 **규칙 기반 폴백("추정(오프라인)" 배지)**으로 동작합니다.

## 2. Supabase 연결 — schema.sql 실행 + RLS

1. [Supabase](https://supabase.com) 프로젝트의 **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql) 전체를 붙여넣고 **RUN**.
   - `vacancies`(공실 12건 시드 포함), `matches`(매칭 기록) 테이블이 생성됩니다.
   - **RLS가 함께 켜집니다**: `vacancies`는 anon 읽기만, `matches`는 anon 읽기/쓰기(INSERT)만 허용. `service_role`은 프런트에서 사용하지 않습니다.
2. **Settings → API**에서 `Project URL`과 `anon public` 키를 복사.
3. [`js/data.js`](js/data.js) 상단의 두 값을 채웁니다:
   ```js
   const SUPABASE_URL  = "https://xxxx.supabase.co";
   const SUPABASE_ANON = "eyJhbGciOi...";   // anon public 키만! service_role 금지
   ```
   > anon 키는 공개돼도 되는 값이지만, **위 RLS가 반드시 켜져 있어야** 안전합니다.
4. 비워두면 자동으로 **오프라인 모드**(로컬 시드 12건)로 동작합니다. 매칭 기록은 저장되지 않지만 화면은 정상입니다.

연결되면: 공실을 DB에서 불러오고, "채우기" 시 `matches`에 INSERT되며, 새로고침해도 채워진 빈칸과 `채워진 빈칸 N/12` 카운터가 DB 기준으로 복원됩니다.

## 3. 로컬 실행

정적 파일이라 어떤 정적 서버로도 됩니다(`file://` 직접 열기도 일부 동작):

```bash
npx serve .
# 또는
python -m http.server 8000
```

- 로컬에는 `/api/simulate` 서버리스 함수가 없으므로 AI 예측은 **클라이언트 폴백**으로 표시됩니다.
- Gemini 실제 호출까지 로컬에서 보려면 [Vercel CLI](https://vercel.com/docs/cli)로 `vercel dev` 실행 + `.env`에 `GEMINI_API_KEY` 설정(이 파일은 `.gitignore`에 포함되어 커밋되지 않음).

## 4. 배포 확인

1. GitHub에 push → Vercel 자동배포.
2. https://sejong-space.vercel.app 접속 후 체크:
   - [ ] 공실 칸/지도 마커 클릭 → 규칙 기반 점수 즉시 + **"⚡ AI 생성"** 배지와 함께 1년 후 예측·reasoning 표시
   - [ ] 지도에 공실·세 개의 빛 명소 마커 표시, 클릭 시 패널 연동
   - [ ] "채우기" → 카운터 증가, 새로고침 후에도 유지(Supabase 연결 시)
   - [ ] 브라우저 콘솔(F12) 에러 없음
   - [ ] 모바일 폭에서 지도·보드·패널이 세로로 정상 적층

---

## 보안 요약

- `GEMINI_API_KEY` → **Vercel 환경변수 전용** (브라우저·레포에 없음).
- Supabase는 **anon key + RLS**만. `service_role` 키 미사용.
- 비밀값은 `.gitignore`로 커밋 차단(`.env`, `.env.*`, `*.local`, `.vercel`).

## OG 썸네일 참고

공유 썸네일은 [`og-image.svg`](og-image.svg)입니다. 대부분의 플랫폼에서 표시되지만 **카카오톡 등 일부는 SVG를 렌더링하지 않을 수 있습니다.** 카톡 썸네일이 필요하면 이 SVG를 1200×630 PNG로 내보내 `og-image.png`로 저장하고 `index.html`의 `og:image` 경로를 바꿔주세요.
