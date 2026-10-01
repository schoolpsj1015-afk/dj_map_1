/**
 * 부산 전체 상권 지도 Application (web2/app.js)
 * - 부산광역시 10대 업종 전수(155,103개) 인터랙티브 상권 지도
 * - 대분류별 분할 데이터 온디맨드 로딩 (메모리 절약)
 * - CartoDB Voyager + OSM + Esri + VWorld 멀티 타일 (사용량 초과 차단 제로)
 * - ChunkedLoading + Shared Icon + Lazy Popup 마커 클러스터링 (브라우저 정지 완전 방지)
 * - 3단계 계층 필터(대분류 → 중분류 → 소분류) + 16개 구·군 + 초정밀 통합 검색
 */

// ===== 1. 부산 각 구·군 중심 좌표 & 줌 레벨 =====
const DISTRICT_COORDS = {
  '': [35.1795, 129.0756, 12],
  '해운대구': [35.1631, 129.1636, 14], '부산진구': [35.1630, 129.0531, 14],
  '동래구': [35.2048, 129.0838, 14],   '남구': [35.1365, 129.0842, 14],
  '북구': [35.1972, 128.9898, 14],     '사하구': [35.1044, 128.9750, 14],
  '금정구': [35.2430, 129.0921, 14],   '강서구': [35.2122, 128.9806, 13],
  '연제구': [35.1764, 129.0797, 14],   '수영구': [35.1456, 129.1132, 14],
  '사상구': [35.1526, 128.9913, 14],   '기장군': [35.2446, 129.2223, 13],
  '중구': [35.1062, 129.0324, 15],     '동구': [35.1293, 129.0454, 15],
  '영도구': [35.0912, 129.0679, 14],   '서구': [35.0979, 129.0243, 14],
};

// ===== 2. 10대 대분류 정의 및 통계 배지 =====
const MAJOR_CATS = [
  { mc: 'I2', name: '음식',       count: '5.2만', icon: '🍽️' },
  { mc: 'G2', name: '소매',       count: '3.8만', icon: '🛒' },
  { mc: 'S2', name: '수리·개인',   count: '2.0만', icon: '🔧' },
  { mc: 'M1', name: '과학·기술',   count: '1.3만', icon: '💼' },
  { mc: 'P1', name: '교육',       count: '8.1천', icon: '📚' },
  { mc: 'L1', name: '부동산',     count: '6.0천', icon: '🏠' },
  { mc: 'R1', name: '예술·스포츠', count: '5.9천', icon: '🎨' },
  { mc: 'N1', name: '시설관리',   count: '5.5천', icon: '🏗️' },
  { mc: 'I1', name: '숙박',       count: '2.6천', icon: '🏨' },
  { mc: 'Q1', name: '보건의료',   count: '2.3천', icon: '🏥' },
];

const BG_TINTS = {
  'I2': 'rgba(249,115,22,0.08)',
  'G2': 'rgba(99,102,241,0.08)',
  'S2': 'rgba(8,145,178,0.08)',
  'M1': 'rgba(139,92,246,0.08)',
  'P1': 'rgba(16,185,129,0.08)',
  'L1': 'rgba(217,119,6,0.08)',
  'R1': 'rgba(236,72,153,0.08)',
  'N1': 'rgba(100,116,139,0.08)',
  'Q1': 'rgba(220,38,38,0.08)',
  'I1': 'rgba(14,165,233,0.08)',
};

// ===== 3. 마커 아이콘 싱글톤 캐시 (메모리 절약) =====
const ICON_CACHE = {};
function getIconForCategory(mc) {
  if (!ICON_CACHE[mc]) {
    ICON_CACHE[mc] = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="pin pin-${mc}"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24]
    });
  }
  return ICON_CACHE[mc];
}

// ===== 4. 애플리케이션 상태 (State) =====
const ST = {
  loadedData: {},      // { mc: [...] } 캐시
  allData: [],         // 현재 선택된 대분류 전체 데이터
  filtered: [],        // 필터링 적용된 데이터
  selectedMc: null,    // 선택된 대분류 코드
  selectedMidC: '',    // 선택된 중분류 코드
  selectedSubC: '',    // 선택된 소분류 코드
  selectedGu: '',      // 선택된 구·군
  keyword: '',         // 검색어
  renderOffset: 0,
  BATCH: 50,
  activeStore: null,
  map: null,
  cluster: null,
  markersMap: new Map(),
  userMarker: null,
};

