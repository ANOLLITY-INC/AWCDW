// ==================== 부산 1차 워크숍 안내 (버스/숙소/캠퍼스맵) ====================
// 개인정보 보호: 전화번호·학번은 의도적으로 제외(이름·소속·배정정보만 공개).
// 데이터 출처: "부산 숙소, 버스 이용 관련.xlsx" (2026-06 기준).

const BUSAN_ROOMS = [{"name": "황지민", "school": "경북대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "6"}, {"name": "홍찬민", "school": "경북대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "6"}, {"name": "임창현", "school": "명지대학교", "track": "디자인", "gender": "남", "dorm": "B", "room": "1"}, {"name": "장승원", "school": "명지대학교", "track": "공학", "gender": "남", "dorm": "B", "room": "2"}, {"name": "박현민", "school": "숭실대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "1"}, {"name": "조영유", "school": "숭실대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "1"}, {"name": "김태호", "school": "숭실대학교", "track": "공학", "gender": "남", "dorm": "B", "room": "3"}, {"name": "황세현", "school": "연세대학교 미래캠퍼스", "track": "디자인", "gender": "남", "dorm": "B", "room": "4"}, {"name": "홍지혁", "school": "연세대학교 미래캠퍼스", "track": "디자인", "gender": "남", "dorm": "A", "room": "2"}, {"name": "박준형", "school": "연세대학교 미래캠퍼스", "track": "디자인", "gender": "남", "dorm": "C", "room": "7"}, {"name": "이우철", "school": "연세대학교 미래캠퍼스", "track": "디자인", "gender": "남", "dorm": "C", "room": "8"}, {"name": "이시형", "school": "연세대학교 미래캠퍼스", "track": "디자인", "gender": "남", "dorm": "A", "room": "2"}, {"name": "여환철", "school": "인천대학교", "track": "공학", "gender": "남", "dorm": "B", "room": "5"}, {"name": "김성은", "school": "인천대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "4"}, {"name": "장정우", "school": "인천대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "4"}, {"name": "허지웅", "school": "인천대학교", "track": "공학", "gender": "남", "dorm": "B", "room": "6"}, {"name": "박준우", "school": "한국기술교육대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "3"}, {"name": "강남원", "school": "한국기술교육대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "3"}, {"name": "이하늘", "school": "한국기술교육대학교", "track": "디자인", "gender": "남", "dorm": "B", "room": "7"}, {"name": "정운영", "school": "한국기술교육대학교", "track": "디자인", "gender": "남", "dorm": "B", "room": "8"}, {"name": "박도현", "school": "한국기술교육대학교", "track": "디자인", "gender": "남", "dorm": "B", "room": "9"}, {"name": "최강", "school": "한국기술교육대학교", "track": "디자인", "gender": "남", "dorm": "B", "room": "10"}, {"name": "함대희", "school": "한국기술교육대학교", "track": "디자인", "gender": "남", "dorm": "B", "room": "11"}, {"name": "한영균", "school": "중앙대학교", "track": "디자인", "gender": "남", "dorm": "A", "room": "5"}, {"name": "김재준", "school": "중앙대학교", "track": "공학", "gender": "남", "dorm": "A", "room": "5"}, {"name": "조민재", "school": "홍익대학교", "track": "공학", "gender": "남", "dorm": "B", "room": "12"}, {"name": "서선진", "school": "명지대학교", "track": "공학", "gender": "여", "dorm": "A", "room": "7"}, {"name": "노현주", "school": "명지대학교", "track": "공학", "gender": "여", "dorm": "A", "room": "7"}, {"name": "김나연", "school": "명지대학교", "track": "디자인", "gender": "여", "dorm": "A", "room": "8"}, {"name": "명채은", "school": "명지대학교", "track": "공학", "gender": "여", "dorm": "C", "room": "1"}, {"name": "유서연", "school": "명지대학교", "track": "디자인", "gender": "여", "dorm": "A", "room": "8"}, {"name": "김산들", "school": "숭실대학교", "track": "공학", "gender": "여", "dorm": "C", "room": "2"}, {"name": "김은채", "school": "연세대학교 미래캠퍼스", "track": "디자인", "gender": "여", "dorm": "C", "room": "3"}, {"name": "유지연", "school": "한국기술교육대학교", "track": "공학", "gender": "여", "dorm": "C", "room": "4"}, {"name": "이선우", "school": "한국기술교육대학교", "track": "디자인", "gender": "여", "dorm": "C", "room": "5"}, {"name": "이민경", "school": "한국기술교육대학교", "track": "디자인", "gender": "여", "dorm": "C", "room": "6"}, {"name": "최보아", "school": "중앙대학교", "track": "디자인", "gender": "여", "dorm": "D", "room": "3"}, {"name": "김나임", "school": "중앙대학교", "track": "디자인", "gender": "여", "dorm": "D", "room": "2"}, {"name": "이정아", "school": "중앙대학교", "track": "공학", "gender": "여", "dorm": "D", "room": "1"}];
const BUSAN_BUS_S2B = [{"name": "황지민", "school": "경북대학교", "track": "공학"}, {"name": "노현주", "school": "명지대학교", "track": "공학"}, {"name": "임창현", "school": "명지대학교", "track": "디자인"}, {"name": "김나연", "school": "명지대학교", "track": "디자인"}, {"name": "장승원", "school": "명지대학교", "track": "공학"}, {"name": "김산들", "school": "숭실대학교", "track": "공학"}, {"name": "김태호", "school": "숭실대학교", "track": "공학"}, {"name": "박현민", "school": "숭실대학교", "track": "공학"}, {"name": "조영유", "school": "숭실대학교", "track": "공학"}, {"name": "박준형", "school": "연세대학교 미래캠퍼스", "track": "디자인"}, {"name": "황세현", "school": "연세대학교 미래캠퍼스", "track": "디자인"}, {"name": "김은채", "school": "연세대학교 미래캠퍼스", "track": "디자인"}, {"name": "여환철", "school": "인천대학교", "track": "공학"}, {"name": "김성은", "school": "인천대학교", "track": "공학"}, {"name": "장정우", "school": "인천대학교", "track": "공학"}, {"name": "허지웅", "school": "인천대학교", "track": "공학"}, {"name": "한영균", "school": "중앙대학교", "track": "디자인"}, {"name": "김나임", "school": "중앙대학교", "track": "디자인"}, {"name": "박도현", "school": "한국기술교육대학교", "track": "디자인"}, {"name": "조민재", "school": "홍익대학교", "track": "공학"}, {"name": "김재준", "school": "중앙대학교", "track": "공학"}];   // 서울 -> 부산 (06.24 출발)
const BUSAN_BUS_B2S = [{"name": "황지민", "school": "경북대학교", "track": "공학"}, {"name": "노현주", "school": "명지대학교", "track": "공학"}, {"name": "임창현", "school": "명지대학교", "track": "디자인"}, {"name": "장승원", "school": "명지대학교", "track": "공학"}, {"name": "김산들", "school": "숭실대학교", "track": "공학"}, {"name": "김태호", "school": "숭실대학교", "track": "공학"}, {"name": "조영유", "school": "숭실대학교", "track": "공학"}, {"name": "박준형", "school": "연세대학교 미래캠퍼스", "track": "디자인"}, {"name": "황세현", "school": "연세대학교 미래캠퍼스", "track": "디자인"}, {"name": "김은채", "school": "연세대학교 미래캠퍼스", "track": "디자인"}, {"name": "여환철", "school": "인천대학교", "track": "공학"}, {"name": "김성은", "school": "인천대학교", "track": "공학"}, {"name": "장정우", "school": "인천대학교", "track": "공학"}, {"name": "허지웅", "school": "인천대학교", "track": "공학"}, {"name": "한영균", "school": "중앙대학교", "track": "디자인"}, {"name": "김나임", "school": "중앙대학교", "track": "디자인"}, {"name": "박도현", "school": "한국기술교육대학교", "track": "디자인"}, {"name": "이선우", "school": "한국기술교육대학교", "track": "디자인"}, {"name": "조민재", "school": "홍익대학교", "track": "공학"}, {"name": "김재준", "school": "중앙대학교", "track": "공학"}, {"name": "조지운", "school": "중앙대학교", "track": "디자인"}, {"name": "최재원", "school": "부산대학교", "track": "공학"}, {"name": "허준우", "school": "부산대학교", "track": "공학"}, {"name": "송한규", "school": "부산대학교", "track": "공학"}, {"name": "서민재", "school": "부산대학교", "track": "공학"}, {"name": "조민우", "school": "부산대학교", "track": "공학"}, {"name": "김동빈", "school": "부산대학교", "track": "공학"}, {"name": "이상현", "school": "부산대학교", "track": "공학"}, {"name": "문광민", "school": "부산대학교", "track": "공학"}];   // 부산 -> 서울 (06.26 출발)
const BUSAN_ROOM_UNUSED = [{"name": "조지운", "school": "중앙대학교", "track": "디자인"}, {"name": "최재원", "school": "부산대학교", "track": "공학"}, {"name": "허준우", "school": "부산대학교", "track": "공학"}, {"name": "송한규", "school": "부산대학교", "track": "공학"}, {"name": "서민재", "school": "부산대학교", "track": "공학"}, {"name": "조민우", "school": "부산대학교", "track": "공학"}, {"name": "김동빈", "school": "부산대학교", "track": "공학"}, {"name": "이상현", "school": "부산대학교", "track": "공학"}, {"name": "문광민", "school": "부산대학교", "track": "공학"}]; // 숙소 미이용(현지 통학 등)

