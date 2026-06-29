// ============================================================
//  팀 데이터 / 팀배분 기준 마스터 (Team Data / Master Assignment)
// ------------------------------------------------------------
//  ⚠️ 이 파일은 "2026 적층제조융합설계 워크숍_팀배분 관련 정리.xlsx"
//     (전체학생 팀 분배 표)를 그대로 코드에 옮긴 **기준 마스터**입니다.
//     - 디자이너 2명 + 공학생 + 지도교수(디자인/공학)까지 팀별 전체 명단.
//     - 사용자 관리 / 팀 배치 관리 / 팀 배치 현황 / 결과 보드가 모두
//       이 마스터를 단일 기준으로 사용하도록 통일했습니다.
//
//  적용 방법: 관리자(admin)로 로그인 → 「사용자 관리」 또는 「팀 배치 관리」
//     화면의 **「Excel 기준 일괄 동기화」** 버튼을 누르면 Firestore 의
//     teams 문서(members/engineers/professorsRoster/capacity)에 반영되고,
//     이름이 일치하는 계정의 소속 팀(teamId)도 함께 맞춰집니다.
//     (라이브 Firestore 직접 쓰기는 차단되어 있어 관리자 UI 버튼으로 실행)
//
//  이 파일은 일반 <script>로 로드되며, 같은 페이지의 main.js / auth.js 에서
//  teamsData / MASTER_ASSIGNMENT 를 그대로 사용합니다.
//  (반드시 main.js 보다 먼저 로드되어야 함)
// ============================================================

// 팀배분 기준 마스터 — Excel 의 한 행 = 한 팀.
//   designers      : 디자이너 명단(2명)            → teams.members
//   engineers      : 공학생 명단                    → teams.engineers
//   designProfs    : 디자인 지도교수                ┐ 합쳐서
//   engProfs       : 공학 지도교수                  ┘  → teams.professorsRoster
const MASTER_ASSIGNMENT = [
    { id: "A", name: "A팀",   code: "Team.A", designers: ["유서연", "김나연"], engineers: ["서민재", "장정우", "이상현"],            designProfs: ["김지헌"], engProfs: ["권순조"] },
    { id: "B", name: "B+H팀", code: "Team.B", designers: ["황세현", "홍지혁"], engineers: ["함대희", "임창현", "홍창민", "조민우"], designProfs: ["정주영"], engProfs: ["김현준"] },
    { id: "C", name: "C팀",   code: "Team.C", designers: ["박준형", "이우철"], engineers: ["유지연", "강남원", "박준우"],            designProfs: ["김차중"], engProfs: ["김석"] },
    { id: "D", name: "D팀",   code: "Team.D", designers: ["김은채", "이시형"], engineers: ["김산들", "허준우", "조영유"],            designProfs: ["정주영"], engProfs: ["송기영"] },
    { id: "E", name: "E팀",   code: "Team.E", designers: ["조지운", "한영균"], engineers: ["황지민", "노현주", "김태호"],            designProfs: ["한아름"], engProfs: ["김현준", "김석민"] },
    { id: "F", name: "F팀",   code: "Team.F", designers: ["이하늘", "정운영"], engineers: ["문광민", "허지웅", "김성은"],            designProfs: ["홍주표"], engProfs: ["박상인"] },
    { id: "G", name: "G팀",   code: "Team.G", designers: ["박도현", "최강"],   engineers: ["이정아", "박현민", "조민재"],            designProfs: ["김성준"], engProfs: ["김석"] },
    { id: "I", name: "I팀",   code: "Team.I", designers: ["최보아", "김나임"], engineers: ["송한규", "김재준", "김동빈"],            designProfs: ["한아름"], engProfs: ["권순조"] },
    { id: "J", name: "J팀",   code: "Team.J", designers: ["이선우", "이민경"], engineers: ["서선진", "명채은", "여환철"],            designProfs: ["김성준"], engProfs: ["안건식"] }
];

// 마스터 한 팀을 Firestore teams 문서 형태로 변환.
//  members=디자이너 / engineers=공학생 / professorsRoster=지도교수(디자인+공학) / capacity=공학생 수
function masterTeamDoc(m) {
    const profs = (m.designProfs || []).concat(m.engProfs || []);
    return {
        id: m.id,
        name: m.name,
        code: m.code,
        members: (m.designers || []).slice(),
        engineers: (m.engineers || []).slice(),
        professorsRoster: profs,
        designProfs: (m.designProfs || []).slice(),
        engProfs: (m.engProfs || []).slice(),
        capacity: (m.engineers || []).length
    };
}

// 화면용 팀 목록(폴백). Firestore 가 비어 있을 때만 사용됨.
const teamsData = MASTER_ASSIGNMENT.map(masterTeamDoc);

// ------------------------------------------------------------
//  공통 접근 헬퍼 — 모든 페이지가 같은 규칙으로 팀 명단을 읽도록 통일
// ------------------------------------------------------------
function teamDesigners(t) { return (t && t.members) || []; }
function teamEngineers(t) { return (t && t.engineers) || []; }
// 팀 전체 인원(디자이너 + 공학생)
function teamRoster(t) { return teamDesigners(t).concat(teamEngineers(t)); }
// 지도교수: '사용자 관리'(계정)와 동일하게 계정 기반(advisingProfessors)만 사용.
//  · advisingProfessors 는 교수 계정의 advisingTeamIds 를 rebuildTeamProfessors 가
//    공개 설정에 따라 팀 문서에 비정규화해 둔 값(공개 read 용).
//  · 마스터(professorsRoster)는 동기화 리포트·참고용으로만 보관하고 화면엔 쓰지 않는다.
function teamProfessorNames(t) {
    return (t && t.advisingProfessors) || [];
}