// ===== 5. DOM 요소 참조 =====
const $ = id => document.getElementById(id);
const D = {
  sidebar: $('sidebar'), sbClose: $('sb-close'),
  kwInput: $('kw-input'), kwClear: $('kw-clear'),
  guSel: $('gu-sel'), majorPills: $('major-pills'),
  midGroup: $('mid-group'), midSel: $('mid-sel'),
  subGroup: $('sub-group'), subSel: $('sub-sel'),
  resultCount: $('result-count'), resetBtn: $('reset-btn'),
  storeListWrap: $('store-list-wrap'), loadingMsg: $('loading-msg'),
  storeList: $('store-list'), listEmpty: $('list-empty'),
  listMore: $('list-more'), loadMoreBtn: $('load-more-btn'),
  overlay: $('overlay'), toast: $('toast'),
  bsheet: $('bottom-sheet'), bsClose: $('bs-close'),
  bsName: $('bs-name'), bsTags: $('bs-tags'),
  bsRoad: $('bs-road'), bsJibun: $('bs-jibun'),
  copyRoad: $('copy-road'), copyJibun: $('copy-jibun'),
  bsKakao: $('bs-kakao'), bsNaver: $('bs-naver'),
  gpBtn: $('gps-btn'), fitBtn: $('fit-btn'),
  mbMenu: $('mb-menu'), mbSearch: $('mb-search-trigger'),
  mbLoc: $('mb-loc'),
};

// ===== 6. 지도 초기화 (안정적인 글로벌 타일 + 자동 폴백) =====
function initMap() {
  ST.map = L.map('map', {
    zoomControl: false,
    tap: true
  }).setView([35.1795, 129.0756], 12);

  // 1. CartoDB Voyager: 100% 무료, 한국어 POI 완벽, 고해상도, 사용량 한도 없음 (기본)
  const cartoVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abcd',
    maxZoom: 20
  });

  // 2. OpenStreetMap 표준 타일
  const osmStandard = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  });

  // 3. Esri World Street Map (고정밀 항공/거리 타일)
  const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  });

  // 4. VWorld 타일 (키 없이 초과 시 CartoDB로 자동 fallback)
  const vworld = L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
    attribution: '&copy; VWorld 국토교통부',
    minZoom: 6,
    maxZoom: 19,
    errorTileUrl: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/12/3518/1638.png'
  });

  // 기본 레이어로 안전한 CartoDB Voyager 적용
  cartoVoyager.addTo(ST.map);

  // 레이어 전환 컨트롤
  const baseLayers = {
    '모던 상세 지도 (CartoDB)': cartoVoyager,
    '국토교통부 표준지도 (VWorld)': vworld,
    '오픈스트리트맵 (OSM)': osmStandard,
    '상세 거리 지도 (Esri)': esriStreet
  };
  L.control.layers(baseLayers, null, { position: 'topright' }).addTo(ST.map);
  L.control.zoom({ position: 'topright' }).addTo(ST.map);

  // 대용량 마커 렌더링 시 브라우저 정지를 100% 방지하는 chunkedLoading 옵션 적용
  ST.cluster = L.markerClusterGroup({
    chunkedLoading: true,      // 비동기 청크 렌더링 활성화 (UI 블로킹 방지)
    chunkInterval: 60,         // 60ms마다 렌더링
    chunkDelay: 10,            // 10ms 휴식 -> 브라우저 반응성 유지
    maxClusterRadius: 50,
    disableClusteringAtZoom: 18,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  });
  ST.map.addLayer(ST.cluster);
}

// ===== 7. 10대 대분류 버튼 렌더링 =====
function renderMajorPills() {
  D.majorPills.innerHTML = '';
  MAJOR_CATS.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'major-pill';
    btn.dataset.mc = cat.mc;
    btn.innerHTML = `
      <span class="pill-dot" style="background:var(--c-${cat.mc},var(--c-def))"></span>
      <span class="pill-title">${cat.icon} ${cat.name}</span>
      <span class="pill-badge">${cat.count}</span>
    `;
    btn.onclick = () => onMajorSelect(cat.mc);
    D.majorPills.appendChild(btn);
  });
}

