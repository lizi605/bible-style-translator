import {
  CUV_FAMOUS_ANCHORS,
  missingMandatoryCuvAnchors,
} from "@/lib/cuvAnchors";
import { findUnrecastCuvLexiconItems } from "@/lib/cuvLexicon";

const DIRECT_SPEECH_PATTERN = /[“"‘']([^”"’'\n]{1,})[”"’']/gu;

const DIRECT_SPEECH_ANCHOR_PATTERNS = [
  /我实在告诉/u,
  /我若在.{0,16}眼前蒙恩/u,
  /我(?:认识|知道).{1,30}我也(?:认识|知道).{1,30}你却是谁/u,
  /我岂是.{0,24}(?:看守|看管|照管|负责).{0,16}的吗/u,
  /凡.{1,36}(?:的|都|必|不可)/u,
  /不是.{1,48}乃是/u,
  /是.{0,8}就说是.{0,12}不是.{0,8}就说不是/u,
  /你有.{1,30}我(?:也)?有/u,
  /若.{1,48}(?:就|便|必要|必定|不可|不得|不能)/u,
  /岂.{0,40}(?:呢|吗|么|？|\?)/u,
  /何况/u,
  /尚且.{1,40}何况/u,
  /(?:从前|先前|本来).{1,48}(?:如今|现今)/u,
  /(?:我|你|他)是什么.{0,16}竟(?:能|敢)/u,
  /你(?:凭|带着|拿着).{0,24}(?:我却|我便|我也)/u,
  /(?:有|到了).{0,20}(?:定期|定时|时候|时辰)/u,
  /心里所充满的.{0,12}口里就说出来/u,
  /所种的是什么.{0,12}收的也是什么/u,
  /不可叫人小看.{0,16}年轻/u,
  /用什么量器.{0,20}也必用什么量器/u,
  /在后的.{0,12}(?:在前|要在前).{0,20}在前的.{0,12}(?:在后|要在后)/u,
  /看哪/u,
  /祈求.{0,24}就|寻找.{0,24}寻见|叩门.{0,24}开门/u,
  /无论.{1,32}(?:都|也|必|不可)/u,
  /所.{1,20}的.{0,24}(?:必|不可|就是|乃是)/u,
  /论到我的名.{0,24}(?:人所称呼我的名|人称我).{0,12}(?:乃是|为)/u,
  /我必.{2,48}/u,
  /我断不.{2,48}/u,
  /你当.{2,48}(?:不可|免得)/u,
  /我必照.{0,24}所说的.{0,16}(?:去行|行|办理)/u,
] as const;

const HIGH_RETENTION_DIALOGUE_PATTERNS = [
  /我实在告诉/u,
  /我若在.{0,16}眼前蒙恩.{0,12}(?:求|请)/u,
  /我(?:认识|知道).{1,30}我也(?:认识|知道).{1,30}你却是谁/u,
  /我岂是.{0,24}(?:看守|看管|照管|负责).{0,16}的吗/u,
  /你(?:凭|带着|拿着).{0,24}(?:我却|我便|我也)/u,
  /凡.{1,32}的.{0,10}(?:必|不可|都要)/u,
  /凡(?:是)?.{1,20}的.{0,8}必.{1,24}[；，].{0,12}凡(?:是)?.{1,20}的.{0,10}(?:也)?必/u,
  /不是.{1,48}乃是/u,
  /是.{0,8}就说是.{0,12}不是.{0,8}就说不是/u,
  /你有.{1,30}我(?:也)?有/u,
  /尚且.{1,40}何况/u,
  /(?:从前|先前|本来).{1,48}(?:如今|现今)/u,
  /心里所充满的.{0,12}口里就说出来/u,
  /所种的是什么.{0,12}收的也是什么/u,
  /不可叫人小看.{0,16}年轻/u,
  /用什么量器.{0,20}也必用什么量器/u,
  /在后的.{0,12}(?:在前|要在前).{0,20}在前的.{0,12}(?:在后|要在后)/u,
  /祈求.{0,24}就|寻找.{0,24}寻见|叩门.{0,24}开门/u,
  /论到我的名.{0,24}(?:人所称呼我的名|人称我).{0,12}(?:乃是|为)/u,
  /我必(?:夺取|取|断绝).{0,16}(?:的命|性命)/u,
  /(?:论到.{0,20})?我断不.{2,36}/u,
  /你当.{2,32}[；，].{0,16}不可.{2,32}/u,
  /我必照.{0,24}所说的.{0,16}(?:去行|行|办理)/u,
  /凡动.{0,16}的.{0,8}必/u,
] as const;

