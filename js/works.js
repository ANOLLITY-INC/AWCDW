// ============================================================
//  작품 기능 (Phase 2) — 팀 상세 · 작품 목록/상세 · 업로드
// ------------------------------------------------------------
//  · 팀 상세 페이지(#team-detail-page): 팀 소개 + 그 팀의 작품 목록
//  · 작품 갤러리(#works-page): 공개 작품(교수·관리자는 전체) 둘러보기
//  · 작품 상세(#work-detail-page): 본문 + 첨부(이미지/PDF)
//  · 작품 업로드/수정/삭제: 디자이너(본인 팀) — Firebase Storage 첨부
//
//  ⚠️ 데이터 접근은 전부 REST 헬퍼(fsGet/fsSet/fsUpdate/fsDelete/
//     fsQueryWhere/fsQuery, firebase-config.js). SDK .get()/.set() 금지.
//  ⚠️ 보안규칙("rules are not filters")·복합 인덱스 회피를 위해 작품 쿼리는
//     "단일 필드 equality" 만 사용한다(teamId 또는 visibility). 정렬은 클라 측.
//
//  works/{id} 스키마(SYSTEM_DESIGN 5.3):
//    { id, teamId, authorId, title, description, content,
//      attachments:[{name,url,type}], visibility:'public'|'team_only',
//      phase:'중간제출'|'최종제출', createdAt, updatedAt }
//  ※ professor_only 는 쿼리 단순화를 위해 이번 단계 UI 에서 제외(후순위).
//
//  전역(다른 파일): escapeHtml, ROLE_LABELS, currentUser, currentProfile,
//    teams, navigateTo, openAuth, openPendingModal, isCurrentPage, storage,
//    FIREBASE_READY, fs* 헬퍼.
// ============================================================

const VIS_LABELS = { public: "전체 공개", team_only: "팀 전용" };
// 게시글 단계(제출 차수) — 보드 종류에 따라 다른 선택지 제공
//  · proposal(사전주제제안): 중간제출 / 최종제출
//  · result(워크숍 차수별 진행 결과): 1차 / 2차 / 3차 워크숍
const WORK_PHASES = ["중간제출", "최종제출"];
const WORK_PHASES_RESULT = ["1차 워크숍", "2차 워크숍", "3차 워크숍"];
function workPhasesFor(cat) {
    return ((cat || currentWorksCat()) === "result") ? WORK_PHASES_RESULT : WORK_PHASES;
}

// 첨부 파일당 최대 용량(MB). storage.rules 의 size 제한과 반드시 일치시킬 것.
const MAX_FILE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
// 업로드 전 클라이언트 검증: 용량 초과 파일이 있으면 그 이름을 반환(없으면 "")
function oversizedFileMsg(fileList) {
    const over = Array.from(fileList || []).filter(f => f && f.size > MAX_FILE_BYTES);
    if (!over.length) return "";
    const names = over.map(f => {
        const mb = (f.size / (1024 * 1024)).toFixed(1);
        return `“${f.name}” (${mb}MB)`;
    }).join(", ");
    return `파일이 너무 큽니다. 각 파일은 ${MAX_FILE_MB}MB 이하여야 합니다: ${names}`;
}

// 화면 상태
//  cat: 현재 보고 있는 게시판 종류 — "proposal"(디자인팀 온라인 사전주제제안, 기본)
//                                   | "result"(워크숍 차수별 진행 결과 발표)
//  cat 은 workCtx 안에 두어 뒤로/앞으로 가기(history) 시에도 함께 보존된다.
let workCtx = { teamId: null, workId: null, notice: false, formOpen: false, formError: "", cat: "proposal" };
let teamWorksCache = []; // 현재 팀 상세에 로드된 작품들(_docId 포함)
let teamDetailEngineers = []; // 결과 보드 팀 상세 헤더에 표시할 공학생(팀 배치 현황과 동일 기준)
let teamDetailDesigners = []; // 결과 보드 팀 상세 헤더에 표시할 디자이너
let teamDetailProfs = [];     // 결과 보드 팀 상세 헤더에 표시할 지도교수

// 현재 게시판 카테고리(없으면 proposal)
function currentWorksCat() {
    return (typeof workCtx !== "undefined" && workCtx && workCtx.cat) ? workCtx.cat : "proposal";
}
// 카테고리별 게시물 명칭(라벨)
function catNoun() { return currentWorksCat() === "result" ? "진행 결과" : "작품"; }

// 게시판 진입점 — 메인 페이지 카드/대시보드에서 호출
function openProposalBoard() { workCtx = Object.assign({}, workCtx, { cat: "proposal" }); navigateTo("teams"); }
async function openResultsBoard() {
    workCtx = Object.assign({}, workCtx, { cat: "result" });
    // 팀 구성을 '팀 배치 현황/관리'와 동일 기준으로 표시하기 위한 컨텍스트(관리자=계정) 로드
    if (typeof loadTeamRosterCtx === "function") { try { await loadTeamRosterCtx(); } catch (_) {} }
    navigateTo("teams");
}
window.openProposalBoard = openProposalBoard;
window.openResultsBoard = openResultsBoard;

