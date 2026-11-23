/**
 * OneRun's MCP server (the "Claude connector"). Customers add
 * https://www.onerunai.com/api/mcp to Claude, sign in with their OneRun
 * account (Supabase Auth acts as the OAuth server), and Claude can then make
 * Lao/Thai/English subtitles from their clips with their own OneRun quota.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

export const MCP_PATH = "/api/mcp";
export const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";

type Deps = {
  getAccount: (userId: string) => Promise<unknown>;
  createUpload: (userId: string) => Promise<{ uploadId: string; uploadUrl: string }>;
  startJob: typeof import("./connector-jobs.server").startJob;
  continueJob: typeof import("./connector-jobs.server").continueJob;
};

const serverDeps = async (): Promise<Deps> => {
  const jobs = await import("./connector-jobs.server");
  const account = await import("@/lib/account.server");
  return {
    getAccount: account.getAccountStatus,
    createUpload: jobs.createUpload,
    startJob: jobs.startJob,
    continueJob: jobs.continueJob,
  };
};

/** The public origin of this request (Vercel sends the real host). */
function originOf(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** RFC 9728 metadata telling Claude where to sign in. */
export function protectedResourceMetadata(request: Request): Response {
  const supabaseUrl = process.env["SUPABASE_URL"];
  if (!supabaseUrl) return new Response("not configured", { status: 500 });
  return Response.json(
    {
      resource: `${originOf(request)}${MCP_PATH}`,
      authorization_servers: [`${supabaseUrl.replace(/\/$/, "")}/auth/v1`],
      bearer_methods_supported: ["header"],
      resource_name: "OneRunAI",
      resource_documentation: `${originOf(request)}/claude`,
    },
    { headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } },
  );
}

function unauthorized(request: Request, message: string): Response {
  return Response.json(
    { error: "unauthorized", error_description: message },
    {
      status: 401,
      headers: {
        "www-authenticate": `Bearer resource_metadata="${originOf(request)}${RESOURCE_METADATA_PATH}"`,
      },
    },
  );
}

async function verify(token: string): Promise<{ userId: string; email: string | null } | null> {
  if (token.split(".").length !== 3) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? null };
}

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });
const failure = (error: unknown) => ({
  ...text(error instanceof Error ? error.message : String(error)),
  isError: true,
});

const UPLOAD_HELP = (url: string) =>
  [
    "1) Extract the audio as 16 kHz mono 16-bit WAV (this keeps the upload small):",
    '   ffmpeg -i "INPUT_VIDEO" -vn -ac 1 -ar 16000 -c:a pcm_s16le -y onerun-audio.wav',
    "   No ffmpeg? `python3 -m pip install imageio-ffmpeg` and use the binary from",
    '   `python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"`.',
    "2) Upload it (the link works once, for 2 hours):",
    `   curl -sS -X PUT -H "Content-Type: audio/wav" --data-binary @onerun-audio.wav "${url}"`,
    "3) Call create_subtitles with the upload_id.",
  ].join("\n");

type JobReport = Awaited<ReturnType<Deps["startJob"]>>;

function jobText(report: JobReport): string {
  if (report.status === "failed") return `งานล้มเหลว: ${report.error}`;
  if (report.status === "running") {
    return [
      `Still working: ${report.done}/${report.total} parts transcribed.`,
      `Call get_subtitles with job_id "${report.jobId}" to continue (each call carries on the work).`,
    ].join("\n");
  }
  const failed = report.result.failed.length
    ? `\nCould not transcribe these parts (seconds): ${report.result.failed
        .map((range) => `${range.start.toFixed(1)}–${range.end.toFixed(1)}`)
        .join(", ")}. Call create_subtitles again later to retry.`
    : "";
  return [
    `Done (job_id ${report.jobId}). Save the SRT below as a UTF-8 .srt file.${failed}`,
    "",
    report.result.srt,
  ].join("\n");
}

const createInput = z.object({
  upload_id: z.string(),
  language: z.enum(["lo", "th", "en"]).default("lo"),
  glossary: z.array(z.string().min(1).max(80)).max(40).optional(),
  caption_mode: z.enum(["sentence", "word", "fixed"]).optional(),
  words_per_caption: z.number().int().min(1).max(12).optional(),
});
const getInput = z.object({ job_id: z.string() });

