import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ProviderModelConfig } from "@mariozechner/pi-ai";
import type { OAuthCredentials, OAuthLoginCallbacks } from "@mariozechner/pi-ai";

const MODELS_INFO_URL = "https://api.code.umans.ai/v1/models/info";

// Fallback models used if the dynamic fetch fails
const FALLBACK_MODELS: ProviderModelConfig[] = [
  {
    id: "umans-coder",
    name: "Umans Coder",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 256000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false
    }
  },
  {
    id: "umans-kimi-k2.5",
    name: "Umans Kimi K2.5",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 256000,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false
    }
  },
  {
    id: "umans-kimi-k2.6",
    name: "Umans Kimi K2.6",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 262144,
    maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false
    }
  },
  {
    id: "umans-glm-5.1",
    name: "Umans GLM 5.1",
    reasoning: true,
    input: ["text"],
    contextWindow: 204800,
    maxTokens: 131072,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false
    }
  },
  {
    id: "umans-minimax-m2.5",
    name: "Umans MiniMax M2.5",
    reasoning: true,
    input: ["text"],
    contextWindow: 204800,
    maxTokens: 131072,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false
    }
  }
];

function mapUmansModel(id: string, info: any): ProviderModelConfig {
  const caps = info.capabilities ?? {};
  const supportsVision = caps.supports_vision === true;

  return {
    id,
    name: info.display_name || id,
    reasoning: true,
    input: supportsVision ? ["text", "image"] : ["text"],
    contextWindow: caps.context_window ?? 200000,
    maxTokens: caps.max_tokens ?? 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false
    }
  };
}

// Fetch dynamic models at module load time (top-level await in ESM)
let models: ProviderModelConfig[] = FALLBACK_MODELS;

try {
  const res = await fetch(MODELS_INFO_URL, { signal: AbortSignal.timeout(5000) });
  if (res.ok) {
    const data = await res.json();
    models = Object.entries(data).map(([id, info]) => mapUmansModel(id, info as any));
  } else {
    console.warn(`[pi-provider-umans] Models API returned ${res.status}, using fallback`);
  }
} catch (err) {
  console.warn("[pi-provider-umans] Failed to fetch dynamic models, using fallback:", err);
}

// OAuth-style login that stores the API key in auth.json
// This lets users run `/login umans` and paste their API key
async function loginUmans(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
  const apiKey = await callbacks.onPrompt({
    message: "Enter your Umans API key (starts with sk-):"
  });

  // Strip whitespace and validate basic prefix
  const key = apiKey.trim();
  if (!key.startsWith("sk-")) {
    throw new Error("Invalid API key: must start with 'sk-'");
  }

  return {
    refresh: key,
    access: key,
    expires: 0 // API key doesn't expire
  };
}

function refreshUmansToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
  // API keys don't need refreshing — return as-is
  return Promise.resolve(credentials);
}

function getApiKey(credentials: OAuthCredentials): string {
  return credentials.access;
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider("umans", {
    baseUrl: "https://api.code.umans.ai/v1",
    api: "openai-completions",
    apiKey: "UMANS_API_KEY", // fallback: env var
    authHeader: true,
    models,
    oauth: {
      name: "Umans AI (API Key)",
      login: loginUmans,
      refreshToken: refreshUmansToken,
      getApiKey,
    }
  });
}
