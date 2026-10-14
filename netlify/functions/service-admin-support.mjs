import { createHash } from "node:crypto";
import { adminSchools } from "./service-admin-school.mjs";
export const supportActions = [
  "schools",
  "history",
  "updateProfile",
  "updateDday",
  "editEvent",
  "renameRecord",
  "restoreChange",
  "revokeSessions",
];
const error = (statusCode, code, message) =>
  Object.assign(Error(message), { statusCode, code });
const id = (value) =>
  typeof value === "string" &&
  /^[^/\x00-\x1f]{1,128}$/.test(value) &&
  ![".", ".."].includes(value);
const uuid = (value) =>
  /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value || "");
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])]),
        )
      : value;
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
const keysByAction = {
  updateProfile: [
    "displayName",
    "schoolLevel",
    "grade",
    "classNo",
    "classId",
    "school",
  ],
  updateDday: ["ddayDate", "ddayTitle"],
  editEvent: ["title", "date", "memo"],
  renameRecord: ["title", "adminTitleVersion"],
};
export function revision(snapshot, safeData) {
  if (!snapshot.exists) return "absent";
  const time = snapshot.updateTime;
  return time && Number.isFinite(time.seconds)
    ? `${time.seconds}.${time.nanoseconds}`
    : hash(safeData(snapshot.data()));
}
function text(value, max, label) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw error(400, "INVALID_INPUT", label + "을 확인해주세요.");
  return value.trim();
}
function day(value) {
  const parsed = new Date(String(value) + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value || "") ||
    value < "2000-01-01" ||
    value > "2100-12-31" ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw error(400, "INVALID_DATE", "날짜를 확인해주세요.");
  return value;
}
function whitelist(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw error(400, "INVALID_FIELD", "지원하지 않는 수정 항목이에요.");
}
export async function supportOperation(ctx) {
  const {
    input,
    actor,
    target,
    targetProfile,
    auth,
    db,
    timestamp,
    documentId,
    safeData,
    deleteField,
    lookupSchools = adminSchools,
  } = ctx;
  const uid = input.uid,
    base = { actorUid: actor, targetUid: uid, createdAt: timestamp() };
  if (input.action === "schools")
    return {
      schools: await lookupSchools({ query: input.query, level: input.level }),
    };
  if (input.action === "history") {
    if (input.cursor && !id(input.cursor))
      throw error(400, "INVALID_CURSOR", "페이지를 확인해주세요.");
    let query = db
      .collection("serviceAdminAudit")
      .where("targetUid", "==", uid)
      .orderBy(documentId());
    if (input.cursor) query = query.startAfter(input.cursor);
    const page = await query.limit(31).get(),
      docs = page.docs.slice(0, 30);
    const history = docs.map((doc) => ({
      id: doc.id,
      ...safeData(doc.data()),
      restorable:
        !!keysByAction[doc.data().action] &&
        doc.data().state === "done" &&
        !doc.data().undoneBy,
    }));
    await db
      .collection("serviceAdminAudit")
      .add({ ...base, action: "history.read", count: history.length });
    return {
      history,
      nextCursor: page.docs.length > 30 ? docs.at(-1).id : null,
    };
  }
  if (!uuid(input.operationId))
    throw error(400, "OPERATION_REQUIRED", "작업을 다시 시작해주세요.");
  if (input.action === "revokeSessions") {
    if (
      actor === uid ||
      targetProfile.role === "admin" ||
      target.customClaims?.serviceAdmin === true
    )
      throw error(
        409,
        "PROTECTED_ACCOUNT",
        "관리자 계정은 이 화면에서 세션을 종료하지 않아요.",
      );
    const audit = db.doc("serviceAdminAudit/" + input.operationId),
      fingerprint = hash({ actor, uid, action: input.action });
    const old = await audit.get();
    if (old.exists) {
      if (old.data().fingerprint !== fingerprint)
        throw error(
          409,
          "OPERATION_CONFLICT",
          "다른 작업에 사용된 요청이에요.",
        );
      if (old.data().state === "done") return { ok: true, replayed: true };
      throw error(409, "OPERATION_PENDING", "처리 결과를 먼저 확인해주세요.");
    }
    try {
      await audit.create({
        ...base,
        action: input.action,
        fingerprint,
        state: "started",
      });
    } catch (e) {
      if (e.code === 6 || e.code === "already-exists")
        throw error(409, "OPERATION_PENDING", "이미 처리 중이에요.");
      throw e;
    }
    try {
      await auth.revokeRefreshTokens(uid);
      await audit.update({ state: "done", finishedAt: timestamp() });
    } catch {
      await audit
        .update({ state: "uncertain", finishedAt: timestamp() })
        .catch(() => {});
      throw error(
        502,
        "OPERATION_UNCERTAIN",
        "처리 결과를 확인하지 못했어요. 상태를 새로고침해주세요.",
      );
    }
    return { ok: true };
  }
  let patch = {},
    ref = db.doc("users/" + uid),
    collection = null,
    recordId = null,
    original = null;
  if (input.action === "updateProfile") {
    whitelist(input.profile, [
      "displayName",
      "schoolLevel",
      "grade",
      "classNo",
      "school",
    ]);
    patch.displayName = text(input.profile.displayName, 80, "이름");
    const level = input.profile.schoolLevel,
      grade = Number(input.profile.grade),
      classNo = Number(input.profile.classNo);
    if (
      !["middle", "high"].includes(level) ||
      !Number.isInteger(grade) ||
      grade < 1 ||
      grade > 3 ||
      !Number.isInteger(classNo) ||
      classNo < 1 ||
      classNo > 99
    )
      throw error(400, "INVALID_PROFILE", "학교급·학년·반을 확인해주세요.");
    Object.assign(patch, {
      schoolLevel: level,
      grade,
      classNo,
      classId: `${grade}-${classNo}`,
    });
    const selected = input.profile.school;
    if (
      !selected ||
      !/^[A-Z]\d{2}$/.test(selected.officeCode || "") ||
      !/^\d{5,12}$/.test(selected.schoolCode || "")
    )
      throw error(400, "INVALID_SCHOOL", "검색 결과에서 학교를 선택해주세요.");
    if (
      targetProfile.schoolLevel === level &&
      selected.schoolCode === targetProfile.school?.schoolCode &&
      selected.officeCode === targetProfile.school?.officeCode
    )
      patch.school = targetProfile.school;
    else {
      const rows = await lookupSchools({ level, school: selected }),
        school = rows.find(
          (row) =>
            row.schoolCode === selected.schoolCode &&
            row.officeCode === selected.officeCode,
        );
      if (!school)
        throw error(
          400,
          "INVALID_SCHOOL",
          "공식 학교 정보를 확인하지 못했어요.",
        );
      patch.school = {
        name: school.name,
        address: school.address,
        officeCode: school.officeCode,
        schoolCode: school.schoolCode,
      };
    }
  } else if (input.action === "updateDday") {
    whitelist(input.dday, ["title", "date"]);
    patch = {
      ddayTitle: text(input.dday.title, 80, "D-day 이름"),
      ddayDate: day(input.dday.date),
    };
  } else if (input.action === "editEvent") {
    whitelist(input.event, ["title", "date", "memo"]);
    if (input.event.memo !== undefined && typeof input.event.memo !== "string")
      throw error(400, "INVALID_INPUT", "메모를 확인해주세요.");
    if (input.collection && input.collection !== "personalEvents")
      throw error(400, "INVALID_COLLECTION", "개인 일정만 수정할 수 있어요.");
    collection = "personalEvents";
    recordId = input.id;
    patch = {
      title: text(input.event.title, 160, "일정 이름"),
      date: day(input.event.date),
      memo: String(input.event.memo || "").trim(),
    };
    if (patch.memo.length > 2000)
      throw error(400, "INVALID_INPUT", "메모가 너무 길어요.");
  } else if (input.action === "renameRecord") {
    if (!["notes", "quizzes"].includes(input.collection))
      throw error(400, "INVALID_COLLECTION", "노트 이름만 변경할 수 있어요.");
    collection = input.collection;
    recordId = input.id;
    patch = {
      title: text(input.title, 160, "노트 이름"),
      adminTitleVersion: input.operationId,
    };
  } else if (input.action === "restoreChange") {
    if (!uuid(input.originalId))
      throw error(400, "INVALID_RECORD", "작업을 선택해주세요.");
    original = db.doc("serviceAdminAudit/" + input.originalId);
  }
  if (collection) {
    if (!id(recordId))
      throw error(400, "INVALID_RECORD", "기록을 선택해주세요.");
    ref = db.doc(`users/${uid}/${collection}/${recordId}`);
  }
  if (
    !original &&
    (typeof input.revision !== "string" || input.revision.length > 160)
  )
    throw error(400, "REVISION_REQUIRED", "최신 정보를 다시 불러와주세요.");
  const audit = db.doc("serviceAdminAudit/" + input.operationId),
    fingerprint = hash({
      actor,
      uid,
      action: input.action,
      collection,
      recordId,
      patch,
      revision: input.revision || null,
      originalId: input.originalId || null,
    });
  let replayed = false;
  await db.runTransaction(async (tx) => {
    const previous = await tx.get(audit);
    if (previous.exists) {
      if (previous.data().fingerprint !== fingerprint)
        throw error(
          409,
          "OPERATION_CONFLICT",
          "다른 작업에 사용된 요청이에요.",
        );
      if (previous.data().state === "done") {
        replayed = true;
        return;
      }
      throw error(409, "OPERATION_PENDING", "이미 처리 중이에요.");
    }
    let oldChange;
    if (original) {
      const log = await tx.get(original);
      oldChange = log.data();
      if (
        !log.exists ||
        oldChange.targetUid !== uid ||
        oldChange.state !== "done" ||
        !keysByAction[oldChange.action] ||
        !oldChange.changes
      )
        throw error(400, "NOT_RESTORABLE", "되돌릴 수 없는 작업이에요.");
      if (oldChange.undoneBy)
        throw error(409, "ALREADY_RESTORED", "이미 되돌린 작업이에요.");
      collection = oldChange.collection || null;
      recordId = oldChange.recordId || null;
      if (
        collection &&
        (!["personalEvents", "notes", "quizzes"].includes(collection) ||
          !id(recordId))
      )
        throw error(400, "INVALID_RECORD", "기록을 확인해주세요.");
      ref = collection
        ? db.doc(`users/${uid}/${collection}/${recordId}`)
        : db.doc("users/" + uid);
      patch = Object.fromEntries(
        Object.entries(oldChange.changes).map(([key, c]) => {
          if (!keysByAction[oldChange.action].includes(key))
            throw error(400, "INVALID_FIELD", "되돌리기 항목을 확인해주세요.");
          return [key, c.before.exists ? c.before.value : deleteField()];
        }),
      );
      if (oldChange.action === "renameRecord")
        patch.adminTitleVersion = input.operationId;
    }
    const snapshot = await tx.get(ref),
      data = snapshot.data() || {};
    if (collection && !snapshot.exists)
      throw error(404, "RECORD_NOT_FOUND", "기록을 찾을 수 없어요.");
    if (oldChange) {
      for (const [key, c] of Object.entries(oldChange.changes))
        if (
          hash({
            exists: Object.hasOwn(data, key),
            value: safeData(data[key]),
          }) !== hash(c.after)
        )
          throw error(
            409,
            "RECORD_CHANGED",
            "그 뒤에 내용이 변경됐어요. 자동으로 덮어쓰지 않을게요.",
          );
    } else if (revision(snapshot, safeData) !== input.revision)
      throw error(
        409,
        "RECORD_CHANGED",
        "다른 곳에서 수정됐어요. 최신 정보를 다시 불러와주세요.",
      );
    const changes = {};
    for (const [key, value] of Object.entries(patch)) {
      const removed =
        oldChange &&
        !oldChange.changes[key]?.before.exists &&
        key !== "adminTitleVersion";
      changes[key] = {
        before: {
          exists: Object.hasOwn(data, key),
          value: safeData(data[key]),
        },
        after: { exists: !removed, value: removed ? null : safeData(value) },
      };
    }
    // update replaces a school map as one field; nested merge would retain stale school codes on restore.
    if (snapshot.exists) tx.update(ref, { ...patch, updatedAt: timestamp() });
    else tx.set(ref, { ...patch, role: "student", updatedAt: timestamp() });
    tx.create(audit, {
      ...base,
      action: input.action,
      collection,
      recordId,
      fingerprint,
      state: "done",
      changes,
      ...(original ? { restoredFrom: input.originalId } : {}),
    });
    if (original) tx.update(original, { undoneBy: input.operationId });
  });
  return { ok: true, ...(replayed ? { replayed: true } : {}) };
}
