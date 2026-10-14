# Firebase 연결 (3분)

## 1. Firebase 콘솔 (한 번만)

1. [Firebase Console](https://console.firebase.google.com/) → 프로젝트 **scheplan**
2. **Authentication** → **이메일/비밀번호** → 사용 설정
3. **Firestore** → **규칙** → 프로젝트의 `firestore.rules` 내용 붙여넣기 → **게시**  
   (또는 PC에서 `npx firebase-tools deploy --only firestore:rules` — Firebase CLI 로그인 필요)

## 2. 관리자 화면에서 끝내기

1. `admin.html` 열기 (비밀번호 `2385`)
2. **설정** 탭
3. **첫 관리자 (1회)** — 아래 중 하나  
   - 새 이메일: **첫 관리자 가입 (1회)**  
   - 이미 학생 화면에서 가입한 계정: Firebase로 **로그인** → **이 계정을 첫 관리자로 등록**  
   → `role: admin` + `meta/setup` + `classes/2-1` 초기 데이터 자동 업로드
4. 이후 수정은 저장 버튼만 누르면 Firestore에 반영

> Firestore 규칙을 바꾼 뒤에는 콘솔에서 **반드시 다시 게시**해야 승격 버튼이 동작합니다.

## 3. 학생 화면

- `index.html`에서 **회원가입/로그인** → 반 학사일정·급식 실시간 동기화
- 개인 일정은 로그인 후 추가

## 규칙 요약

| 데이터 | 읽기 | 쓰기 |
|--------|------|------|
| `classes/2-1` | 로그인 사용자 | 관리자만 |
| `users/{uid}` | 본인·관리자 | 본인 (role 변경 불가) |
| 첫 관리자 | — | `meta/setup` 없을 때만 `role: admin` 가입 가능 |

## CLI (규칙 배포 · 첫 관리자 시드)

```bash
cd 2-1-class-hub
firebase login
firebase use scheplan
firebase deploy --only firestore:rules
cd scripts
npm install
npm run bootstrap-admin
```

`bootstrap-admin`은 `firebase login` 계정으로 Firestore에 관리자·`meta/setup`·`classes/2-1`(학사일정)을 넣습니다.

## 배포 (Firebase Hosting)

자세한 단계는 **[DEPLOY.md](./DEPLOY.md)** 참고.

배포 주소: **https://scheplan.web.app**

배포 후 Firebase **Authentication → 승인된 도메인**에 `scheplan.web.app` 이 있는지 확인하세요.

## 로컬 실행

```bash
cd 2-1-class-hub
python -m http.server 5173
```

`http://127.0.0.1:5173/admin.html`

설정 전에는 `localStorage`만 사용합니다.
