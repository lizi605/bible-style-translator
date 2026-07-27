import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCuvAnchorPrompt,
  CUV_FAMOUS_ANCHORS,
  famousAnchorStyleScore,
  missingMandatoryCuvAnchors,
  requiredFamousAnchorStyleScore,
  selectCuvAnchors,
} from "../lib/cuvAnchors";
import {
  buildCuvLexiconPrompt,
  findUnrecastCuvLexiconItems,
  normalizeCuvSceneLexicon,
  selectCuvLexiconEntries,
} from "../lib/cuvLexicon";
import {
  buildPlainPrompt,
  buildScripturePrompt,
  buildScriptureReplacementPrompt,
  buildStructuredStoryRealizationPrompt,
  PLAIN_SYSTEM_PROMPT,
  SCRIPTURE_REPLACEMENT_SYSTEM_PROMPT,
  SCRIPTURE_SYSTEM_PROMPT,
  STRUCTURED_STORY_REALIZATION_SYSTEM_PROMPT,
  scriptureModeInstructions,
  type ScriptureMode,
} from "../lib/prompt";
import {
  assessUnionStyleResult,
  findContradictoryDialogueAnchors,
  findGenericClassicalCliches,
  findLowRetentionUnionDialogues,
  findRepeatedActionRestatements,
  findUnanchoredUnionDialogues,
  findUnsupportedNarrativeDetails,
  findVerbatimSourceDialogueFragments,
  hasVerbatimSourceDialogue,
  normalizeUnionNarration,
  requiredUnionStyleSectionCoverage,
  requiredUnionStyleScore,
  scriptureCandidatePenalty,
  unionStyleSectionCoverage,
  unionStyleScore,
} from "../lib/scriptureQuality";
import {
  SONG_TIGER_REFERENCE_OUTPUT,
  SONG_TIGER_SCENE_INPUT,
} from "./fixtures/song-tiger";
import {
  SONG_TIGER_REGRESSED_OUTPUT,
  SONG_TIGER_STYLE_RECOVERY_SAMPLE,
} from "./fixtures/song-tiger-regressed";
import {
  RUIS_STORY_INPUT,
  RUIS_STORY_TARGET,
} from "./fixtures/ruis-story";

const modes: ScriptureMode[] = [
  "original",
  "babel",
  "loaves",
  "david",
  "prodigal",
  "samaritan",
  "ark",
  "solomon",
  "jonah",
];

test("original mode gives Union Version style priority over source wording", () => {
  const prompt = buildScripturePrompt(SONG_TIGER_SCENE_INPUT, "original", "standard");
  assert.match(prompt, /最高优先级是写成一篇完整、连贯、一眼可辨的和合本式圣经小故事/);
  assert.match(prompt, /原文的对白轮次、句序、寒暄和次要细节可以大胆合并、调序或舍弃/);
  assert.match(prompt, /普通句子和人物台词必须重新组织/);
  assert.match(prompt, /连续四个以上普通汉字不得原样连续出现/);
});

test("structured story realization rejects a numbered modern synopsis", () => {
  const modernSynopsis = RUIS_STORY_INPUT;
  assert.equal(
    assessUnionStyleResult(RUIS_STORY_INPUT, modernSynopsis).acceptable,
    false,
  );
  assert.equal(
    assessUnionStyleResult(RUIS_STORY_INPUT, RUIS_STORY_TARGET).acceptable,
    true,
  );
  assert.match(STRUCTURED_STORY_REALIZATION_SYSTEM_PROMPT, /不得把人物简介、百科设定/u);
  assert.match(
    buildStructuredStoryRealizationPrompt(
      RUIS_STORY_INPUT,
      modernSynopsis,
      "目标篇幅接近原文。",
    ),
    /可信事实草稿/u,
  );
});

test("original mode may rewrite around the plot spine instead of translating line by line", () => {
  const prompt = buildScripturePrompt(SONG_TIGER_SCENE_INPUT, "original", "grand");
  for (const pattern of [
    /情节／信息主干/,
    /不要逐句翻译/,
    /允许合并寒暄、重复称呼和相近发言/,
    /允许重排次要动作/,
    /人物、核心诉求、关键冲突、动作归属和结局不可改变/,
  ]) {
    assert.match(prompt, pattern);
  }
});

