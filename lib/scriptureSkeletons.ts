import {
  classifyBehaviorPolarity,
  classifyOutcomePolarity,
  renderCuvAphorism,
  renderRecognizableSourceAphorism,
} from "@/lib/cuvAphorismSkeletons";
import { buildCuvStoryTemplatePrompt } from "@/lib/cuvStoryTemplates";
import {
  REFLECTION_MODES,
  REFLECTION_POLARITIES,
  REFLECTION_RELATIONS,
  renderNeutralStoryClosure,
  renderStoryReflection,
  type ReflectionMode,
  type ReflectionPolarity,
  type ReflectionRelation,
  type ScriptureReflection,
} from "@/lib/scriptureReflections";
import {
  classifyScriptureSource,
  isAphorismSource,
  isStrongDefinitionSource,
} from "@/lib/scriptureGenre";

export const SPEECH_INTENT_IDS = [
  "welcome",
  "waited_arrival",
  "guide_inside",
  "invite_seat",
  "introduction",
  "courtesy_gift",
  "courtesy_refusal",
  "self_identification",
  "reputation",
  "offer_help",
  "reassurance",
  "approval",
  "infer_motive",
  "request_directness",
  "conditional_commitment",
  "mediation_request",
  "mutual_claim",
  "self_defense",
  "status_observation",
  "insult_challenge",
  "rebuke",
  "paired_dominance",
  "face_boundary",
  "relay_request",
  "warning_pride",
  "youth_defiance",
  "exit_threat",
  "method_challenge",
  "coercion",
  "boast",
  "death_threat",
  "request",
  "refusal",
  "command",
  "promise",
  "blessing",
  "question",
  "contrast",
  "general_rule",
  "definition",
  "factual_statement",
  "enumeration",
  "guarantee",
  "trade_price",
  "curse_penalty",
  "agreement",
  "disagreement",
] as const;

export const NARRATION_FRAME_IDS = [
  "arrival",
  "setting",
  "action",
  "reaction",
  "indirect_speech",
  "introduction",
  "transition",
  "outcome",
] as const;

type SpeechIntentId = (typeof SPEECH_INTENT_IDS)[number];
type NarrationFrameId = (typeof NARRATION_FRAME_IDS)[number];
type SkeletonSlots = Record<string, string>;
type SpeechDelivery = "said" | "answered" | "asked" | "warned" | "commanded" | "cried";

export type ScriptureSkeletonUnit =
  | {
      kind: "narration";
      frame: NarrationFrameId;
      actor?: string;
      target?: string;
      action?: string;
      object?: string;
      place?: string;
      time?: string;
      matter?: string;
      result?: string;
    }
  | {
      kind: "speech";
      intent: SpeechIntentId;
      speaker: string;
      addressee?: string;
      delivery?: SpeechDelivery;
      elements: SkeletonSlots;
    }
  | {
      kind: "declaration";
      intent: SpeechIntentId;
      elements: SkeletonSlots;
    };

export type ScriptureSkeletonPlan = {
  textType: string;
  units: ScriptureSkeletonUnit[];
  reflection?: ScriptureReflection;
};

const SPEECH_INTENT_SET = new Set<string>(SPEECH_INTENT_IDS);
const NARRATION_ID_SET = new Set<string>(NARRATION_FRAME_IDS);
const REFLECTION_MODE_SET = new Set<string>(REFLECTION_MODES);
const REFLECTION_RELATION_SET = new Set<string>(REFLECTION_RELATIONS);
const REFLECTION_POLARITY_SET = new Set<string>(REFLECTION_POLARITIES);

function cleanSlot(value: unknown, maxLength = 120) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[“”"‘’']/gu, "")
    .replace(/[。！？!?；;]+$/gu, "")
    .replace(/[\r\n]+/gu, "，")
    .replace(/给脸不要脸/gu, "轻看所受的情面")
    .replace(/你算什么东西|算什么东西/gu, "究竟是什么人")
    .replace(/太客气|过于客气/gu, "所行的礼数过重")
    .replace(/小意思/gu, "微薄之物")
    .replace(/有头有脸/gu, "有名望")
    .replace(/开裆裤/gu, "年幼无知")
    .replace(/撒泡尿照照(?:自己)?/gu, "察看自己")
    .replace(/善罢甘休/gu, "止息追讨")
    .replace(/痛快[、，,]?喜欢这(?:种)?脾气|喜欢这(?:种)?痛快脾气/gu, "你口中这痛快的话")
    .replace(/不可不要|不可不再|不要再不要/gu, "不可再")
    .replace(/再{2,}/gu, "再")
    .replace(/全无气盛/gu, "不气盛")
    .replace(/我弄死你|弄死你/gu, "夺取你的命")
    .replace(/请坐|坐坐坐/gu, "坐席")
    .replace(/挑明了说|有话直说|只管直说/gu, "将这事陈明")
    .replace(/放在桌上|摆在桌上/gu, "摆在席前")
    .replace(/桌上|桌子上/gu, "席前")
    .replace(/饭店雅间|饭店包间|雅间|包间/gu, "摆设筵席的屋里")
    .replace(/那饭店|饭店/gu, "那摆设筵席的地方")
    .replace(/那摆设筵席的地方/gu, "那摆设筵席的屋里")
    .replace(/服务员/gu, "伺候筵席的人")
    .replace(/地板上|地板/gu, "地上")
    .replace(/示意/gu, "转眼看")
    .trim()
    .slice(0, maxLength);
}

function cleanElements(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, cleanSlot(item)] as const)
      .filter(([, item]) => item && !/^(?:哎|喂|啊|呀|唉)+$/u.test(item)),
  );
}

function completeJsonObjectsFromUnitsArray(raw: string) {
  const unitsMatch = /"units"\s*:\s*\[/u.exec(raw);
  if (!unitsMatch) return [];
  const arrayStart = unitsMatch.index + unitsMatch[0].length - 1;
  const objects: string[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart + 1; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) objectStart = index;
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        objects.push(raw.slice(objectStart, index + 1));
        objectStart = -1;
      }
      continue;
    }
    if (char === "]" && depth === 0) break;
  }
  return objects;
}

function recoverTruncatedSkeletonJson(raw: string) {
  const units = completeJsonObjectsFromUnitsArray(raw)
    .map((item) => {
      try {
        return JSON.parse(item) as unknown;
      } catch {
        return null;
      }
    })
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === "object" && !Array.isArray(item)),
    )
    .filter((item) => ["narration", "speech", "declaration"].includes(String(item.kind)));
  if (!units.length) return null;
  const textType = /"textType"\s*:\s*"((?:\\.|[^"\\]){0,80})"/u.exec(raw)?.[1];
  return {
    textType: textType || "记事",
    units,
    reflection: { enabled: false },
  };
}

export function parseScriptureSkeletonPlan(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    parsed = recoverTruncatedSkeletonJson(raw.slice(start));
    if (!parsed) return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const value = parsed as { textType?: unknown; units?: unknown; reflection?: unknown };
  if (!Array.isArray(value.units)) return null;
  const units: ScriptureSkeletonUnit[] = [];

  for (const rawUnit of value.units.slice(0, 100)) {
    if (!rawUnit || typeof rawUnit !== "object" || Array.isArray(rawUnit)) continue;
    const unit = rawUnit as Record<string, unknown>;
    if (unit.kind === "narration") {
      units.push({
        kind: "narration",
        frame: NARRATION_ID_SET.has(String(unit.frame))
          ? (String(unit.frame) as NarrationFrameId)
          : "action",
        actor: cleanSlot(unit.actor, 50),
        target: cleanSlot(unit.target, 50),
        action: cleanSlot(unit.action, 180),
        object: cleanSlot(unit.object, 100),
        place: cleanSlot(unit.place, 80),
        time: cleanSlot(unit.time, 80),
        matter: cleanSlot(unit.matter, 180),
        result: cleanSlot(unit.result, 180),
      });
      continue;
    }
    if (unit.kind === "speech") {
      const speaker = cleanSlot(unit.speaker, 50);
      if (!speaker) continue;
      const delivery: SpeechDelivery = ["said", "answered", "asked", "warned", "commanded", "cried"].includes(
        String(unit.delivery),
      )
        ? (String(unit.delivery) as SpeechDelivery)
        : "said";
      const fallbackIntent: SpeechIntentId =
        delivery === "asked"
          ? "question"
          : delivery === "commanded" || delivery === "warned"
            ? "command"
            : "contrast";
      const elements = cleanElements(unit.elements);
      const requestedIntent = SPEECH_INTENT_SET.has(String(unit.intent))
        ? (String(unit.intent) as SpeechIntentId)
        : fallbackIntent;
      const questionText = [elements.question, elements.action]
        .filter(Boolean)
        .join("，");
      const intent =
        requestedIntent === "question" && /(?:怎样|怎么|如何).{0,12}(?:走出|出去|离开)/u.test(questionText)
          ? "method_challenge"
          : requestedIntent;
      units.push({
        kind: "speech",
        intent,
        speaker,
        addressee: cleanSlot(unit.addressee, 50),
        delivery,
        elements,
      });
      continue;
    }
    if (unit.kind === "declaration") {
      units.push({
        kind: "declaration",
        intent: SPEECH_INTENT_SET.has(String(unit.intent))
          ? (String(unit.intent) as SpeechIntentId)
          : "general_rule",
        elements: cleanElements(unit.elements),
      });
    }
  }

  if (!units.length) return null;
  let reflection: ScriptureReflection | undefined;
  if (value.reflection && typeof value.reflection === "object" && !Array.isArray(value.reflection)) {
    const item = value.reflection as Record<string, unknown>;
    const evidence = Array.isArray(item.evidence)
      ? item.evidence.map((entry) => cleanSlot(entry, 160)).filter(Boolean).slice(0, 4)
      : [];
    reflection = {
      enabled: item.enabled !== false,
      mode: REFLECTION_MODE_SET.has(String(item.mode))
        ? (String(item.mode) as ReflectionMode)
        : "neutral",
      actor: cleanSlot(item.actor, 60),
      behavior: cleanSlot(item.behavior, 180),
      outcome: cleanSlot(item.outcome, 180),
      relation: REFLECTION_RELATION_SET.has(String(item.relation))
        ? (String(item.relation) as ReflectionRelation)
        : "neutral_record",
      polarity: REFLECTION_POLARITY_SET.has(String(item.polarity))
        ? (String(item.polarity) as ReflectionPolarity)
        : "neutral",
      evidence,
    };
  }
  return {
    textType: cleanSlot(value.textType, 60) || "记事",
    units,
    reflection,
  } satisfies ScriptureSkeletonPlan;
}

function element(elements: SkeletonSlots, key: string, fallback: string) {
  return cleanSlot(elements[key]) || fallback;
}

function targetName(elements: SkeletonSlots) {
  return element(elements, "target", "你")
    .replace(/^(?:我要|我必)?(?:弄死|杀死|夺取)/u, "")
    .replace(/的命$/u, "")
    .replace(/^(你|我|他|她|它)的$/u, "$1") || "你";
}

function collapseRepeatedText(value: string) {
  let result = value;
  for (let index = 0; index < 3; index += 1) {
    result = result
      .replace(/^(凡|若|你今日|我必|我当怎样|也当|也得|不可)\1+/gu, "$1")
      .replace(/([\p{Script=Han}]{2,10})\1+/gu, "$1")
      .replace(/呢呢$/gu, "呢")
      .replace(/也多也多$/gu, "也多");
  }
  return result.trim();
}

function strippedElement(
  elements: SkeletonSlots,
  key: string,
  fallback: string,
  patterns: RegExp[] = [],
) {
  let value = collapseRepeatedText(element(elements, key, fallback));
  for (const pattern of patterns) value = value.replace(pattern, "");
  return collapseRepeatedText(value).replace(/^[，；：、\s]+|[，；：、\s]+$/gu, "") || fallback;
}

function normalizePossession(value: string, speaker = "", addressee = "") {
  return value
    .replace(new RegExp(`^${addressee.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}的`, "u"), "你的")
    .replace(new RegExp(`^${speaker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}的`, "u"), "我的");
}

