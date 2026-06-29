// ============================================================
//  인증 & 역할 (Authentication & Roles)
// ------------------------------------------------------------
//  Firebase Auth(compat) 기반. 이메일/비밀번호 + Google + Microsoft.
//  - 회원가입 시 역할(Role) 선택 → users/{uid} 문서 생성
//  - 소셜 로그인 최초 1회는 프로필 보완(역할 선택) 단계로 유도
//  - 역할: admin(관리자) / professor(교수) / designer(디자인학생) / engineer(공학학생)
//    ※ 자가 가입 가능 역할은 designer/engineer 뿐. admin/professor 는
//      관리자(또는 Firebase 콘솔)가 부여 → 보안규칙(firestore.rules)과 일치.
//
//  auth, db 는 firebase-config.js 에서 정의됩니다.
//  index.html 의 #auth-page / #dashboard-page / #auth-bar 컨테이너에 렌더링.
// ============================================================

const ROLE_LABELS = {
    admin: "관리자",
    professor: "교수",
    designer: "디자인 학생",
    engineer: "공학 학생",
};
// 자가 회원가입 시 선택 가능한 역할 (admin/professor 는 관리자 부여)
const SELF_SIGNUP_ROLES = ["designer", "engineer"];

// 전역 상태
let currentUser = null;     // Firebase Auth user
let currentProfile = null;  // users/{uid} 문서 데이터(role 포함)
let authMode = "login";     // 'login' | 'signup' | 'complete'
let dashboardEditing = false; // 대시보드 '내 정보 수정' 폼 표시 여부
let authResolved = false;   // 첫 인증 상태 확인 완료 여부(로딩 표시용)

// ------------------------------------------------------------
// 유틸
// ------------------------------------------------------------
function authReady() {
    return typeof auth !== "undefined" && auth !== null;
}
function getRole() {
    return currentProfile ? currentProfile.role : null;
}
function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function friendlyAuthError(e) {
    const map = {
        "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
        "auth/user-not-found": "등록되지 않은 이메일입니다.",
        "auth/wrong-password": "비밀번호가 올바르지 않습니다.",
        "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
        "auth/email-already-in-use": "이미 가입된 이메일입니다. 로그인해 주세요.",
        "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
        "auth/popup-closed-by-user": "로그인 창이 닫혔습니다.",
        "auth/account-exists-with-different-credential":
            "같은 이메일이 다른 로그인 방식으로 이미 가입돼 있습니다.",
    };
    return map[e && e.code] || (e && e.message) || "오류가 발생했습니다.";
}

// ------------------------------------------------------------
// 인증 동작
// ------------------------------------------------------------
async function signUpEmail({ email, password, name, role, university, department, studentId }) {
    if (!SELF_SIGNUP_ROLES.includes(role)) {
        throw new Error("선택할 수 없는 역할입니다.");
    }
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await createUserDoc(cred.user, { name, role, university, department, studentId });
}

async function signInEmail(email, password) {
    await auth.signInWithEmailAndPassword(email, password);
}

async function signInSocial(providerName) {
    let provider;
    if (providerName === "google") {
        provider = new firebase.auth.GoogleAuthProvider();
    } else if (providerName === "microsoft") {
        provider = new firebase.auth.OAuthProvider("microsoft.com");
    } else {
        throw new Error("알 수 없는 로그인 제공자");
    }
    // 팝업 로그인 → onAuthStateChanged 가 이어서 프로필 유무 확인
    await auth.signInWithPopup(provider);
}

// users/{uid} 문서 생성 (가입 또는 소셜 최초 로그인 시)
async function createUserDoc(user, { name, role, university, department, studentId }) {
    // ⚠️ SDK 대신 REST(fsSet). Enterprise 에디션 SDK 지연(~30s) 우회.
    //    로그인 사용자의 ID 토큰이 실려 규칙(create: 본인 uid)이 적용됨.
    await fsSet(`users/${user.uid}`, {
        email: user.email || "",
        name: name || user.displayName || "",
        role,
        university: university || "",
        department: department || "",
        studentId: studentId || "",
        teamId: null,
        createdAt: new Date(),
    });
}

// 프로필 조회(본인 문서) — REST(fsGet). 객체 또는 null 반환.
// 직후 첫 읽기가 일시 실패할 수 있어 가볍게 재시도.
async function fetchProfileWithRetry(uid, tries = 2) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
        try {
            return await fsGet(`users/${uid}`);
        } catch (e) {
            lastErr = e;
            await new Promise(r => setTimeout(r, 400));
        }
    }
    throw lastErr;
}

async function signOutUser() {
    await auth.signOut();
    navigateTo("landing");
}
window.signOutUser = signOutUser;

// 회원 탈퇴 — 프로필 문서 + 지원서 정리 후 Auth 계정 삭제.
//  ⚠️ Firestore 삭제는 토큰 유효할 때(Auth 삭제 전에) 먼저 한다.
//     Auth 삭제가 최근 로그인 필요(requires-recent-login)면 재인증 후 재시도.
async function withdrawAccount() {
    if (!currentUser) return;
    if (!window.confirm("정말 탈퇴하시겠어요?\n계정과 프로필이 삭제되며 되돌릴 수 없습니다.")) return;
    const typed = window.prompt('확인을 위해 "탈퇴" 를 입력해 주세요.');
    if (typed !== "탈퇴") { window.alert("입력이 일치하지 않아 취소되었습니다."); return; }

    async function reauth() {
        const pid = (currentUser.providerData && currentUser.providerData[0] || {}).providerId;
        if (pid === "google.com") return currentUser.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
        if (pid === "microsoft.com") return currentUser.reauthenticateWithPopup(new firebase.auth.OAuthProvider("microsoft.com"));
        const pw = window.prompt("보안 확인을 위해 비밀번호를 입력해 주세요.");
        if (!pw) throw new Error("재인증이 취소되었습니다.");
        return currentUser.reauthenticateWithCredential(
            firebase.auth.EmailAuthProvider.credential(currentUser.email, pw));
    }

    try {
        // 1) 지원서(공학생) 정리 — 있으면 삭제(best effort)
        try { await fsDelete(`applications/${currentUser.uid}`); } catch (_) {}
        // 2) 프로필 문서 삭제
        await fsDelete(`users/${currentUser.uid}`);
        // 3) 인증 계정 삭제 (필요 시 재인증)
        try {
            await currentUser.delete();
        } catch (e) {
            if (e.code === "auth/requires-recent-login") {
                await reauth();
                await currentUser.delete();
            } else { throw e; }
        }
        window.alert("탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
        navigateTo("landing");
    } catch (err) {
        window.alert("탈퇴 처리 중 문제가 발생했습니다: " + (err.code || err.message || err) +
            "\n프로필이 이미 삭제되었을 수 있으니, 문제가 지속되면 관리자에게 문의해 주세요.");
    }
}
window.withdrawAccount = withdrawAccount;

// ------------------------------------------------------------
// 인증 상태 감지 (앱 진입점)
// ------------------------------------------------------------
function initAuth() {
    if (!authReady()) {
        authResolved = true;
        renderAuthBar();
        return;
    }
    renderAuthBar(); // "확인 중…" 즉시 표시(로그인 세션 복원 대기)
    const _authStart = performance.now();
    let _firstFire = true;
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (_firstFire) {
            console.log(`[진단] 인증 상태 복원: ${Math.round(performance.now() - _authStart)}ms (user=${!!user})`);
            _firstFire = false;
        }
        try {
            if (user) {
                const _tp = performance.now();
                const snap = await fetchProfileWithRetry(user.uid);
                console.log(`[진단] 프로필 조회(read): ${Math.round(performance.now() - _tp)}ms (exists=${!!snap})`);
                if (snap) {
                    currentProfile = snap;
                    // 로그인/프로필 완성 화면에 있었다면 메인으로 자동 이동
                    if (authMode === "complete" || isCurrentPage("auth-page")) {
                        navigateTo("landing");
                    }
                } else {
                    // 소셜 최초 로그인(프로필 없음) → 역할/정보 입력 단계로 유도
                    currentProfile = null;
                    authMode = "complete";
                    navigateTo("auth");
                }
            } else {
                currentProfile = null;
            }
        } catch (e) {
            console.error("[Auth] 프로필 확인 중 오류:", e.code || "", e.message || e);
            // 프로필 확인 실패 시: 로그인 상태이면 정보 입력 단계로 안전하게 유도
            currentProfile = null;
            if (user) { authMode = "complete"; navigateTo("auth"); }
        }
        authResolved = true;
        renderAuthBar();
    });
}

function isCurrentPage(id) {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
}

// ------------------------------------------------------------
// 상단 인증 상태바 (모든 페이지 공통, 우상단 고정)
// ------------------------------------------------------------
function renderAuthBar() {
    const bar = document.getElementById("auth-bar");
    if (!bar) return;
    if (!authResolved) {
        bar.innerHTML = `<span class="inline-flex items-center gap-2 bg-white border border-neutral-200 rounded-full px-4 py-2.5 shadow-sm text-sm font-bold text-neutral-400">
            <span class="inline-block w-4 h-4 border-2 border-neutral-300 border-t-blue-600 rounded-full animate-spin"></span>확인 중…</span>`;
        return;
    }
    if (currentUser && currentProfile) {
        const roleLabel = ROLE_LABELS[currentProfile.role] || currentProfile.role;
        const name = currentProfile.name || currentUser.email || "";
        // 높이 고정(py-2.5)·이름 truncate·whitespace-nowrap 으로 글자수와 무관하게 정렬 일정.
        bar.innerHTML = `
            <button onclick="navigateTo('dashboard')" title="${escapeHtml(name)} · ${escapeHtml(roleLabel)}"
                class="inline-flex items-center gap-2.5 bg-white border border-neutral-300 hover:border-blue-600 rounded-full pl-2 pr-4 py-2.5 shadow-sm transition-all">
                <span class="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-600 text-white whitespace-nowrap shrink-0">${escapeHtml(roleLabel)}</span>
                <span class="text-sm font-bold text-neutral-800 max-w-[160px] truncate">${escapeHtml(name)}</span>
            </button>
            <button onclick="signOutUser()" title="로그아웃"
                class="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-rose-600 text-white text-sm font-bold px-4 py-2.5 rounded-full shadow-sm transition-all whitespace-nowrap shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                로그아웃
            </button>`;
    } else {
        bar.innerHTML = `
            <button onclick="openAuth('login')"
                class="bg-black hover:bg-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm transition-all uppercase tracking-wider font-eng">로그인 / 가입</button>`;
    }
}

// ------------------------------------------------------------
// 로그인/회원가입 페이지 렌더링
// ------------------------------------------------------------
function openAuth(mode) {
    authMode = mode || "login";
    navigateTo("auth");
}
window.openAuth = openAuth;

function setAuthMode(mode) {
    authMode = mode;
    renderAuthPage();
}
window.setAuthMode = setAuthMode;

