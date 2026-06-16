// ============================================================
// Vercel 서버리스 함수 — Gemini 도시상권 1년 후 예측
// POST /api/simulate
//
// 보안: GEMINI_API_KEY 는 Vercel 환경변수에서만 읽는다(process.env).
//       절대 프런트엔드/레포에 키를 두지 않는다.
// 응답: { source: 'gemini' | 'fallback', prediction: {...} }
//       Gemini 실패 시 규칙 기반 폴백으로 graceful degradation.
// ============================================================

const USE_BY_TRACK = {
  pop:  '단기 팝업 매장(베이커리·로컬 브랜드)',
  work: '공유오피스·GovTech 스타트업 오피스',
  live: '게스트하우스·단기 스테이 주거',
};

// ---------- 규칙 기반 폴백 (Gemini 실패 시) ----------
function fallbackPrediction(v, track){
  const area = Number(v.area)||50, foot = Number(v.foot)||50, brt = Number(v.brt)||50;
  if(track === 'work'){
    const jobs = Math.ceil(area/15);
    return {
      expected_monthly_sales_manwon: Math.round(jobs*120/10)*10,
      foot_traffic_change_pct: Math.round(3 + brt*0.06),
      jobs,
      annual_tax_contribution_manwon: Math.round(jobs*120*12*0.02/10)*10,
      reasoning_ko: `상층 사무형 ${area}㎡, BRT 접근성 ${brt} 기준 약 ${jobs}명 규모 입주가 가능합니다. 부처·연구단지 인접 수요로 점심 상권 유동이 늘어납니다.`
    };
  }
  if(track === 'live'){
    const rooms = Math.max(4, Math.round(area/30));
    const stays = Math.round(rooms*365*0.62);
    return {
      expected_monthly_sales_manwon: Math.round(stays*7/12/10)*10,
      foot_traffic_change_pct: Math.round(4 + foot*0.05),
      jobs: Math.max(2, Math.round(rooms/4)),
      annual_tax_contribution_manwon: Math.round(stays*7*0.02/10)*10,
      reasoning_ko: `${area}㎡ 통임대로 약 ${rooms}실 전환이 가능하며, 연 ${stays.toLocaleString()}명 체류가 예상됩니다. 축제·수목원 방문 수요와 전입 공무원 단기 스테이가 핵심 수요입니다.`
    };
  }
  // pop (기본)
  const sales = Math.round(foot*0.32*area/10)*10;
  return {
    expected_monthly_sales_manwon: sales,
    foot_traffic_change_pct: Math.round(6 + foot*0.11),
    jobs: Math.max(2, Math.ceil(area/20)),
    annual_tax_contribution_manwon: Math.round(sales*12*0.013/10)*10,
    reasoning_ko: `1층 가로변·유동인구 지수 ${foot} 입지로 단기 팝업 시 월 약 ${sales.toLocaleString()}만 원 매출이 기대됩니다. 거리 활력이 가장 빠르게 회복되는 용도입니다.`
  };
}

function buildPrompt(v, use){
  return [
    '너는 도시상권 분석 AI다. 아래 공실(빈 상가) 데이터를 근거로,',
    `이 공간에 "${use}"가 입점할 경우 1년 후를 추정하라.`,
    '',
    '[공실 데이터]',
    `- 동: ${v.dong}`,
    `- 건물/호: ${v.name}`,
    `- 층수: ${v.floor}층`,
    `- 면적: ${v.area}㎡`,
    `- 공실 기간: ${v.months}개월`,
    `- 유동인구 지수(0~100): ${v.foot}`,
    `- BRT(간선급행버스) 접근성(0~100): ${v.brt}`,
    `- 임대료 지수(낮을수록 저렴): ${v.rent}`,
    `- 1층 가로변 여부: ${v.street ? '예' : '아니오'}`,
    '',
    '반드시 아래 JSON 스키마로만 답하라(코드블록·설명 금지). 수치는 위 데이터에 비례한 합리적 추정값이어야 한다:',
    '{',
    '  "expected_monthly_sales_manwon": 정수(월 예상 매출, 만원 단위),',
    '  "foot_traffic_change_pct": 정수(구역 유동인구 변화율, %),',
    '  "jobs": 정수(예상 고용 인원),',
    '  "annual_tax_contribution_manwon": 정수(연 세수 기여 추정, 만원 단위),',
    '  "reasoning_ko": "한국어 2문장 — 데이터 근거를 들어 설명"',
    '}'
  ].join('\n');
}

function coerceNumber(x){ const n = Number(x); return Number.isFinite(n) ? Math.round(n) : 0; }

function normalize(pred){
  return {
    expected_monthly_sales_manwon: coerceNumber(pred.expected_monthly_sales_manwon),
    foot_traffic_change_pct: coerceNumber(pred.foot_traffic_change_pct),
    jobs: coerceNumber(pred.jobs),
    annual_tax_contribution_manwon: coerceNumber(pred.annual_tax_contribution_manwon),
    reasoning_ko: String(pred.reasoning_ko || '').slice(0, 400),
  };
}

module.exports = async (req, res) => {
  if(req.method !== 'POST'){
    res.status(405).json({ error: 'POST only' });
    return;
  }

  // body 파싱 (Vercel은 보통 req.body 제공, 안전하게 둘 다 대응)
  let body = req.body;
  if(typeof body === 'string'){ try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const v = body.vacancy || {};
  const track = ['pop','work','live'].includes(body.track) ? body.track : 'pop';
  const use = body.use || USE_BY_TRACK[track];

  const key = process.env.GEMINI_API_KEY;

  // 키가 없으면 즉시 폴백 (로컬/미설정 환경)
  if(!key){
    res.status(200).json({ source: 'fallback', reason: 'no_api_key', prediction: fallbackPrediction(v, track) });
    return;
  }

  try{
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const payload = {
      contents: [{ parts: [{ text: buildPrompt(v, use) }] }],
      generationConfig: { temperature: 0.7, response_mime_type: 'application/json' }
    };

    // 타임아웃 보호 (8초)
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), 8000);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if(!r.ok){ throw new Error('gemini status ' + r.status); }
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!text){ throw new Error('empty gemini response'); }

    const parsed = JSON.parse(text);
    res.status(200).json({ source: 'gemini', model, prediction: normalize(parsed) });
  }catch(err){
    // 어떤 실패든 화면이 깨지지 않게 폴백
    res.status(200).json({ source: 'fallback', reason: String(err && err.message || err), prediction: fallbackPrediction(v, track) });
  }
};
