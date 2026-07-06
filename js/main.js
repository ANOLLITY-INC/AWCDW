// ============================================================
//  화면 로직 (Render / Search / Theme / Page Switching / Print)
// ------------------------------------------------------------
//  teamsData 는 teams-data.js 에서 선언됩니다.
//  이 파일은 teams-data.js 이후, </body> 직전에 로드됩니다.
//  (일반 <script> 이므로 navigateTo 등은 전역 함수가 되어
//   HTML 의 onclick="..." 인라인 핸들러에서 호출 가능합니다.)
// ============================================================

let currentView = 'grid'; // 'grid' | 'list'
let currentTheme = 'swiss';

// 화면에 그릴 팀 목록.
// 기본값은 로컬 teams-data.js (폴백) → loadTeams()가 Firestore 값으로 덮어씀.
let teams = (typeof teamsData !== 'undefined') ? teamsData.slice() : [];

const teamsContainer = document.getElementById('teams-container');
const searchInput = document.getElementById('search');
const noResults = document.getElementById('no-results');

// ------------------------------------------------------------
// 팀 보드 지원 상태 (공학생 지원 기간/정원/내 지원) — apply.js 와 연동
// ------------------------------------------------------------
let teamApplyOpen = false;   // 현재 지원 접수 중
let teamApplyPreview = false; // 현재 지원 미리보기 구간(보이되 지원 불가)
let teamApplyCounts = {};    // teamId → 배정된 공학생 수
let teamMyTeamId = null;     // 로그인 공학생이 지원한 팀

async function refreshTeamApplyState() {
    teamApplyOpen = false; teamApplyPreview = false; teamApplyCounts = {}; teamMyTeamId = null;
    try {
        if (typeof loadApplyWindow === 'function') {
            await loadApplyWindow();
            teamApplyOpen = (typeof applyOpen !== 'undefined') && applyOpen;
            teamApplyPreview = (typeof applyPreview !== 'undefined') && applyPreview;
        }
    } catch (_) {}
    if (typeof currentUser !== 'undefined' && currentUser && typeof loadAllApplications === 'function') {
        try {
            const apps = await loadAllApplications();
            if (typeof countByTeam === 'function') teamApplyCounts = countByTeam(apps);
            const mine = apps.find(a => a.engineerId === currentUser.uid && a.status === 'assigned');
            teamMyTeamId = mine ? mine.assignedTeamId : null;
        } catch (_) {}
    }
}
window.refreshTeamApplyState = refreshTeamApplyState;

// 팀 카드 하단: 잔여 정원 + (지원 기간·공학생이면) 지원 컨트롤
function teamSlotsApplyHtml(team) {
    const cap = (typeof teamCapacity === 'function') ? teamCapacity(team) : (team.capacity || 3);
    const countsKnown = (typeof currentUser !== 'undefined' && !!currentUser);
    const cnt = (teamApplyCounts && teamApplyCounts[team.id]) || 0;
    const remain = Math.max(0, cap - cnt);
    const full = cnt >= cap;
    const mineHere = teamMyTeamId === team.id;
    const isEng = (typeof currentProfile !== 'undefined' && currentProfile && currentProfile.role === 'engineer');
    // 지원 인원/잔여 수는 지원 기간 중에만 노출. 기간 아니면 숨김(내 지원 팀 표시만 유지).
    const parts = [];
    if (teamApplyOpen || teamApplyPreview) {   // 미리보기도 실제 지원 기간과 동일하게 정원/잔여 표시
        parts.push(countsKnown
            ? `공학생 ${cnt}/${cap}${remain > 0 ? ' · 잔여 ' + remain : ' · 마감'}`
            : `공학생 정원 ${cap}명`);
    }
    if (isEng && mineHere) parts.push(`<span class="text-emerald-600 font-black">✓ 내 지원 팀</span>`);
    return { slots: parts.join(' · '), ctrl: '' };
}

// 팀 보드 상단 지원 안내 배너 (로그인 공학생에게만)
function renderApplyBanner() {
    if (!teamsContainer || !teamsContainer.parentNode) return;
    let b = document.getElementById('apply-banner');
    const isEng = (typeof currentProfile !== 'undefined' && currentProfile && currentProfile.role === 'engineer');
    if (!isEng) { if (b) b.remove(); return; }
    const st = (typeof applyStatusInfo === 'function') ? applyStatusInfo() : { open: false, label: '' };
    if (!b) {
        b = document.createElement('div');
        b.id = 'apply-banner';
        b.className = 'mb-6';
        teamsContainer.parentNode.insertBefore(b, teamsContainer);
    }
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => s);
    const cls = st.open ? 'bg-blue-50 border border-blue-200 text-blue-800'
        : st.preview ? 'bg-amber-50 border border-amber-200 text-amber-800'
        : 'bg-neutral-100 border border-neutral-300 text-neutral-600';
    const icon = st.open ? '🟢' : st.preview ? '👀' : '⏳';
    const tail = st.open ? ' — 지원할 팀을 눌러 들어가서 「이 팀에 지원」을 누르세요.'
        : st.preview ? ' — 지원할 팀에 들어가면 지원 방법을 미리 볼 수 있습니다. 실제 지원은 시작 시각부터 가능합니다.'
        : '';
    b.innerHTML = `<div class="rounded-xl p-3 text-sm font-bold ${cls}">${icon} ${esc(st.label)}${tail}</div>`;
}