function renderSpeech(
  intent: SpeechIntentId,
  elements: SkeletonSlots,
  context: {
    speaker?: string;
    addressee?: string;
    occurrence?: number;
    aphorismMode?: boolean;
    storyAnchorMode?: boolean;
  } = {},
) {
  switch (intent) {
    case "welcome":
      return `请进，为什么站在外边呢？屋里已经预备了坐席。`;
    case "waited_arrival":
      return `我们等候你多时了，如今你果然来到。`;
    case "guide_inside":
      return `你们来，进到那屋，在所预备的地方坐席。`;
    case "invite_seat":
      return `你们来，在我们中间坐席；所预备的地方就在这里。`;
    case "introduction": {
      const rawCount = strippedElement(elements, "count", "几");
      const count = /(?:^|[^十])(?:2|二|两)|两个/u.test(rawCount)
        ? "两"
        : /(?:1|一)|一个/u.test(rawCount)
          ? "一"
          : rawCount.replace(/个|人/gu, "") || "几";
      const names = strippedElement(elements, "names", "他们的名字已经陈明");
      const rawRelation = strippedElement(elements, "relation", "与我同来的人");
      const relation = /^(?:兄弟|朋友|同伴|同事)$/u.test(rawRelation)
        ? `我的${rawRelation}`
        : rawRelation;
      return count === "一"
        ? `论到这一个人，他名叫${names}；他乃是${relation}。`
        : `论到这${count}个人，他们名叫${names}；他们乃是${relation}。`;
    }
    case "courtesy_gift":
      return `金银般贵重的物我没有；只把我手中所有的${strippedElement(elements, "gift", "微薄之物", [/^(?:一点|一些)/u])}给你。`;
    case "courtesy_refusal":
      return context.occurrence
        ? `这不是外人彼此所行的礼，乃是${element(elements, "relation", "弟兄")}之间的情分；不可再看为贵重。`
        : `我实在告诉你，你所行的礼数已经足了；我们原是${element(elements, "relation", "弟兄")}，这礼不可再加重。`;
    case "self_identification":
      return `论到我的名，人所称呼我的名乃是${strippedElement(elements, "name", "这人", [/^(?:我是|我叫|我名叫|人称我)/u])}。`;
    case "reputation":
      return `你的美名已经传在众人中间，胜过许多财物；我也听见人说，你${strippedElement(elements, "qualities", "所行的有情有义", [/^你/u])}。`;
    case "offer_help":
      {
        const recipientAction = strippedElement(
          elements,
          "recipientAction",
          "",
          [/^(?:你)?(?:先|只管)/u],
        );
        let action = strippedElement(
          elements,
          "action",
          strippedElement(elements, "matter", "", [/^(?:替你|帮你)/u]),
          [/^(?:我)?(?:替你|帮你|为你)/u],
        );
        action = action.replace(/^把(.{1,24}?)替你(送到|带到|搬到|交给)/u, "把$1$2");
        if (recipientAction && action) {
          const transfer = action.match(/^把(.{1,24}?)(送到|带到|搬到|交给)(.+)$/u);
          return transfer
            ? `你只管${recipientAction}；论到${transfer[1]}，我必替你${transfer[2]}${transfer[3]}。`
            : `你只管${recipientAction}；论到${action}，我必替你成就。`;
        }
        if (action) {
          return `论到${action}，你只管交在我手中；凡我手所能行的，我必替你成就。`;
        }
        return `你若向我求什么事，只管告诉我；凡我手所能行的，我必为你成就。`;
      }
    case "reassurance":
      return `${strippedElement(elements, "basis", "你所说的话", [/^有了?/u, /^听了?/u])}坚立在我面前，我的心便安稳，不至摇动。`;
    case "approval":
      {
        const quality = strippedElement(elements, "quality", "你口中这痛快的话");
        const normalizedQuality = /痛快|爽快|喜欢.*脾气|直爽的性情|^(?:脾气|性情)$/u.test(quality)
          ? "你口中这痛快的话"
          : quality;
        return `你既将话陈明，这在我眼中看为甚好；我所喜悦的，正是${normalizedQuality}。`;
      }
    case "infer_motive":
      return `你今日召我来，岂只是为${strippedElement(elements, "surface", "坐席吃喝")}吗？你心中若有${strippedElement(elements, "matter", "别的事", [/^必定有/u])}，只管向我陈明。`;
    case "request_directness":
      return `你若有什么话，只管陈明；是，就说是，不是，就说不是。`;
    case "conditional_commitment":
      return `凡我所能行的，我必${strippedElement(elements, "action", "为你成就", [/^我必/u])}；若有我不能行的，求你${strippedElement(elements, "allowance", "体谅我的难处")}。`;
    case "mediation_request": {
      const beneficiary = element(elements, "beneficiary", "这人");
      const action = strippedElement(elements, "action", "应允我所求的", [/^(?:求你)?/u]).replace(
        /(?:寻找|找|追讨)他/u,
        (match) => match.replace(/他$/u, beneficiary),
      );
      const result = strippedElement(elements, "result", "", [/^(?:好叫)?/u]);
      if (/情面|面子/u.test(result)) {
        return `我若在你眼前蒙恩，求你看我的情面，${action}。`;
      }
      return `我若在你眼前蒙恩，求你因${beneficiary}的缘故，${action}${result && result !== beneficiary ? `，好叫${result}` : ""}。`;
    }
    case "mutual_claim": {
      const theirs = normalizePossession(
        strippedElement(elements, "theirs", "你所看重的人"),
        context.speaker,
        context.addressee,
      ).replace(/^[\p{Script=Han}A-Za-z·]{2,8}的/u, "");
      const mine = normalizePossession(
        strippedElement(elements, "mine", "我所看重的人"),
        context.speaker,
        context.addressee,
      ).replace(/^[\p{Script=Han}A-Za-z·]{2,8}的/u, "");
      return `你有${theirs.replace(/^你的/u, "")}，我也有${mine.replace(/^我的/u, "")}。`;
    }
    case "self_defense":
      return `我实在告诉你，${element(elements, "matter", "这事")}，我不是${strippedElement(elements, "rejected", "有意亏负人")}，乃是${element(elements, "asserted", "暂且如此行")}。`;
    case "status_observation":
      return `你的美名胜过大财；你的名已经传在众人中间，${strippedElement(elements, "supporters", "尊重你的人", [/也多$/u])}也多。`;
    case "insult_challenge": {
      const knownA = strippedElement(elements, "knownA", "我哥哥", [/我认识$/u]);
      const knownB = strippedElement(elements, "knownB", "他的名望", [/我也知道$/u]);
      const challenge = strippedElement(elements, "challenge", "在我哥哥面前如此说话", [
        /^究竟是什么人[？?]?/u,
        /你察看自己(?:呢)?$/u,
      ]);
      const plausibleKnownNames = [knownA, knownB].every(
        (value) =>
          /^[\p{Script=Han}A-Za-z·]{2,8}$/u.test(value) &&
          !/我哥|哥哥|兄长|道上|混时|年幼|无知|名望|穿|^你$|^我$/u.test(value),
      );
      if (!plausibleKnownNames) {
        const challenged = context.addressee || "这人";
        return `${challenged}是谁？他算什么人，竟敢${challenge}呢？`;
      }
      if (/^(?:我哥|我哥哥|哥哥|兄长)$/u.test(knownA)) {
        return `我哥哥的名我知道，他的名望我也晓得；你却是谁，竟敢${challenge}呢？`;
      }
      return `${knownA}我认识，${knownB === "你" || knownB === context.addressee ? "他的名望" : knownB}我也知道；你却是谁，竟敢${challenge}呢？`;
    }
    case "rebuke": {
      const rawProhibition = strippedElement(elements, "prohibition", "再以无礼的话待人", [
        /^(?:(?:不可|不要)\s*)+/u,
        /^(?:哎|喂|啊|呀|唉)+$/u,
      ]);
      const prohibition = /^(?:住口|止住(?:你的)?口|闭口|闭嘴)$/u.test(rawProhibition)
        ? "再说无礼的话"
        : rawProhibition;
      return `你当止住你的口；不可${prohibition}。`;
    }
    case "paired_dominance": {
      const all = Object.values(elements).join("，");
      if (/龙/u.test(all) && /虎/u.test(all)) {
        return "凡自称为龙的，必叫他盘着；凡自称为虎的，也必叫他卧着。";
      }
      return `凡${strippedElement(elements, "categoryA", "属于第一等", [/^凡/u, /的$/u])}的，必${strippedElement(elements, "resultA", "照第一等而行", [/^必/u])}；凡${strippedElement(elements, "categoryB", "属于第二等", [/^凡/u, /的$/u])}的，也必${strippedElement(elements, "resultB", "照第二等而行", [/^(?:也)?必/u])}。`;
    }
    case "face_boundary":
      return `你用情面待我，我也用情面待你；因为你用什么量器量给我，我也用什么量器量给你。`;
    case "relay_request":
      return `求你将这话传给${element(elements, "target", "那人")}，叫他亲自到我这里来说明这事。`;
    case "warning_pride":
      return `凡自高的，必降为卑；你不可${strippedElement(elements, "warning", "过于气盛", [/^年轻人[，,]?不可/u, /^不可/u])}。`;
    case "youth_defiance":
      return `不可叫人小看我年轻；我若不${/气盛/u.test(element(elements, "quality", "气盛")) ? "气盛" : strippedElement(elements, "quality", "有胆气", [/^不/u])}，还算什么年轻人呢？`;
    case "exit_threat":
      return `你今日若${strippedElement(elements, "condition", "这样离去", [/^(?:你今日)?若/u, /^今日/u])}，我必追讨这事，断不止息。`;
    case "method_challenge":
      return `依你所说，我当怎样${strippedElement(elements, "action", "离开这里", [/^我当怎样/u, /[呢吗么]+$/u])}呢？`;
    case "coercion": {
      const positive = strippedElement(elements, "positiveCondition", "愿意答应", [/^答应$/u]);
      const negative = strippedElement(elements, "negativeCondition", "不愿答应", [/^不答应$/u]);
      const rawResult = strippedElement(elements, "result", "答应", [/^(?:也得|也当)/u]);
      const result = /答应/u.test(rawResult) ? "答应" : rawResult;
      return `今日所议的，是，就说是；不是，就说不是；然而无论你${positive}或${negative}，都必要${result}。`;
    }
    case "boast":
      return `从我幼年直到今日，从来没有人像你这样${strippedElement(elements, "action", "在我面前说话", [/^我长到这么大[，,]?还没有人敢/u, /^未曾有人敢/u, /^这样/u, /呢$/u])}。`;
    case "death_threat":
      {
        const target = targetName(elements);
        const renderedTarget = context.addressee && target === context.addressee ? "你" : target;
        return `我必夺取${renderedTarget}的命。`;
      }
    case "request":
      {
        const matter = strippedElement(elements, "matter", "", [/^论到/u]);
        const deadline = strippedElement(elements, "deadline", "", [/^(?:在|于)/u, /以前$/u]);
        const action = strippedElement(elements, "action", "应允我所求的", [/^求你/u]);
        if (matter || deadline) {
          const budget = matter.match(/^(.{1,20}?)(?:仍然|还是|依然)?太高$/u);
          const statement = budget
            ? `论到${budget[1]}，所定的仍然太高`
            : `论到${matter || "这事"}，所定的尚未完全`;
          return `${statement}；你当${deadline ? `在${deadline}以前` : "趁着今日"}${action}。`;
        }
        return `我若在你眼前蒙恩，求你${action}，好叫${strippedElement(elements, "result", "这事得以成就", [/^好叫/u])}。`;
      }
    case "refusal":
      {
        const matter = element(elements, "matter", "这事");
        const rawAction = strippedElement(elements, "action", "照此而行", [/^我断不/u]);
        const action = /钱|银|酬谢|报酬|礼物|财物/u.test(matter) && /^(?:要|拿|收|收下|接受|收取)$/u.test(rawAction)
          ? "收取"
          : rawAction;
        const condition = strippedElement(elements, "condition", "", [/^若/u]);
        const advice = strippedElement(
          elements,
          "advice",
          strippedElement(elements, "action2", ""),
          [/^(?:你)?(?:就|当|应当)/u],
        );
        if (advice) {
          let conditionClause = "你若心中仍有挂虑";
          if (condition) {
            if (/^你若/u.test(condition)) conditionClause = condition;
            else if (/^你/u.test(condition)) {
              conditionClause = condition.replace(
                /^你(.{1,12}?)(还在|仍在|已经|正在|尚未|仍然|还)/u,
                "你$1若$2",
              );
              if (conditionClause === condition) conditionClause = `你若${condition.slice(1)}`;
            } else conditionClause = `你若${condition}`;
          }
          return `论到${matter}，我断不${action}；${conditionClause}，就当${advice}。`;
        }
        const declinedObject = matter.match(/^(.{1,20}?)(?:我)?不能收$/u);
        if (declinedObject && /回去|报平安|告诉|通知|照顾/u.test(action)) {
          return `论到${declinedObject[1]}，我断不收取；你若${condition || "心中仍有挂虑"}，就当${action}。`;
        }
        return `论到${matter}，我断不${action}。`;
      }
    case "command":
      return `你当${strippedElement(elements, "action", "照所吩咐的行", [/^你当/u])}；不可${strippedElement(elements, "prohibition", "违背这话", [/^不可/u])}。`;
    case "promise":
      return `我必照你所说的${strippedElement(elements, "action", "去行", [/^我必照(?:你)?所说的/u])}。`;
    case "blessing": {
      const subject = strippedElement(elements, "subject", "你", [/^(?:祝|愿)/u]);
      const wish = strippedElement(elements, "wish", "凡事顺利", [/^(?:祝|愿)/u]);
      const source = `${subject}，${wish}，${Object.values(elements).join("，")}`;
      if (/代码/u.test(source) && /运行|部署|上线|执行/u.test(source)) {
        return "愿你的代码运行在云端，如同运行在本地。";
      }
      if (/道路|前路|前程|旅途|出行/u.test(source)) {
        return `愿${subject}的道路如黎明的光，越照越明，直到${wish}。`;
      }
      if (/工作|事业|计划|项目|工程/u.test(source)) {
        return `愿${subject}手所作的工坚立；愿${wish}，如树栽在溪水旁，按时候结果子。`;
      }
      return `愿${subject}${wish}；愿平安归与你，如江河长流。`;
    }
    case "question":
      {
        const rawQuestion = element(elements, "question", "当察看这事");
        const method = rawQuestion.match(/(?:我当)?(?:怎样|怎么|如何)(.{0,24}?(?:走出|出去|离开).*)/u);
        if (method) {
          return `依你所说，我当怎样${method[1].replace(/[呢吗么？?]+$/u, "")}呢？`;
        }
        const question = strippedElement(elements, "question", "当察看这事", [
          /^岂不/u,
          /[呢吗么]+$/u,
        ]);
        const more = strippedElement(elements, "more", "", [/^何况/u, /[呢吗么]+$/u]);
        return more && !/事情已经显明/u.test(more)
          ? `岂不${question}吗？何况${more}呢？`
          : `岂不${question}吗？`;
      }
    case "contrast":
      return `这不是${strippedElement(elements, "rejected", "人所猜想的", [/^这不是/u])}，乃是${strippedElement(elements, "asserted", "事情真实的缘故", [/^乃是/u])}。`;
    case "general_rule":
      if (/龙/u.test(Object.values(elements).join("，")) && /虎/u.test(Object.values(elements).join("，"))) {
        return "凡自称为龙的，必叫他盘着；凡自称为虎的，也必叫他卧着。";
      }
      if (context.aphorismMode) {
        const category = strippedElement(elements, "category", "如此行", [/^凡/u, /的$/u]);
        const result = strippedElement(elements, "result", "得着相应的结果", [/^必/u]);
        return renderCuvAphorism(category, result);
      }
      return `凡${strippedElement(elements, "category", "如此行", [/^凡/u, /的$/u])}的，必${strippedElement(elements, "result", "得着相应的结果", [/^必/u])}。`;
    case "definition": {
      const subject = strippedElement(elements, "subject", "这事");
      const name = strippedElement(elements, "name", subject);
      const details = strippedElement(elements, "details", "它的性质已经显明");
      return `论到${subject}，所称为${name}的，乃是这样：${details}。`;
    }
    case "factual_statement": {
      const subject = strippedElement(elements, "subject", "这事");
      const fact = strippedElement(elements, "fact", "事情已经显明");
      const more = strippedElement(elements, "more", "");
      return `论到${subject}，所记的乃是这样：${fact}${more ? `；${more}` : ""}。`;
    }
    case "enumeration": {
      const subject = strippedElement(elements, "subject", "这些事");
      const items = strippedElement(elements, "items", "所列的各项");
      return `论到${subject}，所列的乃是这些：${items}。`;
    }
    case "guarantee":
      return `我今日在众人面前作保：若${strippedElement(elements, "condition", "这事不照所说的成就", [/^若/u])}，我必${strippedElement(elements, "penalty", "担当它的罪责", [/^我必/u])}。`;
    case "trade_price":
      return `论到${strippedElement(elements, "item", "这物", [/^论到/u])}，每${strippedElement(elements, "unit", "一份", [/^每/u])}作价${strippedElement(elements, "price", "所定的银钱", [/^作价/u])}；你若交付，我便交在你手中。`;
    case "curse_penalty":
      return `若${strippedElement(elements, "condition", "事情果然不实", [/^若/u])}，${element(elements, "subject", "那物")}就有祸了；它必${strippedElement(elements, "penalty", "担当所定的刑罚", [/^(?:它)?必/u])}。`;
    case "agreement": {
      const action = strippedElement(elements, "action", "去行");
      if (/心.*(?:踏实|安稳)|踏实/u.test(action)) {
        return "有了你这句话，我的心就安稳了。";
      }
      if (/痛快|爽快|喜欢.*脾气/u.test(action)) {
        return "你既将话陈明，这在我眼中看为甚好；我所喜悦的，正是你口中这痛快的话。";
      }
      return `你所说的，我听见了；我必照这话${strippedElement(elements, "action", "去行", [/^我必照这话/u])}。`;
    }
    case "disagreement":
      return `这话在我眼中看为不美；论到${strippedElement(elements, "matter", "这事", [/^论到/u])}，我断不应允。`;
  }
}

