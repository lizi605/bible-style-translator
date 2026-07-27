import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CUV_APHORISM_SKELETONS,
  renderCuvAphorism,
  renderRecognizableSourceAphorism,
  renderCuvStoryAphorism,
  selectCuvAphorismSkeleton,
} from "../lib/cuvAphorismSkeletons";
import {
  CUV_STORY_TEMPLATES,
  buildCuvStoryTemplatePrompt,
  selectCuvStoryTemplates,
} from "../lib/cuvStoryTemplates";
import {
  buildSkeletonIdentificationPrompt,
  groundScriptureSkeletonPlan,
  renderScriptureSkeletonPlan,
} from "../lib/scriptureSkeletons";
import { renderStoryReflection } from "../lib/scriptureReflections";
import { RUIS_STORY_INPUT } from "./fixtures/ruis-story";

test("aphorism skeleton library contains at least 200 distinct usable frames", () => {
  assert.ok(CUV_APHORISM_SKELETONS.length >= 200);
  assert.equal(
    new Set(CUV_APHORISM_SKELETONS.map((item) => item.id)).size,
    CUV_APHORISM_SKELETONS.length,
  );
  assert.ok(new Set(CUV_APHORISM_SKELETONS.map((item) => item.theme)).size >= 40);
  assert.ok(
    CUV_APHORISM_SKELETONS.every(
      (item) =>
        item.sourceShape &&
        item.frame.includes("【行为】") &&
        item.frame.includes("【结果】") &&
        ["affirm", "warn", "cause", "contrast"].includes(item.logic) &&
        ["positive", "negative", "neutral"].includes(item.outcomeTone),
    ),
  );
});

test("aphorism selection follows meaning instead of one universal pattern", () => {
  const pride = selectCuvAphorismSkeleton("贬低别人抬高自己", "因骄傲降为卑");
  const season = selectCuvAphorismSkeleton("一味拖延", "失去眼前的机会");
  const measure = selectCuvAphorismSkeleton("以恶意待人", "从人得着恶意的回报");

  assert.equal(pride.theme, "谦卑与骄傲");
  assert.equal(season.theme, "殷勤与懒惰");
  assert.equal(measure.theme, "量器与回报");
  assert.equal(new Set([pride.frame, season.frame, measure.frame]).size, 3);
});

test("standalone maxims use the expanded library without an artificial closing sentence", () => {
  const output = renderScriptureSkeletonPlan({
    textType: "格言",
    units: [
      {
        kind: "declaration",
        intent: "general_rule",
        elements: {
          category: "靠贬低别人抬高自己",
          result: "因自己的骄傲降为卑",
        },
      },
    ],
  });

  assert.match(output, /贬低别人|骄傲|自高/u);
  assert.match(output, /降为卑/u);
  assert.doesNotMatch(output, /所吩咐的话|所列的条例|所记的事/u);
});

test("story maxims retain a famous CUV sentence contour", () => {
  const season = renderCuvStoryAphorism(
    "修改方案的时候",
    "按时交付的时候",
  );
  const labor = renderCuvStoryAphorism(
    "在疲惫中仍旧忍耐作工",
    "看见劳苦的果效",
  );

  assert.equal(
    season,
    "凡事都有定期，天下万务都有定时；修改方案有时，按时交付也有时。",
  );
  assert.equal(
    labor,
    "在疲惫中仍旧忍耐作工的，虽是流泪撒种；到了收割的时候，必欢呼收割，也必看见劳苦的果效。",
  );
});

test("long stories may embed aphorism frames while technical rules stay literal", () => {
  const story = renderScriptureSkeletonPlan({
    textType: "冲突记事",
    units: [
      {
        kind: "narration",
        frame: "action",
        actor: "甲",
        action: "当众贬低乙，抬高自己",
      },
      {
        kind: "declaration",
        intent: "general_rule",
        elements: { category: "贬低别人抬高自己", result: "因骄傲降为卑" },
      },
      {
        kind: "narration",
        frame: "outcome",
        actor: "甲",
        action: "失去众人的尊重",
      },
    ],
  });
  assert.match(story, /骄傲|自高|降为卑/u);

  const technical = renderScriptureSkeletonPlan({
    textType: "操作规则",
    units: [
      {
        kind: "declaration",
        intent: "general_rule",
        elements: { category: "逾期提交", result: "重新申请" },
      },
    ],
  });
  assert.match(technical, /^凡逾期提交的，必重新申请。/u);
});

