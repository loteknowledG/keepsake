import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readBody(request: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request as AsyncIterable<Buffer>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

type VercelRequest = NodeJS.ReadableStream & {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Load-Name");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    response.status(503).json({ error: "Load hosting is not configured on this deployment." });
    return;
  }

  try {
    const body = await readBody(request);
    if (body.length === 0) {
      response.status(400).json({ error: "Empty Load upload." });
      return;
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      response.status(413).json({ error: `Load exceeds ${MAX_UPLOAD_BYTES.toLocaleString()}-byte hosted link limit.` });
      return;
    }

    const rawName = request.headers["x-load-name"];
    const fileName = typeof rawName === "string" && rawName.trim() ? rawName.trim() : "shared.muthur.load";
    const blob = await put(`loads/${randomUUID()}.muthur.load`, body, {
      access: "public",
      contentType: "application/vnd.keepseek.muthurload+zip",
      addRandomSuffix: false,
    });

    response.status(200).json({ url: blob.url, fileName });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
}