test("replacement stage uses the identification plan without exposing original dialogue", () => {
  const originalDialogue = "你今天答应也得答应，你今天不答应也得答应。";
  const blueprint =
    "振涛强迫刘华强接受要求，不给拒绝余地；刘华强反问自己应当怎样离开。";
  const prompt = buildScriptureReplacementPrompt(
    blueprint,
    originalDialogue,
    "grand",
  );
  assert.match(prompt, /第二步“替换”/);
  assert.match(prompt, /第一步生成的识别计划/);
  assert.match(prompt, /严格执行 stylePlan、anchorAssignments、dialoguePlan 与 sceneRecasts/);
  assert.match(prompt, new RegExp(blueprint));
  assert.doesNotMatch(prompt, new RegExp(originalDialogue));
});

test("replacement system prompt makes style the first priority", () => {
  assert.match(SCRIPTURE_REPLACEMENT_SYSTEM_PROMPT, /第二步“替换”/);
  assert.match(SCRIPTURE_REPLACEMENT_SYSTEM_PROMPT, /和合本句法与叙事节奏第一/);
  assert.match(SCRIPTURE_REPLACEMENT_SYSTEM_PROMPT, /一个动作节点只写一次/);
});

test("system prompt demands unmistakable Union Version narrative and language", () => {
  for (const pattern of [
    /不看标题也能立刻感到/,
    /和合本叙事风格与旧译语言风格必须鲜明/,
    /和合本叙事骨架/,
    /重复主语与连续推进/,
    /理由、条件与后果使用旧译关系/,
    /强调与论证使用旧译复沓/,
    /著名句式锚点的换骨法/,
    /广为流传的《圣经》和合本通行措辞/,
    /高保留换槽/,
    /主语、动词、宾语、条件和结果/,
    /输出不可弱于这些示例/,
  ]) {
    assert.match(SCRIPTURE_SYSTEM_PROMPT, pattern);
  }
});

test("famous anchors are selected by source meaning and exposed as fillable frames", () => {
  const source = "小李请求经理批准预算；批准以后，小李和同事一起完成升级。";
  const anchors = selectCuvAnchors(source);
  const ids = anchors.map((anchor) => anchor.id);
  assert.ok(ids.includes("request-favor"));
  assert.ok(ids.includes("all-work-together"));
  assert.ok(ids.includes("former-now"));

  const prompt = buildCuvAnchorPrompt(source);
  assert.match(prompt, /前 1 项标为“本篇必用”/);
  assert.match(prompt, /【本篇必用】/);
  assert.match(prompt, /本次指定的著名句式任务/);
  assert.match(prompt, /先从原文抽取主语、动作、对象、条件和结果/);
  assert.match(prompt, /广为流传的《和合本》通行措辞/);
  assert.match(prompt, /高保留换槽/);
  assert.match(prompt, /有福、有祸、罪、审判、见证、牧者/);
  assert.match(prompt, /不得把槽位文字输出/);
});

test("high-retention famous anchors cover widely known confrontation lines", () => {
  const source =
    "振涛骂刘华强算什么东西，又说他太年轻。刘华强说龙要盘着，虎要卧着。随后振涛拿刀动手。";
  const ids = selectCuvAnchors(source).map((anchor) => anchor.id);
  assert.ok(ids.includes("known-who-question"));
  assert.ok(ids.includes("young-not-despised"));
  assert.ok(ids.includes("paired-fate"));
  assert.ok(ids.includes("sword-consequence"));

  const prompt = buildCuvAnchorPrompt(source);
  assert.match(prompt, /耶稣我认识，保罗我也知道。你们却是谁呢/);
  assert.match(prompt, /凡自称龙的，必叫他盘着/);
  assert.match(prompt, /凡自称虎的，也必叫他卧着/);
});

test("generic Union Version fallbacks cover names and threats beyond one story", () => {
  const source =
    "张三向众人报上姓名，说自己名叫张三；李四随后威胁说要弄死王五，但王五坚决不答应他的要求。";
  const ids = selectCuvAnchors(source).map((anchor) => anchor.id);
  assert.ok(ids.includes("name-declaration"));
  assert.ok(ids.includes("death-threat"));
  assert.ok(ids.includes("solemn-refusal"));

  const prompt = buildCuvAnchorPrompt(source);
  assert.match(prompt, /论到我的名，人所称呼我的名乃是/);
  assert.match(prompt, /我必夺取/);
  assert.match(prompt, /我断不/);
});