const DELIVERY: Record<SpeechDelivery, string> = {
  said: "说",
  answered: "回答说",
  asked: "问说",
  warned: "劝戒说",
  commanded: "吩咐说",
  cried: "大声说",
};

function embeddedDelivery(
  delivery: SpeechDelivery,
  addressee: string,
) {
  if (delivery === "said") return addressee ? `对${addressee}说` : "说";
  if (delivery === "asked") return addressee ? `问${addressee}说` : "问说";
  if (delivery === "warned") return addressee ? `劝${addressee}说` : "劝戒说";
  if (delivery === "commanded") return addressee ? `吩咐${addressee}说` : "吩咐说";
  return DELIVERY[delivery];
}

function sameAddressee(a?: string, b?: string) {
  return cleanSlot(a, 50) === cleanSlot(b, 50);
}

function canMergeConsecutiveSpeech(
  previous: Extract<ScriptureSkeletonUnit, { kind: "speech" }>,
  current: Extract<ScriptureSkeletonUnit, { kind: "speech" }>,
) {
  return (
    previous.speaker === current.speaker &&
    sameAddressee(previous.addressee, current.addressee) &&
    (
      (["said", "answered"].includes(previous.delivery || "said") &&
        ["said", "answered"].includes(current.delivery || "said")) ||
      previous.delivery === current.delivery
    )
  );
}

function speechTag(
  unit: Extract<ScriptureSkeletonUnit, { kind: "speech" }>,
  previousSpeech: Extract<ScriptureSkeletonUnit, { kind: "speech" }> | null,
  seenCount: number,
  previousAddressee: string,
) {
  const speaker = cleanSlot(unit.speaker, 50);
  const addressee = cleanSlot(unit.addressee, 50);
  const delivery = unit.delivery || "said";

  if (previousSpeech?.speaker === speaker) {
    if (addressee && addressee !== cleanSlot(previousSpeech.addressee, 50)) {
      return `又对${addressee}说`;
    }
    if (delivery === "asked") return "又问说";
    if (delivery === "commanded") return "又吩咐说";
    if (delivery === "warned") return "又劝戒说";
    if (delivery === "cried") return "又大声说";
    return "又说";
  }
  if (delivery === "answered") {
    return previousSpeech &&
      (previousSpeech.delivery === "asked" || previousSpeech.speaker === addressee)
      ? `${speaker}回答说`
      : `${speaker}说`;
  }
  if (delivery === "asked") return `${speaker}${addressee ? `问${addressee}` : "问"}说`;
  if (delivery === "commanded") {
    return `${speaker}${addressee ? `吩咐${addressee}` : "吩咐"}说`;
  }
  if (delivery === "warned") return `${speaker}${addressee ? `劝${addressee}` : "劝戒"}说`;
  if (delivery === "cried") return `${speaker}大声说`;
  if (previousSpeech && addressee && previousSpeech.speaker === addressee) {
    return `${speaker}回答说`;
  }
  if (addressee && (seenCount === 0 || previousAddressee !== addressee)) {
    return `${speaker}对${addressee}说`;
  }
  return `${speaker}说`;
}

function redundantNarrativeResult(action: string, result: string) {
  if (!result) return true;
  if (action.includes(result) || result.includes(action)) return true;
  const pairs = [
    ["刺伤", "受伤"],
    ["制住", "被制住"],
    ["拦住", "被拦住"],
    ["打倒", "倒下"],
    ["杀死", "死了"],
    ["离开", "离去"],
  ] as const;
  return pairs.some(
    ([cause, consequence]) => {
      const causeAt = action.indexOf(cause);
      if (causeAt < 0 || !result.includes(consequence)) return false;
      const affected = action
        .slice(causeAt + cause.length)
        .replace(/^[了把将]/u, "")
        .split(/[，；、\s]/u)[0]
        .slice(0, 12);
      return !affected || result.includes(affected);
    },
  );
}

function renderNarration(
  unit: Extract<ScriptureSkeletonUnit, { kind: "narration" }>,
  previousFrame: NarrationFrameId | "" = "",
  previousActor = "",
  previousSpeechAddressee = "",
  previousSpeechSpeaker = "",
) {
  const actor = cleanSlot(unit.actor, 50);
  const target = cleanSlot(unit.target, 50);
  const object = cleanSlot(unit.object, 100);
  const suppliedAction = cleanSlot(unit.action, 180);
  let rawResult = cleanSlot(unit.result, 180);
  let rawAction = suppliedAction || rawResult || "行了所要行的事";
  if (!suppliedAction && rawResult) rawResult = "";
  if (/^扑(?:过去|上前)/u.test(rawAction) && previousSpeechAddressee) {
    rawAction = `向${previousSpeechAddressee}${rawAction}`;
  }
  if (/(?:刺伤|打伤|杀伤)$/u.test(rawAction) && previousActor && previousActor !== actor) {
    rawAction += previousActor;
  }
  if (/制住$/u.test(rawAction)) {
    const resultTarget = rawResult.match(/^([\p{Script=Han}A-Za-z·]{1,12})(不能|无法|不得)(.+)$/u);
    if (resultTarget) {
      rawAction += resultTarget[1];
      rawResult = `使他${resultTarget[2]}${resultTarget[3]}`;
    }
  }
  const action = /叫了一声$/u.test(rawAction)
    ? `叫了${target || object || "同伴"}的名字`
    : rawAction;
  const place = cleanSlot(unit.place, 80);
  const time = cleanSlot(unit.time, 80);
  const matter = cleanSlot(unit.matter, 180);
  const result = redundantNarrativeResult(action, rawResult) ? "" : rawResult;
  const fullAction = action || object || target || "行了所要行的事";

  switch (unit.frame) {
    case "arrival":
      {
        const usablePlace = place && place !== time && !/^(?:第?[一二三四五六七八九十]+天|清晨|早晨|上午|中午|午后|下午|傍晚|晚上)$/u.test(place)
          ? place
          : "";
        const statement = matter.replace(/^自己/u, "");
        const arrivalAction = suppliedAction
          ? usablePlace && !fullAction.includes(usablePlace)
            ? `${fullAction}，来到${usablePlace}`
            : fullAction
          : usablePlace
            ? `来到${usablePlace}`
            : "来到那里";
        return `${time ? `到了${time}，` : "那时，"}${actor || "有人"}${arrivalAction}${statement ? `，又说自己${statement}` : ""}${result ? `；${result}` : ""}。`;
      }
    case "setting":
      if (actor && suppliedAction) {
        return `${time ? `那时正是${time}，` : "那时，"}${actor}${suppliedAction}${matter ? `；${matter}` : ""}。`;
      }
      if (/里面|屋里/u.test(place)) {
        return `那屋里，${!matter || /已经预备妥当/u.test(matter) ? "筵席已经摆设齐备" : matter}。`;
      }
      if (/酒席前|席前/u.test(place)) return "众人在席前坐定。";
      if (!matter || /已经预备妥当/u.test(matter)) {
        if (time && place) return `那时正是${time}，事情发生在${place}。`;
        if (time) return `那时正是${time}。`;
        if (place) return `那时，众人正在${place}。`;
      }
      return `${time ? `那时正是${time}，` : "那时，"}${place ? (/中$|里$|前$|上$|下$|外$|旁$|边$|口$/u.test(place) ? place : `${place}中`) : "众人中间"}${matter || "事情正在进行"}。`;
    case "action":
      {
        const conditionalAction = /^(?:虽(?:然)?|既|因(?:为)?|仍|却|若|倘若|纵然|即便)/u.test(
          fullAction,
        );
        const timePrefix = time ? `到了${time}，` : "";
        const speechPrefix = actor && previousSpeechSpeaker === actor ? "说完这话，" : "";
        const actorPrefix = actor ? `${actor}${conditionalAction ? "" : "就"}` : "";
        return `${speechPrefix}${timePrefix}${actorPrefix}${fullAction}${result ? `${/^(?:使|好叫|以致)/u.test(result) ? "，" : "；"}${result}` : ""}。`;
      }
    case "reaction":
      if (/^(?:看见|听见|发现|数过|读过|检查)/u.test(action)) {
        const objectTarget = /方案|文件|内容|结果|报告|物品|产品|钱包|礼物/u.test(target)
          ? target
          : "";
        const observed = objectTarget && /^看见/u.test(action)
          ? action.replace(/^看见/u, `看见${objectTarget}的`)
          : action;
        return `${actor || "那人"}${observed}${result ? `，就${result}` : ""}。`;
      }
      if (result && /^(?:称赞|赞扬|夸奖|责备|斥责|感谢)$/u.test(action)) {
        return `${actor || "那人"}${previousSpeechSpeaker ? "听见这话" : "看见这事"}${target ? `，就转向${target}` : ""}，${action}${result}。`;
      }
      return `${actor || "那人"}${previousSpeechSpeaker ? "听见这话" : "看见这事"}${target ? `，就转向${target}` : ""}，${action}${result ? `；${result}` : ""}。`;
    case "indirect_speech":
      return `${actor}${target ? `就向${target}` : "便向众人"}陈明${matter || "这事"}${result ? `，好叫人知道${result}` : ""}。`;
    case "introduction":
      return `${actor}${target ? `把${target}` : "把同来的人"}带到众人面前，说明${matter || "他们的名与关系"}。`;
    case "transition":
      return `及至${matter || "事情到了这一步"}，${actor}就${action}${result ? `；${result}` : ""}。`;
    case "outcome": {
      let outcomeAction = fullAction;
      if (time) {
        for (const prefix of [`到了${time}`, time]) {
          if (outcomeAction.startsWith(prefix)) {
            outcomeAction = outcomeAction
              .slice(prefix.length)
              .replace(/^[，,；;\s]+/u, "");
            break;
          }
        }
      }
      const timePrefix = time ? `到了${time}，` : "";
      if (previousFrame === "outcome") {
        return `${timePrefix}${actor ? `${actor}${/^眼看/u.test(outcomeAction) ? "只能" : "就"}` : ""}${outcomeAction}${result ? `；${result}` : ""}。`;
      }
      return `${timePrefix || "于是"}${actor}${outcomeAction}${result ? `；${result}` : ""}。`;
    }
  }
}

