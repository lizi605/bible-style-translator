import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyScriptureSource,
  hasForbiddenMoralization,
  isAphorismSource,
  renderDefinitionSource,
} from "../lib/scriptureGenre";
import { renderCuvAphorism } from "../lib/cuvAphorismSkeletons";
import {
  assessScriptureStoryPlan,
  assessScriptureStoryResult,
  groundScriptureSkeletonPlan,
  parseScriptureSkeletonPlan,
  renderScriptureSkeletonPlan,
} from "../lib/scriptureSkeletons";
import {
  formatScriptureVerses,
  segmentScriptureText,
} from "../lib/scriptureVerses";

const USER_DEFINITION =
  "现代汉民族共同语是以北京语音为标准音，以北方为基础方言，以典范的现代白话文著作为语法规范的普通话。";

test("the reported language definition never enters aphorism mode", () => {
  assert.equal(classifyScriptureSource(USER_DEFINITION), "definition");
  assert.equal(isAphorismSource(USER_DEFINITION), false);
  const output = renderDefinitionSource(USER_DEFINITION);
  assert.match(output, /现代汉民族共同语/u);
  assert.match(output, /普通话/u);
  assert.match(output, /北京语音为标准音/u);
  assert.match(output, /北方为基础方言/u);
  assert.match(output, /现代白话文著作为语法规范/u);
  assert.doesNotMatch(output, /的人有福|有祸|凡.*必/u);
});

test("genre classification separates definitions, notices, instructions, facts, and maxims", () => {
  assert.equal(classifyScriptureSource("通知：会议改到明天下午三点。"), "notice");
  assert.equal(classifyScriptureSource("请点击保存按钮并重启服务。"), "instruction");
  assert.equal(classifyScriptureSource("北京是中国的首都。"), "factual");
  assert.equal(classifyScriptureSource("坚持学习，才能不断取得进步。"), "aphorism");
  assert.equal(classifyScriptureSource("祝你的代码运行顺利。"), "aphorism");
  assert.equal(
    classifyScriptureSource("一次失败不能决定最终的结果，只要继续努力，总会重新站起来。"),
    "aphorism",
  );
  assert.equal(classifyScriptureSource("说话之前先想清楚，免得日后后悔。"), "aphorism");
  assert.equal(classifyScriptureSource("甲进屋以后与乙争论，随后转身离开。"), "story");
  assert.equal(
    classifyScriptureSource("晚上，李婷捡到钱包并找到失主归还。第二天，失主送来感谢信。"),
    "story",
  );
});

test("short blessings use a recognizable high-retention scripture contour", () => {
  const output = renderScriptureSkeletonPlan(
    {
      textType: "祝愿",
      units: [
        {
          kind: "declaration",
          intent: "blessing",
          elements: { subject: "你的代码", wish: "运行顺利" },
        },
      ],
    },
    "祝你的代码运行顺利。",
  );
  assert.equal(output, "愿你的代码运行在云端，如同运行在本地。");
});

test("reflection audit rejects keyword-only greed, pride, and victim-blaming matches", () => {
  const giftStory = "小林来到同事家，把一份礼物交给同事；同事收下礼物，后来写信向他道谢。";
  const greedPlan = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [{ kind: "narration", frame: "action", actor: "小林", action: "把礼物交给同事" }],
    reflection: {
      enabled: true,
      mode: "warn",
      actor: "同事",
      behavior: "贪恋礼物",
      outcome: "受到亏损",
      relation: "cause_result",
      polarity: "negative",
      evidence: ["同事收下礼物"],
    },
  }));
  assert.ok(greedPlan);
  assert.ok(assessScriptureStoryPlan(greedPlan, giftStory).length > 0);

  const falseHarvestPlan = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [{ kind: "narration", frame: "action", actor: "小林", action: "把礼物交给同事" }],
    reflection: {
      enabled: true,
      mode: "commend",
      actor: "小林",
      behavior: "把礼物交给同事",
      outcome: "同事写信道谢",
      relation: "effort_harvest",
      polarity: "positive",
      evidence: ["把一份礼物交给同事", "后来写信向他道谢"],
    },
  }));
  assert.ok(falseHarvestPlan);
  assert.ok(
    assessScriptureStoryPlan(falseHarvestPlan, giftStory).some((issue) => /effort_harvest/u.test(issue)),
  );

  const disputeStory = "甲来到屋里，与乙争论安排；后来二人各自离开，并没有人受伤。";
  const pridePlan = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [{ kind: "narration", frame: "action", actor: "甲", action: "与乙争论安排" }],
    reflection: {
      enabled: true,
      mode: "warn",
      actor: "甲",
      behavior: "与乙争论安排",
      outcome: "二人各自离开",
      relation: "self_exaltation",
      polarity: "negative",
      evidence: ["与乙争论安排", "二人各自离开"],
    },
  }));
  assert.ok(pridePlan);
  assert.ok(assessScriptureStoryPlan(pridePlan, disputeStory).some((issue) => /自高/u.test(issue)));

  const victimStory = "张明来到门口，李强突然把他打伤；随后张明被送到医院。";
  const victimPlan = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [{ kind: "narration", frame: "outcome", actor: "张明", action: "被送到医院" }],
    reflection: {
      enabled: true,
      mode: "warn",
      actor: "张明",
      behavior: "招惹李强",
      outcome: "被李强打伤",
      relation: "cause_result",
      polarity: "negative",
      evidence: ["李强突然把他打伤"],
    },
  }));
  assert.ok(victimPlan);
  assert.ok(assessScriptureStoryPlan(victimPlan, victimStory).length > 0);
});