test("expanded anchor library includes story, dialogue, and general Union Version frames", () => {
  assert.equal(CUV_FAMOUS_ANCHORS.length, 99);

  const source =
    "我最近压力很大，十分劳累，需要休息。大家应当先做最重要的任务，再调查旧方案。后来真相公开，误解终于消失。";
  const ids = selectCuvAnchors(source).map((anchor) => anchor.id);
  assert.ok(ids.includes("burden-and-rest"));
  assert.ok(ids.includes("seek-first"));
  assert.ok(ids.includes("stand-and-ask-old-paths"));
  assert.ok(ids.includes("truth-makes-free"));

  const prompt = buildCuvAnchorPrompt(source);
  assert.match(prompt, /凡劳苦担重担的人/);
  assert.match(prompt, /你们要先求他的国和他的义/);
  assert.match(prompt, /你们必晓得真理/);
});

test("long conflict inputs receive as many semantically useful mandatory anchors as available", () => {
  const source = `${"甲带着同伴来到饭店，乙请求甲不要再找丙。甲说这不是不还钱，乃是暂借。乙有乙的兄弟，甲也有甲的朋友。众人都靠各自的人吃饭。".repeat(20)}`;
  const selected = selectCuvAnchors(source);
  assert.deepEqual(
    selected.slice(0, 4).map((anchor) => anchor.id),
    ["come-inside", "come-and-dine", "friend-in-adversity", "lend-do-not-refuse"],
  );
  const prompt = buildCuvAnchorPrompt(source);
  assert.equal((prompt.match(/【本篇必用】/g) || []).length, 10);

  const incomplete =
    "这不是强取，乃是暂借。你有你的兄弟，我也有我的朋友。";
  assert.deepEqual(
    missingMandatoryCuvAnchors(source, incomplete).map((anchor) => anchor.id),
    [
      "come-inside",
      "come-and-dine",
      "friend-in-adversity",
      "lend-do-not-refuse",
      "request-favor",
      "command-prohibition",
      "all-things-parallel",
    ],
  );
});

test("confrontation anchor is withheld unless both sides' means exist in source", () => {
  const genericConflict = selectCuvAnchors(SONG_TIGER_SCENE_INPUT);
  assert.equal(
    genericConflict.some((anchor) => anchor.id === "you-me-confrontation"),
    false,
  );

  const explicitMeans = selectCuvAnchors(
    "你拿着合同来压我，我却用账目向你证明。",
  );
  assert.equal(
    explicitMeans.some((anchor) => anchor.id === "you-me-confrontation"),
    true,
  );
});

test("completion anchor is withheld from notices that have not been carried out", () => {
  const notice = selectCuvAnchors(
    "产品经理通知大家：今天下午三点开会，请前端演示页面。",
  );
  assert.equal(
    notice.some((anchor) => anchor.id === "command-result"),
    false,
  );

  const completed = selectCuvAnchors(
    "经理吩咐前端完成页面演示，前端已经完成，测试也记录好了问题。",
  );
  assert.equal(
    completed.some((anchor) => anchor.id === "command-result"),
    true,
  );
  const completionFrame = completed.find(
    (anchor) => anchor.id === "command-result",
  )?.fillableFrame;
  assert.match(completionFrame || "", /要有【输入已经实现的事物或结果】/);
  assert.doesNotMatch(completionFrame || "", /照着去行/);
});

test("generated prompt requires replacing anchor subjects, verbs, and objects", () => {
  const prompt = buildScripturePrompt(
    "老板说方案不行，让小李重新修改，改好以后交给客户。",
    "original",
    "standard",
  );
  assert.match(prompt, /至少从下列候选中选一个合宜的著名句式骨架/);
  assert.match(prompt, /内容槽位换成原文信息/);
  assert.match(prompt, /“不是……乃是……”式/);
  assert.match(prompt, /“本来……如今……”/);
});

