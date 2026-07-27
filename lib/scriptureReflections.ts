export const REFLECTION_MODES = [
  "commend",
  "admonish",
  "warn",
  "lament",
  "neutral",
] as const;

export const REFLECTION_RELATIONS = [
  "parallel",
  "value_comparison",
  "effort_harvest",
  "cause_result",
  "character_fruit",
  "self_exaltation",
  "care_for_others",
  "small_faithfulness",
  "anger_warning",
  "time_and_season",
  "speech_truth",
  "loss_and_gain",
  "inherited_responsibility",
  "neutral_record",
] as const;

export const REFLECTION_POLARITIES = ["positive", "negative", "mixed", "neutral"] as const;

export type ReflectionMode = (typeof REFLECTION_MODES)[number];
export type ReflectionRelation = (typeof REFLECTION_RELATIONS)[number];
export type ReflectionPolarity = (typeof REFLECTION_POLARITIES)[number];

export type ScriptureReflection = {
  enabled: boolean;
  mode: ReflectionMode;
  actor: string;
  behavior: string;
  outcome: string;
  relation: ReflectionRelation;
  polarity: ReflectionPolarity;
  evidence: string[];
};

type ReflectionSkeleton = {
  id: string;
  sourceShape: string;
  relations: readonly ReflectionRelation[];
  modes: readonly ReflectionMode[];
  polarities: readonly ReflectionPolarity[];
  famousness: number;
  keywords?: RegExp;
  render: (reflection: ScriptureReflection) => string;
};

function trimPhrase(value: string, fallback: string) {
  return value
    .trim()
    .replace(/^[，；：、\s]+|[，；：、\s]+$/gu, "")
    .replace(/[。！？!?；;]+$/gu, "") || fallback;
}

function actorOf(reflection: ScriptureReflection) {
  return trimPhrase(reflection.actor, "这人");
}

function behaviorOf(reflection: ScriptureReflection) {
  return trimPhrase(reflection.behavior, "如此行");
}

function outcomeOf(reflection: ScriptureReflection) {
  return trimPhrase(reflection.outcome, "事情的结局显明");
}

function actionClause(value: string) {
  return value
    .replace(/^(?:因|因为|由于)/u, "")
    .replace(/^(?:选择|决定|愿意|仍旧|依然)/u, "")
    .replace(/^把/u, "将");
}

function outcomeClause(value: string) {
  return value
    .replace(/^(?:因此|所以|后来|最终|终于|结果|便|就)/u, "")
    .replace(/^得到/u, "得了")
    .replace(/^获得/u, "得了");
}

function perseveranceClause(reflection: ScriptureReflection) {
  const actor = actorOf(reflection);
  const behavior = behaviorOf(reflection);
  const contrast = behavior.match(/^虽然([^，,；;]{1,30})[，,]?(?:却|仍然|仍旧|仍)(.+)$/u);
  if (contrast) return `${actor}虽然${contrast[1]}，却${contrast[2]}`;
  return `${actor}虽因${actionClause(behavior)}劳苦，却不丧志`;
}

