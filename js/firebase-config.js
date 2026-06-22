// ============================================================
//  Firebase 초기화 (Compat SDK)
// ------------------------------------------------------------
//  ⚠️ 아래 firebaseConfig 의 "PASTE_..." 값을 Firebase Console
//     에서 복사한 본인 프로젝트 값으로 교체하세요.
//     (프로젝트 설정 ⚙️ > 일반 > 내 앱 > 웹앱 </> 에서 복사)
//
//  ※ 이 값들은 공개 식별자라 클라이언트에 노출돼도 됩니다(비밀번호 아님).
//     실제 보안은 Firestore 보안 규칙(SYSTEM_DESIGN.md 9장)으로 합니다.
//
//  이 파일은 firebase-app-compat / firebase-firestore-compat 스크립트
//  이후, teams-data.js / main.js 보다 먼저 로드되어야 합니다.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCg67Kq0v2ygk1RiQ7FivQNeGEwowz61tE",
  authDomain: "amcdw-9d10e.firebaseapp.com",
  projectId: "amcdw-9d10e",
  storageBucket: "amcdw-9d10e.firebasestorage.app",
  messagingSenderId: "606127483694",
  appId: "1:606127483694:web:dc78c881e12b81d172a8bf",
  measurementId: "G-ZBM58D1NYQ"
};

// 설정값이 아직 교체되지 않았으면(placeholder 그대로면) Firebase를 켜지 않고
// 로컬 teams-data.js 로 폴백합니다. → 설정 전에도 사이트가 깨지지 않음.
const FIREBASE_READY = !firebaseConfig.projectId.startsWith("PASTE_");

// ⚠️ 이 프로젝트의 Firestore 는 표준 "(default)" 가 아니라
//    named 데이터베이스 "database1" (Enterprise 에디션) 입니다.
//    compat SDK 는 multi-instance 를 지원하므로 app.firestore(ID) 로 지정합니다.
//    (CLI 규칙 배포도 firebase.json 의 firestore.database 를 database1 로 맞춰야 함)
const FIRESTORE_DB_ID = "database1";

let db = null;
let auth = null;
let storage = null;
if (FIREBASE_READY) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.app().firestore(FIRESTORE_DB_ID);
  // Authentication (이메일/비밀번호 + Google + Microsoft). auth.js 에서 사용.
  auth = firebase.auth();
  // Storage (작품 첨부파일 업로드/다운로드). works.js 에서 사용.
  //  ⚠️ Storage 는 Firestore Enterprise 실시간 채널과 무관한 일반 HTTPS 라
  //     이 네트워크에서도 지연 없음 → SDK 그대로 사용. (firebase-storage-compat 로드 필요)
  if (typeof firebase.storage === "function") storage = firebase.storage();

  // ⚠️ Firestore 연결 방식.
  //  과거엔 스트리밍이 멈추는 문제로 long-polling 을 "강제"했으나,
  //  강제 long-polling 이 이 네트워크에서 단순 read 에 40초+ 걸리는 문제가 발생.
  //  → auto-detect 로 변경: SDK 가 스트리밍을 먼저 시도하고, 막히면 자동으로
  //    long-polling 으로 폴백한다(가장 빠른 연결 자동 선택).
  //  (settings 는 첫 읽기/쓰기 이전에 1회만 호출 가능. merge 와 함께 쓰지 말 것)
  db.settings({ experimentalAutoDetectLongPolling: true });

  console.log("[Firebase] 초기화 완료 — Firestore 연결됨 (auto-detect)");
} else {
  console.warn("[Firebase] firebaseConfig 미설정 → 로컬 teams-data.js 사용(폴백). " +
               "Console 설정값을 firebase-config.js 에 붙여넣으세요.");
}

// ============================================================
//  Firestore REST 헬퍼
// ------------------------------------------------------------
//  ⚠️ 이 프로젝트 DB 는 Enterprise 에디션(database1)이라, 이 네트워크에서
//     웹 SDK 실시간 채널(WebChannel/long-polling)이 단순 read/write 에도
//     수십 초(~30s) 걸리는 문제가 있음. 그래서 데이터 접근은 SDK 대신
//     Firestore REST API(평범한 HTTPS, ~0.3s)로 한다. (인증/세션만 SDK 사용)
//  · 공개 읽기(teams)는 토큰 없이, 본인 데이터/관리자 쓰기는 로그인 사용자의
//    ID 토큰을 Authorization 헤더로 실어 보안규칙(request.auth)이 적용되게 함.
// ============================================================
const FS_DOCS = FIREBASE_READY
  ? `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${FIRESTORE_DB_ID}/documents`
  : null;

function _fsEnc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string")  return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date)      return { timestampValue: v.toISOString() };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(_fsEnc) } };
  if (typeof v === "object") {
    const fields = {};
    for (const k in v) fields[k] = _fsEnc(v[k]);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}