function renderAuthPage() {
    const page = document.getElementById("auth-page");
    if (!page) return;

    const socialBlock = `
        <div class="space-y-2.5">
            <button type="button" onclick="handleSocial('google')"
                class="w-full flex items-center justify-center gap-2 border border-neutral-300 hover:bg-neutral-50 rounded-xl py-3 text-sm font-bold transition-all">
                <span class="text-base">G</span> Google 계정으로 계속하기
            </button>
            <button type="button" onclick="handleSocial('microsoft')"
                class="w-full flex items-center justify-center gap-2 border border-neutral-300 hover:bg-neutral-50 rounded-xl py-3 text-sm font-bold transition-all">
                <span class="text-base">⊞</span> Microsoft 계정으로 계속하기
            </button>
        </div>
        <div class="flex items-center gap-3 my-5">
            <div class="h-px bg-neutral-200 flex-1"></div>
            <span class="text-[10px] uppercase tracking-widest font-bold text-neutral-400">또는 이메일</span>
            <div class="h-px bg-neutral-200 flex-1"></div>
        </div>`;

    const roleOptions = SELF_SIGNUP_ROLES
        .map(r => `<option value="${r}">${ROLE_LABELS[r]}</option>`).join("");

    let inner = "";
    if (authMode === "login") {
        inner = `
            <h2 class="text-2xl font-black tracking-tight mb-1">로그인</h2>
            <p class="text-sm text-neutral-500 mb-6">AWCDW 워크숍 포털에 접속합니다.</p>
            ${socialBlock}
            <form id="auth-form" class="space-y-3">
                <input name="email" type="email" required placeholder="이메일"
                    class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <input name="password" type="password" required placeholder="비밀번호"
                    class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">로그인</button>
            </form>
            <p class="text-sm text-center mt-5 text-neutral-500">계정이 없으신가요?
                <button onclick="setAuthMode('signup')" class="font-bold text-blue-600 hover:underline">회원가입</button></p>`;
    } else if (authMode === "signup" || authMode === "complete") {
        const isComplete = authMode === "complete";
        inner = `
            <h2 class="text-2xl font-black tracking-tight mb-1">${isComplete ? "프로필 완성" : "회원가입"}</h2>
            <p class="text-sm text-neutral-500 mb-6">${isComplete
                ? "소셜 로그인이 확인됐습니다. 역할과 소속을 입력해 가입을 마칩니다."
                : "역할을 선택해 워크숍에 참여하세요."}</p>
            ${isComplete ? "" : socialBlock}
            <form id="auth-form" class="space-y-3">
                ${isComplete ? "" : `
                <input name="email" type="email" required placeholder="이메일"
                    class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <input name="password" type="password" required placeholder="비밀번호 (6자 이상)"
                    class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">`}
                <input name="name" type="text" required placeholder="이름"
                    value="${escapeHtml(isComplete && currentUser ? (currentUser.displayName || "") : "")}"
                    class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <select name="role" required
                    class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white">
                    <option value="" disabled selected>역할 선택</option>
                    ${roleOptions}
                </select>
                <div class="grid grid-cols-2 gap-3">
                    <input name="university" type="text" placeholder="소속 대학"
                        class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    <input name="department" type="text" placeholder="학과"
                        class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                </div>
                <input name="studentId" type="text" placeholder="학번"
                    class="w-full border border-neutral-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                <p class="text-[11px] text-neutral-400 leading-relaxed">※ 교수·관리자 역할은 관리자가 별도로 부여합니다.</p>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">${isComplete ? "가입 완료" : "가입하기"}</button>
            </form>
            ${isComplete ? `<p class="text-sm text-center mt-5 text-neutral-500">
                <button onclick="signOutUser()" class="font-bold text-neutral-600 hover:underline">취소하고 로그아웃</button></p>`
            : `<p class="text-sm text-center mt-5 text-neutral-500">이미 계정이 있으신가요?
                <button onclick="setAuthMode('login')" class="font-bold text-blue-600 hover:underline">로그인</button></p>`}`;
    }

    page.innerHTML = `
        <div class="max-w-md mx-auto px-6 py-12 lg:py-20">
            <button onclick="navigateTo('landing')"
                class="mb-8 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 메인으로</button>
            <div class="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
                ${inner}
                <p id="auth-error" class="text-sm text-rose-600 font-semibold mt-4 hidden"></p>
            </div>
        </div>`;

    const form = document.getElementById("auth-form");
    if (form) form.addEventListener("submit", handleAuthSubmit);
}

function showAuthError(msg) {
    const el = document.getElementById("auth-error");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const f = e.target;
    // ⚠️ form.name / form.role(ARIA) 등은 폼 엘리먼트의 네이티브 속성이라
    //    같은 이름의 input 을 가립니다 → 반드시 f.elements 로 접근.
    const el = f.elements;
    const btn = f.querySelector('button[type="submit"]');
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "처리 중…"; }
    try {
        if (authMode === "login") {
            await signInEmail(el.email.value.trim(), el.password.value);
        } else if (authMode === "signup") {
            await signUpEmail({
                email: el.email.value.trim(), password: el.password.value,
                name: el.name.value.trim(), role: el.role.value,
                university: el.university.value.trim(), department: el.department.value.trim(),
                studentId: el.studentId.value.trim(),
            });
        } else if (authMode === "complete") {
            if (!SELF_SIGNUP_ROLES.includes(el.role.value)) throw new Error("역할을 선택해 주세요.");
            const profileData = {
                name: el.name.value.trim(), role: el.role.value,
                university: el.university.value.trim(), department: el.department.value.trim(),
                studentId: el.studentId.value.trim(),
            };
            const _tw = performance.now();
            await createUserDoc(currentUser, profileData);
            console.log(`[진단] 프로필 저장(write): ${Math.round(performance.now() - _tw)}ms`);
            // 방금 저장한 값으로 즉시 반영 → 느린 재읽기 왕복 생략(빠른 전환)
            currentProfile = Object.assign({ email: currentUser.email || "", teamId: null }, profileData);
            renderAuthBar();
            navigateTo("landing"); // 가입 완료 → 메인으로
        }
        // 이메일 로그인/가입은 onAuthStateChanged 가 메인 이동 처리
    } catch (err) {
        showAuthError(friendlyAuthError(err));
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}

async function handleSocial(providerName) {
    try {
        await signInSocial(providerName);
    } catch (err) {
        showAuthError(friendlyAuthError(err));
    }
}
window.handleSocial = handleSocial;

// ------------------------------------------------------------
// 역할별 대시보드
// ------------------------------------------------------------
// 역할별 빠른 메뉴 (label, 설명, 동작). ready:false 면 "준비 중" 모달.
const DASHBOARD_MENUS = {
    admin: [
        { t: "사용자 관리", d: "가입자 역할·소속팀 배정", ready: true, go: "user-admin" },
        { t: "팀 배치 관리", d: "팀별 구성·교수·미배정 학생 배정", ready: true, go: "team-place" },
        { t: "팀 관리", d: "디자인팀 생성·수정·삭제", ready: true, go: "team-admin" },
        { t: "지원 현황", d: "공학생 지원·배정 관리", ready: true, onclick: "openApplicants()" },
        { t: "팀 배정 현황판", d: "공개 팀 보드 보기", ready: true, onclick: "openProposalBoard()" },
        { t: "차수별 진행 결과", d: "워크숍 진행 결과 발표 보드", ready: true, onclick: "openResultsBoard()" },
    ],
    professor: [
        { t: "작품 열람", d: "전체 작품 보기", ready: true, onclick: "openWorksGallery()" },
        { t: "피드백 작성", d: "작품 열어 피드백 남기기", ready: true, onclick: "openWorksGallery()" },
        { t: "지원자 명단", d: "공학생 지원 현황", ready: true, onclick: "openApplicants()" },
        { t: "팀 보드", d: "전체 팀 현황", ready: true, onclick: "openProposalBoard()" },
        { t: "차수별 진행 결과", d: "워크숍 진행 결과 발표 보드", ready: true, onclick: "openResultsBoard()" },
    ],
    designer: [
        { t: "작품 업로드", d: "우리 팀 작품 제출", ready: true, onclick: "goMyDesignerUpload()" },
        { t: "피드백 확인", d: "우리 팀 작품·피드백 보기", ready: true, onclick: "goMyTeam()" },
        { t: "팀 보드", d: "전체 팀 현황", ready: true, onclick: "openProposalBoard()" },
        { t: "차수별 진행 결과", d: "워크숍 진행 결과 발표 보드", ready: true, onclick: "openResultsBoard()" },
    ],
    engineer: [
        { t: "팀 지원", d: "팀 보드에서 신청", ready: true, onclick: "openProposalBoard()" },
        { t: "지원 현황", d: "내 배정 결과 확인", ready: true, onclick: "openApply()" },
        { t: "작품 둘러보기", d: "공개 작품 보기", ready: true, onclick: "openWorksGallery()" },
        { t: "차수별 진행 결과", d: "워크숍 진행 결과 발표 보드", ready: true, onclick: "openResultsBoard()" },
    ],
};

// 교수 대시보드: 내 지도 팀 바로가기 (advisingTeamIds 가 있을 때만)
function advisingTeamsHtml(role) {
    if (role !== "professor") return "";
    const adv = (currentProfile && currentProfile.advisingTeamIds) || [];
    if (!adv.length) return "";
    const links = adv.map(tid => {
        const name = (typeof teamMeta === "function") ? (teamMeta(tid).name || tid) : tid;
        return `<button onclick="openTeamDetail('${escapeHtml(tid)}')"
            class="border border-neutral-200 bg-white hover:border-blue-600 rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:shadow-md">${escapeHtml(name)} →</button>`;
    }).join("");
    return `
        <div class="mb-8">
            <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">내 지도 팀</h3>
            <div class="flex flex-wrap gap-2">${links}</div>
        </div>`;
}

function renderDashboard() {
    const page = document.getElementById("dashboard-page");
    if (!page) return;

    if (!currentUser || !currentProfile) {
        // 미로그인 → 로그인 유도
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold mb-4">로그인이 필요합니다.</p>
                <button onclick="openAuth('login')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">로그인 / 가입</button>
                <div class="mt-4"><button onclick="navigateTo('landing')" class="text-sm text-neutral-500 hover:underline">메인으로</button></div>
            </div>`;
        return;
    }

    const role = currentProfile.role;
    let menus = (DASHBOARD_MENUS[role] || []).slice();
    // 지원자 명단(팀 배정 결과)은 학생(공학/디자인)에게는 관리자가 공개한 이후에만 메뉴 노출
    if ((role === "engineer" || role === "designer")
        && typeof rosterPublic !== "undefined" && rosterPublic) {
        menus = menus.concat([{ t: "팀 배정 결과", d: "팀별 배정 명단 보기", ready: true, onclick: "openApplicants()" }]);
    }
    const cards = menus.map((m, i) => `
        <button onclick="${m.onclick ? m.onclick : (m.ready && m.go ? `navigateTo('${m.go}')` : `openPendingModal('${escapeHtml(m.t)}')`)}"
            class="group text-left border border-neutral-200 bg-white hover:border-blue-600 rounded-2xl p-6 transition-all hover:shadow-md">
            <div class="flex items-center justify-between mb-3">
                <span class="text-2xl font-black font-eng opacity-10 group-hover:opacity-30 transition-opacity">0${i + 1}</span>
                ${m.ready ? "" : `<span class="text-[9px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded">준비 중</span>`}
            </div>
            <h4 class="font-extrabold text-base mb-1">${escapeHtml(m.t)}</h4>
            <p class="text-xs text-neutral-500 font-medium">${escapeHtml(m.d)}</p>
        </button>`).join("");

    page.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <button onclick="navigateTo('landing')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 메인으로</button>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-2.5 py-1 rounded-full">${escapeHtml(ROLE_LABELS[role] || role)}</span>
                        <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">Dashboard</span>
                    </div>
                    <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight">${escapeHtml(currentProfile.name)} 님, 환영합니다</h1>
                    <p class="text-sm mt-2 opacity-70">${escapeHtml(currentProfile.university || "")} ${escapeHtml(currentProfile.department || "")}${currentProfile.studentId ? " · " + escapeHtml(currentProfile.studentId) : ""}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="toggleProfileEdit()" class="bg-neutral-900 hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all">내 정보 수정</button>
                    <button onclick="signOutUser()" class="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all">로그아웃</button>
                </div>
            </header>
            ${dashboardEditing ? profileEditHtml() : ""}
            ${advisingTeamsHtml(role)}
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                ${cards}
            </div>
        </div>`;

    const pform = document.getElementById("profile-form");
    if (pform) pform.addEventListener("submit", saveProfile);

    // 학생 대시보드: 명단 공개여부를 배경에서 최신화 → 바뀌었으면 1회 재렌더(메뉴 반영)
    if (typeof loadRosterPublic === "function" && (role === "engineer" || role === "designer")) {
        const before = (typeof rosterPublic !== "undefined") ? rosterPublic : false;
        loadRosterPublic().then(() => {
            if (rosterPublic !== before && isCurrentPage("dashboard-page")) renderDashboard();
        }).catch(() => {});
    }
}

// 내 정보 수정 폼 (이메일·역할은 변경 불가, 본인 정보만)
function profileEditHtml() {
    const p = currentProfile || {};
    return `
        <div class="bg-white border-2 border-blue-600 rounded-2xl p-6 mb-8 shadow-sm">
            <h3 class="font-extrabold text-lg mb-1">내 정보 수정</h3>
            <p class="text-xs text-neutral-500 mb-4">이메일과 역할은 변경할 수 없습니다. (역할 변경은 관리자에게 요청)</p>
            <form id="profile-form" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">이름 *</label>
                        <input name="name" type="text" required value="${escapeHtml(p.name || "")}"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">학번</label>
                        <input name="studentId" type="text" value="${escapeHtml(p.studentId || "")}"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">소속 대학</label>
                        <input name="university" type="text" value="${escapeHtml(p.university || "")}"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">학과</label>
                        <input name="department" type="text" value="${escapeHtml(p.department || "")}"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                </div>
                <p id="profile-error" class="text-sm text-rose-600 font-semibold hidden"></p>
                <div class="flex gap-3 pt-1">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all">저장하기</button>
                    <button type="button" onclick="toggleProfileEdit()" class="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-6 py-2.5 rounded-xl transition-all">취소</button>
                </div>
            </form>
            <div class="mt-5 pt-4 border-t border-neutral-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                <button type="button" onclick="withdrawAccount()" class="text-sm font-bold text-rose-600 hover:text-rose-700 transition-all">회원 탈퇴</button>
                <span class="text-xs text-neutral-400">계정·프로필이 삭제되며 되돌릴 수 없습니다.</span>
            </div>
        </div>`;
}

function toggleProfileEdit() {
    dashboardEditing = !dashboardEditing;
    renderDashboard();
    if (dashboardEditing) {
        const form = document.getElementById("profile-form");
        if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}
window.toggleProfileEdit = toggleProfileEdit;

async function saveProfile(e) {
    e.preventDefault();
    const el = e.target.elements;
    const errEl = document.getElementById("profile-error");
    const data = {
        name: el.name.value.trim(),
        studentId: el.studentId.value.trim(),
        university: el.university.value.trim(),
        department: el.department.value.trim(),
    };
    if (!data.name) {
        if (errEl) { errEl.textContent = "이름을 입력하세요."; errEl.classList.remove("hidden"); }
        return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "저장 중…"; }
    try {
        // 역할(role)은 보내지 않음 → 보안규칙상 본인 수정 시 role 변경 불가
        await fsUpdate(`users/${currentUser.uid}`, data);
        currentProfile = Object.assign({}, currentProfile, data);
        dashboardEditing = false;
        renderAuthBar();
        renderDashboard();
    } catch (err) {
        const msg = (err.code === "permission-denied")
            ? "수정 권한이 없습니다. 다시 로그인해 주세요."
            : (err.code || err.message || "저장에 실패했습니다.");
        if (errEl) { errEl.textContent = msg; errEl.classList.remove("hidden"); }
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}
window.saveProfile = saveProfile;

// ------------------------------------------------------------
// 관리자: 팀 관리 (Team Management) — admin 전용 CRUD
// ------------------------------------------------------------
//  Firestore 'teams' 컬렉션을 콘솔 없이 화면에서 관리.
//  팀 스키마: { id, name, code, members: string[] }  (문서 ID = id)
//  쓰기는 firestore.rules 상 admin 만 허용됨.
// ------------------------------------------------------------

let teamAdminTeams = [];          // 현재 로드된 팀 목록(_docId 포함)
let teamAdminUsers = [];          // 교수 배정 표시용 사용자 목록
let teamAdminEditingId = null;    // null=폼 닫힘 / ""=새 팀 추가 / "A"=기존 팀 편집
let teamAdminError = "";          // 폼 영역에 표시할 오류 메시지

async function renderTeamAdmin() {
    const page = document.getElementById("team-admin-page");
    if (!page) return;

    // 권한 가드 ------------------------------------------------
    if (!currentUser || !currentProfile) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold mb-4">로그인이 필요합니다.</p>
                <button onclick="openAuth('login')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">로그인 / 가입</button>
                <div class="mt-4"><button onclick="navigateTo('landing')" class="text-sm text-neutral-500 hover:underline">메인으로</button></div>
            </div>`;
        return;
    }
    if (currentProfile.role !== "admin") {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold mb-2">관리자 전용 페이지입니다.</p>
                <p class="text-sm text-neutral-500 mb-6">팀 관리는 관리자(admin) 계정만 사용할 수 있습니다.</p>
                <button onclick="navigateTo('dashboard')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">내 대시보드로</button>
            </div>`;
        return;
    }

    // 로딩 후 Firestore 최신 목록 --------------------------------
    page.innerHTML = `<div class="max-w-7xl mx-auto px-6 py-24 text-center text-neutral-400 font-bold">팀 목록 불러오는 중…</div>`;
    try {
        teamAdminTeams = await fsQuery("teams", "id"); // [{_docId, id, name, code, members}]
        // 교수 지도 팀 표시용 사용자 목록(admin 만 read 허용). 실패해도 팀 목록은 표시.
        try { teamAdminUsers = await fsQuery("users"); } catch (_) { teamAdminUsers = []; }
    } catch (e) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold text-rose-600 mb-2">팀 목록을 불러오지 못했습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">${escapeHtml(e.code || e.message || e)}</p>
                <button onclick="renderTeamAdmin()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">다시 시도</button>
            </div>`;
        return;
    }
    drawTeamAdmin();
}
window.renderTeamAdmin = renderTeamAdmin;

