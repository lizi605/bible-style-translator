import { NextRequest, NextResponse } from "next/server";
import { normalizeCuvSceneLexicon } from "@/lib/cuvLexicon";
import {
  buildEditionPrompt,
  buildPlainPrompt,
  buildScripturePrompt,
  buildStructuredStoryRealizationPrompt,
  KJV_SYSTEM_PROMPT,
  PLAIN_SYSTEM_PROMPT,
  SCRIPTURE_SYSTEM_PROMPT,
  SIGAO_SYSTEM_PROMPT,
  STRUCTURED_STORY_REALIZATION_SYSTEM_PROMPT,
  type PlainMode,
  type ScriptureDirection,
  type ScriptureEdition,
  type ScriptureLevel,
  type ScriptureMode,
} from "@/lib/prompt";
import {
  assessUnionStyleResult,
  normalizeUnionNarration,
} from "@/lib/scriptureQuality";
import {
  classifyScriptureSource,
  definitionTermsArePreserved,
  hasForbiddenMoralization,
  renderDefinitionSource,
  renderSafeFactualSource,
} from "@/lib/scriptureGenre";
import {
  assessScriptureStoryPlan,
  assessScriptureStoryResult,
  buildSkeletonIdentificationPrompt,
  groundScriptureSkeletonPlan,
  parseScriptureSkeletonPlan,
  renderScriptureSkeletonPlan,
  type ScriptureSkeletonPlan,
} from "@/lib/scriptureSkeletons";
import {
  renderNeutralStoryClosure,
  renderStoryReflection,
} from "@/lib/scriptureReflections";
import { segmentScriptureText } from "@/lib/scriptureVerses";
import { renderRecognizableSourceAphorism } from "@/lib/cuvAphorismSkeletons";
import {
  assessScriptureLength,
  buildLengthInstruction,
  getScriptureLengthTarget,
  structureTokenBudget,
} from "@/lib/scriptureLength";
import {
  isCriticalStoryIssue,
  splitStoryIssues,
} from "@/lib/storyIssueSeverity";

export const runtime = "nodejs";

const VALID_MODES = new Set<ScriptureMode>([
  "original",
  "babel",
  "loaves",
  "david",
  "prodigal",
  "samaritan",
  "ark",
  "solomon",
  "jonah",
]);
const VALID_LEVELS = new Set<ScriptureLevel>(["light", "standard", "grand"]);
const VALID_EDITIONS = new Set<ScriptureEdition>(["cuv", "sigao", "kjv"]);
const VALID_DIRECTIONS = new Set<ScriptureDirection>([
  "to_scripture",
  "to_plain",
]);
const VALID_PLAIN_MODES = new Set<PlainMode>([
  "direct",
  "explain",
  "subtext",
  "roast",
]);

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_WINDOW_LIMIT = 12;
const RATE_DAY_LIMIT = 60;

type RateRecord = {
  windowStartedAt: number;
  windowCount: number;
  day: string;
  dayCount: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  scriptureRateLimit?: Map<string, RateRecord>;
};

type GenerationMode =
  | "local_primary"
  | "structured"
  | "auto_repaired"
  | "best_effort";

function finalizeScriptureResult(
  source: string,
  value: string,
  edition: ScriptureEdition = "cuv",
) {
  let result = value.trim();
  if (edition === "cuv") {
    result = normalizeCuvSceneLexicon(source, normalizeUnionNarration(result));
    if (
      hasForbiddenMoralization(source, result) ||
      !definitionTermsArePreserved(source, result)
    ) {
      result = renderSafeFactualSource(source);
    }
  }
  return { result, verses: segmentScriptureText(result) };
}

function scriptureResponse(
  source: string,
  value: string,
  edition: ScriptureEdition,
  generationMode: GenerationMode,
  warning?: string,
) {
  return {
    ...finalizeScriptureResult(source, value, edition),
    generationMode,
    ...(warning ? { warning } : {}),
  };
}
const rateLimit =
  globalForRateLimit.scriptureRateLimit ?? new Map<string, RateRecord>();
globalForRateLimit.scriptureRateLimit = rateLimit;

function getShanghaiDay(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("cf-connecting-ip") || "unknown";
  const clientId = request.headers.get("x-client-id")?.slice(0, 80) || "anonymous";
  return `${ip}:${clientId}`;
}