// 방 이니셜(숙소 구분) 설명 + 호텔
const BUSAN_ROOM_LEGEND = [
  { key:'A', type:'싱글베드 2개 (2인실)',        hotel:'어반스테이 해운대역' },
  { key:'B', type:'스탠다드 더블 룸',            hotel:'W레지던스 호텔 해운대' },
  { key:'C', type:'더블베드 1개',                hotel:'어반스테이 해운대역' },
  { key:'D', type:'스튜디오 (퀸베드 1개)',        hotel:'어반스테이 해운대역' },
];
const BUSAN_HOTELS = {
  '어반스테이 해운대역': '부산 해운대구 해운대로 620 (우동 539-10) · 라뮤에뜨 (해운대역 인근)',
  'W레지던스 호텔 해운대': '부산 해운대구 해운대로 620 · 라뮤에뜨 (해운대역 인근)',
};
// 방 이니셜별 키컬러(팀 배정의 파랑과 구분되는 톤)
const DORM_BADGE = {
  A: 'bg-rose-100 text-rose-700 border-rose-200',
  B: 'bg-amber-100 text-amber-700 border-amber-200',
  C: 'bg-violet-100 text-violet-700 border-violet-200',
  D: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// ---------- 공통 유틸 ----------
function _bzEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]; }); }
function _bzNorm(s){ return String(s||'').replace(/\s+/g,'').toLowerCase(); }

