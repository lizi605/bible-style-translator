export type CuvLexiconEntry = {
  id: string;
  label: string;
  triggers: RegExp;
  unrecast?: RegExp;
  instructions: readonly string[];
  example?: string;
};

export const CUV_SCENE_LEXICON: readonly CuvLexiconEntry[] = [
  {
    id: "historical-time",
    label: "世纪、年代与历史时间",
    triggers: /中世纪|(?:第?[一二三四五六七八九十百千万0-9]+)世纪|二十世纪|近现代|现代早期|古代/u,
    unrecast: /中世纪|(?:第?[一二三四五六七八九十百千万0-9]+)世纪|近现代|现代早期/u,
    instructions: [
      "历史事实不得模糊删除；要把现代年代名改成经卷式计时。例如‘二十世纪’写成‘世代相传，及至第二十个百年’，不可笼统缩成‘近世’。",
      "‘中世纪英格兰’可写成‘古时，在英格兰地’；若具体世纪影响情节，就保留数字，写成‘及至第十五个百年’一类计时。",
    ],
    example: "这事世代相传，及至第二十个百年，仍未止息。",
  },
  {
    id: "modern-settlement",
    label: "现代国家、城市与行政地名",
    triggers: /英格兰|市|城市|国家|地区|省|自治区|县|区/u,
    unrecast: /中世纪(?:的)?英格兰|[\p{Script=Han}A-Za-z·]{2,24}市(?!场)|这座城市|这个国家|该地区/u,
    instructions: [
      "专有地名必须保留，但用圣经式同位称谓包裹：‘英格兰地’、‘艾因赫文城’、‘在西方之地，就是人所称为英格兰的’。",
      "不得把现代地点擅自换成耶路撒冷、犹大、迦南等真实圣经地名；改的是称谓和句法，不是故事发生地。",
    ],
    example: "她往艾因赫文城去，就在那里住下。",
  },
  {
    id: "lineage-household",
    label: "家族、成员与血缘组织",
    triggers: /家族|家族成员|族人|血统|姓氏|祖先|后代/u,
    unrecast: /家族成员|这个家族|该家族|家族的人/u,
    instructions: [
      "按关系改称‘宗族、本族的人、父家、列祖、后裔’；不要反复使用现代设定说明中的‘家族成员’。",
      "姓氏仍须保留，可写成‘论到【姓氏】这名，其中另有隐情’或‘【姓氏】家本出于……’。",
    ],
    example: "本族的人世代行这事；他们的列祖也曾如此行。",
  },
  {
    id: "modern-exposition",
    label: "现代心理分析与百科说明",
    triggers: /心理|性格|阴霾|阻碍|信任感|真实性|生活状态|成长|内敛|不爱说话|假装/u,
    unrecast: /这种性格|心理|阴霾|成长的阻碍|信任感|真实性|生活状态|性情内敛|不爱说话|假装一切/u,
    instructions: [
      "不要解释人物的心理机制；要用动作、反应和结果显明。例如‘无法接受死亡’写成‘不肯受安慰’，‘性情内敛，不爱说话’写成‘性情羞涩，口中的言语也少’。",
      "‘信任感、真实性、心理阴影、成长阻碍’等抽象名词必须拆成‘心里信他、这话并非虚言、心中愁苦、脚步受阻’一类旧译白话关系句。",
    ],
    example: "他不肯受安慰，仍照往日所行的去行。",
  },
  {
    id: "modern-venue",
    label: "酒吧与现代经营场所",
    triggers: /酒吧|咖啡馆|俱乐部|营业厅|工作室/u,
    unrecast: /酒吧|咖啡馆|俱乐部|营业厅|工作室/u,
    instructions: [
      "普通场所用功能描述，不用古典小说词：‘酒吧’写成‘卖酒的屋’，‘咖啡馆’写成‘卖咖啡的屋’；品牌或专有店名仍须保留。",
      "经营行为写成‘看守、料理、在其中作工、以此养生’，不可凭空改成客店、圣殿或筵席。",
    ],
    example: "他独自看守一间卖酒的屋，以此养生。",
  },
  {
    id: "jewelry-object",
    label: "首饰、项链与宝石器物",
    triggers: /项链|吊坠|首饰|珠宝/u,
    unrecast: /宝石项链|珠宝项链|一串项链/u,
    instructions: [
      "保留材质与关键功能，把‘宝石项链’写成‘一串镶着宝石的链子’或‘那宝石的链子’，不要泛化成不明器物。",
      "器物的归属和转交使用‘交在手中、从手中取去、带在身旁’。",
    ],
    example: "恶魔把一串镶着宝石的链子交在他们手中。",
  },
  {
    id: "gesture-signal",
    label: "眼神、示意与无声命令",
    triggers: /示意|使眼色|递眼色|眼神|点头|摆手/u,
    unrecast: /示意|使眼色|递眼色/u,
    instructions: [
      "不要原样写‘示意’；紧凑改写为‘转眼看【人物】’或‘以目吩咐【人物】’。",
      "无声命令只换表达，不解释过程；不得连续补写看见、明白、照着去行。",
    ],
    example: "刘华强便转眼看大海；大海就照他的意思行了。",
  },
  {
    id: "gift-placement",
    label: "礼物、物件与摆放",
    triggers: /礼物|礼品|东西|包裹|放下|摆下|放在|摆在/u,
    unrecast: /(?:放在|放到|摆在|搁在|陈在).{0,16}桌上|礼物.{0,10}放(?:在|到)/u,
    instructions: [
      "‘把东西放下’优先写成‘把从手中所带来的取出，摆在【人物】面前／陈在席前’。",
      "礼物可写成‘所带来的礼物’；动作使用‘取出、交在手中、摆在面前’，不要只用现代口语‘放桌上’。",
    ],
    example:
      "大海就把从手中所带来的礼物取出，摆在众人面前。",
  },
  {
    id: "table-banquet",
    label: "桌子、酒桌与席面",
    triggers: /桌上|桌子|饭桌|酒桌|餐桌|席位|座位/u,
    unrecast: /桌上|桌子上|饭桌|酒桌|餐桌/u,
    instructions: [
      "叙事中的‘桌上／酒桌前’按场景改为‘席上、席前、筵席之间、众人面前’。",
      "只有必须强调现代家具时才保留‘桌子’，否则优先描述人在席上的关系。",
    ],
    example: "众人在席上坐定，那礼物已经摆在他们面前。",
  },
  {
    id: "restaurant-room",
    label: "饭店、雅间与室内场所",
    triggers: /饭店|餐厅|酒店|雅间|包间|房间|屋子|屋里/u,
    unrecast: /雅间|包间/u,
    instructions: [
      "普通现代场地名直接换成和合本式空间关系：‘摆设筵席的屋里、坐席的地方、那屋里’；不要把同义的现代场地名叠加在前面。",
      "‘进入房间’写成‘进了那屋／被领到屋里／来到坐席的地方’。",
    ],
    example: "他们进了那摆设筵席的屋里，众人便在那里坐席。",
  },
  {
    id: "sitting-standing",
    label: "坐下、起身与席间动作",
    triggers: /坐下|落座|坐着|站起来|起身|离席/u,
    unrecast: /坐下|站起来/u,
    instructions: [
      "‘坐下’优先写成‘坐席、在席上坐定’；‘站起来’写成‘从席上起来、起身离席’。",
      "动作前后加‘于是、及至、听见这话’等记事推进，不要孤零零地换古词。",
    ],
    example: "及至众人坐席，振涛听见这话，就从席上起来。",
  },
  {
    id: "hand-transfer",
    label: "拿出、递交与持有",
    triggers: /拿出|取出|掏出|递给|交给|接过|拿着|带着/u,
    unrecast: /拿出|递给|交给|接过/u,
    instructions: [
      "使用‘从怀中取出、从手中拿来、交在【人物】手中、从【人物】手中接过’。",
      "器物必须与手、怀中、面前等关系位置一同表达。",
    ],
    example: "他从怀中取出那物，交在同伴手中。",
  },
  {
    id: "seeing-facing",
    label: "看、注视与面对",
    triggers: /看见|看到|看着|盯着|望着|转头看|回头看/u,
    unrecast: /盯着|看着他的眼睛/u,
    instructions: [
      "按力度使用‘看见这事、定睛看、举目观看、转脸向着、在【人物】眼前’。",
      "视觉动作应引出人物的回答、惧怕、发怒或行动，而不是只作镜头说明。",
    ],
    example: "刘华强便定睛看振涛，转脸向着他说。",
  },
  {
    id: "movement-threshold",
    label: "进入、离开与门前",
    triggers: /走进|进去|进门|走出|出去|门口|门外|离开/u,
    unrecast: /走进|门口/u,
    instructions: [
      "‘走进’写成‘进了那屋／来到众人中间’；‘门口’写成‘门前’；离开写成‘起身离开，往所要去的地方去’。",
      "若门槛关系参与威胁，可使用‘你若出了这门，就……’的条件句。",
    ],
    example: "他们进了那屋；这事以后，又从门前离开，往街市上去。",
  },
  {
    id: "street-place",
    label: "街道与公共场所",
    triggers: /街道|街上|市场|商场|广场|大路/u,
    unrecast: /街道/u,
    instructions: [
      "按场景使用‘街市、街上、大路上、城门前的空场’；现代地点名仍须保留。",
    ],
    example: "他们出了门，往街市上去。",
  },
  {
    id: "money-commerce",
    label: "钱财、价格与交易",
    triggers: /钱|块钱|元|价格|借钱|还钱|付款|生意|买卖|交易/u,
    instructions: [
      "在保留准确数字、币种和借贷方向的前提下，使用‘钱财、银钱、从【人物】手中借、交付、作买卖、所得的’。",
      "现代金额不可泛化成金银；数字和单位必须原样保留。",
    ],
    example: "论到这二十元，他是从那人手中借来周转的，并非不肯偿还。",
  },
  {
    id: "food-drink",
    label: "吃饭、饮酒与举杯",
    triggers: /吃饭|喝酒|酒杯|举杯|饭菜|上菜|宴请/u,
    instructions: [
      "使用‘坐席吃饭、设摆筵席、拿起杯来、席上的食物、吃了喝了’等关系式表达。",
    ],
    example: "众人坐席吃饭；宋老虎拿起杯来，向刘华强说话。",
  },
  {
    id: "speech-command",
    label: "招呼、制止与吩咐",
    triggers: /招呼|制止|阻止|命令|吩咐|叫他|让他|劝他/u,
    instructions: [
      "‘招呼’可改成‘请众人坐席’的间接叙述；‘制止’写成‘止住他的口、拦阻他、吩咐他不可再说’。",
      "若保留直接对白，仍须套用著名句式，不可只说‘不可无礼’。",
    ],
    example: "宋老虎便止住振涛的口，吩咐他不可再以辱骂待客。",
  },
] as const;