// 팀 보드(#teams-page) 상단 제목/검색 placeholder 를 카테고리에 맞춰 갱신
function applyBoardHeader() {
    const cat = currentWorksCat();
    const sub = document.getElementById("teams-sub");
    const h1 = document.querySelector("#teams-page h1");
    const search = document.getElementById("search");
    const stats = document.getElementById("teams-stats");
    const container = document.getElementById("teams-container");
    let banner = document.getElementById("result-banner");
    if (cat === "result") {
        if (h1) h1.textContent = "Workshop Result Board";
        if (sub) sub.textContent = "워크숍 차수별 진행 결과 발표 — 팀별 게시판";
        if (search) search.placeholder = "팀·팀원 검색...";
        if (stats) stats.classList.add("hidden");          // 결과 보드에서는 상단 통계 숨김
        // 사전주제제안 보드(파랑)와 혼동되지 않도록 짙은 색(앰버 포인트) 배너 표시
        if (!banner && container && container.parentNode) {
            banner = document.createElement("div");
            banner.id = "result-banner";
            banner.className = "mb-8";
            container.parentNode.insertBefore(banner, container);
        }
        if (banner) {
            banner.innerHTML = `
                <div class="rounded-2xl bg-neutral-900 text-white px-6 py-5 flex items-center gap-4">
                    <span class="shrink-0 w-11 h-11 rounded-xl bg-amber-400 text-neutral-900 flex items-center justify-center text-xl font-black">📊</span>
                    <div>
                        <p class="text-[11px] font-black uppercase tracking-widest text-amber-300">Workshop Result Board</p>
                        <p class="font-extrabold text-lg leading-tight">워크숍 차수별 진행 결과 발표</p>
                        <p class="text-xs text-neutral-300 mt-0.5">팀 배치 현황 기준 · 팀을 선택해 차수별 진행 결과를 확인·작성하세요.</p>
                    </div>
                </div>`;
        }
    } else {
        if (h1) h1.textContent = "Design Team Allocation";
        if (sub) sub.textContent = "디자이너 사전주제제안 — 팀 배정 현황";
        if (search) search.placeholder = "디자이너 이름 검색...";
        if (stats) stats.classList.remove("hidden");        // 주제제안 보드는 통계 표시
        if (banner) banner.remove();                        // 결과 보드 배너 제거
    }
}
window.applyBoardHeader = applyBoardHeader;

