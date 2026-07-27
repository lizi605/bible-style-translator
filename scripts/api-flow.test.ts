import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/translate/route.ts";
import { assessScriptureStoryResult } from "../lib/scriptureSkeletons.ts";
import { splitStoryIssues } from "../lib/storyIssueSeverity.ts";
import {
  RUIS_STORY_INPUT,
  RUIS_STORY_TARGET,
} from "./fixtures/ruis-story.ts";

const originalFetch = globalThis.fetch;

function simplePlan() {
  return {
    textType: "事实陈述",
    units: [
      {
        kind: "declaration",
        intent: "factual_statement",
        elements: { subject: "代码", fact: "正在运行", more: "日志中没有报错" },
      },
    ],
    reflection: { enabled: false },
  };
}

function requestFor(body: Record<string, unknown>, clientId: string) {
  return new NextRequest("http://localhost/api/translate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer sk-${"a".repeat(36)}`,
      "x-client-id": clientId,
    },
    body: JSON.stringify(body),
  });
}

test("long stories tolerate omitted incidental people but keep decisive facts strict", () => {
  const source =
    "清晨，小周带着报告来到会议室，把问题交给主管。主管叫众人逐项检查，小周就重新核对数据。" +
    "众人又核对了两页记录，各自说明所看见的问题。到了中午，小周发现付款方向写反了，就把报告收回。" +
    "主管叫他继续修改，小周又检查三次，终于改正问题。傍晚，小周把报告交给主管，主管看见结果无误，就准许项目进入下一步。";
  const longSource = `${source}众人随后核对版本号、日期、页面按钮和测试记录，把已经验证的项目逐项写在清单上。老陈坐在角落，默默听着，并未参与争论。众人又复查接口、日志和数据库连接，确认没有遗漏，才将各项结果登记清楚，收拾文件回去。`;

  const incidental = splitStoryIssues(["遗漏人物：老陈"], longSource, "standard");
  assert.deepEqual(incidental.critical, []);
  assert.deepEqual(incidental.advisory, ["遗漏人物：老陈"]);

  assert.deepEqual(
    splitStoryIssues(["遗漏人物：小周"], longSource, "standard").critical,
    ["遗漏人物：小周"],
  );
  assert.deepEqual(
    splitStoryIssues(["遗漏关键事实：借贷"], longSource, "standard").critical,
    ["遗漏关键事实：借贷"],
  );
  assert.deepEqual(
    splitStoryIssues(["伤害对象错误：甲伤了乙"], longSource, "standard").critical,
    ["伤害对象错误：甲伤了乙"],
  );
});

test("long-story name extraction ignores clause fragments", () => {
  const source =
    "项目上线以前，小周带着记录来到会议室，把昨日发现的问题交给主管。开发说接口偶尔超时，主管就叫他保存日志。" +
    "设计说按钮被图片遮住，有些人虽然看见页面，却不能点击；小周便重新检查层级。运营拿出反馈，众人听见，就把这些问题分别记录。" +
    "到了中午，小周完成第一轮修正。主管最后查看测试表，见主要问题已经除去，就准许项目进入下一步。";
  const result =
    "那时，小周来到主管面前；开发、设计、运营也在众人中间。小周检查问题，主管查看测试表，准许项目进入下一步。";
  const omittedNames = assessScriptureStoryResult(source, result).issues.filter((issue) =>
    issue.startsWith("遗漏人物："),
  );
  assert.ok(!omittedNames.some((issue) => /把昨日|有些人虽然|就把这些|主管最后查/u.test(issue)));
});

test("rewritten long stories may change wording while retaining decisive facts", () => {
  const assessment = assessScriptureStoryResult(
    RUIS_STORY_INPUT,
    RUIS_STORY_TARGET,
  );
  const split = splitStoryIssues(
    assessment.issues,
    RUIS_STORY_INPUT,
    "standard",
  );
  assert.deepEqual(split.critical, []);
  assert.ok(!assessment.issues.some((issue) => /不爱|冒着风险|她为他起名/u.test(issue)));
});

