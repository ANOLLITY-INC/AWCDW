# AWCDW Website — 진행 현황 & 로드맵

> 이 파일은 **프로젝트 팔로업 단일 기준 문서**입니다.
> 작업이 끝날 때마다 ✅ 체크하고, 새 작업은 로드맵에 추가하세요.
> 기술 설계 상세는 `SYSTEM_DESIGN.md`, 복귀용 짧은 메모는 Claude 메모리(`awcdw-firebase-progress.md`)에 있습니다.

- **라이브 URL:** https://amcdw-9d10e.web.app
- **참고(원본) 사이트:** https://anollity-inc.github.io/AWCDW/
- **Firebase 프로젝트:** `amcdw-9d10e` · CLI 로그인: anollity23@gmail.com
- **Firestore DB:** `database1` (named, Enterprise/Blaze) — `(default)` 아님 ⚠️
- **작업 브랜치:** `busan_workshop_intensive_ver`
- **최종 업데이트:** 2026-08-19

---

## ▶ 재개 지점 (다음에 바로 할 일)

**🔵 2026-08-17 — 3차 워크숍(한기대) 안내 3페이지: 커밋 `d855277` · 푸시 · 라이브 배포 완료 ✅** — 상세 `WORKLOG_2026-08-17.md`, 쉬운 요약 `쉬운설명_지금상황.md`
- 일정 기준은 **ⓐ `적층제조융합 설계워크숍 20260814.pdf` 안내자료로 통일**(사용자 결정) — Day3 재구성(08:30 퇴실 신설, 13:30~15:30 성과발표회 및 시상), 캠퍼스맵 범례 정합성 수정
- [x] **KUT 02 탭「한국기술교육대학교 기숙사 배정」 완료(2026-08-18, 커밋 `bc67026`, 라이브)** — `js/kut-info.js`(46명·25호실·생활관 203동) + `#kut-dorm-page` 이름 검색
- ⏸ **한기대 시설 이용 안내 = 자료 미수령** → 도착 시 `#cau-facility-page` 패턴으로 별도 페이지
- [x] **이름 표기 확정(2026-08-19):** 「홍찬민」으로 통일(kut-info.js·teams-data.js), 옛 표기 검색은 별칭으로 지원
- [x] **다담팩토리 위치 정정:** 캠퍼스 맵 범례 (담헌실학관 인접) → (담헌실학관 106호)

**⚠️ 관리자가 라이브에서 직접 눌러야 할 것**(작업 환경에서 Firestore 직접 쓰기 불가):
- **사용자 관리 또는 팀 배치 관리 → 「⤓ Excel 기준 일괄 동기화」 1회** (2026-06-29 신규) — 팀배분 Excel 기준으로 teams/계정/공개 화면을 한 번에 통일. 실행 후 상단 **미매칭(계정 없는 학생·교수) 리포트** 확인 → 가입 후 배정 또는 이름 표기 보정.
- 팀 배치 관리 → **「지도교수 공개」** (공개/결과 보드에 지도교수 표시하려면 ON)
- (구) 팀 관리 「↻ 사용자 관리 기준 동기화」·사용자 관리 「↻ 팀 배정 동기화」 — Excel 동기화에 포함되므로 평소엔 불필요.
- **검수 필요:** 부산 숙소 호실·비밀번호(순서 임시배정 값) — 체크인 전 운영진 확인.
- **GitHub 푸시 대기:** 커밋 `d5dacb3`·`209a430`·`7726869` 아직 origin 미푸시(사용자 승인 후).

**Phase 1~4 전부 완료 ✅**(2026-06-08~09, `?v=12`). 인증·역할 / 작품(업로드·PDF인라인·커버) / 피드백 / 공학생 선착순 지원·배정까지 구현·배포됨. 핵심 흐름 라이브 정상 확인됨(업로드까지). **2026-06-24~29 배치**(팀배정 동기화·결과발표 보드·팀 배치 관리/현황·지도교수 공개·숙소 재배정·일정) 구현·배포됨 — 상세는 아래 Changelog + `WORKLOG_2026-06-29.md`.

**다음 = Phase 5 (마감 품질·고도화).** 우선순위 제안:
1. **모바일 반응형 점검** — ⚠️ 특히 「사용자 관리·팀 관리·지원자 명단」의 표(table)가 모바일에서 가로로 넘침. 카드형 또는 가로 스크롤 처리.
2. **배포 완성도** — favicon, `<title>`/OG 메타(공유 미리보기), 404 페이지.
3. **공지사항/배너**(관리자), **GA 수집 검증**(measurementId 존재).
4. ⏸ **일정표 실제 내용** — 사용자 자료 제공 후 (현재 "준비 중" 모달).

**라이브에서 한 번씩 확인할 잔여 검증:**
- **작품 공개범위** — `team_only` 작품이 비소속/공학생/비로그인에 안 보이는지, `public` 은 갤러리에 뜨는지.
- **디자이너 team_only 목록 쿼리 리스크** — `where teamId==X` 가 규칙(`get()` 기반) 분석에서 거부되면 공개 폴백으로 빠져 자기 팀 team_only 작품이 안 보일 수 있음(admin/professor 무관). 그러면 복합인덱스/커스텀클레임으로 보강.
- **지원 동시성** — 선착순은 신청 직전 정원 재확인만 함(트랜잭션 없음). 동시 클릭 초과 시 admin 「지원 현황」에서 배정 취소로 조정.

> 막히면 콘솔 빨간 에러 그대로 확인(특히 `permission-denied`).
> ⚠️ **데이터 접근은 REST 헬퍼**(`fsGet/fsSet/fsUpdate/fsDelete/fsQuery/fsQueryWhere`, `firebase-config.js`) **사용** — SDK `.get()/.set()` 은 이 네트워크에서 ~30초. (단 **Storage 첨부는 SDK 그대로** — Firestore 채널과 무관해 빠름)

---

## ✅ 완료 내역 (Changelog)

### 2026-08-17 — 3차 워크숍(한국기술교육대) 안내 페이지 3종 (busan_workshop_intensive_ver, 커밋 `d855277`, **라이브 배포됨**)

