/**
 * 부산 편의점 상권 지도 Application Logic (app.js)
 * OpenStreetMap + Leaflet + MarkerCluster 기반 인터랙티브 상권 지도
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

// Application State
const state = {
  stores: [],             // All loaded store items
  filteredStores: [],     // Stores matching current filters
  selectedGu: "ALL",      // Selected district
  selectedBrands: new Set(["CU", "GS25", "SEVEN", "EMART24", "OTHER"]),
  searchKeyword: "",
  activeStore: null,      // Currently selected store
  map: null,
  clusterGroup: null,
  markersMap: new Map(),  // store.id -> Leaflet Marker
  renderedListCount: 50,  // Batched list rendering for high performance
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
  brandPills: document.querySelectorAll('.brand-pill'),
  selectAllBrandsBtn: document.getElementById('select-all-brands-btn'),
  resetFilterBtn: document.getElementById('reset-filter-btn'),
  totalCount: document.getElementById('total-count'),
  storeList: document.getElementById('store-list'),
  emptyState: document.getElementById('empty-state'),
  countCU: document.getElementById('count-cu'),
  countGS25: document.getElementById('count-gs25'),
  countSeven: document.getElementById('count-seven'),
  countEmart: document.getElementById('count-emart24'),
  countOther: document.getElementById('count-other'),
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
  applyFilters();
});

/**
 * 1. Initialize Dataset
 */
function initData() {
  if (typeof STORES_DATA !== 'undefined' && Array.isArray(STORES_DATA)) {
    state.stores = STORES_DATA;
    updateBrandCounts(state.stores);
  } else {
    console.error("STORES_DATA is not loaded. Please ensure data.js is included.");
  }
}

/**
 * Update brand counter badges in filter buttons
 */
function updateBrandCounts(storeList) {
  let cu = 0, gs = 0, seven = 0, emart = 0, other = 0;
  for (const s of storeList) {
    if (s.brand === 'CU') cu++;
    else if (s.brand === 'GS25') gs++;
    else if (s.brand === 'SEVEN') seven++;
    else if (s.brand === 'EMART24') emart++;
    else other++;
  }
  if (DOM.countCU) DOM.countCU.textContent = cu.toLocaleString();
  if (DOM.countGS25) DOM.countGS25.textContent = gs.toLocaleString();
  if (DOM.countSeven) DOM.countSeven.textContent = seven.toLocaleString();
  if (DOM.countEmart) DOM.countEmart.textContent = emart.toLocaleString();
  if (DOM.countOther) DOM.countOther.textContent = other.toLocaleString();
}

/**
 * 2. Initialize Leaflet Map
 */
function initMap() {
  // Center on Busan City Hall
  const defaultPos = BUSAN_DISTRICT_COORDS["ALL"].center;
  const defaultZoom = BUSAN_DISTRICT_COORDS["ALL"].zoom;

  state.map = L.map('map', {
    zoomControl: false,
    tap: true
  }).setView(defaultPos, defaultZoom);

  // 1. 국토교통부 VWorld 기본 지도 (국내 최적화, 한글 완벽, API키 불필요, 403 없음)
  const vworldBase = L.tileLayer('https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.vworld.kr/">VWorld</a> 국토교통부 공간정보',
    minZoom: 6,
    maxZoom: 19
  });

  // 2. Esri World Street Map (글로벌 표준 상세 지도, 워터마크 없음)
  const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
    maxZoom: 19
  });

  // 3. OpenStreetMap Humanitarian (HOT)
  const osmHot = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });

  // 기본 레이어로 VWorld 적용
  vworldBase.addTo(state.map);

  // 지도 우측 상단 레이어 전환 컨트롤 추가
  L.control.layers({
    "국토교통부 표준지도 (VWorld)": vworldBase,
    "상세 거리 지도 (Esri)": esriStreet,
    "오픈스트리트맵 (OSM HOT)": osmHot
  }, null, { position: 'topright' }).addTo(state.map);

  // Zoom control on desktop top-right
  L.control.zoom({ position: 'topright' }).addTo(state.map);

  // Initialize MarkerClusterGroup
  state.clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 17
  });

  state.map.addLayer(state.clusterGroup);
}

/**
 * 3. Create Custom Leaflet Marker Icon per Brand
 */
function createStoreIcon(brand) {
  const pinClass = `pin-${brand.toLowerCase()}`;
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="custom-pin ${pinClass}"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
}

/**
 * Generate Store Tags HTML: 1. 브랜드 2. 지점명 3. 시군구명/행정동명 (# 문자 제거)
 */
