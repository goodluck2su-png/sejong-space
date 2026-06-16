// ============================================================
// /api/simulate 호출 래퍼 — js/ai.js
// - sessionStorage 캐시 (동일 공실+용도 재호출 방지 = 무료등급 보호)
// - /api 미존재(로컬 file://)·실패 시 클라이언트 규칙 기반 폴백
// - window.SejongAI.predict(vacancy, track) → { source, prediction }
//   source: 'gemini' | 'fallback'
// ============================================================
(function(){
  const inflight = {};   // key -> Promise (중복 호출 디바운스)

  function cacheKey(v, track){ return `sim:${v.id}:${track}`; }

  // 클라이언트 폴백 (서버리스 함수에 닿지 못할 때 — 로컬 데모 등)
  function clientFallback(v, track){
    const area = Number(v.area)||50, foot = Number(v.foot)||50, brt = Number(v.brt)||50;
    if(track==='work'){
      const jobs = Math.ceil(area/15);
      return { expected_monthly_sales_manwon: Math.round(jobs*120/10)*10, foot_traffic_change_pct: Math.round(3+brt*0.06),
        jobs, annual_tax_contribution_manwon: Math.round(jobs*120*12*0.02/10)*10,
        reasoning_ko:`상층 사무형 ${area}㎡·BRT ${brt} 기준 약 ${jobs}명 입주가 가능합니다. 부처·연구단지 인접 수요로 점심 상권 유동이 늘어납니다.` };
    }
    if(track==='live'){
      const rooms = Math.max(4, Math.round(area/30)), stays = Math.round(rooms*365*0.62);
      return { expected_monthly_sales_manwon: Math.round(stays*7/12/10)*10, foot_traffic_change_pct: Math.round(4+foot*0.05),
        jobs: Math.max(2, Math.round(rooms/4)), annual_tax_contribution_manwon: Math.round(stays*7*0.02/10)*10,
        reasoning_ko:`${area}㎡ 통임대로 약 ${rooms}실 전환이 가능하며, 연 ${stays.toLocaleString()}명 체류가 예상됩니다. 축제·수목원 방문과 전입 공무원 단기 스테이가 핵심 수요입니다.` };
    }
    const sales = Math.round(foot*0.32*area/10)*10;
    return { expected_monthly_sales_manwon: sales, foot_traffic_change_pct: Math.round(6+foot*0.11),
      jobs: Math.max(2, Math.ceil(area/20)), annual_tax_contribution_manwon: Math.round(sales*12*0.013/10)*10,
      reasoning_ko:`1층 가로변·유동인구 지수 ${foot} 입지로 단기 팝업 시 월 약 ${sales.toLocaleString()}만 원 매출이 기대됩니다. 거리 활력이 가장 빠르게 회복되는 용도입니다.` };
  }

  async function callApi(v, track){
    const res = await fetch('/api/simulate', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ vacancy:v, track })
    });
    if(!res.ok) throw new Error('api status '+res.status);
    return res.json();   // { source, prediction }
  }

  window.SejongAI = {
    async predict(v, track){
      const key = cacheKey(v, track);
      // 1) 세션 캐시
      try{
        const cached = sessionStorage.getItem(key);
        if(cached) return JSON.parse(cached);
      }catch(e){}
      // 2) 동일 요청 진행 중이면 그 Promise 재사용
      if(inflight[key]) return inflight[key];

      inflight[key] = (async ()=>{
        let result;
        try{
          result = await callApi(v, track);
          if(!result || !result.prediction) throw new Error('bad payload');
        }catch(e){
          console.warn('[ai] /api/simulate 실패 — 클라이언트 폴백', e.message);
          result = { source:'fallback', prediction: clientFallback(v, track) };
        }
        try{ sessionStorage.setItem(key, JSON.stringify(result)); }catch(e){}
        return result;
      })();

      try { return await inflight[key]; }
      finally { delete inflight[key]; }
    }
  };
})();
