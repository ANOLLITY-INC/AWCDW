// ==================== 중앙대 2차 워크숍 안내 (기숙사 방 배정) ====================
// 개인정보 보호: 학번·전화번호는 의도적으로 제외(이름·성별·호실·룸메이트만 공개).
// 데이터 출처: "첨단소재나노융합사업단 방 배정표.xlsx" (2026-07 기준). 전원 309관·2인실·7.8~7.10.

const CAU_ROOMS = [{"name": "황지민", "gender": "남", "room": "713", "card": "A"}, {"name": "홍찬민", "gender": "남", "room": "713", "card": "B"}, {"name": "임창현", "gender": "남", "room": "715", "card": "A"}, {"name": "장승원", "gender": "남", "room": "715", "card": "B"}, {"name": "허준우", "gender": "남", "room": "717", "card": "A"}, {"name": "송한규", "gender": "남", "room": "717", "card": "B"}, {"name": "서민재", "gender": "남", "room": "722", "card": "A"}, {"name": "최재원", "gender": "남", "room": "722", "card": "B"}, {"name": "조민우", "gender": "남", "room": "724", "card": "A"}, {"name": "김동빈", "gender": "남", "room": "724", "card": "B"}, {"name": "문광민", "gender": "남", "room": "727", "card": "A"}, {"name": "이상현", "gender": "남", "room": "727", "card": "B"}, {"name": "홍지혁", "gender": "남", "room": "815", "card": "A"}, {"name": "박준형", "gender": "남", "room": "815", "card": "B"}, {"name": "이우철", "gender": "남", "room": "821", "card": "A"}, {"name": "이시형", "gender": "남", "room": "821", "card": "B"}, {"name": "황세현", "gender": "남", "room": "824", "card": "A"}, {"name": "김태호", "gender": "남", "room": "824", "card": "B"}, {"name": "박현민", "gender": "남", "room": "901", "card": "A"}, {"name": "조영유", "gender": "남", "room": "901", "card": "B"}, {"name": "여환철", "gender": "남", "room": "904", "card": "A"}, {"name": "김성은", "gender": "남", "room": "904", "card": "B"}, {"name": "장정우", "gender": "남", "room": "909", "card": "A"}, {"name": "허지웅", "gender": "남", "room": "909", "card": "B"}, {"name": "박준우", "gender": "남", "room": "912", "card": "A"}, {"name": "강남원", "gender": "남", "room": "912", "card": "B"}, {"name": "이하늘", "gender": "남", "room": "923", "card": "A"}, {"name": "정운영", "gender": "남", "room": "923", "card": "B"}, {"name": "최강", "gender": "남", "room": "924", "card": "A"}, {"name": "함대희", "gender": "남", "room": "924", "card": "B"}, {"name": "박도현", "gender": "남", "room": "926", "card": "A"}, {"name": "조지운", "gender": "남", "room": "926", "card": "B"}, {"name": "한영균", "gender": "남", "room": "1010", "card": "A"}, {"name": "김재준", "gender": "남", "room": "1010", "card": "B"}, {"name": "조민재", "gender": "남", "room": "1013", "card": "A"}, {"name": "서선진", "gender": "여", "room": "876", "card": "A"}, {"name": "노현주", "gender": "여", "room": "876", "card": "B"}, {"name": "김나연", "gender": "여", "room": "879", "card": "A"}, {"name": "명채은", "gender": "여", "room": "879", "card": "B"}, {"name": "김산들", "gender": "여", "room": "882", "card": "A"}, {"name": "김은채", "gender": "여", "room": "882", "card": "B"}, {"name": "유지연", "gender": "여", "room": "883", "card": "A"}, {"name": "유서연", "gender": "여", "room": "883", "card": "B"}, {"name": "최보아", "gender": "여", "room": "884", "card": "A"}, {"name": "김나임", "gender": "여", "room": "884", "card": "B"}, {"name": "이선우", "gender": "여", "room": "892", "card": "A"}, {"name": "이민경", "gender": "여", "room": "892", "card": "B"}, {"name": "이정아", "gender": "여", "room": "893", "card": "A"}];
const CAU_DORM_BUILDING = '309관';
const CAU_DORM_PERIOD = '2026.07.08 ~ 07.10 (2박 3일)';

function _cauEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function _cauNorm(s){ return String(s==null?'':s).replace(/\s+/g,'').toLowerCase(); }

