// ============================================================
//  07 대한기계학회 참가 수요조사 (참석 여부 · 숙박 희망 일자)
// ------------------------------------------------------------
//  · 응답: 로그인 + 팀 배정된 사람만(학생 = users.teamId, 교수 = advisingTeamIds).
//    → firestore.rules 의 ksmeSurvey 규칙과 같은 조건.
//  · 저장: ksmeSurvey/{uid} 한 문서에 attend(참석) / stay(숙박) 를 따로 기록.
//    두 조사는 서로 독립이라 fsUpdate(부분 업데이트)로 한쪽만 바꾼다.
//  · 결과: 교수·관리자 전용 페이지(#ksme-results-page) 에서 인원수 즉시 확인.
//    동명이인(같은 이름, 다른 계정)이 응답하면 1인으로 집계하고 특이사항에 표시.
//
//  렌더 대상: #ksme-attend-page / #ksme-stay-page / #ksme-results-page
//  (auth.js 의 currentUser/currentProfile/escapeHtml, firebase-config.js 의 fs* 사용)
// ============================================================

const KSME_EVENT = {
    title: "대한기계학회 특별세션 예선 발표",
    when: "2026년 11월 13일(금) 15:20 ~ 17:30",
    where: "제주국제컨벤션센터 (ICC 제주)",
};

// 참석 여부 선택지
const KSME_ATTEND_OPTIONS = [
    { v: "yes", t: "참석합니다", d: "11월 13일(금) 특별세션 예선 발표에 참석합니다." },
    { v: "no",  t: "참석하지 않습니다 (불참)", d: "이번 기계학회 예선 발표에는 참석하지 않습니다." },
];

// 숙박 희망 일자 선택지 — 모두 1박(하룻밤) 기준. 입실일·퇴실일을 함께 적어 착오 방지.
const KSME_STAY_OPTIONS = [
    { v: "d12", short: "12일(목) 밤 1박",
      t: "11월 12일(목) 밤 1박",
      d: "12일(목) 입실 → 13일(금) 퇴실 · 발표 전날 숙박", nights: ["12"] },
    { v: "d13", short: "13일(금) 밤 1박",
      t: "11월 13일(금) 밤 1박",
      d: "13일(금) 입실 → 14일(토) 퇴실 · 발표 당일 숙박", nights: ["13"] },
    { v: "any", short: "둘 중 어느 날이든 무관",
      t: "12일(목) 밤 · 13일(금) 밤 중 어느 날이든 무관 (1박)",
      d: "위 두 날짜 중 배정되는 하룻밤에 숙박 가능합니다.", nights: ["12", "13"] },
];

let ksmeMyDoc = null;        // 내 응답 문서(ksmeSurvey/{uid})
let ksmeMyLoadedFor = null;  // 어떤 uid 로 불러온 값인지(계정 전환 대비)
let ksmeBusy = false;
let ksmeMsg = { attend: "", stay: "" };

function _ksmeEsc(s) { return (typeof escapeHtml === "function") ? escapeHtml(s) : String(s == null ? "" : s); }
function _ksmeNorm(s) { return String(s == null ? "" : s).replace(/\s+/g, ""); }
function _ksmeTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const p = n => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function _ksmeTeamName(tid) {
    if (!tid) return "";
    return (typeof teamMeta === "function") ? (teamMeta(tid).name || tid) : tid;
}
function _ksmeLabel(list, v) {
    const o = list.find(x => x.v === v);
    return o ? (o.short || o.t) : "";
}

// 응답 가능 여부 판정 → { ok, state, msg }
function ksmeEligibility() {
    if (typeof authResolved !== "undefined" && !authResolved) return { ok: false, state: "loading", msg: "로그인 상태를 확인하는 중입니다…" };
    if (typeof currentUser === "undefined" || !currentUser) return { ok: false, state: "login", msg: "응답하려면 먼저 로그인(계정 가입)해 주세요." };
    if (!currentProfile) return { ok: false, state: "profile", msg: "회원 정보 입력이 끝나지 않았습니다. 가입 절차를 마쳐 주세요." };
    const role = currentProfile.role;
    if (role === "admin") return { ok: false, state: "admin", msg: "관리자 계정은 응답 대상이 아닙니다. 결과 페이지에서 집계를 확인하세요." };
    if (role === "professor") {
        const adv = currentProfile.advisingTeamIds || [];
        if (adv.length) return { ok: true };
        return { ok: false, state: "team", msg: "지도 팀이 아직 배정되지 않았습니다. 관리자에게 팀 배정을 요청해 주세요." };
    }
    if (currentProfile.teamId) return { ok: true };
    return { ok: false, state: "team", msg: "아직 팀 배정이 되어 있지 않아 응답할 수 없습니다. 관리자에게 팀 배정을 요청해 주세요." };
}

