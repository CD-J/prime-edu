const assert = require("node:assert/strict");
(async () => {
  const { adminSchools } = await import(
    "../netlify/functions/service-admin-school.mjs"
  );
  const calls = [];
  const fetcher = async (url) => {
    const u = new URL(url);
    calls.push(u);
    return {
      ok: true,
      json: async () => ({
        schoolInfo: [
          { head: [{ RESULT: { CODE: "INFO-000" } }] },
          {
            row: [
              {
                SCHUL_NM: "검수 학교",
                SCHUL_KND_SC_NM: u.searchParams.get("SCHUL_KND_SC_NM"),
                ATPT_OFCDC_SC_CODE: "B10",
                SD_SCHUL_CODE: "1234567",
                ORG_RDNMA: "검수 주소",
              },
            ],
          },
        ],
      }),
    };
  };
  for (const level of ["middle", "high"]) {
    const rows = await adminSchools({ level, query: "검수" + level }, fetcher);
    assert.equal(rows[0].schoolCode, "1234567");
    assert.equal(calls.at(-1).hostname, "open.neis.go.kr");
    assert.equal(
      calls.at(-1).searchParams.get("SCHUL_KND_SC_NM"),
      level === "middle" ? "중학교" : "고등학교",
    );
  }
  await adminSchools(
    {
      level: "middle",
      school: { officeCode: "B10", schoolCode: "1234567", name: "forged" },
    },
    fetcher,
  );
  assert.equal(calls.at(-1).searchParams.get("SD_SCHUL_CODE"), "1234567");
  assert(!calls.at(-1).searchParams.has("SCHUL_NM"));
  for (const input of [
    { level: "other", query: "검수" },
    { level: "middle", query: "a" },
    { level: "middle", query: "<script>" },
    {
      level: "middle",
      school: { officeCode: "https://evil", schoolCode: "../" },
    },
  ])
    await assert.rejects(
      () => adminSchools(input, fetcher),
      (e) => e.statusCode === 400,
    );
  await assert.rejects(
    () =>
      adminSchools({ level: "middle", query: "실패검수" }, async () => ({
        ok: false,
      })),
    (e) => e.code === "SCHOOL_UNAVAILABLE",
  );
  console.log(
    "PASS admin school lookup: fixed public NEIS endpoint, middle/high filters, canonical codes, input validation, sanitized outage.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