test("neutral factual text rejects invented blessing and punishment", () => {
  assert.equal(
    hasForbiddenMoralization("北京是中国的首都。", "住在北京的人有福了。"),
    true,
  );
  assert.equal(
    hasForbiddenMoralization("诚实待人，终必得着信任。", "诚实的人有福了。"),
    false,
  );
});

test("aphorism rendering uses varied library contours instead of one blessing frame", () => {
  const outputs = [
    renderCuvAphorism("说话以前先想清楚", "免去日后的后悔"),
    renderCuvAphorism("每天认真工作", "看见劳苦的果效"),
    renderCuvAphorism("用恶意对待别人", "从别人得着恶意"),
    renderCuvAphorism("在众人面前抬高自己", "因骄傲降为卑"),
  ];
  assert.equal(new Set(outputs).size, outputs.length);
  assert.ok(outputs.filter((output) => /有福/u.test(output)).length <= 1);
  assert.ok(outputs.some((output) => /智慧为首/u.test(output)));
  assert.ok(outputs.some((output) => /诸般勤劳都有益处/u.test(output)));
});

test("scripture results receive stable verse divisions without breaking paired clauses", () => {
  const definition = renderDefinitionSource(USER_DEFINITION);
  const verses = segmentScriptureText(definition);
  assert.equal(verses.length, 2);
  assert.match(verses[0].text, /乃是这样：$/u);
  assert.match(verses[1].text, /^它以北京语音/u);
  assert.equal(formatScriptureVerses(verses).split("\n")[1].startsWith("2 "), true);

  const paired = segmentScriptureText(
    "凡自称为龙的，必叫他盘着；凡自称为虎的，也必叫他卧着。",
  );
  assert.equal(paired.length, 1);
});

test("dialogue verses break after complete quotations, not inside them", () => {
  const verses = segmentScriptureText(
    "甲对乙说：“你若愿意，就到这里来；我必等候你。”乙回答说：“我必照你所说的行。”",
  );
  assert.equal(verses.length, 2);
  assert.match(verses[0].text, /等候你。”$/u);
  assert.match(verses[1].text, /^乙回答说/u);
});

test("long stories group short sentences instead of numbering every sentence", () => {
  const story = Array.from(
    { length: 18 },
    (_, index) => `那时，第${index + 1}件事显明在众人面前，众人就把所看见的记下来。`,
  ).join("");
  const verses = segmentScriptureText(story);
  assert.ok(verses.length < 18);
  assert.ok(verses.length >= 7);
  assert.ok(verses.every((verse) => [...verse.text].length <= 108));
});

const NEIGHBOR_STORY =
  "傍晚，陈明下班回家，看见邻居王叔的电动车倒在雨里，便停下来扶起车，又把散落的菜装回篮子。王叔赶来，说自己急着给生病的妻子送药。陈明说：“你先回去照顾她，这些东西我替你送到楼上。”他冒雨搬完东西，回家时衣服已经湿透。第二天，王叔带着一袋水果来道谢，陈明只收下一只苹果，说邻里之间本该彼此照应。";

test("story grounding repairs gift direction and drops unsupported reflections", () => {
  const parsed = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [
      {
        kind: "speech",
        intent: "courtesy_gift",
        speaker: "陈明",
        addressee: "王叔",
        elements: { gift: "一只苹果" },
      },
    ],
    reflection: {
      enabled: true,
      mode: "warn",
      actor: "陈明",
      behavior: "贪图财物引起纷争",
      outcome: "受到刑罚",
      relation: "cause_result",
      polarity: "negative",
      evidence: ["邻里之间本该彼此照应"],
    },
  }));
  assert.ok(parsed);
  const grounded = groundScriptureSkeletonPlan(parsed, NEIGHBOR_STORY);
  const gift = grounded.units.find((unit) => unit.kind === "speech");
  assert.equal(gift?.kind === "speech" ? gift.speaker : "", "王叔");
  assert.equal(gift?.kind === "speech" ? gift.addressee : "", "陈明");
  assert.equal(gift?.kind === "speech" ? gift.elements.gift : "", "一袋水果");
  assert.equal(grounded.reflection, undefined);
});