function _ksmeMyTeamText() {
    if (!currentProfile) return "";
    if (currentProfile.role === "professor") {
        return (currentProfile.advisingTeamIds || []).map(_ksmeTeamName).join(", ") + " 지도";
    }
    return _ksmeTeamName(currentProfile.teamId);
}

async function ksmeLoadMine() {
    if (!currentUser) { ksmeMyDoc = null; ksmeMyLoadedFor = null; return; }
    if (ksmeMyLoadedFor === currentUser.uid) return;
    try {
        ksmeMyDoc = await fsGet(`ksmeSurvey/${currentUser.uid}`);
    } catch (e) {
        console.warn("[KSME] 내 응답 조회 실패:", e.code || "", e.message || e);
        ksmeMyDoc = null;
    }
    ksmeMyLoadedFor = currentUser.uid;
}

// ------------------------------------------------------------
// 공통 레이아웃
// ------------------------------------------------------------
function _ksmeHeader(eyebrow, title, sub, dot) {
    return `
        <header class="border-b-2 border-current pb-8 mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <button onclick="navigateTo('landing')" class="no-print mr-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black text-sm font-bold px-4 py-2.5 rounded-lg inline-flex items-center gap-1.5 transition-all">&larr; Back to Home</button>
                    <span class="inline-block w-3 h-3 ${dot} rounded-full animate-pulse"></span>
                    <p class="font-eng tracking-[0.2em] text-xs font-bold uppercase opacity-60">${eyebrow}</p>
                </div>
                <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight leading-none">${title}</h1>
                <p class="text-base mt-3 opacity-90 font-semibold">${sub}</p>
            </div>
        </header>`;
}
const _KSME_FOOTER = `
        <footer class="mt-16 pt-8 border-t border-neutral-300 text-xs opacity-50">
            <p>© 2026 Additive Manufacturing Collaborative Design Workshop. COSS&ByunSeoHee. All rights reserved.</p>
        </footer>`;

function _ksmeEventCard() {
    return `
        <div class="rounded-2xl border-2 border-indigo-500 bg-indigo-50 p-6 md:p-8 mb-8">
            <p class="text-[11px] font-black uppercase tracking-widest text-indigo-700 mb-3">Roadmap 07 · 행사 정보</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="rounded-xl border border-indigo-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-indigo-700">행사</p><p class="text-sm font-black text-indigo-900 mt-1.5 break-keep">${KSME_EVENT.title}</p></div>
                <div class="rounded-xl border border-indigo-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-indigo-700">일시</p><p class="text-sm font-black text-indigo-900 mt-1.5 break-keep">${KSME_EVENT.when}</p></div>
                <div class="rounded-xl border border-indigo-200 bg-white p-4"><p class="text-[11px] font-black uppercase tracking-widest text-indigo-700">장소</p><p class="text-sm font-black text-indigo-900 mt-1.5 break-keep">${KSME_EVENT.where}</p></div>
            </div>
        </div>`;
}

// 응답 불가 상태 안내 박스
function _ksmeGateHtml(el) {
    let btn = "";
    if (el.state === "login") btn = `<button onclick="openAuth('login')" class="mt-4 bg-neutral-900 hover:bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">로그인 / 가입</button>`;
    if (el.state === "admin") btn = `<button onclick="navigateTo('ksme-results')" class="mt-4 bg-neutral-900 hover:bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">수요조사 결과 보기 &rarr;</button>`;
    const loading = el.state === "loading";
    return `
        <div class="rounded-2xl border ${loading ? "border-neutral-200 bg-white" : "border-amber-300 bg-amber-50"} p-6 md:p-8">
            <p class="font-extrabold ${loading ? "text-neutral-500" : "text-amber-800"}">${loading ? "" : "⚠️ "}${_ksmeEsc(el.msg)}</p>
            ${loading ? "" : `<p class="text-xs font-semibold text-amber-700 mt-2">※ 이 조사는 사이트에 가입하고 팀 배정이 끝난 인원만 선택할 수 있습니다.</p>`}
            ${btn}
        </div>`;
}