export function selectCuvLexiconEntries(text: string, limit = 12) {
  return CUV_SCENE_LEXICON.filter((entry) => entry.triggers.test(text)).slice(
    0,
    limit,
  );
}

export function buildCuvLexiconPrompt(text: string) {
  const entries = selectCuvLexiconEntries(text);
  if (!entries.length) return "";

  const tasks = entries
    .map(
      (entry, index) => `${index + 1}. 【${entry.label}】
${entry.instructions.map((item) => `   - ${item}`).join("\n")}
${entry.example ? `   - 示范：${entry.example}` : ""}`,
    )
    .join("\n");

  return `本篇还必须执行“场景元素圣经化”。不要只改对白；动作、器物、场所和人物相对位置也要使用和合本式表达。以下任务是根据输入语义动态选出的：
${tasks}

执行规则：
- 这些是语义表达模板，不是机械替换。先判断谁对谁做什么，再换成“手中、面前、席上、屋里、门前、街市、坐席、摆设筵席”等关系表达。
- 现代专名、准确金额、品牌和关键物品仍可保留；但周围的动作、位置和叙述关系必须刻意圣经化。
- 场景圣经化的目标是替换措辞，不是解释动作或增添情节。一个简单动作最多对应一个新分句，同一动作不得从多个角度复述。
- 不得反复写“看见、明白、照着去行、事情成就”；短输入通常只扩成一至两句。
- 不得为了表达场地同时保留现代场地名和圣经化同义场地；例如“雅间”可换成“摆设筵席的屋里”，不可写成“饭店中摆设筵席的屋里”。
- 不得只在开头使用一次；相关元素每次出现时都应保持同一文体。`;
}

