import { defineConfig } from "vite";
import { cpSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

const sourcePublicDir = resolve("public");
const cloudflarePublicDir = resolve(".cloudflare/public");
const androidApkPath = `${sourcePublicDir}${sep}isklenses.apk`;

rmSync(cloudflarePublicDir, { recursive: true, force: true });
cpSync(sourcePublicDir, cloudflarePublicDir, {
  recursive: true,
  filter: (source) => source !== androidApkPath,
});

export default defineConfig({
  publicDir: cloudflarePublicDir,
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