function _ksmeWhoHtml() {
    const roleLabel = (typeof ROLE_LABELS !== "undefined" && ROLE_LABELS[currentProfile.role]) || currentProfile.role;
    return `<p class="text-sm font-semibold opacity-70 mb-5">응답자: <b class="opacity-100">${_ksmeEsc(currentProfile.name)}</b> · ${_ksmeEsc(roleLabel)} · ${_ksmeEsc(_ksmeMyTeamText())}</p>`;
}

function _ksmeOptionHtml(group, o, checked, extra) {
    return `
        <label class="flex items-start gap-3 rounded-xl border-2 ${checked ? "border-indigo-500 bg-indigo-50" : "border-neutral-200 bg-white hover:border-indigo-300"} p-4 cursor-pointer transition-all">
            <input type="radio" name="${group}" value="${o.v}" ${checked ? "checked" : ""} onchange="ksmeHighlight(this)" class="mt-1 w-4 h-4 accent-indigo-600 shrink-0">
            <span class="flex-1">
                <span class="block font-extrabold text-base text-neutral-900 break-keep">${o.t}</span>
                <span class="block text-sm font-semibold text-neutral-600 mt-0.5 break-keep">${o.d}</span>
                ${extra || ""}
            </span>
        </label>`;
}
// 선택 즉시 테두리 강조(재렌더 없이)
function ksmeHighlight(input) {
    document.querySelectorAll(`input[name="${input.name}"]`).forEach(r => {
        const lab = r.closest("label");
        if (!lab) return;
        lab.classList.toggle("border-indigo-500", r.checked);
        lab.classList.toggle("bg-indigo-50", r.checked);
        lab.classList.toggle("border-neutral-200", !r.checked);
        lab.classList.toggle("bg-white", !r.checked);
    });
}
window.ksmeHighlight = ksmeHighlight;

// 숙박 선택지 옆 날짜 띠: 12(목)·13(금)·14(토) 중 숙박하는 밤을 색칠
function _ksmeNightStrip(nights) {
    const days = [["12", "12(목)"], ["13", "13(금)"], ["14", "14(토)"]];
    const cells = days.map(([k, lab], i) => {
        const night = i < 2 && nights.indexOf(k) >= 0;
        const nightCell = i < 2
            ? `<span class="flex-1 h-2 rounded-full ${night ? (nights.length > 1 ? "bg-indigo-300" : "bg-indigo-600") : "bg-neutral-200"}"></span>`
            : "";
        return `<span class="text-[11px] font-bold text-neutral-600 shrink-0">${lab}</span>${nightCell}`;
    }).join("");
    return `<span class="mt-2 flex items-center gap-2 max-w-xs" aria-hidden="true">${cells}</span>`;
}

function _ksmeMsgHtml(key) {
    const m = ksmeMsg[key];
    if (!m) return "";
    const err = m.startsWith("!");
    return `<p class="mt-3 text-sm font-bold ${err ? "text-rose-600" : "text-emerald-700"}">${_ksmeEsc(err ? m.slice(1) : m)}</p>`;
}

