/**
 * 부산 전체 상가 상권 지도 Application Logic (web2/app.js)
 * 155,103개 부산 전 업종 빅데이터 인터랙티브 지도
 */

// 부산 각 구·군 중심 좌표
const BUSAN_DISTRICT_COORDS = {
  "ALL": { center: [35.1795543, 129.0756416], zoom: 12 },
  "해운대구": { center: [35.1631, 129.1636], zoom: 14 },
  "부산진구": { center: [35.1630, 129.0531], zoom: 14 },
  "동래구": { center: [35.2048, 129.0838], zoom: 14 },
  "남구": { center: [35.1365, 129.0842], zoom: 14 },
  "북구": { center: [35.1972, 128.9898], zoom: 14 },
  "사하구": { center: [35.1044, 128.9750], zoom: 14 },
  "금정구": { center: [35.2430, 129.0921], zoom: 14 },
  "강서구": { center: [35.2122, 128.9806], zoom: 13 },
  "연제구": { center: [35.1764, 129.0797], zoom: 14 },
  "수영구": { center: [35.1456, 129.1132], zoom: 14 },
  "사상구": { center: [35.1526, 128.9913], zoom: 14 },
  "기장군": { center: [35.2446, 129.2223], zoom: 13 },
  "중구": { center: [35.1062, 129.0324], zoom: 15 },
  "동구": { center: [35.1293, 129.0454], zoom: 15 },
  "영도구": { center: [35.0912, 129.0679], zoom: 14 },
  "서구": { center: [35.0979, 129.0243], zoom: 14 }
};

// 10대 대분류 정의
const ALL_CAT_CODES = ["I2", "G2", "S2", "M1", "P1", "L1", "R1", "N1", "I1", "Q1"];

// 동적 그라데이션용 파스텔 컬러 팔레트 (불투명도 12~15% 고채도 파스텔)
const CAT_GRADIENT_COLORS = {
  'I2': 'rgba(249, 115, 22, 0.14)',   // 음식 (오렌지)
  'G2': 'rgba(99, 102, 241, 0.14)',   // 소매 (인디고)
  'S2': 'rgba(8, 145, 178, 0.14)',    // 수리·개인 (시안)
  'M1': 'rgba(139, 92, 246, 0.14)',   // 과학·기술 (바이올렛)
  'P1': 'rgba(16, 185, 129, 0.14)',   // 교육 (에메랄드)
  'L1': 'rgba(217, 119, 6, 0.14)',    // 부동산 (앰버)
  'R1': 'rgba(236, 72, 153, 0.14)',   // 예술·스포츠 (핑크)
  'N1': 'rgba(100, 116, 139, 0.12)',  // 시설관리 (슬레이트)
  'I1': 'rgba(14, 165, 233, 0.14)',   // 숙박 (스카이블루)
  'Q1': 'rgba(220, 38, 38, 0.15)',    // 보건의료 (레드)
};