test("specific help survives the famous speech frame instead of becoming an empty offer", () => {
  const parsed = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [
      {
        kind: "speech",
        intent: "offer_help",
        speaker: "陈明",
        addressee: "王叔",
        elements: {
          recipientAction: "回去照顾生病的妻子",
          action: "把这些东西送到楼上",
        },
      },
      {
        kind: "declaration",
        intent: "general_rule",
        elements: { category: "帮助邻居", result: "彼此照应" },
      },
    ],
  }));
  assert.ok(parsed);
  const rendered = renderScriptureSkeletonPlan(parsed, NEIGHBOR_STORY);
  assert.match(rendered, /回去照顾生病的妻子/u);
  assert.match(rendered, /论到这些东西，我必替你送到楼上/u);
  assert.match(rendered, /各人不要单顾自己的事，也要顾别人的事/u);
  assert.doesNotMatch(rendered, /过错|纷争|报应/u);
});

test("gratitude money is not misread as an offer of help and short refusals stay grammatical", () => {
  const source = "晚上，李婷把钱包归还。赵师傅拿出二百元感谢她，李婷摇头说这钱不能要；随后二人各自离开。";
  const parsed = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [
      {
        kind: "speech",
        intent: "offer_help",
        speaker: "赵师傅",
        addressee: "李婷",
        elements: { action: "取出二百元感谢她" },
      },
      {
        kind: "speech",
        intent: "refusal",
        speaker: "李婷",
        addressee: "赵师傅",
        elements: { matter: "这钱", action: "要" },
      },
    ],
  }));
  assert.ok(parsed);
  const grounded = groundScriptureSkeletonPlan(parsed, source);
  assert.equal(grounded.units.filter((unit) => unit.kind === "speech").length, 1);
  const rendered = renderScriptureSkeletonPlan(grounded, source);
  assert.match(rendered, /论到这钱，我断不收取/u);
  assert.doesNotMatch(rendered, /凡我手所能行的/u);
});

test("praise reactions join their object instead of producing a broken semicolon", () => {
  const source = "后来众人看见这事，就称赞李婷做事诚实。";
  const output = renderScriptureSkeletonPlan({
    textType: "记事",
    units: [
      {
        kind: "narration",
        frame: "reaction",
        actor: "众人",
        action: "称赞",
        result: "李婷做事诚实",
      },
    ],
  }, source);
  assert.match(output, /称赞李婷做事诚实/u);
  assert.doesNotMatch(output, /称赞；/u);
});

test("a time-only transition is merged into the following event", () => {
  const parsed = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [
      {
        kind: "narration",
        frame: "transition",
        time: "第二天",
      },
      {
        kind: "narration",
        frame: "arrival",
        actor: "王叔",
        action: "带着一袋水果来道谢",
      },
    ],
  }));
  assert.ok(parsed);
  const grounded = groundScriptureSkeletonPlan(parsed, NEIGHBOR_STORY);
  assert.equal(grounded.units.length, 1);
  assert.equal(grounded.units[0]?.kind, "narration");
  assert.equal(
    grounded.units[0]?.kind === "narration" ? grounded.units[0].time : "",
    "第二天",
  );
  const rendered = renderScriptureSkeletonPlan(grounded, NEIGHBOR_STORY);
  assert.match(rendered, /到了第二天，王叔带着一袋水果来道谢/u);
  assert.doesNotMatch(rendered, /及至事情到了这一步/u);
});

test("ordinary settings and arrivals never invent a prepared venue", () => {
  const parsed = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [
      { kind: "narration", frame: "setting", time: "傍晚", place: "家门口" },
      { kind: "narration", frame: "arrival", actor: "王叔", action: "赶来" },
    ],
  }));
  assert.ok(parsed);
  const rendered = renderScriptureSkeletonPlan(parsed, "傍晚，王叔赶到家门口。陈明在那里等他。");
  assert.match(rendered, /那时正是傍晚/u);
  assert.match(rendered, /王叔赶来/u);
  assert.doesNotMatch(rendered, /家门口中|预备妥当/u);
});

