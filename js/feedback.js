// ============================================================
//  피드백 (Phase 3) — 작품 상세 페이지의 교수 피드백
// ------------------------------------------------------------
//  · 작성: 모든 교수 + 관리자(담당팀 제한 없음).
//  · 공개범위: public(전체 공개) / team_only(팀원만 보기) — "팀원만 보기" 작품에도
//    피드백을 달 수 있고, 피드백 자체도 팀원만 보이게 할 수 있다.
//  · 조회: 권한자(admin/professor/소속 designer)는 workId 로, 그 외는 공개 피드백만(폴백).
//
//  feedbacks/{id} 스키마(SYSTEM_DESIGN 5.4 + authorName 비정규화):
//    { id, workId, teamId, authorId, authorName, content,
//      visibility:'public'|'team_only', createdAt }
//  ※ authorName 을 저장하는 이유: 디자이너는 보안규칙상 다른 users 문서를 읽을 수
//     없어, 작성자 이름을 매번 조회할 수 없으므로 작성 시점에 함께 저장(비정규화).
//
//  전역(다른 파일): escapeHtml, currentUser, currentProfile, fs* 헬퍼.
//  works.js 의 renderWorkDetail 이 #work-feedback 컨테이너를 만들고 호출한다.
// ============================================================

let feedbackWork = null; // 현재 피드백 대상 작품

function canWriteFeedback() {
    const r = currentProfile && currentProfile.role;
    return r === "professor" || r === "admin";
}
function canManageFeedback(f) {
    if (!currentUser) return false;
    return (currentProfile && currentProfile.role === "admin") || f.authorId === currentUser.uid;
}
function fbSortDesc(arr) {
    return (arr || []).slice().sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function loadWorkFeedback(work) {
    const wid = work._docId || work.id;
    const role = currentProfile && currentProfile.role;
    const privileged = role === "admin" || role === "professor"
        || (role === "designer" && currentProfile && currentProfile.teamId === work.teamId);
    if (privileged) {
        try { return fbSortDesc(await fsQueryWhere("feedbacks", "workId", wid)); }
        catch (e) { if (e.code !== "permission-denied") throw e; /* 폴백 ↓ */ }
    }
    const pub = await fsQueryWhere("feedbacks", "visibility", "public");
    return fbSortDesc(pub.filter(f => f.workId === wid));
}

async function renderWorkFeedback(work) {
    feedbackWork = work;
    const box = document.getElementById("work-feedback");
    if (!box) return;
    box.innerHTML = `<div class="py-6 text-center text-neutral-400 text-sm font-bold">피드백 불러오는 중…</div>`;
    let list = [];
    try {
        list = await loadWorkFeedback(work);
    } catch (e) {
        box.innerHTML = `<div class="mt-12 pt-8 border-t border-neutral-200"><p class="text-sm text-rose-600">피드백을 불러오지 못했습니다. ${escapeHtml(e.code || e.message || e)}</p></div>`;
        return;
    }
    drawWorkFeedback(list);
}
window.renderWorkFeedback = renderWorkFeedback;

function drawWorkFeedback(list) {
    const box = document.getElementById("work-feedback");
    if (!box) return;
    const items = list.length
        ? list.map(f => fbItemHtml(f)).join("")
        : `<p class="text-sm text-neutral-400 py-4">아직 등록된 피드백이 없습니다.</p>`;
    const form = canWriteFeedback() ? fbFormHtml() : "";
    box.innerHTML = `
        <div class="mt-12 pt-8 border-t border-neutral-200">
            <h2 class="text-lg font-extrabold mb-4">피드백 <span class="font-eng opacity-50">(${list.length})</span></h2>
            ${form}
            <div class="space-y-3 mt-5">${items}</div>
        </div>`;
    const fe = document.getElementById("feedback-form");
    if (fe) fe.addEventListener("submit", submitFeedback);
}

function fbItemHtml(f) {
    const manage = canManageFeedback(f)
        ? `<button onclick="deleteFeedback('${escapeHtml(f._docId || f.id)}')" class="text-xs font-bold text-rose-600 hover:underline">삭제</button>`
        : "";
    const vis = f.visibility === "team_only"
        ? `<span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">팀원만</span>`
        : "";
    return `
        <div class="border border-neutral-200 rounded-xl p-4 bg-white">
            <div class="flex items-center justify-between gap-3 mb-1.5">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white">교수</span>
                    <span class="text-sm font-bold">${escapeHtml(f.authorName || "교수")}</span>
                    ${vis}
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[11px] text-neutral-400">${escapeHtml(String(f.createdAt || "").slice(0, 10))}</span>
                    ${manage}
                </div>
            </div>
            <p class="text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">${escapeHtml(f.content || "")}</p>
        </div>`;
}

function fbFormHtml() {
    return `
        <form id="feedback-form" class="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
            <textarea name="content" rows="3" required placeholder="작품에 대한 피드백을 남기세요"
                class="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"></textarea>
            <div class="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <label class="block text-[11px] font-bold text-neutral-500 mb-1">이 피드백을 볼 수 있는 사람</label>
                    <select name="visibility" class="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">
                        <option value="public">전체 공개 (작품을 볼 수 있는 모두)</option>
                        <option value="team_only">팀원만 (이 작품의 팀·교수·관리자)</option>
                    </select>
                </div>
                <div class="flex items-center gap-3">
                    <p id="feedback-error" class="text-xs text-rose-600 font-semibold hidden"></p>
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2 rounded-lg transition-all">피드백 등록</button>
                </div>
            </div>
            <p class="text-[11px] text-neutral-400 leading-relaxed">※ <b>전체 공개 작품</b>이라도 <b>「팀원만」</b>으로 두면 이 피드백은 <b>해당 작품의 팀원·교수·관리자</b>에게만 보입니다. (다른 학생에게는 안 보임)</p>
        </form>`;
}

async function submitFeedback(e) {
    e.preventDefault();
    const el = e.target.elements;
    const content = el.content.value.trim();
    const errEl = document.getElementById("feedback-error");
    if (!content) {
        if (errEl) { errEl.textContent = "내용을 입력하세요."; errEl.classList.remove("hidden"); }
        return;
    }
    const work = feedbackWork;
    if (!work) return;
    const wid = work._docId || work.id;
    const id = `f_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "등록 중…"; }
    try {
        await fsSet(`feedbacks/${id}`, {
            id, workId: wid, teamId: work.teamId || "", authorId: currentUser.uid,
            authorName: (currentProfile && currentProfile.name) || currentUser.email || "교수",
            content, visibility: el.visibility.value, createdAt: new Date(),
        });
        await renderWorkFeedback(work);
    } catch (err) {
        const msg = (err.code === "permission-denied")
            ? "피드백 작성 권한이 없습니다. (교수·관리자만)"
            : (err.code || err.message || "등록에 실패했습니다.");
        if (errEl) { errEl.textContent = msg; errEl.classList.remove("hidden"); }
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}
window.submitFeedback = submitFeedback;

async function deleteFeedback(id) {
    if (!window.confirm("이 피드백을 삭제할까요?")) return;
    try {
        await fsDelete(`feedbacks/${id}`);
        if (feedbackWork) await renderWorkFeedback(feedbackWork);
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "삭제 권한이 없습니다."
            : (err.code || err.message || "삭제에 실패했습니다."));
    }
}
window.deleteFeedback = deleteFeedback;