- [x] `#schedule-kut-page` — 3차 워크숍 상세일정(Day1~3 + Next 카드: 대한기계학회 학술대회·CO-SHOW·논문집), 장소 배지 6종 범례, 비상연락처 배너, 테마/인쇄 컨트롤
- [x] `#kut-directions-page` — 오시는 길(제1캠퍼스≠제2캠퍼스 경고, 주소·카카오맵, 교통편 5종, 약도 `kut-directions.jpg`)
- [x] `#kut-campus-map-page` — 캠퍼스 맵(주요 장소 4카드 + 맵 이미지 `kut-campus-map.jpg`)
- [x] 랜딩: 로드맵 05번 카드 「상세일정 보기」 버튼, Schedule 04 탭 연결, `KOREATECH WORKSHOP GUIDE` 4탭 섹션 신설(4번째=준비 중)
- [x] `main.js v36` 라우트 3개 + 테마(`kut-*`) 반영, 세부일정 탭 스타일 `setTabs()` 헬퍼로 통합
- [x] `works.js v33` 결과 보드 단계에 「진행상황 중간발표」 추가
- [x] `busan-info.js v28` 숙소 미이용 9명 배정 완료(`BUSAN_ROOM_UNUSED=[]`), W레지던스(B) 폐지, A-9(911호) 추가
- [x] `한국기술교육대학교 관련/` 폴더 `.gitignore` + `firebase.json` ignore 등록
- [x] 로컬 검증(포트 3111): 라우팅·3테마·이미지·PDF 200·콘솔 무오류
- [x] 일정 원본 2개 불일치 → ⓐ 안내자료(20260814) 기준 통일, Day3 재구성 + 캠퍼스맵 범례 수정
- [x] 커밋 `d855277` → `git push` (b77670b..d855277) → `firebase deploy --only hosting` (라이브 검증: 페이지 3개·이미지·PDF 200, 내부 md·개인정보 폴더 404)
- [ ] KUT 04 기숙사 배정·시설 이용 페이지 — **자료 수령 대기**

### 2026-06-29 — 팀배분 Excel 기준 통일 + 모든 팀 화면 계정 기준 일치 (busan_workshop_intensive_ver, 라이브 배포됨)
> 전체 상세는 `WORKLOG_2026-06-29.md` §10~12. JS 캐시버전: **teams-data `?v=31` / auth `?v=32` / works `?v=32` / main `?v=32`**. 커밋 `d5dacb3`·`209a430`·`7726869`.

- [x] **팀배분 기준 마스터(Excel) 코드 내장** (`teams-data.js`) — 루트 `2026 적층제조융합설계 워크숍_팀배분 관련 정리.xlsx`(전체학생 팀분배 표)를 `MASTER_ASSIGNMENT`로 내장. 9팀(A·B(=B+H)·C·D·E·F·G·I·J), 팀별 **디자이너2 + 공학생 + 지도교수(디자인/공학)**, 총 디18+공28=46명. `masterTeamDoc()` + 공통 헬퍼 `teamDesigners/teamEngineers/teamRoster/teamProfessorNames`.
- [x] **데이터 모델 통일** — `teams.members`=디자이너, **신규 `teams.engineers`**=공학생, **신규 `teams.professorsRoster`**(+designProfs/engProfs)=Excel 지도교수, `capacity`=공학생 수.
- [x] **「⤓ Excel 기준 일괄 동기화」 버튼**(`auth.js syncFromMaster`, 사용자 관리·팀 배치 관리 헤더) — ① teams에 마스터 반영(마스터에 없는 H팀 명단 비움) → ② 이름 일치 계정의 `teamId` reconcile(공학생 engineers도 매칭, applications uid 우선) → ③ **`syncTeamsFromUsers`로 teams 문서를 계정 기준으로 재구성**(공개 화면·결과 보드까지 일치) → ④ **계정 없는 학생/교수 미매칭 리포트**(상단 앰버 패널, `masterSyncReport`).
- [x] **팀 배치 관리·팀 배치 현황을 사용자 관리(계정) 기준으로 통일** — `effStudentTeam`(teamId>지원배정>이름폴백) + `pickTeamMembers`로 디자이너·공학생·지도교수 산출. `renderTeamStatus`가 admin일 때 users 로드 → 관리자는 계정 기준 전체 표시. `teamProfessorNames`는 계정 기반(advisingProfessors)만 사용.
- [x] **차수별 진행결과 발표 보드/상세 팀원 명단도 동일 기준** — 모든 팀 화면이 공유하는 단일 함수 **`teamRosterForDisplay`**(관리자=계정/그 외=teams 문서) + `loadTeamRosterCtx`. `renderResultTeamsBoard`·결과 팀 상세가 이를 사용 → 배치 현황/관리와 항상 일치. 권한(`canUploadCat` 등)은 원래 계정 teamId 기준이라 **'보이는 팀원=실제 권한 보유자'** 로 일치.
- [x] **개인정보 보호 강화** — 팀배분 xlsx·`부산 숙소 배정표.jpg`를 `.gitignore` + `firebase.json` hosting ignore 양쪽에 추가(공개 리포·호스팅 제외).
- ⚠️ firestore.rules 변경 불필요(teams write=admin, 필드 제약 없음). 라이브 데이터 정합성은 관리자가 **「⤓ Excel 기준 일괄 동기화」 1회** 실행해야 함.

### 2026-06-24~29 — 팀배정 동기화·결과발표 보드·배치 관리·숙소 재배정 (busan_workshop_intensive_ver, 라이브 배포됨)
> 전체 상세는 루트 **`WORKLOG_2026-06-29.md`**. JS 캐시버전: auth `?v=29` / works `?v=27` / apply `?v=26` / busan-info `?v=27` / main `?v=27`.