test("end-to-end story assessment rejects the reported regression and accepts a grounded story", () => {
  const regressed =
    "那时正是傍晚，家门口中已经预备妥当。陈明就扶起电动车。到了第二天，陈明说：‘只把我手中所有的一只苹果给你。’爱能遮掩邻里之间中的许多过错。";
  const bad = assessScriptureStoryResult(NEIGHBOR_STORY, regressed);
  assert.equal(bad.acceptable, false);
  assert.ok(bad.issues.some((issue) => /礼物方向反转/u.test(issue)));
  assert.ok(bad.issues.some((issue) => /生病|药/u.test(issue)));

  const grounded =
    "那时正是傍晚，陈明下班回家，看见邻居王叔的电动车倒在雨里，就扶起车，又把散落的菜装回篮子。王叔赶来，陈明听见他说妻子生病，急着给她送药。陈明对王叔说：‘你只管回去照顾她；论到这些东西，我必替你送到楼上。’他冒雨搬完东西；及至回家的时候，衣服已经湿透。到了第二天，王叔带着一袋水果来道谢，陈明只收下一只苹果。各人不要单顾自己的事，也要顾别人的事。";
  const good = assessScriptureStoryResult(NEIGHBOR_STORY, grounded);
  assert.equal(good.acceptable, true, good.issues.join("；"));
});

test("story endings add one distinct recognizable CUV reflection matched to verified evidence", () => {
  const walletSource =
    "晚上，李婷在公交站捡到一个钱包，按照地址找到赵师傅，把钱包原样归还。赵师傅拿出二百元感谢她，李婷说：‘这钱我不能要。’第二天，赵师傅送来一封感谢信。";
  const walletPlan = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [
      { kind: "narration", frame: "action", actor: "李婷", action: "把钱包原样归还给赵师傅" },
      { kind: "narration", frame: "outcome", actor: "赵师傅", action: "送来一封感谢信", time: "第二天" },
    ],
    reflection: {
      enabled: true,
      mode: "commend",
      actor: "李婷",
      behavior: "把钱包原样归还并拒收二百元",
      outcome: "赵师傅送来一封感谢信",
      relation: "value_comparison",
      polarity: "positive",
      evidence: ["把钱包原样归还", "这钱我不能要", "赵师傅送来一封感谢信"],
    },
  }));
  assert.ok(walletPlan);
  const wallet = renderScriptureSkeletonPlan(walletPlan, walletSource);
  assert.match(wallet, /\n\n美名胜过大财；恩宠强如金银。$/u);
  assert.doesNotMatch(wallet, /正如经上所记|这话.*显明|李婷因/u);
  assert.doesNotMatch(wallet, /所以，凡听见这事的，都当思想/u);

  const workSource =
    "清晨，小周来到公司。主管说：‘预算太高，下午以前再改一版。’小周虽然疲惫，却没有争辩，重新核算费用，午后交出方案并通过。";
  const workPlan = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [
      { kind: "narration", frame: "action", actor: "小周", action: "重新核算费用" },
      { kind: "narration", frame: "outcome", actor: "小周", action: "交出方案并通过", time: "午后" },
    ],
    reflection: {
      enabled: true,
      mode: "commend",
      actor: "小周",
      behavior: "虽然疲惫却没有争辩，重新核算费用",
      outcome: "午后交出方案并通过",
      relation: "effort_harvest",
      polarity: "positive",
      evidence: ["小周虽然疲惫，却没有争辩，重新核算费用", "午后交出方案并通过"],
    },
  }));
  assert.ok(workPlan);
  const work = renderScriptureSkeletonPlan(workPlan, workSource);
  assert.match(work, /\n\n流泪撒种的，必欢呼收割。$/u);
  assert.doesNotMatch(work, /正如经上所记|小周.*果效|这话.*应验/u);
  assert.doesNotMatch(work, /美名胜过大财/u);

  const neighborPlan = parseScriptureSkeletonPlan(JSON.stringify({
    textType: "记事",
    units: [
      { kind: "narration", frame: "action", actor: "陈明", action: "帮助王叔搬完东西" },
    ],
    reflection: {
      enabled: true,
      mode: "commend",
      actor: "陈明",
      behavior: "冒雨搬完东西帮助王叔",
      outcome: "王叔带着一袋水果来道谢",
      relation: "care_for_others",
      polarity: "positive",
      evidence: ["他冒雨搬完东西", "王叔带着一袋水果来道谢"],
    },
  }));
  assert.ok(neighborPlan);
  const neighbor = renderScriptureSkeletonPlan(neighborPlan, NEIGHBOR_STORY);
  assert.match(neighbor, /\n\n各人不要单顾自己的事，也要顾别人的事。$/u);
  assert.doesNotMatch(neighbor, /正如经上所记|这话.*显明/u);
});