const OPENING_SPEECH_INTENTS = new Set<SpeechIntentId>([
  "welcome",
  "waited_arrival",
  "guide_inside",
  "invite_seat",
  "introduction",
  "courtesy_gift",
  "courtesy_refusal",
  "self_identification",
]);

function isOpeningUnit(unit: ScriptureSkeletonUnit) {
  if (unit.kind === "speech") return OPENING_SPEECH_INTENTS.has(unit.intent);
  if (unit.kind === "declaration") return false;
  if (["arrival", "setting", "introduction"].includes(unit.frame)) return true;
  const details = [unit.action, unit.object, unit.matter, unit.place]
    .filter(Boolean)
    .join("，");
  return (
    ["action", "reaction", "indirect_speech"].includes(unit.frame) &&
    /迎接|引导|领.*进去|往里面|坐席|落座|叫.*名字|礼物|所带|带来之物|摆在席前/u.test(details)
  );
}

function primaryName(value: string) {
  return cleanSlot(value, 50)
    .split(/[、，,]|(?:和|与)/u)[0]
    .replace(/等人$/u, "") || "那人";
}

function normalizeCondensedRelation(value: string, owner: "self" | "host") {
  const relation = cleanSlot(value, 80)
    .replace(/^(?:乃是|就是|是)/u, "")
    .trim();
  const possessive = owner === "self" ? "自己的" : "他的";
  if (!relation) return `${possessive}兄弟`;
  if (/^(?:兄弟|朋友|同伴|伙伴|门徒|亲属)$/u.test(relation)) {
    return `${possessive}${relation}`;
  }
  if (owner === "self") return relation.replace(/^我的/u, "自己的");
  return relation.replace(/^我的/u, "他的");
}