// ------------------------------------------------------------
// 유틸 / 권한
// ------------------------------------------------------------
function teamMeta(teamId) {
    const list = (typeof teams !== "undefined" && Array.isArray(teams)) ? teams : [];
    return list.find(t => t.id === teamId)
        || { id: teamId, name: teamId ? teamId + "팀" : "팀", code: "", members: [] };
}
function myRole() { return currentProfile ? currentProfile.role : null; }
// 담당 교수 여부(advisingTeamIds 에 해당 팀 포함)
function isAdvisorOf(teamId) {
    return myRole() === "professor"
        && ((currentProfile && currentProfile.advisingTeamIds) || []).includes(teamId);
}
// 업로드(글 작성) 권한.
//  · proposal(기본): 보안규칙상 "본인 팀 디자이너" 만 가능
//  · result(진행 결과 발표): 그 팀에 배정된 학생(디자이너·공학) + 담당 교수
function canUploadCat(teamId, cat) {
    if (!currentProfile) return false;
    if (cat === "result") {
        return currentProfile.teamId === teamId || isAdvisorOf(teamId);
    }
    return myRole() === "designer" && currentProfile.teamId === teamId;
}
function canUploadTo(teamId) { return canUploadCat(teamId, currentWorksCat()); }
// 수정/삭제 권한.
//  · proposal: 관리자 또는 그 팀 디자이너
//  · result: 관리자 · 작성자 본인 · 그 팀 배정 학생 · 담당 교수
function canManageWork(work) {
    if (!currentProfile || !work) return false;
    if (myRole() === "admin") return true;
    const cat = work.category || "proposal";
    if (cat === "result") {
        return (currentUser && work.authorId === currentUser.uid)
            || currentProfile.teamId === work.teamId
            || isAdvisorOf(work.teamId);
    }
    return myRole() === "designer" && currentProfile.teamId === work.teamId;
}
function sortWorks(arr) {
    return (arr || []).slice().sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
function visBadge(v) {
    const isTeam = v === "team_only";
    const cls = isTeam ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
    return `<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${cls}">${escapeHtml(VIS_LABELS[v] || v || "")}</span>`;
}
function phaseBadge(p) {
    if (!p) return "";
    return `<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">${escapeHtml(p)}</span>`;
}
function firstImage(work) {
    return (work.attachments || []).find(a => a && a.type === "image");
}
// 카드/상단에 쓸 대표 이미지 URL: 커버(썸네일) 우선, 없으면 첫 이미지 첨부.
function coverOf(work) {
    if (work.coverUrl) return work.coverUrl;
    const img = firstImage(work);
    return img ? img.url : null;
}

// ------------------------------------------------------------
// 데이터 로드 (권한별 쿼리 분기 — 단일 필드 equality)
// ------------------------------------------------------------
// 팀의 작품: 권한자(admin/professor/소속 designer)는 teamId 로 전체,
//            그 외(engineer/타팀/비로그인)는 공개 작품만 보고 teamId 로 필터.
async function loadTeamWorks(teamId) {
    const cat = currentWorksCat();
    const inCat = (w) => ((w.category || "proposal") === cat);
    const role = myRole();
    // 권한자: 관리자·교수 또는 그 팀에 배정된 학생(디자이너·공학 모두)
    const privileged = role === "admin" || role === "professor"
        || (currentProfile && currentProfile.teamId === teamId);
    if (privileged) {
        try { return sortWorks((await fsQueryWhere("works", "teamId", teamId)).filter(inCat)); }
        catch (e) { if (e.code !== "permission-denied") throw e; /* 폴백 ↓ */ }
    }
    const pub = await fsQueryWhere("works", "visibility", "public");
    return sortWorks(pub.filter(w => w.teamId === teamId).filter(inCat));
}
// 갤러리: 관리자·교수는 전체, 그 외는 공개 작품만.
async function loadGalleryWorks() {
    const role = myRole();
    if (role === "admin" || role === "professor") {
        try { return sortWorks(await fsQuery("works")); }
        catch (e) { if (e.code !== "permission-denied") throw e; }
    }
    return sortWorks(await fsQueryWhere("works", "visibility", "public"));
}

// ------------------------------------------------------------
// 진입점(전역) — 인라인 onclick / 대시보드 메뉴에서 호출
// ------------------------------------------------------------
function openTeamDetail(teamId, openForm) {
    const cat = currentWorksCat(); // 현재 게시판 종류 유지
    workCtx = { teamId, workId: null, notice: false, formOpen: !!openForm, formError: "", cat };
    navigateTo("team-detail");
}
window.openTeamDetail = openTeamDetail;

function openWorksGallery() {
    navigateTo("works");
}
window.openWorksGallery = openWorksGallery;

function openWorkDetail(workId, teamId) {
    workCtx.workId = workId;
    if (teamId) workCtx.teamId = teamId;
    navigateTo("work-detail");
}
window.openWorkDetail = openWorkDetail;

// 디자이너 대시보드 "작품 업로드" 진입: 팀 있으면 바로 업로드,
// 없으면 "관리자 배정 대기" 안내(팀 소속은 관리자가 배정하는 정책).
function goMyDesignerUpload() {
    if (!currentUser || !currentProfile) { openAuth("login"); return; }
    const role = myRole();
    if (role === "admin") {
        // 관리자는 업로드 권한이 없으므로(규칙상 디자이너 전용) 갤러리로 안내
        openWorksGallery();
        return;
    }
    if (role !== "designer") { openPendingModal("작품 업로드"); return; }
    workCtx.cat = "proposal";
    if (currentProfile.teamId) { openTeamDetail(currentProfile.teamId, true); }
    else { workCtx = { teamId: null, workId: null, notice: true, formOpen: false, formError: "", cat: "proposal" }; navigateTo("team-detail"); }
}
window.goMyDesignerUpload = goMyDesignerUpload;

// 디자이너 대시보드 "피드백 확인": 우리 팀 상세(작품·피드백)로 이동
function goMyTeam() {
    if (!currentUser || !currentProfile) { openAuth("login"); return; }
    workCtx.cat = "proposal";
    if (currentProfile.teamId) { openTeamDetail(currentProfile.teamId, false); }
    else { workCtx = { teamId: null, workId: null, notice: true, formOpen: false, formError: "", cat: "proposal" }; navigateTo("team-detail"); }
}
window.goMyTeam = goMyTeam;

// ------------------------------------------------------------
// 팀 상세 페이지
// ------------------------------------------------------------
async function renderTeamDetail() {
    const page = document.getElementById("team-detail-page");
    if (!page) return;
    if (workCtx.notice) { renderNoTeamNotice(); return; }

    const teamId = workCtx.teamId;
    const meta = teamMeta(teamId);

    // 로딩 셸
    page.innerHTML = teamDetailShell(meta,
        `<div class="py-20 text-center text-neutral-400 font-bold">작품 불러오는 중…</div>`);

    let works = [];
    try {
        works = await loadTeamWorks(teamId);
    } catch (e) {
        page.innerHTML = teamDetailShell(meta, `
            <div class="py-16 text-center">
                <p class="text-rose-600 font-bold mb-2">작품을 불러오지 못했습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">${escapeHtml(e.code || e.message || e)}</p>
                <button onclick="renderTeamDetail()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">다시 시도</button>
            </div>`);
        return;
    }
    teamWorksCache = works;
    // 지원 상태(기간/정원/내 지원)를 받아와 지원 패널에 반영
    if (typeof refreshTeamApplyState === "function") { try { await refreshTeamApplyState(); } catch (_) {} }
    // 결과 보드: 헤더에 팀 구성 표시 — '팀 배치 현황/관리'와 동일 기준(관리자=계정).
    teamDetailEngineers = [];
    teamDetailDesigners = [];
    teamDetailProfs = [];
    if (currentWorksCat() === "result") {
        const metaTeam = teamMeta(teamId) || {};
        if (typeof loadTeamRosterCtx === "function") { try { await loadTeamRosterCtx(); } catch (_) {} }
        const ctx = (typeof teamRosterCtx !== "undefined") ? teamRosterCtx : { users: null, apps: [] };
        const teamsList = (typeof teams !== "undefined") ? teams : null;
        const rm = (typeof teamRosterForDisplay === "function")
            ? teamRosterForDisplay(metaTeam, ctx, teamsList)
            : { designers: (metaTeam.members || []), engineers: (metaTeam.engineers || []), profs: (metaTeam.advisingProfessors || []) };
        teamDetailDesigners = rm.designers || [];
        teamDetailEngineers = rm.engineers || [];
        teamDetailProfs = rm.profs || [];
    }
    drawTeamDetail();
}
window.renderTeamDetail = renderTeamDetail;

// 팀 상세 공통 셸(헤더 + 본문 슬롯)
function teamDetailShell(meta, bodyHtml) {
    const cat = currentWorksCat();
    let rosterHtml;
    if (cat === "result") {
        // 결과 보드: 팀 배치 관리와 동일한 구성(디자이너·공학생·지도교수) 표시
        const chip = (t, c) => `<span class="text-xs font-bold px-2.5 py-1 rounded-lg ${c}">${escapeHtml(t)}</span>`;
        const grp = (label, items, c) => items.length
            ? `<div class="flex flex-wrap items-center gap-1.5">
                   <span class="text-[11px] font-black uppercase tracking-wider text-neutral-400 mr-1">${label}</span>
                   ${items.map(x => chip(x, c)).join("")}</div>`
            : "";
        const profsPublic = (typeof professorsPublic !== "undefined") ? professorsPublic : false;
        const isAdmin = (typeof currentProfile !== "undefined") && currentProfile && currentProfile.role === "admin";
        const parts = [
            grp("디자이너", (teamDetailDesigners || []), "bg-blue-50 text-blue-700"),
            grp("공학생", (teamDetailEngineers || []), "bg-emerald-50 text-emerald-700"),
            // 지도교수: 관리자는 항상(계정 기준), 그 외는 공개 설정일 때만
            (profsPublic || isAdmin) ? grp("지도교수", (teamDetailProfs || []), "bg-violet-50 text-violet-700") : "",
        ].filter(Boolean).join("");
        rosterHtml = parts ? `<div class="space-y-2 mt-4">${parts}</div>` : "";
    } else {
        const members = (meta.members || []).map(m =>
            `<span class="text-xs font-bold bg-neutral-100 px-2.5 py-1 rounded-lg">${escapeHtml(m)}</span>`).join(" ");
        rosterHtml = members ? `<div class="flex flex-wrap gap-1.5 mt-4">${members}</div>` : "";
    }
    return `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-8">
                <button onclick="navigateTo('teams')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 팀 보드</button>
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">${escapeHtml(meta.code || ("Team " + (meta.id || "").toUpperCase()))}</span>
                </div>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight">${escapeHtml(meta.name || meta.id || "")}</h1>
                ${rosterHtml}
            </header>
            ${bodyHtml}
        </div>`;
}

function drawTeamDetail() {
    const page = document.getElementById("team-detail-page");
    if (!page) return;
    const teamId = workCtx.teamId;
    const meta = teamMeta(teamId);
    const works = teamWorksCache;

    const noun = catNoun();
    // 작성 폼이 열려 있는 동안에는 "+ 새 등록" 을 비활성화(혼동 방지)
    const uploadBtn = canUploadTo(teamId)
        ? (workCtx.formOpen
            ? `<button disabled title="작성 중에는 사용할 수 없습니다" class="bg-neutral-200 text-neutral-400 text-sm font-bold px-5 py-2.5 rounded-xl cursor-not-allowed">작성 중…</button>`
            : `<button onclick="openWorkForm(null)" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">+ 새 ${escapeHtml(noun)} 등록</button>`)
        : "";

    const cards = works.length ? works.map(w => workCardHtml(w)).join("") : `
        <div class="col-span-full py-16 text-center border border-dashed border-neutral-300 rounded-2xl bg-white">
            <p class="text-neutral-500 font-bold">아직 등록된 ${escapeHtml(noun)}이 없습니다.</p>
            ${canUploadTo(teamId) ? `<p class="text-sm text-neutral-400 mt-1">‘+ 새 ${escapeHtml(noun)} 등록’으로 첫 글을 올려보세요.</p>` : ""}
        </div>`;

    // 공학생 지원 패널은 사전주제제안 보드에서만 표시(결과 발표 보드에서는 숨김)
    const applyPanel = (currentWorksCat() !== "result" && typeof teamDetailApplyPanel === "function")
        ? teamDetailApplyPanel(teamId) : "";
    const body = `
        ${workCtx.formOpen ? workFormHtml() : ""}
        ${applyPanel}
        <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-extrabold">${escapeHtml(noun)} <span class="font-eng opacity-50">(${works.length})</span></h2>
            ${uploadBtn}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">${cards}</div>`;

    page.innerHTML = teamDetailShell(meta, body);
    const form = document.getElementById("work-form");
    if (form) form.addEventListener("submit", saveWork);
}
window.drawTeamDetail = drawTeamDetail;

function workCardHtml(w) {
    const cover = coverOf(w);
    const thumb = cover
        ? `<div class="h-36 bg-neutral-100 overflow-hidden"><img src="${escapeHtml(cover)}" alt="" class="w-full h-full object-cover"></div>`
        : `<div class="h-36 bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center text-neutral-300 font-black font-eng text-4xl">${escapeHtml((w.title || "W").slice(0, 1).toUpperCase())}</div>`;
    return `
        <button onclick="openWorkDetail('${escapeHtml(w._docId || w.id)}','${escapeHtml(w.teamId || "")}')"
            class="text-left group border border-neutral-200 bg-white hover:border-blue-600 rounded-2xl overflow-hidden transition-all hover:shadow-md">
            ${thumb}
            <div class="p-5">
                <div class="flex items-center gap-1.5 mb-2 flex-wrap">${visBadge(w.visibility)}${phaseBadge(w.phase)}</div>
                <h3 class="font-extrabold text-base leading-snug mb-1 group-hover:text-blue-600 transition-colors">${escapeHtml(w.title || "(제목 없음)")}</h3>
                <p class="text-xs text-neutral-500 line-clamp-2">${escapeHtml(w.description || "")}</p>
            </div>
        </button>`;
}

// ------------------------------------------------------------
// 작품 등록/수정 폼 (팀 상세 안에서 토글)
// ------------------------------------------------------------
function openWorkForm(workId) {
    workCtx.workId = workId || null; // null=새 작품
    workCtx.formOpen = true;
    workCtx.formError = "";
    drawTeamDetail();
    const form = document.getElementById("work-form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
}
window.openWorkForm = openWorkForm;

function closeWorkForm() {
    workCtx.formOpen = false;
    workCtx.workId = null;
    workCtx.formError = "";
    drawTeamDetail();
}
window.closeWorkForm = closeWorkForm;

function workFormHtml() {
    const isNew = !workCtx.workId;
    const phases = workPhasesFor(currentWorksCat()); // 보드 종류별 단계 선택지
    const w = isNew ? { title: "", description: "", content: "", visibility: "public", phase: phases[0], attachments: [] }
                    : (teamWorksCache.find(x => (x._docId || x.id) === workCtx.workId)
                        || { title: "", description: "", content: "", visibility: "public", phase: phases[0], attachments: [] });

    const visOpts = Object.keys(VIS_LABELS)
        .map(v => `<option value="${v}" ${w.visibility === v ? "selected" : ""}>${escapeHtml(VIS_LABELS[v])}</option>`).join("");
    const phaseOpts = phases
        .map(p => `<option value="${p}" ${w.phase === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("");
    const existing = (w.attachments || []).length
        ? `<p class="text-[11px] text-neutral-500 mt-1">현재 첨부 ${w.attachments.length}개 — 새 파일을 추가하면 기존 첨부에 더해집니다.</p>`
        : "";

    return `
        <div class="bg-white border-2 border-blue-600 rounded-2xl p-6 mb-8 shadow-sm">
            <h3 class="font-extrabold text-lg mb-4">${isNew ? `새 ${escapeHtml(catNoun())} 등록` : `${escapeHtml(catNoun())} 수정`}</h3>
            <form id="work-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-neutral-500 mb-1">제목 *</label>
                    <input name="title" type="text" required value="${escapeHtml(w.title || "")}" placeholder="작품 제목"
                        class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                </div>
                <div>
                    <label class="block text-xs font-bold text-neutral-500 mb-1">한 줄 설명</label>
                    <input name="description" type="text" value="${escapeHtml(w.description || "")}" placeholder="목록에 보일 짧은 설명"
                        class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                </div>
                <div>
                    <label class="block text-xs font-bold text-neutral-500 mb-1">본문</label>
                    <textarea name="content" rows="6" placeholder="작품 설명, 컨셉, 진행 내용 등"
                        class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">${escapeHtml(w.content || "")}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">공개 범위</label>
                        <select name="visibility" class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">${visOpts}</select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">${currentWorksCat() === "result" ? "워크숍 차수" : "제출 단계"}</label>
                        <select name="phase" class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">${phaseOpts}</select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-neutral-500 mb-1">커버 이미지 (썸네일, 선택)</label>
                    ${w.coverUrl ? `<img src="${escapeHtml(w.coverUrl)}" alt="" class="h-28 rounded-lg border border-neutral-200 object-cover mb-2">` : ""}
                    <input name="cover" type="file" accept="image/*"
                        class="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:font-bold file:text-neutral-700 hover:file:bg-neutral-200">
                    <p class="text-[11px] text-neutral-400 mt-1">작품 상세 페이지 상단에 크게 표시됩니다. (${MAX_FILE_MB}MB 이하)${w.coverUrl ? " 새 이미지를 올리면 교체됩니다." : ""}</p>
                </div>
                <div>
                    <label class="block text-xs font-bold text-neutral-500 mb-1">첨부파일 (이미지 / PDF, 각 ${MAX_FILE_MB}MB 이하)</label>
                    <input name="files" type="file" multiple accept="image/*,application/pdf"
                        class="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-neutral-100 file:font-bold file:text-neutral-700 hover:file:bg-neutral-200">
                    ${existing}
                </div>
                ${workCtx.formError ? `<p class="text-sm text-rose-600 font-semibold">${escapeHtml(workCtx.formError)}</p>` : ""}
                <div class="flex gap-3 pt-1">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all">${isNew ? "등록하기" : "저장하기"}</button>
                    <button type="button" onclick="closeWorkForm()" class="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-6 py-2.5 rounded-xl transition-all">취소</button>
                </div>
            </form>
        </div>`;
}

// Storage 업로드 → [{name,url,type}]
async function uploadWorkFiles(teamId, workId, fileList) {
    const out = [];
    if (!storage || !fileList || !fileList.length) return out;
    for (const file of fileList) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `works/${teamId}/${workId}/${Date.now()}_${safe}`;
        const ref = storage.ref().child(path);
        await ref.put(file);
        const url = await ref.getDownloadURL();
        const type = file.type.startsWith("image/") ? "image"
            : (file.type === "application/pdf" ? "pdf" : "etc");
        out.push({ name: file.name, url, type });
    }
    return out;
}

async function saveWork(e) {
    e.preventDefault();
    const el = e.target.elements;
    const teamId = workCtx.teamId;
    const isNew = !workCtx.workId;

    const cat = currentWorksCat();
    const title = el.title.value.trim();
    workCtx.formError = "";
    if (!title) { workCtx.formError = "제목을 입력하세요."; drawTeamDetail(); return; }
    if (isNew && !canUploadTo(teamId)) {
        workCtx.formError = (cat === "result")
            ? "이 팀에 글을 올릴 권한이 없습니다. (배정된 팀원 또는 담당 교수만 가능)"
            : "이 팀에 작품을 올릴 권한이 없습니다. (소속 팀 디자이너만 가능)";
        drawTeamDetail(); return;
    }

    const data = {
        title,
        description: el.description.value.trim(),
        content: el.content.value,
        visibility: el.visibility.value,
        phase: el.phase.value,
    };
    const files = el.files && el.files.files ? el.files.files : [];
    const coverFile = el.cover && el.cover.files ? el.cover.files[0] : null;

    // 업로드 전 용량 검증 — 초과 시 Storage 에서 storage/unauthorized 로 거부되므로 먼저 막는다.
    const sizeErr = oversizedFileMsg(coverFile ? [...files, coverFile] : files);
    if (sizeErr) { workCtx.formError = sizeErr; drawTeamDetail(); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = (files.length || coverFile) ? "업로드 중…" : "저장 중…"; }
    try {
        if (isNew) {
            const workId = `w_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
            const attachments = await uploadWorkFiles(teamId, workId, files);
            let coverUrl = "";
            if (coverFile) { const up = await uploadWorkFiles(teamId, workId, [coverFile]); if (up[0]) coverUrl = up[0].url; }
            await fsSet(`works/${workId}`, Object.assign({
                id: workId, teamId, authorId: currentUser.uid, category: cat,
                attachments, coverUrl, createdAt: new Date(), updatedAt: new Date(),
            }, data));
        } else {
            const existing = teamWorksCache.find(x => (x._docId || x.id) === workCtx.workId) || {};
            const newAtt = await uploadWorkFiles(teamId, workCtx.workId, files);
            const attachments = (existing.attachments || []).concat(newAtt);
            let coverUrl = existing.coverUrl || "";
            if (coverFile) { const up = await uploadWorkFiles(teamId, workCtx.workId, [coverFile]); if (up[0]) coverUrl = up[0].url; }
            await fsUpdate(`works/${workCtx.workId}`,
                Object.assign({ attachments, coverUrl, updatedAt: new Date() }, data));
        }
        workCtx.formOpen = false;
        workCtx.workId = null;
        await renderTeamDetail();
    } catch (err) {
        workCtx.formError = (err.code === "permission-denied")
            ? "권한이 없습니다. 소속 팀 디자이너 계정인지 확인하세요."
            : (err.code || err.message || "저장에 실패했습니다.");
        drawTeamDetail();
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}
window.saveWork = saveWork;

async function deleteWork(workId, title) {
    if (!window.confirm(`"${title || "이 작품"}" 을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
        await fsDelete(`works/${workId}`);
        // 상세에서 삭제했으면 팀 상세로, 팀 상세 목록에서 삭제했으면 그대로 갱신
        if (isCurrentPage("work-detail-page")) navigateTo("team-detail");
        else await renderTeamDetail();
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "삭제 권한이 없습니다."
            : (err.code || err.message || "삭제에 실패했습니다."));
    }
}
window.deleteWork = deleteWork;

// ------------------------------------------------------------
// 작품 상세 페이지
// ------------------------------------------------------------
async function renderWorkDetail() {
    const page = document.getElementById("work-detail-page");
    if (!page) return;
    page.innerHTML = `<div class="max-w-5xl mx-auto px-6 py-24 text-center text-neutral-400 font-bold">작품 불러오는 중…</div>`;

    let work;
    try {
        work = await fsGet(`works/${workCtx.workId}`);
    } catch (e) {
        const denied = e.code === "permission-denied";
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-24 text-center">
                <p class="text-lg font-bold mb-2">${denied ? "열람 권한이 없습니다." : "작품을 불러오지 못했습니다."}</p>
                <p class="text-sm text-neutral-500 mb-6">${denied ? "팀 전용 작품은 해당 팀·교수·관리자만 볼 수 있습니다." : escapeHtml(e.code || e.message || e)}</p>
                <button onclick="navigateTo('team-detail')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">팀으로 돌아가기</button>
            </div>`;
        return;
    }
    if (!work) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-24 text-center">
                <p class="text-lg font-bold mb-6">작품을 찾을 수 없습니다.</p>
                <button onclick="navigateTo('teams')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">팀 보드로</button>
            </div>`;
        return;
    }
    workCtx.teamId = work.teamId || workCtx.teamId;
    workCtx.cat = work.category || workCtx.cat || "proposal"; // 카테고리 문맥 유지(갤러리 진입 대비)
    const meta = teamMeta(work.teamId);

    const coverHtml = work.coverUrl
        ? `<div class="mb-8 rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50"><img src="${escapeHtml(work.coverUrl)}" alt="" class="w-full"></div>`
        : "";
    const atts = (work.attachments || []);
    const images = atts.filter(a => a.type === "image");
    const pdfs = atts.filter(a => a.type === "pdf");
    const others = atts.filter(a => a.type !== "image" && a.type !== "pdf");
    const imagesHtml = images.length ? `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            ${images.map(a => `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="block rounded-xl overflow-hidden border border-neutral-200 hover:border-blue-600 transition-all"><img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" class="w-full"></a>`).join("")}
        </div>` : "";
    // PDF 는 다운로드 링크 대신 페이지 안에 임베드(iframe)해서 바로 보여준다.
    //  · Firebase Storage URL(application/pdf)은 alt=media 로 인라인 표시돼 브라우저가 렌더.
    //  · 일부 모바일 브라우저는 iframe PDF 미지원 → '새 탭에서 열기' 링크를 함께 제공.
    const pdfHtml = pdfs.length ? `
        <div class="mt-8 space-y-8">
            ${pdfs.map(a => `
                <div>
                    <div class="flex items-center justify-between mb-2 gap-3">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 truncate">${escapeHtml(a.name)}</h3>
                        <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="text-xs font-bold text-blue-600 hover:underline whitespace-nowrap">새 탭에서 열기 ↗</a>
                    </div>
                    <div class="rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50">
                        <iframe src="${escapeHtml(a.url)}#view=FitH" title="${escapeHtml(a.name)}" loading="lazy"
                            class="w-full" style="height:80vh;min-height:600px;border:0;"></iframe>
                    </div>
                </div>`).join("")}
        </div>` : "";
    const filesHtml = others.length ? `
        <div class="mt-8">
            <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">첨부파일</h3>
            <div class="space-y-2">
                ${others.map(a => `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline"><span class="text-xs bg-neutral-100 px-1.5 py-0.5 rounded uppercase">${escapeHtml(a.type)}</span>${escapeHtml(a.name)}</a>`).join("")}
            </div>
        </div>` : "";

    const manage = canManageWork(work) ? `
        <div class="flex gap-2">
            <button onclick="editWorkFromDetail()" class="bg-neutral-900 hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">수정</button>
            <button onclick="deleteWork('${escapeHtml(workCtx.workId)}','${escapeHtml((work.title || '').replace(/'/g, ''))}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-4 py-2.5 rounded-xl transition-all">삭제</button>
        </div>` : "";

    page.innerHTML = `
        <div class="max-w-5xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b border-neutral-200 pb-8 mb-8">
                <button onclick="navigateTo('team-detail')" class="mb-4 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← ${escapeHtml(meta.name || meta.id || "팀")}</button>
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-1.5 mb-3 flex-wrap">${visBadge(work.visibility)}${phaseBadge(work.phase)}</div>
                        <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">${escapeHtml(work.title || "(제목 없음)")}</h1>
                        ${work.description ? `<p class="text-base text-neutral-600 mt-3">${escapeHtml(work.description)}</p>` : ""}
                    </div>
                    ${manage}
                </div>
            </header>
            ${coverHtml}
            ${work.content ? `<div class="text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">${escapeHtml(work.content)}</div>` : `<p class="text-sm text-neutral-400">본문이 없습니다.</p>`}
            ${imagesHtml}
            ${pdfHtml}
            ${filesHtml}
            <div id="work-feedback"></div>
        </div>`;

    // 피드백 섹션(feedback.js)을 비동기로 채운다.
    if (typeof renderWorkFeedback === "function") renderWorkFeedback(work);
}
window.renderWorkDetail = renderWorkDetail;

// 작품 상세에서 "수정" → 팀 상세로 이동하며 해당 작품 폼을 연다.
// workCtx.workId/teamId 는 상세를 열 때 이미 설정돼 있으므로 formOpen 만 켠다.
function editWorkFromDetail() {
    workCtx.formOpen = true;
    navigateTo("team-detail"); // renderTeamDetail 이 작품 로드 후 drawTeamDetail → 폼 표시
}
window.editWorkFromDetail = editWorkFromDetail;

// ------------------------------------------------------------
// 작품 갤러리 페이지 (공개 작품 둘러보기 / 교수·관리자는 전체)
// ------------------------------------------------------------
async function renderWorksGallery() {
    const page = document.getElementById("works-page");
    if (!page) return;
    page.innerHTML = galleryShell(`<div class="py-20 text-center text-neutral-400 font-bold">작품 불러오는 중…</div>`);

    let works = [];
    try {
        works = await loadGalleryWorks();
    } catch (e) {
        page.innerHTML = galleryShell(`
            <div class="py-16 text-center">
                <p class="text-rose-600 font-bold mb-2">작품을 불러오지 못했습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">${escapeHtml(e.code || e.message || e)}</p>
                <button onclick="renderWorksGallery()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">다시 시도</button>
            </div>`);
        return;
    }

    const role = myRole();
    const scope = (role === "admin" || role === "professor") ? "전체 작품" : "공개 작품";
    const cards = works.length ? works.map(w => galleryCardHtml(w)).join("") : `
        <div class="col-span-full py-16 text-center border border-dashed border-neutral-300 rounded-2xl bg-white">
            <p class="text-neutral-500 font-bold">표시할 작품이 없습니다.</p>
        </div>`;

    page.innerHTML = galleryShell(`
        <p class="text-sm opacity-60 mb-6">${scope} ${works.length}개</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">${cards}</div>`);
}
window.renderWorksGallery = renderWorksGallery;

function galleryShell(bodyHtml) {
    return `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-8">
                <button onclick="navigateTo('landing')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 메인으로</button>
                <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">Gallery</span>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">작품 둘러보기</h1>
            </header>
            ${bodyHtml}
        </div>`;
}

function galleryCardHtml(w) {
    const cover = coverOf(w);
    const meta = teamMeta(w.teamId);
    const thumb = cover
        ? `<div class="h-40 bg-neutral-100 overflow-hidden"><img src="${escapeHtml(cover)}" alt="" class="w-full h-full object-cover"></div>`
        : `<div class="h-40 bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center text-neutral-300 font-black font-eng text-5xl">${escapeHtml((w.title || "W").slice(0, 1).toUpperCase())}</div>`;
    return `
        <button onclick="openWorkDetail('${escapeHtml(w._docId || w.id)}','${escapeHtml(w.teamId || "")}')"
            class="text-left group border border-neutral-200 bg-white hover:border-blue-600 rounded-2xl overflow-hidden transition-all hover:shadow-md">
            ${thumb}
            <div class="p-5">
                <div class="flex items-center gap-1.5 mb-2 flex-wrap">${visBadge(w.visibility)}${phaseBadge(w.phase)}</div>
                <h3 class="font-extrabold text-base leading-snug mb-1 group-hover:text-blue-600 transition-colors">${escapeHtml(w.title || "(제목 없음)")}</h3>
                <p class="text-xs text-neutral-400 font-bold uppercase tracking-wider font-eng">${escapeHtml(meta.name || w.teamId || "")}</p>
            </div>
        </button>`;
}

// ------------------------------------------------------------
// 팀 미배정 디자이너 안내 (팀 소속은 관리자가 배정하는 정책)
// ------------------------------------------------------------
function renderNoTeamNotice() {
    const page = document.getElementById("team-detail-page");
    if (!page) return;
    page.innerHTML = `
        <div class="max-w-md mx-auto px-6 py-24 text-center">
            <div class="text-4xl mb-4">🗂️</div>
            <p class="text-lg font-bold mb-2">아직 소속 팀이 배정되지 않았습니다.</p>
            <p class="text-sm text-neutral-500 mb-6">팀 소속은 <b>관리자가 배정</b>합니다. 관리자가 소속 팀을 지정하면 작품을 업로드할 수 있습니다. 배정이 필요하면 운영진/관리자에게 요청해 주세요.</p>
            <button onclick="navigateTo('dashboard')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">대시보드로</button>
        </div>`;
}