function drawTeamAdmin() {
    const page = document.getElementById("team-admin-page");
    if (!page) return;

    // 팀별 지도 교수: users 중 advisingTeamIds 에 이 팀이 포함된 professor.
    const profsForTeam = (tid) => (teamAdminUsers || []).filter(u =>
        u.role === "professor" && (u.advisingTeamIds || []).includes(tid));

    const rows = teamAdminTeams.map(t => {
        const profs = profsForTeam(t.id || t._docId);
        const profCell = profs.length
            ? `<div class="flex flex-wrap gap-1">${profs.map(p =>
                `<span class="text-xs font-bold bg-violet-50 text-violet-700 px-2 py-0.5 rounded">${escapeHtml(p.name || p.email || "교수")}</span>`).join("")}</div>`
            : `<span class="text-xs text-neutral-400">미배정</span>`;
        return `
        <tr class="border-b border-neutral-100 hover:bg-neutral-50">
            <td class="px-4 py-3 font-black font-eng">${escapeHtml(t.id)}</td>
            <td class="px-4 py-3 font-bold">${escapeHtml(t.name)}</td>
            <td class="px-4 py-3 text-neutral-500 font-eng text-xs">${escapeHtml(t.code || "")}</td>
            <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                    ${(t.members || []).map(m => `<span class="text-xs font-bold bg-neutral-100 px-2 py-0.5 rounded">${escapeHtml(m)}</span>`).join("")}
                </div>
            </td>
            <td class="px-4 py-3">${profCell}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
                <button onclick="openTeamForm('${escapeHtml(t._docId)}')"
                    class="text-xs font-bold text-blue-600 hover:underline mr-3">수정</button>
                <button onclick="deleteTeam('${escapeHtml(t._docId)}','${escapeHtml(t.name)}')"
                    class="text-xs font-bold text-rose-600 hover:underline">삭제</button>
            </td>
        </tr>`;
    }).join("");

    const emptyRow = `<tr><td colspan="6" class="px-4 py-10 text-center text-neutral-400 font-bold">등록된 팀이 없습니다. ‘+ 새 팀 추가’로 시작하세요.</td></tr>`;

    page.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <button onclick="navigateTo('dashboard')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 대시보드</button>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-2.5 py-1 rounded-full">관리자</span>
                        <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">Team Management</span>
                    </div>
                    <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight">팀 관리</h1>
                    <p class="text-sm mt-2 opacity-70">디자인팀을 화면에서 직접 생성·수정·삭제합니다. (총 ${teamAdminTeams.length}팀)</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-2">
                    <button onclick="runSyncTeamsFromUsers()" title="사용자 관리의 소속 팀 정보를 기준으로 각 팀의 팀원(디자이너) 명단을 다시 맞춥니다." class="bg-neutral-900 hover:bg-blue-600 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all whitespace-nowrap">↻ 사용자 관리 기준 동기화</button>
                    <button onclick="openTeamForm('')" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-3 rounded-xl transition-all whitespace-nowrap">+ 새 팀 추가</button>
                </div>
            </header>

            ${teamAdminEditingId !== null ? teamFormHtml() : ""}

            <div class="bg-white border border-neutral-200 rounded-2xl overflow-x-auto">
                <table class="w-full text-sm text-left min-w-[860px]">
                    <thead class="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500 font-bold">
                        <tr>
                            <th class="px-4 py-3">ID</th>
                            <th class="px-4 py-3">팀 이름</th>
                            <th class="px-4 py-3">코드</th>
                            <th class="px-4 py-3">팀원</th>
                            <th class="px-4 py-3">지도 교수</th>
                            <th class="px-4 py-3 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody>${teamAdminTeams.length ? rows : emptyRow}</tbody>
                </table>
            </div>
        </div>`;

    const form = document.getElementById("team-form");
    if (form) form.addEventListener("submit", saveTeam);
}

// 편집 대상 팀(_docId 기준). 새 팀이면 빈 값.
function teamFormHtml() {
    const isNew = teamAdminEditingId === "";
    const t = isNew ? { id: "", name: "", code: "", members: [] }
                    : (teamAdminTeams.find(x => x._docId === teamAdminEditingId) || { id: "", name: "", code: "", members: [] });
    const membersStr = (t.members || []).join(", ");
    return `
        <div class="bg-white border-2 border-blue-600 rounded-2xl p-6 mb-6 shadow-sm">
            <h3 class="font-extrabold text-lg mb-4">${isNew ? "새 팀 추가" : `팀 수정 — ${escapeHtml(t.name || t.id)}`}</h3>
            <form id="team-form" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">팀 ID *</label>
                        <input name="id" type="text" required value="${escapeHtml(t.id)}" ${isNew ? "" : "readonly"}
                            placeholder="예: A"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 ${isNew ? "" : "bg-neutral-100 text-neutral-500"}">
                        ${isNew ? `<p class="text-[10px] text-neutral-400 mt-1">문서 ID로 사용됩니다. 생성 후 변경 불가.</p>` : ""}
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">팀 이름 *</label>
                        <input name="name" type="text" required value="${escapeHtml(t.name)}" placeholder="예: A팀"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">코드</label>
                        <input name="code" type="text" value="${escapeHtml(t.code || "")}" placeholder="예: Team.A"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div class="sm:col-span-3">
                        <label class="block text-xs font-bold text-neutral-500 mb-1">팀원 (쉼표로 구분)</label>
                        <input name="members" type="text" value="${escapeHtml(membersStr)}" placeholder="예: 유서연, 김나연"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">공학생 정원</label>
                        <input name="capacity" type="number" min="0" value="${escapeHtml(t.capacity != null ? t.capacity : 3)}" placeholder="3"
                            class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                </div>
                ${teamAdminError ? `<p class="text-sm text-rose-600 font-semibold">${escapeHtml(teamAdminError)}</p>` : ""}
                <div class="flex gap-3 pt-1">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all">${isNew ? "추가하기" : "저장하기"}</button>
                    <button type="button" onclick="closeTeamForm()" class="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-6 py-2.5 rounded-xl transition-all">취소</button>
                </div>
            </form>
        </div>`;
}

function openTeamForm(docId) {
    teamAdminEditingId = docId; // "" = 새 팀, 그 외 = 편집
    teamAdminError = "";
    drawTeamAdmin();
    const form = document.getElementById("team-form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
}
window.openTeamForm = openTeamForm;

function closeTeamForm() {
    teamAdminEditingId = null;
    teamAdminError = "";
    drawTeamAdmin();
}
window.closeTeamForm = closeTeamForm;

async function saveTeam(e) {
    e.preventDefault();
    const f = e.target;
    const isNew = teamAdminEditingId === "";
    // ⚠️ form.id / form.name 은 네이티브 속성이라 같은 이름의 input 을 가림 → elements 로 접근
    const el = f.elements;
    const id = el.id.value.trim();
    const name = el.name.value.trim();
    const code = el.code.value.trim();
    const members = el.members.value.split(",").map(s => s.trim()).filter(Boolean);
    const capRaw = el.capacity ? parseInt(el.capacity.value, 10) : NaN;
    const capacity = Number.isFinite(capRaw) && capRaw >= 0 ? capRaw : 3;

    teamAdminError = "";
    if (!id) { teamAdminError = "팀 ID를 입력하세요."; drawTeamAdmin(); return; }
    if (!name) { teamAdminError = "팀 이름을 입력하세요."; drawTeamAdmin(); return; }
    // 새 팀일 때 ID 중복 방지
    if (isNew && teamAdminTeams.some(t => t._docId === id || t.id === id)) {
        teamAdminError = `팀 ID "${id}" 가 이미 존재합니다.`;
        drawTeamAdmin();
        return;
    }

    const btn = f.querySelector('button[type="submit"]');
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "저장 중…"; }
    try {
        await fsSet(`teams/${id}`, { id, name, code, members, capacity });
        // 팀원(이름) → 학생 계정 teamId 동기화 (사용자 관리 화면과 일치)
        try { await syncAllTeamIds(); } catch (_) { /* 동기화 실패는 저장을 막지 않음 */ }
        teamAdminEditingId = null;
        await renderTeamAdmin();   // Firestore 에서 다시 읽어 화면 갱신
        await refreshPublicTeams(); // 공개 팀 보드에도 반영
    } catch (err) {
        teamAdminError = (err.code === "permission-denied")
            ? "쓰기 권한이 없습니다. 관리자(admin) 계정인지 확인하세요."
            : (err.code || err.message || "저장에 실패했습니다.");
        drawTeamAdmin();
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}
window.saveTeam = saveTeam;

async function deleteTeam(docId, name) {
    if (!window.confirm(`"${name || docId}" 팀을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    try {
        await fsDelete(`teams/${docId}`);
        // 삭제된 팀에 속했던 학생들의 teamId 도 정리(미배정으로)
        try { await syncAllTeamIds(); } catch (_) {}
        await renderTeamAdmin();
        await refreshPublicTeams();
    } catch (err) {
        const msg = (err.code === "permission-denied")
            ? "삭제 권한이 없습니다. 관리자(admin) 계정인지 확인하세요."
            : (err.code || err.message || "삭제에 실패했습니다.");
        window.alert(msg);
    }
}
window.deleteTeam = deleteTeam;

