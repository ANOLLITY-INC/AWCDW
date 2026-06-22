// ============================================================
//  공학생 지원 시스템 (Phase 4) — 선착순 즉시 배정
// ------------------------------------------------------------
//  · 공학생: 지원 페이지(#apply-page)에서 팀을 직접 신청 → 정원(기본 3) 남아 있으면
//    즉시 배정·마감 표시. 1인 1지원(문서ID = engineerId). 변경/취소 가능.
//  · 관리자/교수/디자이너: 지원자 명단(#applicants-page) — 팀별 배정 현황.
//    관리자는 제거(배정 취소) 가능, 디자이너는 본인 팀만.
//
//  ⚠️ 동시성: REST 환경이라 완전한 트랜잭션 잠금은 없음. 신청 직전 정원을 다시 확인하고,
//     드물게 동시 클릭으로 정원이 초과되면 관리자가 「지원 현황」에서 조정한다(문서화됨).
//
//  applications/{engineerId} 스키마(SYSTEM_DESIGN 5.5 + 비정규화):
//    { id, engineerId, engineerName, university, department, studentId,
//      assignedTeamId, status:'assigned', preferences:[{rank,teamId}], createdAt, updatedAt }
//
//  전역(다른 파일): escapeHtml, currentUser, currentProfile, teams, teamMeta(works.js),
//    navigateTo, openAuth, fs* 헬퍼.
// ============================================================

const DEFAULT_TEAM_CAPACITY = 3;

// ------------------------------------------------------------
// 앱 설정 (settings/app) — 지원 기간 + 명단 공개 여부. 관리자가 설정.
//   { rosterPublic:bool, applyStart:"YYYY-MM-DDTHH:mm", applyEnd:"..." }
// ------------------------------------------------------------
let rosterPublic = false;   // 지원자 명단 학생 공개 여부
let previewStart = "";      // 지원 '미리보기' 시작 일시 — 이 시각부터 지원 UI는 보이되 실제 지원은 불가
let applyStart = "";        // 지원 시작 일시(datetime-local 문자열, 로컬시간) — 실제 지원 가능
let applyEnd = "";          // 지원 마감 일시
let applyOpen = false;      // 현재 지원 접수 중인지(계산값)
let applyPreview = false;   // 현재 미리보기 구간인지(계산값) — 화면은 보이되 지원은 불가

function _fmtDateTime(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
// 현재 지원 상태: { open, preview, phase:'unset'|'before'|'preview'|'open'|'after', label }
//   preview: 미리보기 시작 시각 이후 ~ 지원 시작 시각 이전 → 지원 화면은 보이지만 실제 지원은 막는다.
function applyStatusInfo() {
    const now = new Date();
    const p = previewStart ? new Date(previewStart) : null;
    const s = applyStart ? new Date(applyStart) : null;
    const e = applyEnd ? new Date(applyEnd) : null;
    if (!p && !s && !e) return { open: false, preview: false, phase: "unset", label: "지원 기간이 설정되지 않았습니다." };
    if (e && now > e) return { open: false, preview: false, phase: "after", label: `지원이 마감되었습니다 (마감: ${_fmtDateTime(e)})` };
    if (s && now >= s) return { open: true, preview: false, phase: "open", label: `지원 접수 중${e ? ` (마감: ${_fmtDateTime(e)})` : ""}` };
    // 여기부터는 지원 시작 전(now < s) 또는 s 미설정 구간
    if (p && s && now >= p) return { open: false, preview: true, phase: "preview", label: `지원 미리보기 중 — 지원 방법을 미리 확인할 수 있습니다. 실제 지원은 ${_fmtDateTime(s)}부터 가능합니다.` };
    if (s) return { open: false, preview: false, phase: "before", label: `지원 시작 전입니다 (시작: ${_fmtDateTime(s)}${p ? `, 미리보기: ${_fmtDateTime(p)}` : ""})` };
    // s 미설정 + e 만 있는 경우는 기존처럼 접수중 취급
    return { open: true, preview: false, phase: "open", label: `지원 접수 중${e ? ` (마감: ${_fmtDateTime(e)})` : ""}` };
}

async function loadAppSettings() {
    try {
        const s = await fsGet("settings/app");
        rosterPublic = !!(s && s.rosterPublic);
        previewStart = (s && s.previewStart) || "";
        applyStart = (s && s.applyStart) || "";
        applyEnd = (s && s.applyEnd) || "";
    } catch (_) { /* 기본값 유지 */ }
    const st = applyStatusInfo();
    applyOpen = st.open;
    applyPreview = st.preview;
    return { rosterPublic, applyOpen, applyPreview };
}
// 기존 호출부 호환용 별칭
async function loadRosterPublic() { await loadAppSettings(); return rosterPublic; }
async function loadApplyWindow() { await loadAppSettings(); return applyOpen; }
window.loadRosterPublic = loadRosterPublic;
window.loadApplyWindow = loadApplyWindow;

async function toggleRosterPublic() {
    try {
        await fsUpdate("settings/app", { rosterPublic: !rosterPublic }); // 다른 필드 보존
        rosterPublic = !rosterPublic;
        await renderApplicants();
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "권한이 없습니다. (관리자 전용)"
            : (err.code || err.message || "변경에 실패했습니다."));
    }
}
window.toggleRosterPublic = toggleRosterPublic;