function getStoreTagsHtml(store) {
  const classMap = {
    'CU': 'tag-cu',
    'GS25': 'tag-gs25',
    'SEVEN': 'tag-seven',
    'EMART24': 'tag-emart24',
    'OTHER': 'tag-other'
  };
  const cssClass = classMap[store.brand] || 'tag-other';
  const brandLabel = store.brand === 'OTHER' ? '개인·기타' : store.brandName;

  // 1. 브랜드 태그
  let html = `<span class="hashtag ${cssClass}">${brandLabel}</span>`;

  // 2. 지점명 태그 (지점명이 존재할 경우)
  if (store.branch && store.branch.trim()) {
    html += `<span class="hashtag tag-branch">${store.branch.trim()}</span>`;
  }

  // 3. 시군구명 / 행정동명 태그
  if (store.gu) {
    html += `<span class="hashtag tag-gu">${store.gu}</span>`;
  }
  if (store.dong) {
    html += `<span class="hashtag tag-dong">${store.dong}</span>`;
  }

  return html;
}

/**
 * 선택된 브랜드에 따라 고채도 파스텔 그라데이션 배경을 동적으로 생성
 * (개인·기타는 다중 브랜드 선택 시 채도 저하 방지를 위해 제외)
 */
function updateDynamicBackground(brandsSet, containerEl) {
  if (!containerEl) return;

  // 고채도 파스텔 컬러 팔레트 (불투명도 12~15%로 채도를 선명하게 유지)
  const brandColors = {
    'CU': 'rgba(147, 51, 234, 0.13)',      // 선명한 바이올렛 퍼플
    'GS25': 'rgba(14, 165, 233, 0.13)',     // 청량한 스카이 블루
    'SEVEN': 'rgba(16, 185, 129, 0.13)',    // 산뜻한 에메랄드 그린
    'EMART24': 'rgba(245, 158, 11, 0.15)'   // 화사한 앰버 옐로우
  };

  const majorBrands = ['CU', 'GS25', 'SEVEN', 'EMART24'];
  const activeMajor = majorBrands.filter(b => brandsSet.has(b));

  if (activeMajor.length === 0) {
    if (brandsSet.has('OTHER')) {
      containerEl.style.background = 'rgba(100, 116, 139, 0.09)';
    } else {
      containerEl.style.background = '#f8fafc';
    }
    return;
  }

  if (activeMajor.length === 1) {
    // 단일 브랜드 선택 시
    containerEl.style.background = brandColors[activeMajor[0]];
  } else {
    // 여러 브랜드 선택 시: 색상들이 선명하게 블렌딩되는 135도 그라데이션 생성
    const stops = activeMajor.map((b, idx) => {
      const pct = Math.round((idx / (activeMajor.length - 1)) * 100);
      return `${brandColors[b]} ${pct}%`;
    }).join(', ');
    containerEl.style.background = `linear-gradient(135deg, ${stops})`;
  }
}

/**
 * 4. Filter Logic
 */
function applyFilters(resetView = false) {
  const keyword = state.searchKeyword.trim().toLowerCase();
  const gu = state.selectedGu;

  state.filteredStores = state.stores.filter(store => {
    // Gu Filter
    if (gu !== "ALL" && store.gu !== gu) {
      return false;
    }
    // Brand Filter
    if (!state.selectedBrands.has(store.brand)) {
      return false;
    }
    // Comprehensive Search (상호명, 지점명, 시군구, 동, 법정동, 도로명, 지번)
    if (keyword) {
      const matchName = store.name && store.name.toLowerCase().includes(keyword);
      const matchBranch = store.branch && store.branch.toLowerCase().includes(keyword);
      const matchGu = store.gu && store.gu.toLowerCase().includes(keyword);
      const matchDong = store.dong && store.dong.toLowerCase().includes(keyword);
      const matchBDong = store.bDong && store.bDong.toLowerCase().includes(keyword);
      const matchRoad = store.road && store.road.toLowerCase().includes(keyword);
      const matchJibun = store.jibun && store.jibun.toLowerCase().includes(keyword);
      if (!matchName && !matchBranch && !matchGu && !matchDong && !matchBDong && !matchRoad && !matchJibun) {
        return false;
      }
    }
    return true;
  });

  // 선택된 브랜드 조합에 따라 고채도 파스텔 그라데이션 배경 적용
  const listContainer = document.querySelector('.store-list-container');
  if (listContainer) {
    updateDynamicBackground(state.selectedBrands, listContainer);
  }

  // Update counters
  const total = state.filteredStores.length;
  DOM.totalCount.textContent = total.toLocaleString();
  if (DOM.mobileListCount) DOM.mobileListCount.textContent = total.toLocaleString();

  // Render Markers on Map
  renderMarkers();

  // Render List View in Sidebar
  state.renderedListCount = 50;
  renderStoreList();

  // Move view if district changed
  if (resetView) {
    const target = BUSAN_DISTRICT_COORDS[gu] || BUSAN_DISTRICT_COORDS["ALL"];
    state.map.flyTo(target.center, target.zoom, { duration: 1.0 });
  }
}