- [x] **학생 팀배정 동기화** (`auth.js`) — `users.teamId`를 **지원자 명단(applications, 공학생·uid 우선) + 팀 명단(teams.members, 디자이너·이름)** 기준으로 맞춤(`reconcileTeamIds`/`syncAllTeamIds`). 사용자 관리 「↻ 팀 배정 동기화」 버튼, 드롭다운↔members 양방향(`syncUserNameIntoTeams`), "미동기화" 배지.
- [x] **팀 관리 보강** — 「지도 교수」 열(users.advisingTeamIds 실시간) + 「↻ 사용자 관리 기준 동기화」 버튼(`syncTeamsFromUsers`: 각 팀 members = 그 팀 **디자이너+공학생**).
- [x] **워크숍 차수별 진행 결과 발표 보드 신설** — works에 `category`('proposal'|'result') 추가(`workCtx.cat`). 메인 카드 + 대시보드 메뉴. 권한: result=배정 학생+담당 교수 / proposal=소속 디자이너(`canUploadCat`/`canManageWork`). 단계 옵션 result=**1·2·3차 워크숍**. `firestore.rules` works 카테고리별 정비(`...data.get('category','proposal')`), 읽기 배정 학생까지 확대.
- [x] **결과 보드 팀 보드 = 팀 배치 현황 기준** (`main.js renderResultTeamsBoard`) — 팀원+지도교수 표시, 지원 정원/배너 제거, **상단 통계 숨김 + 앰버 색상**으로 주제제안(파랑)과 구분.
- [x] **팀 배치 관리 페이지(`team-place`, 관리자)** — 팀별 디자이너·공학생(지원)·지도교수 한 화면, 미배정 배정(`placeStudent`: 공학생=applications/디자이너=members), 「계정 없는 학생 직접 추가」(`addNameToTeam`). `firestore.rules` applications create에 **admin 허용** 추가.
- [x] **팀 배치 현황 페이지(`team-status`, 전체 공개)** — 디자이너+공학생(로그인 시)+지도교수(공개 시). 일반 사용자는 users 못 읽으므로 교수를 공개 읽기용 **`teams.advisingProfessors`로 비정규화**(`rebuildTeamProfessors`).
- [x] **지도교수 명단 공개 토글** — `settings/app.professorsPublic`(기본 **비공개**), `apply.js toggleProfessorsPublic`, 팀 배치 관리 버튼. 공개 시에만 advisingProfessors 채움(비공개면 비움).
- [x] **공학생 팀 변경 버그 수정** — `saveUserAdmin`이 공학생 팀 변경 시 **applications.assignedTeamId도 갱신**(안 하면 동기화가 옛 팀으로 되돌림). ⚠️ B+H팀 실제 팀 id=`"B"`(이름만 변경, H 비움).
- [x] **부산 숙소 호실·비밀번호** (`busan-info.js`) — `부산 숙소 배정표.jpg`(A=ST/C=S/D=SR) → `URBANSTAY_ROOM_DETAIL`, 이름 검색 시 호실+객실 비번 박스, **엘리베이터 7878#는 상단 별도 칸**. 배정표 이미지는 `firebase.json` ignore. **방 재배정(06-25):** B(W레지던스) 11명→어반스테이 S/SR, **황세현만 B 유지**(순서 임시배정 — **검수 필요**).
- [x] **부산 Day 2 일정** — 13:00~15:00 ↔ 16:00~18:00 내용·장소 swap, Day2·Day3 맨 위 "서명부 작성 후 대기(1층 114호)" 행 추가.
- ⚠️ **라이브 Firestore 직접 쓰기 불가**(작업 환경 자격증명 차단) → 데이터 동기화/병합/공개는 **관리자 UI 버튼**으로 실행. teams 읽기는 공개라 REST runQuery로 점검 가능.

### 2026-06 — Firebase 전환 & 배포
- [x] 단일 HTML(`AWCDW_26.06.02.html`, 백업 보존)을 구조 분리
      → `index.html` + `js/firebase-config.js` / `teams-data.js` / `main.js`
- [x] Firebase Firestore 연동 (Compat SDK 10.14.1)
      - `loadTeams()`: Firestore `teams` 컬렉션에서 읽어 화면 렌더
      - `seedTeams()`: 로컬 `teamsData`를 Firestore로 업로드(콘솔 실행)
      - 미설정/오류 시 로컬 `teams-data.js`로 자동 폴백
- [x] 실 firebaseConfig 값 입력 (projectId `amcdw-9d10e`)
- [x] **연결 멈춤(pending) 버그 해결** — `db.settings({ experimentalForceLongPolling: true })`
      (스트리밍 전송이 네트워크/확장에 막히던 문제. `merge:true`와 동시 사용 금지)
- [x] `seedTeams()`에 에러 캐치 + 업로드 후 검증 읽기 추가
- [x] **팀 명단 9팀(A~I)으로 갱신** — 원본 사이트 기준
      - E팀: `조지운·한영균` (2명, 기존 최보아 제외)
      - I팀(신규): `최보아·김나임`
- [x] Firestore 재시드 완료 → 문서 9개 확인
- [x] **Firebase Hosting 배포** — `firebase.json` + `.firebaserc` 작성 후 `firebase deploy`
- [x] Firestore 보안 규칙: 2028-07-05까지 read/write 허용 (사용자 설정, **임시** — Phase 1에서 역할 기반으로 교체)
- [x] **역할 기반 가입 시스템 설계 확정** — SYSTEM_DESIGN.md(3·5·7·9·10장) 반영해 로드맵 재구성.
      결정: 출석/체크인 제외, 일정표 내용은 추후 사용자 제공. 다음 작업 = Phase 1(인증·역할)

### 2026-06 — Phase 1: 인증 & 역할 (구현·배포)
- [x] **Authentication 활성화** — 이메일/비번 + Google + Microsoft (사용자 콘솔 설정)
- [x] **`js/auth.js` 신규** — 로그인/회원가입/소셜/프로필보완/로그아웃, 역할 헬퍼,
      우상단 인증 상태바, 역할별 대시보드(admin/professor/designer/engineer) 렌더
- [x] `index.html`: auth SDK(`firebase-auth-compat`) + `#auth-bar`/`#auth-page`/`#dashboard-page` 추가, `auth.js` 로드
- [x] `js/firebase-config.js`: `auth` 노출
- [x] `js/main.js`: `navigateTo`에 `auth`/`dashboard` 페이지 연결 + `window.onload`에서 `initAuth()` 호출
- [x] **`firestore.rules` 신규·배포** — teams(read 공개·write admin), users(역할상승 방지),
      works/feedbacks/applications 골격. `firebase.json`에 `firestore.database:"database1"`
- [x] **DB 이슈 발견·대응** — 표준 `(default)` 없음, named **`database1`(Enterprise)** 만 존재.
      앱은 `firebase.app().firestore("database1")`, 규칙은 database1 타깃으로 고정.
      사용자 결정: database1(Enterprise) 유지. ⚠️ Blaze 결제 필요.
