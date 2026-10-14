// Synthetic, in-memory data only. Shared by server tests and loopback UI preview.
const clone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const failure = (code, message = "Synthetic failure") =>
  Object.assign(Error(message), { code });
function createFixture() {
  const users = new Map([
    [
      "admin",
      {
        uid: "admin",
        email: "admin@example.invalid",
        displayName: "검수 관리자",
        providerData: [{ providerId: "google.com" }],
      },
    ],
    [
      "student",
      {
        uid: "student",
        email: "student@example.invalid",
        displayName: "[예시] 김학생",
        providerData: [{ providerId: "password" }],
        passwordHash: "fixture-redacted",
        passwordSalt: "fixture-redacted",
        metadata: { creationTime: "2026-10-01T09:00:00Z" },
      },
    ],
    [
      "google",
      {
        uid: "google",
        email: "google@example.invalid",
        displayName: "[예시] 이학생",
        providerData: [{ providerId: "google.com" }],
      },
    ],
    [
      "manager",
      {
        uid: "manager",
        email: "manager@example.invalid",
        displayName: "[예시] 다른 관리자",
        customClaims: { serviceAdmin: true },
        providerData: [],
      },
    ],
    [
      "no-profile",
      {
        uid: "no-profile",
        email: "empty@example.invalid",
        displayName: "[예시] 프로필 미등록",
        providerData: [],
      },
    ],
  ]);
  const docs = new Map([
    ["users/admin", { role: "admin", displayName: "검수 관리자" }],
    [
      "users/student",
      {
        role: "student",
        displayName: "[예시] 김학생",
        school: { name: "예시 중학교" },
        grade: 2,
        classNo: 1,
        password: "fixture-redacted",
      },
    ],
    ["users/google", { role: "student" }],
    [
      "users/student/notes/note-01",
      {
        title: "함수와 그래프",
        subject: "수학",
        content: "일차함수의 기울기를 정리한 예시 필기",
        date: "2026-10-13",
      },
    ],
    [
      "users/student/personalEvents/event-01",
      {
        title: "예시 복습 일정",
        date: "2026-10-15",
        memo: "실제 학교·학생 데이터가 아니에요.",
        category: "event",
      },
    ],
    [
      "users/student/chatConversations/chat-01",
      {
        title: "예시 대화",
        messages: [
          { role: "user", content: "예시 질문" },
          { role: "assistant", content: "예시 답변" },
        ],
      },
    ],
  ]);
  for (let i = 0; i < 35; i++)
    docs.set("users/student/studyTasks/task-" + String(i).padStart(2, "0"), {
      title: "예시 복습 " + (i + 1),
      minutes: 15,
      completed: i % 2 === 0,
      ...(i ? { createdAt: "2026-10-13T00:00:00Z" } : {}),
    });
  const state = {
    users,
    docs,
    checked: [],
    updates: [],
    revocations: [],
    mails: [],
    audits: [],
    failAudit: false,
    failFinish: false,
    failMail: false,
    verifyError: null,
  };
  let serial = Promise.resolve(),
    nextId = 0;
  const snapshot = (path) => ({
    id: path.split("/").at(-1),
    exists: docs.has(path),
    data: () => clone(docs.get(path)),
  });
  function ref(path) {
    return {
      path,
      get: async () => snapshot(path),
      create: async (data) => {
        if (state.failAudit && path.startsWith("serviceAdminAudit/"))
          throw failure(7);
        if (docs.has(path)) throw failure(6);
        docs.set(path, clone(data));
      },
      update: async (data) => {
        if (state.failFinish && path.startsWith("serviceAdminAudit/"))
          throw failure(7);
        if (!docs.has(path)) throw failure(5);
        docs.set(path, { ...docs.get(path), ...clone(data) });
      },
    };
  }
  const db = {
    doc: ref,
    collection(path) {
      function query(cursor = "", size = 30, filters = []) {
        return {
          orderBy: () => query(cursor, size, filters),
          where: (key, operator, value) =>
            query(cursor, size, [...filters, [key, value]]),
          startAfter: (id) => query(id, size, filters),
          limit: (n) => query(cursor, n, filters),
          get: async () => ({
            docs: [...docs.keys()]
              .filter(
                (p) =>
                  p.startsWith(path + "/") &&
                  !p.slice(path.length + 1).includes("/") &&
                  p.slice(path.length + 1) > cursor &&
                  filters.every(([key, value]) => docs.get(p)[key] === value),
              )
              .sort()
              .slice(0, size)
              .map(snapshot),
          }),
          doc: (id) => ref(path + "/" + id),
          add: async (data) => {
            const id = "audit-" + ++nextId;
            await ref(path + "/" + id).create(data);
            state.audits.push(clone(data));
            return ref(path + "/" + id);
          },
        };
      }
      return query();
    },
    async runTransaction(fn) {
      const run = serial.then(async () => {
        const writes = [];
        const tx = {
          get: (r) => r.get(),
          create: (r, data) => writes.push([r.path, clone(data), "create"]),
          set: (r, data, options) =>
            writes.push([
              r.path,
              clone(data),
              options?.merge ? "merge" : "set",
            ]),
          update: (r, data) => writes.push([r.path, clone(data), "merge"]),
        };
        await fn(tx);
        if (state.failAudit) throw failure(7);
        for (const [path, , kind] of writes)
          if (kind === "create" && docs.has(path)) throw failure(6);
        for (const [path, data, kind] of writes) {
          const next = kind === "merge" ? { ...docs.get(path), ...data } : data;
          for (const key of Object.keys(next))
            if (next[key]?.__fixtureDelete) delete next[key];
          docs.set(path, next);
        }
      });
      serial = run.catch(() => {});
      return run;
    },
  };
  const auth = {
    async verifyIdToken(token, revoked) {
      state.checked.push({ token, revoked });
      if (state.verifyError) throw failure(state.verifyError);
      if (!["admin", "student", "claim-admin"].includes(token))
        throw failure("auth/invalid-id-token");
      return {
        uid: token === "claim-admin" ? "manager" : token,
        ...(token === "claim-admin" ? { serviceAdmin: true } : {}),
      };
    },
    async getUser(uid) {
      if (!users.has(uid)) throw failure("auth/user-not-found");
      return clone(users.get(uid));
    },
    async getUserByEmail(email) {
      const u = [...users.values()].find((u) => u.email === email);
      if (!u) throw failure("auth/user-not-found");
      return clone(u);
    },
    async listUsers(size, cursor) {
      const start = Number((cursor || "page:0").split(":")[1]);
      const rows = [...users.values()];
      return {
        users: clone(rows.slice(start, start + size)),
        pageToken:
          start + size < rows.length ? "page:" + (start + size) : undefined,
      };
    },
    async updateUser(uid, value) {
      state.updates.push({ uid, ...clone(value) });
      users.set(uid, { ...users.get(uid), ...clone(value) });
      return clone(users.get(uid));
    },
    async revokeRefreshTokens(uid) {
      state.revocations.push(uid);
    },
  };
  return {
    state,
    getServices: async () => ({
      auth,
      db,
      timestamp: () => "2026-10-13T12:00:00Z",
      documentId: () => "__name__",
      deleteField: () => ({ __fixtureDelete: true }),
    }),
    lookupSchools: async (input) => [
      {
        name: "예시 중학교",
        address: "예시 주소",
        officeCode: "B10",
        schoolCode: "1234567",
        kind: input.level === "high" ? "고등학교" : "중학교",
      },
    ],
    sendResetEmail: async (email) => {
      state.mails.push(email);
      if (state.failMail) throw failure("mail-timeout");
    },
  };
}
module.exports = { createFixture };