test("scene lexicon recasts actions, objects, and places instead of only dialogue", () => {
  const source = "刘华强示意大海把带来的礼物放在雅间的桌上。";
  const prompt = buildCuvLexiconPrompt(source);
  const selected = selectCuvLexiconEntries(source).map((entry) => entry.id);

  assert.ok(selected.includes("gesture-signal"));
  assert.ok(selected.includes("gift-placement"));
  assert.ok(selected.includes("table-banquet"));
  assert.ok(selected.includes("restaurant-room"));
  assert.match(prompt, /场景元素圣经化/);
  assert.match(prompt, /不要原样写‘示意’/);
  assert.match(prompt, /摆在众人面前/);
  assert.match(prompt, /席上、席前、筵席之间/);
  assert.deepEqual(findUnrecastCuvLexiconItems(source, source), [
    "“眼神、示意与无声命令”仍保留现代直述",
    "“礼物、物件与摆放”仍保留现代直述",
    "“桌子、酒桌与席面”仍保留现代直述",
    "“饭店、雅间与室内场所”仍保留现代直述",
  ]);
  assert.deepEqual(
    findUnrecastCuvLexiconItems(
      source,
      "刘华强便转眼看大海；大海就把所带来的礼物取出，摆在众人面前。他们正在摆设筵席的屋里。",
    ),
    [],
  );
  assert.equal(
    normalizeCuvSceneLexicon(
      source,
      "刘华强用眼神示意大海，大海将礼物陈在那筵席的桌上。",
    ),
    "刘华强以目吩咐大海，大海将礼物陈在那筵席之前。",
  );
  assert.equal(
    normalizeCuvSceneLexicon(
      source,
      "他们进了那饭店中摆设筵席的屋里。",
    ),
    "他们进了那摆设筵席的屋里。",
  );
  assert.equal(
    normalizeCuvSceneLexicon(
      source,
      "大海将礼物摆在那饭店中摆设筵席的屋里的桌上。",
    ),
    "大海将礼物摆在席前。",
  );
});

test("famous-anchor quality gate recognizes adapted syntax instead of copied theology", () => {
  const adapted =
    "这不是可以交付的方案，乃是仍要修整的方案；小李若照着经理所说的去行，修改的事便能成就。";
  const plain = "经理觉得方案不行，让小李修改后交给客户。";
  assert.ok(famousAnchorStyleScore(adapted) >= 1);
  assert.equal(famousAnchorStyleScore(plain), 0);
  assert.equal(requiredFamousAnchorStyleScore("一句短话"), 1);
  assert.equal(requiredFamousAnchorStyleScore("一".repeat(140)), 2);
  assert.equal(requiredFamousAnchorStyleScore("一".repeat(800)), 8);
});

test("quality gate rejects generic classical and wuxia narration", () => {
  assert.deepEqual(
    findGenericClassicalCliches(
      "说时迟，那时快，振涛拍案而起；刘华强不动声色，果然名不虚传。",
    ),
    ["说时迟[，,]?那时快", "名不虚传", "不动声色", "拍案而起"],
  );
});

test("Union Version wording is distinguished from generic classical Chinese", () => {
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /和合本语言，不是普通文言文/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /长关系句、重复主语、条件后果、反问递进/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /曰、吾、汝、尔、矣、焉、遂、盖、未几/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /不得写成文言小品、武侠小说或古装台词/);
});

test("all source forms are recast into matching Union Version genres", () => {
  for (const pattern of [
    /故事、冲突、聊天：写成连续记事/,
    /独白、抱怨、情绪：写成第一人称哀叹、见证或呼告/,
    /通知、规则、请求：写成晓谕、劝戒、条例或祈求/,
    /观点、评论、金句：写成训诲或书信式论证/,
    /广告、产品介绍：写成郑重宣告或见证/,
    /技术说明、教程、报错：写成条例与工程记载/,
    /清单：可以保留列项/,
  ]) {
    assert.match(SCRIPTURE_SYSTEM_PROMPT, pattern);
  }
});