function _fsDec(v) {
  if (!v) return null;
  if (v.stringValue    !== undefined) return v.stringValue;
  if (v.integerValue   !== undefined) return Number(v.integerValue);
  if (v.doubleValue    !== undefined) return v.doubleValue;
  if (v.booleanValue   !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue      !== undefined) return null;
  if (v.arrayValue     !== undefined) return (v.arrayValue.values || []).map(_fsDec);
  if (v.mapValue       !== undefined) {
    const o = {}, f = v.mapValue.fields || {};
    for (const k in f) o[k] = _fsDec(f[k]);
    return o;
  }
  return null;
}
function _fsFields(obj) {
  const f = {};
  for (const k in obj) f[k] = _fsEnc(obj[k]);
  return f;
}
function _fsErr(status, body) {
  const e = new Error(`Firestore REST ${status}${body ? " " + String(body).slice(0, 200) : ""}`);
  if (status === 403) e.code = "permission-denied";
  else if (status === 404) e.code = "not-found";
  return e;
}
async function _fsHeaders() {
  const h = { "Content-Type": "application/json" };
  if (auth && auth.currentUser) {
    try { h["Authorization"] = "Bearer " + (await auth.currentUser.getIdToken()); }
    catch (_) { /* 토큰 실패 시 비인증으로 진행 */ }
  }
  return h;
}
// 단일 문서 읽기. 없으면 null.
async function fsGet(path) {
  const res = await fetch(`${FS_DOCS}/${path}?key=${firebaseConfig.apiKey}`,
    { headers: await _fsHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw _fsErr(res.status, await res.text());
  const d = await res.json();
  return d.fields ? _fsDec({ mapValue: { fields: d.fields } }) : {};
}
// 문서 생성/전체덮어쓰기(set 과 동일).
async function fsSet(path, obj) {
  const res = await fetch(`${FS_DOCS}/${path}?key=${firebaseConfig.apiKey}`,
    { method: "PATCH", headers: await _fsHeaders(),
      body: JSON.stringify({ fields: _fsFields(obj) }) });
  if (!res.ok) throw _fsErr(res.status, await res.text());
  return res.json();
}
// 부분 업데이트(update). updateMask 로 지정한 필드만 변경.
async function fsUpdate(path, obj) {
  const mask = Object.keys(obj)
    .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const res = await fetch(`${FS_DOCS}/${path}?${mask}&key=${firebaseConfig.apiKey}`,
    { method: "PATCH", headers: await _fsHeaders(),
      body: JSON.stringify({ fields: _fsFields(obj) }) });
  if (!res.ok) throw _fsErr(res.status, await res.text());
  return res.json();
}
// 문서 삭제.
async function fsDelete(path) {
  const res = await fetch(`${FS_DOCS}/${path}?key=${firebaseConfig.apiKey}`,
    { method: "DELETE", headers: await _fsHeaders() });
  if (!res.ok) throw _fsErr(res.status, await res.text());
}
// 컬렉션 쿼리 → [{_docId, ...fields}] 반환.
async function fsQuery(collectionId, orderByField) {
  const sq = { from: [{ collectionId }], limit: 200 };
  if (orderByField) sq.orderBy = [{ field: { fieldPath: orderByField }, direction: "ASCENDING" }];
  const res = await fetch(`${FS_DOCS}:runQuery?key=${firebaseConfig.apiKey}`,
    { method: "POST", headers: await _fsHeaders(),
      body: JSON.stringify({ structuredQuery: sq }) });
  if (!res.ok) throw _fsErr(res.status, await res.text());
  const rows = await res.json();
  return rows.filter(r => r.document).map(r =>
    Object.assign({ _docId: r.document.name.split("/").pop() },
      _fsDec({ mapValue: { fields: r.document.fields } })));
}
// 단일 필드 equality 필터 쿼리 → [{_docId, ...fields}] 반환.
// ⚠️ 보안규칙("rules are not filters")·복합 인덱스 회피를 위해 의도적으로
//    "한 필드 == 값" 만 지원한다. 정렬은 호출부에서 클라이언트 측으로 처리.
//    (예: works 를 teamId 또는 visibility 한 가지로만 필터)
async function fsQueryWhere(collectionId, field, value) {
  const sq = {
    from: [{ collectionId }],
    where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: _fsEnc(value) } },
    limit: 500,
  };
  const res = await fetch(`${FS_DOCS}:runQuery?key=${firebaseConfig.apiKey}`,
    { method: "POST", headers: await _fsHeaders(),
      body: JSON.stringify({ structuredQuery: sq }) });
  if (!res.ok) throw _fsErr(res.status, await res.text());
  const rows = await res.json();
  return rows.filter(r => r.document).map(r =>
    Object.assign({ _docId: r.document.name.split("/").pop() },
      _fsDec({ mapValue: { fields: r.document.fields } })));
}