export function findUnrecastCuvLexiconItems(source: string, output: string) {
  return CUV_SCENE_LEXICON.filter(
    (entry) =>
      entry.unrecast && entry.triggers.test(source) && entry.unrecast.test(output),
  ).map((entry) => `“${entry.label}”仍保留现代直述`);
}

export function normalizeCuvSceneLexicon(source: string, value: string) {
  let result = value;

  if (/示意|使眼色|递眼色|眼神|点头|摆手/u.test(source)) {
    result = result
      .replace(/(?:用|以)?眼神示意/gu, "以目吩咐")
      .replace(/示意/gu, "吩咐")
      .replace(/使眼色|递眼色/gu, "转眼观看");
  }
  if (/桌上|桌子|饭桌|酒桌|餐桌|席位|座位/u.test(source)) {
    result = result
      .replace(/(?:那)?筵席的桌上/gu, "那筵席之前")
      .replace(/桌子上|桌上/gu, "席前")
      .replace(/饭桌|酒桌|餐桌/gu, "筵席");
  }
  if (/饭店|餐厅|酒店|雅间|包间|房间|屋子|屋里/u.test(source)) {
    result = result
      .replace(/(?:那)?饭店中摆设筵席的屋里/gu, "那摆设筵席的屋里")
      .replace(/(?:那)?摆设筵席的屋里的席前/gu, "席前")
      .replace(/雅间|包间/gu, "摆设筵席的屋里");
  }
  if (/坐下|落座|坐着|站起来|起身|离席/u.test(source)) {
    result = result
      .replace(/坐下/gu, "坐席")
      .replace(/站起来/gu, "从席上起来");
  }
  if (/拿出|取出|掏出|递给|交给|接过|拿着|带着/u.test(source)) {
    result = result.replace(/拿出|掏出/gu, "取出");
  }
  if (/走进|进去|进门|走出|出去|门口|门外|离开/u.test(source)) {
    result = result.replace(/走进/gu, "进了").replace(/门口/gu, "门前");
  }
  if (/街道|街上|市场|商场|广场|大路/u.test(source)) {
    result = result.replace(/街道/gu, "街市");
  }

  return result.replace(/\n{3,}/gu, "\n\n").trim();
}
