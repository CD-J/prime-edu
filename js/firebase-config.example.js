// 이 파일을 복사해서 firebase-config.js 로 저장한 뒤 값을 채우세요.
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firestore에서 관리자로 쓸 계정 UID (선택)
// Firebase 콘솔 > Authentication 에서 가입한 뒤, users 컬렉션 문서의 role 을 "admin" 으로 바꾸거나
// 아래 배열에 UID 를 넣으면 관리자 화면에서 Firestore 저장이 가능합니다.
window.FIREBASE_ADMIN_UIDS = [];
