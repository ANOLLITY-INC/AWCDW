// ==================== 한기대 3차 워크숍 안내 (기숙사 방 배정) ====================
// 개인정보 보호: 학번·전화번호는 의도적으로 제외(이름·성별·호실·팀·룸메이트만 공개).
// 데이터 출처: "2026적층제조융합 설계 워크숍 기숙사 명단.xlsx" (2026-08 기준).
// 전원 생활관 203동 · 8.19~8.21 · 2층=여성 / 3~4층=남성.

const KUT_ROOMS = [{"name": "유서연", "gender": "여", "room": "201A", "team": "A팀"}, {"name": "김나연", "gender": "여", "room": "201A", "team": "A팀"}, {"name": "유지연", "gender": "여", "room": "201B", "team": "C팀"}, {"name": "노현주", "gender": "여", "room": "201B", "team": "E팀"}, {"name": "김은채", "gender": "여", "room": "201C", "team": "D팀"}, {"name": "김산들", "gender": "여", "room": "201C", "team": "D팀"}, {"name": "이정아", "gender": "여", "room": "201D", "team": "G팀"}, {"name": "최보아", "gender": "여", "room": "202A", "team": "I팀"}, {"name": "김나임", "gender": "여", "room": "202A", "team": "I팀"}, {"name": "이선우", "gender": "여", "room": "202B", "team": "J팀"}, {"name": "이민경", "gender": "여", "room": "202B", "team": "J팀"}, {"name": "서선진", "gender": "여", "room": "202C", "team": "J팀"}, {"name": "명채은", "gender": "여", "room": "202C", "team": "J팀"}, {"name": "서민재", "gender": "남", "room": "301A", "team": "A팀"}, {"name": "장정우", "gender": "남", "room": "301A", "team": "A팀"}, {"name": "이상현", "gender": "남", "room": "301B", "team": "A팀"}, {"name": "박준형", "gender": "남", "room": "301C", "team": "C팀"}, {"name": "이우철", "gender": "남", "room": "301C", "team": "C팀"}, {"name": "강남원", "gender": "남", "room": "301D", "team": "C팀"}, {"name": "박준우", "gender": "남", "room": "301D", "team": "C팀"}, {"name": "이시형", "gender": "남", "room": "302A", "team": "D팀"}, {"name": "허준우", "gender": "남", "room": "302A", "team": "D팀"}, {"name": "조영유", "gender": "남", "room": "302B", "team": "D팀"}, {"name": "조지운", "gender": "남", "room": "302C", "team": "E팀"}, {"name": "한영균", "gender": "남", "room": "302C", "team": "E팀"}, {"name": "황지민", "gender": "남", "room": "302D", "team": "E팀"}, {"name": "김태호", "gender": "남", "room": "302D", "team": "E팀"}, {"name": "황세현", "gender": "남", "room": "303A", "team": "B+H팀"}, {"name": "홍지혁", "gender": "남", "room": "303A", "team": "B+H팀"}, {"name": "함대희", "gender": "남", "room": "303B", "team": "B+H팀"}, {"name": "임창현", "gender": "남", "room": "303B", "team": "B+H팀"}, {"name": "홍창민", "gender": "남", "room": "303C", "team": "B+H팀"}, {"name": "조민우", "gender": "남", "room": "303C", "team": "B+H팀"}, {"name": "이하늘", "gender": "남", "room": "304A", "team": "F팀"}, {"name": "정운영", "gender": "남", "room": "304A", "team": "F팀"}, {"name": "문광민", "gender": "남", "room": "304B", "team": "F팀"}, {"name": "허지웅", "gender": "남", "room": "304B", "team": "F팀"}, {"name": "김성은", "gender": "남", "room": "304C", "team": "F팀"}, {"name": "박도현", "gender": "남", "room": "401A", "team": "G팀"}, {"name": "최강", "gender": "남", "room": "401A", "team": "G팀"}, {"name": "박현민", "gender": "남", "room": "401B", "team": "G팀"}, {"name": "조민재", "gender": "남", "room": "401B", "team": "G팀"}, {"name": "송한규", "gender": "남", "room": "401C", "team": "I팀"}, {"name": "김재준", "gender": "남", "room": "401C", "team": "I팀"}, {"name": "김동빈", "gender": "남", "room": "401D", "team": "I팀"}, {"name": "여환철", "gender": "남", "room": "401D", "team": "J팀"}];
const KUT_DORM_BUILDING = '생활관 203동';
const KUT_DORM_PERIOD = '2026.08.19 ~ 08.21 (2박 3일)';
const KUT_DORM_CHECKIN = '8.19(수) 17:30 입실';
const KUT_DORM_CHECKOUT = '8.21(금) 08:30~09:30 퇴실';
// 자료마다 표기가 다른 이름 — 어느 쪽으로 검색해도 찾히도록 별칭 처리(표시는 명단 원본 표기 유지)
const KUT_NAME_ALIAS = { '홍창민': ['홍찬민'], '홍찬민': ['홍창민'] };

function _kutEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function _kutNorm(s){ return String(s==null?'':s).replace(/\s+/g,'').toLowerCase(); }
function _kutMatch(person, nq){
  if (_kutNorm(person.name).indexOf(nq) >= 0) return true;
  const alias = KUT_NAME_ALIAS[person.name] || [];
  return alias.some(function(a){ return _kutNorm(a).indexOf(nq) >= 0; });
}

