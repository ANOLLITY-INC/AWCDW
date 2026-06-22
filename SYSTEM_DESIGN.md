# AWCDW 웹사이트 시스템 설계 문서

---

## 📌 진행 현황 & 다음 작업 (Handoff / 재개용)

> **최종 업데이트: 2026-06-05**
> 이 섹션만 보면 어디까지 했고 다음에 뭘 해야 하는지 바로 파악 가능합니다.
> (대화 기록을 비운 뒤 재개할 때 여기부터 읽으세요.)

### ✅ 지금까지 완료한 것

1. **기술 스택 결정 완료** → **HTML + Firebase (Vanilla JS)** 채택
   - React 미사용. 근거는 12.3 "최종 의사결정" 참고.
   - Firebase SDK는 **Compat 방식** 선택 (기존 `onclick` 인라인 핸들러를 그대로 살리기 위함).

2. **단일 HTML → 멀티파일 분리 완료** (15장 1~2단계)
   - 원본 `AWCDW_26.06.02.html` 은 **보존**(수정 안 함).
   - `index.html` (배포 진입점) + `js/` 폴더로 코드 분리.

3. **Firestore 연동 골격 완료** (15장 3단계 — 코드만, 설정 대기 중)
   - `js/firebase-config.js` 생성 (설정값 자리는 `PASTE_...` placeholder).
   - `js/main.js` 가 Firestore `teams` 컬렉션에서 팀을 읽도록 수정 (`loadTeams()`).
   - **폴백 안전장치:** 설정 전이면 자동으로 로컬 `teams-data.js` 사용 → 사이트 안 깨짐.
   - **시드 함수** `seedTeams()` 추가 (로컬 데이터를 Firestore로 1회 업로드).

### 📁 현재 파일 구조

```
AWCDW_website/
├── AWCDW_26.06.02.html   # 원본 (보존, 건드리지 말 것)
├── index.html            # ★ 배포 진입점 (화면 HTML/CSS)
├── SYSTEM_DESIGN.md      # 이 문서
└── js/
    ├── firebase-config.js  # Firebase 초기화 (⚠️ 설정값 PASTE_ 교체 필요)
    ├── teams-data.js       # 로컬 팀 데이터 (폴백 + 시드 원본)
    └── main.js             # 화면 로직 + Firestore 로드/시드
```

스크립트 로드 순서 (index.html 하단): `firebase-app-compat` → `firebase-firestore-compat` → `firebase-config.js` → `teams-data.js` → `main.js` (이 순서 반드시 유지).

### ⏭️ 다음에 바로 할 일 (3단계 마무리)

> **이 작업을 끝내면 "코드 수정 없이 데이터를 바꿀 수 있는 사이트"가 됩니다.**

- [ ] **1. Firebase 프로젝트 생성** — https://console.firebase.google.com → 프로젝트 추가
- [ ] **2. Firestore 생성** — 빌드 > Firestore Database > 데이터베이스 만들기 > **"테스트 모드"**
- [ ] **3. 설정값 입력** — 프로젝트 설정(⚙️) > 일반 > 내 앱 > 웹앱(`</>`) 에서
      `firebaseConfig` 복사 → `js/firebase-config.js` 의 `PASTE_...` 6곳 교체
- [ ] **4. 로컬 서버로 열기** — `npx serve .` (⚠️ 파일 더블클릭 `file://` 금지)
- [ ] **5. 초기 데이터 업로드** — 브라우저 F12 콘솔에 `seedTeams()` 입력 → Enter → 새로고침
- [ ] **6. 확인** — Firestore Console에 `teams` 컬렉션 A~H 문서 생성 + 콘솔에 `[Firestore] 팀 8개 로드 완료` 출력

### 🗺️ 그 이후 로드맵 (우선순위 순)

3단계 완료 후 진행할 큰 단위들. 상세 설계는 본문 해당 장 참고.

| 순서 | 작업 | 참고 장 | 핵심 포인트 |
|------|------|---------|-------------|
| 4 | **첫 배포** | 12.7, 14장 | `firebase init` → `firebase deploy` 로 인터넷 공개 |
| 5 | **사용자 인증(로그인)** | 12.6, 3장 | Authentication 이메일/비번. ⚠️ 로그인 페이지는 modular SDK 예시(12.5)와 compat이 섞이지 않게 통일할 것 |
| 6 | **역할(Role) 시스템** | 3장, 5.1 | users 컬렉션 + admin/professor/designer/engineer |
| 7 | **작품 업로드** | 6.1, 5.3 | Firebase Storage + works 컬렉션 |
| 8 | **교수 피드백** | 6.2, 5.4 | feedbacks 컬렉션, 공개범위 |
| 9 | **공학생 지원/선착순** | 6.4, 5.5 | 트랜잭션으로 정원 처리 |
| 10 | **Firestore 보안 규칙 적용** | 9장 | ⚠️ 테스트 모드 30일 만료 전 필수. 역할 기반 규칙으로 교체 |

### ⚠️ 재개 시 꼭 기억할 사실 (함정 주의)

- **SDK 방식은 Compat으로 통일됨.** 본문 12.5의 modular `import` 예시 코드를 그대로 쓰면 현재 구조와 충돌함. 새 페이지도 compat(`firebase.xxx()`)으로 작성하거나, 전환 시 onclick→addEventListener 처리 필요.
- **`teamsData` 는 이제 화면이 직접 안 씀.** 화면은 `main.js` 의 `teams` 배열을 사용. `teams-data.js` 는 폴백/시드 원본 역할만.
- **테스트 모드 Firestore는 30일 후 잠김.** 그 전에 9장 보안 규칙 적용 필요 (위 로드맵 10번).
- **`firebaseConfig` 값은 비밀이 아님**(공개 식별자). 단, 공개 git 저장소 운영 시엔 별도 안내 받을 것.

