import { aiImportPipelineEnabled } from "@/lib/ai/import-pipeline-config";
import { readScreenshot, ScreenshotReaderError } from "@/lib/ai/read-screenshot";
import { isSupportedScreenshot } from "@/lib/ai/screenshot-contract";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  // The server flag is authoritative, including for a stale enabled browser.
  if (!aiImportPipelineEnabled()) return Response.json({ error: "Screenshot import is unavailable.", code: "feature_unavailable" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in before importing a screenshot." }, { status: 401 });

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return Response.json({ error: "Send one screenshot as multipart form data in the image field.", code: "invalid_input" }, { status: 400 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send valid multipart form data with one screenshot.", code: "invalid_input" }, { status: 400 });
  }
  const entries = [...form.entries()];
  const image = form.get("image");
  if (entries.length !== 1 || !(image instanceof File) || !isSupportedScreenshot(image.type, image.size)) {
    return Response.json({ error: "Choose one nonempty PNG, JPEG, or WebP screenshot up to 4 MB.", code: "invalid_input" }, { status: 400 });
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await image.arrayBuffer());
  } catch {
    return Response.json({ error: "The screenshot upload could not be read. Try another image or paste the text.", code: "invalid_input" }, { status: 400 });
  }
  try {
    const result = await readScreenshot({ bytes, mimeType: image.type });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ScreenshotReaderError) {
      const status = error.code === "missing_key" ? 503 : error.code === "invalid_input" ? 400 : error.code === "refusal" || error.code === "unreadable" ? 422 : 502;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    return Response.json({ error: "The screenshot reading service could not complete this request. Try again or paste the text.", code: "provider_error" }, { status: 502 });
  }
}