const PLAIN_MODERN_DIALOGUE_PATTERNS = [
  /我(?:名叫|的名字叫)/u,
  /^我是[\p{Script=Han}A-Za-z·]{2,12}$/u,
  /弄死|杀了你|宰了你|干掉你/u,
  /你算(?:个)?什么|什么东西/u,
  /^把/u,
  /里边请|请坐|坐坐坐/u,
  /太客气|小意思|何必推辞|自家兄弟/u,
  /有话直说|把话直说/u,
  /跟你没完/u,
  /善罢甘休/u,
  /我心里踏实/u,
  /怎么走出/u,
  /还叫(?:什么|甚么)/u,
  /不用我自己说/u,
  /不必我自己说/u,
  /有头有脸|给脸不要脸|开裆裤|摆什么架子|撒泡尿|什么德行/u,
  /你给我听着|答应也得答应|不答应也得答应/u,
  /长到这么大|还没有人敢/u,
  /出来混|只管开口|只管直说/u,
] as const;

export function scriptureCandidatePenalty(source: string, output: string) {
  const copied = findVerbatimSourceDialogueFragments(source, output).length;
  const unanchored = findUnanchoredUnionDialogues(output).length;
  const lowRetention = findLowRetentionUnionDialogues(output).length;
  const missingAnchors = missingMandatoryCuvAnchors(source, output).length;
  const unrecast = findUnrecastCuvLexiconItems(source, output).length;
  const repeated = findRepeatedActionRestatements(source, output).length;
  const contradictory = findContradictoryDialogueAnchors(output).length;
  const unsupported = findUnsupportedNarrativeDetails(source, output).length;
  const classical = findGenericClassicalCliches(output).length;
  const styleDeficit = Math.max(
    0,
    requiredUnionStyleScore(source) - unionStyleScore(output),
  );
  const sectionDeficit = Math.max(
    0,
    requiredUnionStyleSectionCoverage(source) -
      unionStyleSectionCoverage(output),
  );
  return (
    copied * 3000 +
    contradictory * 3000 +
    unanchored * 2500 +
    lowRetention * 2400 +
    missingAnchors * 1800 +
    repeated * 800 +
    unrecast * 700 +
    unsupported * 500 +
    styleDeficit * 700 +
    sectionDeficit * 700 +
    classical * 400
  );
}

const ALL_DIRECT_SPEECH_ANCHOR_PATTERNS = [
  ...DIRECT_SPEECH_ANCHOR_PATTERNS,
  ...CUV_FAMOUS_ANCHORS.flatMap((anchor) =>
    anchor.outputPattern ? [anchor.outputPattern] : [],
  ),
] as const;

export function findUnanchoredUnionDialogues(value: string) {
  const findings: string[] = [];
  for (const match of value.matchAll(DIRECT_SPEECH_PATTERN)) {
    const dialogue = match[1].trim();
    const hasAnchor = ALL_DIRECT_SPEECH_ANCHOR_PATTERNS.some((pattern) =>
      pattern.test(dialogue),
    );
    const plainClauses = dialogue
      .split(/[，,；;。！？!?]/u)
      .map((clause) => clause.trim())
      .filter(
        (clause) =>
          clause &&
          PLAIN_MODERN_DIALOGUE_PATTERNS.some((pattern) => pattern.test(clause)),
      );
    if (hasAnchor && !plainClauses.length) continue;

    const candidates = plainClauses.length ? plainClauses : [dialogue];
    for (const candidate of candidates) {
      const preview =
        candidate.length > 36 ? `${candidate.slice(0, 36)}……` : candidate;
      if (!findings.includes(preview)) findings.push(preview);
    }
  }
  return findings;
}

