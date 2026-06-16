// ============================================================
// 세종 지도 (Leaflet + OpenStreetMap) — 공실/명소 마커
// app.js 로드 후 실행. window.SejongApp 을 사용한다.
// API 키 불필요. 마커 클릭 = 보드 칸 클릭과 동일 동작.
// ============================================================
function initMap(){
  if(typeof L === 'undefined' || !window.SejongApp) return;
  if(window.SejongMap) return;   // 중복 초기화 방지
  const { PLACES, TRACK, filledTrack } = window.SejongApp;
  const BUILDINGS = window.SejongApp.BUILDINGS;   // bootstrap 이후 확정된 데이터

  const SEJONG_CENTER = [36.487, 127.282];   // 세종시 중심 (대략)
  const map = L.map('mapView', { scrollWheelZoom:false, zoomControl:true }).setView(SEJONG_CENTER, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const vacancyMarkers = [];   // index -> marker

  // ---------- 공실 마커: 점선/회색 원형 → 채워지면 트랙 색 점등 ----------
  function vacancyIcon(trackKey){
    const filled = !!trackKey;
    const color = filled ? TRACK[trackKey].hex : '#5E616C';   // 꺼진 칸 = muted2
    const glow = filled ? `box-shadow:0 0 14px ${color};` : '';
    const border = filled ? `solid` : `dashed`;
    const inner = filled ? `background:${color};` : `background:transparent;`;
    return L.divIcon({
      className: 'vac-marker',
      html: `<span style="display:block;width:18px;height:18px;border-radius:50%;
        border:2px ${border} ${color};${inner}${glow}"></span>`,
      iconSize: [18,18], iconAnchor: [9,9]
    });
  }

  BUILDINGS.forEach((b,i)=>{
    if(b.lat == null || b.lng == null) return;
    const m = L.marker([b.lat, b.lng], { icon: vacancyIcon(filledTrack[i]), title: b.name }).addTo(map);
    m.bindTooltip(`${b.dong} · ${b.name}`, { direction:'top', offset:[0,-8] });
    m.on('click', ()=> window.SejongApp.selectVacancy(i));
    vacancyMarkers[i] = m;
  });

  // ---------- 명소 마커: 세 개의 빛 ----------
  PLACES.forEach(p=>{
    const icon = L.divIcon({
      className: 'place-marker',
      html: `<span style="font-size:22px;filter:drop-shadow(0 0 8px rgba(255,179,71,.7));">${p.emoji}</span>`,
      iconSize: [26,26], iconAnchor: [13,13]
    });
    const m = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(map);
    m.bindPopup(`<b>${p.name}</b><br><span style="font-size:.85em;color:#555">${p.desc}</span>`);
    m.bindTooltip(p.name, { direction:'top', offset:[0,-10] });
  });

  // ---------- app.js 가 호출하는 인터페이스 ----------
  window.SejongMap = {
    highlight(i){
      const m = vacancyMarkers[i];
      if(m){ map.panTo([BUILDINGS[i].lat, BUILDINGS[i].lng]); m.openTooltip(); }
    },
    markFilled(i, trackKey){
      const m = vacancyMarkers[i];
      if(m) m.setIcon(vacancyIcon(trackKey));
    },
    refresh(){ setTimeout(()=>map.invalidateSize(), 60); }   // 탭 전환 후 타일 깨짐 방지
  };
}

// bootstrap(app.js) 가 데이터 확정 후 발생시키는 신호로 초기화
document.addEventListener('sejong:ready', initMap);