test("dialogue keeps meaning but must be newly written", () => {
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /人物对白必须重新创作/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /优先保留第一人称直接发言/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /至少包含两种和合本机制/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /相邻的同义台词可以合并/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /次要招呼可以写成叙述/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /连续四个以上普通汉字，不应原样连续出现在终稿中/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /龙必要屈身盘伏，虎也必要俯首而卧/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /每一段保留在引号中的直接对白/);
  assert.match(SCRIPTURE_SYSTEM_PROMPT, /必须改成间接叙述/);
  assert.doesNotMatch(
    SONG_TIGER_REFERENCE_OUTPUT,
    /在我面前，是龙得盘着，是虎得卧着/,
  );
});

test("every direct dialogue must carry its own famous Union Version frame", () => {
  const ordinary =
    "振涛说：“你算个什么人，也敢这样说话？”宋老虎说：“振涛，不可无礼！”";
  const anchored =
    "振涛说：“我实在告诉你，凡轻看我哥哥的，必要回答他所说的话。”宋老虎说：“振涛，你若仍以辱骂待客，就不可再在席间开口。”";
  const fakeConditional = "刘华强说：“你若有话，只管直说，不必绕弯子。”";

  assert.deepEqual(findUnanchoredUnionDialogues(ordinary), [
    "你算个什么人",
    "振涛，不可无礼！",
  ]);
  assert.deepEqual(findUnanchoredUnionDialogues(anchored), []);
  assert.deepEqual(findUnanchoredUnionDialogues(fakeConditional), [
    "只管直说",
  ]);
  assert.deepEqual(
    findUnanchoredUnionDialogues(
      "刘华强说：“宋老虎我认识，大海我也知道。你却是谁呢？”又说：“凡自称龙的，必叫他盘着；凡自称虎的，也必叫他卧着。”",
    ),
    [],
  );
  assert.deepEqual(
    findUnanchoredUnionDialogues(
      "振涛说：“我实在告诉你，我弄死你！”刘华强说：“我名叫刘华强。”",
    ),
    ["我弄死你", "我名叫刘华强"],
  );
  assert.deepEqual(
    findUnanchoredUnionDialogues(
      "振涛说：“我必夺取你的命！”刘华强说：“论到我的名，人所称呼我的名乃是刘华强。”",
    ),
    [],
  );
  assert.deepEqual(
    findLowRetentionUnionDialogues(
      "振涛说：“我必夺取你的命！”刘华强说：“论到我的名，人所称呼我的名乃是刘华强。”",
    ),
    [],
  );
  assert.deepEqual(
    findLowRetentionUnionDialogues(
      "刘华强说：“你若有话，只管直说，不必绕弯子。”",
    ),
    ["你若有话，只管直说，不必绕弯子。"],
  );
});

test("quality gate rejects command-plus-execution restatements for arbitrary actors and objects", () => {
  const source = "张三看了李四一眼，李四把文件放在桌上。";
  const repeated =
    "张三对李四说：“把你手中的文件取出，摆在众人面前。”李四就把文件摆在席上。";
  const compact = "张三转眼看李四；李四便将手中的文件摆在众人面前。";

  assert.ok(findRepeatedActionRestatements(source, repeated).length > 0);
  assert.deepEqual(findRepeatedActionRestatements(source, compact), []);
  assert.deepEqual(findUnanchoredUnionDialogues(repeated), [
    "把你手中的文件取出",
  ]);
});

test("quality gate rejects a famous anchor assigned to a self-contradictory stance", () => {
  const contradictory =
    "王五说：“我实在告诉你，凡自高的，必降为卑；我若不气盛，还叫什么年轻人？”";
  const coherent =
    "赵六对王五说：“凡自高的，必降为卑；你虽年轻，也不可任凭气盛辖制你。”王五回答说：“我若不气盛，岂不叫人小看我年轻吗？”";

  assert.deepEqual(findContradictoryDialogueAnchors(contradictory), [
    "同一说话人既责备气盛，又以气盛为自己辩护",
  ]);
  assert.deepEqual(findContradictoryDialogueAnchors(coherent), []);
  assert.deepEqual(findUnanchoredUnionDialogues(coherent), []);
});