// 미리보기 구간에 지원을 시도했을 때의 안내
function previewNotice() {
    const st = applyStatusInfo();
    window.alert(st.label || "아직 지원 기간이 아닙니다. 지원 시작 후 신청할 수 있습니다.");
}
window.previewNotice = previewNotice;

async function saveApplyWindow() {
    const pEl = document.getElementById("apply-preview-start");
    const sEl = document.getElementById("apply-start");
    const eEl = document.getElementById("apply-end");
    const pV = pEl ? pEl.value : "";
    const sV = sEl ? sEl.value : "";
    const eV = eEl ? eEl.value : "";
    if (sV && eV && new Date(sV) > new Date(eV)) { window.alert("시작 일시가 마감 일시보다 늦습니다."); return; }
    if (pV && !sV) { window.alert("미리보기 시작을 쓰려면 지원 ‘시작 일시’도 설정해야 합니다."); return; }
    if (pV && sV && new Date(pV) > new Date(sV)) { window.alert("미리보기 시작이 지원 시작 일시보다 늦습니다."); return; }
    try {
        await fsUpdate("settings/app", { previewStart: pV, applyStart: sV, applyEnd: eV }); // rosterPublic 보존
        previewStart = pV; applyStart = sV; applyEnd = eV;
        const st = applyStatusInfo(); applyOpen = st.open; applyPreview = st.preview;
        await renderApplicants();
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "권한이 없습니다. (관리자 전용)"
            : (err.code || err.message || "저장에 실패했습니다."));
    }
}
window.saveApplyWindow = saveApplyWindow;

function applyWindowAdminHtml() {
    const st = applyStatusInfo();
    return `
        <div class="bg-white border-2 border-neutral-300 rounded-2xl p-5 mb-6">
            <p class="font-extrabold mb-1">지원 기간 설정</p>
            <p class="text-xs ${st.open ? "text-emerald-600" : st.preview ? "text-amber-600" : "text-neutral-500"} font-bold mb-3">${escapeHtml(st.label)}</p>
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                <label class="block text-xs font-bold text-amber-700 mb-1">지원 미리보기 시작 일시 <span class="font-semibold opacity-70">(선택)</span></label>
                <input id="apply-preview-start" type="datetime-local" value="${escapeHtml(previewStart)}" class="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                <p class="text-[11px] text-amber-700/80 mt-1.5">이 시각부터 학생이 <b>지원 화면과 방법을 미리</b> 볼 수 있습니다. 단, <b>실제 지원(신청)은 아래 ‘시작 일시’부터</b> 가능합니다. 비워두면 미리보기 없이 바로 ‘시작 일시’에 지원이 열립니다.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="block text-xs font-bold text-neutral-500 mb-1">지원 시작 일시</label>
                    <input id="apply-start" type="datetime-local" value="${escapeHtml(applyStart)}" class="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                </div>
                <div>
                    <label class="block text-xs font-bold text-neutral-500 mb-1">마감 일시</label>
                    <input id="apply-end" type="datetime-local" value="${escapeHtml(applyEnd)}" class="w-full border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                </div>
            </div>
            <button onclick="saveApplyWindow()" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all">기간 저장</button>
            <p class="text-[11px] text-neutral-400 mt-2">‘지원 시작 ~ 마감’ 기간 중에는 공학생이 <b>팀 보드</b>와 「팀 지원」에서 신청할 수 있습니다. 시작/마감을 모두 비우면 지원이 닫힙니다.</p>
        </div>`;
}

