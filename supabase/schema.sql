-- ============================================================
-- 세종 빈칸 프로젝트 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 RUN 하세요.
-- 모든 수치는 시뮬레이션 데이터입니다(실주소·실상호 아님).
-- ============================================================

-- ---------- 1. 공실 테이블 ----------
create table if not exists public.vacancies (
  id              bigint primary key,
  dong            text    not null,
  building_name   text    not null,
  floor           int     not null,
  area            numeric not null,          -- ㎡
  vacancy_months  int     not null,
  foot_traffic    int     not null,          -- 유동인구 지수(0~100)
  brt_access      int     not null,          -- BRT 접근성(0~100)
  rent_index      int     not null,          -- 임대료 지수
  lat             numeric,
  lng             numeric,
  is_street       boolean not null default false
);

-- ---------- 2. 매칭 기록 테이블 ----------
create table if not exists public.matches (
  id            bigserial primary key,
  vacancy_id    bigint references public.vacancies(id),
  track         text  not null check (track in ('pop','work','live')),
  tenant_label  text,
  created_at    timestamptz not null default now()
);

create index if not exists matches_vacancy_idx on public.matches(vacancy_id);

-- ============================================================
-- 3. Row Level Security (RLS) — 데모 목적의 최소 공개 권한
--    * vacancies: anon SELECT 만 허용 (읽기 전용)
--    * matches:   anon INSERT / SELECT 허용 (매칭 기록 누적)
--    * service_role 키는 프런트에 넣지 않음. anon 키만 사용.
-- ============================================================
alter table public.vacancies enable row level security;
alter table public.matches   enable row level security;

-- vacancies: 읽기만 공개
drop policy if exists "vacancies_anon_select" on public.vacancies;
create policy "vacancies_anon_select"
  on public.vacancies for select
  to anon
  using (true);

-- matches: 읽기 + 쓰기(INSERT) 공개 (데모 — 매칭이 실제로 쌓이는 구조)
drop policy if exists "matches_anon_select" on public.matches;
create policy "matches_anon_select"
  on public.matches for select
  to anon
  using (true);

drop policy if exists "matches_anon_insert" on public.matches;
create policy "matches_anon_insert"
  on public.matches for insert
  to anon
  with check (track in ('pop','work','live'));

-- ============================================================
-- 4. 시드 데이터 — 공실 12건 (index.html BUILDINGS 와 동일 + 위경도)
-- ============================================================
insert into public.vacancies
  (id, dong, building_name, floor, area, vacancy_months, foot_traffic, brt_access, rent_index, lat, lng, is_street)
values
  (1,  '나성동',   '어반아트리움 1층 105호', 1, 42,  18, 86, 92, 38, 36.4868, 127.2562, true),
  (2,  '나성동',   '중앙타워 7층 전체',      7, 310, 26, 74, 95, 21, 36.4881, 127.2549, false),
  (3,  '어진동',   '세종포레 2층 201호',     2, 88,  11, 69, 88, 27, 36.5039, 127.2618, false),
  (4,  '도담동',   '도램마을상가 1층 코너',  1, 55,  9,  78, 71, 33, 36.5112, 127.2557, true),
  (5,  '새롬동',   '새롬프라자 5층 전층',    5, 260, 31, 58, 76, 18, 36.4892, 127.2479, false),
  (6,  '보람동',   '호수프라자 1층 112호',   1, 38,  14, 71, 83, 30, 36.4731, 127.2879, true),
  (7,  '대평동',   '대평스퀘어 3층 일부',    3, 140, 22, 52, 90, 19, 36.4719, 127.2941, false),
  (8,  '소담동',   '소담힐타워 6~8층',       6, 480, 34, 44, 68, 15, 36.4763, 127.2981, false),
  (9,  '고운동',   '고운프라자 1층 103호',   1, 47,  7,  62, 55, 25, 36.5231, 127.2371, true),
  (10, '아름동',   '아름상가 2층 전체',      2, 170, 19, 57, 62, 20, 36.5071, 127.2468, false),
  (11, '조치원읍', '역전상가 1층 본동',      1, 64,  24, 65, 48, 17, 36.6012, 127.2961, true),
  (12, '반곡동',   '반곡타워 9층 전층',      9, 520, 29, 41, 79, 14, 36.4641, 127.3179, false)
on conflict (id) do nothing;