test("gift exchange benchmark is compact, anchored, and free of repeated actions", () => {
  const source =
    "刘华强叫了一声大海，大海便把带来的东西放下。宋老虎见状说太客气了，刘华强说只是一点小意思。";
  const broken =
    "刘华强又对大海说：“把从手中所带来的礼物取出，摆在众人面前。”大海就把礼物摆在席上。宋老虎见了，便客气推辞。刘华强说：“这不过是些小意思，何必推辞。”";
  const fixed =
    "刘华强转眼看大海；大海便将所带来的礼物取出，摆在众人面前。宋老虎看见这事，就辞谢不受。刘华强对他说：“我实在告诉你，这不是贵重之物，乃是我手中微薄的礼；你只管收下，不可推辞。”";

  assert.ok(findRepeatedActionRestatements(source, broken).length > 0);
  assert.deepEqual(findUnanchoredUnionDialogues(broken), [
    "把从手中所带来的礼物取出",
    "这不过是些小意思",
    "何必推辞",
  ]);
  assert.deepEqual(findRepeatedActionRestatements(source, fixed), []);
  assert.deepEqual(findUnanchoredUnionDialogues(fixed), []);
});

test("candidate scoring rejects a short early draft that merely preserves modern dialogue", () => {
  const source =
    "刘华强报上姓名。振涛骂他给脸不要脸，又威胁说要弄死他。宋老虎劝刘华强不要太气盛，刘华强为年轻人的气盛辩护。";
  const regressed =
    "刘华强说：“我是刘华强。”振涛骂道：“你不要给脸不要脸，我弄死你！”宋老虎说：“年轻人，不可太气盛。”刘华强回答：“若不气盛，还叫什么年轻人呢？”";
  const revised =
    "刘华强对众人说：“论到我的名，人所称呼我的名乃是刘华强。”振涛听见这话，就以恶言威吓他，说：“我必夺取你的命。”宋老虎劝他说：“凡任凭气盛辖制自己的，必自取羞辱。”刘华强回答说：“不可叫人小看我年轻；我若全无胆气，岂不叫人轻看吗？”";

  assert.ok(findUnanchoredUnionDialogues(regressed).length >= 4);
  assert.deepEqual(findUnanchoredUnionDialogues(revised), []);
  assert.ok(
    scriptureCandidatePenalty(source, regressed) >
      scriptureCandidatePenalty(source, revised),
  );
});

test("the actual regressed Song Tiger output can never outrank a scripture-styled candidate", () => {
  const badDialogues = findUnanchoredUnionDialogues(
    SONG_TIGER_REGRESSED_OUTPUT,
  );
  assert.ok(badDialogues.length >= 30);
  assert.ok(
    findLowRetentionUnionDialogues(SONG_TIGER_REGRESSED_OUTPUT).length >= 20,
  );
  assert.deepEqual(
    findUnanchoredUnionDialogues(SONG_TIGER_STYLE_RECOVERY_SAMPLE),
    [],
  );
  assert.deepEqual(
    findLowRetentionUnionDialogues(SONG_TIGER_STYLE_RECOVERY_SAMPLE),
    [],
  );
  assert.ok(
    scriptureCandidatePenalty(
      SONG_TIGER_REGRESSED_OUTPUT,
      SONG_TIGER_REGRESSED_OUTPUT,
    ) >
      scriptureCandidatePenalty(
        SONG_TIGER_REGRESSED_OUTPUT,
        SONG_TIGER_STYLE_RECOVERY_SAMPLE,
      ),
  );
});

test("quality gate detects copied dialogue and accepts the rewritten benchmark", () => {
  const copied = `宋老虎说：“在我面前，是龙得盘着，是虎得卧着。”`;
  assert.equal(hasVerbatimSourceDialogue(SONG_TIGER_SCENE_INPUT, copied), true);
  assert.equal(
    hasVerbatimSourceDialogue(SONG_TIGER_SCENE_INPUT, SONG_TIGER_REFERENCE_OUTPUT),
    false,
  );
  assert.deepEqual(
    findVerbatimSourceDialogueFragments(
      "振涛喊道：‘我弄死你！’",
      "振涛便说：‘我今日要弄死你！’",
    ),
    ["我弄死你"],
  );
});

