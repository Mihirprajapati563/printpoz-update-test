import { app } from "electron";
import type { AppConfig, AppEnv, AppChannel } from "../shared/ipc";

// Resolve runtime config. Defaults to printpoz production (matches the web app).
// Override per environment via env vars at launch, e.g.:
//   PE_ENV=staging PE_API_BASE_URL=https://staging.../api/v1/ electron .
// const DEFAULT_API = "http://192.168.29.203:3006/api/v1/";
const DEFAULT_API = "https://apis.printpoz.com/api/v1/";

const VALID_ENVS: AppEnv[] = ["development", "staging", "production"];
const VALID_CHANNELS: AppChannel[] = ["stable", "beta"];

export function resolveConfig(): AppConfig {
  const rawEnv = process.env.PE_ENV;
  const rawChannel = process.env.PE_CHANNEL;
  const env: AppEnv = VALID_ENVS.includes(rawEnv as AppEnv) ? (rawEnv as AppEnv) : "production";
  const channel: AppChannel = VALID_CHANNELS.includes(rawChannel as AppChannel)
    ? (rawChannel as AppChannel)
    : "stable";
  return {
    apiBaseUrl: process.env.PE_API_BASE_URL || DEFAULT_API,
    orderApiBaseUrl: process.env.PE_ORDER_API_BASE_URL || DEFAULT_API,
    env,
    channel,
    enableDevTools: process.env.PE_DEVTOOLS === "true",
    isDesktop: true,
    platform: process.platform,
    version: app.getVersion(),
    // enableDevTools: process.env.PE_DEVTOOLS === "true",
  };
}
