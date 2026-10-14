import { createHash } from "node:crypto";
import {
  supportActions,
  supportOperation,
  revision,
} from "./service-admin-support.mjs";

const collections = [
  "personalEvents",
  "studyTasks",
  "studySessions",
  "notes",
  "quizzes",
  "quizAttempts",
  "learningDiagnostics",
  "gradeRecords",
  "preferences",
  "chatConversations",
];
const responseHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, private",
  Vary: "Origin",
  "X-Content-Type-Options": "nosniff",
};
const problem = (statusCode, code, message) =>
  Object.assign(new Error(message), { statusCode, code });
const answer = (statusCode, body) => ({
  statusCode,
  headers: responseHeaders,
  body: JSON.stringify(body),
});
const pathId = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  !/[\/\u0000-\u001f]/.test(value) &&
  ![".", ".."].includes(value);
export function safeData(value, depth = 0) {
  if (depth > 14) return "[깊이 제한]";
  if (value === null || value === undefined) return value ?? null;
  if (value.toDate instanceof Function) return value.toDate().toISOString();
  if (
    typeof value.path === "string" &&
    value.firestore &&
    typeof value.get === "function"
  )
    return { reference: value.path };
  if (typeof value === "function") return undefined;
  if (Array.isArray(value)) return value.map((v) => safeData(v, depth + 1));
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            !/(password|passhash|salt|token|private.?key|api.?key|credential|secret)/i.test(
              k,
            ),
        )
        .map(([k, v]) => [k, safeData(v, depth + 1)]),
    );
  return value;
}
export function accountView(user, profile = {}) {
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: profile.displayName || user.displayName || "",
    disabled: Boolean(user.disabled),
    administrator:
      profile.role === "admin" || user.customClaims?.serviceAdmin === true,
    emailVerified: Boolean(user.emailVerified),
    providers: (user.providerData || []).map((p) => p.providerId),
    passwordResetAvailable: Boolean(
      user.email &&
        (user.providerData || []).some((p) => p.providerId === "password"),
    ),
    createdAt: user.metadata?.creationTime || null,
    lastSignInAt: user.metadata?.lastSignInTime || null,
    authentication: {
      emailVerified: Boolean(user.emailVerified),
      phoneNumber: user.phoneNumber || null,
      lastRefreshAt: user.metadata?.lastRefreshTime || null,
      sessionsValidAfter: user.tokensValidAfterTime || null,
      linkedAccounts: (user.providerData || []).map((p) => ({
        provider: p.providerId,
        displayName: p.displayName || null,
        email: p.email || null,
      })),
      multifactorCount: user.multiFactor?.enrolledFactors?.length || 0,
    },
    profile: safeData(profile),
  };
}
export function validateEvent(value = {}) {
  const title = String(value.title || "").trim(),
    date = String(value.date || ""),
    memo = String(value.memo || "").trim();
  const parsed = new Date(date + "T00:00:00Z");
  if (
    !title ||
    title.length > 160 ||
    memo.length > 2000 ||
    date < "2000-01-01" ||
    date > "2100-12-31" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw problem(400, "INVALID_EVENT", "제목과 날짜를 확인해주세요.");
  return { title, date, memo, category: "event", source: "service-admin" };
}
let runtimePromise;
async function runtime() {
  if (!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT)
    throw problem(503, "ADMIN_NOT_CONFIGURED", "관리 서버 연결이 필요해요.");
  if (!runtimePromise)
    runtimePromise = (async () => {
      let credential;
      try {
        credential = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
      } catch {
        throw problem(
          503,
          "ADMIN_NOT_CONFIGURED",
          "관리 서버 연결을 확인해주세요.",
        );
      }
      const project = process.env.FIREBASE_PROJECT_ID || "scheplan";
      if (credential.project_id !== project)
        throw problem(
          503,
          "ADMIN_PROJECT_MISMATCH",
          "관리 서버의 프로젝트가 일치하지 않아요.",
        );
      const [
        { initializeApp, getApps, cert },
        { getAuth },
        { getFirestore, FieldValue, FieldPath },
      ] = await Promise.all([
        import("firebase-admin/app"),
        import("firebase-admin/auth"),
        import("firebase-admin/firestore"),
      ]);
      const app =
        getApps().find((a) => a.name === "service-management") ||
        initializeApp(
          { credential: cert(credential), projectId: project },
          "service-management",
        );
      return {
        auth: getAuth(app),
        db: getFirestore(app),
        timestamp: () => FieldValue.serverTimestamp(),
        documentId: () => FieldPath.documentId(),
        deleteField: () => FieldValue.delete(),
      };
    })().catch((e) => {
      runtimePromise = null;
      throw e;
    });
  return runtimePromise;
}
async function sendReset(email) {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key)
    throw problem(503, "RESET_NOT_CONFIGURED", "재설정 메일 연결이 필요해요.");
  const res = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=" +
      encodeURIComponent(key),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok)
    throw problem(
      502,
      "RESET_EMAIL_FAILED",
      "재설정 메일 발송을 확인하지 못했어요.",
    );
}
export function createHandler({
  getServices = runtime,
  sendResetEmail = sendReset,
  lookupSchools,
} = {}) {
  return async (event) => {
    let actor;
    let stage = "request";
    try {
      if (event.httpMethod === "OPTIONS")
        return { ...answer(204, null), body: "" };
      if (event.httpMethod !== "POST")
        throw problem(405, "METHOD_NOT_ALLOWED", "POST만 지원해요.");
      const origin = event.headers?.origin || event.headers?.Origin;
      const origins = [
        "https://prime-edu.vercel.app",
        process.env.VERCEL_URL && "https://" + process.env.VERCEL_URL,
      ].filter(Boolean);
      if (origin && !origins.includes(origin))
        throw problem(403, "ORIGIN_DENIED", "허용되지 않은 요청이에요.");
      const authorization =
        event.headers?.authorization || event.headers?.Authorization || "";
      if (!/^Bearer\s+\S+$/i.test(authorization))
        throw problem(401, "AUTH_REQUIRED", "관리자 계정으로 로그인해주세요.");
      if (Buffer.byteLength(event.body || "") > 16384)
        throw problem(413, "INPUT_TOO_LARGE", "입력이 너무 길어요.");
      let input;
      try {
        input = JSON.parse(event.body || "{}");
      } catch {
        throw problem(400, "INVALID_JSON", "입력을 확인해주세요.");
      }
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw problem(400, "INVALID_INPUT", "입력을 확인해주세요.");
      stage = "runtime";
      const { auth, db, timestamp, documentId, deleteField } =
        await getServices();
      stage = "identity";
      let decoded;
      try {
        decoded = await auth.verifyIdToken(
          authorization.replace(/^Bearer\s+/i, ""),
          true,
        );
      } catch (error) {
        if (
          [
            "auth/id-token-expired",
            "auth/id-token-revoked",
            "auth/invalid-id-token",
            "auth/argument-error",
            "auth/user-disabled",
            "auth/user-not-found",
          ].includes(error.code)
        )
          throw problem(
            401,
            "AUTH_EXPIRED",
            "로그인 상태를 다시 확인해주세요.",
          );
        throw error;
      }
      actor = decoded.uid;
      stage = "administrator-role";
      const actorProfile = await db.doc("users/" + actor).get();
      if (
        actorProfile.data()?.role !== "admin" &&
        decoded.serviceAdmin !== true
      )
        throw problem(
          403,
          "ADMIN_REQUIRED",
          "서비스 관리자 계정만 이용할 수 있어요.",
        );
      if (input.action === "status")
        return answer(200, { ready: true, actorUid: actor });
      stage = String(input.action || "request")
        .replace(/[^a-zA-Z]/g, "")
        .slice(0, 40);
      if (input.action === "accounts") {
        if (input.cursor && String(input.cursor).length > 2048)
          throw problem(400, "INVALID_CURSOR", "페이지를 확인해주세요.");
        const query = String(input.query || "").trim();
        let users,
          next = null;
        if (query) {
          try {
            users = [
              await (query.includes("@")
                ? auth.getUserByEmail(query)
                : auth.getUser(query)),
            ];
          } catch (e) {
            if (e.code === "auth/user-not-found") users = [];
            else throw e;
          }
        } else {
          const page = await auth.listUsers(30, input.cursor || undefined);
          users = page.users;
          next = page.pageToken || null;
        }
        const rows = await Promise.all(
          users.map(async (u) => {
            const profile = (await db.doc("users/" + u.uid).get()).data() || {};
            return {
              uid: u.uid,
              email: u.email || "",
              displayName: profile.displayName || u.displayName || "",
              disabled: Boolean(u.disabled),
            };
          }),
        );
        await db.collection("serviceAdminAudit").add({
          actorUid: actor,
          action: "accounts.read",
          count: rows.length,
          createdAt: timestamp(),
        });
        return answer(200, { accounts: rows, nextCursor: next });
      }
      if (!pathId(input.uid))
        throw problem(400, "INVALID_ACCOUNT", "계정을 선택해주세요.");
      let target;
      try {
        target = await auth.getUser(input.uid);
      } catch (error) {
        if (error.code === "auth/user-not-found")
          throw problem(404, "ACCOUNT_NOT_FOUND", "계정을 찾을 수 없어요.");
        throw error;
      }
      const profileSnapshot = await db.doc("users/" + input.uid).get();
      const targetProfile = profileSnapshot.data() || {};
      if (supportActions.includes(input.action))
        return answer(
          200,
          await supportOperation({
            input,
            actor,
            target,
            targetProfile,
            auth,
            db,
            timestamp,
            documentId,
            deleteField,
            safeData,
            lookupSchools,
          }),
        );
      const auditBase = {
        actorUid: actor,
        targetUid: input.uid,
        createdAt: timestamp(),
      };
      if (input.action === "account") {
        await db
          .collection("serviceAdminAudit")
          .add({ ...auditBase, action: "account.read" });
        return answer(200, {
          account: accountView(target, targetProfile),
          profileRevision: revision(profileSnapshot, safeData),
          collections,
        });
      }
      if (input.action === "records" || input.action === "record") {
        if (!collections.includes(input.collection))
          throw problem(400, "INVALID_COLLECTION", "지원하지 않는 기록이에요.");
        if (
          input.collection === "chatConversations" &&
          String(input.reason || "").trim().length < 3
        )
          throw problem(
            400,
            "REASON_REQUIRED",
            "대화 확인 사유를 입력해주세요.",
          );
        const ref = db.collection(
          "users/" + input.uid + "/" + input.collection,
        );
        if (input.action === "record") {
          if (!pathId(input.id))
            throw problem(400, "INVALID_RECORD", "기록을 선택해주세요.");
          const doc = await ref.doc(input.id).get();
          if (!doc.exists)
            throw problem(404, "RECORD_NOT_FOUND", "기록을 찾을 수 없어요.");
          await db.collection("serviceAdminAudit").add({
            ...auditBase,
            action: "record.read",
            collection: input.collection,
            recordId: input.id,
            reason: String(input.reason || "").slice(0, 300),
          });
          return answer(200, {
            record: {
              id: doc.id,
              data: safeData(doc.data()),
              revision: revision(doc, safeData),
            },
          });
        }
        if (input.cursor && !pathId(input.cursor))
          throw problem(400, "INVALID_CURSOR", "페이지를 확인해주세요.");
        let query = ref.orderBy(documentId());
        if (input.cursor) query = query.startAfter(input.cursor);
        const page = await query.limit(31).get(),
          docs = page.docs.slice(0, 30);
        const rows = docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            title: String(
              d.title || d.subject || d.name || d.date || doc.id,
            ).slice(0, 180),
            date: safeData(d.date || d.createdAt || d.updatedAt),
            kind: String(d.category || d.source || "").slice(0, 50),
          };
        });
        await db.collection("serviceAdminAudit").add({
          ...auditBase,
          action: "records.read",
          collection: input.collection,
          count: rows.length,
          reason: String(input.reason || "").slice(0, 300),
        });
        return answer(200, {
          records: rows,
          nextCursor: page.docs.length > 30 ? docs.at(-1).id : null,
        });
      }
      if (!["addEvent", "setDisabled", "resetPassword"].includes(input.action))
        throw problem(400, "INVALID_ACTION", "지원하지 않는 작업이에요.");
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          input.operationId || "",
        )
      )
        throw problem(400, "OPERATION_REQUIRED", "작업을 다시 시작해주세요.");
      if (
        input.action === "setDisabled" &&
        (actor === input.uid ||
          targetProfile.role === "admin" ||
          target.customClaims?.serviceAdmin === true)
      )
        throw problem(
          409,
          "PROTECTED_ACCOUNT",
          "관리자 계정의 로그인은 이 화면에서 차단할 수 없어요.",
        );
      if (input.action === "setDisabled" && typeof input.disabled !== "boolean")
        throw problem(400, "INVALID_STATUS", "계정 상태를 확인해주세요.");
      if (
        input.action === "resetPassword" &&
        !accountView(target).passwordResetAvailable
      )
        throw problem(
          409,
          "EXTERNAL_SIGN_IN",
          "Google 로그인 계정은 Google에서 비밀번호를 변경해요.",
        );
      const payload =
        input.action === "addEvent"
          ? validateEvent(input.event)
          : input.action === "setDisabled"
            ? { disabled: input.disabled }
            : {};
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            actor,
            uid: input.uid,
            action: input.action,
            payload,
          }),
        )
        .digest("hex");
      const audit = db.doc("serviceAdminAudit/" + input.operationId);
      const existing = await audit.get();
      if (existing.exists) {
        if (existing.data().fingerprint !== fingerprint)
          throw problem(
            409,
            "OPERATION_CONFLICT",
            "다른 작업에 사용된 요청이에요.",
          );
        if (existing.data().state === "done")
          return answer(200, { ok: true, replayed: true });
        throw problem(
          409,
          "OPERATION_PENDING",
          "작업 처리 여부를 확인 중이에요. 중복 요청하지 마세요.",
        );
      }
      if (input.action === "addEvent") {
        await db.runTransaction(async (tx) => {
          const old = await tx.get(audit);
          if (old.exists)
            throw problem(
              409,
              "OPERATION_PENDING",
              "이미 처리 중인 작업이에요.",
            );
          tx.create(
            db.doc(
              "users/" +
                input.uid +
                "/personalEvents/admin-" +
                input.operationId,
            ),
            { ...payload, createdAt: timestamp(), addedBy: actor },
          );
          tx.create(audit, {
            ...auditBase,
            action: input.action,
            fingerprint,
            state: "done",
          });
        });
      } else {
        try {
          await audit.create({
            ...auditBase,
            action: input.action,
            fingerprint,
            state: "started",
          });
        } catch (error) {
          if (error.code === 6 || error.code === "already-exists")
            throw problem(
              409,
              "OPERATION_PENDING",
              "이미 처리 중인 작업이에요.",
            );
          throw error;
        }
        try {
          if (input.action === "resetPassword")
            await sendResetEmail(target.email);
          else {
            await auth.updateUser(input.uid, { disabled: input.disabled });
            if (input.disabled) await auth.revokeRefreshTokens(input.uid);
          }
          await audit.update({ state: "done", finishedAt: timestamp() });
        } catch (e) {
          await audit
            .update({ state: "uncertain", finishedAt: timestamp() })
            .catch(() => {});
          throw problem(
            502,
            "OPERATION_UNCERTAIN",
            "처리 결과를 확인하지 못했어요. 계정 상태를 새로고침해주세요.",
          );
        }
      }
      return answer(200, { ok: true });
    } catch (error) {
      const known = error.statusCode && error.code;
      console.error("Service administration request failed", {
        code: known ? error.code : "ADMIN_SERVICE_ERROR",
        status: known ? error.statusCode : 503,
        stage,
        cause:
          !known && /^[a-zA-Z0-9_\/-]{1,80}$/.test(String(error.code || ""))
            ? String(error.code)
            : undefined,
        type:
          !known && /^[a-zA-Z]{1,40}$/.test(String(error.name || ""))
            ? String(error.name)
            : undefined,
      });
      return answer(known ? error.statusCode : 503, {
        code: known ? error.code : "ADMIN_SERVICE_ERROR",
        error: known
          ? error.message
          : "관리 서버에서 요청을 처리하지 못했어요.",
      });
    }
  };
}
export const handler = createHandler();
