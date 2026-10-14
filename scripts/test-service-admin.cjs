const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { createFixture } = require("./service-admin-fixture.cjs");
(async () => {
  execFileSync(process.execPath, ["--no-experimental-require-module", "-e", "Promise.all([import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/firestore')]).catch(e=>{console.error(e.code);process.exitCode=1})"], {cwd:path.resolve(__dirname,".."),timeout:15000,stdio:"pipe"});
  const { createHandler, safeData, accountView, validateEvent } = await import(
    "../netlify/functions/serviceAdmin.mjs"
  );
  const fixture = createFixture(),
    handler = createHandler(fixture),
    state = fixture.state;
  const logs = [],
    original = console.error;
  console.error = (...v) => logs.push(JSON.stringify(v));
  const request = async (payload, token = "admin", extra = {}) => {
    const r = await handler({
      httpMethod: "POST",
      headers: {
        authorization: "Bearer " + token,
        origin: "https://prime-edu.vercel.app",
      },
      body: JSON.stringify(payload),
      ...extra,
    });
    return {
      status: r.statusCode,
      data: JSON.parse(r.body || "null"),
      headers: r.headers,
    };
  };
  try {
    assert.equal(
      (await request({ action: "status" }, "", { headers: {} })).status,
      401,
    );
    assert.equal(
      state.checked.length,
      0,
      "missing identity must not invoke SDK",
    );
    assert.equal((await request({ action: "status" }, "invalid")).status, 401);
    for (const action of [
      "status",
      "accounts",
      "account",
      "records",
      "addEvent",
      "resetPassword",
      "setDisabled",
    ])
      assert.equal(
        (await request({ action, uid: "student", role: "admin" }, "student"))
          .status,
        403,
      );
    assert.equal(state.updates.length + state.mails.length, 0);
    assert.equal((await request({ action: "status" })).data.ready, true);
    assert.equal(
      (await request({ action: "status" }, "claim-admin")).status,
      200,
    );
    assert(
      state.checked.every((c) => c.revoked === true),
      "server checks revoked identity",
    );
    for (const code of [
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/user-disabled",
    ]) {
      state.verifyError = code;
      assert.equal((await request({ action: "status" })).status, 401);
    }
    state.verifyError = "auth/insufficient-permission";
    assert.equal((await request({ action: "status" })).status, 503);
    state.verifyError = null;
    assert.equal(
      (
        await request({}, "admin", {
          headers: {
            origin: "https://example.invalid",
            authorization: "Bearer admin",
          },
        })
      ).status,
      403,
    );
    assert.equal((await request({}, "admin", { body: "{bad" })).status, 400);
    assert.equal(
      (await request({}, "admin", { body: "x".repeat(17000) })).status,
      413,
    );
    assert.equal((await request([], "admin")).status, 400);
    assert.equal(
      (await request({}, "admin", { httpMethod: "GET" })).status,
      405,
    );
    assert.equal(
      (await request({}, "admin", { httpMethod: "OPTIONS" })).status,
      204,
    );
    const listed = await request({ action: "accounts" });
    assert.equal(listed.data.accounts.length, 5);
    assert.equal(listed.headers["Cache-Control"], "no-store, private");
    assert(
      listed.data.accounts.some((a) => a.uid === "no-profile"),
      "Auth-only users remain visible",
    );
    assert(!JSON.stringify(listed.data).includes("fixture-redacted"));
    assert(listed.data.accounts.every(account => account.profile === undefined), "list contains summary only; full information waits for selection");
    assert.equal(
      (await request({ action: "accounts", query: "student@example.invalid" }))
        .data.accounts[0].uid,
      "student",
    );
    assert.equal(
      (await request({ action: "accounts", query: "missing@example.invalid" }))
        .data.accounts.length,
      0,
    );
    for (let i = 0; i < 31; i++)
      state.users.set("extra-" + i, { uid: "extra-" + i, providerData: [] });
    const page = await request({ action: "accounts" });
    assert.equal(page.data.accounts.length, 30);
    assert(page.data.nextCursor);
    assert.equal(
      (await request({ action: "accounts", cursor: page.data.nextCursor })).data
        .accounts.length,
      6,
    );
    assert.equal(
      (await request({ action: "account", uid: "../student" })).status,
      400,
    );
    assert.equal(
      (await request({ action: "account", uid: "missing" })).status,
      404,
    );
    const account = await request({ action: "account", uid: "student" });
    assert.equal(account.data.account.passwordResetAvailable, true);
    assert.equal(account.data.account.profile.role, "student");
    assert.equal(account.data.collections.length, 10);
    assert.equal(accountView(state.users.get("manager")).administrator, true);
    const scrubbed = safeData({
      password: "redact",
      passwordHash: "redact",
      token: "redact",
      nested: { salt: "redact", apiKey: "redact", text: "keep" },
      stamp: { toDate: () => new Date("2026-10-13T00:00:00Z") },
      ref: { path: "users/student", firestore: {}, get() {} },
    });
    assert.deepEqual(scrubbed, {
      nested: { text: "keep" },
      stamp: "2026-10-13T00:00:00.000Z",
      ref: { reference: "users/student" },
    });
    assert.equal(
      (
        await request({
          action: "records",
          uid: "student",
          collection: "serviceAdminAudit",
        })
      ).status,
      400,
    );
    const records = await request({
      action: "records",
      uid: "student",
      collection: "studyTasks",
    });
    assert.equal(records.data.records.length, 30);
    assert.equal(
      records.data.records[0].id,
      "task-00",
      "legacy records without createdAt are included",
    );
    assert.equal(records.data.nextCursor, "task-29");
    assert.equal(
      (
        await request({
          action: "records",
          uid: "student",
          collection: "studyTasks",
          cursor: "task-29",
        })
      ).data.records.length,
      5,
    );
    assert.equal(
      (
        await request({
          action: "record",
          uid: "student",
          collection: "notes",
          id: "note-01",
        })
      ).data.record.data.subject,
      "수학",
    );
    assert.equal(
      (
        await request({
          action: "record",
          uid: "student",
          collection: "notes",
          id: "missing",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request({
          action: "records",
          uid: "student",
          collection: "chatConversations",
        })
      ).data.code,
      "REASON_REQUIRED",
    );
    assert.equal(
      (
        await request({
          action: "record",
          uid: "student",
          collection: "chatConversations",
          id: "chat-01",
          reason: "지원 요청 확인",
        })
      ).status,
      200,
    );
    const audit = [...state.docs.values()].find(
      (d) => d.action === "record.read" && d.collection === "chatConversations",
    );
    assert.equal(audit.reason, "지원 요청 확인");
    assert.equal(audit.messages, undefined);
    for (const d of ["2026-02-30", "1999-12-31", "2101-01-01", "bad"])
      assert.throws(() => validateEvent({ title: "x", date: d }));
    const op = randomUUID(),
      event = { title: " 예시 일정 ", date: "2026-10-14", memo: " 예시 메모 " },
      add = { action: "addEvent", uid: "student", operationId: op, event };
    assert.equal((await request({ ...add, operationId: "bad" })).status, 400);
    assert.equal((await request(add)).status, 200);
    const added = state.docs.get("users/student/personalEvents/admin-" + op);
    assert.equal(added.title, "예시 일정");
    assert.equal(added.source, "service-admin");
    assert.equal(added.addedBy, "admin");
    assert.equal((await request(add)).data.replayed, true);
    assert.equal(
      (await request({ ...add, event: { ...event, title: "다른 일정" } }))
        .status,
      409,
    );
    assert(
      ![...state.docs.keys()].some((p) => p.startsWith("classes/")),
      "school official calendar untouched",
    );
    const before = state.docs.size;
    state.failAudit = true;
    assert.equal(
      (await request({ ...add, operationId: randomUUID() })).status,
      503,
    );
    assert.equal(
      state.docs.size,
      before,
      "atomic event writes roll back when audit fails",
    );
    state.failAudit = false;
    for (const uid of ["admin", "manager"])
      assert.equal(
        (
          await request({
            action: "setDisabled",
            uid,
            disabled: true,
            operationId: randomUUID(),
          })
        ).data.code,
        "PROTECTED_ACCOUNT",
      );
    assert.equal(
      (
        await request({
          action: "setDisabled",
          uid: "student",
          disabled: "true",
          operationId: randomUUID(),
        })
      ).status,
      400,
    );
    const block = {
      action: "setDisabled",
      uid: "student",
      disabled: true,
      operationId: randomUUID(),
    };
    assert.equal((await request(block)).status, 200);
    assert.equal(state.updates.at(-1).uid, "student");
    assert.deepEqual(state.revocations, ["student"]);
    await request(block);
    assert.equal(state.updates.length, 1);
    assert.equal(
      (
        await request({
          action: "setDisabled",
          uid: "student",
          disabled: false,
          operationId: randomUUID(),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request({
          action: "resetPassword",
          uid: "google",
          operationId: randomUUID(),
        })
      ).data.code,
      "EXTERNAL_SIGN_IN",
    );
    const reset = {
      action: "resetPassword",
      uid: "student",
      operationId: randomUUID(),
      email: "ignored@example.invalid",
    };
    assert.equal((await request(reset)).status, 200);
    assert.deepEqual(state.mails, ["student@example.invalid"]);
    assert.equal((await request(reset)).data.replayed, true);
    assert.equal(state.mails.length, 1);
    state.failAudit = true;
    assert.equal(
      (await request({ ...reset, operationId: randomUUID() })).status,
      503,
    );
    assert.equal(state.mails.length, 1);
    state.failAudit = false;
    state.failFinish = true;
    const uncertain = { ...reset, operationId: randomUUID() };
    assert.equal((await request(uncertain)).data.code, "OPERATION_UNCERTAIN");
    assert.equal((await request(uncertain)).data.code, "OPERATION_PENDING");
    assert.equal(state.mails.length, 2);
    state.failFinish = false;
    const simultaneous = { ...reset, operationId: randomUUID() };
    const results = await Promise.all([
      request(simultaneous),
      request(simultaneous),
    ]);
    assert.equal(state.mails.length, 3, "concurrent duplicate sends once");
    assert(results.some((r) => r.status === 200));
    assert(results.every((r) => [200, 409].includes(r.status)));
    assert.equal(
      (await request({ action: "deleteAccount", uid: "student" })).status,
      400,
    );
    assert(!logs.join().includes("fixture-redacted"));
    assert(!logs.join().includes("student@example.invalid"));
    const source = fs.readFileSync(
        path.join(__dirname, "../js/service-admin.js"),
        "utf8",
      ),
      html = fs.readFileSync(
        path.join(__dirname, "../service-admin.html"),
        "utf8",
      );
    assert(!source.includes("AbortSignal.timeout"));
    assert(source.includes("new AbortController()"));
    assert(source.includes("form.reset()"));
    assert(
      source.includes("generation !== epoch") &&
        source.includes("ticket !== selection") &&
        source.includes("requestTicket !== recordRequest"),
    );
    assert(source.includes("name.textContent = record.title"));
    assert(source.includes("operationId: target.id"));
    assert(source.includes("aria-hidden"));
    assert(html.includes("browser-compat.js"));
    assert(!html.includes("ADMIN_PASSWORD"));
    assert(!html.includes("bootstrapAdminProfile"));
    console.log(
      "Service management: identity, all-account paging, private record audit, event atomicity, duplicate/reset/block protections and Safari source guards passed.",
    );
  } finally {
    console.error = original;
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