test("story template library covers broad biblical plot structures", () => {
  assert.ok(CUV_STORY_TEMPLATES.length >= 60);
  assert.equal(
    new Set(CUV_STORY_TEMPLATES.map((item) => item.id)).size,
    CUV_STORY_TEMPLATES.length,
  );
  const selected = selectCuvStoryTemplates(
    "专家提前警告风险，众人却按多数意见出发，后来事故发生，只得抛弃货物。",
  );
  assert.equal(selected[0]?.id, "shipwreck");
  assert.match(buildCuvStoryTemplatePrompt("两个人都说奖杯是自己的"), /所罗门断案式/u);
});

test("identification prompt requires one evidence-grounded reflection for every story", () => {
  const prompt = buildSkeletonIdentificationPrompt(
    "甲因骄傲轻看乙，后来失去众人的尊重。",
  );
  assert.match(prompt, /每一篇人物故事都必须/u);
  assert.match(prompt, /顶层 reflection/u);
  assert.match(prompt, /evidence 必须逐字复制原文/u);
  assert.match(prompt, /出现钱不等于贪财/u);
  assert.match(prompt, /故事编排原型/u);
});

test("family guilt and an innocent child use the inherited-responsibility verse", () => {
  const result = renderStoryReflection({
    enabled: true,
    mode: "neutral",
    actor: "瑞斯",
    behavior: "虽生于献祭灵魂的家族却有纯洁的灵魂",
    outcome: "被伊莉莎带离家族并健康长大",
    relation: "inherited_responsibility",
    polarity: "neutral",
    evidence: ["那婴儿所载却不是恶魔的意志"],
  });
  assert.equal(
    result,
    "儿子必不担当父亲的罪孽，父亲也不担当儿子的罪孽。",
  );

  const grounded = groundScriptureSkeletonPlan(
    {
      textType: "记事",
      units: [
        {
          kind: "narration",
          frame: "outcome",
          actor: "伊莉莎",
          action: "带着瑞斯离开家族",
        },
      ],
      reflection: {
        enabled: true,
        mode: "neutral",
        actor: "伊莉莎",
        behavior: "带着瑞斯离开家族",
        outcome: "瑞斯健康长大",
        relation: "neutral_record",
        polarity: "neutral",
        evidence: ["冒着风险带着他与宝石项链离开了家族"],
      },
    },
    RUIS_STORY_INPUT,
  );
  assert.equal(grounded.reflection?.relation, "inherited_responsibility");
});

test("public-domain full corpus build scanned every stored verse", () => {
  const stats = JSON.parse(
    readFileSync("references/cuv-corpus/cuv-extraction-stats.json", "utf8"),
  ) as {
    bookCount: number;
    verseCount: number;
    candidateCount: number;
    typeCounts: { aphorism: number; dialogue: number; story: number };
  };
  assert.equal(stats.bookCount, 66);
  assert.ok(stats.verseCount >= 31_000);
  assert.ok(stats.candidateCount >= 15_000);
  assert.ok(stats.typeCounts.aphorism >= 8_000);
  assert.ok(stats.typeCounts.dialogue >= 6_000);
  assert.ok(stats.typeCounts.story >= 5_000);
});

test("direct aphorism renderer retains both the input action and consequence", () => {
  const outputs = [
    renderCuvAphorism("靠贬低别人抬高自己", "因自己的骄傲降为卑"),
    renderCuvAphorism("一味拖延", "失去摆在面前的机会"),
    renderCuvAphorism("以恶意待人", "从人得着恶意的回报"),
  ];
  assert.match(outputs[0], /贬低别人/u);
  assert.match(outputs[0], /降为卑/u);
  assert.match(outputs[1], /拖延/u);
  assert.match(outputs[1], /失去摆在面前的机会/u);
  assert.match(outputs[2], /恶意待人/u);
  assert.match(outputs[2], /恶意的回报/u);
  for (const output of outputs) {
    assert.doesNotMatch(output, /以以|不肯一味|把靠|所吩咐的话/u);
  }
});

test("recognizable source maxims keep famous contours without reversing cause and result", () => {
  assert.equal(
    renderRecognizableSourceAphorism("一次失败不能决定最终结果，只要继续努力，总会重新站起来。"),
    "人虽一度跌倒，仍必兴起。",
  );
  assert.equal(
    renderRecognizableSourceAphorism("说话之前先想清楚，免得日后后悔。"),
    "谨守口的，得保生命；说话以前先思想的，必不至后悔。",
  );
});

