/**
 * Firebase Auth 승인 도메인 추가 (firebase login 필요)
 * Usage: node add-auth-domain.mjs schems21.netlify.app
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { OAuth2Client } from "google-auth-library";

const PROJECT_ID = "scheplan";
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_CLI_CLIENT_SECRET = "j9phCwe4SNuuMEDVh7pJi";
const BASE = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;

async function getAccessToken() {
  const cfg = JSON.parse(
    readFileSync(join(homedir(), ".config", "configstore", "firebase-tools.json"), "utf8")
  );
  const tokens = cfg.tokens;
  if (!tokens?.refresh_token) throw new Error("firebase login 이 필요합니다.");
  if (tokens.expires_at > Date.now() + 120000 && tokens.access_token) return tokens.access_token;
  const oauth2 = new OAuth2Client(FIREBASE_CLI_CLIENT_ID, FIREBASE_CLI_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: tokens.refresh_token });
  const res = await oauth2.getAccessToken();
  return typeof res === "string" ? res : res?.token;
}

const domain = process.argv[2]?.trim().toLowerCase();
if (!domain) {
  console.error("Usage: node add-auth-domain.mjs <domain>");
  process.exit(1);
}

const token = await getAccessToken();
const getRes = await fetch(BASE, {
  headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
});
if (!getRes.ok) throw new Error(`getConfig failed: ${getRes.status} ${await getRes.text()}`);
const config = await getRes.json();
const current = config.authorizedDomains || [];
if (current.includes(domain)) {
  console.log(`이미 등록됨: ${domain}`);
  console.log("현재:", current.join(", "));
  process.exit(0);
}
const next = [...current, domain];
const patchRes = await fetch(`${BASE}?updateMask=authorizedDomains`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ authorizedDomains: next })
});
if (!patchRes.ok) throw new Error(`updateConfig failed: ${patchRes.status} ${await patchRes.text()}`);
console.log(`추가 완료: ${domain}`);
console.log("현재:", next.join(", "));