// 공개 팀 보드(main.js 의 teams 배열)도 최신 데이터로 갱신
async function refreshPublicTeams() {
    if (typeof loadTeams === "function") {
        await loadTeams();
        if (typeof renderTeams === "function" && isCurrentPage("teams-page")) renderTeams();
    }
}

// ------------------------------------------------------------
// 팀 배정 동기화 (지원자 명단 + 팀 명단  →  users.teamId)
// ------------------------------------------------------------
//  학생 계정의 소속 팀(users/{uid}.teamId)을 두 소스에 맞춘다.
//   1) 지원자 명단 applications/{uid}.assignedTeamId — 공학생(uid 기준, 가장 정확)
//   2) 팀 명단 teams.members(이름) — 디자이너(이름 일치, 공백 제거)
//  지원자 명단(uid)이 이름 매칭보다 우선한다. 교수·관리자는 teamId 미사용 → 제외.
// ------------------------------------------------------------

// 위 두 소스 기준으로 각 user 가 가져야 할 teamId 를 계산해
// 현재 값과 다른 항목만 [{uid, teamId}] 로 돌려준다.
function reconcileTeamIds(teams, users, apps) {
    // 1) uid → 배정 팀 (지원자 명단 — 가장 신뢰도 높음)
    const uidToTeam = new Map();
    (apps || []).forEach(a => {
        if (a.status === "assigned" && a.assignedTeamId && a.engineerId) {
            uidToTeam.set(a.engineerId, a.assignedTeamId);
        }
    });
    // 2) 이름 → 팀 (팀 명단: 디자이너 members + 공학생 engineers)
    const nameToTeam = new Map();
    (teams || []).forEach(t => {
        const tid = t.id || t._docId;
        const names = (typeof teamRoster === "function")
            ? teamRoster(t)
            : (t.members || []).concat(t.engineers || []);
        names.forEach(m => {
            const key = String(m == null ? "" : m).trim();
            if (key) nameToTeam.set(key, tid); // 한 이름이 여러 팀에 있으면 마지막 팀 우선
        });
    });
    const ops = [];
    (users || []).forEach(u => {
        if (u.role === "professor" || u.role === "admin") return; // teamId 미사용
        // 우선순위: 지원자 명단(uid) > 팀 명단(이름)
        const want = uidToTeam.get(u._docId)
            || nameToTeam.get(String(u.name == null ? "" : u.name).trim())
            || null;
        const have = u.teamId || null;
        if (want !== have) ops.push({ uid: u._docId, teamId: want });
    });
    return ops;
}

// 사용자 관리(users) 기준으로 팀 관리(teams.members)를 다시 맞춘다 (users → teams 방향).
//  · 각 팀 members = 그 팀 소속(teamId 일치) 학생 = '디자이너 + 공학생' 이름.
//    (디자이너를 앞에, 공학생을 뒤에 두고 각 그룹 내 가나다순)
//  · 지도교수(advisingProfessors)도 함께 최신화(공개 설정 반영).
//  · 변경된 팀 수를 반환.
async function syncTeamsFromUsers() {
    const [teams, users] = await Promise.all([fsQuery("teams", "id"), fsQuery("users")]);
    let changed = 0;
    for (const t of teams) {
        const tid = t.id || t._docId;
        const pick = (role) => users
            .filter(u => u.role === role && (u.teamId || null) === tid)
            .map(u => String(u.name || u.email || "").trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        const members = pick("designer");   // 디자이너 → members
        const engineers = pick("engineer"); // 공학생   → engineers
        const cur = t.members || [], curE = t.engineers || [];
        const same = cur.length === members.length && cur.every((v, i) => v === members[i])
            && curE.length === engineers.length && curE.every((v, i) => v === engineers[i]);
        if (!same) { await fsUpdate(`teams/${tid}`, { members, engineers }); t.members = members; t.engineers = engineers; changed++; }
    }
    try { await rebuildTeamProfessors(teams, users); } catch (_) {}
    return changed;
}

// 팀 관리 페이지 '사용자 관리 기준 동기화' 버튼 핸들러
async function runSyncTeamsFromUsers() {
    if (!window.confirm("사용자 관리의 소속 팀 정보를 기준으로 각 팀의 팀원(디자이너) 명단을 다시 맞춥니다.\n진행할까요?")) return;
    try {
        const n = await syncTeamsFromUsers();
        await renderTeamAdmin();
        if (typeof refreshPublicTeams === "function") await refreshPublicTeams();
        window.alert(n > 0 ? `${n}개 팀의 팀원 명단을 동기화했습니다.` : "이미 모두 사용자 관리와 일치합니다.");
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "권한이 없습니다. 관리자(admin) 계정인지 확인하세요."
            : (err.code || err.message || "동기화에 실패했습니다."));
    }
}
window.runSyncTeamsFromUsers = runSyncTeamsFromUsers;

// 사용자 관리의 '소속 팀' 드롭다운으로 학생을 옮길 때, 팀 명단(members)도 함께 갱신.
// teams.members(이름)를 단일 진실 소스로 유지하기 위해 양방향으로 맞춘다.
//  oldName/newName: 이전·현재 이름(이름도 같은 저장에서 바뀔 수 있음)
async function syncUserNameIntoTeams(oldName, newName, oldTeamId, newTeamId) {
    const nm = String(newName == null ? "" : newName).trim();
    const onm = String(oldName == null ? "" : oldName).trim();
    // 1) 이전 팀에서 이름 제거 (팀이 바뀌었거나 이름이 바뀐 경우)
    if (oldTeamId && (oldTeamId !== newTeamId || onm !== nm)) {
        const ot = (userAdminTeams || []).find(t => (t.id || t._docId) === oldTeamId);
        if (ot) {
            const members = (ot.members || []).filter(m => {
                const v = String(m).trim();
                return v !== onm && v !== nm;
            });
            await fsUpdate(`teams/${ot.id || ot._docId}`, { members });
            ot.members = members; // 로컬 캐시도 갱신
        }
    }
    // 2) 새 팀 명단에 이름 추가 (없을 때만)
    if (newTeamId && nm) {
        const nt = (userAdminTeams || []).find(t => (t.id || t._docId) === newTeamId);
        const cur = nt ? (nt.members || []).map(m => String(m).trim()) : [];
        if (!cur.includes(nm)) {
            const members = (nt && nt.members ? nt.members.slice() : []);
            members.push(nm);
            await fsUpdate(`teams/${newTeamId}`, { members });
            if (nt) nt.members = members;
        }
    }
}

// 팀별 지도 교수 이름을 팀 문서(teams.advisingProfessors)에 비정규화한다.
//  · users 컬렉션은 일반 사용자가 읽을 수 없으므로(규칙상 admin/본인만),
//    공개 '팀 배치 현황' 보드가 교수를 표시하려면 공개 읽기 가능한 teams 에 넣어둬야 한다.
//  · 관리자 동작(교수 배정 저장·동기화·배치 관리 진입) 때마다 최신화한다.
async function rebuildTeamProfessors(teams, users) {
    // 관리자가 '공개'로 설정했을 때만 교수 명단을 팀 문서에 비정규화한다.
    // 비공개 상태면 빈 배열로 정리해 공개/결과 보드에 노출되지 않게 한다.
    const pub = (typeof professorsPublic !== "undefined") ? professorsPublic : false;
    teams = teams || await fsQuery("teams", "id");
    if (pub) users = users || await fsQuery("users");
    for (const t of teams) {
        const tid = t.id || t._docId;
        const names = pub
            ? users.filter(u => u.role === "professor" && (u.advisingTeamIds || []).includes(tid))
                   .map(u => u.name || u.email || "교수")
            : [];
        const cur = t.advisingProfessors || [];
        const same = cur.length === names.length && cur.every((v, i) => v === names[i]);
        if (!same) {
            try { await fsUpdate(`teams/${tid}`, { advisingProfessors: names }); t.advisingProfessors = names; }
            catch (_) { /* 비정규화 실패는 치명적이지 않음 */ }
        }
    }
}

// 전체 사용자/팀/지원자 명단을 읽어 teamId 를 일괄 동기화. 변경한 사용자 수를 반환.
async function syncAllTeamIds() {
    const [teams, users, apps] = await Promise.all([
        fsQuery("teams", "id"),
        fsQuery("users"),
        fsQuery("applications").catch(() => []), // 지원자 명단(로그인 사용자 read 허용)
    ]);
    try { await rebuildTeamProfessors(teams, users); } catch (_) {}
    const ops = reconcileTeamIds(teams, users, apps);
    for (const op of ops) {
        await fsUpdate(`users/${op.uid}`, { teamId: op.teamId });
        // 본인 계정이 바뀌면 화면 상태에도 즉시 반영
        if (currentUser && op.uid === currentUser.uid) {
            currentProfile = Object.assign({}, currentProfile, { teamId: op.teamId });
        }
    }
    return ops.length;
}

// ------------------------------------------------------------
// 팀배분 기준 마스터(Excel) → Firestore 일괄 동기화
// ------------------------------------------------------------
//  teams-data.js 의 MASTER_ASSIGNMENT(Excel 전체 명단)을 단일 기준으로 삼아
//  모든 관리/공개 화면을 통일한다.
//   · 각 팀 문서: members(디자이너)·engineers(공학생)·professorsRoster(지도교수
//     이름)·designProfs·engProfs·capacity(공학생 수)·name·code 를 마스터로 맞춤.
//   · 마스터에 없는 팀(예: 분리 전 H팀)은 명단을 비워 잔여 표시 제거.
//   · 이름이 일치하는 계정의 소속 팀(teamId)도 reconcile 로 함께 맞춤.
//   · 계정이 없는(이름 매칭 실패) 학생·교수는 리포트로 돌려준다(관리자 수동 처리).
//  반환: { teamsChanged, usersChanged, unmatchedStudents[], unmatchedProfs[] }
// ------------------------------------------------------------
let masterSyncReport = null; // 직전 동기화 결과(미매칭 명단) — 관리 화면 상단에 표시

