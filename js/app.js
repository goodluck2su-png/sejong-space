// ============================================================
// 세종 빈칸 프로젝트 — 메인 로직 (보드 / 패널 / 상태)
// 데이터는 STEP4에서 Supabase로 대체 가능하도록 window.SejongApp 으로 노출
// ============================================================

// ---------- 시뮬레이션 데이터 (생활권별 공실 12건) ----------
// lat/lng: 세종시 생활권 대략 좌표 (// TODO: 정확한 좌표 확인)
let BUILDINGS = [
  {id:1,  dong:"나성동",   name:"어반아트리움 1층 105호", floor:1, area:42,  months:18, foot:86, brt:92, rent:38, street:true,  lat:36.4868, lng:127.2562},
  {id:2,  dong:"나성동",   name:"중앙타워 7층 전체",     floor:7, area:310, months:26, foot:74, brt:95, rent:21, street:false, lat:36.4881, lng:127.2549},
  {id:3,  dong:"어진동",   name:"세종포레 2층 201호",    floor:2, area:88,  months:11, foot:69, brt:88, rent:27, street:false, lat:36.5039, lng:127.2618},
  {id:4,  dong:"도담동",   name:"도램마을상가 1층 코너", floor:1, area:55,  months:9,  foot:78, brt:71, rent:33, street:true,  lat:36.5112, lng:127.2557},
  {id:5,  dong:"새롬동",   name:"새롬프라자 5층 전층",   floor:5, area:260, months:31, foot:58, brt:76, rent:18, street:false, lat:36.4892, lng:127.2479},
  {id:6,  dong:"보람동",   name:"호수프라자 1층 112호",  floor:1, area:38,  months:14, foot:71, brt:83, rent:30, street:true,  lat:36.4731, lng:127.2879},
  {id:7,  dong:"대평동",   name:"대평스퀘어 3층 일부",   floor:3, area:140, months:22, foot:52, brt:90, rent:19, street:false, lat:36.4719, lng:127.2941},
  {id:8,  dong:"소담동",   name:"소담힐타워 6~8층",      floor:6, area:480, months:34, foot:44, brt:68, rent:15, street:false, lat:36.4763, lng:127.2981},
  {id:9,  dong:"고운동",   name:"고운프라자 1층 103호",  floor:1, area:47,  months:7,  foot:62, brt:55, rent:25, street:true,  lat:36.5231, lng:127.2371},
  {id:10, dong:"아름동",   name:"아름상가 2층 전체",     floor:2, area:170, months:19, foot:57, brt:62, rent:20, street:false, lat:36.5071, lng:127.2468},
  {id:11, dong:"조치원읍", name:"역전상가 1층 본동",     floor:1, area:64,  months:24, foot:65, brt:48, rent:17, street:true,  lat:36.6012, lng:127.2961},
  {id:12, dong:"반곡동",   name:"반곡타워 9층 전층",     floor:9, area:520, months:29, foot:41, brt:79, rent:14, street:false, lat:36.4641, lng:127.3179},
];

// ---------- 세 개의 빛 (명소) ----------
// // TODO: 정확한 좌표 확인 (낙화축제장은 행사 위치 기준 대략값)
const PLACES = [
  {emoji:"🎆", name:"세종 낙화축제", lat:36.4795, lng:127.2622, desc:"호수공원 일대에서 모인 야간 방문객 동선을 인근 가로변 공실로 연장합니다."},
  {emoji:"📖", name:"국립세종도서관", lat:36.5006, lng:127.2585, desc:"매일 머무는 시민 발걸음을 도서관 인근 공실 팝업으로 잇습니다."},
  {emoji:"🌳", name:"국립세종수목원", lat:36.4928, lng:127.2490, desc:"사계절 산책 방문객을 중앙공원 인근 공실 체류·소비로 연결합니다."},
];