// ------------------------------------------------------------
// 브라우저 뒤로/앞으로 가기 지원 (History API)
//  navigateTo 마다 history 항목을 쌓고, popstate(뒤로가기) 시 그 상태로 복원.
//  workCtx(works.js)·authMode(auth.js)는 같은 전역 스코프라 여기서 읽고 복원한다.
// ------------------------------------------------------------
let _suppressHistory = false; // popstate 로 인한 navigateTo 시 중복 push 방지
function _histState(pageId) {
    const s = { _spa: true, pageId };
    try { if (typeof workCtx !== 'undefined' && workCtx) s.workCtx = JSON.parse(JSON.stringify(workCtx)); } catch (_) {}
    try { if (typeof authMode !== 'undefined') s.authMode = authMode; } catch (_) {}
    return s;
}

// Page Router Function
function navigateTo(pageId) {
    // 사용자 네비게이션이면 history 에 현재 화면 상태를 쌓는다(뒤로가기용).
    if (!_suppressHistory && typeof history !== 'undefined' && history.pushState) {
        try { history.pushState(_histState(pageId), ''); } catch (_) {}
    }
    const page1 = document.getElementById('landing-page');
    const pageOnline = document.getElementById('schedule-online-page');
    const pageBusan = document.getElementById('schedule-busan-page');
    const pageCau = document.getElementById('schedule-cau-page');
    const pageTeams = document.getElementById('teams-page');
    const pageAuth = document.getElementById('auth-page');
    const pageDashboard = document.getElementById('dashboard-page');
    const pageTeamAdmin = document.getElementById('team-admin-page');
    const pageUserAdmin = document.getElementById('user-admin-page');
    const pageTeamPlace = document.getElementById('team-place-page');
    const pageTeamStatus = document.getElementById('team-status-page');
    const pageTeamDetail = document.getElementById('team-detail-page');
    const pageWorks = document.getElementById('works-page');
    const pageWorkDetail = document.getElementById('work-detail-page');
    const pageApply = document.getElementById('apply-page');
    const pageApplicants = document.getElementById('applicants-page');
    const pageBusInfo = document.getElementById('bus-info-page');
    const pageAccommodation = document.getElementById('accommodation-page');
    const pageCampusMap = document.getElementById('campus-map-page');
    const pageCauFacility = document.getElementById('cau-facility-page');
    const pageCauDorm = document.getElementById('cau-dorm-page');
    const pageCauCampusMap = document.getElementById('cau-campus-map-page');

    // Hide all first
    page1.classList.add('hidden');
    pageOnline.classList.add('hidden');
    pageBusan.classList.add('hidden');
    if (pageCau) pageCau.classList.add('hidden');
    pageTeams.classList.add('hidden');
    if (pageAuth) pageAuth.classList.add('hidden');
    if (pageDashboard) pageDashboard.classList.add('hidden');
    if (pageTeamAdmin) pageTeamAdmin.classList.add('hidden');
    if (pageUserAdmin) pageUserAdmin.classList.add('hidden');
    if (pageTeamPlace) pageTeamPlace.classList.add('hidden');
    if (pageTeamStatus) pageTeamStatus.classList.add('hidden');
    if (pageTeamDetail) pageTeamDetail.classList.add('hidden');
    if (pageWorks) pageWorks.classList.add('hidden');
    if (pageWorkDetail) pageWorkDetail.classList.add('hidden');
    if (pageApply) pageApply.classList.add('hidden');
    if (pageApplicants) pageApplicants.classList.add('hidden');
    if (pageBusInfo) pageBusInfo.classList.add('hidden');
    if (pageAccommodation) pageAccommodation.classList.add('hidden');
    if (pageCampusMap) pageCampusMap.classList.add('hidden');
    if (pageCauFacility) pageCauFacility.classList.add('hidden');
    if (pageCauDorm) pageCauDorm.classList.add('hidden');
    if (pageCauCampusMap) pageCauCampusMap.classList.add('hidden');

    if (pageId === 'auth') {
        if (pageAuth) { renderAuthPage(); pageAuth.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'dashboard') {
        if (pageDashboard) { renderDashboard(); pageDashboard.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'team-admin') {
        if (pageTeamAdmin) { renderTeamAdmin(); pageTeamAdmin.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'user-admin') {
        if (pageUserAdmin) { if (typeof renderUserAdmin === 'function') renderUserAdmin(); pageUserAdmin.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'team-place') {
        if (pageTeamPlace) { if (typeof renderTeamPlace === 'function') renderTeamPlace(); pageTeamPlace.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'team-status') {
        if (pageTeamStatus) { if (typeof renderTeamStatus === 'function') renderTeamStatus(); pageTeamStatus.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'team-detail') {
        if (pageTeamDetail) { if (typeof renderTeamDetail === 'function') renderTeamDetail(); pageTeamDetail.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'works') {
        if (pageWorks) { if (typeof renderWorksGallery === 'function') renderWorksGallery(); pageWorks.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'work-detail') {
        if (pageWorkDetail) { if (typeof renderWorkDetail === 'function') renderWorkDetail(); pageWorkDetail.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'apply') {
        if (pageApply) { if (typeof renderApply === 'function') renderApply(); pageApply.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'applicants') {
        if (pageApplicants) { if (typeof renderApplicants === 'function') renderApplicants(); pageApplicants.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'bus-info') {
        if (pageBusInfo) { if (typeof renderBusInfo === 'function') renderBusInfo(); pageBusInfo.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'accommodation') {
        if (pageAccommodation) { if (typeof renderAccommodation === 'function') renderAccommodation(); pageAccommodation.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'campus-map') {
        if (pageCampusMap) { pageCampusMap.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'cau-facility') {
        if (pageCauFacility) { pageCauFacility.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'cau-dorm') {
        if (pageCauDorm) { if (typeof renderCauDorm === 'function') renderCauDorm(); pageCauDorm.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    } else if (pageId === 'cau-campus-map') {
        if (pageCauCampusMap) { pageCauCampusMap.classList.remove('hidden'); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if (pageId === 'landing') {
        page1.classList.remove('hidden');
        document.getElementById('theme-select-landing').value = currentTheme;
    } else if (pageId === 'schedule-online') {
        pageOnline.classList.remove('hidden');
        document.getElementById('theme-select-online').value = currentTheme;
    } else if (pageId === 'schedule-busan') {
        pageBusan.classList.remove('hidden');
        document.getElementById('theme-select-busan').value = currentTheme;
    } else if (pageId === 'schedule-cau') {
        if (pageCau) pageCau.classList.remove('hidden');
        const cauSel = document.getElementById('theme-select-cau');
        if (cauSel) cauSel.value = currentTheme;
    } else if (pageId === 'teams') {
        pageTeams.classList.remove('hidden');
        document.getElementById('theme-select').value = currentTheme;
        if (typeof applyBoardHeader === 'function') applyBoardHeader(); // 카테고리별 제목
        renderTeams();
        // 지원 기간/정원/내 지원 상태를 받아와 카드에 반영(보드에서 바로 지원)
        if (typeof refreshTeamApplyState === 'function') {
            refreshTeamApplyState().then(() => {
                if (!pageTeams.classList.contains('hidden')) renderTeams(searchInput ? searchInput.value : '');
            });
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Modal Controls
function openPendingModal(targetName) {
    const modal = document.getElementById('pending-modal');
    const targetEl = document.getElementById('modal-target');
    const modalBox = document.getElementById('modal-box');

    targetEl.textContent = `[${targetName}]`;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modalBox.classList.remove('scale-95');
        modalBox.classList.add('scale-100');
    }, 10);
}

function closePendingModal() {
    const modal = document.getElementById('pending-modal');
    const modalBox = document.getElementById('modal-box');

    modalBox.classList.remove('scale-100');
    modalBox.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 150);
}

// 2. Main Render Engine for Teams
function renderTeams(filter = '') {
    if (!teamsContainer) return;
    updateStats(); // 상단 통계는 항상 전체 teams 기준
    // 워크숍 차수별 진행 결과 발표 보드: 팀 배치 현황 기준으로 팀 카드 표시(지원 정보 제외)
    if (typeof currentWorksCat === 'function' && currentWorksCat() === 'result') {
        const ab = document.getElementById('apply-banner'); if (ab) ab.remove();
        renderResultTeamsBoard(filter);
        return;
    }
    renderApplyBanner(); // 공학생 지원 안내(로그인 공학생만)
    teamsContainer.innerHTML = '';

    const filteredTeams = teams.filter(team => {
        const searchLower = filter.toLowerCase();
        const matchesTeamName = team.name.toLowerCase().includes(searchLower);
        const matchesMember = team.members.some(member => member.toLowerCase().includes(searchLower));
        const matchesCode = team.code.toLowerCase().includes(searchLower);
        return matchesTeamName || matchesMember || matchesCode;
    });

    if (filteredTeams.length === 0) {
        noResults.classList.remove('hidden');
        teamsContainer.classList.add('hidden');
        return;
    } else {
        noResults.classList.add('hidden');
        teamsContainer.classList.remove('hidden');
    }

    if (currentView === 'grid') {
        teamsContainer.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6";

        filteredTeams.forEach(team => {
            const isThreeMembers = team.members.length === 3;
            const card = document.createElement('div');

            let themeCardClass = "bg-white border border-neutral-200 hover:shadow-xl hover:-translate-y-1";
            let badgeClass = "bg-neutral-100 text-neutral-900 border border-neutral-300";
            let accentLine = "bg-blue-600";

            if (currentTheme === 'dark') {
                themeCardClass = "bg-[#1F1F23] border border-neutral-800 hover:border-lime-400 hover:shadow-2xl hover:shadow-lime-950/20";
                badgeClass = "bg-neutral-800 text-neutral-100 border border-neutral-700";
                accentLine = "bg-lime-400";
            } else if (currentTheme === 'bauhaus') {
                themeCardClass = "bg-white border-2 border-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all";
                badgeClass = "bg-neutral-100 text-black border border-black";
                accentLine = team.id === 'E' ? 'bg-red-500' : 'bg-yellow-400';
            }

            card.className = `print-card group p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden min-h-[220px] ${themeCardClass}`;

            card.innerHTML = `
                <!-- Absolute Minimal Graphic Element -->
                <div class="absolute top-0 left-0 w-full h-[6px] ${accentLine}"></div>

                <div>
                    <!-- Header Element: Small Korean, Large Uppercase English Team Code -->
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <span class="text-xs tracking-widest font-bold opacity-50 block">${team.name}</span>
                            <h3 class="text-3xl font-black font-eng mt-1 tracking-tight leading-none">${team.code.toUpperCase()}</h3>
                        </div>
                        <span class="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${isThreeMembers ? 'bg-rose-100 text-rose-800' : 'bg-neutral-100 text-neutral-800'}">
                            ${team.members.length} Designers
                        </span>
                    </div>
                </div>

                <!-- Core Roster List -->
                <div class="mt-auto">
                    <span class="text-xs block uppercase tracking-widest font-extrabold opacity-70 mb-2">Assignees</span>
                    <div class="flex flex-wrap gap-1.5">
                        ${team.members.map(member => `
                            <span class="text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${badgeClass}">
                                <span class="w-1.5 h-1.5 rounded-full ${accentLine}"></span>
                                ${member}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
            const _f = teamSlotsApplyHtml(team);
            card.innerHTML += `<div class="mt-4 pt-3 border-t border-neutral-200/60 flex items-center justify-between gap-2">
                <span class="text-[11px] font-bold opacity-50">${_f.slots}</span>
                <span class="flex items-center gap-2">${_f.ctrl}<span class="text-[11px] font-bold uppercase tracking-wider opacity-40 group-hover:opacity-90 group-hover:text-blue-600 transition-all">작품 보기 →</span></span>
            </div>`;
            card.style.cursor = 'pointer';
            card.setAttribute('role', 'button');
            card.onclick = () => { if (typeof openTeamDetail === 'function') openTeamDetail(team.id); };
            teamsContainer.appendChild(card);
        });
    } else {
        teamsContainer.className = "flex flex-col gap-3";

        filteredTeams.forEach(team => {
            const row = document.createElement('div');
            const _f = teamSlotsApplyHtml(team);

            let rowClass = "bg-white border border-neutral-200 hover:border-blue-600";
            let badgeClass = "bg-neutral-100 text-neutral-900 border border-neutral-200";
            let codeColor = "text-blue-600";

            if (currentTheme === 'dark') {
                rowClass = "bg-[#1F1F23] border border-neutral-800 hover:border-lime-400";
                badgeClass = "bg-neutral-800 text-neutral-100 border border-neutral-700";
                codeColor = "text-lime-400";
            } else if (currentTheme === 'bauhaus') {
                rowClass = "bg-white border-2 border-black hover:bg-neutral-50 text-black";
                badgeClass = "bg-neutral-100 text-black border border-black";
                codeColor = "text-red-500";
            }

            row.className = `print-card px-6 py-5 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-200 ${rowClass}`;

            row.innerHTML = `
                <div class="flex items-center gap-6">
                    <div class="min-w-[120px]">
                        <span class="text-xs font-bold ${codeColor} block tracking-wider opacity-60">${team.name}</span>
                        <h3 class="text-2xl font-black font-eng leading-none mt-1">${team.code.toUpperCase()}</h3>
                    </div>
                </div>

                <div class="flex items-center gap-4 w-full md:w-auto">
                    <div class="flex flex-wrap gap-1.5 w-full md:w-auto justify-start md:justify-end">
                        ${team.members.map(member => `
                            <span class="text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${badgeClass}">
                                <span class="w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
                                ${member}
                            </span>
                        `).join('')}
                    </div>
                    <span class="text-[11px] font-bold opacity-50 whitespace-nowrap">${_f.slots}</span>
                    ${_f.ctrl}
                    <span class="text-[11px] font-bold uppercase tracking-wider opacity-40 group-hover:opacity-90 group-hover:text-blue-600 transition-all whitespace-nowrap">작품 보기 →</span>
                </div>
            `;
            row.classList.add('group');
            row.style.cursor = 'pointer';
            row.setAttribute('role', 'button');
            row.onclick = () => { if (typeof openTeamDetail === 'function') openTeamDetail(team.id); };
            teamsContainer.appendChild(row);
        });
    }
}

// 워크숍 차수별 진행 결과 발표 보드: 팀 배치 현황 기준 팀 카드(팀원 + 지도교수).
//  · 팀원 = teams.members (사용자 관리 기준으로 동기화된 디자이너+공학생 명단)
//  · 지도교수 = teams.advisingProfessors (관리자가 '지도교수 공개' 한 경우에만 표시)
//  · 공학생 지원 정원/잔여 등 지원 관련 표시는 제외. 클릭 시 결과 상세로 이동.
function renderResultTeamsBoard(filter = '') {
    if (!teamsContainer) return;
    const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => s);
    const profPub = (typeof professorsPublic !== 'undefined') ? professorsPublic : false;
    const q = (filter || '').toLowerCase();
    const list = teams.filter(t => {
        if (!q) return true;
        const roster = (typeof teamRoster === 'function') ? teamRoster(t) : (t.members || []).concat(t.engineers || []);
        return (t.name || '').toLowerCase().includes(q)
            || (t.code || '').toLowerCase().includes(q)
            || roster.some(m => String(m).toLowerCase().includes(q));
    });
    if (!list.length) {
        if (noResults) noResults.classList.remove('hidden');
        teamsContainer.classList.add('hidden');
        return;
    }
    if (noResults) noResults.classList.add('hidden');
    teamsContainer.classList.remove('hidden');
    teamsContainer.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    teamsContainer.innerHTML = '';

    const chip = (txt, cls) => `<span class="text-xs font-bold px-2.5 py-1 rounded-lg ${cls}">${esc(txt)}</span>`;
    // 팀 구성은 '팀 배치 현황/관리'와 동일한 단일 함수로 산출(관리자=계정 기준).
    const ctx = (typeof teamRosterCtx !== 'undefined') ? teamRosterCtx : { users: null, apps: [] };
    const isAdmin = (typeof currentProfile !== 'undefined') && currentProfile && currentProfile.role === 'admin';
    list.forEach(team => {
        const rm = (typeof teamRosterForDisplay === 'function')
            ? teamRosterForDisplay(team, ctx, teams)
            : { designers: (team.members || []), engineers: (team.engineers || []), profs: (team.advisingProfessors || []) };
        // 팀원 = 디자이너 + 공학생
        const members = rm.designers.concat(rm.engineers);
        const profs = rm.profs || [];
        const membersHtml = members.length
            ? members.map(m => chip(m, 'bg-neutral-100 text-neutral-800')).join(' ')
            : '<span class="text-xs text-neutral-400">팀원 없음</span>';
        // 지도교수: 관리자는 항상 표시(계정 기준), 그 외는 공개 설정일 때만
        const profHtml = (isAdmin || profPub)
            ? (profs.length ? profs.map(p => chip(p, 'bg-violet-50 text-violet-700')).join(' ') : '<span class="text-xs text-neutral-400">미배정</span>')
            : '<span class="text-xs text-neutral-400">비공개</span>';
        const card = document.createElement('div');
        // 사전주제제안 보드(파랑)와 구분되도록 앰버/짙은 색 포인트 사용
        card.className = 'print-card group bg-white border border-neutral-200 hover:border-amber-500 hover:shadow-md rounded-2xl p-6 transition-all flex flex-col relative overflow-hidden';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="absolute top-0 left-0 w-full h-[5px] bg-amber-400"></div>
            <div class="flex items-center justify-between mb-4 mt-1">
                <div>
                    <span class="text-xs tracking-widest font-bold opacity-50 block">${esc(team.name || team.id)}</span>
                    <h3 class="text-2xl font-black font-eng mt-1 tracking-tight leading-none">${esc(String(team.code || team.id || '').toUpperCase())}</h3>
                </div>
                <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">${members.length} 팀원</span>
            </div>
            <div class="space-y-3">
                <div>
                    <p class="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-1.5">팀원</p>
                    <div class="flex flex-wrap gap-1.5">${membersHtml}</div>
                </div>
                <div>
                    <p class="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-1.5">지도 교수</p>
                    <div class="flex flex-wrap gap-1.5">${profHtml}</div>
                </div>
            </div>
            <div class="mt-4 pt-3 border-t border-neutral-200/60 text-right">
                <span class="text-[11px] font-bold uppercase tracking-wider opacity-40 group-hover:opacity-90 group-hover:text-amber-600 transition-all">진행 결과 보기 →</span>
            </div>`;
        card.setAttribute('role', 'button');
        card.onclick = () => { if (typeof openTeamDetail === 'function') openTeamDetail(team.id); };
        teamsContainer.appendChild(card);
    });
}

// 3. Set Active View Structure (Grid / List)
function setView(view) {
    currentView = view;
    const gridBtn = document.getElementById('view-grid');
    const listBtn = document.getElementById('view-list');

    if (view === 'grid') {
        gridBtn.className = "px-3 py-1.5 rounded-md bg-white shadow-sm transition-all text-black";
        listBtn.className = "px-3 py-1.5 rounded-md text-neutral-600 hover:text-black transition-all";
    } else {
        listBtn.className = "px-3 py-1.5 rounded-md bg-white shadow-sm transition-all text-black";
        gridBtn.className = "px-3 py-1.5 rounded-md text-neutral-600 hover:text-black transition-all";
    }
    renderTeams(searchInput.value);
}

// 4. Color Theme Presets
function changeTheme(theme) {
    currentTheme = theme;
    const body = document.getElementById('body-theme');
    const dot = document.getElementById('theme-dot');
    const landingDot = document.getElementById('landing-dot');
    const onlineDot = document.getElementById('theme-dot-online');
    const busanDot = document.getElementById('theme-dot-busan');
    const cauDot = document.getElementById('theme-dot-cau');
    const stats = ['stat-1', 'stat-2', 'stat-3'];
    const busanCards = ['busan-card-1', 'busan-card-2', 'busan-card-3'];
    const cauCards = ['cau-card-1', 'cau-card-2', 'cau-card-3'];
    const onlineCards = ['online-card-1'];
    const navMnm = document.getElementById('nav-mnm');
    const navTeams = document.getElementById('nav-teams');
    const schedules = ['tab-4'];
    const tab1 = document.getElementById('tab-1');
    const tab2 = document.getElementById('tab-2');
    const tab3 = document.getElementById('tab-3');

    // Sync theme selectors
    document.getElementById('theme-select').value = theme;
    document.getElementById('theme-select-landing').value = theme;
    document.getElementById('theme-select-online').value = theme;
    document.getElementById('theme-select-busan').value = theme;
    const _cauSel = document.getElementById('theme-select-cau');
    if (_cauSel) _cauSel.value = theme;

    // Base configurations reset
    body.className = "min-h-screen transition-colors duration-500 ";

    stats.forEach(id => {
        document.getElementById(id).className = "border p-5 rounded-xl transition-all ";
    });
    [...busanCards, ...cauCards, ...onlineCards].forEach(id => {
        if(document.getElementById(id)) {
            document.getElementById(id).className = "print-card p-6 md:p-8 rounded-2xl transition-all ";
        }
    });

    if (theme === 'swiss') {
        body.className += "bg-[#F8F9FA] text-[#111111]";
        dot.className = "inline-block w-3 h-3 bg-blue-600 rounded-full animate-pulse";
        landingDot.className = "inline-block w-3 h-3 bg-blue-600 rounded-full animate-pulse";
        onlineDot.className = "inline-block w-3 h-3 bg-blue-600 rounded-full animate-pulse";
        busanDot.className = "inline-block w-3 h-3 bg-blue-600 rounded-full animate-pulse";
        if (cauDot) cauDot.className = "inline-block w-3 h-3 bg-blue-600 rounded-full animate-pulse";

        stats.forEach(id => { document.getElementById(id).className += "border-neutral-200 bg-white"; });
        [...busanCards, ...cauCards, ...onlineCards].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).className += "border border-neutral-200 bg-white";
        });

        navMnm.className = "group border-2 border-current bg-white rounded-2xl p-8 flex flex-col justify-between transition-all hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1";
        navTeams.className = "group border-2 border-current bg-[#0055FF] text-white rounded-2xl p-8 flex flex-col justify-between transition-all hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1";

        schedules.forEach(id => {
            document.getElementById(id).className = "group border border-neutral-300 bg-white hover:border-black p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-md";
        });
        tab1.className = "group border border-neutral-300 bg-white hover:border-blue-600 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-md relative overflow-hidden";
        tab2.className = "group border border-neutral-300 bg-white hover:border-blue-600 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-md relative overflow-hidden";
        if (tab3) tab3.className = "group border border-neutral-300 bg-white hover:border-blue-600 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-md relative overflow-hidden";
    }
    else if (theme === 'dark') {
        body.className += "bg-[#121214] text-[#F3F4F6]";
        dot.className = "inline-block w-3 h-3 bg-lime-400 rounded-full animate-pulse";
        landingDot.className = "inline-block w-3 h-3 bg-lime-400 rounded-full animate-pulse";
        onlineDot.className = "inline-block w-3 h-3 bg-lime-400 rounded-full animate-pulse";
        busanDot.className = "inline-block w-3 h-3 bg-lime-400 rounded-full animate-pulse";
        if (cauDot) cauDot.className = "inline-block w-3 h-3 bg-lime-400 rounded-full animate-pulse";

        stats.forEach(id => { document.getElementById(id).className += "border-neutral-800 bg-[#1F1F23]"; });
        [...busanCards, ...cauCards, ...onlineCards].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).className += "border border-neutral-800 bg-[#1F1F23]";
        });

        navMnm.className = "group border-2 border-neutral-800 bg-[#1F1F23] rounded-2xl p-8 flex flex-col justify-between transition-all hover:border-lime-400 hover:shadow-2xl hover:shadow-lime-950/20 hover:-translate-y-1";
        navTeams.className = "group border-2 border-[#1F1F23] bg-[#0055FF] text-white rounded-2xl p-8 flex flex-col justify-between transition-all hover:border-lime-400 hover:shadow-2xl hover:shadow-lime-950/20 hover:-translate-y-1";

        schedules.forEach(id => {
            document.getElementById(id).className = "group border border-neutral-800 bg-[#1F1F23] text-white hover:border-lime-400 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-md";
        });
        tab1.className = "group border border-neutral-800 bg-[#1F1F23] text-white hover:border-blue-500 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-md relative overflow-hidden";
        tab2.className = "group border border-neutral-800 bg-[#1F1F23] text-white hover:border-blue-500 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-md relative overflow-hidden";
        if (tab3) tab3.className = "group border border-neutral-800 bg-[#1F1F23] text-white hover:border-blue-500 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-md relative overflow-hidden";
    }
    else if (theme === 'bauhaus') {
        body.className += "bg-[#EAEAEA] text-black";
        dot.className = "inline-block w-3 h-3 bg-red-600 rounded-full";
        landingDot.className = "inline-block w-3 h-3 bg-red-600 rounded-full";
        onlineDot.className = "inline-block w-3 h-3 bg-red-600 rounded-full";
        busanDot.className = "inline-block w-3 h-3 bg-red-600 rounded-full";
        if (cauDot) cauDot.className = "inline-block w-3 h-3 bg-red-600 rounded-full";

        stats.forEach(id => { document.getElementById(id).className += "border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"; });
        [...busanCards, ...cauCards, ...onlineCards].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).className += "border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]";
        });

        navMnm.className = "group border-2 border-black bg-white rounded-2xl p-8 flex flex-col justify-between transition-all hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1";
        navTeams.className = "group border-2 border-black bg-red-500 text-white rounded-2xl p-8 flex flex-col justify-between transition-all hover:shadow-[8px_8px_0px_0px_rgba(239,68,68,1)] hover:-translate-y-1";

        schedules.forEach(id => {
            document.getElementById(id).className = "group border-2 border-black bg-white hover:bg-yellow-300 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]";
        });
        tab1.className = "group border-2 border-black bg-white hover:bg-blue-100 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden";
        tab2.className = "group border-2 border-black bg-white hover:bg-blue-100 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden";
        if (tab3) tab3.className = "group border-2 border-black bg-white hover:bg-blue-100 p-5 rounded-xl flex items-center justify-between text-left transition-all hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden";
    }

    renderTeams(searchInput.value);
}

// 5. Search Trigger Integration
searchInput.addEventListener('input', (e) => {
    renderTeams(e.target.value);
});

// 6. Firestore 연동: 팀 데이터 불러오기 / 최초 시드
// ------------------------------------------------------------
// db 는 firebase-config.js 에서 정의됩니다.
// (설정 전이면 db === null → 로컬 teams-data.js 폴백 그대로 사용)

// 상단 통계(Total Teams / Total Designers / Avg. Size)를 현재 teams 로 계산해 반영
function updateStats() {
    const totalTeams = teams.length;
    const totalDesigners = teams.reduce((n, t) => n + (t.members ? t.members.length : 0), 0);
    const avg = totalTeams ? (totalDesigners / totalTeams) : 0;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-teams', String(totalTeams).padStart(2, '0'));
    set('stat-designers', String(totalDesigners));
    set('stat-avg', avg.toFixed(1));
}

// Firestore 'teams' 컬렉션에서 팀 목록을 읽어 화면용 teams 배열에 채움
// ⚠️ SDK 의 .get() 대신 REST(fsQuery) 사용 — firebase-config.js 헬퍼 참고.
//   Enterprise 에디션(database1) + 이 네트워크에서 SDK 실시간 채널이 단순
//   read 에 24~40초 걸리는 문제 우회. REST 는 평범한 HTTPS 라 0.3초.
async function loadTeams() {
    if (!FIREBASE_READY) return; // 미설정 시 로컬 teams-data.js 폴백 유지
    const _t0 = performance.now();
    try {
        const docs = await fsQuery('teams', 'id');
        console.log(`[진단] 팀 로드(REST): ${Math.round(performance.now() - _t0)}ms`);
        if (docs.length) {
            teams = docs;
            console.log(`[Firestore/REST] 팀 ${teams.length}개 로드 완료`);
        } else {
            console.warn("[Firestore/REST] 'teams' 컬렉션이 비어있습니다. " +
                         "관리자로 로그인 후 콘솔에서 seedTeams() 를 한 번 실행하세요.");
        }
    } catch (e) {
        console.error("[Firestore/REST] 로드 실패 → 로컬 데이터 사용:", e);
    }
}

// 최초 1회만: 로컬 teams-data.js 의 teamsData 를 Firestore 에 업로드
// 사용법: 브라우저 개발자도구(F12) 콘솔에 seedTeams() 입력 후 Enter
async function seedTeams() {
    if (!FIREBASE_READY) {
        console.error("Firebase 미설정 상태입니다. 먼저 firebase-config.js 의 설정값을 채우세요.");
        return;
    }
    try {
        console.log(`[Firestore] 업로드 시작… (${teamsData.length}개) — REST, 관리자 권한 필요`);
        // SDK batch 대신 REST(fsSet) — Enterprise 에디션 SDK 지연 우회. 쓰기는 규칙상 admin 만.
        for (const t of teamsData) {
            // teamsData 는 이제 masterTeamDoc 형태(디자이너·공학생·지도교수·정원 포함)
            await fsSet(`teams/${t.id}`, {
                id: t.id, name: t.name, code: t.code,
                members: t.members, engineers: t.engineers || [],
                professorsRoster: t.professorsRoster || [],
                designProfs: t.designProfs || [], engProfs: t.engProfs || [],
                capacity: t.capacity || 0,
            });
        }
        const check = await fsQuery('teams', 'id');
        console.log(`[Firestore] ✅ 업로드 완료! 현재 'teams' 문서 ${check.length}개 확인됨. 새로고침하세요.`);
    } catch (e) {
        console.error("[Firestore] ❌ 업로드 실패:", e.code || "", e.message || e);
        console.error("→ permission-denied 면 admin 계정으로 로그인했는지 확인하세요.");
    }
}
window.seedTeams = seedTeams; // 콘솔에서 호출 가능하도록 전역 노출

// 뒤로/앞으로 가기: 저장해둔 상태로 화면 복원(중복 push 없이)
window.addEventListener('popstate', function(e) {
    const st = e.state;
    _suppressHistory = true;
    try {
        if (st && st._spa && st.pageId) {
            if (st.workCtx && typeof workCtx !== 'undefined') workCtx = st.workCtx;
            if (st.authMode && typeof authMode !== 'undefined') authMode = st.authMode;
            navigateTo(st.pageId);
        } else {
            navigateTo('landing'); // 초기/알 수 없는 상태 → 메인
        }
    } finally {
        _suppressHistory = false;
    }
});

// Init on Load
window.onload = async function() {
    // 첫 화면(랜딩)을 history 시작점으로 기록 → 이후 뒤로가기가 자연스럽게 동작
    if (typeof history !== 'undefined' && history.replaceState) {
        try { history.replaceState(_histState('landing'), ''); } catch (_) {}
    }
    if (typeof initAuth === 'function') initAuth(); // 인증 상태 감지 시작
    await loadTeams();
    if (typeof loadRosterPublic === 'function') { try { await loadRosterPublic(); } catch (_) {} } // 명단 공개여부 선로딩
    renderTeams();
}