async function syncFromMaster() {
    if (typeof MASTER_ASSIGNMENT === "undefined") throw new Error("기준 명단(MASTER_ASSIGNMENT)을 찾을 수 없습니다.");
    if (typeof loadAppSettings === "function") { try { await loadAppSettings(); } catch (_) {} }

    const [teams, users, apps] = await Promise.all([
        fsQuery("teams", "id"),
        fsQuery("users"),
        fsQuery("applications").catch(() => []),
    ]);
    const byId = new Map(teams.map(t => [(t.id || t._docId), t]));
    const masterIds = new Set(MASTER_ASSIGNMENT.map(m => m.id));

    let teamsChanged = 0;

    // 1) 마스터 팀들을 teams 문서에 반영 -----------------------
    for (const m of MASTER_ASSIGNMENT) {
        const doc = masterTeamDoc(m); // {id,name,code,members,engineers,professorsRoster,designProfs,engProfs,capacity}
        const cur = byId.get(m.id);
        const next = {
            name: doc.name, code: doc.code,
            members: doc.members, engineers: doc.engineers,
            professorsRoster: doc.professorsRoster,
            designProfs: doc.designProfs, engProfs: doc.engProfs,
            capacity: doc.capacity,
        };
        if (cur) {
            await fsUpdate(`teams/${m.id}`, next);
            Object.assign(cur, next);
        } else {
            await fsSet(`teams/${m.id}`, Object.assign({ id: m.id }, next));
            byId.set(m.id, Object.assign({ id: m.id }, next));
        }
        teamsChanged++;
    }

    // 2) 마스터에 없는 팀(예: B+H 통합 전 H팀)의 잔여 명단 정리 ----
    for (const t of teams) {
        const tid = t.id || t._docId;
        if (masterIds.has(tid)) continue;
        const hasRoster = (t.members && t.members.length) || (t.engineers && t.engineers.length);
        if (hasRoster) {
            await fsUpdate(`teams/${tid}`, { members: [], engineers: [] });
            t.members = []; t.engineers = [];
            teamsChanged++;
        }
    }

    // 3) 이름이 일치하는 계정의 소속 팀(teamId) reconcile ---------
    //    (reconcileTeamIds 는 위에서 갱신한 teams 의 members+engineers 를 이름 기준으로 사용)
    const teamsNow = Array.from(byId.values());
    const ops = reconcileTeamIds(teamsNow, users, apps);
    for (const op of ops) {
        await fsUpdate(`users/${op.uid}`, { teamId: op.teamId });
        const lu = users.find(u => u._docId === op.uid);
        if (lu) lu.teamId = op.teamId; // 로컬 캐시도 갱신(아래 재구성·리포트 일관성)
        if (currentUser && op.uid === currentUser.uid) {
            currentProfile = Object.assign({}, currentProfile, { teamId: op.teamId });
        }
    }

    // 3.5) 팀 문서(members=디자이너 / engineers=공학생 / advisingProfessors)를
    //      방금 갱신한 계정(users)의 소속 팀 기준으로 재구성한다.
    //      → 공개 '팀 배치 현황'·결과 보드까지 '사용자 관리'와 동일하게 통일.
    try { await syncTeamsFromUsers(); } catch (_) {}

    // 4) 계정 없는(이름 매칭 실패) 인원 리포트 -------------------
    const accountNames = new Set(
        users.map(u => String(u.name == null ? "" : u.name).trim()).filter(Boolean)
    );
    const unmatchedStudents = [], unmatchedProfs = [];
    MASTER_ASSIGNMENT.forEach(m => {
        teamRoster(masterTeamDoc(m)).forEach(nm => {
            const name = String(nm).trim();
            if (name && !accountNames.has(name)) unmatchedStudents.push({ name, team: m.name });
        });
        m.designProfs.concat(m.engProfs).forEach(nm => {
            // '김현준/김석민' 같이 슬래시로 묶인 경우는 masterTeamDoc 에서 이미 분리됨
            const name = String(nm).trim();
            if (name && !accountNames.has(name)) unmatchedProfs.push({ name, team: m.name });
        });
    });

    masterSyncReport = {
        teamsChanged, usersChanged: ops.length,
        unmatchedStudents, unmatchedProfs,
    };
    return masterSyncReport;
}

// 미매칭 인원 리포트 패널 HTML(동기화 직후 관리 화면 상단에 표시)
function masterSyncReportHtml() {
    const r = masterSyncReport;
    if (!r) return "";
    const chips = (arr) => arr.length
        ? arr.map(x => `<span class="inline-flex items-center gap-1 text-xs font-bold bg-white border border-amber-300 text-amber-800 px-2 py-1 rounded-lg">${escapeHtml(x.name)}<span class="text-[10px] font-normal text-amber-500">${escapeHtml(x.team)}</span></span>`).join(" ")
        : `<span class="text-xs text-emerald-700 font-bold">모두 계정과 연결됨 ✅</span>`;
    return `
        <div class="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 mb-8">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div>
                    <p class="font-extrabold text-amber-900">Excel 기준 동기화 완료</p>
                    <p class="text-xs text-amber-700 mt-0.5">팀 ${r.teamsChanged}건 반영 · 계정 소속 팀 ${r.usersChanged}명 갱신</p>
                </div>
                <button onclick="dismissMasterSyncReport()" class="text-amber-500 hover:text-amber-800 text-sm font-bold shrink-0">닫기 ✕</button>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                    <p class="text-[11px] font-black uppercase tracking-wider text-amber-700 mb-1.5">계정 없는 학생 (${r.unmatchedStudents.length})</p>
                    <div class="flex flex-wrap gap-1.5">${chips(r.unmatchedStudents)}</div>
                </div>
                <div>
                    <p class="text-[11px] font-black uppercase tracking-wider text-amber-700 mb-1.5">계정 없는 지도교수 (${r.unmatchedProfs.length})</p>
                    <div class="flex flex-wrap gap-1.5">${chips(r.unmatchedProfs)}</div>
                </div>
            </div>
            <p class="text-[11px] text-amber-600 mt-3">※ 위 인원은 가입 계정이 없거나 이름 표기(영문/띄어쓰기 등)가 달라 자동 매칭되지 않았습니다. 가입 후 ‘사용자 관리’에서 배정하거나, ‘팀 배치 관리 → 계정 없는 학생 직접 추가’로 명단에 넣어 주세요.</p>
        </div>`;
}

function dismissMasterSyncReport() {
    masterSyncReport = null;
    if (isCurrentPage("user-admin-page")) drawUserAdmin();
    else if (isCurrentPage("team-place-page")) drawTeamPlace();
}
window.dismissMasterSyncReport = dismissMasterSyncReport;

// 관리 화면의 「Excel 기준 일괄 동기화」 버튼 핸들러
async function runSyncFromMaster() {
    const ok = window.confirm(
        "‘2026 적층제조융합설계 워크숍_팀배분’ Excel 기준 명단으로 모든 팀 구성을 통일합니다.\n\n" +
        "· 각 팀의 디자이너·공학생·지도교수·정원을 기준 명단으로 맞춥니다.\n" +
        "· 이름이 일치하는 계정의 소속 팀도 함께 갱신됩니다.\n" +
        "· 계정이 없거나 이름이 다른 인원은 동기화 후 목록으로 알려드립니다.\n\n진행할까요?"
    );
    if (!ok) return;
    const btns = Array.from(document.querySelectorAll('button[onclick="runSyncFromMaster()"]'));
    const origs = btns.map(b => b.textContent);
    btns.forEach(b => { b.disabled = true; b.textContent = "동기화 중…"; });
    try {
        const r = await syncFromMaster();
        if (typeof refreshPublicTeams === "function") await refreshPublicTeams();
        if (isCurrentPage("team-place-page")) await renderTeamPlace();
        else await renderUserAdmin();
        const extra = (r.unmatchedStudents.length || r.unmatchedProfs.length)
            ? `\n\n계정 없는 학생 ${r.unmatchedStudents.length}명 · 지도교수 ${r.unmatchedProfs.length}명 — 화면 상단 목록을 확인하세요.`
            : "\n\n모든 인원이 계정과 연결되었습니다. ✅";
        window.alert(`Excel 기준 동기화 완료.\n팀 ${r.teamsChanged}건 반영 · 계정 소속 팀 ${r.usersChanged}명 갱신.${extra}`);
    } catch (err) {
        btns.forEach((b, i) => { b.disabled = false; b.textContent = origs[i]; });
        window.alert((err.code === "permission-denied")
            ? "권한이 없습니다. 관리자(admin) 계정인지 확인하세요."
            : ("동기화에 실패했습니다: " + (err.code || err.message || err)));
    }
}
window.runSyncFromMaster = runSyncFromMaster;

// ------------------------------------------------------------
// 관리자: 사용자 관리 (User Management) — admin 전용
// ------------------------------------------------------------
//  가입한 사용자 목록을 보고 역할(role)·소속팀(teamId)·기본정보를 배정/수정.
//  · 팀 소속은 "관리자가 배정"하는 정책 → 디자이너의 teamId 는 여기서 지정.
//  · 역할도 변경 가능(교수·관리자 부여 포함). 보안규칙상 users update 는 admin 허용.
//  · 모든 데이터 접근은 REST 헬퍼. users 전체 쿼리는 admin 일 때만 규칙상 허용됨.
// ------------------------------------------------------------

let userAdminUsers = [];        // [{_docId=uid, email, name, role, teamId, advisingTeamIds, ...}]
let userAdminTeams = [];        // 팀 목록(드롭다운용)
let userAdminEditingId = null;  // null=폼 닫힘 / uid=편집 중
let userAdminError = "";
let userAdminFilter = "";       // 이름/이메일/역할 검색어
let userAdminFormRole = null;   // 편집 폼에서 현재 선택된 역할(역할에 따라 팀 입력 UI 전환)