// ==================== 숙소 배정 ====================
function renderAccommodation(){
  const top = document.getElementById('accommodation-top');
  if (top){
    const legend = BUSAN_ROOM_LEGEND.map(function(l){
      const badge = DORM_BADGE[l.key] || 'bg-neutral-100 text-neutral-700 border-neutral-200';
      return '<div class="flex items-start gap-3 p-4 rounded-xl border ' + badge + '">'
        + '<span class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg border ' + badge + '">' + l.key + '</span>'
        + '<div><p class="font-extrabold text-sm">' + _bzEsc(l.type) + '</p>'
        + '<p class="text-xs opacity-70 font-semibold mt-0.5">' + _bzEsc(l.hotel) + '</p></div></div>';
    }).join('');
    const hotels = Object.keys(BUSAN_HOTELS).map(function(h){
      return '<li><span class="font-extrabold text-emerald-800">' + _bzEsc(h) + '</span>'
        + '<span class="text-sm opacity-70"> — ' + _bzEsc(BUSAN_HOTELS[h]) + '</span></li>';
    }).join('');
    top.innerHTML =
      '<div class="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-6 md:p-8 mb-8">'
      + '<p class="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-2">Accommodation · 숙소 주소</p>'
      + '<ul class="space-y-1.5 mb-6 list-disc list-inside">' + hotels + '</ul>'
      + '<p class="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Room Type · 방 이니셜 안내</p>'
      + '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' + legend + '</div>'
      + '<p class="text-xs opacity-60 mt-4">※ 방 이니셜(A·B·C·D)은 객실 타입 구분입니다. 아래에서 본인 이름을 검색하면 배정된 방·호텔·룸메이트를 확인할 수 있습니다.</p>'
      + '</div>';
  }
  const inp = document.getElementById('accommodation-search');
  if (inp) inp.value = '';
  accommodationSearch('');
}

