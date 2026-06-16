// ============================================================
// 세종 빈칸 프로젝트 — Supabase 데이터 계층
// - vacancies 조회(읽기), matches 기록(쓰기)
// - 설정이 없거나 실패하면 로컬 시드 데이터로 graceful degradation
//
// ⚠️ 여기에 들어가는 값은 anon(public) 키만 사용합니다.
//    anon 키는 공개돼도 되는 값이지만, 반드시 RLS가 켜져 있어야 안전합니다.
//    service_role 키는 절대 넣지 마세요. (schema.sql 의 RLS 설정 참고)
// ============================================================
(function(){
  // 👇 Supabase 프로젝트 값. 비워두면 오프라인(로컬 시드) 모드로 동작합니다.
  // ⚠️ createClient 에는 /rest/v1/ 없는 베이스 Project URL 을 넣습니다.
  const SUPABASE_URL  = "https://vijhehsghpcbxwfjtfzf.supabase.co";
  const SUPABASE_ANON = "sb_publishable_d-GZ94IZ8lcL1zdK8sBUNw_I5fONRhR";   // publishable(=anon/public) 키. service_role 아님.

  const configured = !!(SUPABASE_URL && SUPABASE_ANON && window.supabase);
  let client = null;
  if(configured){
    try { client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); }
    catch(e){ console.warn('[data] Supabase 클라이언트 생성 실패 — 오프라인 모드', e); }
  }

  // DB row(snake_case) → 프런트 BUILDINGS 형태(camelCase)
  function rowToBuilding(r){
    return {
      id:r.id, dong:r.dong, name:r.building_name, floor:r.floor, area:Number(r.area),
      months:r.vacancy_months, foot:r.foot_traffic, brt:r.brt_access, rent:r.rent_index,
      street:r.is_street, lat:r.lat!=null?Number(r.lat):null, lng:r.lng!=null?Number(r.lng):null
    };
  }

  window.SejongData = {
    isOnline(){ return !!client; },

    // 공실 목록을 DB에서 불러온다. 실패/미설정 시 null → app.js 가 로컬 시드 사용.
    async loadVacancies(){
      if(!client) return null;
      try{
        const { data, error } = await client.from('vacancies').select('*').order('id');
        if(error) throw error;
        if(!data || !data.length) return null;
        console.info(`[data] Supabase 공실 ${data.length}건 로드됨`);
        return data.map(rowToBuilding);
      }catch(e){ console.warn('[data] vacancies 로드 실패 — 로컬 시드 사용', e); return null; }
    },

    // 이미 매칭된 공실(vacancy_id → 최신 track) 을 복원한다. 카운터를 DB 기준으로 맞춤.
    async loadMatches(){
      if(!client) return null;
      try{
        const { data, error } = await client.from('matches').select('vacancy_id, track, created_at').order('created_at');
        if(error) throw error;
        const byVacancy = {};
        (data||[]).forEach(m=>{ byVacancy[m.vacancy_id] = m.track; });
        return byVacancy;   // { vacancyId: 'pop'|'work'|'live' }
      }catch(e){ console.warn('[data] matches 로드 실패', e); return null; }
    },

    // 매칭 기록 INSERT (fire-and-forget, 실패해도 화면은 진행)
    async recordMatch(vacancyId, track, tenantLabel){
      if(!client) return false;
      try{
        const { error } = await client.from('matches').insert({ vacancy_id:vacancyId, track, tenant_label:tenantLabel||null });
        if(error) throw error;
        console.info(`[data] 매칭 기록 저장됨: 공실#${vacancyId} → ${track}`);
        return true;
      }catch(e){ console.warn('[data] 매칭 기록 저장 실패', e); return false; }
    }
  };
})();