// ------------------------------------------------------------
// 01. 참석 여부 조사
// ------------------------------------------------------------
async function renderKsmeAttend() {
    const page = document.getElementById("ksme-attend-page");
    if (!page) return;
    const el = ksmeEligibility();
    if (el.ok) await ksmeLoadMine();
    const mine = el.ok ? ksmeMyDoc : null;
    const cur = mine && mine.attend;

    let body;
    if (!el.ok) {
        body = _ksmeGateHtml(el);
    } else {
        body = `
            <form onsubmit="ksmeSubmit(event,'attend')" class="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
                <h2 class="text-xl font-extrabold mb-1">기계학회 예선 발표에 참석하시나요?</h2>
                <p class="text-sm opacity-60 font-semibold mb-4">하나를 선택한 뒤 [응답 제출]을 눌러 주세요. 제출 후에도 다시 바꿀 수 있습니다.</p>
                ${_ksmeWhoHtml()}
                <div class="grid grid-cols-1 gap-3 mb-5">
                    ${KSME_ATTEND_OPTIONS.map(o => _ksmeOptionHtml("ksme-attend", o, cur === o.v)).join("")}
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <button type="submit" ${ksmeBusy ? "disabled" : ""} class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all">${cur ? "응답 수정" : "응답 제출"}</button>
                    ${cur ? `<span class="text-sm font-semibold text-neutral-600">현재 내 응답: <b class="text-indigo-700">${_ksmeEsc(_ksmeLabel(KSME_ATTEND_OPTIONS, cur))}</b> <span class="opacity-60">(${_ksmeTime(mine.attendAt)} 제출)</span></span>` : `<span class="text-sm font-semibold text-neutral-500">아직 응답하지 않았습니다.</span>`}
                </div>
                ${_ksmeMsgHtml("attend")}
            </form>`;
    }

    page.innerHTML = `
        <div class="max-w-5xl mx-auto px-6 py-12 lg:py-20">
            ${_ksmeHeader("KSME Survey 01", "대한기계학회 참석 여부 조사", "로드맵 07 · 특별세션 예선 발표 참석 인원 파악", "bg-indigo-500")}
            <main class="text-neutral-900">
                ${_ksmeEventCard()}
                ${body}
                <div class="mt-6 flex flex-wrap gap-2 no-print">
                    <button onclick="navigateTo('ksme-stay')" class="text-sm font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg px-4 py-2.5 transition-all">숙박 희망 일자 조사로 &rarr;</button>
                    ${_ksmeCanSeeResults() ? `<button onclick="navigateTo('ksme-results')" class="text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-4 py-2.5 transition-all">수요조사 결과 (교수·관리자) &rarr;</button>` : ""}
                </div>
            </main>
            ${_KSME_FOOTER}
        </div>`;
}

// ------------------------------------------------------------
// 02. 숙박 희망 일자 조사
// ------------------------------------------------------------
async function renderKsmeStay() {
    const page = document.getElementById("ksme-stay-page");
    if (!page) return;
    const el = ksmeEligibility();
    if (el.ok) await ksmeLoadMine();
    const mine = el.ok ? ksmeMyDoc : null;
    const cur = mine && mine.stay;

    let body;
    if (!el.ok) {
        body = _ksmeGateHtml(el);
    } else {
        const noStayHint = (mine && mine.attend === "no")
            ? `<p class="mb-4 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">참석 여부 조사에서 「불참」으로 응답하셨습니다. 숙박이 필요 없다면 이 조사는 응답하지 않아도 됩니다.</p>`
            : "";
        body = `
            <form onsubmit="ksmeSubmit(event,'stay')" class="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
                <h2 class="text-xl font-extrabold mb-1">숙박이 필요한 날짜를 골라 주세요</h2>
                <p class="text-sm opacity-60 font-semibold mb-1">숙박이 필요한 분만 응답합니다. 세 선택지 모두 <b>1박(하룻밤)</b> 기준입니다.</p>
                <p class="text-sm opacity-60 font-semibold mb-4">발표일은 <b>11월 13일(금)</b>입니다. 「OO일 밤」은 그날 입실해서 다음 날 아침 퇴실한다는 뜻입니다.</p>
                ${_ksmeWhoHtml()}
                ${noStayHint}
                <div class="grid grid-cols-1 gap-3 mb-5">
                    ${KSME_STAY_OPTIONS.map(o => _ksmeOptionHtml("ksme-stay", o, cur === o.v, _ksmeNightStrip(o.nights))).join("")}
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <button type="submit" ${ksmeBusy ? "disabled" : ""} class="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all">${cur ? "응답 수정" : "응답 제출"}</button>
                    ${cur ? `<button type="button" onclick="ksmeClearStay()" ${ksmeBusy ? "disabled" : ""} class="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm font-bold px-4 py-3 rounded-xl transition-all">숙박 필요 없음 (응답 취소)</button>` : ""}
                    ${cur ? `<span class="text-sm font-semibold text-neutral-600">현재 내 응답: <b class="text-violet-700">${_ksmeEsc(_ksmeLabel(KSME_STAY_OPTIONS, cur))}</b> <span class="opacity-60">(${_ksmeTime(mine.stayAt)} 제출)</span></span>` : `<span class="text-sm font-semibold text-neutral-500">아직 응답하지 않았습니다.</span>`}
                </div>
                ${_ksmeMsgHtml("stay")}
            </form>`;
    }

    page.innerHTML = `
        <div class="max-w-5xl mx-auto px-6 py-12 lg:py-20">
            ${_ksmeHeader("KSME Survey 02", "기계학회 숙박 희망 일자 조사", "로드맵 07 · 숙박 예정자 필요 일자 수요 파악", "bg-violet-500")}
            <main class="text-neutral-900">
                ${_ksmeEventCard()}
                ${body}
                <div class="mt-6 flex flex-wrap gap-2 no-print">
                    <button onclick="navigateTo('ksme-attend')" class="text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-4 py-2.5 transition-all">&larr; 참석 여부 조사로</button>
                    ${_ksmeCanSeeResults() ? `<button onclick="navigateTo('ksme-results')" class="text-sm font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-4 py-2.5 transition-all">수요조사 결과 (교수·관리자) &rarr;</button>` : ""}
                </div>
            </main>
            ${_KSME_FOOTER}
        </div>`;
}