test("long outputs must distribute Union Version syntax across the whole text", () => {
  const evenlyStyled = [
    "那时，刘华强听见这话，就开口回答。" + "众人仍在席间听着。".repeat(8),
    "及至众人争论，他复问说：岂可这样行呢？" + "众人仍在席间听着。".repeat(8),
    "于是韩跃平上前，好叫刘华强等人得以离开。" + "众人仍在席间听着。".repeat(8),
  ].join("");
  const frontLoaded =
    "那时，刘华强听见这话，就开口回答。" + "众人继续争论，随后起身离开。".repeat(30);

  assert.equal(unionStyleSectionCoverage(evenlyStyled), 3);
  assert.ok(unionStyleSectionCoverage(frontLoaded) < 3);
  assert.equal(requiredUnionStyleSectionCoverage("一".repeat(600)), 3);
});

test("quality gate detects unsupported narrative embellishment", () => {
  const embellished = "宋老虎尚未答话，振涛心里不服，如同向他宣战。韩跃平从怀中拿出刀来。";
  const findings = findUnsupportedNarrativeDetails(SONG_TIGER_SCENE_INPUT, embellished);
  assert.deepEqual(findings, [
    "擅自补写人物尚未回答",
    "擅自补写人物内心",
    "擅自增加比喻",
    "擅自升级为宣战",
  ]);
  assert.deepEqual(
    findUnsupportedNarrativeDetails(SONG_TIGER_SCENE_INPUT, SONG_TIGER_REFERENCE_OUTPUT),
    [],
  );
});

test("quality gate rejects turning future notices into completed events", () => {
  const notice =
    "产品经理通知大家：今天下午三点开会。前端演示页面，后端说明接口改动。";
  const inventedCompletion =
    "众人听见这话，就各按所吩咐的去预备。前端演示了页面，后端说明了接口改动，事就这样成了。";
  assert.deepEqual(findUnsupportedNarrativeDetails(notice, inventedCompletion), [
    "把尚未执行的通知或计划写成已经完成",
  ]);
});

test("quality gate rejects anchor-generated motives and consequences", () => {
  const source =
    "二人的冲突随即加剧。材料没有准备好，就在中午十二点前告诉我。";
  const output =
    "二人彼此不肯退让。你们当在中午十二点前告诉我，免得会中有所缺欠，以致事情不能成就。";
  assert.deepEqual(findUnsupportedNarrativeDetails(source, output), [
    "擅自补写人物不肯退让",
    "擅自补写原文没有的负面后果",
  ]);
});

test("quality gate rejects famous verses copied without replacing their content slots", () => {
  const source = "宋老虎劝刘华强不要太气盛，刘华强反问年轻人为何不能气盛。";
  const output =
    "宋老虎劝他说，凡事都有定期，天下万务都有定时；气盛有气盛的时候。";
  assert.deepEqual(findUnsupportedNarrativeDetails(source, output), [
    "照搬了没有换入原文事项的著名经文句子",
  ]);
});

test("quality gate allows minor cinematic staging that preserves the plot spine", () => {
  const source =
    "众人在饭店坐下。韩跃平拿刀刺伤振涛，大海制住宋老虎，刘华强等人离开。";
  const output =
    "众人进入雅间，韩跃平分立一旁。振涛拍案，韩跃平从怀中拔刀刺伤他，振涛倒地；刘华强从容离开。";
  assert.deepEqual(findUnsupportedNarrativeDetails(source, output), []);
});

test("final narration normalization removes generic classical-fiction phrasing", () => {
  const draft =
    "说时迟，那时快，振涛拍案而起，喝道：‘你就休想离开！’刘华强不动声色，便道：‘你待怎样？’话音未落，只见韩跃平从怀中拔刀。当下众人变了脸色。自我出道以来，未见此事。";
  const normalized = normalizeUnionNarration(draft);

  assert.equal(
    normalized,
    "正在那时，振涛拍着桌子站起身来，喝令说：‘你就不得离开！’刘华强脸色并未改变，便回答说：‘你待怎样？’这话还没有说完，看哪韩跃平从怀中拔刀。那时，众人变了脸色。从我行在这条路上直到今日，未见此事。",
  );
  assert.deepEqual(findGenericClassicalCliches(normalized), []);
  assert.equal(
    normalizeUnionNarration(
      "振涛喊道：“我弄死你！”刘华强说：“我名叫刘华强。”",
    ),
    "振涛喊道：“我必夺取你的命！”刘华强说：“论到我的名，人所称呼我的名乃是刘华强。”",
  );
  assert.equal(
    normalizeUnionNarration(
      "李四说：“我今天要杀了王五！”张三回答：“我名叫张三。”",
    ),
    "李四说：“我今日必夺取王五的命！”张三回答：“论到我的名，人所称呼我的名乃是张三。”",
  );
});