export function findLowRetentionUnionDialogues(value: string) {
  const findings: string[] = [];
  for (const match of value.matchAll(DIRECT_SPEECH_PATTERN)) {
    const dialogue = match[1].trim();
    const hasHighRetentionFrame = HIGH_RETENTION_DIALOGUE_PATTERNS.some(
      (pattern) => pattern.test(dialogue),
    );
    const plainClauses = dialogue
      .split(/[，,；;。！？!?]/u)
      .map((clause) => clause.trim())
      .filter(
        (clause) =>
          clause &&
          PLAIN_MODERN_DIALOGUE_PATTERNS.some((pattern) => pattern.test(clause)),
      );
    if (hasHighRetentionFrame && !plainClauses.length) continue;

    const candidates = hasHighRetentionFrame ? plainClauses : [dialogue];
    for (const candidate of candidates) {
      const preview =
        candidate.length > 36 ? `${candidate.slice(0, 36)}……` : candidate;
      if (!findings.includes(preview)) findings.push(preview);
    }
  }
  return findings;
}

const REPEATED_ACTION_SPECS = [
  {
    label: "取出、放下或摆放物品",
    pattern: /取出|拿出|掏出|放下|摆在|摆到|陈在|搁在|置于/u,
  },
  {
    label: "取出或摆放礼物",
    pattern: /(?:礼物|礼品|包裹|所带来的|带来的东西).{0,20}(?:取出|拿出|放下|摆在|陈在)|(?:取出|拿出|放下|摆在|陈在).{0,20}(?:礼物|礼品|包裹)/u,
  },
  {
    label: "坐席或落座",
    pattern: /坐下|落座|坐席|席上坐定/u,
  },
  {
    label: "起身或站立",
    pattern: /站起来|站起身|起身|从席上起来/u,
  },
  {
    label: "离开现场",
    pattern: /离开|走出|出去|起身离席|往所要去的地方去/u,
  },
  {
    label: "取出刀械",
    pattern: /拿刀|拔刀|取出.{0,8}刀|从怀中.{0,8}刀/u,
  },
  {
    label: "攻击或刺伤",
    pattern: /刺伤|刺入|捅进|砍伤|击打|攻击/u,
  },
  {
    label: "制住或拦阻",
    pattern: /制住|按住|拦阻|使.{0,8}不能上前/u,
  },
  {
    label: "举杯或饮酒",
    pattern: /举杯|拿起杯|喝了|饮酒|喝酒/u,
  },
  {
    label: "自报或介绍姓名",
    pattern: /报上姓名|名叫|人称我为|所称呼我的名/u,
  },
  {
    label: "推辞或不肯收受",
    pattern: /太客气|(?<!不可)(?<!何必)(?<!不要)(?<!莫要)推辞|辞谢不受|不肯收|不肯受/u,
  },
] as const;

function countActionClauses(value: string, pattern: RegExp) {
  return value
    .split(/[；;。！？!?\n]/u)
    .map((clause) => clause.trim())
    .filter((clause) => clause && pattern.test(clause)).length;
}

export function findRepeatedActionRestatements(source: string, output: string) {
  const findings: string[] = [];
  for (const spec of REPEATED_ACTION_SPECS) {
    const sourceCount = countActionClauses(source, spec.pattern);
    const outputCount = countActionClauses(output, spec.pattern);
    if (outputCount > Math.max(1, sourceCount)) {
      findings.push(
        `“${spec.label}”在原文约 ${sourceCount} 个动作节点，输出却复述为 ${outputCount} 个节点`,
      );
    }
  }
  return findings;
}

