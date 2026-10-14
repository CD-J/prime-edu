const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createFixture } = require("./service-admin-fixture.cjs");
(async () => {
  const { createHandler } = await import(
    "../netlify/functions/serviceAdmin.mjs"
  );
  const fixture = createFixture(),
    state = fixture.state,
    handler = createHandler(fixture);
  const request = async (body, token = "admin") => {
    const result = await handler({
      httpMethod: "POST",
      headers: {
        authorization: "Bearer " + token,
        origin: "https://prime-edu.vercel.app",
      },
      body: JSON.stringify(body),
    });
    return { status: result.statusCode, ...JSON.parse(result.body) };
  };
  const account = (uid) => request({ action: "account", uid });
  const record = (collection, id, uid = "student") =>
    request({ action: "record", uid, collection, id });
  const perform = (action, fields = {}, uid = "student") =>
    request({ action, uid, operationId: randomUUID(), ...fields });
  const docs = state.docs,
    profilePath = "users/student",
    notePath = profilePath + "/notes/note-01";
  for (const action of [
    "schools",
    "history",
    "updateProfile",
    "updateDday",
    "editEvent",
    "renameRecord",
    "restoreChange",
    "revokeSessions",
  ]) {
    assert.equal(
      (await request({ action, uid: "student" }, "student")).status,
      403,
    );
    assert.equal(
      (await request({ action, uid: "student" }, "invalid")).status,
      401,
    );
  }
  assert.equal(state.updates.length + state.revocations.length, 0);
  const school = {
    name: "forged client name",
    officeCode: "B10",
    schoolCode: "1234567",
  };
  const profile = {
    displayName: "새 이름",
    schoolLevel: "middle",
    grade: 3,
    classNo: 2,
    school,
  };
  let current = await account("student");
  const originalSchool = structuredClone(docs.get(profilePath).school);
  for (const field of [
    "role",
    "email",
    "uid",
    "password",
    "passwordHash",
    "customClaims",
  ])
    assert.equal(
      (
        await perform("updateProfile", {
          revision: current.profileRevision,
          profile: { ...profile, [field]: "injected" },
        })
      ).status,
      400,
    );
  for (const altered of [
    { grade: 0 },
    { classNo: 100 },
    { schoolLevel: "other" },
    { school: { officeCode: "../", schoolCode: "https://example.invalid" } },
  ])
    assert.equal(
      (
        await perform("updateProfile", {
          revision: current.profileRevision,
          profile: { ...profile, ...altered },
        })
      ).status,
      400,
    );
  const opId = randomUUID(),
    payload = {
      action: "updateProfile",
      uid: "student",
      operationId: opId,
      revision: current.profileRevision,
      profile,
    };
  assert.equal((await request(payload)).status, 200);
  assert.equal(docs.get(profilePath).displayName, "새 이름");
  assert.equal(
    docs.get(profilePath).school.name,
    "예시 중학교",
    "server verifies school instead of trusting client name",
  );
  assert.equal(docs.get(profilePath).classId, "3-2");
  assert.equal(docs.get(profilePath).role, "student");
  assert.equal(
    (await account("student")).account.displayName,
    "새 이름",
    "canonical profile name outranks old Auth name",
  );
  assert.equal((await request(payload)).replayed, true);
  assert.equal(
    (
      await request({
        ...payload,
        profile: { ...profile, displayName: "different" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await perform("updateProfile", {
        revision: current.profileRevision,
        profile,
      })
    ).status,
    409,
    "stale snapshot cannot overwrite owner changes",
  );
  assert.equal(
    state.updates.length,
    0,
    "support changes do not rewrite Auth identity",
  );
  const undoId = randomUUID();
  assert.equal(
    (
      await request({
        action: "restoreChange",
        uid: "student",
        operationId: undoId,
        originalId: opId,
      })
    ).status,
    200,
  );
  assert.deepEqual(
    docs.get(profilePath).school,
    originalSchool,
    "restoration removes added nested school codes",
  );
  assert(!Object.hasOwn(docs.get(profilePath), "classId"));
  assert.equal(
    (
      await request({
        action: "restoreChange",
        uid: "student",
        operationId: undoId,
        originalId: opId,
      })
    ).replayed,
    true,
  );
  assert.equal(
    (await perform("restoreChange", { originalId: opId })).status,
    409,
  );
  const empty = await account("no-profile");
  assert.equal(
    (
      await perform(
        "updateProfile",
        { revision: empty.profileRevision, profile },
        "no-profile",
      )
    ).status,
    200,
  );
  assert.equal(
    docs.get("users/no-profile").role,
    "student",
    "missing root cannot become admin",
  );
  const own = await account("admin");
  assert.equal(
    (
      await perform(
        "updateDday",
        {
          revision: own.profileRevision,
          dday: { title: "자체 시험", date: "2026-12-01" },
        },
        "admin",
      )
    ).status,
    200,
  );
  assert.equal(
    docs.get("users/admin").role,
    "admin",
    "existing admin role is preserved, not promoted",
  );
  current = await account("student");
  for (const date of ["2026-02-30", "1999-01-01", "2026-10-13/../", "bad"])
    assert.equal(
      (
        await perform("updateDday", {
          revision: current.profileRevision,
          dday: { title: "시험", date },
        })
      ).status,
      400,
    );
  const ddayId = randomUUID();
  const dday = {
    action: "updateDday",
    uid: "student",
    operationId: ddayId,
    revision: current.profileRevision,
    dday: { title: "기말시험", date: "2026-12-07" },
  };
  state.failAudit = true;
  const before = JSON.stringify(docs.get(profilePath));
  const log = console.error;
  console.error = () => {};
  assert.equal((await request(dday)).status, 503);
  console.error = log;
  assert.equal(
    JSON.stringify(docs.get(profilePath)),
    before,
    "data and audit commit atomically",
  );
  assert(!docs.has("serviceAdminAudit/" + ddayId));
  state.failAudit = false;
  const concurrent = await Promise.all([request(dday), request(dday)]);
  assert(concurrent.every((r) => r.status === 200));
  assert.equal(concurrent.filter((r) => r.replayed).length, 1);
  assert.equal(docs.get(profilePath).ddayDate, "2026-12-07");
  docs.set(profilePath, { ...docs.get(profilePath), ownerExtra: "keep this" });
  assert.equal(
    (await perform("restoreChange", { originalId: ddayId })).status,
    200,
  );
  assert(!Object.hasOwn(docs.get(profilePath), "ddayDate"));
  assert.equal(
    docs.get(profilePath).ownerExtra,
    "keep this",
    "undo preserves unrelated subsequent edits",
  );
  const eventPath = profilePath + "/personalEvents/event-01";
  docs.set(eventPath, {
    ...docs.get(eventPath),
    minutes: 45,
    checklist: [{ text: "복습", done: false }],
  });
  let event = await record("personalEvents", "event-01");
  const editId = randomUUID();
  assert.equal(
    (
      await perform("editEvent", {
        operationId: editId,
        id: "event-01",
        revision: event.record.revision,
        event: { title: "수정 일정", date: "2026-10-16", memo: "메모" },
      })
    ).status,
    200,
  );
  assert.equal(docs.get(eventPath).category, "event");
  assert.equal(docs.get(eventPath).minutes, 45);
  assert.equal(docs.get(eventPath).checklist[0].done, false);
  assert.equal(
    (
      await perform("editEvent", {
        id: "event-01",
        collection: "classCalendars",
        revision: event.record.revision,
        event: { title: "x", date: "2026-10-16" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await perform("editEvent", {
        id: "../event-01",
        revision: event.record.revision,
        event: { title: "x", date: "2026-10-16" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await perform("editEvent", {
        id: "event-01",
        revision: event.record.revision,
        event: { title: "x", date: "2026-10-16" },
      })
    ).status,
    409,
  );
  assert.equal(
    (await perform("restoreChange", { originalId: editId })).status,
    200,
  );
  assert.equal(docs.get(eventPath).title, "예시 복습 일정");
  const note = await record("notes", "note-01"),
    renameId = randomUUID();
  const originalContent = docs.get(notePath).content;
  assert.equal(
    (
      await perform("renameRecord", {
        operationId: renameId,
        collection: "notes",
        id: "note-01",
        revision: note.record.revision,
        title: "새 필기",
      })
    ).status,
    200,
  );
  assert.equal(docs.get(notePath).content, originalContent);
  assert.equal(docs.get(notePath).adminTitleVersion, renameId);
  const restoreRenameId = randomUUID();
  assert.equal(
    (
      await perform("restoreChange", {
        operationId: restoreRenameId,
        originalId: renameId,
      })
    ).status,
    200,
  );
  assert.equal(docs.get(notePath).title, "함수와 그래프");
  assert.equal(
    docs.get(notePath).adminTitleVersion,
    restoreRenameId,
    "undo signals client caches with a fresh version",
  );
  let latest = await record("notes", "note-01"),
    staleId = randomUUID();
  await perform("renameRecord", {
    operationId: staleId,
    collection: "notes",
    id: "note-01",
    revision: latest.record.revision,
    title: "관리자 이름",
  });
  docs.set(notePath, { ...docs.get(notePath), title: "학생이 나중에 바꿈" });
  assert.equal(
    (await perform("restoreChange", { originalId: staleId })).status,
    409,
  );
  assert.equal(docs.get(notePath).title, "학생이 나중에 바꿈");
  assert.equal(
    (
      await perform("renameRecord", {
        collection: "gradeRecords",
        id: "note-01",
        revision: latest.record.revision,
        title: "x",
      })
    ).status,
    400,
  );
  assert.equal(
    (await perform("restoreChange", { originalId: renameId }, "google")).status,
    400,
    "undo cannot cross accounts",
  );
  assert.equal(
    (await perform("restoreChange", { originalId: randomUUID() })).status,
    400,
  );
  const quizPath = profilePath + "/quizzes/quiz-01";
  docs.set(quizPath, {
    subject: "수학",
    questions: [{ question: "1+1", answer: "2" }],
  });
  const quiz = await record("quizzes", "quiz-01"),
    quizId = randomUUID();
  assert.equal(
    (
      await perform("renameRecord", {
        operationId: quizId,
        collection: "quizzes",
        id: "quiz-01",
        revision: quiz.record.revision,
        title: "시험 퀴즈",
      })
    ).status,
    200,
  );
  assert.equal(docs.get(quizPath).questions[0].answer, "2");
  assert.equal(
    (await perform("restoreChange", { originalId: quizId })).status,
    200,
  );
  assert(
    !Object.hasOwn(docs.get(quizPath), "title"),
    "missing original title is deleted, not blanked",
  );
  const history = await request({ action: "history", uid: "student" });
  assert.equal(history.status, 200);
  assert(history.history.every((row) => row.targetUid === "student"));
  assert(!JSON.stringify(history).includes("fixture-redacted"));
  const renameLog = history.history.find((row) => row.id === renameId);
  assert(
    renameLog &&
      !renameLog.restorable &&
      renameLog.undoneBy === restoreRenameId,
  );
  for (let i = 0; i < 40; i++)
    docs.set("serviceAdminAudit/zz-" + String(i).padStart(3, "0"), {
      targetUid: "student",
      action: "account.read",
      createdAt: "2026-10-13",
    });
  docs.set("serviceAdminAudit/zz-other", {
    targetUid: "google",
    action: "account.read",
  });
  let cursor = null,
    ids = [];
  do {
    const page = await request({ action: "history", uid: "student", cursor });
    assert.equal(page.status, 200);
    ids.push(...page.history.map((row) => row.id));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(
    ids.length,
    new Set(ids).size,
    "cursor pages do not duplicate records",
  );
  assert(!ids.includes("zz-other"));
  assert.equal(
    (await request({ action: "history", uid: "student", cursor: "../x" }))
      .status,
    400,
  );
  for (const uid of ["admin", "manager"])
    assert.equal((await perform("revokeSessions", {}, uid)).status, 409);
  const revokeId = randomUUID();
  assert.equal(
    (await perform("revokeSessions", { operationId: revokeId })).status,
    200,
  );
  assert.equal(
    (await perform("revokeSessions", { operationId: revokeId })).replayed,
    true,
  );
  assert.equal(state.revocations.filter((uid) => uid === "student").length, 1);
  state.failFinish = true;
  console.error = () => {};
  const uncertainId = randomUUID();
  assert.equal(
    (await perform("revokeSessions", { operationId: uncertainId }, "google"))
      .status,
    502,
  );
  console.error = log;
  state.failFinish = false;
  assert.equal(
    (await perform("revokeSessions", { operationId: uncertainId }, "google"))
      .status,
    409,
  );
  assert.equal(
    state.revocations.filter((uid) => uid === "google").length,
    1,
    "uncertain Auth actions are not blindly retried",
  );
  const exposed = await account("student");
  assert.equal(exposed.account.authentication.multifactorCount, 0);
  assert(!JSON.stringify(exposed).includes("fixture-redacted"));
  assert(!Object.hasOwn(exposed.account, "customClaims"));
  assert.equal(
    (
      await perform("updateDday", {
        dday: { title: "시험", date: "2026-12-07" },
      })
    ).status,
    400,
    "revision is mandatory",
  );
  console.log(
    "PASS expanded administrator support: authorization, verified school, allowlisted updates, canonical names, atomic audit, revision conflicts, idempotence, safe undo, account-scoped paginated history, protected session revocation, and no credential disclosure. Synthetic data only.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