/**
 * Render Cluster Markers on Map
 */
function renderMarkers() {
  state.clusterGroup.clearLayers();
  state.markersMap.clear();

  const newMarkers = [];

  state.filteredStores.forEach(store => {
    const icon = createStoreIcon(store.brand);
    const marker = L.marker([store.lat, store.lng], { icon: icon });

    // Custom Popup content for desktop
    const popupContent = `
      <div class="popup-container">
        <div class="popup-title">
          ${store.name}
        </div>
        <div class="popup-tags">
          ${getStoreTagsHtml(store)}
        </div>
        <div class="popup-addr">
          <i class="fa-solid fa-location-dot"></i>
          ${store.road || store.jibun}
        </div>
        <div class="popup-links">
          <a href="https://map.kakao.com/link/search/${encodeURIComponent(store.name + ' ' + (store.road || ''))}" 
             target="_blank" rel="noopener noreferrer" class="popup-link-btn kakao">
            카카오맵
          </a>
          <a href="https://map.naver.com/v5/search/${encodeURIComponent(store.name + ' ' + (store.road || ''))}" 
             target="_blank" rel="noopener noreferrer" class="popup-link-btn naver">
            네이버 지도
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 300, className: 'custom-leaflet-popup' });

    marker.on('click', () => {
      onSelectStore(store, false);
    });

    state.markersMap.set(store.id, marker);
    newMarkers.push(marker);
  });

  state.clusterGroup.addLayers(newMarkers);
}

/**
 * Render Store List in Sidebar
 */
function renderStoreList() {
  DOM.storeList.innerHTML = '';

  if (state.filteredStores.length === 0) {
    DOM.emptyState.style.display = 'block';
    return;
  }
  DOM.emptyState.style.display = 'none';

  const slice = state.filteredStores.slice(0, state.renderedListCount);

  slice.forEach(store => {
    const li = document.createElement('li');
    li.className = `store-item ${state.activeStore && state.activeStore.id === store.id ? 'selected' : ''}`;
    li.id = `item-${store.id}`;

    li.innerHTML = `
      <div class="store-item-header">
        <span class="store-item-name">${store.name}</span>
      </div>
      <div class="store-item-tags">
        ${getStoreTagsHtml(store)}
      </div>
      <div class="store-item-addr">
        ${store.road || store.jibun}
      </div>
    `;

    li.addEventListener('click', () => {
      onSelectStore(store, true);
    });

    DOM.storeList.appendChild(li);
  });
}

/**
 * Handle Store Selection (via List Click or Marker Click)
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

  // Populate Bottom Sheet details for mobile
  DOM.sheetStoreName.textContent = store.name;
  DOM.sheetHashtags.innerHTML = getStoreTagsHtml(store);
  DOM.sheetRoadAddr.textContent = store.road || '정보 없음';
  DOM.sheetJibunAddr.textContent = store.jibun || '정보 없음';

  const query = encodeURIComponent(`${store.name} ${store.road || store.jibun}`);
  DOM.kakaoMapBtn.href = `https://map.kakao.com/link/search/${query}`;
  DOM.naverMapBtn.href = `https://map.naver.com/v5/search/${query}`;

  // If Mobile, open Bottom Sheet
  if (window.innerWidth <= 900) {
    openBottomSheet();
    closeSidebar();
  }

  // Move Map View & Open Marker
  if (shouldFly) {
    state.map.flyTo([store.lat, store.lng], 16, { duration: 0.8 });
    const marker = state.markersMap.get(store.id);
    if (marker) {
      setTimeout(() => {
        state.clusterGroup.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      }, 500);
    }
  }
}

/**
 * 5. Bind User Interactions
 */
function bindEvents() {
  // Keyword Input
  let debounceTimer;
  DOM.keywordInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value;
    DOM.clearSearchBtn.style.display = val ? 'block' : 'none';
    debounceTimer = setTimeout(() => {
      state.searchKeyword = val;
      applyFilters();
    }, 200);
  });

  DOM.clearSearchBtn.addEventListener('click', () => {
    DOM.keywordInput.value = '';
    DOM.clearSearchBtn.style.display = 'none';
    state.searchKeyword = '';
    applyFilters();
  });

  // Region (Gu) Select
  DOM.regionSelect.addEventListener('change', (e) => {
    state.selectedGu = e.target.value;
    applyFilters(true);
  });

  // Brand Filter Pills
  DOM.brandPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const brand = pill.dataset.brand;
      if (state.selectedBrands.has(brand)) {
        if (state.selectedBrands.size > 1) {
          state.selectedBrands.delete(brand);
          pill.classList.remove('active');
        } else {
          showToast('최소 1개 이상의 브랜드를 선택해야 합니다.');
          return;
        }
      } else {
        state.selectedBrands.add(brand);
        pill.classList.add('active');
      }
      applyFilters();
    });
  });

  // Select All Brands
  DOM.selectAllBrandsBtn.addEventListener('click', () => {
    state.selectedBrands = new Set(["CU", "GS25", "SEVEN", "EMART24", "OTHER"]);
    DOM.brandPills.forEach(p => p.classList.add('active'));
    applyFilters();
  });

  // Reset Filters
  DOM.resetFilterBtn.addEventListener('click', () => {
    DOM.keywordInput.value = '';
    DOM.clearSearchBtn.style.display = 'none';
    state.searchKeyword = '';
    state.selectedGu = 'ALL';
    DOM.regionSelect.value = 'ALL';
    state.selectedBrands = new Set(["CU", "GS25", "SEVEN", "EMART24", "OTHER"]);
    DOM.brandPills.forEach(p => p.classList.add('active'));
    applyFilters(true);
  });

  // Infinite Scroll for Store List Container
  const listContainer = document.querySelector('.store-list-container');
  listContainer.addEventListener('scroll', () => {
    if (listContainer.scrollTop + listContainer.clientHeight >= listContainer.scrollHeight - 50) {
      if (state.renderedListCount < state.filteredStores.length) {
        state.renderedListCount += 40;
        renderStoreList();
      }
    }
  });

  // Copy Address Buttons
  DOM.copyRoadBtn.addEventListener('click', () => {
    copyToClipboard(DOM.sheetRoadAddr.textContent, '도로명주소가 복사되었습니다.');
  });
  DOM.copyJibunBtn.addEventListener('click', () => {
    copyToClipboard(DOM.sheetJibunAddr.textContent, '지번주소가 복사되었습니다.');
  });

  // Mobile Drawer Controls
  if (DOM.mobileMenuBtn) DOM.mobileMenuBtn.addEventListener('click', openSidebar);
  if (DOM.mobileSearchTrigger) DOM.mobileSearchTrigger.addEventListener('click', openSidebar);
  if (DOM.toggleListBtn) DOM.toggleListBtn.addEventListener('click', openSidebar);
  if (DOM.sidebarCloseBtn) DOM.sidebarCloseBtn.addEventListener('click', closeSidebar);
  if (DOM.overlayBackdrop) DOM.overlayBackdrop.addEventListener('click', () => {
    closeSidebar();
    closeBottomSheet();
  });
  if (DOM.sheetCloseBtn) DOM.sheetCloseBtn.addEventListener('click', closeBottomSheet);

  // GPS My Location Button
  DOM.gpsBtn.addEventListener('click', handleGPS);
  if (DOM.mobileLocationBtn) DOM.mobileLocationBtn.addEventListener('click', handleGPS);

  // Reset View Button
  DOM.resetViewBtn.addEventListener('click', () => {
    const target = BUSAN_DISTRICT_COORDS["ALL"];
    state.map.flyTo(target.center, target.zoom, { duration: 1.0 });
  });
}