export function findContradictoryDialogueAnchors(value: string) {
  const findings: string[] = [];
  for (const match of value.matchAll(DIRECT_SPEECH_PATTERN)) {
    const dialogue = match[1].trim();
    const condemnsPride =
      /凡.{0,20}(?:自高|气盛).{0,12}必.{0,16}(?:卑|低|败|收敛)|不可.{0,12}气盛/u.test(
        dialogue,
      );
    const defendsPride =
      /我若不气盛|不气盛.{0,12}(?:年轻|后生)|气盛.{0,12}(?:年轻人的|年轻人)/u.test(
        dialogue,
      );
    if (condemnsPride && defendsPride) {
      findings.push("同一说话人既责备气盛，又以气盛为自己辩护");
    }
    if (/我断不.{1,32}我必照.{0,24}所说的/u.test(dialogue)) {
      findings.push("同一说话人在一段话中同时坚决拒绝并承诺照办");
    }
    if (
      /(?:不可|不得|不要).{1,18}([\p{Script=Han}]{2,8}).{0,24}(?:我必|我偏要|我就要).{0,8}\1/u.test(
        dialogue,
      )
    ) {
      findings.push("同一说话人在一段话中既禁止某事又宣称自己必要行这事");
    }
  }
  return findings;
}

const UNION_STYLE_PATTERNS = [
  /有一个人/u,
  /那时/u,
  /这事以后/u,
  /及至/u,
  /于是/u,
  /听见这话/u,
  /开口/u,
  /复问/u,
  /我实在告诉/u,
  /凡.{0,16}的/u,
  /若.{0,24}(?:就|便|必)/u,
  /岂/u,
  /何况/u,
  /好叫/u,
  /免得/u,
  /以致/u,
  /故此/u,
  /在.{0,16}眼前/u,
  /从.{0,16}手中/u,
  /所.{1,16}的/u,
  /看哪/u,
  /论到/u,
];

function normalizeForOverlap(value: string) {
  return value.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
}

function hasTightSubsequence(needle: string, haystack: string) {
  if (needle.length < 4 || needle.length > 20) return false;
  for (let start = 0; start < haystack.length; start += 1) {
    if (haystack[start] !== needle[0]) continue;
    let needleIndex = 1;
    let cursor = start + 1;
    while (cursor < haystack.length && needleIndex < needle.length) {
      if (haystack[cursor] === needle[needleIndex]) needleIndex += 1;
      cursor += 1;
    }
    if (
      needleIndex === needle.length &&
      cursor - start <= needle.length + 4
    ) {
      return true;
    }
  }
  return false;
}

export function findVerbatimSourceDialogueFragments(
  source: string,
  output: string,
) {
  const normalizedOutput = normalizeForOverlap(output);
  const fragments: string[] = [];
  for (const match of source.matchAll(DIRECT_SPEECH_PATTERN)) {
    const dialogue = normalizeForOverlap(match[1]);
    if (dialogue.length < 4) continue;
    let found = "";
    for (
      let length = Math.min(dialogue.length, 20);
      length >= 4 && !found;
      length -= 1
    ) {
      for (let index = 0; index <= dialogue.length - length; index += 1) {
        const fragment = dialogue.slice(index, index + length);
        if (normalizedOutput.includes(fragment)) {
          found = fragment;
          break;
        }
      }
    }
    if (!found && hasTightSubsequence(dialogue, normalizedOutput)) {
      found = dialogue;
    }
    if (found && !fragments.includes(found)) fragments.push(found);
    if (fragments.length >= 6) break;
  }
  return fragments;
}

export function hasVerbatimSourceDialogue(source: string, output: string) {
  return findVerbatimSourceDialogueFragments(source, output).length > 0;
}

export function unionStyleScore(value: string) {
  return UNION_STYLE_PATTERNS.reduce(
    (score, pattern) => score + Number(pattern.test(value)),
    0,
  );
}

export function requiredUnionStyleScore(source: string) {
  if (source.length < 40) return 2;
  if (source.length < 120) return 4;
  return 6;
}

export function unionStyleSectionCoverage(value: string, sections = 3) {
  const normalized = value.trim();
  if (!normalized) return 0;
  const sectionLength = Math.ceil(normalized.length / sections);
  let covered = 0;
  for (let index = 0; index < sections; index += 1) {
    const section = normalized.slice(
      index * sectionLength,
      (index + 1) * sectionLength,
    );
    if (UNION_STYLE_PATTERNS.some((pattern) => pattern.test(section))) covered += 1;
  }
  return covered;
}

export function requiredUnionStyleSectionCoverage(source: string) {
  if (source.length < 220) return 1;
  if (source.length < 500) return 2;
  return 3;
}