async function renderUserAdmin() {
    const page = document.getElementById("user-admin-page");
    if (!page) return;

    // 권한 가드 ------------------------------------------------
    if (!currentUser || !currentProfile) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold mb-4">로그인이 필요합니다.</p>
                <button onclick="openAuth('login')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">로그인 / 가입</button>
                <div class="mt-4"><button onclick="navigateTo('landing')" class="text-sm text-neutral-500 hover:underline">메인으로</button></div>
            </div>`;
        return;
    }
    if (currentProfile.role !== "admin") {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold mb-2">관리자 전용 페이지입니다.</p>
                <p class="text-sm text-neutral-500 mb-6">사용자 관리는 관리자(admin) 계정만 사용할 수 있습니다.</p>
                <button onclick="navigateTo('dashboard')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">내 대시보드로</button>
            </div>`;
        return;
    }

    // Firestore 최신 목록 --------------------------------------
    page.innerHTML = `<div class="max-w-7xl mx-auto px-6 py-24 text-center text-neutral-400 font-bold">사용자 목록 불러오는 중…</div>`;
    try {
        userAdminUsers = await fsQuery("users");           // admin 만 전체 read 허용
        userAdminTeams = await fsQuery("teams", "id");     // 소속팀 드롭다운
    } catch (e) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold text-rose-600 mb-2">사용자 목록을 불러오지 못했습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">${escapeHtml(e.code || e.message || e)}</p>
                <button onclick="renderUserAdmin()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">다시 시도</button>
            </div>`;
        return;
    }
    drawUserAdmin();
}
window.renderUserAdmin = renderUserAdmin;

// '팀 배정 동기화' 버튼: teams.members(이름) → 학생 계정 teamId 일괄 반영
async function runTeamSync() {
    const btn = document.querySelector('#user-admin-page button[onclick="runTeamSync()"]');
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "동기화 중…"; }
    try {
        const n = await syncAllTeamIds();
        await renderUserAdmin(); // 최신 teamId 로 표 갱신
        window.alert(n > 0 ? `${n}명의 소속 팀을 동기화했습니다.` : "이미 모두 동기화되어 있습니다.");
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
        window.alert("동기화에 실패했습니다: " + (err.code || err.message || err));
    }
}
window.runTeamSync = runTeamSync;

function teamLabel(teamId) {
    if (!teamId) return `<span class="text-xs text-neutral-400">미배정</span>`;
    const t = userAdminTeams.find(x => (x._docId || x.id) === teamId || x.id === teamId);
    const name = t ? (t.name || t.id) : teamId;
    return `<span class="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">${escapeHtml(name)}</span>`;
}
// 팀 멤버 명단(이름)에서 사용자가 속한 팀 id 를 찾는다(아직 teamId 동기화 전 표시용).
function teamIdByMemberName(name) {
    const key = String(name == null ? "" : name).trim();
    if (!key) return null;
    const t = (userAdminTeams || []).find(x => (x.members || []).some(m => String(m).trim() === key));
    return t ? (t.id || t._docId) : null;
}
// 표의 '소속 팀' 칸: 교수는 지도 팀(여러 개), 그 외는 소속 팀(하나)
function teamCellHtml(u) {
    if (u.role === "professor") {
        const adv = u.advisingTeamIds || [];
        if (!adv.length) return `<span class="text-xs text-neutral-400">지도팀 없음</span>`;
        return `<div class="flex flex-wrap gap-1">${adv.map(teamLabel).join("")}</div>`;
    }
    if (u.teamId) return teamLabel(u.teamId);
    // teamId 는 비어 있지만 팀 명단에 이름이 있는 경우 → 동기화 필요 표시
    const derived = teamIdByMemberName(u.name);
    if (derived) {
        return `${teamLabel(derived)} <span class="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded ml-1">미동기화</span>`;
    }
    return teamLabel(null);
}

function drawUserAdmin() {
    const page = document.getElementById("user-admin-page");
    if (!page) return;

    const q = userAdminFilter.trim().toLowerCase();
    const list = userAdminUsers.filter(u => {
        if (!q) return true;
        return [u.name, u.email, ROLE_LABELS[u.role] || u.role, u.role]
            .some(v => String(v || "").toLowerCase().includes(q));
    }).sort((a, b) => String(a.name || a.email || "").localeCompare(String(b.name || b.email || "")));

    const rows = list.map(u => `
        <tr class="border-b border-neutral-100 hover:bg-neutral-50">
            <td class="px-4 py-3">
                <div class="font-bold">${escapeHtml(u.name || "(이름 없음)")}</div>
                <div class="text-xs text-neutral-400">${escapeHtml(u.email || "")}</div>
            </td>
            <td class="px-4 py-3"><span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-900 text-white">${escapeHtml(ROLE_LABELS[u.role] || u.role || "")}</span></td>
            <td class="px-4 py-3">${teamCellHtml(u)}</td>
            <td class="px-4 py-3 text-xs text-neutral-500">${escapeHtml([u.university, u.department, u.studentId].filter(Boolean).join(" · "))}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
                <button onclick="openUserForm('${escapeHtml(u._docId)}')" class="text-xs font-bold text-blue-600 hover:underline">역할·팀 배정</button>
            </td>
        </tr>`).join("");

    const emptyRow = `<tr><td colspan="5" class="px-4 py-10 text-center text-neutral-400 font-bold">${userAdminUsers.length ? "검색 결과가 없습니다." : "가입한 사용자가 없습니다."}</td></tr>`;

    page.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <button onclick="navigateTo('dashboard')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 대시보드</button>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-2.5 py-1 rounded-full">관리자</span>
                        <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">User Management</span>
                    </div>
                    <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight">사용자 관리</h1>
                    <p class="text-sm mt-2 opacity-70">가입자의 역할과 소속 팀을 배정합니다. (총 ${userAdminUsers.length}명)</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <button onclick="runSyncFromMaster()" title="Excel 팀배분 기준 명단으로 모든 팀 구성·정원·계정 소속을 통일합니다."
                        class="whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all">⤓ Excel 기준 일괄 동기화</button>
                    <button onclick="runTeamSync()" title="팀 관리에서 배정한 팀원(이름)을 학생 계정의 소속 팀에 일괄 반영합니다."
                        class="whitespace-nowrap bg-neutral-900 hover:bg-neutral-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all">↻ 팀 배정 동기화</button>
                    <input type="text" value="${escapeHtml(userAdminFilter)}" oninput="onUserFilter(this.value)" placeholder="이름·이메일·역할 검색"
                        class="w-full md:w-64 border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                </div>
            </header>

            ${masterSyncReportHtml()}

            ${userAdminEditingId !== null ? userFormHtml() : ""}

            <div class="bg-white border border-neutral-200 rounded-2xl overflow-x-auto">
                <table class="w-full text-sm text-left min-w-[720px]">
                    <thead class="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500 font-bold">
                        <tr>
                            <th class="px-4 py-3">사용자</th>
                            <th class="px-4 py-3">역할</th>
                            <th class="px-4 py-3">소속 팀</th>
                            <th class="px-4 py-3">소속·학번</th>
                            <th class="px-4 py-3 text-right">관리</th>
                        </tr>
                    </thead>
                    <tbody>${list.length ? rows : emptyRow}</tbody>
                </table>
            </div>
        </div>`;

    const form = document.getElementById("user-form");
    if (form) form.addEventListener("submit", saveUserAdmin);
}

function onUserFilter(v) {
    userAdminFilter = v;
    // 편집 폼이 열려있지 않을 때만 재그리기(입력 포커스 유지)
    if (userAdminEditingId === null) {
        // 표 본문만 갱신하면 더 좋지만, 간단히 전체 재그리기 후 검색창 포커스 복원
        const active = document.activeElement === document.querySelector('#user-admin-page input[type=text]');
        drawUserAdmin();
        if (active) {
            const input = document.querySelector('#user-admin-page input[type=text]');
            if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
        }
    }
}
window.onUserFilter = onUserFilter;

function userFormHtml() {
    const u = userAdminUsers.find(x => x._docId === userAdminEditingId) || {};
    const effRole = userAdminFormRole || u.role || "designer";  // 역할 select 의 현재 선택값
    const roleOpts = Object.keys(ROLE_LABELS)
        .map(r => `<option value="${r}" ${effRole === r ? "selected" : ""}>${escapeHtml(ROLE_LABELS[r])}</option>`).join("");

    // 교수: 지도 팀(여러 개 선택) / 그 외: 소속 팀(하나)
    let teamControl;
    if (effRole === "professor") {
        const adv = u.advisingTeamIds || [];
        const boxes = userAdminTeams.length ? userAdminTeams.map(t => {
            const id = t._docId || t.id;
            return `<label class="flex items-center gap-2 text-sm border border-neutral-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-neutral-50">
                <input type="checkbox" name="advTeam" value="${escapeHtml(id)}" ${adv.includes(id) ? "checked" : ""} class="accent-blue-600">
                ${escapeHtml((t.name || id) + " (" + id + ")")}</label>`;
        }).join("") : `<p class="text-xs text-neutral-400">등록된 팀이 없습니다.</p>`;
        teamControl = `
            <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-neutral-500 mb-1">지도 팀 (여러 개 선택 가능)</label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${boxes}</div>
                <p class="text-[10px] text-neutral-400 mt-1">교수는 지도 팀을 여러 개 가질 수 있습니다. (피드백은 모든 작품에 작성 가능)</p>
            </div>`;
    } else {
        const teamOpts = `<option value="" ${!u.teamId ? "selected" : ""}>(미배정)</option>` +
            userAdminTeams.map(t => {
                const id = t._docId || t.id;
                return `<option value="${escapeHtml(id)}" ${u.teamId === id ? "selected" : ""}>${escapeHtml((t.name || id) + " (" + id + ")")}</option>`;
            }).join("");
        teamControl = `
            <div>
                <label class="block text-xs font-bold text-neutral-500 mb-1">소속 팀</label>
                <select name="teamId" class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">${teamOpts}</select>
                <p class="text-[10px] text-neutral-400 mt-1">디자이너는 소속 팀이 있어야 작품을 올릴 수 있습니다.</p>
            </div>`;
    }

    return `
        <div class="bg-white border-2 border-blue-600 rounded-2xl p-6 mb-6 shadow-sm">
            <h3 class="font-extrabold text-lg mb-1">역할·소속 배정 — ${escapeHtml(u.name || u.email || "")}</h3>
            <p class="text-xs text-neutral-500 mb-4">${escapeHtml(u.email || "")} · 이메일은 변경할 수 없습니다. (역할을 바꾸면 팀 입력 방식이 바뀝니다)</p>
            <form id="user-form" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">역할 *</label>
                        <select name="role" onchange="onUserRoleChange(this.value)" class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">${roleOpts}</select>
                    </div>
                    ${teamControl}
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">이름</label>
                        <input name="name" type="text" value="${escapeHtml(u.name || "")}" class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">학번</label>
                        <input name="studentId" type="text" value="${escapeHtml(u.studentId || "")}" class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">소속 대학</label>
                        <input name="university" type="text" value="${escapeHtml(u.university || "")}" class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-neutral-500 mb-1">학과</label>
                        <input name="department" type="text" value="${escapeHtml(u.department || "")}" class="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    </div>
                </div>
                ${userAdminError ? `<p class="text-sm text-rose-600 font-semibold">${escapeHtml(userAdminError)}</p>` : ""}
                <div class="flex gap-3 pt-1">
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all">저장하기</button>
                    <button type="button" onclick="closeUserForm()" class="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold px-6 py-2.5 rounded-xl transition-all">취소</button>
                </div>
            </form>
        </div>`;
}