function getUserApiKey(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const day = getShanghaiDay(now);
  const current = rateLimit.get(key);

  if (!current) {
    rateLimit.set(key, {
      windowStartedAt: now,
      windowCount: 1,
      day,
      dayCount: 1,
    });
    return null;
  }
  if (current.day !== day) {
    current.day = day;
    current.dayCount = 0;
  }
  if (now - current.windowStartedAt >= RATE_WINDOW_MS) {
    current.windowStartedAt = now;
    current.windowCount = 0;
  }
  if (current.windowCount >= RATE_WINDOW_LIMIT) {
    const retryAfter = Math.max(
      1,
      Math.ceil((RATE_WINDOW_MS - (now - current.windowStartedAt)) / 1000),
    );
    return { message: `请求稍多，请在 ${retryAfter} 秒后再试。`, retryAfter };
  }
  if (current.dayCount >= RATE_DAY_LIMIT) {
    return { message: "今日请求次数已达上限，请明日再来。", retryAfter: 3600 };
  }

  current.windowCount += 1;
  current.dayCount += 1;
  rateLimit.set(key, current);
  return null;
}

function cleanGeneratedText(value: string) {
  return value
    .trim()
    .replace(/^```(?:json|text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^#{1,6}\s+[^\n]+\n+/u, "")
    .replace(/^(?:改写结果|译文|正文|现代释义)[：:]\s*/u, "")
    .trim();
}

function upstreamErrorMessage(status: number, raw: string) {
  const normalized = raw.toLowerCase();
  if (status === 400 && normalized.includes("supported api model names")) {
    return "当前配置的模型名称不受接口支持，请将 DEEPSEEK_MODEL 改为 deepseek-v4-flash 或接口列出的可用模型。";
  }
  if (status === 400) {
    return "模型拒绝了本次请求参数，系统没有使用固定兜底稿冒充结果；请检查接口模型配置后重试。";
  }
  if (status === 401 || status === 403) {
    return "模型接口的 API Key 无效或没有权限，请检查 Key、接口地址与模型后重试。";
  }
  if (
    status === 402 ||
    normalized.includes("insufficient balance") ||
    normalized.includes("insufficient quota")
  ) {
    return "模型接口账户余额或额度不足，请充值后重试。";
  }
  if (status === 429) {
    return "模型接口当前繁忙或触发限流，请稍后再试。";
  }
  return "上游模型暂时没有回应，请稍后再试。";
}

type DeepSeekCallOptions = {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  deadlineAt: number;
  temperature?: number;
  jsonObject?: boolean;
  model?: string;
  systemRole?: boolean;
  tokenField?: "max_tokens" | "max_completion_tokens";
  omitTemperature?: boolean;
  reasoningControl?: "deepseek" | "qwen" | false;
  callTimeoutMs?: number;
};

type ModelCapability = {
  model: string;
  jsonObject: boolean;
  systemRole: boolean;
  tokenField: "max_tokens" | "max_completion_tokens";
  temperature: boolean;
  reasoningControl: "deepseek" | "qwen" | false;
};

const globalForModelCompatibility = globalThis as typeof globalThis & {
  scriptureModelCapabilities?: Map<string, ModelCapability>;
};
const modelCapabilityCache =
  globalForModelCompatibility.scriptureModelCapabilities ??
  new Map<string, ModelCapability>();
globalForModelCompatibility.scriptureModelCapabilities = modelCapabilityCache;

function modelBaseUrl() {
  return (
    process.env.AI_BASE_URL ||
    process.env.DEEPSEEK_BASE_URL ||
    "https://api.deepseek.com"
  )
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/i, "");
}

function configuredModel() {
  return (
    process.env.AI_MODEL ||
    process.env.DEEPSEEK_MODEL ||
    "deepseek-v4-flash"
  ).trim();
}

function providerReasoningControl(baseUrl: string) {
  if (/deepseek/u.test(baseUrl)) return "deepseek" as const;
  if (/dashscope|aliyun|qwen/u.test(baseUrl)) return "qwen" as const;
  return false;
}

function planningCallTimeout(sourceLength: number) {
  if (sourceLength >= 1000) return 36000;
  if (sourceLength >= 500) return 30000;
  if (sourceLength >= 250) return 26000;
  return 22000;
}

function providerModelCandidates(baseUrl: string, preferred: string) {
  const configuredCandidates = (
    process.env.AI_MODEL_CANDIDATES ||
    process.env.DEEPSEEK_MODEL_CANDIDATES ||
    ""
  )
    .split(/[,，\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const providerCandidates = /dashscope|aliyun|qwen/u.test(baseUrl)
    ? ["qwen-plus", "qwen-turbo", "qwen-max"]
    : /bigmodel|zhipu|glm/u.test(baseUrl)
      ? ["glm-4-flash", "glm-4-plus", "glm-4"]
      : /moonshot|kimi/u.test(baseUrl)
        ? ["kimi-k2-turbo-preview", "moonshot-v1-8k"]
        : /openai/u.test(baseUrl)
          ? ["gpt-4.1-mini", "gpt-4o-mini"]
          : /deepseek/u.test(baseUrl)
            ? [
                "deepseek-v4-flash",
                "deepseek-v4-pro",
                "deepseek-chat",
                "deepseek-reasoner",
              ]
            : [];
  return [...new Set([preferred, ...configuredCandidates, ...providerCandidates])];
}

function errorRaw(error: unknown) {
  return typeof error === "object" && error && "raw" in error
    ? String((error as { raw?: string }).raw || "")
    : "";
}

function errorStatus(error: unknown) {
  return typeof error === "object" && error && "status" in error
    ? Number((error as { status?: number }).status || 0)
    : 0;
}

function extractSupportedModels(raw: string) {
  const matches = raw.match(
    /\b(?:deepseek|qwen|glm|gpt|o\d|kimi|moonshot|mistral|llama|claude)[A-Za-z0-9._-]*\b/giu,
  ) || [];
  return [...new Set(matches)].sort((left, right) => {
    const fast = (value: string) => Number(/flash|mini|turbo/u.test(value));
    return fast(right) - fast(left);
  });
}

function isModelNameCompatibilityError(raw: string) {
  return /supported api model|unsupported model|model.{0,20}(?:not found|does not exist|not supported|invalid)|invalid.{0,12}model/u.test(
    raw,
  );
}

function isJsonModeCompatibilityError(raw: string) {
  return /response_format|json_object|json mode|structured output/u.test(raw) &&
    /unsupported|not support|unknown|invalid|unrecognized|not allowed/u.test(raw);
}

function isSystemRoleCompatibilityError(raw: string) {
  return /system.{0,20}(?:role|message)|role.{0,20}system/u.test(raw) &&
    /unsupported|not support|invalid|not allowed/u.test(raw);
}

function isTokenFieldCompatibilityError(raw: string) {
  return /max_tokens|max_completion_tokens/u.test(raw) &&
    /unsupported|unknown|unrecognized|invalid/u.test(raw);
}

function isTemperatureCompatibilityError(raw: string) {
  return /temperature/u.test(raw) &&
    /unsupported|not support|unknown|unrecognized|invalid|only the default/u.test(raw);
}

function isReasoningControlCompatibilityError(raw: string) {
  return /thinking|enable_thinking|reasoning/u.test(raw) &&
    /unsupported|not support|unknown|unrecognized|invalid|not allowed|extra inputs/u.test(raw);
}

async function callDeepSeek(options: DeepSeekCallOptions) {
  const baseUrl = modelBaseUrl();
  const model = options.model || configuredModel();
  const configuredCallTimeout = Number(
    process.env.DEEPSEEK_CALL_TIMEOUT_MS || String(options.callTimeoutMs || 22000),
  );
  const callTimeout = Number.isFinite(configuredCallTimeout)
    ? Math.min(Math.max(configuredCallTimeout, 8000), 45000)
    : 22000;
  const remainingTime = options.deadlineAt - Date.now();
  if (remainingTime < 1000) {
    throw new DOMException("请求时间预算已用尽", "TimeoutError");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.systemRole === false
        ? [
            {
              role: "user",
              content: `${options.systemPrompt}\n\n${options.userPrompt}`,
            },
          ]
        : [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: options.userPrompt },
          ],
      ...(options.omitTemperature
        ? {}
        : { temperature: options.temperature ?? 0.2 }),
      ...(options.reasoningControl === "deepseek"
        ? { thinking: { type: "disabled" } }
        : options.reasoningControl === "qwen"
          ? { enable_thinking: false }
          : {}),
      [options.tokenField || "max_tokens"]: options.maxTokens,
      stream: false,
      ...(options.jsonObject
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
    signal: AbortSignal.timeout(
      Math.max(1000, Math.min(callTimeout, remainingTime)),
    ),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw Object.assign(new Error(upstreamErrorMessage(response.status, raw)), {
      status: response.status,
      raw,
      model,
    });
  }

  let payload: { choices?: Array<{ message?: { content?: string } }> };
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("上游返回了无法解析的内容，请稍后再试。");
  }
  const result = payload.choices?.[0]?.message?.content;
  if (!result?.trim()) throw new Error("模型没有生成有效内容，请重试。");
  return cleanGeneratedText(result);
}

async function callCompatibleModel(options: DeepSeekCallOptions) {
  const baseUrl = modelBaseUrl();
  const preferred = options.model?.trim() || configuredModel();
  const cacheKey = `${baseUrl}|${preferred}`;
  const cached = modelCapabilityCache.get(cacheKey);
  const modelQueue = providerModelCandidates(baseUrl, preferred);
  if (cached) {
    modelQueue.splice(0, modelQueue.length, cached.model, ...modelQueue);
  }

  let capability: ModelCapability = cached || {
    model: modelQueue.shift() || preferred,
    jsonObject: Boolean(options.jsonObject),
    systemRole: true,
    tokenField: "max_tokens",
    temperature: true,
    reasoningControl: providerReasoningControl(baseUrl),
  };
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await callDeepSeek({
        ...options,
        model: capability.model,
        jsonObject: options.jsonObject ? capability.jsonObject : false,
        systemRole: capability.systemRole,
        tokenField: capability.tokenField,
        omitTemperature: !capability.temperature,
        reasoningControl: capability.reasoningControl,
      });
      modelCapabilityCache.set(cacheKey, capability);
      return result;
    } catch (error) {
      lastError = error;
      const status = errorStatus(error);
      const raw = errorRaw(error).toLowerCase();
      if (![400, 404, 422].includes(status)) throw error;

      if (options.jsonObject && capability.jsonObject && isJsonModeCompatibilityError(raw)) {
        capability = { ...capability, jsonObject: false };
        continue;
      }
      if (capability.systemRole && isSystemRoleCompatibilityError(raw)) {
        capability = { ...capability, systemRole: false };
        continue;
      }
      if (isTokenFieldCompatibilityError(raw)) {
        capability = {
          ...capability,
          tokenField:
            capability.tokenField === "max_tokens"
              ? "max_completion_tokens"
              : "max_tokens",
        };
        continue;
      }
      if (capability.temperature && isTemperatureCompatibilityError(raw)) {
        capability = { ...capability, temperature: false };
        continue;
      }
      if (
        capability.reasoningControl &&
        isReasoningControlCompatibilityError(raw)
      ) {
        capability = { ...capability, reasoningControl: false };
        continue;
      }
      if (isModelNameCompatibilityError(raw)) {
        const offered = extractSupportedModels(raw);
        for (const model of [...offered, ...modelQueue]) {
          if (model && model !== capability.model) {
            capability = { ...capability, model };
            modelQueue.splice(0, modelQueue.length, ...modelQueue.filter((item) => item !== model));
            break;
          }
        }
        if (capability.model !== (error as { model?: string }).model) continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function shouldExposeUpstreamError(error: unknown) {
  return [400, 401, 402, 403, 404, 422, 429].includes(errorStatus(error));
}

function storyClosure(plan: ScriptureSkeletonPlan) {
  return plan.reflection?.enabled
    ? renderStoryReflection(plan.reflection)
    : renderNeutralStoryClosure();
}

function stripGeneratedStoryClosure(value: string) {
  return value
    .trim()
    .replace(
      /(?:\n+|^)(?:这事的结局，就是这样。|所记的事，就是这些。|这事就这样成了。)\s*$/u,
      "",
    )
    .trim();
}

function attachStoryClosure(value: string, plan: ScriptureSkeletonPlan) {
  const body = stripGeneratedStoryClosure(value);
  const closure = storyClosure(plan);
  if (!closure || body.endsWith(closure)) return body;
  return `${body}\n\n${closure}`;
}

function minimumStoryFactScore(source: string, level: ScriptureLevel) {
  const length = [...source].length;
  if (length >= 350) return 0;
  if (length >= 220) return level === "light" ? 0.34 : 0.4;
  return 0.58;
}

export async function POST(request: NextRequest) {
  const apiKey = getUserApiKey(request);
  if (!apiKey || apiKey.length < 20 || /\s/.test(apiKey)) {
    return NextResponse.json(
      { error: "请先配置有效的模型 API Key。" },
      { status: 401 },
    );
  }

  const limited = checkRateLimit(getClientKey(request));
  if (limited) {
    return NextResponse.json(
      { error: limited.message },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求内容不是有效 JSON。" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const direction = payload.direction as ScriptureDirection;
  const mode = payload.mode as ScriptureMode;
  const level = payload.level as ScriptureLevel;
  const edition = (payload.edition || "cuv") as ScriptureEdition;
  const requestedModel =
    typeof payload.model === "string" ? payload.model.trim() : "";
  const plainMode = payload.plainMode as PlainMode;
  const variation = Number.isFinite(Number(payload.variation))
    ? Math.max(0, Math.min(99, Number(payload.variation)))
    : 0;
  const isPlainDirection = direction === "to_plain";

  if (!text) {
    return NextResponse.json({ error: "请先输入要转换的文字。" }, { status: 400 });
  }
  if (!VALID_DIRECTIONS.has(direction) || !VALID_LEVELS.has(level)) {
    return NextResponse.json({ error: "转换选项无效。" }, { status: 400 });
  }
  if (!isPlainDirection && !VALID_EDITIONS.has(edition)) {
    return NextResponse.json({ error: "译本风格选项无效。" }, { status: 400 });
  }
  if (
    requestedModel &&
    !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/u.test(requestedModel)
  ) {
    return NextResponse.json(
      { error: "模型名称格式无效；请只使用字母、数字、点、横线、斜线或冒号。" },
      { status: 400 },
    );
  }
  if (!isPlainDirection && !VALID_MODES.has(mode)) {
    return NextResponse.json({ error: "文体选项无效。" }, { status: 400 });
  }
  if (isPlainDirection && !VALID_PLAIN_MODES.has(plainMode)) {
    return NextResponse.json({ error: "释义方式无效。" }, { status: 400 });
  }

  const maxInputLength = 3000;
  if (text.length > maxInputLength) {
    return NextResponse.json(
      {
        error: isPlainDirection
          ? "文体文本最多 3000 字，请分批解释。"
          : "现代文案最多 3000 字，请分批改写。",
      },
      { status: 400 },
    );
  }

  const configuredMax = Number(process.env.MAX_OUTPUT_TOKENS || "4096");
  const maxTokens = Number.isFinite(configuredMax)
    ? Math.min(Math.max(configuredMax, 512), 4096)
    : 4096;
  const configuredBudget = Number(
    process.env.TRANSLATE_TIME_BUDGET_MS || "60000",
  );
  const budgetMs = Number.isFinite(configuredBudget)
    ? Math.min(Math.max(configuredBudget, 30000), 90000)
    : 60000;
  const deadlineAt = Date.now() + budgetMs;

  try {
    if (isPlainDirection) {
      const result = await callCompatibleModel({
        apiKey,
        model: requestedModel || undefined,
        deadlineAt,
        systemPrompt: PLAIN_SYSTEM_PROMPT,
        userPrompt: buildPlainPrompt(text, level, plainMode),
        maxTokens: Math.min(maxTokens, 900),
        temperature: 0.25,
      });
      return NextResponse.json({ result });
    }

    const sourceGenre = classifyScriptureSource(text);
    const lengthTarget = getScriptureLengthTarget(text, sourceGenre, level, edition);

    if (edition === "cuv" && mode === "original" && sourceGenre === "definition") {
      return NextResponse.json(
        scriptureResponse(
          text,
          renderDefinitionSource(text),
          edition,
          "local_primary",
        ),
      );
    }

    const recognizableAphorism =
      edition === "cuv" && sourceGenre === "aphorism"
        ? renderRecognizableSourceAphorism(text)
        : "";
    if (recognizableAphorism && level !== "grand" && variation === 0) {
      return NextResponse.json(
        scriptureResponse(
          text,
          recognizableAphorism,
          edition,
          "local_primary",
        ),
      );
    }

    if (edition === "cuv" && mode === "original") {
      let plan: ScriptureSkeletonPlan | null = null;
      let bestPlan: ScriptureSkeletonPlan | null = null;
      let bestScore = -1;
      let bestAttempt = 0;
      let previousIssues: string[] = [];
      let rescueResult = "";
      let rescueIssues: string[] = [];
      let rescueScore = Number.NEGATIVE_INFINITY;
      let realizationIssues: string[] = [];
      const generationDiagnostics: Array<Record<string, unknown>> = [];
      const includeDiagnostics = process.env.TRANSLATION_DEBUG === "1";
      for (let attempt = 0; attempt < 2 && Date.now() < deadlineAt - 18000; attempt += 1) {
        try {
          const rawPlan = await callCompatibleModel({
            apiKey,
            model: requestedModel || undefined,
            deadlineAt,
            systemPrompt:
              "你是和合本风格改写器的结构编辑。先保持输入原有文本类型：定义仍是定义，事实仍是事实，通知仍是通知，格言仍是格言，祝愿仍是祝愿，故事才整理成故事。只输出严格 JSON，不得选择经文，不得写正文。人物故事只在顶层 reflection 中提取一组由原文支持的人物、具体行为、实际结果、逻辑关系、褒贬方向和逐字证据；不得在 units 中写故事格言，不得凭空添加祝福、咒诅、因果或评价。",
            userPrompt: `${buildSkeletonIdentificationPrompt(text, previousIssues, level)}\n本次变化编号：${variation}。编号大于零时，可在语义兼容的骨架之间换一种表达。`,
            maxTokens: Math.min(
              maxTokens,
              structureTokenBudget(text, sourceGenre, level),
            ),
            temperature: 0.05,
            jsonObject: true,
            callTimeoutMs: planningCallTimeout([...text].length),
          });
          const parsedPlan = parseScriptureSkeletonPlan(rawPlan);
          if (!parsedPlan) {
            previousIssues = ["返回内容不是可解析的完整结构 JSON"];
            if (includeDiagnostics) {
              generationDiagnostics.push({
                attempt,
                stage: "parse_failed",
                rawLength: [...rawPlan].length,
              });
            }
            continue;
          }
          const groundedPlan = groundScriptureSkeletonPlan(parsedPlan, text);
          const planIssues = assessScriptureStoryPlan(groundedPlan, text);
          const candidateResult = renderScriptureSkeletonPlan(groundedPlan, text);
          const resultAssessment = assessScriptureStoryResult(text, candidateResult);
          const lengthAssessment = assessScriptureLength(
            candidateResult,
            lengthTarget,
            edition,
          );
          const allIssues = [
            ...planIssues,
            ...resultAssessment.issues,
            ...(lengthAssessment.acceptable ? [] : [lengthAssessment.issue]),
          ];
          const { critical, advisory } = splitStoryIssues(allIssues, text, level);
          const assessment = {
            acceptable: critical.length === 0 && lengthAssessment.acceptable,
            score: Math.max(
              0,
              resultAssessment.score - critical.length * 0.24 - advisory.length * 0.025,
            ),
            issues: allIssues,
            critical,
          };
          if (includeDiagnostics) {
            generationDiagnostics.push({
              attempt,
              stage: "assessed",
              unitCount: groundedPlan.units.length,
              outputLength: [...candidateResult].length,
              critical,
              advisory,
            });
          }
          if (assessment.critical.length === 0 && assessment.score > bestScore) {
            bestScore = assessment.score;
            bestPlan = groundedPlan;
            bestAttempt = attempt;
          }
          if (assessment.acceptable) {
            plan = groundedPlan;
            bestAttempt = attempt;
            break;
          }
          previousIssues = assessment.critical.length
            ? assessment.critical
            : assessment.issues.filter((issue) => /篇幅/u.test(issue));
          if (!previousIssues.length) {
            plan = groundedPlan;
            break;
          }
        } catch (error) {
          if (shouldExposeUpstreamError(error)) throw error;
          if (includeDiagnostics) {
            generationDiagnostics.push({
              attempt,
              stage: "request_failed",
              name: error instanceof Error ? error.name : "unknown",
              message: error instanceof Error ? error.message : "unknown",
            });
          }
          previousIssues = ["上一次结构生成中断，必须重新输出完整 JSON"];
        }
      }

      plan ??= bestPlan;

      if (plan && sourceGenre !== "story") {
        const rendered = renderScriptureSkeletonPlan(plan, text);
        return NextResponse.json({
          ...scriptureResponse(text, rendered, edition, "structured"),
          ...(includeDiagnostics ? { diagnostics: generationDiagnostics } : {}),
        });
      }

      if (plan && Date.now() < deadlineAt - 8000) {
        const factDraft = renderScriptureSkeletonPlan(plan, text, {
          includeReflection: false,
        });
        try {
          const realizedBody = await callCompatibleModel({
            apiKey,
            model: requestedModel || undefined,
            deadlineAt,
            systemPrompt: STRUCTURED_STORY_REALIZATION_SYSTEM_PROMPT,
            userPrompt: buildStructuredStoryRealizationPrompt(
              text,
              factDraft,
              buildLengthInstruction(lengthTarget, level),
              variation,
            ),
            maxTokens: Math.min(
              maxTokens,
              Math.max(1200, structureTokenBudget(text, sourceGenre, level) + 500),
            ),
            temperature: 0.38,
            callTimeoutMs: Math.max(
              8000,
              Math.min(24000, deadlineAt - Date.now() - 1500),
            ),
          });
          const realized = attachStoryClosure(realizedBody, plan);
          const resultAssessment = assessScriptureStoryResult(text, realized);
          const lengthAssessment = assessScriptureLength(
            realized,
            lengthTarget,
            edition,
          );
          const styleAssessment = assessUnionStyleResult(text, realized);
          const allIssues = [
            ...resultAssessment.issues,
            ...styleAssessment.issues,
            ...(lengthAssessment.acceptable ? [] : [lengthAssessment.issue]),
          ];
          const { critical } = splitStoryIssues(
            resultAssessment.issues,
            text,
            level,
          );
          const factuallySafe =
            critical.length === 0 &&
            resultAssessment.score >= minimumStoryFactScore(text, level);
          const score =
            resultAssessment.score * 4 +
            styleAssessment.score * 0.16 +
            styleAssessment.sectionCoverage * 0.24 -
            Math.abs(lengthAssessment.actual - lengthTarget.ideal) / 1000;
          realizationIssues = allIssues;

          if (includeDiagnostics) {
            generationDiagnostics.push({
              stage: "structured_realization_assessed",
              outputLength: [...realized].length,
              styleScore: styleAssessment.score,
              styleRequired: styleAssessment.requiredScore,
              styleSections: styleAssessment.sectionCoverage,
              styleSectionsRequired: styleAssessment.requiredSectionCoverage,
              critical,
              issues: allIssues,
            });
          }

          if (factuallySafe && styleAssessment.acceptable && score > rescueScore) {
            rescueScore = score;
            rescueResult = realized;
            rescueIssues = allIssues;
          }
          if (
            factuallySafe &&
            styleAssessment.acceptable &&
            lengthAssessment.acceptable
          ) {
            return NextResponse.json({
              ...scriptureResponse(
                text,
                realized,
                edition,
                bestAttempt > 0 ? "auto_repaired" : "structured",
              ),
              ...(includeDiagnostics ? { diagnostics: generationDiagnostics } : {}),
            });
          }
        } catch (error) {
          if (shouldExposeUpstreamError(error)) throw error;
          realizationIssues = ["结构事实已经提取，但和合本成文步骤中断"];
          if (includeDiagnostics) {
            generationDiagnostics.push({
              stage: "structured_realization_failed",
              name: error instanceof Error ? error.name : "unknown",
              message: error instanceof Error ? error.message : "unknown",
            });
          }
        }
      }

      for (
        let attempt = 0;
        attempt < 2 && Date.now() < deadlineAt - 2500;
        attempt += 1
      ) {
        try {
          const generatedBody = await callCompatibleModel({
            apiKey,
            model: requestedModel || undefined,
            deadlineAt,
            systemPrompt: SCRIPTURE_SYSTEM_PROMPT,
            userPrompt: `${buildScripturePrompt(text, mode, level)}\n\n${buildLengthInstruction(lengthTarget, level)}${
              realizationIssues.length
                ? `\n\n上一稿未通过以下检查：\n- ${realizationIssues
                    .slice(0, 6)
                    .join("\n- ")}\n必须重新成文，不可返回现代叙述梗概。`
                : ""
            }`,
            maxTokens: Math.min(
              maxTokens,
              Math.max(1200, structureTokenBudget(text, sourceGenre, level) + 700),
            ),
            temperature: attempt === 0 ? 0.42 : 0.28,
            callTimeoutMs: Math.max(
              10000,
              Math.min(24000, deadlineAt - Date.now() - 1000),
            ),
          });
          const generated = plan
            ? attachStoryClosure(generatedBody, plan)
            : generatedBody;
          const resultAssessment = assessScriptureStoryResult(text, generated);
          const lengthAssessment = assessScriptureLength(
            generated,
            lengthTarget,
            edition,
          );
          const styleAssessment = assessUnionStyleResult(text, generated);
          const allIssues = [
            ...resultAssessment.issues,
            ...styleAssessment.issues,
            ...(lengthAssessment.acceptable ? [] : [lengthAssessment.issue]),
          ];
          const { critical } = splitStoryIssues(
            resultAssessment.issues,
            text,
            level,
          );
          const score =
            resultAssessment.score * 4 +
            styleAssessment.score * 0.16 +
            styleAssessment.sectionCoverage * 0.24 -
            critical.length * 2 -
            Math.abs(lengthAssessment.actual - lengthTarget.ideal) / 1000;
          const factuallySafe =
            critical.length === 0 &&
            resultAssessment.score >= minimumStoryFactScore(text, level);
          if (includeDiagnostics) {
            generationDiagnostics.push({
              attempt,
              stage: "direct_rescue_assessed",
              outputLength: [...generated].length,
              styleScore: styleAssessment.score,
              styleRequired: styleAssessment.requiredScore,
              styleSections: styleAssessment.sectionCoverage,
              styleSectionsRequired: styleAssessment.requiredSectionCoverage,
              critical,
              issues: allIssues,
            });
          }
          if (factuallySafe && styleAssessment.acceptable && score > rescueScore) {
            rescueScore = score;
            rescueResult = generated;
            rescueIssues = allIssues;
          }
          if (
            factuallySafe &&
            styleAssessment.acceptable &&
            lengthAssessment.acceptable
          ) {
            return NextResponse.json({
              ...scriptureResponse(
                text,
                generated,
                edition,
                "auto_repaired",
              ),
              ...(includeDiagnostics ? { diagnostics: generationDiagnostics } : {}),
            });
          }
        } catch (error) {
          if (shouldExposeUpstreamError(error)) throw error;
          if (includeDiagnostics) {
            generationDiagnostics.push({
              attempt,
              stage: "direct_rescue_failed",
              name: error instanceof Error ? error.name : "unknown",
              message: error instanceof Error ? error.message : "unknown",
            });
          }
        }
      }

      if (rescueResult) {
        return NextResponse.json({
          ...scriptureResponse(
            text,
            rescueResult,
            edition,
            "best_effort",
            `结构化生成未通过，已改用直接生成的最佳版本；${rescueIssues[0] || "个别指标未完全达到目标"}。`,
          ),
          ...(includeDiagnostics ? { diagnostics: generationDiagnostics } : {}),
        });
      }

      return NextResponse.json({
        error:
          "本次未能在时间预算内生成可靠的和合本改写；系统没有返回近似原文的保守稿。请点击“再写一次”，或缩短输入后重试。",
        ...(includeDiagnostics ? { diagnostics: generationDiagnostics } : {}),
      }, { status: 504 });
    }

    if (edition !== "cuv") {
      let bestResult = "";
      let bestDistance = Number.POSITIVE_INFINITY;
      let retryIssues: string[] = [];
      for (let attempt = 0; attempt < 2 && Date.now() < deadlineAt - 3500; attempt += 1) {
        let generated = "";
        try {
          generated = await callCompatibleModel({
            apiKey,
            model: requestedModel || undefined,
            deadlineAt,
            systemPrompt: edition === "kjv" ? KJV_SYSTEM_PROMPT : SIGAO_SYSTEM_PROMPT,
            userPrompt: buildEditionPrompt(
              text,
              edition,
              buildLengthInstruction(lengthTarget, level),
              variation,
              retryIssues,
            ),
            maxTokens: Math.min(
              maxTokens,
              Math.max(700, structureTokenBudget(text, sourceGenre, level)),
            ),
            temperature: attempt === 0 ? 0.42 : 0.25,
          });
        } catch (error) {
          if (shouldExposeUpstreamError(error) || attempt > 0) throw error;
          retryIssues = ["The previous generation was interrupted; return one complete rewritten text."];
          continue;
        }
        const lengthAssessment = assessScriptureLength(generated, lengthTarget, edition);
        const storyIssues =
          edition === "sigao" && sourceGenre === "story"
            ? assessScriptureStoryResult(text, generated).issues.filter((issue) =>
                isCriticalStoryIssue(issue, text, level),
              )
            : [];
        const distance = Math.abs(lengthAssessment.actual - lengthTarget.ideal) + storyIssues.length * 1000;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestResult = generated;
        }
        if (lengthAssessment.acceptable && storyIssues.length === 0) {
          return NextResponse.json(
            scriptureResponse(
              text,
              generated,
              edition,
              attempt ? "auto_repaired" : "structured",
            ),
          );
        }
        retryIssues = [
          ...(lengthAssessment.acceptable ? [] : [lengthAssessment.issue]),
          ...storyIssues,
        ];
      }
      if (bestResult) {
        return NextResponse.json(
          scriptureResponse(
            text,
            bestResult,
            edition,
            "best_effort",
            "正文已经生成，但篇幅或事实校验仍有轻微偏差；系统展示了本次最佳版本。",
          ),
        );
      }
    }

    const generated = await callCompatibleModel({
      apiKey,
      model: requestedModel || undefined,
      deadlineAt,
      systemPrompt: SCRIPTURE_SYSTEM_PROMPT,
      userPrompt: buildScripturePrompt(text, mode, level),
      maxTokens,
      temperature: 0.55,
    });
    return NextResponse.json(
      scriptureResponse(text, generated, edition, "structured"),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return NextResponse.json(
        {
          error:
            "模型请求超时，系统没有返回近似原文的保守稿；请点击“再写一次”，或缩短输入后重试。",
        },
        { status: 504 },
      );
    }
    const message = error instanceof Error ? error.message : "转换失败，请稍后重试。";
    const status =
      typeof error === "object" && error && "status" in error
        ? Number((error as { status: number }).status)
        : 502;
    return NextResponse.json(
      { error: message },
      { status: status >= 400 && status < 600 ? status : 502 },
    );
  }
}