// ------------------------------------------------------------
// 제출 / 취소
// ------------------------------------------------------------
function _ksmeBaseFields() {
    const p = currentProfile;
    return {
        uid: currentUser.uid,
        name: p.name || "",
        role: p.role || "",
        teamId: p.role === "professor" ? null : (p.teamId || null),
        advisingTeamIds: p.role === "professor" ? (p.advisingTeamIds || []) : [],
        updatedAt: new Date(),
    };
}

async function _ksmeWrite(key, fields, okMsg) {
    if (!ksmeEligibility().ok || ksmeBusy) return;
    ksmeBusy = true;
    try {
        await fsUpdate(`ksmeSurvey/${currentUser.uid}`, Object.assign(_ksmeBaseFields(), fields));
        ksmeMyLoadedFor = null; // 다시 불러오기
        ksmeMsg[key] = okMsg;
    } catch (e) {
        console.error("[KSME] 저장 실패:", e.code || "", e.message || e);
        ksmeMsg[key] = e.code === "permission-denied"
            ? "!저장 권한이 없습니다. 팀 배정 상태를 확인하거나 관리자에게 문의하세요."
            : "!저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    }
    ksmeBusy = false;
    if (key === "attend") await renderKsmeAttend(); else await renderKsmeStay();
}

async function ksmeSubmit(e, key) {
    e.preventDefault();
    const sel = e.target.querySelector(`input[name="ksme-${key}"]:checked`);
    if (!sel) {
        ksmeMsg[key] = "!선택지를 하나 골라 주세요.";
        if (key === "attend") renderKsmeAttend(); else renderKsmeStay();
        return;
    }
    const now = new Date();
    if (key === "attend") {
        await _ksmeWrite("attend", { attend: sel.value, attendAt: now },
            `✓ 저장되었습니다: ${_ksmeLabel(KSME_ATTEND_OPTIONS, sel.value)}`);
    } else {
        await _ksmeWrite("stay", { stay: sel.value, stayAt: now },
            `✓ 저장되었습니다: ${_ksmeLabel(KSME_STAY_OPTIONS, sel.value)}`);
    }
}
window.ksmeSubmit = ksmeSubmit;

async function ksmeClearStay() {
    await _ksmeWrite("stay", { stay: null, stayAt: null }, "✓ 숙박 응답을 취소했습니다(숙박 불필요).");
}
window.ksmeClearStay = ksmeClearStay;

// ------------------------------------------------------------
// 03. 결과 (교수·관리자 전용)
// ------------------------------------------------------------
function _ksmeCanSeeResults() {
    return !!(currentProfile && (currentProfile.role === "admin" || currentProfile.role === "professor"));
}

// 응답 목록 → 이름 기준 1인 집계 + 특이사항
//  · 같은 이름(공백 무시)으로 여러 계정이 응답 → 1인으로 집계, 값은 가장 최근 응답 기준.
function ksmeAggregate(rows) {
    const groups = new Map();
    rows.forEach(r => {
        const key = _ksmeNorm(r.name) || ("(이름없음)" + r._docId);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    });
    const latest = (list, field, atField) => {
        const withVal = list.filter(r => r[field]);
        if (!withVal.length) return null;
        withVal.sort((a, b) => String(b[atField] || "").localeCompare(String(a[atField] || "")));
        return withVal[0];
    };
    const people = [];
    const notes = [];
    groups.forEach((list, key) => {
        const a = latest(list, "attend", "attendAt");
        const s = latest(list, "stay", "stayAt");
        const name = list[0].name || "(이름 없음)";
        const teams = list.map(r => _ksmeRowTeam(r)).filter(Boolean);
        people.push({ name, attend: a ? a.attend : null, stay: s ? s.stay : null,
                      team: Array.from(new Set(teams)).join(" / "), dup: list.length > 1, rows: list });
        if (list.length > 1) {
            const attends = new Set(list.map(r => r.attend).filter(Boolean));
            const stays = new Set(list.map(r => r.stay).filter(Boolean));
            const conflict = attends.size > 1 || stays.size > 1;
            notes.push({
                kind: "dup", name, count: list.length, conflict,
                detail: list.map(r => ({
                    team: _ksmeRowTeam(r) || "팀 정보 없음",
                    role: (typeof ROLE_LABELS !== "undefined" && ROLE_LABELS[r.role]) || r.role || "",
                    attend: _ksmeLabel(KSME_ATTEND_OPTIONS, r.attend) || "미응답",
                    stay: _ksmeLabel(KSME_STAY_OPTIONS, r.stay) || "미응답",
                    at: _ksmeTime(r.updatedAt),
                })),
            });
        }
        const p = people[people.length - 1];
        if (p.attend === "no" && p.stay) notes.push({ kind: "nostay", name, stay: _ksmeLabel(KSME_STAY_OPTIONS, p.stay) });
    });
    people.sort((x, y) => x.name.localeCompare(y.name, "ko"));
    return { people, notes };
}
function _ksmeRowTeam(r) {
    if (r.role === "professor") {
        const adv = (r.advisingTeamIds || []).map(_ksmeTeamName).join(", ");
        return adv ? adv + " 지도교수" : "";
    }
    return _ksmeTeamName(r.teamId);
}

let ksmeResultsRows = null;
let ksmeResultsErr = "";
let ksmeNonResp = null; // 관리자 전용: 응답 대상인데 참석 여부 미응답인 사람
let ksmeResultsSeq = 0; // 연속 렌더 시 늦게 끝난 옛 조회가 화면을 덮지 않도록

async function ksmeLoadResults() {
    ksmeResultsErr = "";
    try {
        ksmeResultsRows = await fsQuery("ksmeSurvey");
    } catch (e) {
        console.error("[KSME] 결과 조회 실패:", e.code || "", e.message || e);
        ksmeResultsRows = [];
        ksmeResultsErr = e.code === "permission-denied" ? "결과 열람 권한이 없습니다." : "결과를 불러오지 못했습니다.";
    }
    ksmeNonResp = null;
    if (currentProfile && currentProfile.role === "admin" && !ksmeResultsErr) {
        try {
            const users = await fsQuery("users");
            const answered = new Set(ksmeResultsRows.filter(r => r.attend).map(r => _ksmeNorm(r.name)));
            ksmeNonResp = users.filter(u =>
                ((u.role === "designer" || u.role === "engineer") && u.teamId)
                || (u.role === "professor" && (u.advisingTeamIds || []).length))
                .filter(u => !answered.has(_ksmeNorm(u.name)))
                .map(u => ({ name: u.name || "(이름 없음)", team: _ksmeRowTeam(u) }))
                .sort((a, b) => a.name.localeCompare(b.name, "ko"));
        } catch (_) { ksmeNonResp = null; }
    }
}

function _ksmeStatCard(label, n, sub, color) {
    return `
        <div class="rounded-xl border-2 border-${color}-200 bg-white p-4">
            <p class="text-[11px] font-black uppercase tracking-widest text-${color}-700 break-keep">${label}</p>
            <p class="text-3xl font-black text-${color}-900 mt-1">${n}<span class="text-base font-bold ml-0.5">명</span></p>
            ${sub ? `<p class="text-xs font-semibold text-neutral-500 mt-1 break-keep">${sub}</p>` : ""}
        </div>`;
}
function _ksmeNameChips(list) {
    if (!list.length) return `<p class="text-xs font-semibold text-neutral-400">없음</p>`;
    return `<div class="flex flex-wrap gap-1.5">${list.map(p =>
        `<span class="inline-flex items-center gap-1 text-xs font-bold bg-neutral-100 text-neutral-800 rounded-full px-2.5 py-1">${_ksmeEsc(p.name)}${p.team ? `<span class="font-semibold text-neutral-500">· ${_ksmeEsc(p.team)}</span>` : ""}${p.dup ? `<span class="text-amber-600" title="동명이인 응답 — 특이사항 참고">⚠</span>` : ""}</span>`).join("")}</div>`;
}

async function renderKsmeResults(skipLoad) {
    const page = document.getElementById("ksme-results-page");
    if (!page) return;
    const seq = ++ksmeResultsSeq;
    const head = _ksmeHeader("KSME Survey Results", "기계학회 수요조사 결과", "교수·관리자 전용 · 참석 인원 / 숙박 일자별 인원", "bg-rose-500");
    const wrap = inner => `<div class="max-w-5xl mx-auto px-6 py-12 lg:py-20">${head}<main class="text-neutral-900">${inner}</main>${_KSME_FOOTER}</div>`;

    if (typeof authResolved !== "undefined" && !authResolved) {
        page.innerHTML = wrap(_ksmeGateHtml({ state: "loading", msg: "로그인 상태를 확인하는 중입니다…" }));
        return;
    }
    if (!_ksmeCanSeeResults()) {
        page.innerHTML = wrap(`
            <div class="rounded-2xl border border-amber-300 bg-amber-50 p-6 md:p-8">
                <p class="font-extrabold text-amber-800">🔒 교수·관리자 계정만 볼 수 있는 페이지입니다.</p>
                ${currentUser ? "" : `<button onclick="openAuth('login')" class="mt-4 bg-neutral-900 hover:bg-indigo-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all">로그인</button>`}
            </div>`);
        return;
    }
    if (!skipLoad) {
        page.innerHTML = wrap(`<div class="rounded-2xl border border-neutral-200 bg-white p-8 text-center font-bold text-neutral-500">결과를 불러오는 중…</div>`);
        await ksmeLoadResults();
        if (seq !== ksmeResultsSeq) return;
    }
    if (ksmeResultsErr) {
        page.innerHTML = wrap(`<div class="rounded-2xl border border-rose-300 bg-rose-50 p-6 font-bold text-rose-700">${_ksmeEsc(ksmeResultsErr)}</div>`);
        return;
    }

    const { people, notes } = ksmeAggregate(ksmeResultsRows || []);
    const yes = people.filter(p => p.attend === "yes");
    const no = people.filter(p => p.attend === "no");
    const byStay = v => people.filter(p => p.stay === v);
    const s12 = byStay("d12"), s13 = byStay("d13"), sAny = byStay("any");
    const stayTotal = s12.length + s13.length + sAny.length;
    const dupCount = notes.filter(n => n.kind === "dup").length;

    const noteHtml = notes.length ? notes.map(n => {
        if (n.kind === "dup") {
            return `
                <li class="rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <p class="font-extrabold text-amber-900">⚠ 동명이인 응답: 「${_ksmeEsc(n.name)}」 ${n.count}개 계정 → 1인으로 집계${n.conflict ? ` <span class="text-rose-600">(응답 내용이 서로 다름 · 가장 최근 응답 기준으로 집계)</span>` : ""}</p>
                    <ul class="mt-2 space-y-1">
                        ${n.detail.map(d => `<li class="text-xs font-semibold text-neutral-700">· ${_ksmeEsc(d.team)} ${d.role ? "(" + _ksmeEsc(d.role) + ")" : ""} — 참석: <b>${_ksmeEsc(d.attend)}</b> / 숙박: <b>${_ksmeEsc(d.stay)}</b> <span class="opacity-60">${_ksmeEsc(d.at)}</span></li>`).join("")}
                    </ul>
                    <p class="text-xs font-semibold text-amber-700 mt-2">실제로 다른 사람이라면 인원이 1명 적게 집계되었을 수 있습니다. 확인이 필요합니다.</p>
                </li>`;
        }
        return `
            <li class="rounded-xl border border-neutral-300 bg-neutral-50 p-4">
                <p class="font-extrabold text-neutral-800">ℹ 「${_ksmeEsc(n.name)}」 — 참석 여부는 「불참」인데 숙박(${_ksmeEsc(n.stay)})을 응답함</p>
            </li>`;
    }).join("") : `<li class="text-sm font-semibold text-neutral-500">특이사항 없음</li>`;

    const nonRespHtml = ksmeNonResp ? `
        <section class="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8 mb-6">
            <h2 class="text-lg font-extrabold mb-1">참석 여부 미응답자 <span class="text-neutral-500">${ksmeNonResp.length}명</span></h2>
            <p class="text-xs font-semibold text-neutral-500 mb-3">관리자 전용 · 팀 배정된 가입자 중 참석 여부를 아직 응답하지 않은 사람</p>
            ${_ksmeNameChips(ksmeNonResp)}
        </section>` : "";

    page.innerHTML = wrap(`
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <p class="text-sm font-semibold text-neutral-600">응답 인원 <b class="text-neutral-900">${people.length}명</b> (응답 계정 ${(ksmeResultsRows || []).length}개)${dupCount ? ` · <span class="text-amber-700 font-bold">동명이인 ${dupCount}건 1인 처리</span>` : ""}</p>
            <button onclick="renderKsmeResults()" class="no-print text-sm font-bold bg-neutral-900 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl transition-all">↻ 새로고침</button>
        </div>

        <section class="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8 mb-6">
            <h2 class="text-lg font-extrabold mb-4">① 기계학회 참석 여부 <span class="text-sm font-semibold text-neutral-500">— ${_ksmeEsc(KSME_EVENT.when)}</span></h2>
            <div class="grid grid-cols-2 gap-3 mb-5">
                ${_ksmeStatCard("참석", yes.length, "", "indigo")}
                ${_ksmeStatCard("불참", no.length, "", "rose")}
            </div>
            <p class="text-xs font-black uppercase tracking-widest text-indigo-700 mb-2">참석자</p>
            ${_ksmeNameChips(yes)}
            <p class="text-xs font-black uppercase tracking-widest text-rose-700 mb-2 mt-4">불참자</p>
            ${_ksmeNameChips(no)}
        </section>

        <section class="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8 mb-6">
            <h2 class="text-lg font-extrabold mb-4">② 숙박 희망 일자 <span class="text-sm font-semibold text-neutral-500">— 숙박 응답 ${stayTotal}명 · 모두 1박</span></h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                ${_ksmeStatCard("12일(목) 밤 1박", s12.length, "12(목) 입실 → 13(금) 퇴실", "violet")}
                ${_ksmeStatCard("13일(금) 밤 1박", s13.length, "13(금) 입실 → 14(토) 퇴실", "violet")}
                ${_ksmeStatCard("어느 날이든 무관", sAny.length, "12일 밤 · 13일 밤 중 배정", "violet")}
            </div>
            <p class="text-xs font-black uppercase tracking-widest text-violet-700 mb-2">12일(목) 밤 1박</p>
            ${_ksmeNameChips(s12)}
            <p class="text-xs font-black uppercase tracking-widest text-violet-700 mb-2 mt-4">13일(금) 밤 1박</p>
            ${_ksmeNameChips(s13)}
            <p class="text-xs font-black uppercase tracking-widest text-violet-700 mb-2 mt-4">어느 날이든 무관</p>
            ${_ksmeNameChips(sAny)}
        </section>

        ${nonRespHtml}

        <section class="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
            <h2 class="text-lg font-extrabold mb-1">특이사항 <span class="text-neutral-500">${notes.length}건</span></h2>
            <p class="text-xs font-semibold text-neutral-500 mb-3">같은 이름으로 여러 계정이 응답하면 1인으로 집계하고 여기에 표시합니다.</p>
            <ul class="space-y-2">${noteHtml}</ul>
        </section>`);
}
window.renderKsmeResults = renderKsmeResults;

// 로그인/로그아웃 시 현재 보고 있는 조사 페이지를 다시 그림 (auth.js initAuth 에서 호출)
function ksmeOnAuthChange() {
    ksmeMyLoadedFor = null;
    ksmeMsg = { attend: "", stay: "" };
    if (typeof isCurrentPage !== "function") return;
    if (isCurrentPage("ksme-attend-page")) renderKsmeAttend();
    else if (isCurrentPage("ksme-stay-page")) renderKsmeStay();
    else if (isCurrentPage("ksme-results-page")) renderKsmeResults();
}