// 역할 select 변경 시 팀 입력 UI(단일/다중)를 전환 — 폼만 다시 그린다.
function onUserRoleChange(role) {
    userAdminFormRole = role;
    drawUserAdmin();
    const form = document.getElementById("user-form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
}
window.onUserRoleChange = onUserRoleChange;

function openUserForm(uid) {
    userAdminEditingId = uid;
    userAdminError = "";
    const u = userAdminUsers.find(x => x._docId === uid) || {};
    userAdminFormRole = u.role || "designer";
    drawUserAdmin();
    const form = document.getElementById("user-form");
    if (form) form.scrollIntoView({ behavior: "smooth", block: "center" });
}
window.openUserForm = openUserForm;

function closeUserForm() {
    userAdminEditingId = null;
    userAdminFormRole = null;
    userAdminError = "";
    drawUserAdmin();
}
window.closeUserForm = closeUserForm;

async function saveUserAdmin(e) {
    e.preventDefault();
    const el = e.target.elements;
    const uid = userAdminEditingId;
    const prevUser = userAdminUsers.find(x => x._docId === uid) || {};
    const role = el.role.value;
    // 교수: 지도 팀(여러 개) → advisingTeamIds, 소속 팀(teamId)은 비움.
    // 그 외: 소속 팀(teamId) 하나, 지도 팀은 비움.
    let teamId = null, advisingTeamIds = [];
    if (role === "professor") {
        advisingTeamIds = Array.from(e.target.querySelectorAll('input[name="advTeam"]:checked')).map(c => c.value);
    } else {
        teamId = (el.teamId && el.teamId.value) ? el.teamId.value : null;
    }
    const data = {
        role,
        teamId,
        advisingTeamIds,
        name: el.name.value.trim(),
        studentId: el.studentId.value.trim(),
        university: el.university.value.trim(),
        department: el.department.value.trim(),
    };

    userAdminError = "";
    if (!ROLE_LABELS[role]) { userAdminError = "역할을 선택하세요."; drawUserAdmin(); return; }
    // 본인 계정을 admin 에서 강등하면 관리 권한을 잃으므로 확인
    if (uid === currentUser.uid && role !== "admin") {
        if (!window.confirm("본인 계정의 역할을 관리자(admin)에서 변경하면 더 이상 관리 화면에 접근할 수 없습니다. 계속할까요?")) {
            return;
        }
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "저장 중…"; }
    try {
        await fsUpdate(`users/${uid}`, data);
        // 학생의 소속 팀(또는 이름)이 바뀌면 팀 명단(members)도 함께 맞춰 둔다.
        if (role !== "professor") {
            try { await syncUserNameIntoTeams(prevUser.name, data.name, prevUser.teamId || null, teamId); }
            catch (_) { /* 명단 반영 실패는 사용자 저장을 막지 않음 */ }
        }
        // 공학생은 소속의 진실 소스가 지원(applications) 문서이므로, 팀 변경 시 함께 갱신.
        //  (이걸 안 하면 동기화가 돌 때 지원 문서의 옛 팀으로 teamId 가 되돌아간다 → "변경 안 됨")
        if (role === "engineer") {
            try {
                if (teamId) {
                    await fsSet(`applications/${uid}`, {
                        id: uid, engineerId: uid, engineerName: data.name || "",
                        university: data.university || "", department: data.department || "",
                        studentId: data.studentId || "", assignedTeamId: teamId, status: "assigned",
                        preferences: [{ rank: 1, teamId }], createdAt: new Date(), updatedAt: new Date(),
                    });
                } else {
                    try { await fsDelete(`applications/${uid}`); } catch (_) {} // 미배정 → 지원 삭제
                }
            } catch (_) { /* 지원 반영 실패는 사용자 저장을 막지 않음 */ }
        }
        // 교수 지도팀(또는 교수 관련 변경) 반영 → 팀 문서의 공개용 교수 명단 갱신
        try { await rebuildTeamProfessors(); } catch (_) {}
        // 본인 프로필을 수정했으면 화면 상태에도 반영
        if (uid === currentUser.uid) {
            currentProfile = Object.assign({}, currentProfile, data);
            renderAuthBar();
        }
        userAdminEditingId = null;
        userAdminFormRole = null;
        await renderUserAdmin();
    } catch (err) {
        userAdminError = (err.code === "permission-denied")
            ? "수정 권한이 없습니다. 관리자(admin) 계정인지 확인하세요."
            : (err.code || err.message || "저장에 실패했습니다.");
        drawUserAdmin();
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}
window.saveUserAdmin = saveUserAdmin;

// ============================================================
//  관리자: 팀 배치 관리 (Team Placement) — admin 전용
// ------------------------------------------------------------
//  한 화면에서 팀별 구성(디자이너·지원 공학생·지도 교수)을 보고,
//  아직 팀이 없는 학생을 바로 배정한다.
//   · 디자이너 배정 → teams.members 에 이름 추가 + users.teamId 설정
//   · 공학생 배정   → applications 문서 생성/갱신(assignedTeamId) + users.teamId 설정
//     (공학생의 소속은 applications 가 진실 소스이므로 동기화 시에도 보존됨)
// ============================================================

let teamPlaceTeams = [];
let teamPlaceUsers = [];
let teamPlaceApps = [];

// 학생의 실제 소속 팀 판정: teamId > 지원(applications) > 팀 명단(이름)
function tpEffectiveTeam(u) {
    return effStudentTeam(u, teamPlaceTeams, teamPlaceApps);
}

// 학생(디자이너·공학생)의 소속 팀 판정 — '사용자 관리'와 동일 기준.
//  teamId > 지원(applications) 배정 > 팀 명단(이름) 순.
function effStudentTeam(u, teams, apps) {
    if (u.teamId) return u.teamId;
    const app = (apps || []).find(a => a.engineerId === u._docId && a.status === "assigned" && a.assignedTeamId);
    if (app) return app.assignedTeamId;
    const nm = String(u.name == null ? "" : u.name).trim();
    if (nm && teams) {
        const t = teams.find(x => {
            const names = (typeof teamRoster === "function") ? teamRoster(x) : (x.members || []).concat(x.engineers || []);
            return names.some(m => String(m).trim() === nm);
        });
        if (t) return t.id || t._docId;
    }
    return null;
}

// 팀별 구성(디자이너·공학생·지도교수)을 '사용자 관리'와 동일하게 계정(users) 기준으로 산출.
//  · 디자이너/공학생 = 역할 + 소속 팀(effStudentTeam) 일치 계정
//  · 지도교수        = 역할 professor + advisingTeamIds 에 팀 포함
function pickTeamMembers(tid, users, apps, teams) {
    const nm = u => (String(u.name == null ? "" : u.name).trim() || u.email || "(이름 없음)");
    return {
        designers: (users || []).filter(u => u.role === "designer" && effStudentTeam(u, teams, apps) === tid).map(nm),
        engineers: (users || []).filter(u => u.role === "engineer" && effStudentTeam(u, teams, apps) === tid).map(nm),
        profs:     (users || []).filter(u => u.role === "professor" && (u.advisingTeamIds || []).includes(tid)).map(nm),
    };
}

// ------------------------------------------------------------
// 팀 구성 표시 — 모든 팀 화면(배치 관리/현황/결과 발표 보드·상세)이 공유하는 단일 함수
// ------------------------------------------------------------
//  관리자(ctx.users 가 배열)면 '사용자 관리'와 동일한 계정 기준(pickTeamMembers),
//  그 외(비관리자·공개)면 teams 문서(동기화된 명단) 기준으로 {designers,engineers,profs} 반환.
//  → 결과 발표 보드를 팀 배치 현황·관리와 항상 일치시키기 위함.
let teamRosterCtx = { users: null, apps: [] };

async function loadTeamRosterCtx() {
    let apps = [];
    if (currentUser) { try { apps = await fsQuery("applications"); } catch (_) { apps = []; } }
    let users = null;
    if (currentProfile && currentProfile.role === "admin") {
        try { users = await fsQuery("users"); } catch (_) { users = null; }
    }
    teamRosterCtx = { users, apps };
    return teamRosterCtx;
}
window.loadTeamRosterCtx = loadTeamRosterCtx;

function teamRosterForDisplay(t, ctx, teamsList) {
    const tid = t.id || t._docId;
    const users = ctx && ctx.users;
    const apps = (ctx && ctx.apps) || [];
    if (Array.isArray(users)) {
        // 관리자: 계정(users) 기준 — 사용자 관리와 동일
        return pickTeamMembers(tid, users, apps, teamsList || null);
    }
    // 비관리자·공개: teams 문서 기준(동기화된 명단) + 지원배정 보강
    const designers = (typeof teamDesigners === "function") ? teamDesigners(t) : (t.members || []);
    const appEng = apps
        .filter(a => a.status === "assigned" && a.assignedTeamId === tid)
        .map(a => a.engineerName || "(이름 없음)");
    const engineers = Array.from(new Set(
        ((typeof teamEngineers === "function") ? teamEngineers(t) : (t.engineers || [])).concat(appEng)
    ));
    const profs = (typeof teamProfessorNames === "function") ? teamProfessorNames(t) : (t.advisingProfessors || []);
    return { designers, engineers, profs };
}
window.teamRosterForDisplay = teamRosterForDisplay;

async function renderTeamPlace() {
    const page = document.getElementById("team-place-page");
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
    if (currentProfile.role !== "admin") {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold mb-2">관리자 전용 페이지입니다.</p>
                <p class="text-sm text-neutral-500 mb-6">팀 배치 관리는 관리자(admin) 계정만 사용할 수 있습니다.</p>
                <button onclick="navigateTo('dashboard')" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">내 대시보드로</button>
            </div>`;
        return;
    }

    page.innerHTML = `<div class="max-w-7xl mx-auto px-6 py-24 text-center text-neutral-400 font-bold">팀 배치 정보 불러오는 중…</div>`;
    try {
        if (typeof loadAppSettings === "function") { try { await loadAppSettings(); } catch (_) {} } // professorsPublic 최신화
        teamPlaceTeams = await fsQuery("teams", "id");
        teamPlaceUsers = await fsQuery("users");
        teamPlaceApps = await fsQuery("applications").catch(() => []);
        // 공개 '팀 배치 현황' 보드용 교수 명단을 팀 문서에 최신화(공개 설정 반영)
        try { await rebuildTeamProfessors(teamPlaceTeams, teamPlaceUsers); } catch (_) {}
    } catch (e) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold text-rose-600 mb-2">불러오지 못했습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">${escapeHtml(e.code || e.message || e)}</p>
                <button onclick="renderTeamPlace()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">다시 시도</button>
            </div>`;
        return;
    }
    drawTeamPlace();
}
window.renderTeamPlace = renderTeamPlace;

function drawTeamPlace() {
    const page = document.getElementById("team-place-page");
    if (!page) return;

    const cap = (t) => (typeof teamCapacity === "function") ? teamCapacity(t) : (t.capacity || 3);
    const chip = (text, cls) => `<span class="text-xs font-bold px-2.5 py-1 rounded-lg ${cls}">${escapeHtml(text)}</span>`;
    const profPub = (typeof professorsPublic !== "undefined") ? professorsPublic : false;

    // 팀별 카드 ------------------------------------------------
    const teamCards = teamPlaceTeams.map(t => {
        const tid = t.id || t._docId;
        // '사용자 관리'와 동일하게 계정(users) 기준으로 팀 구성 산출
        const rm = pickTeamMembers(tid, teamPlaceUsers, teamPlaceApps, teamPlaceTeams);
        const designers = rm.designers;
        const engineers = rm.engineers;
        const profs = rm.profs;
        const capN = cap(t);
        const engFull = engineers.length >= capN;

        const section = (title, items, emptyText, cls) => `
            <div>
                <p class="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-1.5">${title}</p>
                <div class="flex flex-wrap gap-1.5">
                    ${items.length ? items.map(x => chip(x, cls)).join("") : `<span class="text-xs text-neutral-400">${escapeHtml(emptyText)}</span>`}
                </div>
            </div>`;

        return `
            <div class="border border-neutral-200 bg-white rounded-2xl overflow-hidden">
                <div class="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
                    <div class="min-w-0">
                        <span class="font-black font-eng text-lg">${escapeHtml((t.code || tid).toUpperCase())}</span>
                        <span class="text-sm font-bold ml-2">${escapeHtml(t.name || tid)}</span>
                    </div>
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${engFull ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}">공학생 ${engineers.length}/${capN}</span>
                </div>
                <div class="p-5 space-y-3">
                    ${section("디자이너", designers, "없음", "bg-blue-50 text-blue-700")}
                    ${section("공학생 (지원 배정)", engineers, "지원자 없음", "bg-emerald-50 text-emerald-700")}
                    ${section("지도 교수", profs, "미배정", "bg-violet-50 text-violet-700")}
                </div>
            </div>`;
    }).join("");

    // 미배정 학생 ----------------------------------------------
    const unassigned = teamPlaceUsers
        .filter(u => (u.role === "designer" || u.role === "engineer") && !tpEffectiveTeam(u))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    const teamOpts = teamPlaceTeams.map(t => {
        const id = t.id || t._docId;
        return `<option value="${escapeHtml(id)}">${escapeHtml((t.name || id) + " (" + id + ")")}</option>`;
    }).join("");

    const unassignedRows = unassigned.length ? unassigned.map(u => `
        <tr class="border-b border-neutral-100 hover:bg-neutral-50">
            <td class="px-4 py-3">
                <div class="font-bold">${escapeHtml(u.name || "(이름 없음)")}</div>
                <div class="text-xs text-neutral-400">${escapeHtml(u.email || "")}</div>
            </td>
            <td class="px-4 py-3"><span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${u.role === "designer" ? "bg-blue-600" : "bg-emerald-600"} text-white">${escapeHtml(ROLE_LABELS[u.role] || u.role)}</span></td>
            <td class="px-4 py-3 text-xs text-neutral-500">${escapeHtml([u.university, u.department, u.studentId].filter(Boolean).join(" · "))}</td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
                <div class="inline-flex items-center gap-2">
                    <select id="place-team-${escapeHtml(u._docId)}" class="border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">
                        <option value="">팀 선택…</option>${teamOpts}
                    </select>
                    <button onclick="placeStudent('${escapeHtml(u._docId)}')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">배정</button>
                </div>
            </td>
        </tr>`).join("") : `<tr><td colspan="4" class="px-4 py-10 text-center text-neutral-400 font-bold">미배정 학생이 없습니다. 모두 팀에 배정되었습니다. 🎉</td></tr>`;

    page.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <button onclick="navigateTo('dashboard')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 대시보드</button>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-2.5 py-1 rounded-full">관리자</span>
                        <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">Team Placement</span>
                    </div>
                    <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight">팀 배치 관리</h1>
                    <p class="text-sm mt-2 opacity-70">팀별 구성(디자이너·지원 공학생·지도 교수)을 한눈에 보고, 미배정 학생을 바로 배정합니다.</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <button onclick="runSyncFromMaster()" title="Excel 팀배분 기준 명단으로 모든 팀 구성·정원·계정 소속을 통일합니다."
                        class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap">⤓ Excel 기준 일괄 동기화</button>
                    <button onclick="renderTeamPlace()" title="최신 정보로 새로고침" class="bg-neutral-900 hover:bg-neutral-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all whitespace-nowrap">↻ 새로고침</button>
                </div>
            </header>

            ${masterSyncReportHtml()}

            <div class="rounded-2xl border-2 ${profPub ? "border-violet-500 bg-violet-50" : "border-neutral-300 bg-white"} p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <p class="font-extrabold">${profPub ? "지도교수 명단 공개됨 ✅" : "지도교수 명단 비공개 (관리자만)"}</p>
                    <p class="text-xs text-neutral-500 mt-1">공개하면 ‘팀 배치 현황’ 보드와 ‘차수별 진행 결과 발표’ 팀 화면에 지도교수가 표시됩니다. 비공개 시에는 표시되지 않습니다.</p>
                </div>
                <button onclick="toggleProfessorsPublic()" class="${profPub ? "bg-neutral-100 hover:bg-neutral-200 text-neutral-700" : "bg-violet-600 hover:bg-violet-700 text-white"} font-bold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap">${profPub ? "비공개로 전환" : "지도교수 공개"}</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">${teamCards || '<p class="text-neutral-500">등록된 팀이 없습니다.</p>'}</div>

            <div class="bg-white border-2 border-blue-600 rounded-2xl p-5 mb-10">
                <p class="font-extrabold mb-1">계정 없는 학생 직접 추가</p>
                <p class="text-xs text-neutral-500 mb-3">포털 계정이 없는 참가자를 이름으로 팀 명단에 추가합니다. (디자이너 명단에 표시됩니다)</p>
                <div class="flex flex-col sm:flex-row gap-2">
                    <input id="place-add-name" type="text" placeholder="학생 이름" class="flex-1 border border-neutral-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600">
                    <select id="place-add-team" class="border border-neutral-300 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600">
                        <option value="">팀 선택…</option>${teamOpts}
                    </select>
                    <button onclick="addNameToTeam()" class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all whitespace-nowrap">+ 추가</button>
                </div>
            </div>

            <h2 class="text-lg font-extrabold mb-1">미배정 학생 <span class="font-eng opacity-50">(${unassigned.length})</span></h2>
            <p class="text-xs text-neutral-500 mb-4">아직 팀이 없는 디자이너·공학생입니다. 팀을 선택해 ‘배정’을 누르면 즉시 반영됩니다. (배정 변경·해제는 ‘사용자 관리’에서)</p>
            <div class="bg-white border border-neutral-200 rounded-2xl overflow-x-auto">
                <table class="w-full text-sm text-left min-w-[640px]">
                    <thead class="bg-neutral-50 border-b border-neutral-200 text-[11px] uppercase tracking-wider text-neutral-500 font-bold">
                        <tr>
                            <th class="px-4 py-3">학생</th>
                            <th class="px-4 py-3">역할</th>
                            <th class="px-4 py-3">소속·학번</th>
                            <th class="px-4 py-3 text-right">팀 배정</th>
                        </tr>
                    </thead>
                    <tbody>${unassignedRows}</tbody>
                </table>
            </div>
        </div>`;
}
window.drawTeamPlace = drawTeamPlace;

async function placeStudent(uid) {
    const sel = document.getElementById("place-team-" + uid);
    const teamId = sel ? sel.value : "";
    if (!teamId) { window.alert("배정할 팀을 선택하세요."); return; }
    const u = teamPlaceUsers.find(x => x._docId === uid);
    if (!u) return;
    const btn = sel && sel.parentNode ? sel.parentNode.querySelector("button") : null;
    const orig = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "배정 중…"; }
    try {
        if (u.role === "engineer") {
            // 공학생: 지원(applications) 문서 생성/갱신 — 동기화 시에도 소속 보존
            await fsSet(`applications/${uid}`, {
                id: uid, engineerId: uid, engineerName: u.name || "",
                university: u.university || "", department: u.department || "",
                studentId: u.studentId || "", assignedTeamId: teamId, status: "assigned",
                preferences: [{ rank: 1, teamId }], createdAt: new Date(), updatedAt: new Date(),
            });
        } else {
            // 디자이너: 팀 명단(members)에 이름 추가
            const t = teamPlaceTeams.find(x => (x.id || x._docId) === teamId);
            const nm = String(u.name == null ? "" : u.name).trim();
            if (t && nm && !(t.members || []).map(m => String(m).trim()).includes(nm)) {
                const members = (t.members || []).slice();
                members.push(nm);
                await fsUpdate(`teams/${teamId}`, { members });
            }
        }
        await fsUpdate(`users/${uid}`, { teamId });
        if (uid === currentUser.uid) { currentProfile = Object.assign({}, currentProfile, { teamId }); renderAuthBar(); }
        await renderTeamPlace();
    } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
        window.alert((err.code === "permission-denied")
            ? "권한이 없습니다. (관리자 전용)"
            : (err.code || err.message || "배정에 실패했습니다."));
    }
}
window.placeStudent = placeStudent;

// 계정 없는 학생 이름을 팀 명단(members)에 직접 추가
async function addNameToTeam() {
    const nameEl = document.getElementById("place-add-name");
    const teamEl = document.getElementById("place-add-team");
    const name = nameEl ? nameEl.value.trim() : "";
    const teamId = teamEl ? teamEl.value : "";
    if (!name) { window.alert("이름을 입력하세요."); return; }
    if (!teamId) { window.alert("팀을 선택하세요."); return; }
    const t = teamPlaceTeams.find(x => (x.id || x._docId) === teamId);
    if (!t) return;
    const cur = (t.members || []).map(m => String(m).trim());
    if (cur.includes(name)) { window.alert("이미 그 팀 명단에 있는 이름입니다."); return; }
    try {
        const members = (t.members || []).slice();
        members.push(name);
        await fsUpdate(`teams/${teamId}`, { members });
        // 같은 이름의 미배정 계정이 있으면 소속 팀도 함께 맞춰 둔다(있을 때만).
        const u = teamPlaceUsers.find(x => String(x.name || "").trim() === name && !x.teamId);
        if (u) { try { await fsUpdate(`users/${u._docId}`, { teamId }); } catch (_) {} }
        await renderTeamPlace();
    } catch (err) {
        window.alert((err.code === "permission-denied")
            ? "권한이 없습니다. (관리자 전용)"
            : (err.code || err.message || "추가에 실패했습니다."));
    }
}
window.addNameToTeam = addNameToTeam;

// ============================================================
//  공개: 팀 배치 현황 (Team Status) — 모든 사용자 열람(읽기 전용)
// ------------------------------------------------------------
//  · teams(공개 읽기)에서 디자이너 명단과 지도 교수(비정규화된 advisingProfessors)를,
//    로그인 사용자는 applications 에서 팀별 공학생까지 확인할 수 있다.
//  · 쓰기 기능 없음(관리는 관리자의 '팀 배치 관리'에서).
// ============================================================
async function renderTeamStatus() {
    const page = document.getElementById("team-status-page");
    if (!page) return;
    page.innerHTML = `<div class="max-w-7xl mx-auto px-6 py-24 text-center text-neutral-400 font-bold">팀 배치 현황 불러오는 중…</div>`;
    let teams = [], apps = [];
    try {
        teams = await fsQuery("teams", "id");
    } catch (e) {
        page.innerHTML = `
            <div class="max-w-md mx-auto px-6 py-20 text-center">
                <p class="text-lg font-bold text-rose-600 mb-2">불러오지 못했습니다.</p>
                <p class="text-sm text-neutral-500 mb-6">${escapeHtml(e.code || e.message || e)}</p>
                <button onclick="renderTeamStatus()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl">다시 시도</button>
            </div>`;
        return;
    }
    // 공학생 배정은 로그인 사용자만 읽을 수 있음(applications 규칙)
    if (currentUser) { try { apps = await fsQuery("applications"); } catch (_) { apps = []; } }
    if (typeof loadAppSettings === "function") { try { await loadAppSettings(); } catch (_) {} } // professorsPublic
    // 관리자는 '사용자 관리'와 동일한 계정 기준으로 표시하기 위해 users 를 읽는다(규칙상 admin 만 전체 read).
    let users = null;
    if (currentProfile && currentProfile.role === "admin") {
        try { users = await fsQuery("users"); } catch (_) { users = null; }
    }
    drawTeamStatus(teams, apps, users);
}
window.renderTeamStatus = renderTeamStatus;

function drawTeamStatus(teams, apps, users) {
    const page = document.getElementById("team-status-page");
    if (!page) return;
    const loggedIn = !!currentUser;
    const isAdminView = Array.isArray(users); // 관리자: 계정(users) 기준 표시
    const profPub = (typeof professorsPublic !== "undefined") ? professorsPublic : false;
    const chip = (text, cls) => `<span class="text-xs font-bold px-2.5 py-1 rounded-lg ${cls}">${escapeHtml(text)}</span>`;

    const cards = teams.map(t => {
        const tid = t.id || t._docId;
        let designers, engineers, profs;
        if (isAdminView) {
            // '사용자 관리'와 동일하게 계정 기준으로 산출
            const rm = pickTeamMembers(tid, users, apps, teams);
            designers = rm.designers; engineers = rm.engineers; profs = rm.profs;
        } else {
            designers = (typeof teamDesigners === "function") ? teamDesigners(t) : (t.members || []);
            const appEng = (apps || [])
                .filter(a => a.status === "assigned" && a.assignedTeamId === tid)
                .map(a => a.engineerName || "(이름 없음)");
            engineers = Array.from(new Set(
                ((typeof teamEngineers === "function") ? teamEngineers(t) : (t.engineers || [])).concat(appEng)
            ));
            profs = (typeof teamProfessorNames === "function") ? teamProfessorNames(t) : (t.advisingProfessors || []);
        }

        const section = (title, items, emptyText, cls) => `
            <div>
                <p class="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-1.5">${title}</p>
                <div class="flex flex-wrap gap-1.5">
                    ${items.length ? items.map(x => chip(x, cls)).join("") : `<span class="text-xs text-neutral-400">${escapeHtml(emptyText)}</span>`}
                </div>
            </div>`;

        // 관리자는 항상(로그인·공개 여부 무관) 계정 기준 전체 표시 — 사용자 관리와 동일
        const engineerSection = (loggedIn || isAdminView)
            ? section("공학생", engineers, isAdminView ? "없음" : "지원자 없음", "bg-emerald-50 text-emerald-700")
            : `<div><p class="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-1.5">공학생</p>
                 <span class="text-xs text-neutral-400">로그인 시 표시됩니다.</span></div>`;

        const profSection = (profPub || isAdminView)
            ? section("지도 교수", profs, "미배정", "bg-violet-50 text-violet-700")
            : `<div><p class="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-1.5">지도 교수</p>
                 <span class="text-xs text-neutral-400">아직 공개되지 않았습니다.</span></div>`;

        return `
            <div class="border border-neutral-200 bg-white rounded-2xl overflow-hidden">
                <div class="px-5 py-3.5 border-b border-neutral-200 bg-neutral-50">
                    <span class="font-black font-eng text-lg">${escapeHtml((t.code || tid).toUpperCase())}</span>
                    <span class="text-sm font-bold ml-2">${escapeHtml(t.name || tid)}</span>
                </div>
                <div class="p-5 space-y-3">
                    ${section("디자이너", designers, "없음", "bg-blue-50 text-blue-700")}
                    ${engineerSection}
                    ${profSection}
                </div>
            </div>`;
    }).join("");

    page.innerHTML = `
        <div class="max-w-7xl mx-auto px-6 py-12 lg:py-20">
            <header class="border-b-2 border-current pb-8 mb-8">
                <button onclick="navigateTo('landing')" class="mb-3 text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black inline-flex items-center gap-1.5 transition-all">← 메인으로</button>
                <span class="text-xs font-bold opacity-50 uppercase tracking-widest font-eng">Team Status</span>
                <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight mt-1">팀 배치 현황</h1>
                <p class="text-sm mt-2 opacity-70">팀별 디자이너·공학생·지도 교수 구성입니다.${loggedIn ? "" : " (공학생 명단은 로그인 후 확인할 수 있습니다.)"}</p>
            </header>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">${cards || '<p class="text-neutral-500">등록된 팀이 없습니다.</p>'}</div>
        </div>`;
}
window.drawTeamStatus = drawTeamStatus;

// initAuth 는 main.js 의 window.onload 에서 호출됩니다.
