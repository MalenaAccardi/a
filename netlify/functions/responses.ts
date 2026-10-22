import { getStore } from "@netlify/blobs";

type SurveyResponse = { userId: string; expected: number | null; real: number | null; t: number };

// One blob per user, so concurrent submissions from different users never overwrite each other
const store = () => getStore({ name: "survey-responses", consistency: "strong" });

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const json = (data: unknown, status = 200) => Response.json(data, { status, headers });

// Accepts numbers between 0 and 10 (or null); anything else is rejected
function parseScore(v: unknown): number | null | undefined {
  if (v === null) return null;
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 10) return undefined;
  return Math.round(n * 10) / 10;
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const s = store();

  if (req.method === "GET") {
    const { blobs } = await s.list();
    const rows = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }) as Promise<SurveyResponse | null>));
    return json(rows.filter((r): r is SurveyResponse => r !== null).sort((a, b) => a.t - b.t));
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) return json({ error: "Falta userId" }, 400);

  if (req.method === "POST") {
    const expected = parseScore(body.expected);
    if (expected === undefined) return json({ error: "Nota esperada inválida" }, 400);
    const existing = (await s.get(userId, { type: "json" })) as SurveyResponse | null;
    await s.setJSON(userId, existing ? { ...existing, expected } : { userId, expected, real: null, t: Date.now() });
    return json({ success: true });
  }

  if (req.method === "PUT") {
    const real = parseScore(body.real);
    if (real === undefined) return json({ error: "Nota real inválida" }, 400);
    const existing = (await s.get(userId, { type: "json" })) as SurveyResponse | null;
    if (!existing) return json({ error: "Usuario no encontrado" }, 404);
    await s.setJSON(userId, { ...existing, real });
    return json({ success: true });
  }

  if (req.method === "DELETE") {
    await s.delete(userId);
    return json({ success: true });
  }

  return json({ error: "Método no permitido" }, 405);
};
