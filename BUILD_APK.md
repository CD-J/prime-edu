# ScheMs APK 만들기

웹 사이트(`https://schems21.netlify.app`)를 여는 **안드로이드 앱** 프로젝트입니다.  
PC에 **Android Studio**만 설치되어 있으면 APK를 뽑을 수 있습니다.

## 1. 준비 (한 번만)

1. [Android Studio](https://developer.android.com/studio) 설치 (JDK 포함)
2. 터미널에서:

```bash
cd mobile
npm install
npx cap add android
npx cap sync android
```

`npx cap add android`는 `mobile/android` 폴더를 만듭니다.

## 2. APK 빌드 (디버그 · 테스트용)

### 방법 A — Android Studio (추천)

1. Android Studio 실행
2. **Open** → `2-1-class-hub/mobile/android` 폴더 선택
3. Gradle 동기화가 끝날 때까지 대기
4. 메뉴 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
5. 완료 후 **Locate** 클릭

APK 위치 예:

`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

친구에게 이 파일을내면 **알 수 없는 출처 설치** 허용 후 설치 가능합니다.

### 방법 B — 명령줄

Android Studio를 한 번 연 적이 있고 SDK가 잡혀 있으면:

```bash
cd mobile/android
gradlew.bat assembleDebug
```

## 3. Play 스토어용 (나중에)

- **Build → Generate Signed Bundle / APK** → **AAB** 선택
- 키스토어 생성 후 서명 필요
- 개인정보 처리방침 URL 필수 (이메일 로그인 사용 중)

## 4. 사이트 주소 바꿀 때

`mobile/capacitor.config.json` 의 `server.url` 수정 후:

```bash
cd mobile
npx cap sync android
```

다시 APK 빌드.

## 문제 해결

| 증상 | 해결 |
|------|------|
| Gradle 오류 | Android Studio에서 SDK 34 설치 확인 |
| 흰 화면 | Netlify 주소·인터넷 연결 확인 |
| 로그인 안 됨 | Firebase 승인 도메인에 앱은 별도 없음(웹과 동일 URL 로드) |

이 PC에는 Android SDK가 없어 APK 파일은 여기서 직접 생성하지 못했습니다. 위 순서대로 Android Studio에서 빌드하면 됩니다.