- [x] **소셜/이메일 가입 흐름 버그 수정·배포** (2026-06-08) — 구글 가입 테스트 중 발견.
      ① **핵심 버그:** `handleAuthSubmit`이 `f.name`/`f.role`로 값을 읽어 폼 네이티브/ARIA 속성에
      가려짐 → 가입·프로필완성 제출이 조용히 실패(역할/정보 저장 안 됨, users 문서 미생성).
      → `f.elements`로 접근하도록 수정.
      ② `onAuthStateChanged`에 try/catch + 프로필 조회 재시도(`fetchProfileWithRetry`) 추가.
      ③ 로그인/가입 완료 후 **메인(landing)으로 자동 이동**(기존 dashboard → landing).
      ④ **학번(studentId) 필드 추가** — 가입/완성 폼 + users 스키마.
      ⑤ **대시보드 「내 정보 수정」** 추가 — 이름·학번·대학·학과 수정(이메일·역할 제외, 본인 update).
- [x] **관리자 팀 관리 화면 구현·배포** (2026-06-08) — admin 대시보드 「팀 관리」에서
      팀 목록/추가/수정/삭제(Firestore `teams` CRUD). 콘솔·`seedTeams()` 없이 화면에서 관리.
      `index.html`(#team-admin-page) + `main.js`(navigateTo `team-admin` 라우트) +
      `js/auth.js`(renderTeamAdmin/openTeamForm/saveTeam/deleteTeam, 권한 가드, 공개보드 동기화).
      함정 처리: `form.id`/`form.name` 네이티브 속성 가림 → `f.elements` 접근.
- [x] **라이브 테스트 / 첫 admin 부트스트랩 / 팀 관리 화면 검증 완료** (2026-06-08) → **Phase 1 종료**

### 2026-06-08 — 성능·안정화 대수술 (REST 전환 + 캐시 + 10팀)
- [x] **Firestore 전체 SDK→REST 전환** ⭐ — 팀 로드가 24~41초 걸리던 근본 원인 해결.
      원인: DB가 **Enterprise 에디션(database1)**이라 이 네트워크에서 웹 SDK 실시간 채널
      (WebChannel/long-polling)이 단순 read/write에 ~30초. (강제 long-polling→auto-detect 로도 안 됨)
      - `js/firebase-config.js`에 **공유 REST 헬퍼** 추가: `fsGet`/`fsSet`/`fsUpdate`/`fsDelete`/`fsQuery`
        (+ 인코더 `_fsEnc`/디코더 `_fsDec`). 쓰기·본인데이터 읽기는 `auth.currentUser.getIdToken()`을
        `Authorization` 헤더로 실어 보안규칙 그대로 적용.
      - 전환 지점: `main.js`(loadTeams·seedTeams), `auth.js`(createUserDoc·fetchProfileWithRetry·
        saveProfile·renderTeamAdmin·saveTeam·deleteTeam). **인증/세션만 SDK 유지.**
      - 결과: 팀 로드 ~0.3초, **프로필 입력 후 메인 복귀 멈춤(users SDK read 60초+) 해결.**
- [x] **배포 즉시 반영 — HTML 캐시 헤더** — Firebase Hosting 기본 `max-age=3600` 이 옛 index.html을
      1시간 캐시해 배포가 안 보이던 문제. `firebase.json` hosting `headers`에 `**/*.html`·`/` →
      `Cache-Control: no-cache, max-age=0, must-revalidate` 추가. JS는 `?v=N` 캐시버스팅(현재 **v4**).
- [x] **팀 10팀(A~J)으로 갱신** — 원본 사이트에 J팀(이선우·이민경) 추가됨. `teams-data.js` 반영 +
      Firestore 재시드(규칙 임시개방→REST commit→**즉시 잠금·403 확인**). 그전 teams 컬렉션이
      비어 있던 것도 이때 발견·복구(그간 화면은 로컬 폴백으로 보이던 것).
- [x] **상단 통계 동적화** — `index.html` 값에 `id=stat-teams/stat-designers/stat-avg` 부여,
      `main.js updateStats()`가 `teams`로 계산(renderTeams마다) → 현재 **10 / 20 / 2.0**. 팀 변경 시 자동.

---

### 2026-06-09 — 회원 탈퇴 + 교수 전체열람 확인 (`?v=20`)
- [x] **회원 탈퇴** — 대시보드 「내 정보 수정」 하단 「회원 탈퇴」(이중 확인: confirm + "탈퇴" 입력). `auth.js withdrawAccount`:
      지원서(`applications/{uid}`)·프로필(`users/{uid}`) 삭제 → `currentUser.delete()`(requires-recent-login 시 provider별 재인증 후 재시도).
      `firestore.rules` users delete 를 `isAdmin() || 본인` 으로 확장·배포. ⚠️ 재인증 취소 시 프로필만 삭제되는 엣지 케이스는 관리자 문의로 안내.
- [x] **교수 전체 열람 확인** — 별도 수정 불필요. works/feedbacks read 규칙에 이미 `isProfessor()` 포함 → 교수·관리자는 `team_only` 포함 모든 글·피드백 열람. 클라이언트도 교수에겐 전체 로드(갤러리 fsQuery('works') 전체, 팀 상세 권한자 전체). 규칙 재배포로 라이브 최신화.

### 2026-06-09 — Phase 5: 모바일 반응형 (관리 표) (`?v=19`)
- [x] **관리 화면 표 가로 넘침 해결** — 팀 관리·사용자 관리(auth.js) 표 컨테이너 `overflow-hidden→overflow-x-auto` + 표 `min-w-[720px]`(좁은 화면 가로 스크롤). 지원자 명단(apply.js) 표는 `overflow-x-auto` 래퍼 + `min-w-[420px]`, 블록 헤더는 `min-w-0`/`shrink-0`로 정리. → 모바일에서 페이지 가로 넘침 없이 표만 스크롤.
- [ ] (잔여 Phase 5) favicon·OG·404, 공지/배너, GA 검증, 일정표 내용(자료 대기), 다국어(선택)

### 2026-06-09 — 지원 기간 외 인원수 숨김 (`?v=18`)
- [x] **지원 기간이 아니면 지원 공학생 수·잔여 수 숨김** — 팀 보드 카드(`main.js teamSlotsApplyHtml`: teamApplyOpen 일 때만 카운트, 내 지원 팀 표시는 유지) + 팀 상세 지원 패널(`apply.js teamDetailApplyPanel`: 기간 중엔 카운트, 기간 외엔 상태 라벨만).

### 2026-06-09 — 우상단 인증바 크기·정렬 개선 (`?v=17`)
- [x] **인증 상태바(우상단) 확대·정렬 일정화** — `auth.js renderAuthBar`. 역할 배지 `text-xs`, 이름 `text-sm`(max-w-160 truncate),
      로그아웃은 아이콘+「로그아웃」 텍스트 알약. 프로필/로그아웃 버튼 **높이 통일(py-2.5)**·`whitespace-nowrap`·`shrink-0` 로
      역할/이름 글자수와 무관하게 항상 같은 정렬·간격 유지. 긴 이름은 말줄임(title 에 전체 표시).

### 2026-06-09 — 지원 패널을 팀 상세 페이지로 이동 (`?v=16`)
- [x] **지원/내 지원 팀/취소 → 팀 상세 페이지 안으로** — 「작품 보기」로 들어가는 팀 상세(`#team-detail-page`) 상단에
      **지원 패널**(`apply.js teamDetailApplyPanel`): 잔여 정원 + (공학생·기간 중) 「이 팀에 지원/변경」·「✓ 이 팀에 지원함 + 지원 취소」.
      `applyFromDetail`/`cancelFromDetail` → renderTeamDetail 재렌더. works.js renderTeamDetail 가 refreshTeamApplyState 후 패널 렌더.
- [x] **팀 보드 카드에서 버튼 제거** — 카드엔 잔여 정원 + (내 지원 팀이면) 「✓ 내 지원 팀」 텍스트만. 지원/취소 버튼은 상세 페이지로 일원화.
      보드 배너 문구도 "팀을 눌러 들어가서 「이 팀에 지원」" 으로 수정. (이전 `applyFromBoard`/`cancelFromBoard` 는 미사용으로 잔존)

### 2026-06-09 — 지원 UX: 보드 중심 + 보드 취소 (`?v=15`)
- [x] **지원을 팀 보드 중심으로** — 공학생 대시보드 「팀 지원」 → 팀 보드(`navigateTo('teams')`)로 이동. 팀 보드 상단에 공학생용 **지원 안내 배너**(`renderApplyBanner`, 기간 상태 표시). (「지원 현황」 메뉴는 그대로 지원 페이지=내 배정 확인.)
- [x] **보드에서 지원 취소** — 내 지원 팀 카드에 「✓ 내 지원 팀」 + **취소** 버튼(기간 중). `apply.js cancelFromBoard()`. 「내 지원 팀」 배지는 기간 무관 항상 표시, 지원/취소 버튼은 기간 중에만.

### 2026-06-09 — 지원 기간 설정 + 팀 보드 지원 + 잔여정원 (`?v=14`)
- [x] **지원 기간 설정(관리자)** — `settings/app.applyStart`/`applyEnd`(datetime-local 문자열). 관리자 「지원 현황」에
      **「지원 기간 설정」 패널**(`applyWindowAdminHtml`/`saveApplyWindow`). 현재 상태 = `applyStatusInfo()`(unset/before/open/after).
      ⚠️ 설정 저장은 `fsUpdate`(rosterPublic 등 다른 필드 보존). `toggleRosterPublic`도 fsSet→**fsUpdate**로 변경(필드 보존).
- [x] **팀 보드에서 바로 지원** — 지원 기간 중이면 공개 팀 보드(`#teams-page`) 카드에 **「지원」 버튼**(공학생만) 노출.
      `main.js`: `refreshTeamApplyState()`(기간+정원+내지원 로드, teams 진입 시), `teamSlotsApplyHtml()`(카드 하단), 그리드/리스트 카드에 주입.
      보드 신청은 `apply.js applyFromBoard()` → 정원 재확인 후 신청 → 보드 갱신. 카드 onclick(작품보기)와 충돌 방지 `event.stopPropagation()`.
- [x] **잔여 정원 표시** — 보드·지원 페이지 카드에 `공학생 N/정원 · 잔여 M`(비로그인은 정원만). 지원 페이지도 기간 게이팅(기간 외 신청·변경·취소 버튼 숨김 + 상태 배너).
- [x] **지원 핵심 로직 공용화** — `applyToTeamCore()`(기간/정원 가드) → `applyToTeam`(지원페이지)·`applyFromBoard`(보드) 공용.

### 2026-06-09 — 지원자 명단 공개 토글 + 피드백 공개범위 명확화 (`?v=13`)
- [x] **지원자 명단 학생 공개 토글** — `settings/app.rosterPublic`(읽기 공개·쓰기 admin, 규칙 추가).
      관리자 「지원 현황」 상단에 **「학생에게 공개/비공개」 토글**(`publishToggleHtml`/`toggleRosterPublic`).
      공개(true) 시에만 공학·디자인 학생 대시보드에 **「팀 배정 결과」 메뉴**가 동적으로 노출되고
      전체 팀 명단을 읽기전용으로 봄. 비공개면 학생은 메뉴 없음 + 직접 진입 시 "아직 공개 안 됨" 안내.
      admin/professor 는 상시 열람. (`apply.js` rosterPublic/loadRosterPublic, `auth.js` renderDashboard 동적메뉴+배경갱신,
      `main.js` onload 선로딩). 디자이너 정적 "지원자 명단(우리팀)" 메뉴는 제거(공개 토글로 일원화).
      ⚠️ 게이팅은 **UI 레벨**(applications read 는 여전히 signedIn — 지원 보드 정원표시에 필요). 데이터는 로그인 시 API로는 접근 가능.
- [x] **피드백 공개범위 라벨 명확화** — 「팀원만 보기」가 *전체공개 작품에 달아도 해당 작품 팀·교수·관리자에게만 보임*을
      라벨/설명으로 명확화(기능 자체는 Phase 3에서 이미 구현됨 — visibility public/team_only). feedback.js fbFormHtml.

### 2026-06-09 — Phase 4: 공학생 지원 시스템 (`?v=12`)
- [x] **`js/apply.js` 신규** — 공학생 지원 페이지(선착순 즉시 배정, 정원/마감, 변경/취소) + 지원자 명단(역할별 범위, admin 배정취소).
- [x] **`firestore.rules` applications** — read=signedIn(보드 현황 공개), create=engineer 본인+문서ID=uid(1인1지원), update/delete=본인 또는 admin. 배포.
- [x] **팀 `capacity` 필드** — 팀 관리 폼에 「공학생 정원」(기본 3) 추가. `apply.js teamCapacity()` 가 없으면 3.
- [x] **대시보드 메뉴 연결** — engineer(팀 지원/지원 현황→openApply), admin(지원 현황), professor·designer(지원자 명단→openApplicants). main.js apply/applicants 라우트, index.html 컨테이너+apply.js(`?v=12`).
- ⚠️ 동시성: 신청 직전 정원 재확인 + 관리자 조정(트랜잭션 미사용). 대규모 동시신청 시 보강 필요.

### 2026-06-09 — 뒤로가기 버튼 크기 통일 (`?v=11`)
- [x] **화면 내 뒤로가기 버튼 전체 크기·스타일 통일·확대** — 기존 작은 `text-xs` 텍스트 링크 →
      `text-sm font-bold px-4 py-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 ... inline-flex gap-1.5` 알약형으로 통일.
      대상 10개: works.js(팀상세 ←팀보드, 작품상세 ←팀, 갤러리 ←메인) + auth.js(auth/대시보드/팀관리/사용자관리 ←메인·대시보드)
      + index.html(온라인·부산·팀보드 페이지 "← Back to Home"). 컨텍스트별 margin(mb-*/mr-2)·no-print 은 유지.

### 2026-06-09 — UX 수정 묶음 (`?v=10`)
- [x] **작성 중 "+ 새 작품 등록" 비활성화** — workCtx.formOpen 시 버튼을 "작성 중…" 비활성 상태로(혼동 방지).
- [x] **팀 상세 상단 "TEAM TEAM.B" 중복 수정** — code(`Team.B`)에 "Team " 접두 + 대문자화가 겹쳐 중복되던 것 → code 그대로 표기.
- [x] **브라우저 뒤로가기 지원(History API)** — `main.js`: navigateTo 마다 pushState(+workCtx/authMode 스냅샷), popstate 시 _suppressHistory 로 복원, onload 시 landing replaceState. 페이지 내 뒤로가기 버튼은 그대로 둠(둘 다 동작).
- [x] **작품 커버 이미지(썸네일)** — 업로드 폼에 `cover` 단일 이미지 필드 추가 → Storage 업로드 → `works.coverUrl`. 작품 상세 상단에 크게 표시 + 목록/갤러리 카드 썸네일은 `coverOf()`(커버 우선, 없으면 첫 이미지 첨부).
- [x] **다크모드 로드맵 글씨** — 랜딩 `#schedule-grid`(WORKSHOP MASTER TIMELINE) 카드가 테마 무관 흰 배경인데 h4 제목이 색지정 없어 다크모드 밝은 본문색 상속→흰글씨 묻힘. 그리드에 `text-neutral-900` 고정으로 해결.

### 2026-06-09 — Phase 3: 피드백 시스템 + 교수 지도팀
- [x] **`js/feedback.js` 신규** — 작품 상세에 피드백 섹션(목록+작성폼). 작성=모든 교수+관리자,
      공개범위 public/team_only. 권한별 쿼리(`fsQueryWhere('feedbacks','workId',…)`)+공개 폴백.
      작성자 이름은 비정규화 저장(`authorName`, 디자이너는 타 users 문서 read 불가하므로).
      works.js renderWorkDetail 에 `#work-feedback` placeholder + `renderWorkFeedback(work)` 호출.
- [x] **`firestore.rules` feedbacks 정비** — works 와 동일 구조(공개=비로그인도 read, 팀전용=권한자/소속팀),
      create 시 `authorId==uid` 검증. 배포(컴파일 성공).
- [x] **교수 지도 팀(`advisingTeamIds[]`)** — 「사용자 관리」 폼에서 역할=professor 면 팀 다중 선택 체크박스로 전환
      (역할 select onchange 시 폼 재렌더). 교수 대시보드 「내 지도 팀」 바로가기. 디자이너「피드백 확인」→`goMyTeam()`.
- [x] `?v=9` 배포(8파일, feedback.js 추가).

### 2026-06-09 — 팀 소속 정책 + 관리자 사용자 관리 화면
- [x] **팀 소속 배정 정책 = "관리자가 배정"** (사용자 결정). 디자이너 자가 팀선택 흐름 제거 →
      팀 미배정 디자이너가 「작품 업로드」 진입 시 **"관리자 배정 대기" 안내**(`works.js` renderNoTeamNotice).
- [x] **관리자 사용자 관리 화면 신규** (`#user-admin-page`, `auth.js`) — 가입자 목록(REST `fsQuery('users')`,
      admin 만 전체 read 허용) + 역할·소속팀·기본정보 배정/수정(`fsUpdate`). 검색, 본인 admin 강등 경고.
      **여기서 교수·관리자 역할 부여 + 디자이너 팀 배정**. admin 대시보드 「사용자 관리」 메뉴 연결, `?v=6` 배포.

### 2026-06-09 — Phase 2: 작품 기능 (구현·배포)
- [x] **`js/works.js` 신규** — 팀 상세(`#team-detail-page`)·작품 갤러리(`#works-page`)·작품 상세
      (`#work-detail-page`)·업로드/수정/삭제 폼·디자이너 팀선택. 모든 데이터 REST 헬퍼.
- [x] **`firebase-config.js`** — `storage` 노출(firebase-storage-compat) + **`fsQueryWhere`**(단일필드
      equality 쿼리) 추가. ⚠️ "rules are not filters"·복합인덱스 회피 위해 작품 쿼리는 단일필드만, 정렬은 클라.
- [x] **권한별 쿼리 분기** — 팀 작품: 권한자(admin/professor/소속designer)는 `where teamId==X`,
      그 외는 `where visibility=='public'`+클라 필터(권한거부 시 폴백). 갤러리: admin/professor 전체, 그 외 공개만.
- [x] **Storage 업로드** — `works/{teamId}/{workId}/...` 경로, getDownloadURL. `storage.rules` 신규
      (read 공개, write 로그인+10MB+이미지/PDF). `firebase.json` 에 storage 연결.
- [x] **라우팅·메뉴 연결** — `main.js navigateTo`(team-detail/works/work-detail) + 팀 카드 클릭.
      `auth.js` 대시보드 메뉴 wiring: designer「작품 업로드」→goMyDesignerUpload, professor「작품 열람」/
      engineer「작품 둘러보기」→openWorksGallery. 메뉴 `onclick` 지원 추가.
- [x] **배포(hosting, `?v=5`)** — works.js 포함 7파일 라이브.
- [x] ⚠️ **Storage 미활성** — `firebase deploy --only storage` 가 "Storage not set up" 으로 실패.
      사용자가 콘솔에서 Get Started 후 재배포 필요(재개 지점 참고). 그전까지 첨부 업로드 불가(텍스트 작품은 가능).

---

## 👤 사용자 역할 체계 (핵심 설계 — SYSTEM_DESIGN.md 3·5·9장 기준)

회원가입 시 **역할(Role)을 선택**해 가입하며, 역할에 따라 접근 페이지·권한이 달라진다.

| 역할 | 영문 키 | 핵심 권한 |
|---|---|---|
| 관리자 | `admin` | 모든 권한 · 사용자/팀 관리 · 지원기간·정원 설정 |
| 교수 | `professor` | 담당팀 지정 · 모든 작품 열람 · 피드백 작성(공개/비공개) · 지원자 명단 |
| 디자인 학생 | `designer` | 소속팀 작품 업로드/수정 · 팀 전용 글 · 피드백 확인 · 지원자 명단 |
| 공학 학생 | `engineer` | 공개 작품 열람 · 희망팀 지원(순위) · 본인 지원/배정 현황 |

> **가입 → 팀원 등록 흐름:** ① designer 역할로 회원가입(가입 시 `teamId=null`). ② **관리자**가 「사용자 관리」 화면에서 그 계정에 소속 팀(`teamId`)을 배정. ③ 배정되면 그 디자이너는 본인 팀 상세에서 작품 업로드 가능. (교수·관리자 역할도 「사용자 관리」에서 부여.) ⚠️ `teams.members`(명단 이름)와 `users` 계정은 별개 — 자동 연결 안 됨.

**`users/{userId}` 스키마:** `{ email, name, role, university, department, studentId, teamId|null, advisingTeamIds:[] (교수 지도팀), createdAt }`
(전체 스키마·보안규칙은 SYSTEM_DESIGN.md 5·9장. ✅ **역할 기반 `firestore.rules` 배포 완료** — teams read 공개·write admin, users 역할상승 방지. 옛 "2028까지 전체 open" 임시규칙은 교체됨.)

---

## 🗺️ 로드맵 (우선순위)

> 단계 = 위에서부터 진행. 각 항목 착수 시 메모, 완료 시 `- [x]`.
> ❌ 제외(사용자 결정): 출석/체크인 기능.
> ⏸ 보류(사용자 결정): 일정표 **실제 내용**은 추후 사용자가 자료 제공 후 채움(구조만 미리 준비 가능).

### Phase 1 — 인증 & 역할 기반 가입 (완료 ✅, 2026-06-08)
SYSTEM_DESIGN 10장 Phase 1. 모든 후속 기능의 토대 + 보안 공백 해소.

- [x] **Firebase Authentication 활성화** — 이메일/비밀번호 + Google + Microsoft (사용자가 콘솔에서 활성화)
- [x] **회원가입** — 이메일·비번·이름·**역할 선택**·대학·학과 → Auth 계정 + `users/{uid}` 생성 (`js/auth.js`)
- [x] **로그인 / 로그아웃** — 이메일·Google·Microsoft, 우상단 인증 상태바, 로그인 유지
- [x] **소셜 로그인 프로필 보완** — 최초 소셜 로그인 시 역할/소속 입력 단계로 유도
- [x] **인증·역할 모듈** `js/auth.js` — 상태감지, 역할 헬퍼, auth/dashboard 페이지 렌더
- [x] **역할별 대시보드** — role(admin/professor/designer/engineer)별 메뉴 분기(현재 일부 "준비 중" 플레이스홀더)
- [x] **Firestore 보안 규칙** — `firestore.rules` 작성·배포(→ `database1`). teams read 공개·write admin, users 역할상승 방지, works/feedbacks/applications 골격
- [x] **관리자 부트스트랩** — 첫 admin 콘솔에서 `users/{uid}.role`=`admin` 수동 변경 완료(2026-06-08)
- [x] **관리자: 팀 관리 화면** — 팀 CRUD를 admin 대시보드 「팀 관리」 화면에서 (REST). 추가/수정/삭제 검증 완료
- [x] **관리자: 사용자 관리 화면** (2026-06-09) — admin 대시보드 「사용자 관리」에서 가입자 역할·소속팀 배정/수정. `#user-admin-page`, `auth.js`(renderUserAdmin/saveUserAdmin). **팀 소속은 관리자가 배정하는 정책** 확정.

> ⚠️ **DB 주의:** 이 프로젝트 Firestore 는 표준 `(default)`가 아니라 **named DB `database1`(Enterprise, Blaze 필요)**.
> 앱(`firebase-config.js`의 `FIRESTORE_DB_ID`)·규칙(`firebase.json`의 `firestore.database`) 모두 `database1` 고정.
> ⚠️ **Enterprise 에디션 + 이 네트워크에선 웹 SDK 데이터 호출이 ~30초** → **REST 헬퍼**(`fsGet/fsSet/fsUpdate/fsDelete/fsQuery`)**로만 데이터 접근**. SDK는 인증/세션 전용.
> `seedTeams()`(REST)는 규칙상 **admin 로그인 상태에서만** 동작(쓰기 admin 전용).

### Phase 2 — 디자인팀 작품 기능 (완료 ✅, 2026-06-09 — 업로드·PDF 인라인 라이브 확인)
SYSTEM_DESIGN 10장 Phase 2 / 5.3 Works 스키마. 구현: `js/works.js`(신규).

- [x] **팀 상세 페이지** — 팀 보드 카드 클릭 → 팀 소개 + 그 팀 작품 목록(`#team-detail-page`)
- [x] **작품 업로드** (designer) — 제목·설명·본문·첨부(이미지/PDF, Firebase Storage). 팀 미배정 시 "관리자 배정 대기" 안내(팀 소속은 관리자가 배정)
- [x] **작품 수정/삭제** — admin 또는 소속팀 designer
- [x] **공개 범위 설정** — `public`(전체공개) / `team_only`(팀전용). ⏸ `professor_only` 는 쿼리 단순화 위해 후순위 보류
- [x] **작품 목록/상세** (`works`, `works/{id}`) — 작품 상세(`#work-detail-page`) + 공개 작품 갤러리(`#works-page`, 교수·관리자는 전체). **PDF 첨부는 페이지 내 iframe 인라인 표시**, 이미지 인라인
- [x] **Firebase Storage 활성화 + `storage.rules` 배포** — 완료(사용자). 업로드 라이브 확인됨
- [ ] (라이브에서 확인) **공개범위 가시성** — `team_only` 가 비소속/공학생/비로그인에 안 보이는지, 디자이너 본인 팀 team_only 쿼리 폴백 여부(재개 지점 리스크 참고)
- [ ] (후속, 필요 시) `professor_only` 공개범위 + 디자이너 team_only 쿼리 보강(복합인덱스), Storage 규칙 세분화(현재 로그인 사용자면 write 가능)

### Phase 3 — 피드백 시스템 (완료 ✅, 2026-06-09)
SYSTEM_DESIGN 10장 Phase 3 / 5.4. 구현: `js/feedback.js`(신규).

- [x] **피드백 작성 UI** — 작품 상세 페이지 하단 피드백 섹션. **모든 교수 + 관리자** 작성(담당팀 제한 없음), 공개범위 `public`(전체 공개)/`team_only`(팀원만 보기) 선택. "팀원만 보기" 작품에도 피드백 가능
- [x] **피드백 열람 권한** — works 와 동일 구조: public 은 누구나, team_only 는 해당 작품 팀 디자이너+교수+관리자. 권한별 단일필드 쿼리+폴백. 작성자(교수)·본인 삭제, 관리자 전체 삭제
- [x] **교수 지도 팀 설정** — 「사용자 관리」에서 교수 역할 선택 시 **지도 팀 다중 선택**(`advisingTeamIds[]`). 교수 대시보드에 「내 지도 팀」 바로가기 표시. (피드백은 지도팀과 무관하게 전 작품 가능)
- [ ] **(선택) 알림** — 피드백 등록 시 표시 (미구현, 후순위)

### Phase 4 — 공학생 지원 시스템 (완료 ✅, 2026-06-09 — 선착순 즉시 배정)
SYSTEM_DESIGN 10장 Phase 4 / 5.5 Applications · 6.4. 구현: `js/apply.js`(신규). 배정방식=**선착순 즉시 배정**(사용자 결정).

- [x] **지원 페이지** (`#apply-page`) — 공학생이 팀 카드에서 직접 **신청** → 팀별 정원/현재 인원(예: 2/3)·**마감** 표시. 1인 1지원(문서ID=uid), **변경**(다른 팀)·**취소** 가능
- [x] **선착순 즉시 배정** — 정원(팀 `capacity`, 기본 3) 남으면 즉시 `status:'assigned'` 배정, 차면 마감. **팀 관리 화면에 「공학생 정원」 입력 추가**
- [x] **본인 지원/배정 현황** — 지원 페이지 상단에 현재 배정 팀 표시(없으면 안내)
- [x] **지원자 명단** (`#applicants-page`) — 관리자/교수=전체 팀별 배정 현황, **관리자는 배정 취소(삭제)**, 디자이너=우리 팀 지원 공학생만. 대시보드 메뉴(공학생 팀지원/지원현황, admin 지원현황, professor/designer 지원자명단) 연결
- [ ] ⚠️ **동시성 한계(문서화)** — REST라 트랜잭션 잠금 없음. 신청 직전 정원 재확인 + 관리자 조정으로 커버. 동시 클릭으로 정원 초과 시 관리자가 「지원 현황」에서 배정 취소. 대규모 동시신청 예상 시 트랜잭션/슬롯 클레임으로 보강 필요

### Phase 5 — 마감 품질 & 고도화
- [ ] **배포 완성도** — favicon, `<title>`/OG 메타(공유 미리보기), 404 페이지
- [ ] **모바일 반응형 점검**
- [ ] **공지사항/배너** (관리자)
- [ ] **Google Analytics 수집 검증** (`measurementId` 이미 존재)
- [ ] ⏸ **일정표 내용 채우기 + 데이터화** — *사용자 자료 제공 후 착수* (Firestore `schedules` 컬렉션화 고려)
- [ ] **다국어(국문/영문)** (선택)

---

## 🔧 운영 메모 (자주 쓰는 명령)

```bash
# 로컬 미리보기
npx serve .            # http://localhost:3000

# 재배포 (코드 수정 후) — JS 고쳤으면 index.html 의 ?v=N 도 함께 올릴 것
firebase deploy --only hosting

# 보안규칙 수정 후
firebase deploy --only firestore:rules

# Storage 보안규칙 배포 (※ 콘솔에서 Storage 'Get Started' 먼저 해야 성공)
firebase deploy --only storage

# Firestore 팀 데이터 갱신 (teams-data.js 수정 후)
# → 라이브 사이트에 admin 으로 로그인한 상태에서 콘솔(F12):
seedTeams()
```

**주의사항**
- Firebase SDK는 **compat**으로 통일(modular import 섞지 말 것). 화면은 `main.js`의 `teams` 배열 사용(`teamsData`는 폴백).
- ⚠️ **데이터는 REST 헬퍼로만** (`fsGet/fsSet/fsUpdate/fsDelete/fsQuery`). SDK `.get()/.set()` 금지(이 네트워크에서 ~30초).
- ⚠️ **JS 수정 시 `index.html` 의 `?v=N` 증가**(현재 v20) — 캐시버스팅. HTML 자체는 no-cache 헤더라 즉시 반영됨.
- **앱 전역 설정 = `settings/app`** 문서: `{ rosterPublic, applyStart, applyEnd }`. 읽기 공개·쓰기 admin. **수정은 `fsUpdate`로** (필드 보존). apply.js `loadAppSettings()` 가 로드.
- **페이지 컨테이너 너비 통일**(2026-06-09): 보드/그리드/대시보드/관리 화면 = `max-w-7xl ... lg:py-20`(랜딩과 동일), 단일 작품 상세 = `max-w-5xl`, 로그인 카드·안내 메시지만 좁게(`max-w-md`). 작품 카드 그리드는 `xl:grid-cols-4`.
- ⚠️ **작품 쿼리는 단일필드 equality(`fsQueryWhere`)만** — 복합인덱스·규칙거부 회피. 정렬은 클라(`sortWorks`). 작품 첨부는 Storage SDK 그대로(빠름).
- ⚠️ **`index.html` 한글 인코딩** — PowerShell `Get-Content -Raw | Set-Content` 로 치환 금지(UTF-8 깨짐). 에디터/Edit 로만 수정.
