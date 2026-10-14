(function () {
  const CLASS_ID = "2-1";

  let auth = null;
  let db = null;
  let classUnsubscribe = null;
  let personalUnsubscribe = null;

  function isConfigured() {
    const config = window.FIREBASE_CONFIG || {};
    return Boolean(config.apiKey && config.projectId && config.appId);
  }

  function init() {
    if (!isConfigured() || !window.firebase) return false;
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    return true;
  }

  function classRef() {
    return db.collection("classes").doc(CLASS_ID);
  }

  function userRef(uid) {
    return db.collection("users").doc(uid);
  }

  function setupRef() {
    return db.collection("meta").doc("setup");
  }

  /** Firestore는 2차원 배열 불가 → { cells: string[] }[] 로 저장 */
  function decodeSchedule(raw) {
    if (!raw || !Array.isArray(raw) || !raw.length) return null;
    const first = raw[0];
    if (Array.isArray(first)) return raw;
    if (first && typeof first === "object" && Array.isArray(first.cells)) {
      return raw.map((row) => (row?.cells ? row.cells.map((v) => String(v ?? "")) : []));
    }
    return null;
  }

  function encodeSchedule(rows) {
    if (!Array.isArray(rows) || !rows.length) return [];
    if (rows[0] && typeof rows[0] === "object" && Array.isArray(rows[0].cells)) {
      return rows.map((row) => ({
        cells: (row.cells || []).map((v) => String(v ?? ""))
      }));
    }
    return rows.map((cells) => ({
      cells: (Array.isArray(cells) ? cells : []).map((v) => String(v ?? ""))
    }));
  }

  function normalizeClassData(raw) {
    if (!raw) return null;
    const schoolConfig = raw.schoolConfig && typeof raw.schoolConfig === "object" ? raw.schoolConfig : null;
    const schedule = decodeSchedule(raw.schedule);
    const out = {
      className: raw.className || CLASS_ID,
      events: Array.isArray(raw.events) ? raw.events : [],
      meals: raw.meals && typeof raw.meals === "object" ? raw.meals : {},
      schoolConfig
    };
    if (schedule?.length) out.schedule = schedule;
    return out;
  }

  function subscribeClassData(onData, onError) {
    if (!db) return () => {};
    if (classUnsubscribe) classUnsubscribe();
    classUnsubscribe = classRef().onSnapshot(
      (snapshot) => {
        onData(snapshot.exists ? normalizeClassData(snapshot.data()) : null);
      },
      (error) => {
        if (onError) onError(error);
      }
    );
    return () => {
      if (classUnsubscribe) {
        classUnsubscribe();
        classUnsubscribe = null;
      }
    };
  }

  async function saveClassData(payload) {
    if (!db) throw new Error("Firebase가 초기화되지 않았습니다.");
    const doc = {
      className: CLASS_ID,
      schedule: encodeSchedule(payload.schedule || []),
      events: payload.events || [],
      meals: payload.meals || {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (payload.schoolConfig) {
      doc.schoolConfig = {
        officeCode: payload.schoolConfig.officeCode || "",
        schoolCode: payload.schoolConfig.schoolCode || "",
        schoolName: payload.schoolConfig.schoolName || ""
      };
    }
    await classRef().set(doc, { merge: true });
  }

  async function uploadLocalClassData(localData, schoolConfig) {
    await saveClassData({
      schedule: localData.schedule,
      events: localData.events,
      meals: localData.meals,
      schoolConfig: schoolConfig || null
    });
  }

  async function ensureClassDoc(seedData) {
    const snapshot = await classRef().get();
    if (!snapshot.exists && seedData) {
      await saveClassData(seedData);
    }
  }

  async function ensureClassDocFromLocal(localData, schoolConfig) {
    const snapshot = await classRef().get();
    if (snapshot.exists) return false;
    await uploadLocalClassData(localData, schoolConfig);
    return true;
  }

  function onAuthStateChanged(callback) {
    if (!auth) return () => {};
    return auth.onAuthStateChanged(callback);
  }

  function toAuthError(error) {
    const code = error?.code || "";
    const messages = {
      "auth/email-already-in-use":
        "이미 가입된 이메일입니다. 회원가입 말고 아래 로그인을 사용하세요.",
      "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
      "auth/operation-not-allowed":
        "이메일 로그인이 꺼져 있습니다. Firebase 콘솔에서 이메일/비밀번호를 켜 주세요.",
      "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
      "auth/wrong-password": "비밀번호가 올바르지 않습니다.",
      "auth/invalid-credential": "이메일 또는 비밀번호가 올바르지 않습니다.",
      "auth/user-not-found": "가입된 계정이 없습니다. 회원가입을 먼저 하세요.",
      "auth/too-many-requests": "시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
      "auth/network-request-failed": "네트워크 오류입니다. 연결을 확인하세요.",
      "auth/unauthorized-domain": "이 사이트 주소가 Firebase 승인 도메인에 없습니다."
    };
    if (messages[code]) return new Error(messages[code]);
    if (code === "permission-denied" || String(error?.message || "").includes("permission")) {
      return new Error("프로필 저장 권한이 없습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.");
    }
    return new Error(error?.message || "인증 처리 중 오류가 발생했습니다.");
  }

  async function ensureUserProfile(user) {
    if (!db || !user?.uid) return;
    const ref = userRef(user.uid);
    const snapshot = await ref.get();
    if (snapshot.exists) return;
    await ref.set({
      email: user.email || "",
      role: "student",
      classId: CLASS_ID,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function signIn(email, password) {
    if (!auth) throw new Error("Firebase Auth가 초기화되지 않았습니다.");
    try {
      const credential = await auth.signInWithEmailAndPassword(email, password);
      await ensureUserProfile(credential.user);
      return credential;
    } catch (error) {
      throw toAuthError(error);
    }
  }

  async function isSetupOpen() {
    if (!db) return false;
    const snapshot = await setupRef().get();
    return !snapshot.exists;
  }

  function normalizeStudentProfile(payload = {}) {
    const school = payload.school && typeof payload.school === "object" ? payload.school : {};
    const schoolLevel = String(payload.schoolLevel || "");
    const grade = Number(payload.grade);
    const classNo = Number(payload.classNo);
    if (!["middle", "high"].includes(schoolLevel)) throw new Error("학교급을 선택하세요.");
    if (!Number.isInteger(grade) || grade < 1 || grade > 3) throw new Error("학년은 1~3학년 중에서 선택하세요.");
    if (!Number.isInteger(classNo) || classNo < 1 || classNo > 99) throw new Error("반 번호를 올바르게 입력하세요.");
    return {
      schoolLevel,
      grade,
      classNo,
      classId: `${grade}-${classNo}`,
      school: {
        name: String(school.name || "").trim(),
        address: String(school.address || "").trim(),
        officeCode: String(school.officeCode || "").trim(),
        schoolCode: String(school.schoolCode || "").trim()
      }
    };
  }

  async function signUp(email, password, studentProfile) {
    if (!auth || !db) throw new Error("Firebase가 초기화되지 않았습니다.");
    const trimmedEmail = String(email || "").trim();
    if (!trimmedEmail) throw new Error("이메일을 입력하세요.");
    if (!password || password.length < 6) throw new Error("비밀번호는 6자 이상이어야 합니다.");
    const profile = normalizeStudentProfile(studentProfile);
    if (!profile.school.name || !profile.school.officeCode || !profile.school.schoolCode) {
      throw new Error("검색 결과에서 학교를 선택하세요.");
    }

    let credential = null;
    try {
      credential = await auth.createUserWithEmailAndPassword(trimmedEmail, password);
      await userRef(credential.user.uid).set({
        email: trimmedEmail,
        role: "student",
        ...profile,
        studyConsultation: { version: 1, status: 'pending', step: 0 },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return credential;
    } catch (error) {
      if (credential?.user) {
        try {
          await credential.user.delete();
        } catch {
          /* ignore cleanup */
        }
      }
      throw toAuthError(error);
    }
  }

  async function promoteToFirstAdmin() {
    if (!auth || !db) throw new Error("Firebase가 초기화되지 않았습니다.");
    const user = auth.currentUser;
    if (!user) throw new Error("로그인이 필요합니다.");
    if (!(await isSetupOpen())) {
      throw new Error("이미 관리자가 있습니다. 관리자 계정으로 로그인하세요.");
    }
    const ref = userRef(user.uid);
    const snapshot = await ref.get();
    const batch = db.batch();
    const ts = firebase.firestore.FieldValue.serverTimestamp();
    if (snapshot.exists) {
      if (snapshot.data().role === "admin") {
        const setupSnap = await setupRef().get();
        if (!setupSnap.exists) {
          batch.set(setupRef(), { done: true, by: user.uid, at: ts });
          await batch.commit();
        }
        return user;
      }
      if (snapshot.data().role !== "student") {
        throw new Error("이 계정은 첫 관리자로 승격할 수 없습니다.");
      }
      batch.update(ref, { role: "admin", updatedAt: ts });
    } else {
      batch.set(ref, {
        email: user.email || "",
        role: "admin",
        classId: CLASS_ID,
        createdAt: ts
      });
    }
    batch.set(setupRef(), { done: true, by: user.uid, at: ts });
    await batch.commit();
    return user;
  }

  async function signUpAsFirstAdmin(email, password) {
    if (!auth || !db) throw new Error("Firebase가 초기화되지 않았습니다.");
    if (!(await isSetupOpen())) {
      throw new Error("이미 관리자가 있습니다. 로그인하세요.");
    }
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    try {
      await userRef(credential.user.uid).set({
        email,
        role: "admin",
        classId: CLASS_ID,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await setupRef().set({
        done: true,
        by: credential.user.uid,
        at: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      try {
        await credential.user.delete();
      } catch {
        /* ignore cleanup errors */
      }
      throw error;
    }
    return credential;
  }

  async function signOut() {
    if (!auth) throw new Error("Firebase Auth가 초기화되지 않았습니다.");
    return auth.signOut();
  }

  function getCurrentUser() {
    return auth ? auth.currentUser : null;
  }

  async function getUserProfile(uid) {
    if (!db || !uid) return null;
    const snapshot = await userRef(uid).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async function isAdmin(user) {
    if (!user) return false;
    const adminUids = window.FIREBASE_ADMIN_UIDS || [];
    if (adminUids.includes(user.uid)) return true;
    const profile = await getUserProfile(user.uid);
    return profile?.role === "admin";
  }

  async function addPersonalEvent(uid, payload) {
    if (!db || !uid) throw new Error("로그인이 필요합니다.");
    const title = String(payload.title || "").trim();
    const date = String(payload.date || "").trim();
    if (!title || !date) throw new Error("제목과 날짜를 입력하세요.");
    const category = payload.category === "checklist" ? "checklist" : "event";
    await userRef(uid).collection("personalEvents").add({
      title,
      date,
      memo: String(payload.memo || "").trim(),
      category,
      minutes: Math.max(0, Math.min(360, Number(payload.minutes || 0))),
      difficulty: ["easy", "medium", "hard"].includes(payload.difficulty) ? payload.difficulty : "medium",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async function updatePersonalEvent(uid, eventId, payload) {
    if (!db || !uid || !eventId) throw new Error("수정할 일정이 없습니다.");
    const title = String(payload.title || "").trim();
    const date = String(payload.date || "").trim();
    if (!title || !date) throw new Error("제목과 날짜를 입력하세요.");
    await userRef(uid).collection("personalEvents").doc(eventId).set({
      title,
      date,
      memo: String(payload.memo || "").trim(),
      category: payload.category === "checklist" ? "checklist" : "event",
      minutes: Math.max(0, Math.min(360, Number(payload.minutes || 0))),
      difficulty: ["easy", "medium", "hard"].includes(payload.difficulty) ? payload.difficulty : "medium",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  async function deletePersonalEvent(uid, eventId) {
    if (!db || !uid || !eventId) throw new Error("삭제할 일정이 없습니다.");
    await userRef(uid).collection("personalEvents").doc(eventId).delete();
  }

  async function updateUserProfile(uid, payload) {
    if (!db || !uid) throw new Error("로그인이 필요합니다.");
    const doc = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (payload.displayName !== undefined) {
      doc.displayName = String(payload.displayName || "").trim();
    }
    if (payload.ddayDate !== undefined) {
      doc.ddayDate = String(payload.ddayDate || "").trim();
    }
    if (payload.ddayTitle !== undefined) {
      doc.ddayTitle = String(payload.ddayTitle || "").trim();
    }
    if (payload.homeLayout !== undefined) {
      doc.homeLayout = payload.homeLayout;
    }
    if (Number.isInteger(payload.sudoGuideVersion) && payload.sudoGuideVersion > 0 && payload.sudoGuideVersion <= 100) {
      doc.sudoGuideVersion = payload.sudoGuideVersion;
    }
    if (
      payload.schoolLevel !== undefined ||
      payload.grade !== undefined ||
      payload.classNo !== undefined ||
      payload.school !== undefined
    ) {
      Object.assign(doc, normalizeStudentProfile(payload));
    }
    await userRef(uid).set(doc, { merge: true });
  }

  function subscribePersonalEvents(uid, onData, onError) {
    if (!db || !uid) return () => {};
    if (personalUnsubscribe) personalUnsubscribe();
    personalUnsubscribe = userRef(uid)
      .collection("personalEvents")
      .orderBy("date", "asc")
      .limit(100)
      .onSnapshot(
        (snapshot) => {
          const events = snapshot.docs.map((doc) => ({
            id: doc.id,
            title: doc.data().title || "",
            date: doc.data().date || "",
            memo: doc.data().memo || "",
            category: doc.data().category === "checklist" ? "checklist" : "event"
          }));
          onData(events);
        },
        (error) => {
          if (onError) onError(error);
        }
      );
    return () => {
      if (personalUnsubscribe) {
        personalUnsubscribe();
        personalUnsubscribe = null;
      }
    };
  }

  async function addUserCollectionDoc(uid, collectionName, payload) {
    if (!db || !uid) throw new Error("로그인이 필요합니다.");
    const allowed = ["studyTasks", "studySessions", "notes", "quizzes", "quizAttempts", "learningDiagnostics", "gradeRecords"];
    if (!allowed.includes(collectionName)) throw new Error("지원하지 않는 학습 데이터입니다.");
    const doc = {
      ...(payload || {}),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!doc.createdAt) doc.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    const id = String(payload?.id || "").trim();
    if (id) {
      await userRef(uid).collection(collectionName).doc(id).set(doc, { merge: true });
      return id;
    }
    const ref = await userRef(uid).collection(collectionName).add(doc);
    return ref.id;
  }

  async function listUserCollectionDocs(uid, collectionName, limit = 50) {
    if (!db || !uid) throw new Error("로그인이 필요합니다.");
    const allowed = ["studyTasks", "studySessions", "notes", "quizzes", "quizAttempts", "learningDiagnostics", "gradeRecords"];
    if (!allowed.includes(collectionName)) throw new Error("지원하지 않는 학습 데이터입니다.");
    const snapshot = await userRef(uid)
      .collection(collectionName)
      .orderBy("createdAt", "desc")
      .limit(Math.max(1, Math.min(Number(limit) || 50, 100)))
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function deleteUserCollectionDoc(uid, collectionName, docId) {
    if (!db || !uid || !docId) throw new Error("삭제할 학습 데이터가 없습니다.");
    const allowed = ["studyTasks", "studySessions", "notes", "quizzes", "quizAttempts", "learningDiagnostics", "gradeRecords"];
    if (!allowed.includes(collectionName)) throw new Error("지원하지 않는 학습 데이터입니다.");
    await userRef(uid).collection(collectionName).doc(docId).delete();
  }

  function subscribeChatConversations(uid, onData, onError) {
    if (!db || auth?.currentUser?.uid !== uid) return () => {};
    return userRef(uid).collection('chatConversations').orderBy('updatedAt', 'desc').limit(50)
      .onSnapshot(snapshot => onData(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))), onError);
  }

  async function saveChatConversation(uid, conversation) {
    if (!db || auth?.currentUser?.uid !== uid) throw new Error('로그인이 필요합니다.');
    const safe = window.PrimeChatMemory?.clean(conversation);
    if (!safe) throw new Error('대화 기록이 올바르지 않습니다.');
    return userRef(uid).collection('chatConversations').doc(safe.id).set(safe);
  }

  async function getChatStudyContext(uid) {
    if (!db || auth?.currentUser?.uid !== uid) return null;
    const results = await Promise.allSettled([
      getUserProfile(uid), listUserCollectionDocs(uid, 'studyTasks', 15),
      listUserCollectionDocs(uid, 'notes', 3), listUserCollectionDocs(uid, 'quizAttempts', 5),
    ]);
    if (auth?.currentUser?.uid !== uid) return null;
    const [profile, tasks, notes, attempts] = results.map(result => result.status === 'fulfilled' ? result.value : null);
    return {
      student: { schoolLevel: profile?.schoolLevel || '', grade: profile?.grade || '', classNo: profile?.classNo || '' },
      tasks: (tasks || []).map(t => ({ title: t.title, date: t.date, minutes: t.minutes, subject: t.subject, done: Boolean(t.done) })),
      notes: (notes || []).map(n => ({ subject: n.subject, unit: n.unit, summary: String(n.summary || '').slice(0, 900) })),
      attempts: (attempts || []).map(a => ({ subject: a.subject || '', score: a.score, total: a.total, errorTypes: a.errorTypes || [] })),
    };
  }

  async function getPersonalDataPreferences(uid) {
    if (!db || auth?.currentUser?.uid !== uid) throw new Error('로그인이 필요합니다.');
    const snapshot = await userRef(uid).collection('preferences').doc('personal-data-v1').get();
    if (auth?.currentUser?.uid !== uid) throw new Error('계정이 변경됐어요.');
    return snapshot.exists ? snapshot.data() : null;
  }
  async function getStudyConsultation(uid) {
    if (!db || auth?.currentUser?.uid !== uid) throw new Error('로그인이 필요합니다.');
    const profile = await getUserProfile(uid);
    if (auth?.currentUser?.uid !== uid) throw new Error('계정이 변경됐어요.');
    return profile?.studyConsultation || null;
  }
  async function saveStudyConsultation(uid, value) {
    if (!db || auth?.currentUser?.uid !== uid) throw new Error('로그인이 필요합니다.');
    const safe = window.PrimeStudyOnboardingCore?.clean(value);
    if (!safe) throw new Error('학습 상담 형식을 확인해주세요.');
    // Merge only the private consultation field; never replace school or role.
    return userRef(uid).set({studyConsultation:safe}, {merge:true});
  }
  async function savePersonalDataPreferences(uid, value) {
    if (!db || auth?.currentUser?.uid !== uid) throw new Error('로그인이 필요합니다.');
    const safe = window.PrimePersonalDataCore?.cleanStore(value);
    if (!safe) throw new Error('개인 데이터 형식을 확인해주세요.');
    return userRef(uid).collection('preferences').doc('personal-data-v1').set(safe);
  }

  window.ClassHubFirebase = {
    getStudyConsultation,
    saveStudyConsultation,
    getPersonalDataPreferences,
    savePersonalDataPreferences,
    CLASS_ID,
    isConfigured,
    init,
    decodeSchedule,
    encodeSchedule,
    subscribeClassData,
    saveClassData,
    uploadLocalClassData,
    ensureClassDoc,
    ensureClassDocFromLocal,
    onAuthStateChanged,
    signIn,
    signUp,
    signUpAsFirstAdmin,
    promoteToFirstAdmin,
    isSetupOpen,
    signOut,
    getCurrentUser,
    getUserProfile,
    isAdmin,
    subscribePersonalEvents,
    addPersonalEvent,
    updatePersonalEvent,
    deletePersonalEvent,
    updateUserProfile,
    addUserCollectionDoc,
    listUserCollectionDocs,
    deleteUserCollectionDoc,
    subscribeChatConversations,
    saveChatConversation,
    getChatStudyContext
  };
})();