function renderCauDorm(){
  const top = document.getElementById('cau-dorm-top');
  if (top){
    const males = CAU_ROOMS.filter(function(p){ return p.gender === '남'; }).length;
    const females = CAU_ROOMS.filter(function(p){ return p.gender === '여'; }).length;
    top.innerHTML =
      '<div class="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-6 md:p-8 mb-8">'
      + '<p class="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Dormitory · 기숙사 안내</p>'
      + '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">'
      +   '<div class="rounded-xl border border-emerald-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700">건물</p><p class="text-xl font-black text-emerald-900 mt-0.5">' + _cauEsc(CAU_DORM_BUILDING) + '</p><p class="text-xs opacity-60">2인실 · 행사호실</p></div>'
      +   '<div class="rounded-xl border border-emerald-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700">기간</p><p class="text-sm font-black text-emerald-900 mt-1.5">' + _cauEsc(CAU_DORM_PERIOD) + '</p></div>'
      +   '<div class="rounded-xl border border-emerald-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700">인원</p><p class="text-sm font-black text-emerald-900 mt-1.5">남 ' + males + '명 · 여 ' + females + '명</p></div>'
      + '</div>'
      + '<p class="text-xs opacity-70 font-semibold">※ 방 카드(A·B)는 같은 호실의 침대 구분입니다. 아래에서 본인 이름을 검색하면 배정된 호실·카드·룸메이트를 확인할 수 있습니다.</p>'
      + '<p class="text-xs opacity-60 mt-1">※ 새벽 1시~5시 입출입 불가. 수건 미제공(개인 준비 또는 학교 부근 다이소 구입).</p>'
      + '</div>';
  }
  const inp = document.getElementById('cau-dorm-search');
  if (inp) inp.value = '';
  cauDormSearch('');
}

function cauDormSearch(q){
  const box = document.getElementById('cau-dorm-result');
  if (!box) return;
  const nq = _cauNorm(q);
  if (!nq){
    box.innerHTML = '<p class="text-center text-sm opacity-50 py-10">본인 이름을 검색하면 배정 정보가 표시됩니다.</p>';
    return;
  }
  const hits = CAU_ROOMS.filter(function(p){ return _cauNorm(p.name).indexOf(nq) >= 0; });
  if (!hits.length){
    box.innerHTML = '<p class="text-center text-sm text-red-500 font-semibold py-10">「' + _cauEsc(q) + '」 — 방 배정 명단에서 찾을 수 없습니다. 이름을 정확히 입력했는지 확인해 주세요.</p>';
    return;
  }
  box.innerHTML = hits.map(function(p){
    const mates = CAU_ROOMS.filter(function(o){ return o.room === p.room && _cauNorm(o.name) !== _cauNorm(p.name); });
    const mateHtml = mates.length
      ? mates.map(function(m){ return '<span class="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-bold">' + _cauEsc(m.name) + '<span class="text-[11px] font-semibold opacity-50">' + _cauEsc(m.card) + '카드</span></span>'; }).join(' ')
      : '<span class="text-sm opacity-60 font-semibold">단독 배정 (룸메이트 없음)</span>';
    return '<div class="rounded-2xl border-2 border-emerald-500 bg-white overflow-hidden mb-4">'
      + '<div class="bg-emerald-500 text-white px-6 py-4 flex items-center justify-between gap-4">'
      +   '<div><p class="text-[11px] font-bold uppercase tracking-widest opacity-90">방 배정 확인</p>'
      +   '<p class="text-2xl font-black">' + _cauEsc(p.name) + '</p>'
      +   '<p class="text-xs opacity-90 font-semibold">' + _cauEsc(CAU_DORM_BUILDING) + ' · ' + _cauEsc(p.gender) + '</p></div>'
      +   '<div class="text-center shrink-0"><div class="w-20 h-16 rounded-2xl bg-white text-emerald-700 flex flex-col items-center justify-center font-black leading-none">'
      +     '<span class="text-2xl">' + _cauEsc(p.room) + '</span><span class="text-xs mt-1">' + _cauEsc(p.card) + '카드</span></div></div>'
      + '</div>'
      + '<div class="p-6 space-y-3">'
      +   '<div class="flex flex-wrap items-center gap-2">'
      +     '<span class="inline-block text-xs font-black px-2.5 py-1 rounded-lg border bg-emerald-100 text-emerald-700 border-emerald-200">' + _cauEsc(CAU_DORM_BUILDING) + ' ' + _cauEsc(p.room) + '호</span>'
      +     '<span class="inline-block text-xs font-black px-2.5 py-1 rounded-lg border bg-neutral-100 text-neutral-700 border-neutral-200">' + _cauEsc(p.card) + '카드</span>'
      +     '<span class="inline-block text-xs font-black px-2.5 py-1 rounded-lg border bg-neutral-100 text-neutral-700 border-neutral-200">2인실</span>'
      +     '<span class="text-sm font-extrabold text-emerald-800">' + _cauEsc(CAU_DORM_PERIOD) + '</span></div>'
      +   '<div><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-2">Roommate · 룸메이트</p>'
      +     '<div class="flex flex-wrap gap-2">' + mateHtml + '</div></div>'
      + '</div></div>';
  }).join('');
}
