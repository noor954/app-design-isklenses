import { env as processEnv } from "node:process";

const apkPath = "/isklenses.apk";
const apkOrigin =
  "https://raw.githubusercontent.com/qaiserfccc/e-commerce-app-design/main/public/isklenses.apk";
let appPromise: Promise<typeof import("vinext/server/fetch-handler")> | undefined;

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname !== apkPath) {
      const connectionString = env.HYPERDRIVE?.connectionString;
      if (!connectionString) {
        throw new Error("Cloudflare Hyperdrive binding is not configured.");
      }

      processEnv.DATABASE_URL = connectionString;
      appPromise ??= import("vinext/server/fetch-handler");
      const { default: app } = await appPromise;
      const { createRequestPool, runWithRequestPool } = await import("./lib/db/index");
      const requestPool = createRequestPool(connectionString);
      let poolClosed = false;
      const closePool = async () => {
        if (poolClosed) return;
        poolClosed = true;
        await requestPool.end();
      };

      try {
        const response = await runWithRequestPool(requestPool, () => app.fetch(request, env, ctx));
        if (!response.body) {
          await closePool();
          return response;
        }

        const reader = response.body.getReader();
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                await closePool();
              } else {
                controller.enqueue(value);
              }
            } catch (error) {
              controller.error(error);
              await closePool();
            }
          },
          async cancel(reason) {
            try {
              await reader.cancel(reason);
            } finally {
              await closePool();
            }
          },
        });

        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch (error) {
        await closePool();
        throw error;
      }
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const upstreamHeaders = new Headers();
    const range = request.headers.get("range");
    if (range) upstreamHeaders.set("Range", range);
    const upstream = await fetch(apkOrigin, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "follow",
    });
    if (!upstream.ok && upstream.status !== 206) {
      return new Response("Release not found", { status: upstream.status });
    }

    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": 'attachment; filename="isklenses.apk"',
      "Content-Type": "application/vnd.android.package-archive",
    });
    for (const name of ["content-length", "content-range", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