function accommodationSearch(q){
  const box = document.getElementById('accommodation-result');
  if (!box) return;
  const nq = _bzNorm(q);
  if (!nq){
    box.innerHTML = '<p class="text-center text-sm opacity-50 py-10">본인 이름을 검색하면 배정 정보가 표시됩니다.</p>';
    return;
  }
  const hits = BUSAN_ROOMS.filter(function(p){ return _bzNorm(p.name).indexOf(nq) >= 0; });
  if (!hits.length){
    const unusedHit = BUSAN_ROOM_UNUSED.filter(function(p){ return _bzNorm(p.name).indexOf(nq) >= 0; });
    if (unusedHit.length){
      box.innerHTML = unusedHit.map(function(p){
        return '<div class="rounded-2xl border border-neutral-300 bg-white p-6 text-center">'
          + '<p class="font-extrabold text-lg">' + _bzEsc(p.name) + ' <span class="text-sm opacity-60 font-semibold">' + _bzEsc(p.school) + '</span></p>'
          + '<p class="text-sm text-neutral-500 font-semibold mt-2">숙소 배정 명단에 없습니다 (현지 통학 등 숙소 미이용).</p></div>';
      }).join('');
    } else {
      box.innerHTML = '<p class="text-center text-sm text-red-500 font-semibold py-10">「' + _bzEsc(q) + '」 — 숙소 배정 명단에서 찾을 수 없습니다. 이름을 정확히 입력했는지 확인해 주세요.</p>';
    }
    return;
  }
  box.innerHTML = hits.map(function(p){
    const legend = BUSAN_ROOM_LEGEND.find(function(l){ return l.key === p.dorm; }) || { type:'', hotel:'' };
    const mates = BUSAN_ROOMS.filter(function(o){ return o.dorm === p.dorm && o.room === p.room && _bzNorm(o.name) !== _bzNorm(p.name); });
    const badge = DORM_BADGE[p.dorm] || 'bg-neutral-100 text-neutral-700 border-neutral-200';
    const mateHtml = mates.length
      ? mates.map(function(m){ return '<span class="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-bold">' + _bzEsc(m.name) + '<span class="text-[11px] font-semibold opacity-50">' + _bzEsc(m.school) + '</span></span>'; }).join(' ')
      : '<span class="text-sm opacity-60 font-semibold">단독 배정 (룸메이트 없음)</span>';
    return '<div class="rounded-2xl border-2 border-emerald-500 bg-white overflow-hidden mb-4">'
      + '<div class="bg-emerald-500 text-white px-6 py-4 flex items-center justify-between gap-4">'
      +   '<div><p class="text-[11px] font-bold uppercase tracking-widest opacity-90">배정 확인</p>'
      +   '<p class="text-2xl font-black">' + _bzEsc(p.name) + '</p>'
      +   '<p class="text-xs opacity-90 font-semibold">' + _bzEsc(p.school) + ' · ' + _bzEsc(p.track) + '</p></div>'
      +   '<div class="text-center shrink-0"><div class="w-16 h-16 rounded-2xl bg-white text-emerald-700 flex flex-col items-center justify-center font-black leading-none">'
      +     '<span class="text-2xl">' + _bzEsc(p.dorm) + '</span><span class="text-sm mt-0.5">' + _bzEsc(p.room) + '호</span></div></div>'
      + '</div>'
      + '<div class="p-6 space-y-3">'
      +   '<div class="flex flex-wrap items-center gap-2"><span class="inline-block text-xs font-black px-2.5 py-1 rounded-lg border ' + badge + '">' + _bzEsc(p.dorm) + ' · ' + _bzEsc(legend.type) + '</span>'
      +     '<span class="text-sm font-extrabold text-emerald-800">' + _bzEsc(legend.hotel) + '</span></div>'
      +   '<p class="text-sm opacity-70 font-semibold">' + _bzEsc(BUSAN_HOTELS[legend.hotel] || '') + '</p>'
      +   '<div><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-2">Roommate · 룸메이트</p>'
      +     '<div class="flex flex-wrap gap-2">' + mateHtml + '</div></div>'
      + '</div></div>';
  }).join('');
}