const TOOLS = [
  {
    name: "get_account_status",
    title: "OneRun account status",
    description:
      "The customer's OneRun plan, when it ends, and how much transcription quota (seconds) is used and left.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "prepare_audio_upload",
    title: "Get an upload link",
    description:
      "Step 1 of making subtitles. Returns an upload_id and a one-time upload URL, plus the exact ffmpeg and curl commands to extract a clip's audio as 16 kHz mono WAV and upload it. Run those commands in a shell on the computer that has the video.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_subtitles",
    title: "Make subtitles",
    description:
      "Step 2. Transcribes the uploaded audio into subtitles (SRT) with OneRun's Lao-tuned speech recognition. Short clips finish in this call; long ones return a job_id to pass to get_subtitles. Uses the customer's OneRun quota.",
    inputSchema: {
      type: "object",
      properties: {
        upload_id: { type: "string", description: "The upload_id from prepare_audio_upload" },
        language: {
          type: "string",
          enum: ["lo", "th", "en"],
          default: "lo",
          description: "Spoken language: lo = Lao (default), th = Thai, en = English",
        },
        glossary: {
          type: "array",
          items: { type: "string", maxLength: 80 },
          maxItems: 40,
          description: "Names and special words spelled as they should appear",
        },
        caption_mode: {
          type: "string",
          enum: ["sentence", "word", "fixed"],
          description: "How lines are split: sentence (default), word, or a fixed word count",
        },
        words_per_caption: {
          type: "integer",
          minimum: 1,
          maximum: 12,
          description: "Words per line when caption_mode is fixed",
        },
      },
      required: ["upload_id"],
    },
  },
  {
    name: "get_subtitles",
    title: "Continue or fetch subtitles",
    description:
      "Continues a long subtitle job and returns the SRT once it is done. Call again while it says it is still working.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string", description: "The job_id from create_subtitles" } },
      required: ["job_id"],
    },
  },
];

async function callTool(name: string, args: unknown, user: { userId: string }, deps: Deps) {
  switch (name) {
    case "get_account_status":
      return text(JSON.stringify(await deps.getAccount(user.userId), null, 2));
    case "prepare_audio_upload": {
      const upload = await deps.createUpload(user.userId);
      return text(
        [
          `upload_id: ${upload.uploadId}`,
          `upload_url: ${upload.uploadUrl}`,
          "",
          UPLOAD_HELP(upload.uploadUrl),
        ].join("\n"),
      );
    }
    case "create_subtitles": {
      const input = createInput.parse(args ?? {});
      const report = await deps.startJob(user.userId, {
        uploadId: input.upload_id,
        language: input.language,
        glossary: input.glossary ?? [],
        ...(input.caption_mode ? { captionMode: input.caption_mode } : {}),
        ...(input.words_per_caption ? { wordsPerCaption: input.words_per_caption } : {}),
      });
      return text(jobText(report));
    }
    case "get_subtitles": {
      const input = getInput.parse(args ?? {});
      return text(jobText(await deps.continueJob(user.userId, input.job_id)));
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function buildServer(user: { userId: string }, deps: Deps): Server {
  const server = new Server(
    { name: "onerunai", title: "OneRunAI", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions: [
        "OneRunAI makes accurate Lao (also Thai and English) subtitles from speech.",
        "Flow: prepare_audio_upload → extract audio with ffmpeg and upload it with curl →",
        "create_subtitles → if it says it is still working, call get_subtitles until done.",
        "Each minute of speech uses the customer's OneRun quota, as on onerunai.com.",
      ].join(" "),
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await callTool(request.params.name, request.params.arguments, user, deps);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return failure(
          new Error(
            `Invalid arguments: ${error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
          ),
        );
      }
      return failure(error);
    }
  });
  return server;
}

/** Handles one MCP HTTP request (stateless: a fresh server per request). */
export async function handleMcpRequest(
  request: Request,
  overrides: {
    verify?: typeof verify;
    deps?: Deps;
  } = {},
): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return unauthorized(request, "Sign in to OneRunAI to use this connector.");
  const user = await (overrides.verify ?? verify)(token);
  if (!user) return unauthorized(request, "The sign-in has expired. Connect OneRunAI again.");

  // Stateless: no server-to-client stream to keep open.
  if (request.method === "GET" || request.method === "DELETE") {
    return new Response(null, { status: 405, headers: { allow: "POST" } });
  }
  const server = buildServer(user, overrides.deps ?? (await serverDeps()));
  // No session id generator: stateless mode.
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void server.close();
  }
}
