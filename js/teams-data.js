// ============================================================
//  팀 데이터 (Team Data)
// ------------------------------------------------------------
//  ⚠️ 현재는 코드에 하드코딩되어 있습니다.
//  추후 Firestore의 'teams' 컬렉션으로 이전 예정입니다.
//  (SYSTEM_DESIGN.md 15장 3단계 참고)
//
//  이 파일은 일반 <script>로 로드되며, 여기서 선언한
//  teamsData 는 같은 페이지의 main.js 에서 그대로 사용됩니다.
//  (반드시 main.js 보다 먼저 로드되어야 함)
// ============================================================

const teamsData = [
    { id: "A", name: "A팀", members: ["유서연", "김나연"], code: "Team.A" },
    { id: "B", name: "B팀", members: ["황세현", "홍지혁"], code: "Team.B" },
    { id: "C", name: "C팀", members: ["박준형", "이우철"], code: "Team.C" },
    { id: "D", name: "D팀", members: ["김은채", "이시형"], code: "Team.D" },
    { id: "E", name: "E팀", members: ["조지운", "한영균"], code: "Team.E" },
    { id: "F", name: "F팀", members: ["이하늘", "정운영"], code: "Team.F" },
    { id: "G", name: "G팀", members: ["박도현", "최강"], code: "Team.G" },
    { id: "H", name: "H팀", members: ["함대희", "임창현"], code: "Team.H" },
    { id: "I", name: "I팀", members: ["최보아", "김나임"], code: "Team.I" },
    { id: "J", name: "J팀", members: ["이선우", "이민경"], code: "Team.J" }
];
