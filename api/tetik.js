// Vercel Sunucusuz Fonksiyon — /api/tetik?key=<NOTIFY_SECRET>[&zorla=1]
// Dış tetikleyiciler (Claude bulut bekçisi, cron-job.org vb.) bu ucu çağırır;
// GitHub PAT'ı yalnızca Vercel ortamında durur, çağıranlarda değil.
import { tetikle } from "../lib/tetik.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const url = new URL(req.url, "http://localhost");
  const gizli = process.env.NOTIFY_SECRET;
  if (!gizli || url.searchParams.get("key") !== gizli) return res.status(404).json({ error: "not found" });
  try {
    res.status(200).json(await tetikle({ zorla: url.searchParams.get("zorla") === "1" }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