// ---------- "AI" 용도진단: 가중 스코어링 (데모용 규칙 기반 / AI 폴백) ----------
function diagnose(b){
  const pop  = Math.round( (b.street?28:6) + (b.floor===1?22:4) + b.foot*0.34 + b.brt*0.12 + Math.min(b.months,24)*0.3 );
  const work = Math.round( (b.floor>=2?24:8) + (b.area>=80?18:8) + b.brt*0.30 + (100-b.rent)*0.14 + Math.min(b.months,30)*0.2 );
  const live = Math.round( (b.floor>=4?22:5) + (b.area>=200?20:6) + (100-b.rent)*0.22 + b.brt*0.18 + Math.min(b.months,36)*0.35 );
  const clamp = v => Math.max(15, Math.min(97, v));
  const s = {pop:clamp(pop), work:clamp(work), live:clamp(live)};
  const best = Object.entries(s).sort((a,b2)=>b2[1]-a[1])[0][0];
  return {s, best};
}

// ※ 1년 후 예측은 STEP5에서 Gemini(/api/simulate)로 생성. 규칙 기반 폴백은 api/simulate.js·js/ai.js 에 있음.

const TRACK = {
  pop:{label:"팝업", key:"pop", cls:"f-pop", color:"var(--amber)", hex:"#F4B23E",
    why:b=>`1층 가로변 · 유동인구 지수 ${b.foot} — 단기 팝업으로 즉시 활성화 가능한 입지입니다.`,
    matches:b=>[
      {n:"대전 전국구 베이커리 B사", d:"세종 1호 팝업 후보 · 희망 기간 4주"},
      {n:"낙화축제 주간 야간 마켓 팝업", d:"축제 방문객 동선 연계 · 2주"},
      {n:"국립도서관 연계 독립서점 팝업", d:"북토크 병행 · 희망 기간 6주"},
      {n:"수목원 연계 플라워·가드닝 팝업", d:"주말 워크숍형 · 희망 기간 8주"}]},
  work:{label:"창업", key:"work", cls:"f-work", color:"var(--teal)", hex:"#46B3A0",
    why:b=>`상층 사무형 ${b.area}㎡ · BRT 접근성 ${b.brt} — 부처 인접 GovTech 입주에 적합합니다.`,
    matches:b=>[
      {n:"교통데이터 분석 스타트업 T사", d:"이응버스 수요예측 실증 희망 · 6인"},
      {n:"행정문서 AI 자동화 G사", d:"공공조달 진출 준비 · 4인"},
      {n:"시민참여 플랫폼 C사", d:"스마트시티 실증 연계 희망 · 8인"}]},
  live:{label:"주거", key:"live", cls:"f-live", color:"var(--red)", hex:"#E8623A",
    why:b=>`공실 ${b.months}개월 · ${b.area}㎡ 통임대 가능 — 단기 스테이/리모델링 임대 전환 후보입니다.`,
    matches:b=>[
      {n:"전입 공무원 단기 스테이 수요", d:"7월 정기인사 예측 수요 23건"},
      {n:"낙화축제·수목원 방문객 스테이", d:"축제 주간 체류 예측 수요 47건"},
      {n:"청년·신혼 리모델링 임대", d:"LH 매입약정형 검토 후보"}]}
};

// ============================================================
// 상태 + 렌더링
// ============================================================
const grid = document.getElementById('grid');
const panel = document.getElementById('panel');
const cells = [];               // index -> board button
const filledTrack = {};         // index -> track key (채워진 칸)
let selectedIdx = null;

function fillCount(){ return Object.keys(filledTrack).length; }

function buildBoard(){
  grid.innerHTML = '';
  cells.length = 0;
  BUILDINGS.forEach((b,i)=>{
    const c = document.createElement('button');
    c.className = 'cell';
    c.innerHTML = `<span class="vac">공실 ${b.months}개월</span><span class="badge"></span>
      <span class="dong">${b.dong}</span><span class="bn">${b.name}</span>`;
    c.addEventListener('click',()=>selectVacancy(i));
    cells[i] = c;
    grid.appendChild(c);
  });
  updateFillN();
}