test("aphorism renderer preserves positive and negative logical direction", () => {
  const patienceSkeleton = selectCuvAphorismSkeleton(
    "在一次失败以后仍旧耐心前行",
    "终必走到所盼望的地方",
  );
  const shortcutSkeleton = selectCuvAphorismSkeleton(
    "贪图捷径而离开正路",
    "反在近处跌倒",
  );
  const friendshipSkeleton = selectCuvAphorismSkeleton(
    "在患难中仍不离开朋友",
    "显明他的情分真实",
  );
  const patience = renderCuvAphorism(
    "在一次失败以后仍旧耐心前行",
    "终必走到所盼望的地方",
  );
  const shortcut = renderCuvAphorism(
    "贪图捷径而离开正路",
    "反在近处跌倒",
  );
  const friendship = renderCuvAphorism(
    "在患难中仍不离开朋友",
    "显明他的情分真实",
  );

  assert.equal(patienceSkeleton.sourceShape, "义人虽七次跌倒，仍必兴起。");
  assert.equal(shortcutSkeleton.sourceShape, "有一条路，人以为正，至终成为死亡之路。");
  assert.equal(friendshipSkeleton.sourceShape, "朋友乃时常亲爱；弟兄为患难而生。");
  assert.equal(patience, "人虽一度跌倒，仍必兴起。");
  assert.doesNotMatch(patience, /若属于今日|就可以终必|不要.*耐心前行/u);
  assert.equal(shortcut, "有一条捷径，人以为正，至终却使他跌倒。");
  assert.doesNotMatch(shortcut, /跌倒的.*当持守|走正路的.*跌倒/u);
  assert.equal(
    friendship,
    "朋友乃时常亲爱；患难到了仍不离开的，是为患难而生的弟兄。",
  );
  assert.doesNotMatch(friendship, /不要以.*不离开|不可.*不离开/u);
  for (const output of [patience, shortcut, friendship]) {
    assert.ok(output.length <= 34);
    assert.doesNotMatch(output, /论到|好叫|这样的人|到了时候必/u);
  }
});

test("ordinary one-sentence maxims use distinct matching library frames", () => {
  const outputs = [
    renderCuvAphorism("说话以前先想清楚", "免去日后的后悔"),
    renderCuvAphorism("每天认真工作", "终必看见劳苦的果效"),
    renderCuvAphorism("用恶意对待别人", "也从别人得着恶意"),
    renderCuvAphorism("在众人面前抬高自己", "因骄傲降为卑"),
    renderCuvAphorism("愿意饶恕别人的过错", "自己的心得自由"),
  ];

  assert.match(outputs[0], /说话以前先想清楚.*免去日后的后悔/u);
  assert.match(outputs[1], /认真工作.*劳苦的果效/u);
  assert.match(outputs[0], /智慧为首/u);
  assert.match(outputs[1], /诸般勤劳都有益处/u);
  assert.match(outputs[2], /怎样|照样|量器|恶意/u);
  assert.equal(outputs[3], "凡在众人面前抬高自己的，必因骄傲降为卑。");
  assert.equal(outputs[4], "你若肯饶恕人的过犯，自己也必得着释放。");
  assert.ok(new Set(outputs).size === outputs.length);
  assert.ok(outputs.filter((output) => /有福/u.test(output)).length <= 1);
  for (const output of outputs) {
    assert.ok(output.length <= 52);
    assert.doesNotMatch(
      output,
      /在说话以前先想清楚上|在每天认真工作上的工|就当持守.*恶意|你若因.*饶恕人/u,
    );
  }
});

test("historical repair keeps compressed opening while restoring relations and conflict logic", () => {
  const output = renderScriptureSkeletonPlan({
    textType: "历史记事",
    units: [
      { kind: "narration", frame: "arrival", actor: "刘华强、韩跃平、大海", place: "那摆设筵席的屋里" },
      { kind: "speech", intent: "waited_arrival", speaker: "宋老虎", addressee: "刘华强", elements: {} },
      { kind: "speech", intent: "introduction", speaker: "刘华强", addressee: "宋老虎", elements: { names: "跃平、大海", relation: "兄弟" } },
      { kind: "speech", intent: "invite_seat", speaker: "宋老虎", addressee: "刘华强", elements: {} },
      { kind: "narration", frame: "action", actor: "大海", action: "把所带之物摆在席前" },
      { kind: "speech", intent: "introduction", speaker: "宋老虎", addressee: "刘华强", elements: { names: "振涛", relation: "兄弟" } },
      { kind: "speech", intent: "reassurance", speaker: "刘华强", addressee: "宋老虎", elements: { basis: "大哥这一句话" } },
      { kind: "speech", intent: "request_directness", speaker: "刘华强", addressee: "宋老虎", elements: {} },
      { kind: "speech", intent: "approval", speaker: "宋老虎", addressee: "刘华强", elements: { quality: "这样直爽的性情" } },
      { kind: "speech", intent: "mediation_request", speaker: "宋老虎", addressee: "刘华强", elements: { beneficiary: "赵祥生", action: "不要再寻找赵祥生", result: "看我的情面" } },
      { kind: "speech", intent: "self_defense", speaker: "刘华强", addressee: "宋老虎", elements: { matter: "借钱", rejected: "不还", asserted: "借用一时" } },
      { kind: "speech", intent: "rebuke", speaker: "宋老虎", addressee: "振涛", elements: { prohibition: "不可住口" } },
      { kind: "speech", intent: "death_threat", speaker: "振涛", addressee: "刘华强", delivery: "cried", elements: { target: "刘华强" } },
      { kind: "narration", frame: "outcome", actor: "刘华强", action: "带着韩跃平和大海离去" },
    ],
  });

  assert.match(output, /称他们为自己的兄弟/u);
  assert.match(output, /振涛，就是他的兄弟/u);
  assert.match(output, /你今日召我来，岂只是为坐席吃喝吗/u);
  assert.match(output, /你口中这痛快的话/u);
  assert.match(output, /向赵祥生借钱/u);
  assert.match(output, /不可再说无礼的话/u);
  assert.doesNotMatch(output, /这样直爽的性情|不可住口|这事的结局，就是这样/u);
});