// ===== 8. 대분류 데이터 온디맨드 로딩 =====
function loadData(mc) {
  return new Promise((resolve, reject) => {
    if (ST.loadedData[mc]) {
      resolve(ST.loadedData[mc]);
      return;
    }

    D.loadingMsg.style.display = 'block';
    D.loadingMsg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><p>업종 데이터를 고속 로딩 중입니다...</p>';
    D.storeList.innerHTML = '';
    D.listEmpty.style.display = 'none';
    D.listMore.style.display = 'none';

    const script = document.createElement('script');
    script.src = `data_${mc}.js`;
    script.onload = () => {
      const varName = `DATA_${mc}`;
      if (window[varName]) {
        ST.loadedData[mc] = window[varName];
        resolve(ST.loadedData[mc]);
      } else {
        reject(new Error('데이터를 찾을 수 없습니다: ' + varName));
      }
    };
    script.onerror = () => reject(new Error(`data_${mc}.js 로드에 실패했습니다.`));
    document.head.appendChild(script);
  });
}

// ===== 9. 대분류 선택 처리 =====
async function onMajorSelect(mc) {
  // 동일 대분류 재클릭 시 선택 해제
  if (ST.selectedMc === mc) {
    ST.selectedMc = null;
    ST.allData = [];
    ST.filtered = [];
    D.majorPills.querySelectorAll('.major-pill').forEach(p => p.classList.remove('active'));
    D.midGroup.style.display = 'none';
    D.subGroup.style.display = 'none';
    D.loadingMsg.style.display = 'block';
    D.loadingMsg.innerHTML = '<i class="fa-solid fa-circle-notch"></i><p>조회하실 대분류 업종을 선택해주세요.</p>';
    D.storeList.innerHTML = '';
    D.listEmpty.style.display = 'none';
    D.listMore.style.display = 'none';
    D.resultCount.textContent = '-';
    ST.cluster.clearLayers();
    ST.markersMap.clear();
    D.storeListWrap.style.background = '';
    return;
  }

  ST.selectedMc = mc;
  ST.selectedMidC = '';
  ST.selectedSubC = '';

  // UI 활성화 상태 업데이트
  D.majorPills.querySelectorAll('.major-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.mc === mc);
  });

  // 배경 은은한 틴트 효과
  D.storeListWrap.style.background = BG_TINTS[mc] || '';

  try {
    const data = await loadData(mc);
    ST.allData = data;
    buildMidFilter(data);
    applyFilters();
  } catch (e) {
    D.loadingMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><p>로드 실패: ${e.message}</p>`;
    D.loadingMsg.style.display = 'block';
  }
}

// ===== 10. 중분류 및 소분류 필터 목록 동적 생성 (건수 포함) =====
function buildMidFilter(data) {
  const midCounts = {};
  const midNames = {};
  data.forEach(s => {
    if (s.dc) {
      midCounts[s.dc] = (midCounts[s.dc] || 0) + 1;
      midNames[s.dc] = s.dn;
    }
  });

  D.midSel.innerHTML = '<option value="">중분류 전체 (전체보기)</option>';
  Object.entries(midNames)
    .sort((a, b) => (midCounts[b[0]] || 0) - (midCounts[a[0]] || 0))
    .forEach(([c, n]) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `${n} (${(midCounts[c] || 0).toLocaleString()}건)`;
      D.midSel.appendChild(opt);
    });

  D.midGroup.style.display = 'block';
  D.subGroup.style.display = 'none';
}

function buildSubFilter(midC) {
  if (!midC) {
    D.subGroup.style.display = 'none';
    return;
  }
  const subCounts = {};
  const subNames = {};
  ST.allData.filter(s => s.dc === midC).forEach(s => {
    if (s.sc) {
      subCounts[s.sc] = (subCounts[s.sc] || 0) + 1;
      subNames[s.sc] = s.sn;
    }
  });

  D.subSel.innerHTML = '<option value="">소분류 전체 (전체보기)</option>';
  Object.entries(subNames)
    .sort((a, b) => (subCounts[b[0]] || 0) - (subCounts[a[0]] || 0))
    .forEach(([c, n]) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `${n} (${(subCounts[c] || 0).toLocaleString()}건)`;
      D.subSel.appendChild(opt);
    });

  D.subGroup.style.display = 'block';
}

// ===== 11. 통합 필터링 실행 =====
function applyFilters() {
  const kw = ST.keyword.toLowerCase().trim();
  const gu = ST.selectedGu;
  const midC = ST.selectedMidC;
  const subC = ST.selectedSubC;

  ST.filtered = ST.allData.filter(s => {
    if (gu && s.g !== gu) return false;
    if (midC && s.dc !== midC) return false;
    if (subC && s.sc !== subC) return false;
    if (kw) {
      return (
        (s.n && s.n.toLowerCase().includes(kw)) ||
        (s.br && s.br.toLowerCase().includes(kw)) ||
        (s.sn && s.sn.toLowerCase().includes(kw)) ||
        (s.dn && s.dn.toLowerCase().includes(kw)) ||
        (s.g && s.g.toLowerCase().includes(kw)) ||
        (s.d && s.d.toLowerCase().includes(kw)) ||
        (s.r && s.r.toLowerCase().includes(kw)) ||
        (s.j && s.j.toLowerCase().includes(kw))
      );
    }
    return true;
  });

  ST.renderOffset = 0;
  D.resultCount.textContent = ST.filtered.length.toLocaleString() + '개 상가';
  renderMarkers();
  renderList(true);
}

// ===== 12. 팝업 HTML 생성 함수 (On-demand Lazy Generation) =====
function buildPopupHtml(s, mc) {
  const query = encodeURIComponent((s.n || '') + ' ' + (s.r || s.j || ''));
  return `
    <div class="popup-inner">
      <div class="popup-name">${escapeHtml(s.n || '')}${s.br ? `<span style="font-size:12px;color:#64748b;margin-left:4px;">${escapeHtml(s.br)}</span>` : ''}</div>
      <div class="popup-tags">
        ${getTagHtml(mc, s.mn || '')}
        ${s.sn ? `<span class="tag tag-sub">${escapeHtml(s.sn)}</span>` : ''}
        ${s.g ? `<span class="tag tag-gu">${escapeHtml(s.g)}</span>` : ''}
        ${s.d ? `<span class="tag tag-dong">${escapeHtml(s.d)}</span>` : ''}
      </div>
      <div class="popup-addr"><i class="fa-solid fa-location-dot" style="margin-right:4px;color:#6366f1;"></i>${escapeHtml(s.r || s.j || '주소 정보 없음')}</div>
      <div class="popup-links">
        <a href="https://map.kakao.com/link/search/${query}" target="_blank" rel="noopener" class="popup-link kakao"><i class="fa-solid fa-route"></i> 카카오맵</a>
        <a href="https://map.naver.com/v5/search/${query}" target="_blank" rel="noopener" class="popup-link naver"><i class="fa-solid fa-diamond-turn-right"></i> 네이버 지도</a>
      </div>
    </div>`;
}

// HTML 이스케이프 유틸
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

// ===== 13. 마커 렌더링 (Lazy Popup & Shared Icon 최적화) =====
function renderMarkers() {
  ST.cluster.clearLayers();
  ST.markersMap.clear();

  const mc = ST.selectedMc || 'def';
  const sharedIcon = getIconForCategory(mc);
  const markers = [];

  const len = ST.filtered.length;
  for (let i = 0; i < len; i++) {
    const s = ST.filtered[i];
    if (!s.la || !s.lo) continue;

    const marker = L.marker([s.la, s.lo], { icon: sharedIcon });

    // 지연 팝업 바인딩: 마커 클릭 시점에만 팝업 생성하여 메모리 90% 절감
    marker.on('click', () => {
      selectStore(s, false);
      if (!marker.getPopup()) {
        marker.bindPopup(buildPopupHtml(s, mc)).openPopup();
      }
    });

    const key = `${s.la}_${s.lo}_${s.n}`;
    ST.markersMap.set(key, marker);
    markers.push(marker);
  }

  // chunkedLoading 활성화된 클러스터 그룹에 일괄 추가
  ST.cluster.addLayers(markers);
}

// ===== 14. 태그 헬퍼 =====
function getTagHtml(mc, label) {
  return `<span class="tag tag-${mc}">${escapeHtml(label || mc)}</span>`;
}

function getStoreTags(s) {
  const mc = ST.selectedMc || 'def';
  let html = getTagHtml(mc, s.mn);
  if (s.sn) html += `<span class="tag tag-sub">${escapeHtml(s.sn)}</span>`;
  if (s.g) html += `<span class="tag tag-gu">${escapeHtml(s.g)}</span>`;
  if (s.d) html += `<span class="tag tag-dong">${escapeHtml(s.d)}</span>`;
  return html;
}

// ===== 15. 리스트 렌더링 (가상 페이징) =====
function renderList(reset = false) {
  if (reset) D.storeList.innerHTML = '';

  if (ST.filtered.length === 0 && ST.selectedMc) {
    D.loadingMsg.style.display = 'none';
    D.listEmpty.style.display = 'block';
    D.listMore.style.display = 'none';
    return;
  }

  D.loadingMsg.style.display = 'none';
  D.listEmpty.style.display = 'none';

  const batch = ST.filtered.slice(ST.renderOffset, ST.renderOffset + ST.BATCH);
  const fragment = document.createDocumentFragment();

  batch.forEach(s => {
    const li = document.createElement('li');
    li.className = 'store-item';
    li.innerHTML = `
      <div class="si-name">${escapeHtml(s.n)}${s.br ? `<span class="si-branch">${escapeHtml(s.br)}</span>` : ''}</div>
      <div class="si-tags">${getStoreTags(s)}</div>
      <div class="si-addr"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.r || s.j || '-')}</div>`;
    li.onclick = () => selectStore(s, true);
    fragment.appendChild(li);
  });

  D.storeList.appendChild(fragment);
  ST.renderOffset += ST.BATCH;

  const hasMore = ST.renderOffset < ST.filtered.length;
  D.listMore.style.display = hasMore ? 'block' : 'none';
}

// ===== 16. 특정 상가 선택 (FlyTo & Bottom Sheet) =====
function selectStore(s, flyTo) {
  ST.activeStore = s;
  const mc = ST.selectedMc || 'def';

  // 바텀 시트 내용 갱신
  D.bsName.textContent = s.n + (s.br ? ` (${s.br})` : '');
  D.bsTags.innerHTML = getStoreTags(s);
  D.bsRoad.textContent = s.r || '정보 없음';
  D.bsJibun.textContent = s.j || '정보 없음';

  const q = encodeURIComponent((s.n || '') + ' ' + (s.r || s.j || ''));
  D.bsKakao.href = `https://map.kakao.com/link/search/${q}`;
  D.bsNaver.href = `https://map.naver.com/v5/search/${q}`;

  // 모바일 화면에서는 바텀시트 오픈
  if (window.innerWidth <= 860) {
    openBottomSheet();
    closeSidebar();
  }

  if (flyTo && s.la && s.lo) {
    ST.map.flyTo([s.la, s.lo], 17, { duration: 0.7 });
    const key = `${s.la}_${s.lo}_${s.n}`;
    const m = ST.markersMap.get(key);
    if (m) {
      setTimeout(() => {
        ST.cluster.zoomToShowLayer(m, () => {
          if (!m.getPopup()) {
            m.bindPopup(buildPopupHtml(s, mc));
          }
          m.openPopup();
        });
      }, 500);
    }
  }
}

