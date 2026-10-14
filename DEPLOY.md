# schems 배포 & AI 설정

## 접속 주소 (배포 후)

- https://scheplan.web.app
- https://scheplan.firebaseapp.com

---

## AI 무료로 쓰기 (추천: Google Gemini)

OpenAI는 유료입니다. **Google Gemini API는 무료 한도**가 있어서 학급 앱에 적합합니다.

### 1단계 — Gemini API 키 발급 (무료)

1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
2. Google 계정으로 로그인
3. **API 키 만들기** 클릭
4. 생성된 키 복사 (나중에 다시 볼 수 있으니 안전한 곳에 보관)

> 무료 한도: 모델·사용량에 따라 제한이 있습니다. 학급 규모 채팅에는 보통 충분합니다.

### 2단계 — Firebase CLI

```bash
npm install -g firebase-tools
firebase login
cd 2-1-class-hub
firebase use scheplan
```

### 3단계 — AI API 키 등록

```bash
firebase functions:secrets:set AI_API_KEY
```

프롬프트에 **Gemini API 키**를 붙여넣습니다.

기본 AI는 **Gemini** (`gemini-2.0-flash`)입니다. 별도 설정 없이 동작합니다.

### 4단계 — 배포

```bash
cd functions
npm install
cd ..
firebase deploy
```

- 처음 Cloud Functions를 쓰면 Firebase **Blaze(종량제)** 플랜 업그레이드가 필요할 수 있습니다.
- Blaze도 **무료 할당량**이 있어서, 소규모 사용은 **0원**에 가깝게 쓸 수 있습니다.

### 5단계 — 사용

배포가 끝나면 https://scheplan.web.app 에서:

- **모바일**: 홈 탭 = AI 채팅
- **데스크탑**: 오른쪽 아래 🤖 버튼 → AI 패널

---

## OpenAI를 쓰고 싶다면 (유료)

```bash
firebase functions:secrets:set AI_API_KEY
# OpenAI sk-... 키 입력

firebase functions:config:set AI_PROVIDER=openai
```

또는 배포 시 환경 변수:

```bash
firebase deploy --only functions
```

Firebase Console → Functions → chat → 환경 변수에서 `AI_PROVIDER` = `openai` 설정.

---

## Firebase Auth 도메인

Authentication → Settings → Authorized domains:

- `scheplan.web.app`
- `scheplan.firebaseapp.com`
- `localhost`

---

## 로컬에서 HTML만 보기

```bash
python -m http.server 5173
```

→ UI만 확인 가능. **AI는 Firebase 배포 후**에 동작합니다.

로컬에서 AI까지 테스트:

```bash
cd functions && npm install && cd ..
firebase functions:secrets:set AI_API_KEY
firebase emulators:start
```

---

## 요약

| 항목 | 무료 가능? |
|------|-----------|
| Gemini API 키 | ✅ 무료 한도 있음 |
| Firebase Hosting | ✅ 소규모 무료 |
| Cloud Functions | ✅ Blaze 무료 할당량 |
| OpenAI | ❌ 유료 |

**가장 쉬운 무료 조합: Gemini 키 + Firebase 배포**