function updateFillN(){
  const el = document.getElementById('fillN');
  if(el) el.textContent = fillCount();
}

// 보드/지도 어디서 눌러도 동일하게 우측 패널을 연다
function selectVacancy(i){
  const cellEl = cells[i];
  if(filledTrack[i]) return;     // 이미 채워진 칸은 재선택하지 않음
  selectedIdx = i;
  document.querySelectorAll('.cell.sel').forEach(e=>e.classList.remove('sel'));
  if(cellEl) cellEl.classList.add('sel');
  if(window.SejongMap) window.SejongMap.highlight(i);
  renderPanel(i);
}

function renderPanel(i){
  const b = BUILDINGS[i];
  const {s, best} = diagnose(b);
  const t = TRACK[best];
  let currentTrack = best;     // 용도 선택(what-if)에 따라 바뀜

  panel.innerHTML = `
    <h3>${b.name}</h3><div class="loc">${b.dong} · 시뮬레이션 데이터</div>
    <div class="chips">
      <span class="chip">층 <b>${b.floor}F</b></span>
      <span class="chip">면적 <b>${b.area}㎡</b></span>
      <span class="chip">공실 <b>${b.months}개월</b></span>
      <span class="chip">유동 <b>${b.foot}</b></span>
      <span class="chip">BRT <b>${b.brt}</b></span>
    </div>
    <div class="dlabel">AI 용도 적합도 진단</div>
    ${barRow('팝업', s.pop, 'var(--amber)')}
    ${barRow('창업', s.work, 'var(--teal)')}
    ${barRow('주거', s.live, 'var(--red)')}
    <div class="rec" style="border-left-color:${t.color}">
      <div class="rt">추천: ${t.label} 트랙</div>${t.why(b)}
    </div>

    <div class="dlabel simlabel">디지털트윈 시뮬레이션 — 1년 후<span class="aibadge loading" id="aiBadge">…</span></div>
    <div class="use-sel" id="useSel" role="group" aria-label="용도 선택">
      <button type="button" data-track="pop"  class="${best==='pop'?'on':''}">팝업</button>
      <button type="button" data-track="work" class="${best==='work'?'on':''}">창업</button>
      <button type="button" data-track="live" class="${best==='live'?'on':''}">주거</button>
    </div>
    <div id="aiBody"></div>
    <div class="ai-note">추천이 아닌 <b>예측</b> — AI(Gemini)가 생성한 분석입니다</div>

    <button class="matchbtn" id="matchBtn">이 빈칸, ${t.label}으로 채우기</button>
    <div class="match-cands" id="matchRes" hidden>
      <div class="dlabel" style="color:${t.color}">매칭 후보</div>
      <ul id="matchList">${t.matches(b).map(m=>`<li><b>${m.n}</b><span>${m.d}</span></li>`).join('')}</ul>
    </div>`;

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    panel.querySelectorAll('.bar i').forEach(el=>{ el.style.width = el.dataset.w + '%'; });
  }));

  const matchBtn = document.getElementById('matchBtn');
  const matchList = document.getElementById('matchList');
  matchBtn.addEventListener('click',()=>fillVacancy(i, currentTrack));

  // 용도 선택 → 예측 재생성 + 매칭/버튼 갱신
  const useSel = document.getElementById('useSel');
  useSel.addEventListener('click',(ev)=>{
    const btn = ev.target.closest('button[data-track]'); if(!btn) return;
    currentTrack = btn.dataset.track;
    useSel.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===btn));
    const tk = TRACK[currentTrack];
    if(!filledTrack[i]) matchBtn.textContent = `이 빈칸, ${tk.label}으로 채우기`;
    if(matchList) matchList.innerHTML = tk.matches(b).map(m=>`<li><b>${m.n}</b><span>${m.d}</span></li>`).join('');
    runPrediction(b, currentTrack);
  });

  runPrediction(b, best);
}