---

## 0. 핵심 질문: Firebase 호스팅에 어떤 언어를 써야 하는가?

> **결론부터: HTML로 호스팅 가능합니다. 새로운 언어(React 등)를 배울 필요 없습니다.**
> 단, "기능"(로그인·업로드·피드백 등)을 넣으려면 **JavaScript가 추가로 필요**합니다.

### 0.1 가장 많이 헷갈리는 개념 정리

Firebase Hosting은 **"정적 파일을 인터넷에 올려주는 서비스"**일 뿐입니다.
PHP·Python·Java 같은 **서버 언어를 요구하지 않습니다.** 지금 가지고 있는
`AWCDW_26.06.02.html` 파일을 `index.html`로 이름만 바꿔 올리면 그대로 웹사이트가 됩니다.

### 0.2 언어별 역할 (이게 핵심)

| 구분 | 언어 | 역할 | 현재 상태 |
|------|------|------|-----------|
| 화면 구조 | **HTML** | 글자·버튼·레이아웃을 "보여줌" | ✅ 사용 중 |
| 디자인 | **CSS (Tailwind)** | 색·여백·폰트 "꾸밈" | ✅ 사용 중 (CDN) |
| 동작/로직 | **JavaScript** | 버튼 클릭 시 데이터 저장·불러오기 등 "동작" | ⚠️ 기능 추가 시 필수 |

**비유:** HTML은 건물의 골조와 방, CSS는 인테리어, JavaScript는 전기·수도 같은 "작동하는 설비"입니다.
지금 사이트는 "보여주기"만 하므로 HTML+CSS로 충분하지만,
로그인·작품 업로드처럼 "작동"이 필요한 순간 JavaScript가 들어와야 합니다.

### 0.3 그래서 최종 권장 조합

```
HTML (화면)  +  JavaScript (Firebase 연동)  +  Tailwind CSS (디자인)
            = "Vanilla JS" 방식 (13장 결론과 동일)
```

- **React / Vue / Next.js 는 필수가 아닙니다.** 향후 대규모 확장 시에만 고려.
- 현재 HTML에 `<script type="module">` 태그로 JavaScript와 Firebase SDK를 붙이는 방식이
  학습 비용이 가장 낮고 기존 코드를 그대로 재활용할 수 있어 권장됩니다.

### 0.4 반드시 알아야 할 주의점 ⚠️

Firebase 기능을 쓰는 JavaScript는 **파일을 더블클릭(`file://`)으로 열면 작동하지 않습니다.**
브라우저 보안 정책(CORS, ES 모듈 제한) 때문입니다.
반드시 **로컬 웹 서버(`firebase serve`)나 배포(`firebase deploy`)를 통해** 열어야 합니다.
(자세한 방법은 12.8 참고)

---

## 1. 현재 구조 분석

### 현재 페이지 구성
```
AWCDW_26.06.02.html
├── Landing Page (메인)
│   ├── 워크숍 타임라인 (8단계)
│   ├── 외부 링크 (mnm.ac.kr)
│   └── 내부 네비게이션
├── Schedule Online Page (온라인 사전워크숍 일정)
├── Schedule Busan Page (1차 워크숍 부산대 일정)
└── Teams Page (디자인팀 배정 현황)
```

### 현재 한계점
- 정적 HTML 파일 (데이터 하드코딩)
- 사용자 인증 없음
- 데이터 저장/수정 불가능
- 실시간 업데이트 불가

---

## 2. 요구 기능 정리

| 번호 | 기능 | 대상 사용자 | 우선순위 |
|------|------|------------|---------|
| F1 | 디자인팀 작품 업로드 | 디자인 학생 | 높음 |
| F2 | 교수님 피드백 작성 | 교수 | 높음 |
| F3 | 비공개 글 (팀 전용) | 디자인 학생, 교수 | 중간 |
| F4 | 공학생 디자인팀 지원 | 공학 학생 | 높음 |
| F5 | 선착순 3명 마감 | 시스템 자동 | 높음 |

---

## 3. 사용자 역할 (Role) 정의

```
┌─────────────────────────────────────────────────────────┐
│                    USER ROLES                           │
├─────────────┬─────────────┬─────────────┬──────────────┤
│   관리자    │    교수     │ 디자인 학생 │  공학 학생   │
│   (Admin)   │ (Professor) │  (Designer) │ (Engineer)   │
├─────────────┼─────────────┼─────────────┼──────────────┤
│ 모든 권한   │ 피드백 작성 │ 작품 업로드 │ 팀 지원      │
│ 사용자 관리 │ 모든 글 열람│ 팀 글 관리  │ 지원현황 확인│
│ 팀 배정     │ 지원자 확인 │ 피드백 확인 │              │
└─────────────┴─────────────┴─────────────┴──────────────┘
```

### 3.1 역할별 권한 상세

#### 관리자 (Admin)
- 모든 사용자 계정 생성/관리
- 디자인팀 생성 및 학생 배정
- 지원 기간 설정 (시작/마감일)
- 팀별 정원 설정 (기본 3명)
- 모든 데이터 열람/수정

#### 교수 (Professor)
- 담당 디자인팀 지정
- 모든 디자인팀 작품 열람
- 피드백 작성 (공개/비공개 선택)
- 지원자 명단 열람

#### 디자인 학생 (Designer)
- 소속팀 작품 업로드/수정
- 팀 전용 글 작성 (다른 팀 비공개)
- 교수님 피드백 확인
- 공학생 지원자 명단 확인

#### 공학 학생 (Engineer)
- 디자인팀 작품 열람 (공개된 것만)
- 희망 팀 지원 (순위 선택)
- 본인 지원 현황 확인
- 배정 결과 확인

