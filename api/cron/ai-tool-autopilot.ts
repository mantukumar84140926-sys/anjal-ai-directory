type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};
type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const SUPABASE_FUNCTIONS_URL =
  "https://fqxxsibgrzbkncyymjqk.supabase.co/functions/v1";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization;
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Keep the shared secret server-side. It is forwarded only to the two
  // authenticated Supabase functions and is never returned or logged.
  const headers = {
    "Content-Type": "application/json",
    "x-autopilot-secret": cronSecret,
  };

  const results: Record<string, unknown> = {};
  for (const functionName of [
    "ai-tool-autopilot-discover",
    "ai-tool-autopilot-verify",
  ]) {
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/${functionName}`, {
        method: "POST",
        headers,
        body: "{}",
        signal: AbortSignal.timeout(55_000),
      });
      const body = await response.json().catch(() => ({ error: "Invalid JSON response" }));
      results[functionName] = { httpStatus: response.status, body };
      if (!response.ok) {
        return res.status(502).json({
          status: "partial",
          failedFunction: functionName,
          results,
        });
      }
    } catch {
      return res.status(502).json({
        status: "partial",
        failedFunction: functionName,
        error: "Supabase function request failed or timed out",
        results,
      });
    }
  }

  return res.status(200).json({
    status: "completed",
    results,
    note: "Discovery and conservative screening ran. No candidate is auto-verified or published.",
  });
}