// ---------- AI 예측 카드 렌더 (로딩 → Gemini 결과 → ⚡AI 예측 / 추정(오프라인) 배지) ----------
async function runPrediction(b, track){
  const body = document.getElementById('aiBody');
  const badge = document.getElementById('aiBadge');
  if(!body) return;
  badge.textContent = '…'; badge.className = 'aibadge loading';
  body.innerHTML = `<div class="ai-loading"><span class="spin"></span> AI 예측 생성 중…</div>`;

  let result;
  try{
    result = await window.SejongAI.predict(b, track);
  }catch(e){
    result = { source:'fallback', prediction:null };
  }
  // 패널이 그 사이 다른 칸으로 바뀌었으면 무시
  if(document.getElementById('aiBody') !== body) return;

  const p = result.prediction;
  if(!p){ body.innerHTML = `<div class="ai-loading">예측을 불러오지 못했습니다.</div>`; return; }

  // Gemini 성공 → ⚡AI 예측 / 폴백 → 추정(오프라인)  (ai.js 의 source 플래그 활용)
  if(result.source === 'gemini'){ badge.className='aibadge'; badge.textContent='⚡ AI 예측'; }
  else { badge.className='aibadge off'; badge.textContent='추정(오프라인)'; }

  // 트랙별 핵심 3개 지표를 sim 카드로 (디자인 시안 형식)
  const M = {
    sales:{k:'월 예상 매출',  v:p.expected_monthly_sales_manwon, fmt:x=>x.toLocaleString()+'만'},
    foot: {k:'구역 유동인구', v:p.foot_traffic_change_pct,       fmt:x=>(x>0?'+':'')+x+'%'},
    jobs: {k:'예상 고용',     v:p.jobs,                          fmt:x=>x+'명'},
    tax:  {k:'연 세수 기여',  v:p.annual_tax_contribution_manwon, fmt:x=>'약 '+x.toLocaleString()+'만'},
  };
  const order = track==='work' ? ['jobs','foot','tax']
              : track==='live' ? ['sales','foot','jobs']
              :                   ['sales','foot','tax'];
  const cards = order.map(key=>M[key]).filter(m=>m.v>0).map(m=>({k:m.k, v:m.fmt(m.v)}));

  body.innerHTML = `
    <div class="simcards">${cards.map((c,idx)=>`<div class="simc"><div class="k">${c.k}</div><div class="v${idx===0?' am':''}">${c.v}</div></div>`).join('')}</div>
    ${p.reasoning_ko ? `<div class="ai-reason">“${p.reasoning_ko}”</div>` : ''}`;
}

// 보드 칸 + (있으면) 지도 마커를 '채워진' 상태로 표시 — 복원/신규 공용
function applyFilled(i, trackKey, withMap){
  const t = TRACK[trackKey];
  filledTrack[i] = trackKey;
  const cellEl = cells[i];
  if(cellEl){
    cellEl.classList.remove('sel');
    cellEl.classList.add('filled', t.cls);
    const badge = cellEl.querySelector('.badge'); if(badge) badge.textContent = t.label;
  }
  if(withMap && window.SejongMap) window.SejongMap.markFilled(i, trackKey);
}

function fillVacancy(i, trackKey){
  const b = BUILDINGS[i];
  const t = TRACK[trackKey];
  applyFilled(i, trackKey, true);

  const res = document.getElementById('matchRes');
  if(res) res.hidden = false;
  const btn = document.getElementById('matchBtn');
  if(btn){ btn.disabled = true; btn.classList.add('done'); btn.textContent = '✓ 매칭 완료 — 불이 켜졌습니다'; }
  updateFillN();

  // STEP4: Supabase matches 에 기록 (온라인일 때만, 실패해도 화면은 진행)
  const tenant = (t.matches(b)[0] || {}).n || '';
  if(window.SejongData && window.SejongData.recordMatch){
    window.SejongData.recordMatch(b.id, trackKey, tenant);
  }
}