function condenseHistoricalOpening(plan: ScriptureSkeletonPlan) {
  if (!/故事|记事|片段|冲突/u.test(cleanSlot(plan.textType, 60))) return plan;
  let openingEnd = 0;
  while (openingEnd < plan.units.length && isOpeningUnit(plan.units[openingEnd])) {
    openingEnd += 1;
  }
  if (openingEnd < 5 || openingEnd >= plan.units.length) return plan;

  const opening = plan.units.slice(0, openingEnd);
  const arrival = opening.find(
    (unit): unit is Extract<ScriptureSkeletonUnit, { kind: "narration" }> =>
      unit.kind === "narration" && unit.frame === "arrival",
  );
  if (!arrival) return plan;

  const guest = primaryName(arrival.actor || "");
  const speakerCounts = new Map<string, number>();
  for (const unit of opening) {
    if (unit.kind !== "speech" || unit.speaker === guest) continue;
    speakerCounts.set(unit.speaker, (speakerCounts.get(unit.speaker) || 0) + 1);
  }
  const host = [...speakerCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "";
  if (!host) return plan;

  const introductions = opening.filter(
    (unit): unit is Extract<ScriptureSkeletonUnit, { kind: "speech" }> =>
      unit.kind === "speech" && unit.intent === "introduction",
  );
  const guestIntroduction = introductions.find((unit) => unit.speaker !== host);
  const hostIntroduction = introductions.find((unit) => unit.speaker === host);
  const companionNames = guestIntroduction
    ? strippedElement(guestIntroduction.elements, "names", "同行的人")
    : "";
  const companionRelation = guestIntroduction
    ? normalizeCondensedRelation(
        strippedElement(guestIntroduction.elements, "relation", "自己的同伴"),
        "self",
      )
    : "";
  const hostRelation = hostIntroduction
    ? normalizeCondensedRelation(
        strippedElement(hostIntroduction.elements, "relation", "他的兄弟"),
        "host",
      )
    : "";
  const hostRelationName = hostIntroduction
    ? strippedElement(hostIntroduction.elements, "names", "那人")
    : "";
  const gift = opening.find(
    (unit): unit is Extract<ScriptureSkeletonUnit, { kind: "narration" }> =>
      unit.kind === "narration" &&
      /礼物|所带|带来之物|带来的东西/u.test(
        [unit.action, unit.object, unit.matter].filter(Boolean).join("，"),
      ),
  );

  const condensed: ScriptureSkeletonUnit[] = [arrival];
  condensed.push({
    kind: "narration",
    frame: "action",
    actor: host,
    action: `迎接${guest}${companionNames ? "和同行的人" : ""}，与他们一同坐席`,
  });

  const details: string[] = [];
  if (guestIntroduction) {
    details.push(
      `${guestIntroduction.speaker}将${companionNames}引到众人面前，称他们为${companionRelation}`,
    );
  }
  if (gift) {
    const giftActor = cleanSlot(gift.actor, 50) || companionNames || "同行的人";
    details.push(`${giftActor}把所带之物陈在席前；${host}看见，便以弟兄之礼相待`);
  }
  if (hostIntroduction) {
    details.push(`${host}又使${guest}认识${hostRelationName}，就是${hostRelation}`);
  }
  if (details.length) {
    condensed.push({
      kind: "narration",
      frame: "action",
      action: details.join("。"),
    });
  }

  return {
    ...plan,
    units: [...condensed, ...plan.units.slice(openingEnd)],
  };
}

function repairHistoricalPlan(plan: ScriptureSkeletonPlan) {
  if (!/故事|记事|片段|冲突/u.test(cleanSlot(plan.textType, 60))) return plan;
  const units = [...plan.units];
  const mediationIndex = units.findIndex(
    (unit) => unit.kind === "speech" && unit.intent === "mediation_request",
  );
  const mediation = mediationIndex >= 0 ? units[mediationIndex] : null;

  if (
    mediation?.kind === "speech" &&
    !units.some((unit) => unit.kind === "speech" && unit.intent === "infer_motive")
  ) {
    const directnessIndex = units.findIndex(
      (unit, index) =>
        index < mediationIndex &&
        unit.kind === "speech" &&
        unit.intent === "request_directness" &&
        unit.addressee === mediation.speaker,
    );
    if (directnessIndex >= 0) {
      const directness = units[directnessIndex];
      if (directness.kind === "speech") {
        units[directnessIndex] = {
          ...directness,
          intent: "infer_motive",
          elements: { surface: "坐席吃喝", matter: "别的事" },
        };
      }
    }
  }

  const beneficiary =
    mediation?.kind === "speech"
      ? strippedElement(mediation.elements, "beneficiary", "") ||
        strippedElement(mediation.elements, "target", "")
      : "";
  if (beneficiary) {
    for (let index = 0; index < units.length; index += 1) {
      const unit = units[index];
      if (unit.kind !== "speech" || unit.intent !== "self_defense") continue;
      const matter = cleanSlot(unit.elements.matter, 100);
      if (/^(?:向人)?借(?:钱|款)|^借用(?:钱|款)$/u.test(matter)) {
        units[index] = {
          ...unit,
          elements: { ...unit.elements, matter: `向${beneficiary}借钱` },
        };
      }
    }
  }

  return { ...plan, units };
}

function dedupeHistoricalSpeech(plan: ScriptureSkeletonPlan) {
  if (!/故事|记事|片段|冲突/u.test(cleanSlot(plan.textType, 60))) return plan;
  const units: ScriptureSkeletonUnit[] = [];
  for (const unit of plan.units) {
    const previous = units.at(-1);
    if (
      unit.kind === "speech" &&
      unit.intent === "request_directness" &&
      previous?.kind === "speech" &&
      previous.speaker === unit.speaker &&
      previous.intent === "infer_motive"
    ) {
      continue;
    }
    units.push(unit);
  }
  return { ...plan, units };
}

const STORY_TOKEN_STOP_WORDS = new Set([
  "一个",
  "一些",
  "自己",
  "他们",
  "她们",
  "我们",
  "你们",
  "这个",
  "那个",
  "这些",
  "那些",
  "已经",
  "于是",
  "然后",
  "随后",
  "便",
  "就",
  "又",
  "说",
  "说道",
  "回答",
  "看见",
  "来到",
  "那里",
  "这里",
  "事情",
  "东西",
]);

const IMPORTANT_SINGLE_STORY_TOKENS = new Set([
  "药",
  "雨",
  "车",
  "刀",
  "钱",
  "血",
  "火",
  "病",
]);

const STORY_FACT_FAMILIES: readonly {
  label: string;
  source: RegExp;
  result: RegExp;
}[] = [
  { label: "生病", source: /生病|患病|病了|病中/u, result: /生病|患病|病了|病中/u },
  { label: "药", source: /送药|拿药|买药|药物|药品|吃药/u, result: /药/u },
  { label: "妻子", source: /妻子|老婆|妻/u, result: /妻子|老婆|妻/u },
  { label: "丈夫", source: /丈夫|老公/u, result: /丈夫|老公/u },
  { label: "孩子", source: /孩子|儿子|女儿/u, result: /孩子|儿子|女儿/u },
  { label: "雨", source: /下雨|雨中|冒雨|淋雨|雨里/u, result: /雨/u },
  { label: "车辆", source: /电动车|自行车|摩托车|汽车|车子/u, result: /电动车|自行车|摩托车|汽车|车/u },
  { label: "楼上", source: /楼上|楼下|上楼|下楼/u, result: /楼上|楼下|上楼|下楼/u },
  { label: "衣服湿透", source: /衣服.{0,4}湿|衣裳.{0,4}湿|湿透/u, result: /衣服.{0,5}湿|衣裳.{0,5}湿|湿透|尽都湿/u },
  { label: "水果", source: /水果|果篮/u, result: /水果|果子|果篮/u },
  { label: "苹果", source: /苹果/u, result: /苹果/u },
  { label: "道谢", source: /道谢|感谢|谢意/u, result: /道谢|感谢|谢意|称谢/u },
  { label: "疲惫", source: /疲惫|劳累|困倦|筋疲力尽/u, result: /疲惫|劳累|困倦|劳苦|乏力/u },
  { label: "借贷", source: /借钱|借款|欠钱|还钱|归还/u, result: /借钱|借款|欠钱|还钱|归还/u },
  { label: "伤害", source: /刺伤|砍伤|打伤|受伤/u, result: /刺伤|砍伤|打伤|受伤|伤口/u },
  { label: "死亡", source: /杀死|弄死|死亡|死了|夺取.{0,5}命/u, result: /杀死|死亡|死了|夺取.{0,5}命/u },
] as const;

const UNSUPPORTED_STORY_MORALS = [
  "过错",
  "罪恶",
  "犯罪",
  "纷争",
  "争竞",
  "审判",
  "刑罚",
  "报应",
  "咒诅",
  "灭亡",
  "仇恨",
  "怀恨",
  "羞辱",
  "懒惰",
  "贪财",
  "贪婪",
] as const;

const SPECIALIZED_INTENT_EVIDENCE: Partial<Record<SpeechIntentId, RegExp>> = {
  introduction: /介绍|引见|认识|名叫|名字/u,
  courtesy_gift: /礼物|赠|送给|交给|递给|带来|拿来|水果|礼品/u,
  courtesy_refusal: /推辞|不收|拒收|只收|客气|何必/u,
  self_identification: /我是|我叫|我名叫|报上姓名|自报姓名/u,
  reputation: /名声|名望|有名|听说|略知/u,
  offer_help: /帮助|帮忙|替你|替他|替她|代为|代办|我来|交给我|只管.{0,12}(?:照顾|回去|歇息)/u,
  reassurance: /踏实|安心|放心|心里.{0,8}安|有.{0,8}这句话/u,
  approval: /痛快|爽快|直爽|喜欢.{0,8}(?:脾气|性情|说法)/u,
  status_observation: /名声|名望|有名|孝敬|尊重/u,
  trade_price: /价格|价钱|块钱|元钱|每斤|作价|多少钱/u,
  guarantee: /保证|作保|担保|若是.*便|不.*就/u,
  curse_penalty: /刑罚|惩罚|有祸|吞下|报应/u,
  warning_pride: /自高|骄傲|气盛|狂妄/u,
  death_threat: /弄死|杀死|夺取.{0,5}命|要命/u,
};

function normalizeStoryFactText(value: string) {
  return value
    .replace(/衣裳/gu, "衣服")
    .replace(/患病|病中|病了/gu, "生病")
    .replace(/药物|药品/gu, "药")
    .replace(/邻舍|邻里/gu, "邻居")
    .replace(/照顾|照应|扶持|顾念|帮助/gu, "帮助")
    .replace(/称谢|道谢|谢意/gu, "感谢")
    .replace(/果篮|果子/gu, "水果")
    .replace(/车子/gu, "车")
    .replace(/[“”"‘’'，。！？；：、（）()\s]/gu, "");
}

function storyContentTokens(value: string) {
  const normalized = normalizeStoryFactText(value);
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  const tokens = new Set<string>();
  for (const part of segmenter.segment(normalized)) {
    const token = part.segment.trim();
    if (!token || !/[\p{Script=Han}A-Za-z0-9]/u.test(token)) continue;
    if (STORY_TOKEN_STOP_WORDS.has(token)) continue;
    if ([...token].length === 1 && !IMPORTANT_SINGLE_STORY_TOKENS.has(token)) continue;
    tokens.add(token);
  }
  return [...tokens];
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractStoryNames(source: string) {
  const names = new Set<string>();
  const matcher = /(?:^|[。！？；，、“”])([\p{Script=Han}A-Za-z·]{2,5}?)(?=(?:说|回答|问|喊|叫|来到|赶来|带着|拿着|看见|看到|察看|查看|发现|下班|回家|只收|便|就))/gu;
  for (const match of source.matchAll(matcher)) {
    const name = match[1].replace(/(?:摇头|点头|看完后|下班|转身|起身)$/u, "");
    const isClauseFragment =
      /^(?:把|被|从|向|在|于|将|使|让|给|对|同|与|和|若|如果|因为|所以|为了|当|及至|到了|有些|有的|这些|那些|这个|那个|其中|于是|随后|后来|就|便|又|却|仍|并|而|但|惟有|只有)/u.test(name) ||
      /^(?:不|未|没有|冒着|作为|她为|他为|我为|你为|人们|众人)/u.test(name) ||
      /(?:风险|现实|生活|成长|起名|相称|时候|事情|结果)$/u.test(name) ||
      /(?:昨日|今日|明日|当天|当时|以前|以后|最后|已经|仍然|虽然|忽然|立即|重新|终于|一同|各自|逐项|这些|那些)/u.test(name);
    if (
      !isClauseFragment &&
      !/^(?:第二天|那时候|这个人|那个人|服务员|众人)$/u.test(name)
    ) {
      names.add(name);
    }
  }
  return [...names];
}

function extractGiftRoles(source: string) {
  const receiverMatch = source.match(
    /(?:^|[。！？；，、“”])([\p{Script=Han}A-Za-z·]{2,6}?)(?:只|便|就)?收下/u,
  );
  const giverMatch = source.match(
    /(?:^|[。！？；，、“”])([\p{Script=Han}A-Za-z·]{2,6})(?:带着|拿着|捧着|提着)([^，。；]{1,20}?)(?:来|前来)(?:道谢|送|交给|递给)/u,
  );
  return {
    giver: giverMatch?.[1] || "",
    receiver: receiverMatch?.[1] || "",
    gift: cleanSlot(giverMatch?.[2] || "", 40),
  };
}

function isGroundedStoryRule(elements: SkeletonSlots, source: string) {
  const renderedElements = Object.values(elements).join("，");
  const normalizedSource = normalizeStoryFactText(source);
  const unsupported = UNSUPPORTED_STORY_MORALS.some(
    (term) => renderedElements.includes(term) && !source.includes(term),
  );
  if (unsupported) return false;
  const tokens = storyContentTokens(renderedElements);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => normalizedSource.includes(normalizeStoryFactText(token)));
  return matched.length / tokens.length >= 0.45;
}

function isGroundedStoryDeclaration(unit: Extract<ScriptureSkeletonUnit, { kind: "declaration" }>, source: string) {
  return isGroundedStoryRule(unit.elements, source);
}

function reflectionEvidenceIsSupported(evidence: string, source: string) {
  const normalizedEvidence = normalizeStoryFactText(evidence);
  const normalizedSource = normalizeStoryFactText(source);
  if (!normalizedEvidence) return false;
  if (normalizedSource.includes(normalizedEvidence)) return true;
  const tokens = storyContentTokens(evidence);
  if (!tokens.length) return false;
  const matched = tokens.filter((token) => normalizedSource.includes(normalizeStoryFactText(token)));
  return matched.length / tokens.length >= 0.72;
}

function reflectionFieldsAreGrounded(reflection: ScriptureReflection, source: string) {
  if (reflection.mode === "neutral" && reflection.relation === "neutral_record") {
    return reflection.evidence.some((item) => reflectionEvidenceIsSupported(item, source));
  }
  if (!reflection.actor || !reflection.behavior || !reflection.outcome) return false;
  const normalizedSource = normalizeStoryFactText(source);
  const fieldCoverage = (value: string) => {
    const tokens = storyContentTokens(value);
    if (!tokens.length) return 0;
    const matched = tokens.filter((token) => normalizedSource.includes(normalizeStoryFactText(token)));
    return matched.length / tokens.length;
  };
  return (
    normalizedSource.includes(normalizeStoryFactText(reflection.actor)) &&
    fieldCoverage(reflection.behavior) >= 0.55 &&
    fieldCoverage(reflection.outcome) >= 0.45
  );
}

function inferLegacyReflection(elements: SkeletonSlots): ScriptureReflection {
  const behavior = cleanSlot(elements.category, 180);
  const outcome = cleanSlot(elements.result, 180);
  const source = `${behavior}，${outcome}`;
  const relation: ReflectionRelation = /帮助|照顾|扶持|邻居|邻里|顾念/u.test(source)
    ? "care_for_others"
    : /小事|忠心|守信|归还|拒收/u.test(source)
      ? "small_faithfulness"
      : /劳苦|疲惫|坚持|忍耐|完成|交付/u.test(source)
        ? "effort_harvest"
        : /自高|骄傲|狂妄|轻看/u.test(source)
          ? "self_exaltation"
          : /怒气|发怒|争吵|动手|威胁|伤害/u.test(source)
            ? "anger_warning"
            : /实话|诚实|说谎|言语/u.test(source)
              ? "speech_truth"
              : /时候|时辰|期限|日期/u.test(source)
                ? "time_and_season"
                : "cause_result";
  const behaviorPolarity = classifyBehaviorPolarity(behavior);
  const outcomePolarity = classifyOutcomePolarity(outcome);
  const polarity: ReflectionPolarity = behaviorPolarity === "neutral"
    ? outcomePolarity
    : behaviorPolarity;
  return {
    enabled: true,
    mode: polarity === "negative" ? "warn" : "commend",
    actor: "这人",
    behavior,
    outcome,
    relation,
    polarity,
    evidence: [],
  };
}

function reflectionSemanticIssues(reflection: ScriptureReflection, source: string) {
  const issues: string[] = [];
  if (!reflection.enabled) return issues;
  if (!reflection.actor || !reflection.behavior || !reflection.outcome) {
    issues.push("故事判词缺少人物、具体行为或实际结果");
  }
  if (!reflection.evidence.length) {
    issues.push("故事判词缺少原文证据");
  } else if (!reflection.evidence.every((item) => reflectionEvidenceIsSupported(item, source))) {
    issues.push("故事判词的 evidence 不是原文原句或可靠摘录");
  }
  if (reflection.actor && !normalizeStoryFactText(source).includes(normalizeStoryFactText(reflection.actor))) {
    issues.push("故事判词评价了原文中不存在的人物");
  }
  if (!reflectionFieldsAreGrounded(reflection, source)) {
    issues.push("故事判词的行为或结果缺少原文依据");
  }

  const behaviorTone = classifyBehaviorPolarity(reflection.behavior);
  const outcomeTone = classifyOutcomePolarity(reflection.outcome);
  if (reflection.mode === "commend" && behaviorTone === "negative") {
    issues.push("故事判词把负面行为写成了称许");
  }
  if (reflection.mode === "warn" && behaviorTone === "positive") {
    issues.push("故事判词把正面行为写成了警戒");
  }
  if (reflection.polarity === "positive" && behaviorTone === "negative") {
    issues.push("故事判词的褒贬方向与行为相反");
  }
  if (reflection.polarity === "negative" && behaviorTone === "positive" && outcomeTone !== "negative") {
    issues.push("故事判词无依据地贬斥正面行为");
  }
  if (
    reflection.relation === "self_exaltation" &&
    !/自高|骄傲|狂妄|抬高自己|高看自己|轻看/u.test(reflection.behavior)
  ) {
    issues.push("凡自高者降卑的骨架只能用于原文明确的自高行为");
  }
  if (
    reflection.relation === "anger_warning" &&
    !/怒|争吵|冲突|威胁|动手|伤害|报复|扑|刺|打/u.test(reflection.behavior)
  ) {
    issues.push("怒气骨架只能用于原文明确的愤怒、威胁或伤害行为");
  }
  if (
    reflection.relation === "value_comparison" &&
    reflection.polarity !== "positive"
  ) {
    issues.push("美名胜过财物的骨架只能用于受到称许的行为");
  }
  const relationSource = `${reflection.behavior}，${reflection.outcome}`;
  const relationEvidence: Partial<Record<ReflectionRelation, RegExp>> = {
    value_comparison: /诚实|归还|拒收|守信|清白|美名|名声|称赞|感谢|尊重|珍贵|胜过/u,
    effort_harvest: /劳苦|疲惫|坚持|忍耐|不放弃|不灰心|反复|重新|多次|按时|终于|完成|交付/u,
    care_for_others: /帮助|照顾|顾念|扶起|扶持|代办|送药|搬运|邻居|邻里|他人/u,
    small_faithfulness: /小事|细节|忠心|守信|责任|托付|按时|归还|原样|拒收/u,
    time_and_season: /时候|时辰|日期|期限|清晨|晚上|午后|第二天|等待|按时/u,
    speech_truth: /说|回答|承认|实话|诚实|真相|谎言|隐瞒|应允|否认/u,
    loss_and_gain: /舍弃|放下|失去|牺牲|让出|拒绝所得|不求回报|保全/u,
    inherited_responsibility: /家族|祖先|父辈|母辈|后代|孩子|儿子|女儿|血脉|罪孽|担当/u,
    parallel: /如同|好像|一样|仿佛|两地|两处|彼此相应/u,
  };
  const requiredEvidence = relationEvidence[reflection.relation];
  if (requiredEvidence && !requiredEvidence.test(relationSource)) {
    issues.push(`故事判词的 ${reflection.relation} 关系与具体行为、结果不相称`);
  }
  return [...new Set(issues)];
}

function inheritedResponsibilityReflection(
  source: string,
): ScriptureReflection | undefined {
  const hasInheritedEvil =
    /家族|祖先|父辈|母辈|血脉|世代/u.test(source) &&
    /献祭|罪孽|罪责|恶魔|邪恶|恶行|过犯/u.test(source);
  const hasInnocentDescendant =
    /孩子|婴儿|儿子|女儿|后代/u.test(source) &&
    /纯洁|无辜|清白|不是恶魔|不担当|不应承担|并非.*罪/u.test(source);
  if (!hasInheritedEvil || !hasInnocentDescendant) return undefined;

  const evidence = source
    .split(/[。！？!?]/u)
    .map((item) => item.trim())
    .filter(
      (item) =>
        item &&
        (/(?:孩子|婴儿|儿子|女儿|后代).{0,60}(?:纯洁|无辜|清白|不是恶魔|不担当|不应承担)/u.test(item) ||
          /(?:纯洁|无辜|清白|不是恶魔|不担当|不应承担).{0,60}(?:孩子|婴儿|儿子|女儿|后代)/u.test(item)),
    )
    .slice(0, 2);
  return {
    enabled: true,
    mode: "neutral",
    actor: /瑞斯/u.test(source) ? "瑞斯" : "那孩子",
    behavior: "虽出自背负旧罪的家族，却有清白的灵魂",
    outcome: /健康.{0,4}长大/u.test(source)
      ? "离开家族以后健康长大"
      : "不曾担当家族的旧罪",
    relation: "inherited_responsibility",
    polarity: "neutral",
    evidence: evidence.length ? evidence : [source.slice(0, 140)],
  };
}

/**
 * The model only identifies facts. This pass removes unsupported specialist
 * frames and repairs an unambiguous gift direction before any biblical wording
 * is rendered.
 */
export function groundScriptureSkeletonPlan(plan: ScriptureSkeletonPlan, source: string) {
  if (classifyScriptureSource(source) !== "story") return { ...plan, reflection: undefined };
  const giftRoles = extractGiftRoles(source);
  const units: ScriptureSkeletonUnit[] = [];
  let legacyReflection: ScriptureReflection | undefined;

  for (const unit of plan.units) {
    if (unit.kind === "declaration") {
      if (unit.intent === "general_rule") {
        if (isGroundedStoryDeclaration(unit, source) && !legacyReflection) {
          legacyReflection = inferLegacyReflection(unit.elements);
        }
        continue;
      }
      units.push(unit);
      continue;
    }
    if (unit.kind !== "speech") {
      units.push(unit);
      continue;
    }

    const evidence = SPECIALIZED_INTENT_EVIDENCE[unit.intent];
    if (evidence && !evidence.test(source)) continue;
    if (unit.intent === "general_rule") {
      if (isGroundedStoryRule(unit.elements, source) && !legacyReflection) {
        legacyReflection = inferLegacyReflection(unit.elements);
      }
      continue;
    }

    if (
      unit.intent === "courtesy_gift" &&
      giftRoles.giver &&
      giftRoles.receiver &&
      unit.speaker === giftRoles.receiver
    ) {
      units.push({
        ...unit,
        speaker: giftRoles.giver,
        addressee: giftRoles.receiver,
        elements: {
          ...unit.elements,
          gift: giftRoles.gift || unit.elements.gift || "所带来的礼物",
        },
      });
      continue;
    }
    if (unit.intent === "refusal" && (!unit.elements.condition || (!unit.elements.advice && !unit.elements.action2))) {
      const condition = source.match(/你若([^，；”"]+)[，；][^”"]*(?:回去|报平安|告诉|通知|照顾)/u)?.[1];
      const advice = source.match(/你若[^，；”"]+[，；][^”"]*?(?:就|便|当)([^。；”"]+)/u)?.[1];
      units.push(
        condition || advice
          ? {
              ...unit,
              elements: {
                ...unit.elements,
                condition: unit.elements.condition || condition || "",
                advice: unit.elements.advice || unit.elements.action2 || advice || "",
              },
            }
          : unit,
      );
      continue;
    }
    units.push(unit);
  }

  const contrast = source.match(
    /(?:^|[。！？；，、“”])([\p{Script=Han}A-Za-z·]{2,5}?)虽然([^，。]{1,18})，却([^，。]{1,24})，([^。！？]{1,60})/u,
  );
  if (contrast) {
    const [, actor, condition, response, followingAction] = contrast;
    const actionKey = storyContentTokens(followingAction)[0] || followingAction.slice(0, 4);
    const index = units.findIndex(
      (unit) =>
        unit.kind === "narration" &&
        unit.actor === actor &&
        (!actionKey || cleanSlot(unit.action, 180).includes(actionKey)),
    );
    if (index >= 0) {
      const unit = units[index];
      if (unit.kind === "narration" && !cleanSlot(unit.action, 180).startsWith("虽然")) {
        units[index] = {
          ...unit,
          action: `虽然${condition}，却${response}，${cleanSlot(unit.action, 180)}`,
          result: /没有争辩|不曾争辩/u.test(cleanSlot(unit.result, 180)) ? "" : unit.result,
        };
      }
    }
  }

  for (let index = 1; index < units.length; index += 1) {
    const current = units[index];
    const previous = units[index - 1];
    if (
      current.kind === "narration" &&
      current.frame === "reaction" &&
      /^(?:摇头|点头|叹气|皱眉)$/u.test(cleanSlot(current.action, 30)) &&
      previous?.kind === "speech" &&
      previous.speaker === current.actor &&
      new RegExp(`${escapePattern(current.actor || "")}[^。]{0,8}${escapePattern(current.action || "")}说`, "u").test(source)
    ) {
      units[index - 1] = current;
      units[index] = previous;
    }
  }

  for (let index = 0; index < units.length - 1; index += 1) {
    const current = units[index];
    const next = units[index + 1];
    if (
      current.kind === "narration" &&
      current.frame === "transition" &&
      cleanSlot(current.time, 80) &&
      ![
        current.actor,
        current.target,
        current.action,
        current.object,
        current.place,
        current.matter,
        current.result,
      ].some((value) => cleanSlot(value, 180)) &&
      next.kind === "narration" &&
      !cleanSlot(next.time, 80)
    ) {
      units[index + 1] = { ...next, time: cleanSlot(current.time, 80) };
      units.splice(index, 1);
      index -= 1;
    }
  }

  const proposedReflection = plan.reflection ?? legacyReflection;
  const inheritedReflection = inheritedResponsibilityReflection(source);
  const reflection = inheritedReflection ?? (proposedReflection && (
    proposedReflection === legacyReflection ||
    reflectionSemanticIssues(proposedReflection, source).length === 0
  )
    ? proposedReflection
    : undefined);
  return { ...plan, units, reflection };
}

export function assessScriptureStoryPlan(plan: ScriptureSkeletonPlan, source: string) {
  const sourceGenre = classifyScriptureSource(source);
  if (sourceGenre === "aphorism") {
    if (renderRecognizableSourceAphorism(source)) return [];
    const aphorismUnits = plan.units.filter(
      (unit) => unit.kind === "declaration" && ["general_rule", "contrast", "blessing"].includes(unit.intent),
    );
    const issues: string[] = [];
    if (aphorismUnits.length !== 1 || plan.units.length !== 1) {
      issues.push("短格言只能保留一个最合适的完整名句骨架，不得拼接多条解释");
    }
    for (const unit of aphorismUnits) {
      if (unit.kind !== "declaration" || unit.intent !== "general_rule") continue;
      if (!unit.elements.category || !unit.elements.result) {
        issues.push("格言必须提取清楚的行为与结果");
      } else if (!isGroundedStoryRule(unit.elements, source)) {
        issues.push("格言的行为或结果偏离输入，不得添加懒惰、贪婪、刑罚等原文没有的判断");
      }
    }
    return [...new Set(issues)];
  }
  if (sourceGenre !== "story") return [];
  if (!plan.reflection?.enabled) {
    return ["故事缺少结构化结尾判词：必须提交人物、行为、结果、语义关系和原文证据"];
  }
  return reflectionSemanticIssues(plan.reflection, source);
}

export type ScriptureStoryAssessment = {
  acceptable: boolean;
  score: number;
  issues: string[];
};

export function assessScriptureStoryResult(source: string, result: string): ScriptureStoryAssessment {
  if (classifyScriptureSource(source) !== "story") {
    return { acceptable: true, score: 1, issues: [] };
  }

  const issues: string[] = [];
  const normalizedResult = normalizeStoryFactText(result);
  const sourceTokens = storyContentTokens(source);
  const missingTokens = sourceTokens.filter(
    (token) => !normalizedResult.includes(normalizeStoryFactText(token)),
  );
  const coverage = sourceTokens.length
    ? (sourceTokens.length - missingTokens.length) / sourceTokens.length
    : 1;
  if (coverage < 0.58) {
    issues.push(`关键事实词覆盖不足，缺少：${missingTokens.slice(0, 10).join("、")}`);
  }

  for (const family of STORY_FACT_FAMILIES) {
    if (family.source.test(source) && !family.result.test(result)) {
      issues.push(`遗漏关键事实：${family.label}`);
    }
  }

  for (const name of extractStoryNames(source)) {
    if (!result.includes(name)) issues.push(`遗漏人物：${name}`);
  }

  for (const quotation of source.matchAll(/[“"]([^”"]{6,})[”"]/gu)) {
    const quoteTokens = storyContentTokens(quotation[1]);
    if (!quoteTokens.length) continue;
    const quoteCoverage = quoteTokens.filter((token) =>
      normalizedResult.includes(normalizeStoryFactText(token)),
    ).length / quoteTokens.length;
    if (quoteCoverage < 0.35) issues.push(`关键对白含义保留不足：${quotation[1].slice(0, 24)}`);
  }

  for (const term of UNSUPPORTED_STORY_MORALS) {
    if (result.includes(term) && !source.includes(term)) issues.push(`凭空加入评价或冲突：${term}`);
  }

  const giftRoles = extractGiftRoles(source);
  if (giftRoles.receiver) {
    const receiverGiving = new RegExp(
      `(?:(?<!对)${escapePattern(giftRoles.receiver)}(?:说|回答说)|${escapePattern(giftRoles.receiver)}对[^。]{0,12}说)[^。]{0,45}(?:给你|交给你|赠给你)`,
      "u",
    );
    if (receiverGiving.test(result)) issues.push(`礼物方向反转：${giftRoles.receiver}原是收礼者`);
  }

  if (/家门口中|邻里之间中|仍可本该|不可不要|不是不是/u.test(result)) {
    issues.push("存在明显病句或重复否定");
  }

  const uniqueIssues = [...new Set(issues)];
  const score = Math.max(0, coverage - uniqueIssues.length * 0.08);
  return {
    acceptable: coverage >= 0.58 && uniqueIssues.length === 0,
    score,
    issues: uniqueIssues,
  };
}

function isStandaloneAphorismPlan(plan: ScriptureSkeletonPlan, source = "") {
  const textType = cleanSlot(plan.textType, 60);
  const sourceGenre = source ? classifyScriptureSource(source) : null;
  const declarationOnly =
    plan.units.length > 0 &&
    plan.units.length <= 4 &&
    plan.units.every(
      (unit) =>
        unit.kind === "declaration" &&
        ["general_rule", "contrast", "question"].includes(unit.intent),
    );
  if (
    sourceGenre === "definition" ||
    sourceGenre === "notice" ||
    sourceGenre === "instruction" ||
    sourceGenre === "factual"
  ) {
    return false;
  }
  if (sourceGenre === "aphorism") return declarationOnly;
  if (
    /通知|公告|晓谕|条例|规则|清单|操作|技术|说明|定义|百科|知识|事实/u.test(
      textType,
    ) ||
    (source && isStrongDefinitionSource(source))
  ) {
    return false;
  }
  if (/格言|警句|箴言|感悟|寓言/u.test(textType)) return true;
  if (/观点|独白/u.test(textType)) return source ? isAphorismSource(source) : true;
  return (!source || isAphorismSource(source)) && declarationOnly;
}

function isAphorismFriendlyPlan(plan: ScriptureSkeletonPlan, source = "") {
  if (isStandaloneAphorismPlan(plan, source)) return true;
  return /故事|记事|片段|寓言|轶事/u.test(cleanSlot(plan.textType, 60));
}

function renderPlanClosure(plan: ScriptureSkeletonPlan, source = "") {
  if (isStandaloneAphorismPlan(plan, source)) return "";
  if (plan.reflection?.enabled) return "";
  const hasConflict = plan.units.some((unit) => {
    if (unit.kind === "speech") {
      return ["insult_challenge", "exit_threat", "coercion", "death_threat"].includes(
        unit.intent,
      );
    }
    if (unit.kind === "declaration") return false;
    return /扑|刺伤|捅|刀|鲜血|制住|不能上前|受伤|倒下/u.test(
      [unit.action, unit.object, unit.result, unit.matter].filter(Boolean).join("，"),
    );
  });
  if (/冲突|故事|片段/u.test(cleanSlot(plan.textType, 60)) || hasConflict) return "";
  const last = plan.units.at(-1);
  if (!last) return "";
  const textType = cleanSlot(plan.textType, 60);

  // A developed narrative already has its own ending in the final event. A stock
  // colophon makes an ordinary short story sound mechanically generated. Keep
  // factual closures for compact, result-only records such as a technical fix or
  // a single departure event.
  if (plan.units.length > 2 && /故事|记事|寓言|轶事/u.test(textType)) return "";

  if (/通知|公告|晓谕/u.test(textType)) return "所要晓谕的，就是这些。";
  if (/条例|规则|清单/u.test(textType)) return "所列的条例，就是这些。";

  if (last.kind === "narration") {
    const ending = [last.action, last.result, last.matter]
      .map((value) => cleanSlot(value, 180))
      .filter(Boolean)
      .join("；");
    if (/恢复|完成|完毕|办妥|成交|成功|成就|造齐|修好/u.test(ending)) {
      return "这事就这样成了。";
    }
    if (/离开|离去|回到|回去|带走|走了|受伤|倒下|捂住|制住|鲜血/u.test(ending)) {
      return "这事的结局，就是这样。";
    }
    return "所记的事，就是这些。";
  }

  const intent = last.intent;
  if (["command", "warning_pride", "general_rule", "rebuke"].includes(intent)) {
    return "所吩咐的话，就是这些。";
  }
  if (["promise", "guarantee", "agreement"].includes(intent)) {
    return "所立的话，就是这些。";
  }
  return "";
}

export function renderScriptureSkeletonPlan(
  plan: ScriptureSkeletonPlan,
  source = "",
  options: { includeReflection?: boolean } = {},
) {
  if (source && classifyScriptureSource(source) === "aphorism") {
    const recognizable = renderRecognizableSourceAphorism(source);
    if (recognizable) return recognizable;
  }
  plan = groundScriptureSkeletonPlan(plan, source);
  plan = dedupeHistoricalSpeech(condenseHistoricalOpening(repairHistoricalPlan(plan)));
  const renderedUnits: string[] = [];
  const speakerSeen = new Map<string, number>();
  const intentSeen = new Map<string, number>();
  const lastAddressee = new Map<string, string>();
  let previousUnit: ScriptureSkeletonUnit | null = null;
  const aphorismMode = isAphorismFriendlyPlan(plan, source);
  const storyAnchorMode =
    !isStandaloneAphorismPlan(plan, source) &&
    /故事|记事|片段|寓言|轶事/u.test(cleanSlot(plan.textType, 60));

  for (const unit of plan.units) {
    if (unit.kind === "narration") {
      renderedUnits.push(
        renderNarration(
          unit,
          previousUnit?.kind === "narration" ? previousUnit.frame : "",
          previousUnit?.kind === "narration" ? cleanSlot(previousUnit.actor, 50) : "",
          previousUnit?.kind === "speech" ? cleanSlot(previousUnit.addressee, 50) : "",
          previousUnit?.kind === "speech" ? cleanSlot(previousUnit.speaker, 50) : "",
        ),
      );
    } else if (unit.kind === "declaration") {
      renderedUnits.push(
        renderSpeech(unit.intent, unit.elements, { aphorismMode, storyAnchorMode }),
      );
    } else {
      const addressee = cleanSlot(unit.addressee, 50);
      const intentKey = `${unit.speaker}:${unit.intent}`;
      const body = renderSpeech(unit.intent, unit.elements, {
        speaker: unit.speaker,
        addressee,
        occurrence: intentSeen.get(intentKey) || 0,
        aphorismMode,
        storyAnchorMode,
      });
      const previousSpeech = previousUnit?.kind === "speech" ? previousUnit : null;

      if (
        previousSpeech &&
        canMergeConsecutiveSpeech(previousSpeech, unit) &&
        renderedUnits.length
      ) {
        renderedUnits[renderedUnits.length - 1] = renderedUnits[renderedUnits.length - 1].replace(
          /”$/u,
          `${body}”`,
        );
      } else if (
        previousUnit?.kind === "narration" &&
        cleanSlot(previousUnit.actor, 50) === unit.speaker &&
        ["action", "reaction", "transition"].includes(previousUnit.frame) &&
        renderedUnits.length
      ) {
        const delivery = embeddedDelivery(unit.delivery || "said", addressee);
        renderedUnits[renderedUnits.length - 1] = renderedUnits[renderedUnits.length - 1].replace(
          /。$/u,
          `，${delivery}：“${body}”`,
        );
      } else {
        const tag = speechTag(
          unit,
          previousSpeech,
          speakerSeen.get(unit.speaker) || 0,
          lastAddressee.get(unit.speaker) || "",
        );
        renderedUnits.push(`${tag}：“${body}”`);
      }

      speakerSeen.set(unit.speaker, (speakerSeen.get(unit.speaker) || 0) + 1);
      intentSeen.set(intentKey, (intentSeen.get(intentKey) || 0) + 1);
      if (addressee) lastAddressee.set(unit.speaker, addressee);
    }
    previousUnit = unit;
  }

  const closure = options.includeReflection === false
    ? ""
    : renderPlanClosure(plan, source);
  if (closure && !renderedUnits.at(-1)?.endsWith(closure)) renderedUnits.push(closure);

  const paragraphs: string[] = [];
  let current = "";
  for (const rendered of renderedUnits.filter(Boolean)) {
    if (current.length + rendered.length > 360 && current) {
      paragraphs.push(current);
      current = rendered;
    } else current += rendered;
  }
  if (current) paragraphs.push(current);
  const body = paragraphs.join("\n\n").trim();
  const isStory = source && classifyScriptureSource(source) === "story";
  const reflection = options.includeReflection === false
    ? ""
    : isStory && plan.reflection?.enabled
      ? renderStoryReflection(plan.reflection)
      : isStory && !/这事的结局，就是这样。$/u.test(body)
        ? renderNeutralStoryClosure()
        : "";
  return reflection ? `${body}\n\n${reflection}` : body;
}

type SkeletonPlanningLevel = "light" | "standard" | "grand";

function planningUnitRange(level: SkeletonPlanningLevel, sourceLength: number) {
  if (level === "light") return sourceLength >= 180 ? "6—12" : "1—6";
  if (level === "grand") {
    return sourceLength <= 120 ? "5—10" : sourceLength <= 400 ? "10—18" : "14—26";
  }
  return sourceLength <= 120 ? "3—8" : sourceLength <= 400 ? "7—14" : "10—20";
}

function planningLengthRule(level: SkeletonPlanningLevel, sourceLength: number) {
  if (level === "light") {
    return `本次选择短篇。压缩重复寒暄、礼节和说明，只保留事实主干、关键发言、决定性动作与结局。通常整理为 ${planningUnitRange(level, sourceLength)} 个 unit。`;
  }
  if (level === "grand") {
    return `本次选择长篇。不得发明事实，但要把原文已有的场景、动作、发言目的、条件、反应和结果拆得更完整，为渲染器提供扩写材料。通常整理为 ${planningUnitRange(level, sourceLength)} 个 unit。`;
  }
  return `本次选择适中篇幅。合并重复信息，保留主要层次、关键对白和完整结局。通常整理为 ${planningUnitRange(level, sourceLength)} 个 unit。`;
}

function compactNonStoryPlanningPrompt(
  source: string,
  genre: ReturnType<typeof classifyScriptureSource>,
  level: SkeletonPlanningLevel,
  previousIssues: string[],
) {
  const retryRule = previousIssues.length
    ? `\n上一版存在以下问题，只修正这些问题并重新输出完整 JSON：\n- ${previousIssues.slice(0, 6).join("\n- ")}\n`
    : "";
  const genreGuide =
    genre === "aphorism"
      ? `这是格言、观点或祝愿。只建立一个 declaration：一般判断使用 general_rule(category,result)，正反判断使用 contrast(rejected,asserted)，祝愿使用 blessing(subject,wish)。不得编人物故事，不得添加原文没有的福祸、惩罚或结果。`
      : genre === "notice"
        ? `这是通知。保留时间、对象、地点、条件和未完成状态；可使用 factual_statement、enumeration、request 或 command。不得写成众人已经执行。`
        : genre === "instruction"
          ? `这是操作要求或规则。保留步骤、先后、版本、条件与失败关系；可使用 command、enumeration、contrast 或 factual_statement。不得写成已经完成。`
          : `这是事实或短陈述。保持原文本功能；通常只使用 factual_statement，确有正反关系时才使用 contrast。不得添加行为报应或虚构结果。`;

  const compactLengthRule =
    level === "light"
      ? "本次选择短篇，只保留一个核心 unit。"
      : level === "grand"
        ? "本次选择长篇，可拆成二至五个平行 unit，但只能展开原文已有关系。"
        : "本次选择适中篇幅，使用一至三个 unit，保留主要层次。";
  return `你是和合本风格改写器的结构编辑。把输入整理成与原文文本类型相符的结构骨架，不写正文，不选择经文。只输出一个 JSON 对象，不得输出 Markdown。\n\n服务器预判类型：${genre}\n${genreGuide}\n${compactLengthRule}\n\nJSON 结构：\n{\n  "textType": "格言/祝愿/通知/操作说明/事实陈述",\n  "units": [\n    {"kind":"declaration","intent":"general_rule/contrast/blessing/factual_statement/enumeration/command/request","elements":{}}\n  ],\n  "reflection":{"enabled":false,"mode":"neutral","actor":"","behavior":"","outcome":"","relation":"neutral_record","polarity":"neutral","evidence":[]}\n}\n\n字段要求：\n- general_rule: category,result\n- contrast: rejected,asserted\n- blessing: subject,wish\n- factual_statement: subject,fact,more\n- enumeration: subject,items\n- command: action,prohibition\n- request: matter,action,deadline,result\n- elements 只放原文内容，不得填“若、必、不可、乃是、论到”等骨架词。\n- 数字、时间、否定、条件、现代术语和专名必须保留。\n- 短篇只保留一项核心表达；适中可有一至三项；长篇可拆成二至五项平行表达，但不得增加新事实。\n${retryRule}\n<输入>\n${source}\n</输入>`;
}

function relevantStoryIntentGuide(source: string) {
  const guides = new Set<string>([
    "introduction(count,names,relation)",
    "question(question,more)",
    "request(matter,action,deadline,result)",
    "refusal(matter,action,condition,advice)",
    "command(action,prohibition)",
    "promise(action)",
    "contrast(rejected,asserted)",
    "agreement(action)",
    "disagreement(matter)",
  ]);
  if (/欢迎|请进|里面请|等候|等了|坐|落座|入座/u.test(source)) {
    guides.add("welcome / waited_arrival / guide_inside(place) / invite_seat");
  }
  if (/礼物|客气|收下|推辞|小意思/u.test(source)) {
    guides.add("courtesy_gift(gift) / courtesy_refusal(relation)");
  }
  if (/名字|名叫|我叫|我是|介绍/u.test(source)) {
    guides.add("self_identification(name) / introduction(count,names,relation)");
  }
  if (/名声|名望|义气|情分|帮忙|有什么事/u.test(source)) {
    guides.add("reputation(qualities) / offer_help(recipientAction,action) / reassurance(basis)");
  }
  if (/为什么来|不只是|直说|挑明|有事/u.test(source)) {
    guides.add("infer_motive(surface,matter) / request_directness(matter)");
  }
  if (/兄弟|朋友|靠.+吃饭|情面|面子|传话/u.test(source)) {
    guides.add("mediation_request(beneficiary,action,result) / mutual_claim(theirs,mine) / relay_request(target,matter) / face_boundary(theirAction,myAction)");
  }
  if (/借钱|不是不还|暂借|辩解|有头有脸|孝敬/u.test(source)) {
    guides.add("self_defense(matter,rejected,asserted) / status_observation(supporters)");
  }
  if (/骂|无礼|什么东西|算什么|摆架子|住口/u.test(source)) {
    guides.add("insult_challenge(knownA,knownB,challenge) / rebuke(action,prohibition)");
  }
  if (/龙|虎|自高|气盛|年轻/u.test(source)) {
    guides.add("paired_dominance(categoryA,resultA,categoryB,resultB) / warning_pride(warning) / youth_defiance(person,quality)");
  }
  if (/走出|离开.*没完|答应也得|不答应也得|怎么走/u.test(source)) {
    guides.add("exit_threat(condition,consequence) / method_challenge(action) / coercion(positiveCondition,negativeCondition,result)");
  }
  if (/没人敢|从来没有人|弄死|杀死|夺取.*命/u.test(source)) {
    guides.add("boast(action) / death_threat(target)");
  }
  if (/保证|作保|若不|退款|吞下|惩罚/u.test(source)) {
    guides.add("guarantee(condition,penalty) / curse_penalty(condition,subject,penalty)");
  }
  if (/多少钱|价格|每斤|每个|元|块钱|付款|交付/u.test(source)) {
    guides.add("trade_price(item,unit,price)");
  }
  if (/祝|愿你|愿他/u.test(source)) guides.add("blessing(subject,wish)");
  return [...guides].map((item) => `- ${item}`).join("\n");
}

export function buildSkeletonIdentificationPrompt(
  source: string,
  previousIssues: string[] = [],
  level: SkeletonPlanningLevel = "standard",
) {
  const sourceLength = [...source.trim()].length;
  const detectedGenre = classifyScriptureSource(source);
  if (detectedGenre !== "story") {
    return compactNonStoryPlanningPrompt(source, detectedGenre, level, previousIssues);
  }
  const storyTemplatePrompt =
    detectedGenre === "story" ? buildCuvStoryTemplatePrompt(source) : "";
  const shortStoryRule =
    sourceLength >= 100 && sourceLength <= 200
      ? `\n20. 本次输入为 ${sourceLength} 字。若它是有人物与事件推进的短故事，先完整保留人物、物品、时间、目的、赠与或借贷方向、动作结果和结局，再填写顶层 reflection。reflection.behavior 必须是故事中最值得评价的具体行为或选择，outcome 必须是原文已经发生的直接结果；evidence 必须逐字摘录一至三段原文，不得改写。不得为了凑名句删去疾病、药物、钱财、地点、去向、感谢、伤害对象等事实，也不得把赠送者与收受者调换。若某种评价只能靠“过错、纷争、报应、审判、刑罚”等原文没有的概念成立，就改用 neutral_record，不得硬套。每个源句至少要有一个 unit 承载其中未重复的关键事实。可补入一个不改变因果的场面过渡，但不得增加新动机、新冲突或新结局。开场从简，判词固定由服务器放在结尾。`
      : "";
  const retryRule = previousIssues.length
    ? `\n上一次结构方案未通过服务器事实审查，必须逐项修正：\n- ${previousIssues.slice(0, 10).join("\n- ")}\n不要解释，只重新输出完整 JSON。\n`
    : "";
  return `把输入整理成与原文文本类型相符的结构骨架，不写正文，也不要选择圣经句子。服务器会按照文本功能决定固定骨架，再机械填入元素。

本次输入已由服务器预判为“${detectedGenre}”。定义、知识、事实、通知和操作说明必须保留原有文本功能，不得改造成故事、格言、祝福、咒诅或行为报应。只有真正的人物故事才围绕情节主干重组；故事中的寒暄、礼让、重复称呼和相近对白可以合并、压缩、调序或改成叙述。

对于人物故事，这不是逐句翻译或影视台词校对；只锁定人物阵营、核心冲突、关键因果、决定局势的发言、动作归属、伤害对象与结局。

${storyTemplatePrompt}

${planningLengthRule(level, sourceLength)}

只输出以下 JSON：
{
  "textType": "记事/格言/定义/知识说明/事实陈述/通知/独白/条例等",
  "units": [
    {"kind":"narration","frame":"arrival/action/reaction/indirect_speech/introduction/transition/outcome/setting","actor":"","target":"","action":"不含主语的完整动作短语","object":"","place":"","time":"","matter":"","result":""},
    {"kind":"speech","intent":"对白功能","speaker":"","addressee":"","delivery":"said/answered/asked/warned/commanded/cried","elements":{"元素名":"来自输入的短语"}},
    {"kind":"declaration","intent":"对白功能","elements":{"元素名":"来自输入的短语"}}
  ],
  "reflection": {
    "enabled": true,
    "mode": "commend/admonish/warn/lament/neutral",
    "actor": "被评价的人物",
    "behavior": "原文支持的具体行为或选择",
    "outcome": "原文已经发生的直接结果",
    "relation": "parallel/value_comparison/effort_harvest/cause_result/character_fruit/self_exaltation/care_for_others/small_faithfulness/anger_warning/time_and_season/speech_truth/loss_and_gain/inherited_responsibility/neutral_record",
    "polarity": "positive/negative/mixed/neutral",
    "evidence": ["逐字摘录的原文片段"]
  }
}

JSON 要紧凑：每个 unit 只输出 kind、frame/intent 与实际用到的非空字段；不要重复输出空字符串字段。reflection 字段必须完整。

本次输入只允许从以下相关对白功能中选择；找不到专用功能时使用 request/refusal/command/promise/question/contrast/agreement/disagreement：
${relevantStoryIntentGuide(source)}

硬规则：
1. 必须保留人物、阵营、核心交易或借贷方向、决定冲突的条件、动作执行者、承受者、伤害对象和结局。次要数字、寒暄次序、礼让轮次和场面小动作不必逐项复刻；可按“到场—坐席—提出请求—双方争辩—冲突升级—结局”重新编排。
2. 不准输出 frame 形式的对白骨架编号，不准写圣经体正文，不准把“若、必、不可、乃是”等风格词填进 elements。
3. 不要给原文每一句对白都建立 speech。全篇严格控制在 ${planningUnitRange(level, sourceLength)} 个 unit 左右；连续寒暄最多保留一个 welcome 或 guide_inside，落座最多一个 invite_seat，重复客气最多保留 courtesy_gift 与 courtesy_refusal 各一个。只有改变局势的请求、拒绝、辩护、警告、威胁、强迫和关键反问必须保留为 speech；其余内容合并成 narration 或删去重复。
4. elements 只填骨架尚未包含的名词或谓语核心，绝不填整句或半句原台词，也不重复骨架虚词。例如 offer_help.recipientAction 只填“回去照顾病人”，offer_help.action 只填“把东西送到楼上”；exit_threat.condition 只填“这样离开房间”，不可填“你今日若这样走出房子”；boast.action 只填“这样对我说话”，不可填“我长到这么大还没有人敢这样说话”。
5. introduction.count 只填“一、两、三”等数词，不填“个、人、个人”；names 只填姓名；relation 只填“我的兄弟、同伴、同事”等关系。死亡威胁的 target 只填被威胁者，不填“你的命”或“弄死”。
6. narration.action 填不含主语、但包含对象和去向的完整动作短语，例如“从手中取出文件，摆在负责人面前”；不得只填“叫了一声”，必须填“叫目标人物的名字”。
7. 同一动作只建立一个 unit；result 只填动作之外的新后果，不得把“甲刺伤乙”再配上“乙受伤”，也不得把“甲制住乙”再配上“乙被制住”。
8. 找不到精确功能时，选择最接近的 request/refusal/command/promise/question/contrast/general_rule/agreement/disagreement；“心里踏实”使用 reassurance，“痛快、喜欢这种脾气”使用 approval，不得使用 agreement。以“祝、愿、愿你、祝你”表达祝愿的短句使用 blessing(subject,wish)，不得当成事实说明。
9. delivery=answered 只用于直接回答上一人的问题或主张；普通接续使用 said，质问使用 asked，威胁喊叫使用 cried。龙虎等两个并列类别必须使用 paired_dominance，不得塞入 general_rule。
10. 凡“扑、刺伤、制住、交给、带走、叫名字”等及物动作，action 必须包含承受者；例如“用工具损伤乙”，不可只填“用工具损伤”。mediation_request.result 只能填真实目的，不得只填受益人的姓名。
11. mediation_request 专用于“甲请求乙为了丙而停止、允许或改变某事”，speaker 必须是甲，addressee 必须是乙，beneficiary 必须是丙；relay_request 只用于“甲叫乙传话给丙，让丙亲自来找甲”。二者不可混用。借钱关系必须明确谁向谁借、是否承诺归还。
12. 单独呼喊一个人的名字只是叫住、示意或使其停步，不是 welcome；应写成 action/reaction，或与紧接着的 warning、command 合并。不得因一句称呼让人物重新邀请对方坐席。
13. 每一个保留的 speech 都只填一个清楚的发言功能；可以改变表面说法以适配固定圣经骨架，但不得把劝诫交给辩护者、把拒绝者写成应允者、把威胁者和被威胁者调换。
14. 只有原文确实对行为、品格、选择与后果作普遍判断时，才把没有对白的短文写成“格言”或“观点”，并使用 general_rule(category,result) 或 contrast(rejected,asserted)。不能因为输入只有一句话就判定为格言。category 只填最核心的行为、品格或处境，result 只填原文已有的后果，不得把“凡、必、有福、乃是”等骨架词塞入元素。
15. 格言必须保持原文的褒贬和因果方向：值得鼓励的行为配正面结果，应当禁止的行为配负面后果；不得把“不离开朋友、诚实、忍耐”等善行整理成应当禁止之事，也不得把“贪图捷径、欺骗、骄傲”等恶行整理成应当持守之事。category 与 result 都要写成独立、明确、没有双重否定的短语。格言最终应像一节真实经文：短促、完整、通常只有一至两个分句；只靠拢一个最合适的著名句式，不得把几处经文拼成解释段落。
16. 每一篇人物故事都必须填写且只填写一个顶层 reflection；故事的 units 中不得再建立 general_rule。AI 只提取语义，不得选择、拼接或仿写经文。actor 填被评价的人物；behavior 填原文中的具体行为；outcome 填原文已经发生的直接结果；relation 只描述二者的逻辑形状；evidence 必须逐字复制原文一至三处。先比较全篇关键转折，只选最能概括主旨的一项。出现钱不等于贪财，出现争执不等于骄傲，失败不等于懒惰，收礼不等于贪婪，拒绝危险要求不等于悖逆，受害者不可被判为有错；原文没有结果时不得写“必得、必败、必受报应”。若故事明确讨论家族、祖先或父辈的罪责是否应由无辜孩子、儿女或后代承担，使用 inherited_responsibility；不可只因出现亲属关系便使用。若没有安全、明确的寓意，mode、relation、polarity 分别填 neutral、neutral_record、neutral，并只概括真实经过。非故事输入一律填写 enabled:false，其他字段留空。
    relation 必须按逻辑而非关键词选择：长期劳苦、坚持或反复作工才用 effort_harvest；帮助、照顾、扶持他人才用 care_for_others；诚实、守信、归还、拒收酬谢而得到称赞可用 value_comparison 或 small_faithfulness；明确自高才用 self_exaltation；明确发怒、威胁、伤害才用 anger_warning；言语真伪才用 speech_truth；舍弃与所得才用 loss_and_gain；日期、期限和等待才用 time_and_season；家族旧罪与无辜后代是否应彼此担当才用 inherited_responsibility；普通行为导致实际结果优先用 cause_result，不能为了套名句夸大行为。
17. 定义句和知识说明若出现“是、指、称为、以……为……、由……组成、包括、属于、用于、标准、规范”等结构，textType 必须写“定义”或“知识说明”，并使用 definition(subject,name,details) 或 factual_statement(subject,fact,more)。details 必须保留“以甲为乙”等关系及被定义名称，不得使用 general_rule，也不得添加“有福、有祸、凡、必、刑罚、审判”。
18. 只输出 JSON，不输出 Markdown。
19. 帮助类对白必须把双方动作拆清：recipientAction 填受帮助者先去做的事，action 填说话者答应代办的事。例如“你先照顾病人，我替你送东西”应分别填“回去照顾病人”和“把东西送到指定地方”，不得压缩成空泛的“有什么事只管说”。礼物情节必须确认谁带来、谁收下；“甲带礼物来，乙只收一件”中，courtesy_gift 的 speaker 只能是甲，乙的收取应写 narration，不得让乙说“我把礼物给你”。间接说明疾病、送药、欠款、目的和原因时，使用 indirect_speech.matter 完整保留这些关系。
    带期限的要求使用 request，并把理由填入 matter、期限填入 deadline、所要求的动作填入 action；例如“预算仍然太高，下午以前再改一版”必须三项全部保留，不得只剩“再改一版”。
    一句话同时包含“我不接受某物”和“你若处在某种情况，就去做另一件事”时，可使用 refusal：matter 填拒收之物，action 填“收下/接受”等被拒绝动作，condition 填“你若”之后的条件，advice 填对方应做的事；服务器会把拒绝与劝告分成两个圣经体分句，不得写成“我断不回去”。
${shortStoryRule}
${retryRule}

<输入>
${source}
</输入>`;
}