export type UnionStyleAssessment = {
  acceptable: boolean;
  score: number;
  requiredScore: number;
  sectionCoverage: number;
  requiredSectionCoverage: number;
  issues: string[];
};

/**
 * Fact preservation and scripture cadence are separate product requirements.
 * A draft that keeps every name but merely adds “那时、于是” once must not be
 * accepted as a finished Union Version imitation.
 */
export function assessUnionStyleResult(
  source: string,
  output: string,
): UnionStyleAssessment {
  const score = unionStyleScore(output);
  const requiredScore = requiredUnionStyleScore(source);
  const sectionCoverage = unionStyleSectionCoverage(output);
  const requiredSectionCoverage = requiredUnionStyleSectionCoverage(source);
  const issues: string[] = [];

  if (score < requiredScore) {
    issues.push(`和合本句法不足：当前 ${score}，至少需要 ${requiredScore}`);
  }
  if (sectionCoverage < requiredSectionCoverage) {
    issues.push(
      `和合本风格分布不足：当前覆盖 ${sectionCoverage} 段，至少需要 ${requiredSectionCoverage} 段`,
    );
  }
  const classical = findGenericClassicalCliches(output);
  if (classical.length) {
    issues.push(`仍有普通文言或章回套语：${classical.slice(0, 3).join("、")}`);
  }
  const unrecast = findUnrecastCuvLexiconItems(source, output);
  if (unrecast.length) {
    issues.push(`现代叙述元素尚未圣经化：${unrecast.slice(0, 4).join("、")}`);
  }

  return {
    acceptable: issues.length === 0,
    score,
    requiredScore,
    sectionCoverage,
    requiredSectionCoverage,
    issues,
  };
}

const GENERIC_CLASSICAL_CLICHES = [
  /说时迟[，,]?那时快/u,
  /名不虚传/u,
  /不动声色/u,
  /拍案而起/u,
  /连忙喝道/u,
  /这才住口/u,
  /这才止住/u,
  /当下/u,
  /只见/u,
  /刹那间|电光火石/u,
  /纵身(?:一跃|而起)?/u,
  /拱手(?:道谢|说道|施礼)?/u,
  /腾地(?:站起|起身)/u,
  /抢上前/u,
  /自我出道以来|行走江湖/u,
  /在下|阁下|好汉|休想|休得|来者何人/u,
  /恼羞成怒|善罢甘休/u,
] as const;

export function findGenericClassicalCliches(value: string) {
  return GENERIC_CLASSICAL_CLICHES.filter((pattern) => pattern.test(value)).map(
    (pattern) => pattern.source,
  );
}