---

## 4. 시스템 아키텍처

### 4.1 권장 기술 스택

```
┌────────────────────────────────────────────────────────┐
│                    FRONTEND                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │  HTML/CSS/JavaScript (현재) → React/Vue 권장     │  │
│  │  Tailwind CSS (현재 사용 중)                     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                    BACKEND                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Option A: Firebase (빠른 구현, 서버리스)        │  │
│  │  Option B: Node.js + Express (유연성)            │  │
│  │  Option C: Supabase (오픈소스, PostgreSQL)       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│                    DATABASE                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Firebase Firestore / Supabase PostgreSQL        │  │
│  │  파일 저장: Firebase Storage / Supabase Storage  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 4.2 간단한 구현을 위한 권장: Firebase

Firebase를 사용하면 서버 없이 빠르게 구현 가능:
- **Firebase Authentication**: 로그인/회원가입
- **Firebase Firestore**: 데이터베이스
- **Firebase Storage**: 파일(이미지, PDF) 저장
- **Firebase Hosting**: 웹사이트 배포

---

## 5. 데이터베이스 스키마

### 5.1 Users (사용자)
```javascript
users/{userId}
{
  id: string,              // 고유 ID
  email: string,           // 이메일 (로그인용)
  name: string,            // 이름
  role: "admin" | "professor" | "designer" | "engineer",
  university: string,      // 소속 대학
  department: string,      // 학과
  teamId: string | null,   // 소속팀 (디자인학생만)
  createdAt: timestamp
}
```

### 5.2 Teams (디자인팀)
```javascript
teams/{teamId}
{
  id: string,              // A, B, C, ... H
  name: string,            // "A팀", "B팀", ...
  code: string,            // "Team.A", "Team.B", ...
  designers: string[],     // 디자인 학생 userId 배열
  engineers: string[],     // 배정된 공학 학생 userId 배열
  maxEngineers: number,    // 최대 공학생 수 (기본 3)
  professorId: string,     // 담당 교수 userId
  status: "open" | "closed",  // 지원 가능 여부
  createdAt: timestamp
}
```

### 5.3 Works (작품/제출물)
```javascript
works/{workId}
{
  id: string,
  teamId: string,          // 소속 팀
  authorId: string,        // 작성자 userId
  title: string,           // 제목
  description: string,     // 설명
  content: string,         // 본문 (HTML or Markdown)
  attachments: [           // 첨부파일
    {
      name: string,
      url: string,
      type: string         // "image", "pdf", "etc"
    }
  ],
  visibility: "public" | "team_only" | "professor_only",
  phase: "중간제출" | "최종제출",  // 제출 단계
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 5.4 Feedbacks (피드백)
```javascript
feedbacks/{feedbackId}
{
  id: string,
  workId: string,          // 대상 작품
  teamId: string,          // 대상 팀
  authorId: string,        // 작성자 (교수) userId
  content: string,         // 피드백 내용
  visibility: "public" | "team_only",  // 공개 범위
  createdAt: timestamp
}
```

### 5.5 Applications (지원서)
```javascript
applications/{applicationId}
{
  id: string,
  engineerId: string,      // 지원자 (공학생) userId
  preferences: [           // 희망 팀 순위
    { rank: 1, teamId: "A" },
    { rank: 2, teamId: "C" },
    { rank: 3, teamId: "E" }
  ],
  status: "pending" | "assigned" | "rejected",
  assignedTeamId: string | null,  // 배정된 팀
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## 6. 핵심 기능 상세 설계

### 6.1 F1: 디자인팀 작품 업로드

```
┌─────────────────────────────────────────────────────────┐
│                  작품 업로드 Flow                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 디자인 학생 로그인                                   │
│           │                                             │
│           ▼                                             │
│  2. 본인 팀 페이지 접근                                  │
│           │                                             │
│           ▼                                             │
│  3. "새 작품 등록" 버튼 클릭                             │
│           │                                             │
│           ▼                                             │
│  4. 작품 정보 입력                                       │
│     ├─ 제목                                             │
│     ├─ 설명 및 본문                                      │
│     ├─ 이미지/파일 첨부                                  │
│     └─ 공개 범위 선택                                    │
│           │                                             │
│           ▼                                             │
│  5. Firebase Storage에 파일 업로드                       │
│           │                                             │
│           ▼                                             │
│  6. Firestore에 작품 데이터 저장                         │
│           │                                             │
│           ▼                                             │
│  7. 팀 페이지에 작품 표시                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 공개 범위 옵션
| 옵션 | 볼 수 있는 사람 |
|------|----------------|
| `public` | 모든 로그인 사용자 |
| `team_only` | 해당 팀 디자인학생 + 담당 교수 |
| `professor_only` | 담당 교수만 |

### 6.2 F2: 교수님 피드백 작성

```javascript
// 피드백 작성 권한 체크
function canWriteFeedback(user, work) {
  if (user.role !== 'professor') return false;

  // 모든 교수는 모든 작품에 피드백 가능
  // 또는 담당 팀만 가능하도록 제한할 수 있음
  return true;
}

// 피드백 작성
async function submitFeedback(userId, workId, content, visibility) {
  const work = await getWork(workId);

  await addDoc(collection(db, 'feedbacks'), {
    workId: workId,
    teamId: work.teamId,
    authorId: userId,
    content: content,
    visibility: visibility,  // 'public' or 'team_only'
    createdAt: serverTimestamp()
  });
}
```

### 6.3 F3: 비공개 글 (팀 전용)

```javascript
// 작품 열람 권한 체크
function canViewWork(user, work) {
  // 관리자는 모두 볼 수 있음
  if (user.role === 'admin') return true;

  // 교수는 모두 볼 수 있음
  if (user.role === 'professor') return true;

  // 공개 글은 모두 볼 수 있음
  if (work.visibility === 'public') return true;

  // 팀 전용 글은 해당 팀원만
  if (work.visibility === 'team_only') {
    return user.teamId === work.teamId;
  }

  // 교수 전용 글은 교수만
  if (work.visibility === 'professor_only') {
    return user.role === 'professor';
  }

  return false;
}
```

### 6.4 F4 & F5: 공학생 팀 지원 및 선착순 마감

```
┌─────────────────────────────────────────────────────────┐
│                   팀 지원 Flow                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 공학 학생 로그인                                     │
│           │                                             │
│           ▼                                             │
│  2. 디자인팀 목록 확인                                   │
│     (각 팀별 작품, 현재 지원자 수 표시)                   │
│           │                                             │
│           ▼                                             │
│  3. 희망 팀 순위 선택 (1순위, 2순위, 3순위)              │
│           │                                             │
│           ▼                                             │
│  4. 지원서 제출                                          │
│           │                                             │
│           ▼                                             │
│  5. 시스템이 선착순 처리                                 │
│     ├─ 1순위 팀에 자리 있음 → 배정                       │
│     ├─ 1순위 마감 → 2순위 확인                           │
│     └─ 모두 마감 → 대기 상태                             │
│           │                                             │
│           ▼                                             │
│  6. 결과 알림                                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 선착순 로직
```javascript
async function applyToTeam(engineerId, preferences) {
  // 트랜잭션으로 동시성 처리
  return await runTransaction(db, async (transaction) => {

    for (const pref of preferences) {
      const teamRef = doc(db, 'teams', pref.teamId);
      const teamDoc = await transaction.get(teamRef);
      const team = teamDoc.data();

      // 팀 정원 체크
      if (team.engineers.length < team.maxEngineers) {
        // 자리 있음 → 배정
        transaction.update(teamRef, {
          engineers: arrayUnion(engineerId)
        });

        // 지원서 상태 업데이트
        const appRef = doc(collection(db, 'applications'));
        transaction.set(appRef, {
          engineerId: engineerId,
          preferences: preferences,
          status: 'assigned',
          assignedTeamId: pref.teamId,
          createdAt: serverTimestamp()
        });

        return { success: true, assignedTeam: pref.teamId };
      }
    }

    // 모든 희망팀 마감
    const appRef = doc(collection(db, 'applications'));
    transaction.set(appRef, {
      engineerId: engineerId,
      preferences: preferences,
      status: 'pending',
      assignedTeamId: null,
      createdAt: serverTimestamp()
    });

    return { success: false, message: '희망 팀이 모두 마감되었습니다.' };
  });
}
```

---

## 7. 페이지 구조 (확장)

```
AWCDW Website
│
├── / (Landing Page) - 현재 유지
│
├── /login - 로그인 페이지
│
├── /dashboard - 역할별 대시보드
│   ├── Admin Dashboard
│   ├── Professor Dashboard
│   ├── Designer Dashboard
│   └── Engineer Dashboard
│
├── /teams - 팀 목록 (현재 유지 + 확장)
│   └── /teams/{teamId} - 개별 팀 상세
│       ├── 팀 소개
│       ├── 작품 목록
│       ├── 피드백 목록
│       └── 지원자 현황 (디자이너/교수만)
│
├── /works - 전체 작품 목록
│   └── /works/{workId} - 작품 상세
│       ├── 작품 내용
│       ├── 첨부파일
│       └── 피드백
│
├── /apply - 공학생 지원 페이지
│   ├── 팀별 현황 (마감여부 표시)
│   ├── 희망순위 선택
│   └── 지원 결과 확인
│
└── /schedule/* - 일정 페이지들 (현재 유지)
    ├── /schedule/online
    └── /schedule/busan
```

---

## 8. UI 컴포넌트 설계

### 8.1 팀 카드 (확장)
```
┌─────────────────────────────────────┐
│ ■ Team.A                    OPEN    │
│   A팀                               │
├─────────────────────────────────────┤
│                                     │
│  디자이너: 유서연, 김나연            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 최신 작품 미리보기          │    │
│  │ "스마트 수저 컨셉 디자인"    │    │
│  └─────────────────────────────┘    │
│                                     │
│  공학생 현황: 2/3명                  │
│  ████████░░░░ 67%                   │
│                                     │
│  [작품 보기]  [지원하기]            │
│                                     │
└─────────────────────────────────────┘
```

### 8.2 작품 업로드 폼
```
┌─────────────────────────────────────┐
│         새 작품 등록                 │
├─────────────────────────────────────┤
│                                     │
│  제목 *                             │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  설명                               │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  첨부파일                           │
│  ┌─────────────────────────────┐    │
│  │  + 파일 추가 (드래그 앤 드롭)│    │
│  └─────────────────────────────┘    │
│                                     │
│  공개 범위 *                        │
│  ○ 전체 공개                        │
│  ○ 우리 팀만 (+ 교수님)             │
│  ○ 교수님만                         │
│                                     │
│          [취소]  [등록하기]         │
│                                     │
└─────────────────────────────────────┘
```

### 8.3 피드백 카드
```
┌─────────────────────────────────────┐
│  💬 피드백                          │
├─────────────────────────────────────┤
│                                     │
│  ┌─ 김OO 교수님 ───────────────┐    │
│  │                             │    │
│  │  아이디어가 좋습니다. 다만   │    │
│  │  적층제조 방식에서 오버행    │    │
│  │  문제를 고려해주세요.        │    │
│  │                             │    │
│  │  2026.06.12 14:30   🔒팀전용 │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─ 박OO 교수님 ───────────────┐    │
│  │                             │    │
│  │  전체적인 컨셉 방향성은      │    │
│  │  적절합니다. 사용자 시나리오 │    │
│  │  를 더 구체화해보세요.       │    │
│  │                             │    │
│  │  2026.06.12 16:45   🌐공개   │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### 8.4 지원 현황 보드
```
┌───────────────────────────────────────────────────────┐
│              공학생 팀 지원 현황                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────┬─────────┬─────────┬─────────┐           │
│  │  A팀    │  B팀    │  C팀    │  D팀    │           │
│  │  3/3    │  2/3    │  3/3    │  1/3    │           │
│  │  CLOSED │  OPEN   │  CLOSED │  OPEN   │           │
│  └─────────┴─────────┴─────────┴─────────┘           │
│                                                       │
│  ┌─────────┬─────────┬─────────┬─────────┐           │
│  │  E팀    │  F팀    │  G팀    │  H팀    │           │
│  │  2/3    │  0/3    │  3/3    │  1/3    │           │
│  │  OPEN   │  OPEN   │  CLOSED │  OPEN   │           │
│  └─────────┴─────────┴─────────┴─────────┘           │
│                                                       │
│  내 지원 상태: 배정 완료 ✓                            │
│  배정된 팀: B팀                                       │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 9. 보안 규칙 (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 사용자 정보
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId
                   || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // 팀 정보
    match /teams/{teamId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // 작품
    match /works/{workId} {
      allow read: if canViewWork(request.auth.uid, resource.data);
      allow create: if isDesignerOfTeam(request.auth.uid, request.resource.data.teamId);
      allow update, delete: if isDesignerOfTeam(request.auth.uid, resource.data.teamId);
    }

    // 피드백
    match /feedbacks/{feedbackId} {
      allow read: if canViewFeedback(request.auth.uid, resource.data);
      allow create: if isProfessor(request.auth.uid);
      allow update, delete: if request.auth.uid == resource.data.authorId;
    }

    // 지원서
    match /applications/{appId} {
      allow read: if request.auth.uid == resource.data.engineerId
                  || isProfessor(request.auth.uid)
                  || isAdmin(request.auth.uid);
      allow create: if isEngineer(request.auth.uid);
      allow update: if isAdmin(request.auth.uid);
    }
  }
}
```

---

## 10. 구현 우선순위 로드맵

### Phase 1: 인증 및 기본 구조
- [ ] Firebase 프로젝트 설정
- [ ] 로그인/회원가입 페이지
- [ ] 사용자 역할 관리
- [ ] 기본 대시보드

### Phase 2: 디자인팀 기능
- [ ] 팀 상세 페이지
- [ ] 작품 업로드 기능
- [ ] 공개 범위 설정
- [ ] 작품 목록/상세 보기

### Phase 3: 피드백 시스템
- [ ] 피드백 작성 UI
- [ ] 피드백 열람 권한
- [ ] 알림 기능

### Phase 4: 지원 시스템
- [ ] 지원 현황 보드
- [ ] 희망 순위 선택 UI
- [ ] 선착순 배정 로직
- [ ] 실시간 마감 표시

### Phase 5: 고도화
- [ ] 이메일 알림
- [ ] 모바일 최적화
- [ ] 통계 대시보드
- [ ] 데이터 내보내기

---

## 11. 빠른 프로토타입을 위한 대안

### 11.1 Google 생태계 활용 (무료, 빠름)
- **Google Forms**: 작품 제출, 지원서 수집
- **Google Sheets**: 데이터 관리, 실시간 현황
- **Google Sites**: 간단한 웹페이지

### 11.2 노코드 솔루션
- **Notion**: 팀별 페이지, 데이터베이스
- **Airtable**: 지원 관리, 자동화
- **Softr/Glide**: Airtable 기반 웹앱

### 11.3 하이브리드 접근
현재 HTML + Google Sheets API를 연동하여:
1. 작품 제출 → Google Form
2. 데이터 관리 → Google Sheets
3. 현황 표시 → HTML에서 Sheets 데이터 fetch

---

## 12. Firebase 배포를 위한 기술 스택 결정

### 12.1 권장 기술 스택

**Firebase를 사용할 경우 가장 적합한 조합:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED STACK                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   FRONTEND                                                      │
│   ├── Language: JavaScript (또는 TypeScript)                    │
│   ├── Framework: Vanilla JS (현재) → React 권장                 │
│   └── Styling: Tailwind CSS (현재 유지)                         │
│                                                                 │
│   FIREBASE SERVICES                                             │
│   ├── Firebase Authentication (로그인)                          │
│   ├── Cloud Firestore (데이터베이스)                            │
│   ├── Firebase Storage (파일 저장)                              │
│   └── Firebase Hosting (웹사이트 배포)                          │
│                                                                 │
│   OPTIONAL (고급 기능용)                                        │
│   └── Cloud Functions (서버리스 백엔드 로직)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 프레임워크 선택 가이드

| 옵션 | 장점 | 단점 | 추천 상황 |
|------|------|------|----------|
| **Vanilla JS** | 배우기 쉬움, 현재 코드 재활용 | 복잡해지면 관리 어려움 | 빠른 프로토타입 |
| **React** | 컴포넌트 재사용, 생태계 풍부 | 학습 필요 | 장기 운영 계획 |
| **Vue.js** | 쉬운 학습곡선, 한국어 자료 많음 | React보다 작은 생태계 | 중간 규모 프로젝트 |
| **Next.js** | SEO 좋음, 풀스택 | 복잡도 높음 | 대규모 프로젝트 |

### 12.3 현실적인 권장안

**현재 상황 (단일 HTML 파일)에서 Firebase 연동하기:**

```
옵션 A: Vanilla JS + Firebase SDK (가장 빠른 시작)
────────────────────────────────────────────────────
- 현재 HTML 파일에 Firebase SDK 추가
- 기존 코드 최대한 재활용
- 점진적으로 기능 추가
- 개발 시간: 짧음
- 권장: ✓ (당장 시작하기 좋음)

옵션 B: React + Firebase (장기적으로 유리)
────────────────────────────────────────────────────
- 새로운 React 프로젝트 생성
- 현재 디자인을 React 컴포넌트로 변환
- 유지보수, 확장성 좋음
- 개발 시간: 길음
- 권장: 향후 대규모 확장 계획 시
```

#### ✅ 최종 의사결정: HTML + Firebase (Vanilla JS) 채택

**결정일 기준 본 프로젝트는 `HTML + Firebase` 방식으로 진행한다.**

| 판단 근거 | 내용 |
|-----------|------|
| 기존 자산 | 이미 동작하는 단일 HTML(`teamsData`, `navigateTo`, 테마/검색)을 **그대로 재활용** 가능 |
| 규모 | 워크숍 사이트는 페이지 4~10개 수준 → React의 컴포넌트 이점이 비용을 넘지 못함 |
| 학습 비용 | JS 기초만 익히면 됨 (React는 JSX·상태관리·빌드도구까지 동시 학습 필요) |
| 빌드 | 빌드 단계 없이 파일 그대로 `firebase deploy` 가능 |
| 목표 | "기술 학습"이 아니라 "기능을 돌아가게 만드는 것"이 목적 |

**React를 선택해야 하는 경우 (해당 없으면 HTML 유지):**
- 매년 반복되며 장기적으로 크게 확장할 계획이다
- React 경험자가 있는 팀으로 개발한다
- 이미 React를 알아 학습 비용이 0이다

> 🔄 **되돌릴 수 있는 결정:** Firebase 백엔드(인증·Firestore·Storage)는 프론트와 분리되어 있어,
> 나중에 정말 필요해지면 **백엔드는 그대로 두고 프론트만 React로 교체**할 수 있다.
> 데이터 스키마(5장)와 로직 설계는 재활용되므로 "지금 HTML → 필요 시 React"가 손해 없는 전략이다.

### 12.4 Vanilla JS + Firebase 구조 예시

**현재 파일 구조 → 확장된 구조:**

```
AWCDW_website/
│
├── index.html                    # 메인 페이지 (현재 파일 리팩토링)
├── login.html                    # 로그인 페이지
├── dashboard.html                # 대시보드
├── team-detail.html              # 팀 상세 페이지
├── apply.html                    # 지원 페이지
│
├── css/
│   └── styles.css                # Tailwind 빌드 결과 (또는 CDN 유지)
│
├── js/
│   ├── firebase-config.js        # Firebase 초기화
│   ├── auth.js                   # 인증 관련 함수
│   ├── db.js                     # Firestore 함수
│   ├── storage.js                # Storage 함수
│   ├── teams.js                  # 팀 관련 로직
│   ├── works.js                  # 작품 관련 로직
│   ├── applications.js           # 지원 관련 로직
│   └── utils.js                  # 유틸리티 함수
│
├── firebase.json                 # Firebase 설정
├── firestore.rules               # Firestore 보안 규칙
├── storage.rules                 # Storage 보안 규칙
└── .firebaserc                   # Firebase 프로젝트 설정
```

### 12.5 Firebase 초기 설정 코드

**firebase-config.js:**
```javascript
// Firebase SDK 임포트 (모듈 방식)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// Firebase 프로젝트 설정 (Firebase Console에서 복사)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "YOUR_APP_ID"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 서비스 내보내기
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

**auth.js (인증 함수):**
```javascript
import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// 로그인
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 로그아웃
export async function logout() {
  await signOut(auth);
}

// 현재 사용자 정보 + 역할 가져오기
export async function getCurrentUserWithRole() {
  const user = auth.currentUser;
  if (!user) return null;

  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (!userDoc.exists()) return null;

  return {
    ...user,
    ...userDoc.data()
  };
}

// 인증 상태 변화 감지
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userData = await getCurrentUserWithRole();
      callback(userData);
    } else {
      callback(null);
    }
  });
}
```

### 12.6 HTML에서 Firebase 사용 예시

**login.html:**
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>로그인 - AWCDW 2026</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#F8F9FA] min-h-screen flex items-center justify-center">

  <div class="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
    <h1 class="text-2xl font-bold mb-6">AWCDW 로그인</h1>

    <form id="login-form" class="space-y-4">
      <div>
        <label class="block text-sm font-semibold mb-1">이메일</label>
        <input type="email" id="email" required
               class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
      </div>

      <div>
        <label class="block text-sm font-semibold mb-1">비밀번호</label>
        <input type="password" id="password" required
               class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
      </div>

      <button type="submit"
              class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">
        로그인
      </button>

      <p id="error-message" class="text-red-500 text-sm hidden"></p>
    </form>
  </div>

  <script type="module">
    import { login, onAuthChange } from './js/auth.js';

    // 이미 로그인되어 있으면 대시보드로 이동
    onAuthChange((user) => {
      if (user) {
        // 역할에 따라 다른 페이지로 이동
        switch(user.role) {
          case 'admin':
            window.location.href = '/admin-dashboard.html';
            break;
          case 'professor':
            window.location.href = '/professor-dashboard.html';
            break;
          case 'designer':
            window.location.href = '/designer-dashboard.html';
            break;
          case 'engineer':
            window.location.href = '/engineer-dashboard.html';
            break;
          default:
            window.location.href = '/index.html';
        }
      }
    });

    // 로그인 폼 처리
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('error-message');

      const result = await login(email, password);

      if (!result.success) {
        errorEl.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
        errorEl.classList.remove('hidden');
      }
      // 성공 시 onAuthChange에서 자동 리다이렉트
    });
  </script>

</body>
</html>
```

### 12.7 Firebase 배포 명령어

```bash
# 1. Firebase CLI 설치 (Node.js 필요)
npm install -g firebase-tools

# 2. Firebase 로그인
firebase login

# 3. 프로젝트 초기화
firebase init

# 선택 항목:
# - Firestore
# - Hosting
# - Storage

# 4. 배포
firebase deploy

# 또는 개별 배포
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

### 12.8 로컬에서 테스트하는 방법 (배포 전 확인)

> ⚠️ **중요:** `index.html`을 파일 탐색기에서 더블클릭해서 열면(`file://...`)
> Firebase 로그인·DB 같은 기능이 **작동하지 않습니다.** 반드시 아래처럼 로컬 서버로 띄워야 합니다.

**방법 A: Firebase 내장 서버 (가장 권장)**
```bash
# 프로젝트 폴더에서 실행 → http://localhost:5000 으로 열림
firebase serve

# Firestore/Storage 까지 가짜로 띄워 완전 로컬 테스트 (인터넷/요금 없이)
firebase emulators:start
```

**방법 B: 간단한 정적 서버 (Firebase 기능 테스트가 아직 필요 없을 때)**
```bash
# Node.js가 있으면
npx serve .

# 또는 Python이 있으면
python -m http.server 8000
# → http://localhost:8000 접속
```

**방법 C: VS Code 사용 시**
- 확장 프로그램 **"Live Server"** 설치 → HTML 파일 우클릭 → "Open with Live Server"
- 가장 손쉽게 화면 미리보기 가능 (단, Firebase 실제 연동 테스트는 방법 A 권장)

| 상황 | 권장 방법 |
|------|-----------|
| 화면/디자인만 확인 | 방법 C (Live Server) |
| Firebase 로그인·DB 동작 확인 | 방법 A (`firebase serve`) |
| 요금 없이 DB까지 통째로 테스트 | 방법 A (`firebase emulators:start`) |
| 실제 사용자에게 공개 | `firebase deploy` |

---

## 13. 결론

### 최종 권장 기술 스택 (Firebase 배포 기준)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  📦 FRONTEND                                                │
│     └── Vanilla JavaScript + HTML + Tailwind CSS           │
│         (현재 코드 확장, 학습 비용 최소화)                   │
│                                                             │
│  🔥 FIREBASE                                                │
│     ├── Authentication (이메일/비밀번호 로그인)             │
│     ├── Firestore (NoSQL 데이터베이스)                      │
│     ├── Storage (이미지/파일 저장)                          │
│     └── Hosting (정적 웹사이트 배포)                        │
│                                                             │
│  📝 LANGUAGE                                                │
│     └── JavaScript (ES6+)                                   │
│         - 브라우저 네이티브                                 │
│         - Firebase SDK 공식 지원                            │
│         - 현재 코드와 호환                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 다음 단계

1. **Firebase 콘솔에서 프로젝트 생성**
   - https://console.firebase.google.com

2. **Authentication 활성화**
   - 이메일/비밀번호 로그인 활성화

3. **Firestore 데이터베이스 생성**
   - 테스트 모드로 시작 → 나중에 보안 규칙 적용

4. **현재 HTML 파일을 index.html로 리팩토링**
   - Firebase SDK 추가
   - 로그인 기능 연동

5. **점진적 기능 추가**
   - 작품 업로드 → 피드백 → 지원 시스템 순서로

---

가장 중요한 것은 **사용자 인증(로그인)**과 **데이터 저장소**입니다.
이 두 가지만 구현되면 나머지 기능은 점진적으로 추가할 수 있습니다.

**Firebase를 사용하면 별도 서버 구축 없이 모든 기능을 구현할 수 있습니다.**

---

## 14. 초보자용 단계별 시작 가이드 (체크리스트)

> 코딩/Firebase가 처음이어도 위에서부터 순서대로 따라 하면 첫 배포까지 도달할 수 있습니다.
> 각 항목은 **클릭/명령어 단위**로 쪼개 두었습니다.

### STEP 0. 사전 준비 (1회만)
- [ ] **Node.js 설치** — https://nodejs.org 에서 LTS 버전 다운로드 후 설치
  (Firebase CLI를 쓰려면 필요. 설치 확인: 터미널에 `node -v` 입력 시 버전이 나오면 성공)
- [ ] **구글 계정** 준비 (Firebase는 구글 계정으로 로그인)

### STEP 1. Firebase 프로젝트 만들기 (웹 브라우저)
- [ ] https://console.firebase.google.com 접속 → **"프로젝트 추가"**
- [ ] 프로젝트 이름 입력 (예: `awcdw-2026`) → 생성
- [ ] 좌측 메뉴에서 **빌드 > Authentication > 시작하기** → "이메일/비밀번호" 활성화
- [ ] **빌드 > Firestore Database > 데이터베이스 만들기** → **"테스트 모드"**로 시작
  (테스트 모드는 30일간 누구나 읽기/쓰기 가능 → 개발 끝나면 9장 보안 규칙 적용)
- [ ] **프로젝트 설정(⚙️) > 일반 > 내 앱 > 웹앱(`</>`) 추가** →
  화면에 나오는 `firebaseConfig` 코드(apiKey 등)를 **복사해서 메모장에 보관**

### STEP 2. 내 컴퓨터에 Firebase 도구 설치 (터미널)
```bash
npm install -g firebase-tools   # Firebase CLI 설치
firebase login                  # 브라우저가 열리며 구글 로그인
```

### STEP 3. 프로젝트 폴더 연결
- [ ] `AWCDW_website` 폴더에서 터미널 열기
```bash
firebase init
```
- [ ] 화살표/스페이스바로 **Hosting**, **Firestore** 선택 (스페이스로 체크, 엔터로 확정)
- [ ] "Use an existing project" → STEP 1에서 만든 프로젝트 선택
- [ ] "What do you want to use as your public directory?" → **`.` (현재 폴더)** 또는 `public` 입력
- [ ] "Configure as a single-page app?" → 지금 구조상 **Yes** 권장 (한 파일에서 페이지 전환하므로)
- [ ] 기존 `index.html`을 덮어쓸지 물으면 → **No** (내 파일 보존)

### STEP 4. 첫 배포 (기능 없이 현재 화면만 먼저 올려보기)
- [ ] `AWCDW_26.06.02.html` → **`index.html`로 복사/이름 변경**
```bash
firebase serve     # 먼저 http://localhost:5000 에서 화면 확인
firebase deploy    # 확인되면 실제 인터넷에 공개
```
- [ ] 배포 완료 시 출력되는 `https://....web.app` 주소로 접속 → **여기까지가 1차 목표** 🎉

### STEP 5. 기능 붙이기 (이때부터 JavaScript + Firebase)
- [ ] `js/firebase-config.js` 만들고 STEP 1에서 복사한 설정 붙여넣기 (12.5 코드 참고)
- [ ] 로그인 페이지부터 연동 (12.6 코드 참고)
- [ ] 동작하면 작품 업로드 → 피드백 → 지원 시스템 순으로 확장 (10장 로드맵)

> 💡 **막히면 우선순위:** STEP 4(화면 배포)까지만 해도 "웹사이트 공개"라는 목표는 달성입니다.
> STEP 5의 기능은 천천히 하나씩 붙여도 됩니다.

---

## 15. 현재 HTML → 멀티파일 분리 실행 계획

### 15.1 현재 파일의 실제 구조 (분석 결과)

`AWCDW_26.06.02.html` 한 파일 안에 다음이 모두 들어 있습니다:

```
AWCDW_26.06.02.html (단일 파일 SPA)
│
├── [화면 div 4개] — navigateTo()로 보이기/숨기기 전환
│   ├── #landing-page         (메인: 타임라인 8단계 + 네비)
│   ├── #schedule-online-page (온라인 사전워크숍 일정)
│   ├── #schedule-busan-page  (부산대 1차 워크숍 일정)
│   └── #teams-page           (디자인팀 배정 현황)
│
├── [모달] #pending-modal     (준비중 안내 팝업)
│
└── [<script> 내부 JavaScript]
    ├── teamsData = [...]      ← 팀 데이터가 코드에 하드코딩됨 (★ Firestore로 옮길 대상)
    ├── navigateTo(pageId)     ← 페이지 전환
    ├── renderTeams(filter)    ← 팀 카드 그리기 (검색 필터 포함)
    ├── setView(view)          ← Grid/List 보기 전환
    ├── changeTheme(theme)     ← 테마 변경
    └── openPendingModal() 등  ← 모달 제어
```

> **핵심 관찰:** 가장 먼저 데이터베이스로 옮겨야 할 대상은 **`teamsData` 배열**입니다.
> 지금은 코드에 박혀 있어 팀 정보를 바꾸려면 HTML을 직접 수정해야 하지만,
> Firestore로 옮기면 화면에서 수정·실시간 반영이 가능해집니다.

### 15.2 분리는 "한 번에"가 아니라 "단계적으로"

처음부터 12.4의 완전한 멀티파일 구조로 쪼개면 부담이 큽니다. 아래 순서를 권장합니다:

**1단계 — 그대로 배포 (분리 안 함)**
- `AWCDW_26.06.02.html` → `index.html` 복사 → `firebase deploy`
- 목적: 현재 사이트를 일단 인터넷에 올린다. (구조 변경 X)

**2단계 — JavaScript만 외부 파일로 분리**
```
index.html
└── js/
    ├── teams-data.js   ← teamsData 배열만 빼냄
    └── main.js         ← navigateTo, renderTeams 등 함수 이동
```
- `index.html` 하단의 `<script>` 내용을 잘라 위 파일로 옮기고
  `<script src="js/main.js"></script>`로 연결.
- 목적: 코드 정리. 기능 변화는 없음.

**3단계 — teamsData를 Firestore로 이전**
- Firestore `teams` 컬렉션에 팀 문서 생성 (5.2 스키마)
- `renderTeams()`가 하드코딩 배열 대신 Firestore에서 `getDocs()`로 읽도록 수정
- 목적: 데이터를 코드 밖으로. 이때부터 "수정 가능한 사이트"가 됨.

**4단계 — 페이지/기능 추가 분리 (선택)**
- 로그인·대시보드·작품 업로드 등 새 기능이 커지면 그때
  `login.html`, `dashboard.html` 등으로 12.4 구조처럼 확장.

### 15.3 단계별 난이도 / 효과

| 단계 | 작업 | 난이도 | 효과 |
|------|------|--------|------|
| 1단계 | 이름 변경 후 배포 | ⭐ 매우 쉬움 | 사이트 인터넷 공개 |
| 2단계 | JS 파일 분리 | ⭐⭐ 쉬움 | 코드 가독성·관리 향상 |
| 3단계 | teamsData → Firestore | ⭐⭐⭐ 보통 | **데이터 수정 가능해짐 (핵심)** |
| 4단계 | 멀티 HTML + 인증 | ⭐⭐⭐⭐ 어려움 | 로그인·권한·업로드 등 풀기능 |

> 💡 1~2단계는 기능 변화가 없어 위험이 거의 없습니다. 부담 없이 먼저 진행하고,
> 3단계부터 Firebase 학습과 함께 천천히 진행하는 것을 권장합니다.