function publishToggleHtml() {
    return `
        <div class="bg-white border-2 ${rosterPublic ? "border-emerald-500" : "border-neutral-300"} rounded-2xl p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <p class="font-extrabold">${rosterPublic ? "학생에게 공개됨 ✅" : "학생에게 비공개 (관리자·교수만)"}</p>
                <p class="text-xs text-neutral-500 mt-1">공개하면 공학·디자인 학생 모두 대시보드 「팀 배정 결과」에서 이 명단을 볼 수 있습니다.</p>
            </div>
            <button onclick="toggleRosterPublic()" class="${rosterPublic ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-700" : "bg-blue-600 hover:bg-blue-700 text-white"} font-bold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap">${rosterPublic ? "비공개로 전환" : "학생에게 공개"}</button>
        </div>`;
}

function teamCapacity(team) {
    const c = team && team.capacity;
    const n = (c === 0 || c) ? parseInt(c, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TEAM_CAPACITY;
}
function teamList() {
    return (typeof teams !== "undefined" && Array.isArray(teams)) ? teams : [];
}
async function loadAllApplications() {
    return await fsQuery("applications"); // 로그인 사용자 전체 read 허용
}
function countByTeam(apps) {
    const m = {};
    (apps || []).forEach(a => {
        if (a.status === "assigned" && a.assignedTeamId) m[a.assignedTeamId] = (m[a.assignedTeamId] || 0) + 1;
    });
    return m;
}

// ------------------------------------------------------------
// 진입점
// ------------------------------------------------------------
function openApply() { navigateTo("apply"); }
window.openApply = openApply;
function openApplicants() { navigateTo("applicants"); }
window.openApplicants = openApplicants;

// ------------------------------------------------------------
// 공학생 지원 페이지
// ------------------------------------------------------------
function applyShell(body) {
    return `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-8">
                <button onclick="navigateTo('dashboard')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 대시보드</button>
                <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">Team Application</span>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">팀 지원</h1>
                <p class="text-sm mt-2 opacity-70">희망 팀을 선택해 신청하세요. 정원이 남은 팀에 즉시 배정되며, 정원이 차면 마감됩니다.</p>
            </header>
            ${body}</div>`;
}

async function renderApply() {
    const page = document.getElementById("apply-page");
    if (!page) return;
    if (!currentUser || !currentProfile) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold mb-4">로그인이 필요합니다.</p>
                <button onclick="openAuth('login')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">로그인 / 가입</button>
                <div class="mt-4"><button onclick="navigateTo('landing')" class="text-sm text-neutral-500 hover:underline">메인으로</button></div>
            </div>`;
        return;
    }
    if (currentProfile.role !== "engineer") {
        page.innerHTML = applyShell(`
            <div class="py-16 text-center">
                <p class="text-lg font-bold mb-2">공학 학생 전용 기능입니다.</p>
                <p class="text-sm text-neutral-500 mb-6">팀 지원은 공학 학생(engineer) 계정만 사용할 수 있습니다.${(currentProfile.role === "admin" || currentProfile.role === "professor") ? " 배정 현황은 「지원자 명단」에서 볼 수 있습니다." : ""}</p>
                ${(currentProfile.role === "admin" || currentProfile.role === "professor") ? `<button onclick="openApplicants()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">지원자 명단 보기</button>` : `<button onclick="navigateTo('dashboard')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">대시보드로</button>`}
            </div>`);
        return;
    }

    page.innerHTML = applyShell(`<div class="py-20 text-center text-neutral-400 font-bold">불러오는 중…</div>`);
    await loadApplyWindow(); // 지원 기간 상태 최신화
    let apps = [];
    try { apps = await loadAllApplications(); }
    catch (e) {
        page.innerHTML = applyShell(`
            <div class="py-16 text-center">
                <p class="text-rose-600 font-bold mb-2">지원 현황을 불러오지 못했습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">${escapeHtml(e.code || e.message || e)}</p>
                <button onclick="renderApply()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">다시 시도</button>
            </div>`);
        return;
    }
    drawApply(apps);
}
window.renderApply = renderApply;

function drawApply(apps) {
    const page = document.getElementById("apply-page");
    if (!page) return;
    const counts = countByTeam(apps);
    const myApp = apps.find(a => a.engineerId === currentUser.uid);
    const myTeamId = myApp && myApp.status === "assigned" ? myApp.assignedTeamId : null;
    const st = applyStatusInfo();
    const uiOpen = st.open || st.preview;   // 미리보기도 '지원 가능' 화면과 동일하게 그린다(아래에서 회색 레이어로 비활성)

    const periodBanner = st.open
        ? `<div class="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6 text-sm font-bold text-blue-800">🟢 ${escapeHtml(st.label)}</div>`
        : st.preview
        ? `<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-sm font-bold text-amber-800">👀 아래는 실제 지원 화면입니다. ${escapeHtml(applyStart ? "지원 시작 " + _fmtDateTime(new Date(applyStart)) + "부터 선택할 수 있습니다." : "")}</div>`
        : `<div class="bg-neutral-100 border border-neutral-300 rounded-xl p-3 mb-6 text-sm font-bold text-neutral-600">⏳ ${escapeHtml(st.label)} · 신청·변경은 지원 기간에만 가능합니다.</div>`;

    const statusBar = myTeamId ? `
        <div class="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
                <p class="text-xs font-bold uppercase tracking-wider text-emerald-700">현재 배정</p>
                <p class="text-lg font-extrabold">${escapeHtml(teamMeta(myTeamId).name || myTeamId)} 에 배정되었습니다</p>
            </div>
            ${st.open ? `<button onclick="cancelApplication()" class="bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 font-bold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap">배정 취소</button>` : ""}
        </div>` : `
        <div class="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 mb-8">
            <p class="text-sm font-bold">아직 지원하지 않았습니다.${uiOpen ? " 아래에서 희망 팀의 <b>신청</b> 버튼을 누르세요." : ""}</p>
        </div>`;

    const cards = teamList().map(t => {
        const cap = teamCapacity(t);
        const cnt = counts[t.id] || 0;
        const remain = Math.max(0, cap - cnt);
        const full = cnt >= cap;
        const mine = myTeamId === t.id;
        const ratio = `${cnt}/${cap}`;
        let action;
        if (mine) {
            action = `<span class="text-xs font-black uppercase tracking-wider text-emerald-700">✓ 내 배정 팀</span>`;
        } else if (!uiOpen) {
            action = `<span class="text-xs font-bold text-neutral-400">${st.phase === "before" ? "대기" : st.phase === "after" ? "마감" : "지원 기간 아님"}</span>`;
        } else if (full) {
            action = `<span class="text-xs font-black uppercase tracking-wider text-rose-500">마감</span>`;
        } else {
            const label = myTeamId ? "이 팀으로 변경" : "신청";
            action = `<button onclick="applyToTeam('${escapeHtml(t.id)}')" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-all">${label}</button>`;
        }
        return `
            <div class="border rounded-2xl p-5 transition-all ${mine ? "border-emerald-500 bg-emerald-50/40" : full ? "border-neutral-200 bg-neutral-50 opacity-70" : "border-neutral-200 bg-white hover:border-blue-600"}">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-2xl font-black font-eng">${escapeHtml((t.code || t.id).toUpperCase())}</h3>
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full ${full && !mine ? "bg-rose-100 text-rose-700" : "bg-neutral-100 text-neutral-700"}">${ratio}${remain > 0 ? ` · 잔여 ${remain}` : ""}</span>
                </div>
                <p class="text-sm font-bold mb-1">${escapeHtml(t.name || t.id)}</p>
                <p class="text-xs text-neutral-400 mb-4">디자이너: ${escapeHtml((t.members || []).join(", ") || "-")}</p>
                <div class="flex justify-end">${action}</div>
            </div>`;
    }).join("");

    const grid = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">${cards}</div>`;
    // 미리보기: 실제 지원 화면과 동일하게 그린 뒤 위에 회색 20% 레이어를 덮어 선택 불가 처리
    const gridBlock = st.preview
        ? `<div class="relative">
               <div class="pointer-events-none select-none">${grid}</div>
               <div class="absolute inset-0 bg-neutral-500/20 rounded-2xl cursor-not-allowed" onclick="previewNotice()" title="실제 지원 시작 전입니다"></div>
           </div>`
        : grid;
    page.innerHTML = applyShell(`
        ${periodBanner}
        ${statusBar}
        ${gridBlock}`);
}

// 신청 핵심 로직(지원 페이지·팀 보드 공용). 성공 시 true.
async function applyToTeamCore(teamId) {
    if (!currentUser || currentProfile.role !== "engineer") return false;
    // 지원 기간 확인 (미리보기 구간이면 화면은 보여도 실제 지원은 차단)
    await loadApplyWindow();
    if (!applyOpen) {
        const st = applyStatusInfo();
        window.alert(st.preview
            ? "지금은 지원 미리보기 기간입니다. 실제 지원은 지원 시작 시각부터 가능합니다."
            : "지금은 지원 기간이 아닙니다.");
        return false;
    }
    // 신청 직전 정원 재확인(본인 제외) — 선착순 마감 처리
    let apps;
    try { apps = await loadAllApplications(); }
    catch (e) { window.alert("지원 현황 확인 실패: " + (e.code || e.message || e)); return false; }
    const cap = teamCapacity(teamMeta(teamId));
    const cnt = apps.filter(a => a.status === "assigned" && a.assignedTeamId === teamId && a.engineerId !== currentUser.uid).length;
    if (cnt >= cap) { window.alert("이미 마감된 팀입니다. 다른 팀을 선택해 주세요."); return false; }

    try {
        await fsSet(`applications/${currentUser.uid}`, {
            id: currentUser.uid,
            engineerId: currentUser.uid,
            engineerName: currentProfile.name || "",
            university: currentProfile.university || "",
            department: currentProfile.department || "",
            studentId: currentProfile.studentId || "",
            assignedTeamId: teamId,
            status: "assigned",
            preferences: [{ rank: 1, teamId }],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return true;
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "신청 권한이 없습니다. 공학 학생 계정인지 확인하세요."
            : (err.code || err.message || "신청에 실패했습니다."));
        return false;
    }
}

// 지원 페이지에서 신청
async function applyToTeam(teamId) {
    if (await applyToTeamCore(teamId)) await renderApply();
    else if (typeof renderApply === "function") renderApply();
}
window.applyToTeam = applyToTeam;

// 팀 보드(공개 현황판)에서 바로 신청 → 보드 갱신
async function applyFromBoard(teamId) {
    if (await applyToTeamCore(teamId)) {
        if (typeof refreshTeamApplyState === "function") await refreshTeamApplyState();
        if (typeof renderTeams === "function") renderTeams(typeof searchInput !== "undefined" && searchInput ? searchInput.value : "");
        window.alert(`${teamMeta(teamId).name || teamId} 에 지원되었습니다.`);
    }
}
window.applyFromBoard = applyFromBoard;

// 팀 보드에서 내 지원(배정) 취소
async function cancelFromBoard() {
    if (!currentUser) return;
    if (!window.confirm("지원(배정)을 취소할까요?")) return;
    await loadApplyWindow();
    if (!applyOpen) { window.alert("지금은 지원 기간이 아니어서 취소할 수 없습니다."); return; }
    try {
        await fsDelete(`applications/${currentUser.uid}`);
        if (typeof refreshTeamApplyState === "function") await refreshTeamApplyState();
        if (typeof renderTeams === "function") renderTeams(typeof searchInput !== "undefined" && searchInput ? searchInput.value : "");
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "취소 권한이 없습니다."
            : (err.code || err.message || "취소에 실패했습니다."));
    }
}
window.cancelFromBoard = cancelFromBoard;

// ------------------------------------------------------------
// 팀 상세 페이지(작품 보기로 들어가는 페이지) 안의 지원 패널
//  works.js drawTeamDetail 이 호출. 지원 상태는 refreshTeamApplyState()가
//  채워둔 전역(teamApplyCounts/teamMyTeamId/applyStart·End)을 사용.
// ------------------------------------------------------------
function teamDetailApplyPanel(teamId) {
    const team = teamMeta(teamId);
    const cap = teamCapacity(team);
    const countsKnown = (typeof currentUser !== "undefined" && !!currentUser);
    const cnt = (typeof teamApplyCounts !== "undefined" && teamApplyCounts[teamId]) || 0;
    const remain = Math.max(0, cap - cnt);
    const full = cnt >= cap;
    const isEng = (typeof currentProfile !== "undefined" && currentProfile && currentProfile.role === "engineer");
    const myTeam = (typeof teamMyTeamId !== "undefined") ? teamMyTeamId : null;
    const mineHere = myTeam === teamId;
    const st = applyStatusInfo();

    const uiOpen = st.open || st.preview;   // 미리보기도 '지원 가능' 화면과 동일하게 그린다
    const slotsLine = uiOpen
        ? (countsKnown ? `공학생 ${cnt} / 정원 ${cap}명 · 잔여 ${remain}명` : `공학생 정원 ${cap}명`)
        : st.label;

    let action = "";
    if (isEng) {
        if (uiOpen) {
            if (mineHere) {
                action = `<div class="flex items-center gap-3">
                    <span class="text-sm font-black text-emerald-700">✓ 이 팀에 지원함</span>
                    ${st.open ? `<button onclick="cancelFromDetail()" class="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold px-4 py-2 rounded-lg text-sm transition-all">지원 취소</button>` : ""}
                </div>`;
            } else if (full) {
                action = `<span class="text-sm font-black text-rose-500">마감</span>`;
            } else {
                action = `<button onclick="applyFromDetail('${escapeHtml(teamId)}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-all">${myTeam ? "이 팀으로 변경" : "이 팀에 지원"}</button>`;
            }
        } else if (mineHere) {
            action = `<span class="text-sm font-black text-emerald-700">✓ 이 팀에 지원함</span>`;
        }
    }

    const panel = `
        <div class="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <p class="text-xs font-bold uppercase tracking-wider text-neutral-500">공학생 지원</p>
                <p class="text-lg font-extrabold">${escapeHtml(slotsLine)}</p>
                ${isEng && uiOpen && myTeam && !mineHere ? `<p class="text-xs text-neutral-400 mt-1">현재 ${escapeHtml(teamMeta(myTeam).name || myTeam)}에 지원되어 있습니다.</p>` : ""}
            </div>
            <div>${action}</div>
        </div>`;

    // 미리보기 구간: 실제 지원 화면과 동일 모양 위에 회색 20% 레이어를 덮어 선택 불가 처리
    if (st.preview) {
        return `
            <div class="relative mb-8">
                <div class="pointer-events-none select-none">${panel}</div>
                <div class="absolute inset-0 bg-neutral-500/20 rounded-2xl cursor-not-allowed flex items-start justify-end p-2.5" onclick="previewNotice()">
                    <span class="bg-white/90 text-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">실제 지원 시작 전</span>
                </div>
            </div>`;
    }
    return `<div class="mb-8">${panel}</div>`;
}
window.teamDetailApplyPanel = teamDetailApplyPanel;

async function applyFromDetail(teamId) {
    if (await applyToTeamCore(teamId)) {
        if (typeof renderTeamDetail === "function") await renderTeamDetail();
    }
}
window.applyFromDetail = applyFromDetail;

async function cancelFromDetail() {
    if (!currentUser) return;
    if (!window.confirm("지원(배정)을 취소할까요?")) return;
    await loadApplyWindow();
    if (!applyOpen) { window.alert("지금은 지원 기간이 아니어서 취소할 수 없습니다."); return; }
    try {
        await fsDelete(`applications/${currentUser.uid}`);
        if (typeof renderTeamDetail === "function") await renderTeamDetail();
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "취소 권한이 없습니다."
            : (err.code || err.message || "취소에 실패했습니다."));
    }
}
window.cancelFromDetail = cancelFromDetail;