export function normalizeUnionNarration(value: string) {
  return value
    .replace(
      /我(?:(今日|今天))?(?:要|会|就要)?弄死([\p{Script=Han}A-Za-z0-9·_-]{1,12})(?=[，,。.!！?？；;”"’'])/gu,
      (_match, day: string | undefined, target: string) =>
        `${day ? "我今日" : "我"}必夺取${target}的命`,
    )
    .replace(
      /我(?:(今日|今天))?(?:要|会|就要)?杀了([\p{Script=Han}A-Za-z0-9·_-]{1,12})(?=[，,。.!！?？；;”"’'])/gu,
      (_match, day: string | undefined, target: string) =>
        `${day ? "我今日" : "我"}必夺取${target}的命`,
    )
    .replace(
      /我名叫([\p{Script=Han}A-Za-z0-9·_-]{2,24})\s*(?=[，,。.!！?？；;”"’'])/gu,
      "论到我的名，人所称呼我的名乃是$1",
    )
    .replace(
      /我的名字叫([\p{Script=Han}A-Za-z0-9·_-]{2,24})\s*(?=[，,。.!！?？；;”"’'])/gu,
      "论到我的名，人所称呼我的名乃是$1",
    )
    .replace(/说时迟[，,]?那时快/gu, "正在那时")
    .replace(/名不虚传/gu, "所传于众人的话并非虚言")
    .replace(/不动声色/gu, "脸色并未改变")
    .replace(/拍案而起/gu, "拍着桌子站起身来")
    .replace(/话音未落/gu, "这话还没有说完")
    .replace(/说罢/gu, "说完这话")
    .replace(/这才止住/gu, "便不再说话")
    .replace(/当下[，,]?/gu, "那时，")
    .replace(/说道([：:])/gu, "说$1")
    .replace(/便道([：:])/gu, "便回答说$1")
    .replace(/又道([：:])/gu, "又对他说$1")
    .replace(/答道([：:])/gu, "回答说$1")
    .replace(/问道([：:])/gu, "问他说$1")
    .replace(/喝道([：:])/gu, "喝令说$1")
    .replace(/只见/gu, "看哪")
    .replace(/刹那间/gu, "就在那时")
    .replace(/腾地(?:站起|起身)(?:来)?/gu, "忽然站起身来")
    .replace(/抢上前/gu, "就迎上前去")
    .replace(/自我出道以来/gu, "从我行在这条路上直到今日")
    .replace(/就休想/gu, "就不得")
    .replace(/休想/gu, "就不得")
    .replace(/就就不得/gu, "就不得")
    .replace(/休得/gu, "不可");
}

const UNSUPPORTED_DETAIL_RULES: Array<{
  output: RegExp;
  sourceSupport: RegExp;
  label: string;
}> = [
  {
    output: /尚未答话|还没有答话|未曾回答/u,
    sourceSupport: /尚未答|还没.*(?:说|答)|未曾回答|没有回答/u,
    label: "擅自补写人物尚未回答",
  },
  {
    output: /心里|心中|内心/u,
    sourceSupport: /心里|心中|内心|心想|觉得|认为|不服/u,
    label: "擅自补写人物内心",
  },
  {
    output: /怒气|发怒|恼怒|愤怒/u,
    sourceSupport: /怒|生气|恼|愤/u,
    label: "擅自补写人物愤怒",
  },
  {
    output: /如同|好像|仿佛/u,
    sourceSupport: /如同|好像|仿佛|像是|像在/u,
    label: "擅自增加比喻",
  },
  {
    output: /宣战/u,
    sourceSupport: /宣战/u,
    label: "擅自升级为宣战",
  },
  {
    output: /无人敢|众人惧怕|众人议论|众人观看/u,
    sourceSupport: /无人敢|众人|大家|围观|议论|观看|害怕|惧怕/u,
    label: "擅自补写旁观者反应",
  },
  {
    output: /不肯退让|互不相让|谁也不肯/u,
    sourceSupport: /不肯退让|互不相让|谁也不肯|僵持|不让/u,
    label: "擅自补写人物不肯退让",
  },
  {
    output: /凡事都有定期|天下万务都有定时/u,
    sourceSupport: /凡事都有定期|天下万务都有定时/u,
    label: "照搬了没有换入原文事项的著名经文句子",
  },
  {
    output:
      /免得[^。；\n]{0,64}(?:不能|不得|缺欠|失败|错过|耽误|落空)|以致[^。；\n]{0,48}(?:不能|不得|失败|错过|耽误|落空)/u,
    sourceSupport:
      /否则|免得|以免|不然|导致|造成|不能|不得|失败|错过|耽误|落空|有所缺欠/u,
    label: "擅自补写原文没有的负面后果",
  },
];

export function findUnsupportedNarrativeDetails(source: string, output: string) {
  const findings = UNSUPPORTED_DETAIL_RULES.filter(
    (rule) => rule.output.test(output) && !rule.sourceSupport.test(source),
  ).map((rule) => rule.label);

  const isProspectiveSource =
    /通知|计划|安排|将于|届时|截止|请.{0,24}(?:参加|准备|提交|告知)|如果.{0,30}(?:前|后)|若.{0,30}(?:前|后)|否则/u.test(
      source,
    ) && !/已经|已完成|完成了|办妥|结束了|落实了|成功/u.test(source);
  const claimsUnsupportedCompletion =
    /事就这样成了|众人听见这话.{0,12}就各按|就照着.{0,24}去行|已经.{0,16}(?:完成|办妥)|(?:演示|说明|记录).{0,24}一一(?:作了|记下|完成)/u.test(
      output,
    );

  if (isProspectiveSource && claimsUnsupportedCompletion) {
    findings.push("把尚未执行的通知或计划写成已经完成");
  }

  return findings;
}