/**
 * Mobile Navigation Drawer Controls
 */
function openSidebar() {
  DOM.sidebar.classList.add('open');
  DOM.overlayBackdrop.classList.add('active');
  closeBottomSheet();
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

/**
 * GPS Location Handler
 */
function handleGPS() {
  if (!navigator.geolocation) {
    showToast('GPS 위치 기능을 지원하지 않는 브라우저입니다.');
    return;
  }
  showToast('현재 위치를 확인 중입니다...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      state.map.flyTo([latitude, longitude], 16, { duration: 1.2 });

      if (state.userMarker) {
        state.map.removeLayer(state.userMarker);
      }
      state.userMarker = L.circleMarker([latitude, longitude], {
        radius: 8,
        fillColor: '#2563eb',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(state.map).bindPopup('현재 위치').openPopup();

      showToast('현재 위치로 이동했습니다.');
    },
    (err) => {
      showToast('위치 정보를 가져올 수 없습니다. 위치 권한을 확인해주세요.');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

/**
 * Copy to Clipboard Helper
 */
function copyToClipboard(text, successMsg) {
  if (!text || text === '-') return;
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg);
  }).catch(() => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast(successMsg);
  });
}

/**
 * Toast Notification Trigger
 */
function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add('show');
  setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, 2200);
}
