/* POST /api/studio/github  { method, path, body }  (Authorization: Bearer <session>)
 * Passes an allowed GitHub API call through with the repo token, which never
 * leaves the server. Returns { status, data }. */
import { checkSession, configured, cors, githubToken, json, vet } from "../lib/studio.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!configured()) return json(req, { error: "The Studio isn't set up yet." }, 503);
  if (!(await checkSession(req))) return json(req, { error: "Please sign in again." }, 401);

  let call;
  try { call = await req.json(); } catch { return json(req, { error: "Bad request." }, 400); }
  const method = String(call.method || "GET").toUpperCase();
  const path = String(call.path || "");
  const problem = vet(method, path, call.body);
  if (problem) return json(req, { error: problem }, 403);

  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "sharif-adornment-studio",
      ...(call.body ? { "Content-Type": "application/json" } : {}),
    },
    body: call.body ? JSON.stringify(call.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return json(req, { status: res.status, data });
};

export const config = {
  path: "/api/studio/github",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 300 },
};