function renderKutDorm(){
  const top = document.getElementById('kut-dorm-top');
  if (top){
    const males = KUT_ROOMS.filter(function(p){ return p.gender === '남'; }).length;
    const females = KUT_ROOMS.filter(function(p){ return p.gender === '여'; }).length;
    const roomCount = new Set(KUT_ROOMS.map(function(p){ return p.room; })).size;
    top.innerHTML =
      '<div class="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-6 md:p-8 mb-8">'
      + '<p class="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">Dormitory · 기숙사 안내</p>'
      + '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">'
      +   '<div class="rounded-xl border border-emerald-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700">건물</p><p class="text-xl font-black text-emerald-900 mt-0.5">' + _kutEsc(KUT_DORM_BUILDING) + '</p><p class="text-xs opacity-60">' + roomCount + '개 호실 · 2층 여성 / 3~4층 남성</p></div>'
      +   '<div class="rounded-xl border border-emerald-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700">기간</p><p class="text-sm font-black text-emerald-900 mt-1.5">' + _kutEsc(KUT_DORM_PERIOD) + '</p><p class="text-xs opacity-60 font-semibold mt-1">' + _kutEsc(KUT_DORM_CHECKIN) + ' · ' + _kutEsc(KUT_DORM_CHECKOUT) + '</p></div>'
      +   '<div class="rounded-xl border border-emerald-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700">인원</p><p class="text-sm font-black text-emerald-900 mt-1.5">남 ' + males + '명 · 여 ' + females + '명 (총 ' + KUT_ROOMS.length + '명)</p></div>'
      + '</div>'
      + '<p class="text-xs opacity-70 font-semibold">※ 호실 번호 뒤 알파벳(A·B·C·D)까지가 방 번호입니다. 예) 301A = 3층 301A호.</p>'
      + '<p class="text-xs opacity-60 mt-1">※ 입실은 1일차 17:30(담당: 정서요), 퇴실은 3일차 08:30~09:30입니다. 퇴실 시 개인 짐을 모두 챙겨 주세요.</p>'
      + '</div>';
  }
  const inp = document.getElementById('kut-dorm-search');
  if (inp) inp.value = '';
  kutDormSearch('');
}

function kutDormSearch(q){
  const box = document.getElementById('kut-dorm-result');
  if (!box) return;
  const nq = _kutNorm(q);
  if (!nq){
    box.innerHTML = '<p class="text-center text-sm opacity-50 py-10">본인 이름을 검색하면 배정 정보가 표시됩니다.</p>';
    return;
  }
  const hits = KUT_ROOMS.filter(function(p){ return _kutMatch(p, nq); });
  if (!hits.length){
    box.innerHTML = '<p class="text-center text-sm text-red-500 font-semibold py-10">「' + _kutEsc(q) + '」 — 기숙사 명단에서 찾을 수 없습니다. 이름을 정확히 입력했는지 확인해 주세요.</p>';
    return;
  }
  box.innerHTML = hits.map(function(p){
    const mates = KUT_ROOMS.filter(function(o){ return o.room === p.room && _kutNorm(o.name) !== _kutNorm(p.name); });
    const mateHtml = mates.length
      ? mates.map(function(m){ return '<span class="inline-flex items-center gap-1.5 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-bold">' + _kutEsc(m.name) + '<span class="text-[11px] font-semibold opacity-50">' + _kutEsc(m.team) + '</span></span>'; }).join(' ')
      : '<span class="text-sm opacity-60 font-semibold">단독 배정 (룸메이트 없음)</span>';
    const floor = String(p.room).charAt(0);
    return '<div class="rounded-2xl border-2 border-emerald-500 bg-white overflow-hidden mb-4">'
      + '<div class="bg-emerald-500 text-white px-6 py-4 flex items-center justify-between gap-4">'
      +   '<div><p class="text-[11px] font-bold uppercase tracking-widest opacity-90">기숙사 배정 확인</p>'
      +   '<p class="text-2xl font-black">' + _kutEsc(p.name) + '</p>'
      +   '<p class="text-xs opacity-90 font-semibold">' + _kutEsc(KUT_DORM_BUILDING) + ' · ' + _kutEsc(p.gender) + ' · ' + _kutEsc(p.team) + '</p></div>'
      +   '<div class="text-center shrink-0"><div class="w-24 h-16 rounded-2xl bg-white text-emerald-700 flex flex-col items-center justify-center font-black leading-none">'
      +     '<span class="text-2xl">' + _kutEsc(p.room) + '</span><span class="text-xs mt-1">' + _kutEsc(floor) + '층</span></div></div>'
      + '</div>'
      + '<div class="p-6 space-y-3">'
      +   '<div class="flex flex-wrap items-center gap-2">'
      +     '<span class="inline-block text-xs font-black px-2.5 py-1 rounded-lg border bg-emerald-100 text-emerald-700 border-emerald-200">' + _kutEsc(KUT_DORM_BUILDING) + ' ' + _kutEsc(p.room) + '호</span>'
      +     '<span class="inline-block text-xs font-black px-2.5 py-1 rounded-lg border bg-blue-100 text-blue-700 border-blue-200">' + _kutEsc(p.team) + '</span>'
      +     '<span class="text-sm font-extrabold text-emerald-800">' + _kutEsc(KUT_DORM_PERIOD) + '</span></div>'
      +   '<div><p class="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-2">Roommate · 룸메이트</p>'
      +     '<div class="flex flex-wrap gap-2">' + mateHtml + '</div></div>'
      +   '<div class="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-xs font-semibold opacity-70 leading-relaxed">'
      +     '입실 ' + _kutEsc(KUT_DORM_CHECKIN) + ' · 퇴실 ' + _kutEsc(KUT_DORM_CHECKOUT) + '<br>'
      +     '기숙사는 캠퍼스 맵의 <span class="font-black">생활관 203동</span> 위치를 확인해 주세요.</div>'
      + '</div></div>';
  }).join('');
}