test("CUV structured calls request strict JSON and return generation metadata", async (context) => {
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  const upstreamBodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const upstreamBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    upstreamBodies.push(upstreamBody);
    const plan = {
      textType: "记事",
      units: [
        { kind: "narration", frame: "arrival", actor: "小周", place: "办公室" },
        { kind: "narration", frame: "action", actor: "小周", action: "交出方案", target: "主管" },
        {
          kind: "speech",
          intent: "command",
          speaker: "主管",
          addressee: "小周",
          elements: { action: "明日重新修改方案", prohibition: "照旧交来" },
        },
        { kind: "narration", frame: "outcome", actor: "小周", action: "答应并回到座位修改", result: "继续修改方案" },
      ],
      reflection: {
        enabled: true,
        mode: "commend",
        actor: "小周",
        behavior: "答应以后回到座位修改",
        outcome: "继续修改方案",
        relation: "cause_result",
        polarity: "positive",
        evidence: ["小周答应以后回到座位修改"],
      },
    };
    const content = upstreamBodies.length === 1
      ? JSON.stringify(plan)
      : "那时，小周来到办公室，将方案交在主管面前。主管看见，就吩咐他说：“你当在明日重新修改；不可将旧样交来。”这事以后，小周听见这话，于是就应允，回到座位继续修改方案。";
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    requestFor(
      {
        text: "小周来到办公室，把方案交给主管。主管看后要求他明日重做，小周答应以后回到座位修改。",
        direction: "to_scripture",
        mode: "original",
        level: "light",
        edition: "cuv",
        plainMode: "direct",
      },
      "api-flow-cuv",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.ok(payload.result);
  assert.ok(payload.generationMode);
  assert.equal(upstreamBodies.length, 2);
  assert.deepEqual(upstreamBodies[0]?.response_format, { type: "json_object" });
  assert.deepEqual(upstreamBodies[0]?.thinking, { type: "disabled" });
  assert.equal(upstreamBodies[1]?.response_format, undefined);
  assert.match(payload.result, /这事以后/);
});

test("malformed CUV structure output is rescued by direct generation", async (context) => {
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    bodies.push(body);
    const content = bodies.length <= 2
      ? '{"textType":"记事","units":[ Broken JSON'
      : "那时，小周来到办公室，将方案交在主管面前。主管看见这事，就对他说：“你当在明日重新修改；不可将旧样交来。”这事以后，小周听见这话，就应允，回到座位继续修改，好叫方案得以完成。";
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    requestFor(
      {
        text: "小周来到办公室，把方案交给主管。主管看后要求他明日重做，小周答应以后回到座位修改。",
        direction: "to_scripture",
        mode: "original",
        level: "light",
        edition: "cuv",
        plainMode: "direct",
      },
      "api-flow-direct-rescue",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.generationMode, "auto_repaired");
  assert.match(payload.result, /小周来到办公室/);
  assert.doesNotMatch(payload.result, /论到这事，所记的乃是这样/);
  assert.equal(bodies.length, 3);
  assert.deepEqual(bodies[0].response_format, { type: "json_object" });
  assert.equal(bodies[2].response_format, undefined);
});

test("unrecoverable CUV failures return feedback instead of near-source fallback", async (context) => {
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: calls <= 2 ? "not json" : "小周。" } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const source =
    "小周来到办公室，把方案交给主管。主管看后要求他明日重做，小周答应以后回到座位修改。";
  const response = await POST(
    requestFor(
      {
        text: source,
        direction: "to_scripture",
        mode: "original",
        level: "light",
        edition: "cuv",
        plainMode: "direct",
      },
      "api-flow-no-near-source-fallback",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 504);
  assert.equal(payload.result, undefined);
  assert.match(payload.error, /没有返回近似原文的保守稿/);
  assert.equal(calls, 4);
});

test("KJV mode uses its own direct generation path", async (context) => {
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let upstreamBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    upstreamBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "May thy code run in the cloud as faithfully as it runneth upon thy local machine, and may no error prevail against it." } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    requestFor(
      {
        text: "祝你的代码运行顺利",
        direction: "to_scripture",
        mode: "original",
        level: "standard",
        edition: "kjv",
        plainMode: "direct",
      },
      "api-flow-kjv",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.match(payload.result, /thy code/);
  assert.equal(upstreamBody?.response_format, undefined);
});

test("unsupported model names switch to models offered by the provider", async (context) => {
  const oldBase = process.env.AI_BASE_URL;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (oldBase === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = oldBase;
  });
  process.env.AI_BASE_URL = "https://compat-model.example/v1";
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    bodies.push(body);
    if (bodies.length === 1) {
      return new Response(
        JSON.stringify({
          error: {
            message: "The supported API model names are qwen-plus or qwen-turbo, but you passed legacy-chat.",
          },
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(simplePlan()) } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    requestFor(
      {
        text: "代码正在运行，日志中没有报错。",
        direction: "to_scripture",
        mode: "original",
        level: "standard",
        edition: "cuv",
        plainMode: "direct",
        model: "legacy-chat",
      },
      "compat-model-name",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.ok(payload.result);
  assert.equal(bodies[0].model, "legacy-chat");
  assert.ok(["qwen-plus", "qwen-turbo"].includes(String(bodies[1].model)));
});

test("models without JSON mode retry without response_format", async (context) => {
  const oldBase = process.env.AI_BASE_URL;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (oldBase === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = oldBase;
  });
  process.env.AI_BASE_URL = "https://compat-json.example/v1";
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    bodies.push(body);
    if (bodies.length === 1) {
      return new Response(
        JSON.stringify({ error: { message: "Unsupported parameter: response_format json_object" } }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(simplePlan()) } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    requestFor(
      {
        text: "代码正在运行，日志中没有报错。",
        direction: "to_scripture",
        mode: "original",
        level: "standard",
        edition: "cuv",
        plainMode: "direct",
        model: "plain-chat-model",
      },
      "compat-json-mode",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.ok(payload.result);
  assert.deepEqual(bodies[0].response_format, { type: "json_object" });
  assert.equal(bodies[1].response_format, undefined);
});

test("DeepSeek-compatible models may reject reasoning control without causing fallback", async (context) => {
  const oldBase = process.env.AI_BASE_URL;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (oldBase === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = oldBase;
  });
  process.env.AI_BASE_URL = "https://deepseek-reasoning-compat.example/v1";
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    bodies.push(body);
    if (bodies.length === 1) {
      return new Response(
        JSON.stringify({ error: { message: "Unknown parameter: thinking" } }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(simplePlan()) } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    requestFor(
      {
        text: "代码正在运行，日志中没有报错。",
        direction: "to_scripture",
        mode: "original",
        level: "standard",
        edition: "cuv",
        plainMode: "direct",
        model: "reasoning-limited-model",
      },
      "compat-reasoning-control",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.ok(payload.result);
  assert.deepEqual(bodies[0].thinking, { type: "disabled" });
  assert.equal(bodies[1].thinking, undefined);
  assert.notEqual(payload.generationMode, "fallback");
});

test("unresolved model incompatibility returns an error instead of fallback", async (context) => {
  const oldBase = process.env.AI_BASE_URL;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (oldBase === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = oldBase;
  });
  process.env.AI_BASE_URL = "https://compat-failure.example/v1";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ error: { message: "Invalid model configuration." } }),
      { status: 400, headers: { "content-type": "application/json" } },
    );

  const response = await POST(
    requestFor(
      {
        text: "代码正在运行，日志中没有报错。",
        direction: "to_scripture",
        mode: "original",
        level: "standard",
        edition: "cuv",
        plainMode: "direct",
        model: "unknown-model",
      },
      "compat-no-fallback",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.result, undefined);
  assert.match(payload.error, /模型|接口|参数/);
});

test("compatibility negotiation adapts system role, token field, and temperature", async (context) => {
  const oldBase = process.env.AI_BASE_URL;
  context.after(() => {
    globalThis.fetch = originalFetch;
    if (oldBase === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = oldBase;
  });
  process.env.AI_BASE_URL = "https://compat-parameters.example/v1";
  const bodies: Array<Record<string, unknown>> = [];
  const errors = [
    "Unsupported parameter: response_format json_object",
    "The system role is not supported",
    "Unknown parameter max_tokens",
    "The temperature parameter is unsupported; only the default is allowed",
  ];
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    bodies.push(body);
    const message = errors[bodies.length - 1];
    if (message) {
      return new Response(JSON.stringify({ error: { message } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(simplePlan()) } }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const response = await POST(
    requestFor(
      {
        text: "代码正在运行，日志中没有报错。",
        direction: "to_scripture",
        mode: "original",
        level: "standard",
        edition: "cuv",
        plainMode: "direct",
        model: "parameter-limited-model",
      },
      "compat-all-parameters",
    ),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.ok(payload.result);
  assert.equal(bodies.length, 5);
  assert.equal(bodies[1].response_format, undefined);
  assert.deepEqual(
    (bodies[2].messages as Array<{ role: string }>).map((item) => item.role),
    ["user"],
  );
  assert.ok("max_completion_tokens" in bodies[3]);
  assert.equal(bodies[4].temperature, undefined);
});