// ==================== 버스 이동 ====================
function renderBusInfo(){
  const inp = document.getElementById('bus-search');
  if (inp) inp.value = '';
  busSearch('');
}
function busSearch(q){
  const box = document.getElementById('bus-result');
  if (!box) return;
  const nq = _bzNorm(q);
  if (!nq){
    box.innerHTML = '<p class="text-center text-sm opacity-50 py-8">본인 이름을 검색하면 어느 버스(서울↔부산)에 신청되어 있는지 확인할 수 있습니다.</p>';
    return;
  }
  const inS = BUSAN_BUS_S2B.filter(function(p){ return _bzNorm(p.name).indexOf(nq) >= 0; });
  const inB = BUSAN_BUS_B2S.filter(function(p){ return _bzNorm(p.name).indexOf(nq) >= 0; });
  if (!inS.length && !inB.length){
    box.innerHTML = '<p class="text-center text-sm text-red-500 font-semibold py-8">「' + _bzEsc(q) + '」 — 버스 신청 명단에서 찾을 수 없습니다. 이름을 정확히 입력했는지 확인해 주세요.</p>';
    return;
  }
  const names = {};
  inS.forEach(function(p){ if(!names[p.name]) names[p.name] = { p:p, s:false, b:false }; names[p.name].s = true; });
  inB.forEach(function(p){ if(!names[p.name]) names[p.name] = { p:p, s:false, b:false }; names[p.name].b = true; });
  box.innerHTML = Object.keys(names).map(function(n){
    const o = names[n];
    function row(on, label, sub){
      return '<div class="flex items-center justify-between gap-3 p-3 rounded-xl border ' + (on ? 'border-amber-400 bg-amber-50' : 'border-neutral-200 bg-neutral-50 opacity-60') + '">'
        + '<div><p class="font-extrabold text-sm">' + label + '</p><p class="text-[11px] font-semibold opacity-70">' + sub + '</p></div>'
        + '<span class="text-sm font-black ' + (on ? 'text-amber-700' : 'text-neutral-400') + '">' + (on ? '✓ 신청됨' : '미신청') + '</span></div>';
    }
    return '<div class="rounded-2xl border-2 border-amber-500 bg-white overflow-hidden mb-4">'
      + '<div class="bg-amber-500 text-white px-6 py-4"><p class="text-[11px] font-bold uppercase tracking-widest opacity-90">버스 신청 확인</p>'
      +   '<p class="text-2xl font-black">' + _bzEsc(o.p.name) + '</p><p class="text-xs opacity-90 font-semibold">' + _bzEsc(o.p.school) + ' · ' + _bzEsc(o.p.track) + '</p></div>'
      + '<div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">'
      +   row(o.s, '서울 → 부산', '06.24(수) 08:00 · 양재역 2번 출구')
      +   row(o.b, '부산 → 서울', '06.26(금) 17:00 · 부산대학교')
      + '</div></div>';
  }).join('');
}
