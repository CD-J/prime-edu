// One-time, explicitly approved server setup. Keys stay in RAM and Vercel Secret stdin.
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { OAuth2Client } from "google-auth-library";
const require = createRequire(import.meta.url),
  cliRoot =
    "C:/Users/jeons/AppData/Roaming/npm/node_modules/firebase-tools/lib/";
const cfg = require(cliRoot + "configstore.js").configstore,
  cliApi = require(cliRoot + "api.js");
const PROJECT = "scheplan",
  ROLE = "primeEduServiceManagement",
  ACCOUNT = "prime-service-manager",
  SA = ACCOUNT + "@" + PROJECT + ".iam.gserviceaccount.com";
const PERMISSIONS = [
  "firebaseauth.users.get",
  "firebaseauth.users.update",
  "datastore.databases.get",
  "datastore.databases.getMetadata",
  "datastore.entities.get",
  "datastore.entities.list",
  "datastore.entities.create",
  "datastore.entities.update",
];
const vercel =
  "C:/Users/jeons/AppData/Local/npm-cache/_npx/7ce0ba5f02dd442a/node_modules/vercel/dist/vc.js";
const oauth = new OAuth2Client(cliApi.clientId(), cliApi.clientSecret());
oauth.setCredentials({ refresh_token: cfg.get("tokens")?.refresh_token });
let access;
async function cloud(url, method = "GET", body, allow404 = false) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + access,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (allow404 && response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(new Error("Cloud request failed"), {
      code: "CLOUD_" + response.status,
      status: response.status,
      stage: new URL(url).pathname.split("/").at(-1),
      detail: String(data.error?.message || "")
        .replace(
          /Bearer\s+\S+|AIza[\w-]+|-----BEGIN[\s\S]*?-----END[^-]+-----/g,
          "[redacted]",
        )
        .slice(0, 320),
    });
  return data;
}
function secret(name, value) {
  const result = spawnSync(
    process.execPath,
    [vercel, "env", "add", name, "production", "--sensitive", "--yes"],
    {
      cwd: process.cwd(),
      input: value + "\n",
      encoding: "utf8",
      timeout: 60000,
      windowsHide: true,
    },
  );
  if (result.status !== 0)
    throw Object.assign(new Error("Secret installation failed"), {
      code: "VERCEL_SECRET_FAILED",
    });
  console.log(JSON.stringify({ environment: name, installed: true }));
}
async function main() {
  const token = await oauth.getAccessToken();
  access = token.token;
  if (!access)
    throw Object.assign(Error("Login needed"), {
      code: "CLOUD_LOGIN_REQUIRED",
    });
  const owner = cfg.get("user")?.email;
  const lookup = await cloud(
    "https://identitytoolkit.googleapis.com/v1/projects/" +
      PROJECT +
      "/accounts:lookup",
    "POST",
    { email: [owner] },
  );
  const operator = lookup.users?.[0];
  if (!operator)
    throw Object.assign(Error("App administrator missing"), {
      code: "APP_ADMIN_CONFIRMATION_REQUIRED",
    });
  const profile = await cloud(
    "https://firestore.googleapis.com/v1/projects/" +
      PROJECT +
      "/databases/(default)/documents/users/" +
      operator.localId,
  );
  const role = profile.fields?.role?.stringValue;
  const required = [
    "resourcemanager.projects.getIamPolicy",
    "resourcemanager.projects.setIamPolicy",
    "iam.roles.create",
    "iam.serviceAccounts.create",
    "iam.serviceAccountKeys.create",
  ];
  const allowed = await cloud(
    "https://cloudresourcemanager.googleapis.com/v1/projects/" +
      PROJECT +
      ":testIamPermissions",
    "POST",
    { permissions: required },
  );
  const ready = required.every((p) => allowed.permissions?.includes(p));
  console.log(
    JSON.stringify({
      project: PROJECT,
      operatorUid: operator.localId,
      appRole: role || "none",
      cloudSetupAllowed: ready,
      serviceAccount: SA,
      serverPermissions: PERMISSIONS,
      apply: process.argv.includes("--apply"),
    }),
  );
  if (!process.argv.includes("--apply")) return;
  if (role !== "admin" || !ready)
    throw Object.assign(Error("Additional approval or project access needed"), {
      code:
        role !== "admin"
          ? "APP_ADMIN_CONFIRMATION_REQUIRED"
          : "CLOUD_PERMISSION_REQUIRED",
    });
  const vars = spawnSync(
    process.execPath,
    [vercel, "env", "ls", "production"],
    { cwd: process.cwd(), encoding: "utf8", windowsHide: true },
  );
  if (vars.status !== 0)
    throw Object.assign(Error("Environment preflight failed"), {
      code: "VERCEL_ENV_PREFLIGHT_FAILED",
    });
  if (/FIREBASE_ADMIN_SERVICE_ACCOUNT/.test(vars.stdout || ""))
    throw Object.assign(Error("Existing credential retained"), {
      code: "EXISTING_SERVER_CREDENTIAL_RETAINED",
    });
  const roleUrl =
    "https://iam.googleapis.com/v1/projects/" + PROJECT + "/roles/" + ROLE;
  let custom = await cloud(roleUrl, "GET", null, true);
  if (!custom)
    custom = await cloud(
      "https://iam.googleapis.com/v1/projects/" + PROJECT + "/roles",
      "POST",
      {
        roleId: ROLE,
        role: {
          title: "Prime Edu service management",
          description:
            "Selected account support and audited personal event management; no deletion, role grants or billing.",
          includedPermissions: PERMISSIONS,
          stage: "GA",
        },
      },
    );
  else if (
    custom.includedPermissions.slice().sort().join() !==
    PERMISSIONS.slice().sort().join()
  )
    throw Object.assign(Error("Existing role differs"), {
      code: "EXISTING_ROLE_MISMATCH",
    });
  const accountUrl =
    "https://iam.googleapis.com/v1/projects/" +
    PROJECT +
    "/serviceAccounts/" +
    SA;
  let account = await cloud(accountUrl, "GET", null, true);
  if (!account)
    account = await cloud(
      "https://iam.googleapis.com/v1/projects/" + PROJECT + "/serviceAccounts",
      "POST",
      {
        accountId: ACCOUNT,
        serviceAccount: { displayName: "Prime Edu service management" },
      },
    );
  if (account.disabled)
    throw Object.assign(Error("Service account disabled"), {
      code: "SERVICE_ACCOUNT_DISABLED",
    });
  const policy = await cloud(
      "https://cloudresourcemanager.googleapis.com/v1/projects/" +
        PROJECT +
        ":getIamPolicy",
      "POST",
      { options: { requestedPolicyVersion: 3 } },
    ),
    member = "serviceAccount:" + SA;
  const binding = policy.bindings.find(
    (b) => b.role === custom.name && !b.condition,
  );
  if (!binding?.members.includes(member)) {
    if (binding) binding.members.push(member);
    else policy.bindings.push({ role: custom.name, members: [member] });
    await cloud(
      "https://cloudresourcemanager.googleapis.com/v1/projects/" +
        PROJECT +
        ":setIamPolicy",
      "POST",
      { policy },
    );
  }
  const key = await cloud(accountUrl + "/keys", "POST", {
    privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
    keyAlgorithm: "KEY_ALG_RSA_2048",
  });
  const credential = Buffer.from(key.privateKeyData, "base64").toString("utf8");
  try {
    secret("FIREBASE_ADMIN_SERVICE_ACCOUNT", credential);
  } catch (e) {
    await cloud("https://iam.googleapis.com/v1/" + key.name, "DELETE").catch(
      () => {},
    );
    throw e;
  }
  const config = readFileSync(
      new URL("../js/firebase-config.js", import.meta.url),
      "utf8",
    ),
    webKey = config.match(/apiKey:\s*"([^"]+)"/)?.[1];
  if (!webKey)
    throw Object.assign(Error("Web configuration missing"), {
      code: "WEB_CONFIG_MISSING",
    });
  secret("FIREBASE_WEB_API_KEY", webKey);
  console.log(
    JSON.stringify({
      serverConnectionInstalled: true,
      project: PROJECT,
      serviceAccount: SA,
      keyStoredLocally: false,
      humanRolesChanged: false,
    }),
  );
}
main().catch((e) => {
  console.error(
    JSON.stringify({
      code: e.code || "SETUP_FAILED",
      status: e.status || null,
      stage: e.stage,
      detail: e.detail,
    }),
  );
  process.exitCode = 1;
});