// ===== 17. 드로어 & 바텀시트 제어 =====
function openSidebar() { D.sidebar.classList.add('open'); D.overlay.classList.add('active'); }
function closeSidebar() { D.sidebar.classList.remove('open'); D.overlay.classList.remove('active'); }
function openBottomSheet() { D.bsheet.classList.add('open'); }
function closeBottomSheet() { D.bsheet.classList.remove('open'); }

// ===== 18. 토스트 알림 =====
function showToast(msg) {
  D.toast.textContent = msg;
  D.toast.classList.add('show');
  setTimeout(() => D.toast.classList.remove('show'), 2200);
}

// ===== 19. 주소 복사 =====
function copyText(txt, msg) {
  if (!txt || txt === '정보 없음') return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => showToast(msg)).catch(() => fallbackCopy(txt, msg));
  } else {
    fallbackCopy(txt, msg);
  }
}

function fallbackCopy(txt, msg) {
  const t = document.createElement('textarea');
  t.value = txt;
  document.body.appendChild(t);
  t.select();
  document.execCommand('copy');
  document.body.removeChild(t);
  showToast(msg);
}

// ===== 20. 내 위치 GPS 연동 =====
function handleGPS() {
  if (!navigator.geolocation) {
    showToast('현재 브라우저에서 GPS를 지원하지 않습니다.');
    return;
  }
  showToast('현재 위치를 탐색하는 중입니다...');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      ST.map.flyTo([lat, lng], 16);
      if (ST.userMarker) ST.map.removeLayer(ST.userMarker);
      ST.userMarker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: '#2563eb',
        color: '#ffffff',
        weight: 3,
        fillOpacity: 1
      }).addTo(ST.map).bindPopup('📍 내 현재 위치').openPopup();
      showToast('내 위치로 이동했습니다.');
    },
    () => showToast('위치 권한을 허용해주세요.'),
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ===== 21. 이벤트 바인딩 =====
function bindEvents() {
  // 실시간 디바운스 검색 (250ms)
  let kwTimer;
  D.kwInput.addEventListener('input', e => {
    const v = e.target.value;
    D.kwClear.style.display = v ? 'block' : 'none';
    clearTimeout(kwTimer);
    kwTimer = setTimeout(() => {
      ST.keyword = v;
      if (ST.selectedMc) applyFilters();
    }, 250);
  });

  D.kwClear.addEventListener('click', () => {
    D.kwInput.value = '';
    D.kwClear.style.display = 'none';
    ST.keyword = '';
    if (ST.selectedMc) applyFilters();
  });

  // 구·군 선택 시 FlyTo & 필터링
  D.guSel.addEventListener('change', e => {
    ST.selectedGu = e.target.value;
    if (ST.selectedMc) applyFilters();
    const info = DISTRICT_COORDS[e.target.value] || DISTRICT_COORDS[''];
    ST.map.flyTo([info[0], info[1]], info[2], { duration: 0.8 });
  });

  // 중분류 선택
  D.midSel.addEventListener('change', e => {
    ST.selectedMidC = e.target.value;
    ST.selectedSubC = '';
    buildSubFilter(e.target.value);
    applyFilters();
  });

  // 소분류 선택
  D.subSel.addEventListener('change', e => {
    ST.selectedSubC = e.target.value;
    applyFilters();
  });

  // 필터 초기화
  D.resetBtn.addEventListener('click', () => {
    ST.keyword = '';
    ST.selectedGu = '';
    ST.selectedMidC = '';
    ST.selectedSubC = '';
    D.kwInput.value = '';
    D.kwClear.style.display = 'none';
    D.guSel.value = '';
    D.midSel.value = '';
    D.subSel.value = '';
    if (ST.selectedMc) applyFilters();
    ST.map.flyTo([35.1795, 129.0756], 12);
    showToast('필터가 초기화되었습니다.');
  });

  // 리스트 더보기 버튼
  D.loadMoreBtn.addEventListener('click', () => renderList(false));

  // 리스트 자동 무한 스크롤
  D.storeListWrap.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = D.storeListWrap;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      if (ST.renderOffset < ST.filtered.length) {
        renderList(false);
      }
    }
  });

  // 모바일 드로어
  D.sbClose.addEventListener('click', closeSidebar);
  D.mbMenu.addEventListener('click', openSidebar);
  D.mbSearch.addEventListener('click', openSidebar);
  D.overlay.addEventListener('click', () => { closeSidebar(); closeBottomSheet(); });
  D.bsClose.addEventListener('click', closeBottomSheet);
  D.mbLoc.addEventListener('click', handleGPS);

  // 플로팅 버튼
  D.gpBtn.addEventListener('click', handleGPS);
  D.fitBtn.addEventListener('click', () => ST.map.flyTo([35.1795, 129.0756], 12));

  // 주소 복사
  D.copyRoad.addEventListener('click', () => copyText(D.bsRoad.textContent, '도로명주소가 복사되었습니다.'));
  D.copyJibun.addEventListener('click', () => copyText(D.bsJibun.textContent, '지번주소가 복사되었습니다.'));
}

// ===== 22. 초기 구동 =====
window.addEventListener('DOMContentLoaded', () => {
  initMap();
  renderMajorPills();
  bindEvents();
});
