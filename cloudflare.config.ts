import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "isk-lenses-storefront",
    entrypoint: "./cloudflare-worker.ts",
    compatibilityDate: "2026-11-04",
    workersDev: true,
    observability: {
      enabled: true,
      redactQueryString: true,
      logs: {
        enabled: true,
        headSamplingRate: 1,
        invocationLogs: true,
        persist: true,
      },
    },
    domains: [
      "isklenses.com",
      "www.isklenses.com",
      "isklenses.online",
      "www.isklenses.online",
    ],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      HYPERDRIVE: bindings.hyperdrive({
        id: "9c96e464feed4d7abbabb9772308999a",
      }),
    },
  }),
});