test("historical-story mode compresses hospitality and rejects malformed anchor collisions", () => {
  const output = renderScriptureSkeletonPlan({
    textType: "冲突记事",
    units: [
      { kind: "narration", frame: "arrival", actor: "刘华强", place: "摆设筵席的屋里" },
      { kind: "narration", frame: "reaction", actor: "伺候筵席的人", target: "刘华强等人", action: "引导他们往里面走" },
      { kind: "speech", intent: "waited_arrival", speaker: "宋老虎", addressee: "刘华强", elements: {} },
      { kind: "speech", intent: "introduction", speaker: "刘华强", addressee: "宋老虎", elements: { count: "两", names: "跃平、大海", relation: "我的兄弟" } },
      { kind: "speech", intent: "invite_seat", speaker: "宋老虎", addressee: "刘华强", elements: {} },
      { kind: "narration", frame: "action", actor: "大海", action: "把带来之物摆在席前" },
      { kind: "speech", intent: "courtesy_gift", speaker: "宋老虎", addressee: "刘华强", elements: { gift: "礼物" } },
      { kind: "speech", intent: "courtesy_refusal", speaker: "刘华强", addressee: "宋老虎", elements: { relation: "自家兄弟" } },
      { kind: "speech", intent: "introduction", speaker: "宋老虎", addressee: "刘华强", elements: { count: "一", names: "振涛", relation: "我的兄弟" } },
      { kind: "speech", intent: "self_identification", speaker: "刘华强", addressee: "振涛", elements: { name: "刘华强" } },
      { kind: "speech", intent: "reputation", speaker: "宋老虎", addressee: "刘华强", elements: { qualities: "重义气、讲情分" } },
      { kind: "speech", intent: "insult_challenge", speaker: "振涛", addressee: "刘华强", delivery: "cried", elements: { knownA: "我哥在道上混时", knownB: "你穿年幼无知", challenge: "摆架子" } },
      { kind: "speech", intent: "rebuke", speaker: "宋老虎", addressee: "振涛", elements: { prohibition: "不可不要再说" } },
      { kind: "speech", intent: "youth_defiance", speaker: "刘华强", addressee: "宋老虎", elements: { quality: "气盛" } },
      { kind: "speech", intent: "question", speaker: "刘华强", addressee: "振涛", delivery: "asked", elements: { question: "岂不我当怎样走出这个屋子吗" } },
      { kind: "speech", intent: "death_threat", speaker: "振涛", addressee: "刘华强", delivery: "cried", elements: { target: "刘华强" } },
    ],
  });

  assert.match(output, /宋老虎就迎接刘华强和同行的人，与他们一同坐席/u);
  assert.match(output, /刘华强将跃平、大海引到众人面前/u);
  assert.match(output, /大海把所带之物陈在席前；宋老虎看见，便以弟兄之礼相待/u);
  assert.match(output, /刘华强是谁？他算什么人，竟敢摆架子呢/u);
  assert.match(output, /不可再说/u);
  assert.match(output, /我若不气盛，还算什么年轻人呢/u);
  assert.match(output, /依你所说，我当怎样走出这个屋子呢/u);
  assert.match(output, /我必夺取你的命/u);
  assert.doesNotMatch(output, /听见这话.*引导|金银般贵重|论到这两个人|论到我的名|不可不要|全无气盛|岂不我当|刘华强的命/u);
});