const STORY_REFLECTION_SKELETONS: readonly ReflectionSkeleton[] = [
  {
    id: "value-good-name",
    sourceShape: "美名胜过大财；恩宠强如金银。",
    relations: ["value_comparison"],
    modes: ["commend"],
    polarities: ["positive"],
    famousness: 100,
    keywords: /诚实|归还|拒收|守信|名声|名誉|清白|财物|钱包/u,
    render: (reflection) =>
      `${actorOf(reflection)}因${actionClause(behaviorOf(reflection))}所得的美名，胜过大财；所得的恩宠，强如金银。`,
  },
  {
    id: "faithful-small",
    sourceShape: "人在最小的事上忠心，在大事上也忠心。",
    relations: ["small_faithfulness"],
    modes: ["commend", "admonish"],
    polarities: ["positive"],
    famousness: 98,
    keywords: /小事|细节|忠心|守信|责任|托付|归还|按时/u,
    render: (reflection) =>
      `${actorOf(reflection)}在${actionClause(behaviorOf(reflection))}这小事上忠心，在大事上也必忠心。`,
  },
  {
    id: "care-others",
    sourceShape: "各人不要单顾自己的事，也要顾别人的事。",
    relations: ["care_for_others"],
    modes: ["commend", "admonish"],
    polarities: ["positive"],
    famousness: 100,
    keywords: /帮助|照顾|扶起|扶持|邻居|邻里|顾念|送药|搬/u,
    render: (reflection) =>
      `各人不要单顾自己的事，也要顾别人的事；${actorOf(reflection)}既${actionClause(behaviorOf(reflection))}，这话便显明在他身上。`,
  },
  {
    id: "give-more-blessed",
    sourceShape: "施比受更为有福。",
    relations: ["care_for_others", "loss_and_gain", "value_comparison"],
    modes: ["commend", "admonish"],
    polarities: ["positive"],
    famousness: 100,
    keywords: /赠送|施舍|给予|付出|分享|无偿|白白/u,
    render: (reflection) =>
      `${actorOf(reflection)}既${actionClause(behaviorOf(reflection))}，就显明施比受更为有福。`,
  },
  {
    id: "sow-reap",
    sourceShape: "人种的是什么，收的也是什么。",
    relations: ["cause_result"],
    modes: ["commend", "warn", "lament"],
    polarities: ["positive", "negative", "mixed"],
    famousness: 100,
    render: (reflection) =>
      `人种的是什么，收的也是什么；${actorOf(reflection)}既${actionClause(behaviorOf(reflection))}，后来便${outcomeClause(outcomeOf(reflection))}。`,
  },
  {
    id: "labor-harvest",
    sourceShape: "流泪撒种的，必欢呼收割。",
    relations: ["effort_harvest"],
    modes: ["commend", "admonish"],
    polarities: ["positive", "mixed"],
    famousness: 100,
    keywords: /劳苦|疲惫|坚持|忍耐|返工|修改|核算|完成|交付/u,
    render: (reflection) =>
      `${perseveranceClause(reflection)}；流泪撒种的，及至${outcomeClause(outcomeOf(reflection))}，必欢呼收割。`,
  },
  {
    id: "do-not-lose-heart",
    sourceShape: "我们行善，不可丧志；若不灰心，到了时候就要收成。",
    relations: ["effort_harvest"],
    modes: ["commend", "admonish"],
    polarities: ["positive", "mixed"],
    famousness: 99,
    keywords: /不灰心|不放弃|坚持|忍耐|多次|反复|终于/u,
    render: (reflection) =>
      `${perseveranceClause(reflection)}；若不灰心，到了时候就${outcomeClause(outcomeOf(reflection))}。`,
  },
  {
    id: "fruit-recognition",
    sourceShape: "所以，凭着他们的果子，就可以认出他们来。",
    relations: ["character_fruit"],
    modes: ["commend", "warn"],
    polarities: ["positive", "negative", "mixed"],
    famousness: 100,
    render: (reflection) =>
      `凭着${actorOf(reflection)}所结的果子，就可以认出他来；他所行的${actionClause(behaviorOf(reflection))}，已经显明在众人面前。`,
  },
  {
    id: "exalt-humble",
    sourceShape: "因为凡自高的，必降为卑；自卑的，必升为高。",
    relations: ["self_exaltation"],
    modes: ["warn", "lament"],
    polarities: ["negative", "mixed"],
    famousness: 100,
    keywords: /自高|骄傲|狂妄|轻看|摆架子|高看自己/u,
    render: (reflection) =>
      `凡自高的，必降为卑；${actorOf(reflection)}因${actionClause(behaviorOf(reflection))}，后来便${outcomeClause(outcomeOf(reflection))}。`,
  },
  {
    id: "anger-righteousness",
    sourceShape: "因为人的怒气，并不成就神的义。",
    relations: ["anger_warning"],
    modes: ["warn", "lament"],
    polarities: ["negative", "mixed"],
    famousness: 99,
    keywords: /发怒|怒气|争吵|威胁|动手|伤害|报复|冲突/u,
    render: (reflection) =>
      `人的怒气，并不成就神的义；${actorOf(reflection)}因${actionClause(behaviorOf(reflection))}，后来便${outcomeClause(outcomeOf(reflection))}。`,
  },
  {
    id: "slow-to-anger",
    sourceShape: "不轻易发怒的，胜过勇士；治服己心的，强如取城。",
    relations: ["anger_warning", "value_comparison"],
    modes: ["commend", "admonish"],
    polarities: ["positive"],
    famousness: 98,
    keywords: /忍住|克制|止息|不发怒|冷静|节制/u,
    render: (reflection) =>
      `${actorOf(reflection)}既在${actionClause(behaviorOf(reflection))}上治服己心，便胜过勇士，强如取城。`,
  },
  {
    id: "season-time",
    sourceShape: "凡事都有定期，天下万务都有定时。",
    relations: ["time_and_season"],
    modes: ["commend", "admonish", "neutral"],
    polarities: ["positive", "mixed", "neutral"],
    famousness: 100,
    render: (reflection) =>
      `凡事都有定期，天下万务都有定时；${actionClause(behaviorOf(reflection))}有时，${outcomeClause(outcomeOf(reflection))}也有时。`,
  },
  {
    id: "yes-and-no",
    sourceShape: "你们的话，是，就说是；不是，就说不是。",
    relations: ["speech_truth"],
    modes: ["commend", "admonish", "warn"],
    polarities: ["positive", "negative", "mixed"],
    famousness: 100,
    render: (reflection) =>
      `论到${actorOf(reflection)}所说的话，是，就说是；不是，就说不是；他既${actionClause(behaviorOf(reflection))}，事情便${outcomeClause(outcomeOf(reflection))}。`,
  },
  {
    id: "lose-and-gain",
    sourceShape: "凡要救自己生命的，必丧掉生命；凡为我丧掉生命的，必得着生命。",
    relations: ["loss_and_gain"],
    modes: ["commend", "admonish", "warn"],
    polarities: ["positive", "negative", "mixed"],
    famousness: 99,
    render: (reflection) =>
      `一味要保全自己的，反要失去；${actorOf(reflection)}既肯${actionClause(behaviorOf(reflection))}，后来便${outcomeClause(outcomeOf(reflection))}。`,
  },
  {
    id: "parallel-as",
    sourceShape: "愿你的国降临；愿你的旨意行在地上，如同行在天上。",
    relations: ["parallel"],
    modes: ["commend", "admonish"],
    polarities: ["positive", "neutral"],
    famousness: 100,
    render: (reflection) =>
      `愿${actorOf(reflection)}所行的${actionClause(behaviorOf(reflection))}坚立在众人面前，如同${outcomeClause(outcomeOf(reflection))}已经坚立。`,
  },
  {
    id: "child-not-bear-parent-guilt",
    sourceShape: "儿子必不担当父亲的罪孽，父亲也不担当儿子的罪孽。",
    relations: ["inherited_responsibility"],
    modes: ["commend", "admonish", "neutral"],
    polarities: ["positive", "mixed", "neutral"],
    famousness: 100,
    keywords: /家族|祖先|父辈|母辈|后代|孩子|儿子|女儿|血脉|罪孽|担当/u,
    render: () => "儿子必不担当父亲的罪孽，父亲也不担当儿子的罪孽。",
  },
  {
    id: "neutral-record",
    sourceShape: "凡事都有定期，天下万务都有定时。",
    relations: ["neutral_record"],
    modes: ["neutral"],
    polarities: ["neutral", "mixed"],
    famousness: 90,
    render: (reflection) =>
      `${actorOf(reflection)}既${actionClause(behaviorOf(reflection))}，后来便${outcomeClause(outcomeOf(reflection))}；这事的结局，就是这样。`,
  },
] as const;

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectStoryReflectionSkeleton(reflection: ScriptureReflection) {
  const source = `${reflection.actor}，${reflection.behavior}，${reflection.outcome}`;
  const candidates = STORY_REFLECTION_SKELETONS
    .filter((item) => item.relations.includes(reflection.relation))
    .filter((item) => item.modes.includes(reflection.mode))
    .filter((item) => item.polarities.includes(reflection.polarity))
    .map((item) => ({
      item,
      score: item.famousness + (item.keywords?.test(source) ? 35 : 0),
    }))
    .sort((left, right) => right.score - left.score);

  if (!candidates.length) {
    return STORY_REFLECTION_SKELETONS.find((item) => item.id === "neutral-record")!;
  }
  const bestScore = candidates[0].score;
  const best = candidates.filter((entry) => entry.score === bestScore);
  return best[stableHash(source) % best.length].item;
}

export function renderStoryReflection(reflection: ScriptureReflection) {
  if (!reflection.enabled) return "";
  const skeleton = selectStoryReflectionSkeleton(reflection);
  return skeleton.id === "neutral-record"
    ? renderNeutralStoryClosure()
    : skeleton.sourceShape;
}

export function renderNeutralStoryClosure() {
  return "这事的结局，就是这样。";
}