test("Song Tiger benchmark clears the Union Version style threshold", () => {
  assert.ok(
    unionStyleScore(SONG_TIGER_REFERENCE_OUTPUT) >=
      requiredUnionStyleScore(SONG_TIGER_SCENE_INPUT),
  );
  for (const phrase of [
    "我若在你眼前蒙恩",
    "好叫周转的事得以成就",
    "振涛听见这话",
    "我实在告诉你",
    "凡来到我面前的",
    "及至二人的冲突加剧",
    "于是从席间起来",
  ]) {
    assert.match(SONG_TIGER_REFERENCE_OUTPUT, new RegExp(phrase));
  }
});

test("facts, uncertainty, and modern terms remain protected", () => {
  for (const pattern of [
    /不得把可能写成必然/,
    /建议写成命令/,
    /失败写成成功/,
    /未完成写成完成/,
    /单价写成总价/,
    /品牌、技术术语、数字、单位、日期/,
    /不得补写新的阵营、交易、关键动机/,
    /可以为了叙事连贯补入雅间、落座、站位、拍案/,
  ]) {
    assert.match(SCRIPTURE_SYSTEM_PROMPT, pattern);
  }
});

test("structured story realization biblicalizes modern eras, places, venues, and exposition", () => {
  const source =
    "中世纪英格兰的欧姆伯尔家族延续到二十世纪。瑞斯在艾因赫文市经营酒吧，心理阴霾使他的成长受到阻碍。";
  const prompt = buildStructuredStoryRealizationPrompt(
    source,
    "欧姆伯尔家族来自中世纪英格兰，延续到二十世纪；瑞斯在艾因赫文市经营酒吧，因姐姐去世而悲伤。",
    "写成中篇。",
  );

  for (const phrase of [
    "世代相传，及至第二十个百年",
    "英格兰地",
    "艾因赫文城",
    "卖酒的屋",
    "不肯受安慰",
  ]) {
    assert.match(prompt, new RegExp(phrase));
  }

  const regressed =
    "中世纪英格兰的这个家族延续到二十世纪。瑞斯在艾因赫文市经营酒吧，心理阴霾成为成长的阻碍。";
  const recast =
    "古时，在英格兰地有一宗族；这事世代相传，及至第二十个百年，仍未止息。瑞斯往艾因赫文城去，在一间卖酒的屋里作工。姐姐死后，他不肯受安慰。";
  assert.ok(findUnrecastCuvLexiconItems(source, regressed).length >= 4);
  assert.deepEqual(findUnrecastCuvLexiconItems(source, recast), []);
  assert.equal(assessUnionStyleResult(source, regressed).acceptable, false);
});

test("length levels keep stylistic recasting concise", () => {
  const light = buildScripturePrompt("一句短话。", "original", "light");
  const standard = buildScripturePrompt("一句短话。", "original", "standard");
  const grand = buildScripturePrompt("一句短话。", "original", "grand");
  assert.match(light, /0\.9—1\.3倍/);
  assert.match(standard, /1—1\.6倍/);
  assert.match(grand, /1\.3—2\.2倍/);
});

test("optional legacy shells remain distinct", () => {
  const prompts = modes.map((mode) => buildScripturePrompt("一件现代小事。", mode, "light"));
  assert.equal(new Set(prompts).size, modes.length);
  assert.match(prompts[1], /巴别塔体/);
  assert.match(prompts[2], /五饼二鱼体/);
  assert.match(prompts[8], /约拿逃命体/);
  for (const mode of modes) assert.ok(scriptureModeInstructions[mode].length > 30);
});

test("reverse prompt restores natural Chinese", () => {
  const prompt = buildPlainPrompt("我实在告诉你，这事必要成就。", "standard", "direct");
  assert.match(PLAIN_SYSTEM_PROMPT, /翻回自然现代中文/);
  assert.match(prompt, /不把失败改成成功/);
  assert.match(prompt, /不把可能性说成事实/);
});