// 싱글톤 마커 아이콘 캐시 (메모리 절약)
const PIN_ICON_CACHE = {};
function getCategoryPinIcon(catCode) {
  if (!PIN_ICON_CACHE[catCode]) {
    PIN_ICON_CACHE[catCode] = L.divIcon({
      className: 'custom-pin-wrapper',
      html: `<div class="custom-pin pin-${catCode}"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24]
    });
  }
  return PIN_ICON_CACHE[catCode];
}

// Application State
const state = {
  stores: [],              // 155,103 전체 상가 데이터
  filteredStores: [],      // 필터링 적용된 상가 목록
  selectedGu: "ALL",       // 선택된 구·군
  selectedCats: new Set(ALL_CAT_CODES), // 초기에는 10대 대분류 모두 선택
  selectedMid: "ALL",      // 세부 중분류
  searchKeyword: "",       // 검색 키워드
  activeStore: null,       // 현재 선택된 상가
  map: null,
  clusterGroup: null,
  markersMap: new Map(),   // store.id -> L.Marker
  renderedListCount: 50,   // 리스트 가상 스크롤 배치 단위
  userMarker: null
};

// DOM Elements
const DOM = {
  map: document.getElementById('map'),
  sidebar: document.getElementById('sidebar'),
  sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
  keywordInput: document.getElementById('keyword-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  regionSelect: document.getElementById('region-select'),
  catsPillsContainer: document.getElementById('cats-pills-container'),
  catPills: document.querySelectorAll('.brand-pill'),
  selectAllCatsBtn: document.getElementById('select-all-cats-btn'),
  midFilterGroup: document.getElementById('mid-filter-group'),
  midSelect: document.getElementById('mid-select'),
  resetFilterBtn: document.getElementById('reset-filter-btn'),
  totalCount: document.getElementById('total-count'),
  storeListContainer: document.getElementById('store-list-container'),
  storeList: document.getElementById('store-list'),
  emptyState: document.getElementById('empty-state'),

  // Mobile Top Bar & Controls
  mobileTopBar: document.getElementById('mobile-top-bar'),
  mobileSearchTrigger: document.getElementById('mobile-search-trigger'),
  mobileMenuBtn: document.getElementById('mobile-menu-btn'),
  mobileLocationBtn: document.getElementById('mobile-location-btn'),
  mobileListCount: document.getElementById('mobile-list-count'),
  toggleListBtn: document.getElementById('toggle-list-btn'),
  bottomSheet: document.getElementById('bottom-sheet'),
  sheetCloseBtn: document.getElementById('sheet-close-btn'),
  overlayBackdrop: document.getElementById('overlay-backdrop'),
  gpsBtn: document.getElementById('gps-btn'),
  resetViewBtn: document.getElementById('reset-view-btn'),
  toast: document.getElementById('toast'),
  
  // Sheet Detail Elements
  sheetStoreName: document.getElementById('sheet-store-name'),
  sheetHashtags: document.getElementById('sheet-hashtags'),
  sheetRoadAddr: document.getElementById('sheet-road-addr'),
  sheetJibunAddr: document.getElementById('sheet-jibun-addr'),
  copyRoadBtn: document.getElementById('copy-road-btn'),
  copyJibunBtn: document.getElementById('copy-jibun-btn'),
  kakaoMapBtn: document.getElementById('kakao-map-btn'),
  naverMapBtn: document.getElementById('naver-map-btn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initData();
  initMap();
  bindEvents();
  applyFilters(true); // 페이지 열자마자 스크린샷 2처럼 지도에 클러스터와 마커들을 즉시 표시!
});

/**
 * 1. Initialize Dataset & Counter Badges
 */
function initData() {
  if (typeof STORES_DATA !== 'undefined' && Array.isArray(STORES_DATA)) {
    state.stores = STORES_DATA;
    updateCategoryCounts(state.stores);
  } else {
    console.error("STORES_DATA is not loaded. Please ensure data_busan.js is included.");
    if (DOM.emptyState) {
      DOM.emptyState.style.display = 'block';
      DOM.emptyState.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><p>데이터 로딩 실패</p><small>data_busan.js 파일을 확인해주세요.</small>';
    }
  }
}

/**
 * Update category counter badges on buttons
 */
function updateCategoryCounts(storeList) {
  const counts = {};
  ALL_CAT_CODES.forEach(c => counts[c] = 0);

  for (let i = 0; i < storeList.length; i++) {
    const s = storeList[i];
    if (counts[s.cat] !== undefined) {
      counts[s.cat]++;
    }
  }

  ALL_CAT_CODES.forEach(c => {
    const el = document.getElementById(`count-${c}`);
    if (el) {
      el.textContent = counts[c].toLocaleString();
    }
  });
}

/**
 * 2. Initialize Leaflet Map (Using Stable CartoDB + VWorld Fallback)
 */
function initMap() {
  const defaultPos = BUSAN_DISTRICT_COORDS["ALL"].center;
  const defaultZoom = BUSAN_DISTRICT_COORDS["ALL"].zoom;

  state.map = L.map('map', {
    zoomControl: false,
    tap: true
  }).setView(defaultPos, defaultZoom);

  // 1. CartoDB Voyager: 100% 무료, 한국어 POI 완벽, CDN 가속, 사용량 한도 없음 (기본)
  const cartoVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abcd',
    maxZoom: 20
  });

  // 2. 국토교통부 VWorld 기본 지도 (선택 가능, 에러 시 fallback)
  const vworldBase = L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.vworld.kr/">VWorld</a> 국토교통부 공간정보',
    minZoom: 6,
    maxZoom: 19,
    errorTileUrl: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/12/3518/1638.png'
  });

  // 3. Esri World Street Map (글로벌 표준 상세 지도)
  const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
    maxZoom: 19
  });

  // 4. OpenStreetMap Humanitarian (HOT)
  const osmHot = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });

  // 기본 레이어로 국토교통부 VWorld 적용
  vworldBase.addTo(state.map);

  // 지도 우측 상단 레이어 전환 컨트롤 추가
  L.control.layers({
    "국토교통부 표준지도 (VWorld)": vworldBase,
    "모던 상세 지도 (CartoDB)": cartoVoyager,
    "상세 거리 지도 (Esri)": esriStreet,
    "오픈스트리트맵 (OSM HOT)": osmHot
  }, null, { position: 'topright' }).addTo(state.map);

  L.control.zoom({ position: 'topright' }).addTo(state.map);

  // 15.5만 대용량 마커 렌더링 시 브라우저 정지를 100% 방지하는 chunkedLoading 옵션 적용
  state.clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,      // 비동기 청크 렌더링 활성화 (UI 블로킹 방지)
    chunkInterval: 50,         // 50ms마다 렌더링
    chunkDelay: 10,            // 10ms 휴식 -> 브라우저 반응성 유지
    maxClusterRadius: 50,
    disableClusteringAtZoom: 18,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  });
  state.map.addLayer(state.clusterGroup);
}

/**
 * 3. Bind UI Events
 */
function bindEvents() {
  // Keyword Search Input (Debounced 250ms)
  let debounceTimer;
  DOM.keywordInput.addEventListener('input', (e) => {
    const val = e.target.value;
    DOM.clearSearchBtn.style.display = val ? 'block' : 'none';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchKeyword = val;
      applyFilters();
    }, 250);
  });

  DOM.clearSearchBtn.addEventListener('click', () => {
    DOM.keywordInput.value = '';
    DOM.clearSearchBtn.style.display = 'none';
    state.searchKeyword = '';
    applyFilters();
    DOM.keywordInput.focus();
  });

  // District (Gu) Select
  DOM.regionSelect.addEventListener('change', (e) => {
    state.selectedGu = e.target.value;
    applyFilters(true);
    
    const coordInfo = BUSAN_DISTRICT_COORDS[state.selectedGu] || BUSAN_DISTRICT_COORDS["ALL"];
    state.map.flyTo(coordInfo.center, coordInfo.zoom, { duration: 0.8 });
  });

  // Category Pills Toggle
  DOM.catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const cat = pill.dataset.cat;
      if (state.selectedCats.has(cat)) {
        state.selectedCats.delete(cat);
        pill.classList.remove('active');
      } else {
        state.selectedCats.add(cat);
        pill.classList.add('active');
      }

      // Update button text (전체선택 vs 전체해제)
      updateSelectAllButtonText();

      // Check single category selection for mid-category filter
      updateMidFilterVisibility();

      applyFilters();
    });
  });

  // Select/Deselect All Categories
  DOM.selectAllCatsBtn.addEventListener('click', () => {
    if (state.selectedCats.size === ALL_CAT_CODES.length) {
      // Deselect all
      state.selectedCats.clear();
      DOM.catPills.forEach(p => p.classList.remove('active'));
      DOM.selectAllCatsBtn.textContent = '전체선택';
    } else {
      // Select all
      ALL_CAT_CODES.forEach(c => state.selectedCats.add(c));
      DOM.catPills.forEach(p => p.classList.add('active'));
      DOM.selectAllCatsBtn.textContent = '전체해제';
    }
    updateMidFilterVisibility();
    applyFilters();
  });

  // Mid-Category Select
  if (DOM.midSelect) {
    DOM.midSelect.addEventListener('change', (e) => {
      state.selectedMid = e.target.value;
      applyFilters();
    });
  }

  // Reset Filters
  DOM.resetFilterBtn.addEventListener('click', () => {
    resetAllFilters();
  });

  // Floating GPS Button
  DOM.gpsBtn.addEventListener('click', () => {
    locateUser();
  });

  // Reset View to Busan Center
  DOM.resetViewBtn.addEventListener('click', () => {
    state.selectedGu = "ALL";
    DOM.regionSelect.value = "ALL";
    const defaultPos = BUSAN_DISTRICT_COORDS["ALL"].center;
    const defaultZoom = BUSAN_DISTRICT_COORDS["ALL"].zoom;
    state.map.flyTo(defaultPos, defaultZoom, { duration: 0.8 });
  });

  // Infinite Scroll in Store List
  DOM.storeListContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = DOM.storeListContainer;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      if (state.renderedListCount < state.filteredStores.length) {
        state.renderedListCount += 50;
        appendStoreList();
      }
    }
  });

  // Mobile Controls
  DOM.mobileMenuBtn.addEventListener('click', openSidebar);
  DOM.sidebarCloseBtn.addEventListener('click', closeSidebar);
  DOM.overlayBackdrop.addEventListener('click', () => {
    closeSidebar();
    closeBottomSheet();
  });
  DOM.mobileSearchTrigger.addEventListener('click', openSidebar);
  DOM.mobileLocationBtn.addEventListener('click', locateUser);
  DOM.toggleListBtn.addEventListener('click', openSidebar);
  DOM.sheetCloseBtn.addEventListener('click', closeBottomSheet);

  // Address Copy Buttons
  DOM.copyRoadBtn.addEventListener('click', () => {
    copyToClipboard(DOM.sheetRoadAddr.textContent, '도로명주소가 복사되었습니다.');
  });
  DOM.copyJibunBtn.addEventListener('click', () => {
    copyToClipboard(DOM.sheetJibunAddr.textContent, '지번주소가 복사되었습니다.');
  });
}

/**
 * Update Select All button text
 */
function updateSelectAllButtonText() {
  if (state.selectedCats.size === ALL_CAT_CODES.length) {
    DOM.selectAllCatsBtn.textContent = '전체해제';
  } else {
    DOM.selectAllCatsBtn.textContent = '전체선택';
  }
}

/**
 * Check if exactly one category is selected to show mid-category dropdown
 */
function updateMidFilterVisibility() {
  if (state.selectedCats.size === 1) {
    const singleCat = Array.from(state.selectedCats)[0];
    const mids = {};
    state.stores.forEach(s => {
      if (s.cat === singleCat && s.mid) {
        mids[s.mid] = s.midName;
      }
    });

    DOM.midSelect.innerHTML = '<option value="ALL">중분류 전체 (전체보기)</option>';
    Object.entries(mids).sort((a,b) => a[1].localeCompare(b[1])).forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = name;
      DOM.midSelect.appendChild(opt);
    });

    DOM.midFilterGroup.style.display = 'block';
  } else {
    DOM.midFilterGroup.style.display = 'none';
    state.selectedMid = "ALL";
    if (DOM.midSelect) DOM.midSelect.value = "ALL";
  }
}

/**
 * Reset all filters to default
 */
function resetAllFilters() {
  state.selectedGu = "ALL";
  DOM.regionSelect.value = "ALL";

  state.selectedCats = new Set(ALL_CAT_CODES);
  DOM.catPills.forEach(p => p.classList.add('active'));
  updateSelectAllButtonText();
  updateMidFilterVisibility();

  state.searchKeyword = "";
  DOM.keywordInput.value = "";
  DOM.clearSearchBtn.style.display = 'none';

  applyFilters(true);

  const defaultPos = BUSAN_DISTRICT_COORDS["ALL"].center;
  const defaultZoom = BUSAN_DISTRICT_COORDS["ALL"].zoom;
  state.map.flyTo(defaultPos, defaultZoom, { duration: 0.8 });
  showToast("필터가 초기화되었습니다.");
}

/**
 * 4. Dynamic Gradient Background Generator
 * 사용자가 선택한 대분류 조합에 따라 리스트 영역 배경에 고채도 멀티 그라데이션 실시간 블렌딩
 */
function updateDynamicBackground(catsSet, containerEl) {
  if (!containerEl) return;

  const activeCats = ALL_CAT_CODES.filter(c => catsSet.has(c));

  if (activeCats.length === 0) {
    containerEl.style.background = '#f8fafc';
    return;
  }

  if (activeCats.length === 1) {
    // 단일 업종 선택 시
    containerEl.style.background = CAT_GRADIENT_COLORS[activeCats[0]];
    return;
  }

  // 여러 업종 선택 시: 135도 대각선 그라데이션 생성
  const stops = activeCats.map((c, idx) => {
    const pct = Math.round((idx / (activeCats.length - 1)) * 100);
    return `${CAT_GRADIENT_COLORS[c]} ${pct}%`;
  }).join(', ');

  containerEl.style.background = `linear-gradient(135deg, ${stops})`;
}

/**
 * 5. Main Filter Logic
 */
function applyFilters(resetView = false) {
  const keyword = state.searchKeyword.trim().toLowerCase();
  const gu = state.selectedGu;
  const mid = state.selectedMid;

  state.filteredStores = state.stores.filter(store => {
    // Gu Filter
    if (gu !== "ALL" && store.gu !== gu) {
      return false;
    }
    // Category Filter
    if (!state.selectedCats.has(store.cat)) {
      return false;
    }
    // Mid Category Filter
    if (mid !== "ALL" && store.mid !== mid) {
      return false;
    }
    // Keyword Search
    if (keyword) {
      const matchName = store.name && store.name.toLowerCase().includes(keyword);
      const matchBranch = store.branch && store.branch.toLowerCase().includes(keyword);
      const matchCat = store.catName && store.catName.toLowerCase().includes(keyword);
      const matchMid = store.midName && store.midName.toLowerCase().includes(keyword);
      const matchSub = store.subName && store.subName.toLowerCase().includes(keyword);
      const matchGu = store.gu && store.gu.toLowerCase().includes(keyword);
      const matchDong = store.dong && store.dong.toLowerCase().includes(keyword);
      const matchBDong = store.bDong && store.bDong.toLowerCase().includes(keyword);
      const matchRoad = store.road && store.road.toLowerCase().includes(keyword);
      const matchJibun = store.jibun && store.jibun.toLowerCase().includes(keyword);

      if (!matchName && !matchBranch && !matchCat && !matchMid && !matchSub && !matchGu && !matchDong && !matchBDong && !matchRoad && !matchJibun) {
        return false;
      }
    }
    return true;
  });

  // UI Count
  DOM.totalCount.textContent = state.filteredStores.length.toLocaleString();
  if (DOM.mobileListCount) {
    DOM.mobileListCount.textContent = state.filteredStores.length.toLocaleString();
  }

  // 동적 그라데이션 적용
  updateDynamicBackground(state.selectedCats, DOM.storeListContainer);

  // Render Markers and List
  renderMarkers();
  state.renderedListCount = 50;
  renderStoreList();
}

/**
 * 6. Generate Store Tags HTML (대분류, 중분류/소분류, 시군구, 행정동)
 */
function getStoreTagsHtml(store) {
  let html = `<span class="hashtag tag-${store.cat}">${escapeHtml(store.catName || store.cat)}</span>`;

  if (store.subName) {
    html += `<span class="hashtag tag-sub">${escapeHtml(store.subName)}</span>`;
  } else if (store.midName) {
    html += `<span class="hashtag tag-sub">${escapeHtml(store.midName)}</span>`;
  }

  if (store.gu) {
    html += `<span class="hashtag tag-gu">${escapeHtml(store.gu)}</span>`;
  }
  if (store.dong) {
    html += `<span class="hashtag tag-dong">${escapeHtml(store.dong)}</span>`;
  }

  return html;
}

/**
 * 7. Build Lazy Popup HTML (메모리 절약)
 */
function buildPopupHtml(store) {
  const query = encodeURIComponent(`${store.name} ${store.road || store.jibun || ''}`);
  return `
    <div class="popup-container">
      <div class="popup-title">
        <i class="fa-solid fa-store" style="color:var(--primary-color);"></i>
        <span>${escapeHtml(store.name)}${store.branch ? `<span style="font-size:12px;color:#64748b;font-weight:400;margin-left:4px;">${escapeHtml(store.branch)}</span>` : ''}</span>
      </div>
      <div class="popup-tags">
        ${getStoreTagsHtml(store)}
      </div>
      <div class="popup-addr">
        <i class="fa-solid fa-location-dot"></i>
        ${escapeHtml(store.road || store.jibun || '주소 정보 없음')}
      </div>
      <div class="popup-links">
        <a href="https://map.kakao.com/link/search/${query}" target="_blank" rel="noopener noreferrer" class="popup-link-btn kakao">
          <i class="fa-solid fa-route"></i> 카카오맵
        </a>
        <a href="https://map.naver.com/v5/search/${query}" target="_blank" rel="noopener noreferrer" class="popup-link-btn naver">
          <i class="fa-solid fa-diamond-turn-right"></i> 네이버 지도
        </a>
      </div>
    </div>
  `;
}

/**
 * 8. Render Markers on Map (Chunked Loading & Lazy Popup)
 */
function renderMarkers() {
  state.clusterGroup.clearLayers();
  state.markersMap.clear();

  const newMarkers = [];
  const stores = state.filteredStores;
  const len = stores.length;

  for (let i = 0; i < len; i++) {
    const store = stores[i];
    if (!store.lat || !store.lng) continue;

    const icon = getCategoryPinIcon(store.cat);
    const marker = L.marker([store.lat, store.lng], { icon });

    // Lazy Popup: 마커 클릭 시점에 팝업 생성
    marker.on('click', () => {
      onSelectStore(store, false);
      if (!marker.getPopup()) {
        marker.bindPopup(buildPopupHtml(store), { maxWidth: 300, className: 'custom-leaflet-popup' }).openPopup();
      }
    });

    state.markersMap.set(store.id, marker);
    newMarkers.push(marker);
  }

  // chunkedLoading 활성화된 클러스터에 추가 -> 브라우저 정지 완전 방지
  state.clusterGroup.addLayers(newMarkers);
}

/**
 * 9. Render Store List in Sidebar
 */
function renderStoreList() {
  DOM.storeList.innerHTML = '';

  if (state.filteredStores.length === 0) {
    DOM.emptyState.style.display = 'block';
    return;
  }
  DOM.emptyState.style.display = 'none';

  appendStoreList();
}

function appendStoreList() {
  const currentCount = DOM.storeList.children.length;
  const slice = state.filteredStores.slice(currentCount, state.renderedListCount);
  const fragment = document.createDocumentFragment();

  slice.forEach(store => {
    const li = document.createElement('li');
    li.className = `store-item ${state.activeStore && state.activeStore.id === store.id ? 'selected' : ''}`;
    li.id = `item-${store.id}`;

    li.innerHTML = `
      <div class="store-item-header">
        <span class="store-item-name">${escapeHtml(store.name)}${store.branch ? `<span class="store-item-branch">${escapeHtml(store.branch)}</span>` : ''}</span>
      </div>
      <div class="store-item-tags">
        ${getStoreTagsHtml(store)}
      </div>
      <div class="store-item-addr">
        <i class="fa-solid fa-location-dot" style="margin-right:2px;color:#94a3b8;"></i> ${escapeHtml(store.road || store.jibun || '-')}
      </div>
    `;

    li.addEventListener('click', () => {
      onSelectStore(store, true);
    });

    fragment.appendChild(li);
  });

  DOM.storeList.appendChild(fragment);
}

/**
 * 10. Handle Store Selection
 */
function onSelectStore(store, shouldFly = true) {
  state.activeStore = store;

  // Highlight list item
  document.querySelectorAll('.store-item.selected').forEach(el => el.classList.remove('selected'));
  const activeLi = document.getElementById(`item-${store.id}`);
  if (activeLi) {
    activeLi.classList.add('selected');
    activeLi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Bottom Sheet
  DOM.sheetStoreName.textContent = store.name + (store.branch ? ` (${store.branch})` : '');
  DOM.sheetHashtags.innerHTML = getStoreTagsHtml(store);
  DOM.sheetRoadAddr.textContent = store.road || '정보 없음';
  DOM.sheetJibunAddr.textContent = store.jibun || '정보 없음';

  const query = encodeURIComponent(`${store.name} ${store.road || store.jibun || ''}`);
  DOM.kakaoMapBtn.href = `https://map.kakao.com/link/search/${query}`;
  DOM.naverMapBtn.href = `https://map.naver.com/v5/search/${query}`;

  if (window.innerWidth <= 900) {
    openBottomSheet();
    closeSidebar();
  }

  if (shouldFly && store.lat && store.lng) {
    state.map.flyTo([store.lat, store.lng], 17, { duration: 0.8 });
    const marker = state.markersMap.get(store.id);
    if (marker) {
      setTimeout(() => {
        state.clusterGroup.zoomToShowLayer(marker, () => {
          if (!marker.getPopup()) {
            marker.bindPopup(buildPopupHtml(store), { maxWidth: 300, className: 'custom-leaflet-popup' });
          }
          marker.openPopup();
        });
      }, 500);
    }
  }
}

/**
 * 11. GPS Geolocation
 */
function locateUser() {
  if (!navigator.geolocation) {
    showToast("GPS를 지원하지 않는 브라우저입니다.");
    return;
  }

  showToast("현재 위치를 확인하고 있습니다...");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      state.map.flyTo([latitude, longitude], 16);

      if (state.userMarker) {
        state.map.removeLayer(state.userMarker);
      }

      state.userMarker = L.circleMarker([latitude, longitude], {
        radius: 9,
        fillColor: '#2563eb',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1
      }).addTo(state.map);

      state.userMarker.bindPopup('📍 <strong>현재 위치</strong>').openPopup();
      showToast("현재 위치로 이동했습니다.");
    },
    () => {
      showToast("위치 정보를 가져올 수 없습니다. 브라우저 위치 권한을 확인해주세요.");
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/**
 * 12. Helpers: Drawer, BottomSheet, Toast, Clipboard
 */
function openSidebar() {
  DOM.sidebar.classList.add('open');
  DOM.overlayBackdrop.classList.add('active');
}

function closeSidebar() {
  DOM.sidebar.classList.remove('open');
  DOM.overlayBackdrop.classList.remove('active');
}

function openBottomSheet() {
  DOM.bottomSheet.classList.add('open');
}

function closeBottomSheet() {
  DOM.bottomSheet.classList.remove('open');
}

function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 2200);
}

function copyToClipboard(text, successMsg) {
  if (!text || text === '정보 없음') return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, msg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(msg);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}