function barRow(label, val, color){
  return `<div class="barrow"><span>${label}</span>
    <div class="bar"><i data-w="${val}" style="background:${color}"></i></div>
    <span class="sc">${val}</span></div>`;
}

// 지도(map.js)에서 사용할 수 있도록 노출
window.SejongApp = {
  get BUILDINGS(){ return BUILDINGS; },
  PLACES, TRACK, filledTrack,
  selectVacancy, diagnose,
};

// ============================================================
// STEP4: 부트스트랩 — DB(있으면) 우선, 없으면 로컬 시드. 그 후 지도 신호.
// ============================================================
async function bootstrap(){
  // 1) 공실 데이터: Supabase 성공 시 교체, 아니면 로컬 시드 유지
  try{
    if(window.SejongData && window.SejongData.loadVacancies){
      const rows = await window.SejongData.loadVacancies();
      if(rows && rows.length) BUILDINGS = rows;
    }
  }catch(e){ /* 로컬 시드 유지 */ }

  buildBoard();

  // 2) 기존 매칭 복원 — 카운터/점등을 DB 기준으로
  try{
    if(window.SejongData && window.SejongData.loadMatches){
      const byVac = await window.SejongData.loadMatches();
      if(byVac){
        BUILDINGS.forEach((b,i)=>{ const tk = byVac[b.id]; if(tk && TRACK[tk]) applyFilled(i, tk, false); });
        updateFillN();
      }
    }
  }catch(e){ /* 복원 실패 무시 */ }

  // 3) 지도 초기화 신호 (BUILDINGS/filledTrack 확정 후)
  document.dispatchEvent(new CustomEvent('sejong:ready'));
}

bootstrap();

// ============================================================
// 인트로 비주얼: 역설 count-up + 히어로 '비+ㅊ=빛' 순차 점등
// (design_reference 동작 — prefers-reduced-motion 존중)
// ============================================================
(function initIntro(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // count-up (.big[data-target][data-suffix])
  function countUp(el){
    const t = parseFloat(el.dataset.target), suf = el.dataset.suffix || '';
    const dec = (t % 1 !== 0) ? 1 : 0;
    if(reduce){ el.innerHTML = t.toFixed(dec) + '<span class="unit">' + suf + '</span>'; return; }
    let s = null;
    function step(ts){
      if(!s) s = ts;
      const p = Math.min((ts - s) / 1200, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.innerHTML = (t * e).toFixed(dec) + '<span class="unit">' + suf + '</span>';
      if(p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const stats = document.querySelector('.stats');
  if(stats){
    if(!('IntersectionObserver' in window) || reduce){
      stats.querySelectorAll('.big[data-target]').forEach(countUp);
    }else{
      const io = new IntersectionObserver((es)=>{
        es.forEach(en=>{ if(en.isIntersecting){ en.target.querySelectorAll('.big[data-target]').forEach(countUp); io.unobserve(en.target); } });
      }, {threshold:.4});
      io.observe(stats);
    }
  }

  // 히어로 점등: 아랫행(채워지는 도시)이 왼→오 순차 점등
  if(!reduce){
    const lit = [...document.querySelectorAll('#stackword .wrow:last-of-type .cellword')];
    lit.forEach(c=>c.classList.remove('on'));
    let i = 0;
    setTimeout(function tick(){ if(i >= lit.length) return; lit[i].classList.add('on'); i++; setTimeout(tick, 150); }, 600);
  }
})();

// ============================================================
// STEP 3: 지도 / 보드 탭 전환
// ============================================================
(function initTabs(){
  const tabBtns = document.querySelectorAll('.viewtab');
  const views = { board: document.getElementById('boardView'), map: document.getElementById('mapView') };
  if(!tabBtns.length) return;
  tabBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const v = btn.dataset.view;
      tabBtns.forEach(b=>{ const on = b===btn; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
      Object.entries(views).forEach(([k,el])=>{ if(el) el.hidden = (k!==v); });
      if(v==='map' && window.SejongMap) window.SejongMap.refresh();
    });
  });
})();