async function cancelApplication() {
    if (!window.confirm("현재 팀 배정을 취소할까요?")) return;
    try {
        await fsDelete(`applications/${currentUser.uid}`);
        await renderApply();
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "취소 권한이 없습니다."
            : (err.code || err.message || "취소에 실패했습니다."));
    }
}
window.cancelApplication = cancelApplication;

// ------------------------------------------------------------
// 지원자 명단 (관리자/교수/디자이너)
// ------------------------------------------------------------
async function renderApplicants() {
    const page = document.getElementById("applicants-page");
    if (!page) return;
    if (!currentUser || !currentProfile) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold mb-4">로그인이 필요합니다.</p>
                <button onclick="openAuth('login')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">로그인 / 가입</button>
            </div>`;
        return;
    }
    const role = currentProfile.role;
    const isStaff = role === "admin" || role === "professor";
    // 학생(공학/디자인)은 관리자가 공개(rosterPublic)한 이후에만 열람 가능
    await loadRosterPublic();
    if (!isStaff && !rosterPublic) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-24 text-center">
                <div class="text-4xl mb-4">🔒</div>
                <p class="text-lg font-bold mb-2">아직 공개되지 않았습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">팀 배정 명단은 관리자가 공개한 이후에 볼 수 있습니다.</p>
                <button onclick="navigateTo('dashboard')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">대시보드로</button>
            </div>`;
        return;
    }

    page.innerHTML = `<div class="max-w-7xl mx-auto px-6 py-24 text-center text-neutral-400 font-bold">지원자 명단 불러오는 중…</div>`;
    let apps = [];
    try { apps = await loadAllApplications(); }
    catch (e) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold text-rose-600 mb-2">불러오지 못했습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">${escapeHtml(e.code || e.message || e)}</p>
                <button onclick="renderApplicants()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">다시 시도</button>
            </div>`;
        return;
    }
    drawApplicants(apps);
}
window.renderApplicants = renderApplicants;

function drawApplicants(apps) {
    const page = document.getElementById("applicants-page");
    if (!page) return;
    const role = currentProfile.role;
    const isAdmin = role === "admin";
    const isStaff = role === "admin" || role === "professor";

    // 공개된 명단(또는 관리자/교수)은 전체 팀 표시
    const shownTeams = teamList();

    const byTeam = {};
    apps.forEach(a => {
        if (a.status === "assigned" && a.assignedTeamId) (byTeam[a.assignedTeamId] = byTeam[a.assignedTeamId] || []).push(a);
    });

    const blocks = shownTeams.map(t => {
        const cap = teamCapacity(t);
        const list = (byTeam[t.id] || []).slice().sort((x, y) => String(x.createdAt || "").localeCompare(String(y.createdAt || "")));
        const cnt = list.length;
        const full = cnt >= cap;
        const rows = list.length ? list.map((a, i) => `
            <tr class="border-b border-neutral-100">
                <td class="px-4 py-2.5 text-neutral-400 font-eng text-xs">${i + 1}</td>
                <td class="px-4 py-2.5 font-bold">${escapeHtml(a.engineerName || "(이름 없음)")}</td>
                <td class="px-4 py-2.5 text-xs text-neutral-500">${escapeHtml([a.university, a.department, a.studentId].filter(Boolean).join(" · "))}</td>
                <td class="px-4 py-2.5 text-right">${isAdmin ? `<button onclick="removeApplication('${escapeHtml(a.engineerId)}','${escapeHtml((a.engineerName || "").replace(/'/g, ""))}')" class="text-xs font-bold text-rose-600 hover:underline">배정 취소</button>` : ""}</td>
            </tr>`).join("") : `<tr><td colspan="4" class="px-4 py-6 text-center text-neutral-400 text-sm">지원자가 없습니다.</td></tr>`;
        return `
            <div class="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div class="flex items-center justify-between gap-2 px-5 py-4 border-b border-neutral-200 ${full ? "bg-rose-50" : "bg-neutral-50"}">
                    <div class="min-w-0">
                        <span class="font-black font-eng text-lg">${escapeHtml((t.code || t.id).toUpperCase())}</span>
                        <span class="text-sm font-bold ml-2">${escapeHtml(t.name || t.id)}</span>
                    </div>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${full ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}">${cnt}/${cap}${full ? " 마감" : ""}</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-sm text-left min-w-[420px]"><tbody>${rows}</tbody></table>
                </div>
            </div>`;
    }).join("");

    const total = apps.filter(a => a.status === "assigned").length;
    const title = isStaff ? "지원자 명단" : "팀 배정 결과";
    page.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-8">
                <button onclick="navigateTo('dashboard')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 대시보드</button>
                <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">Applicants</span>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">${title}</h1>
                <p class="text-sm mt-2 opacity-70">총 ${total}명 배정됨${isAdmin ? " · 관리자는 배정을 취소하거나 학생 공개를 토글할 수 있습니다." : ""}</p>
            </header>
            ${isAdmin ? applyWindowAdminHtml() : ""}
            ${isAdmin ? publishToggleHtml() : ""}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">${blocks || '<p class="text-neutral-500">표시할 팀이 없습니다.</p>'}</div>
        </div>`;
}

async function removeApplication(engineerId, name) {
    if (!window.confirm(`"${name || engineerId}" 의 배정을 취소(삭제)할까요?`)) return;
    try {
        await fsDelete(`applications/${engineerId}`);
        await renderApplicants();
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "권한이 없습니다. (관리자 전용)"
            : (err.code || err.message || "취소에 실패했습니다."));
    }
}
window.removeApplication = removeApplication;
