"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  BookOpen,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  buildCardDownloadFilename,
  wrapMeasuredCardText,
} from "@/lib/cardDownload";
import packageInfo from "@/package.json";
import {
  formatScriptureVerses,
  type ScriptureVerse,
} from "@/lib/scriptureVerses";
import type {
  PlainMode,
  ScriptureDirection,
  ScriptureEdition,
  ScriptureLevel,
} from "@/lib/prompt";

const API_KEY_STORAGE_KEY = "bible-style-deepseek-api-key";
const API_MODEL_STORAGE_KEY = "bible-style-api-model";
const CLIENT_ID_STORAGE_KEY = "bible-style-client-id";

const directions: Array<{
  id: ScriptureDirection;
  title: string;
  description: string;
}> = [
  {
    id: "to_scripture",
    title: "白话成章",
    description: "改写为和合本、思高译腔或 KJV 英文",
  },
  {
    id: "to_plain",
    title: "古意还白",
    description: "把圣经译腔翻回自然人话",
  },
];

const editions: Array<{
  id: ScriptureEdition;
  title: string;
  description: string;
}> = [
  { id: "cuv", title: "和合本译腔", description: "旧译白话，复沓庄严" },
  { id: "sigao", title: "思高译腔", description: "欧化句法，天主教传统词感" },
  { id: "kjv", title: "KJV English", description: "King James cadence in English" },
];

const plainModes: Array<{
  id: PlainMode;
  title: string;
  description: string;
}> = [
  { id: "direct", title: "直白释义", description: "一句话说清，不加戏。" },
  { id: "explain", title: "耐心讲明", description: "补足古雅句法省略的关系。" },
  { id: "subtext", title: "潜台词版", description: "翻出有依据的诉求与顾虑。" },
  { id: "roast", title: "锐评拆穿", description: "克制地指出已有话术与矛盾。" },
];

const levels: Array<{
  id: ScriptureLevel;
  title: string;
  plainTitle: string;
  description: string;
}> = [
  { id: "light", title: "简章", plainTitle: "略释", description: "提取主干，压缩成章" },
  { id: "standard", title: "成篇", plainTitle: "明释", description: "保留层次，篇幅相近" },
  { id: "grand", title: "长卷", plainTitle: "详释", description: "扩展场景、复沓与评语" },
];

const examples = [
  "我今天真的不想上班，只想在家躺一天。",
  "通知：明天下午三点开项目会，请大家带上最新方案，提前十分钟到会议室。",
  "这款充电宝支持65W快充，容量20000mAh，活动价199元，数量有限。",
  "小周把方案交给主管，主管看完说：“方向没问题，但预算太高，明天重新做一版。”小周答应以后便回到座位修改。",
];

const plainExamples = [
  "弟兄们，我愿你们明白：人若只顾言语温柔，却使所传的消息模糊，这温柔于众人有什么益处呢？",
  "懒惰人说，明日必归还；及至明日，他又以忙碌遮掩自己。守约的言语虽少，却使人心安。",
];

const loadingLines = [
  "正在辨明文案的形态与原意……",
  "正在选择合宜的旧译句法……",
  "正在校订言语，不使事实走样……",
];

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getClientId() {
  const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (stored) return stored;
  const next = createClientId();
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, next);
  return next;
}

function getExamplePreview(value: string) {
  return value.length > 28 ? `${value.slice(0, 28)}……` : value;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  return wrapMeasuredCardText(
    text,
    maxWidth,
    (value) => context.measureText(value).width,
  );
}

export default function Home() {
  const [direction, setDirection] =
    useState<ScriptureDirection>("to_scripture");
  const [plainMode, setPlainMode] = useState<PlainMode>("direct");
  const [edition, setEdition] = useState<ScriptureEdition>("cuv");
  const [level, setLevel] = useState<ScriptureLevel>("standard");
  const [text, setText] = useState("");
  const [result, setResult] = useState("");
  const [verses, setVerses] = useState<ScriptureVerse[]>([]);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [variation, setVariation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [skillCopied, setSkillCopied] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [draftApiKey, setDraftApiKey] = useState("");
  const [apiModel, setApiModel] = useState("");
  const [draftApiModel, setDraftApiModel] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const isPlainDirection = direction === "to_plain";
  const inputLimit = isPlainDirection ? 3000 : 1500;
  const selectedPlainMode =
    plainModes.find((item) => item.id === plainMode) ?? plainModes[0];
  const selectedLevel = levels.find((item) => item.id === level) ?? levels[1];
  const selectedEdition = editions.find((item) => item.id === edition) ?? editions[0];
  const currentExamples = isPlainDirection ? plainExamples : examples;

  const inputLabel = isPlainDirection ? "文体文本" : "现代白话";
  const outputLabel = isPlainDirection
    ? "现代释义"
    : edition === "kjv"
      ? "KJV-style English"
      : "原文成章";

  const canSubmit = text.trim().length > 0 && !isLoading;

  const resultMeta = useMemo(
    () =>
      isPlainDirection
        ? `${selectedPlainMode.title} · ${selectedLevel.plainTitle}`
        : `${selectedEdition.title} · ${selectedLevel.title}`,
    [isPlainDirection, selectedEdition, selectedLevel, selectedPlainMode],
  );
  const shareResult = useMemo(
    () =>
      !isPlainDirection && verses.length
        ? formatScriptureVerses(verses)
        : result,
    [isPlainDirection, result, verses],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || "";
    const storedModel = window.localStorage.getItem(API_MODEL_STORAGE_KEY)?.trim() || "";
    setApiKey(stored);
    setDraftApiKey(stored);
    setApiModel(storedModel);
    setDraftApiModel(storedModel);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingLines.length);
    }, 1600);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  function switchDirection(nextDirection: ScriptureDirection) {
    if (nextDirection === direction) return;
    setDirection(nextDirection);
    setText("");
    setResult("");
    setVerses([]);
    setError("");
    setWarning("");
    setVariation(0);
  }

  function switchEdition(nextEdition: ScriptureEdition) {
    if (nextEdition === edition) return;
    setEdition(nextEdition);
    setResult("");
    setVerses([]);
    setError("");
    setWarning("");
    setVariation(0);
  }

  function openKeyModal() {
    setDraftApiKey(apiKey);
    setDraftApiModel(apiModel);
    setShowApiKey(false);
    setIsKeyModalOpen(true);
  }

  function saveApiKey() {
    const next = draftApiKey.trim();
    if (!next) {
      setError("请输入模型 API Key。");
      return;
    }
    const nextModel = draftApiModel.trim();
    if (nextModel && !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/u.test(nextModel)) {
      setError("模型名称格式无效。");
      return;
    }
    window.localStorage.setItem(API_KEY_STORAGE_KEY, next);
    if (nextModel) window.localStorage.setItem(API_MODEL_STORAGE_KEY, nextModel);
    else window.localStorage.removeItem(API_MODEL_STORAGE_KEY);
    setApiKey(next);
    setApiModel(nextModel);
    setError("");
    setIsKeyModalOpen(false);
  }

  function clearApiKey() {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    window.localStorage.removeItem(API_MODEL_STORAGE_KEY);
    setApiKey("");
    setDraftApiKey("");
    setApiModel("");
    setDraftApiModel("");
    setIsKeyModalOpen(false);
    setError("本机保存的 API Key 已清除。");
  }

  async function submit(regenerate = false) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    if (!apiKey) {
      setError("");
      openKeyModal();
      return;
    }
    if (trimmed.length > inputLimit) {
      setError(`当前方向最多输入 ${inputLimit} 字。`);
      return;
    }

    setIsLoading(true);
    setLoadingIndex(0);
    setError("");
    setWarning("");
    setResult("");
    setVerses([]);
    setCopied(false);
    const nextVariation = regenerate ? variation + 1 : variation;
    if (regenerate) setVariation(nextVariation);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Client-Id": getClientId(),
        },
        body: JSON.stringify({
          text: trimmed,
          direction,
          mode: "original",
          plainMode,
          level,
          edition,
          model: apiModel || undefined,
          variation: nextVariation,
        }),
      });
      const payload = (await response.json()) as {
        result?: string;
        verses?: ScriptureVerse[];
        warning?: string;
        generationMode?: string;
        error?: string;
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "转换失败，请稍后再试。");
      }
      setResult(payload.result);
      setVerses(isPlainDirection ? [] : payload.verses || []);
      setWarning(payload.warning || "");
      window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (requestError) {
      setResult("");
      setVerses([]);
      setWarning("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "网络连接失败，请稍后再试。",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(shareResult);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copySkill() {
    try {
      const response = await fetch("/downloads/speak-scripture-SKILL.md");
      if (!response.ok) throw new Error();
      await navigator.clipboard.writeText(await response.text());
      setSkillCopied(true);
      window.setTimeout(() => setSkillCopied(false), 1800);
    } catch {
      setError("Skill 文档暂时无法复制，请直接下载 ZIP。 ");
    }
  }

  async function downloadCard() {
    if (!result) return;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;

    const width = 1200;
    context.font = '34px "Noto Serif SC", "Songti SC", serif';
    const lines = wrapCanvasText(context, shareResult, 940);
    const lineHeight = 58;
    const bodyHeight = Math.max(520, lines.length * lineHeight + 260);
    canvas.width = width;
    canvas.height = bodyHeight;

    const gradient = context.createLinearGradient(0, 0, width, bodyHeight);
    gradient.addColorStop(0, "#fbf7ef");
    gradient.addColorStop(0.52, "#ece4d5");
    gradient.addColorStop(1, "#d6c7ad");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, bodyHeight);

    context.globalAlpha = 0.12;
    for (let y = 18; y < bodyHeight; y += 31) {
      context.fillStyle = y % 62 === 0 ? "#637184" : "#ffffff";
      context.fillRect(0, y, width, 1);
    }
    context.globalAlpha = 1;

    context.strokeStyle = "#2e6695";
    context.lineWidth = 5;
    context.strokeRect(38, 38, width - 76, bodyHeight - 76);
    context.strokeStyle = "rgba(32,52,78,.42)";
    context.lineWidth = 1;
    context.strokeRect(52, 52, width - 104, bodyHeight - 104);

    context.fillStyle = "#17263d";
    context.font = '700 50px "Noto Serif SC", "Songti SC", serif';
    context.fillText("《圣经》文体翻译器", 110, 125);
    context.fillStyle = "#2e6695";
    context.font = '24px "Noto Serif SC", "Songti SC", serif';
    context.fillText(`${resultMeta} · v${packageInfo.version}`, 112, 171);
    context.fillRect(110, 194, 980, 2);

    context.fillStyle = "#202936";
    context.font = '34px "Noto Serif SC", "Songti SC", serif';
    let y = 260;
    for (const line of lines) {
      if (!line) {
        y += 24;
        continue;
      }
      context.fillText(line, 130, y);
      y += lineHeight;
    }

    context.fillStyle = "rgba(32,41,54,.72)";
    context.font = '21px "Noto Serif SC", "Songti SC", serif';
    context.fillText("文体仿写，并非真实经文或经文翻译", 110, bodyHeight - 90);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = buildCardDownloadFilename(resultMeta, new Date(), shareResult);
    link.click();
  }

  return (
    <main id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="《圣经》文体翻译器首页">
          <span className="brand-mark" aria-hidden="true">
            <BookOpen size={22} strokeWidth={1.7} />
          </span>
          <span>
            <strong>《圣经》文体翻译器</strong>
            <small>原人原话，庄严成章</small>
          </span>
        </a>
        <button className="key-button" type="button" onClick={openKeyModal}>
          <KeyRound size={17} />
          {apiKey ? "API 已配置" : "配置 API"}
          <i className={apiKey ? "status-dot active" : "status-dot"} />
        </button>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">CHINESE UNION VERSION</span>
          <h1>
            用寻常的话
            <br />
            <em>写出你的《圣经》故事</em>
          </h1>
          <p>量产你的圣经小故事</p>
          <a className="hero-cta" href="#translator">
            开始改写 <Sparkles size={17} />
          </a>
        </div>
      </section>

      <figure className="hero-art-section">
        <div className="hero-art-frame">
          <img
            className="hero-art-image"
            src="/images/church-jesus-hero-v2.png"
            alt="哥特式教堂内，耶稣向围坐众人讲论的传统圣经绘本场景"
          />
          <div className="hero-art-shade" />
          <figcaption>教堂讲论 · 圣经绘本主视觉</figcaption>
        </div>
      </figure>

      <section className="translator-shell" id="translator">
        <div className="section-heading">
          <div>
            <span className="eyebrow dark">THE TRANSLATOR</span>
            <h2>量产你的圣经小故事</h2>
          </div>
          <p>你的 Key 只保存在当前浏览器，并在请求时临时发送给 DeepSeek。</p>
        </div>

        <div className="direction-switch" role="tablist" aria-label="转换方向">
          {directions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={direction === item.id ? "active" : ""}
              onClick={() => switchDirection(item.id)}
            >
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </button>
          ))}
          <ArrowRightLeft className="direction-icon" size={18} aria-hidden="true" />
        </div>

        {isPlainDirection && (
          <div className="control-block">
            <div className="control-title">
              <span>一、选择释义方式</span>
              <small>{selectedPlainMode.description}</small>
            </div>
            <div className="mode-grid plain">
              {plainModes.map((item) => (
              <button
                key={item.id}
                type="button"
                className={plainMode === item.id ? "mode-card active" : "mode-card"}
                onClick={() => setPlainMode(item.id)}
              >
                <span className="mode-check"><Check size={14} /></span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </button>
              ))}
            </div>
          </div>
        )}

        {!isPlainDirection && (
          <div className="control-block edition-block">
            <div className="control-title">
              <span>一、选择译腔</span>
              <small>{selectedEdition.description}</small>
            </div>
            <div className="edition-switch" role="tablist" aria-label="选择译腔">
              {editions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={edition === item.id ? "active" : ""}
                  onClick={() => switchEdition(item.id)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="control-block compact">
          <div className="control-title">
            <span>二、选择篇幅</span>
            <small>{selectedLevel.description}</small>
          </div>
          <div className="level-switch">
            {levels.map((item) => (
              <button
                key={item.id}
                type="button"
                className={level === item.id ? "active" : ""}
                onClick={() => setLevel(item.id)}
              >
                <strong>{isPlainDirection ? item.plainTitle : item.title}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="writing-grid">
          <section className="writing-panel input-panel">
            <div className="panel-heading">
              <span>{inputLabel}</span>
              <small>{text.length} / {inputLimit}</small>
            </div>
            <textarea
              value={text}
              maxLength={inputLimit}
              onChange={(event) => {
                setText(event.target.value);
                setVariation(0);
                setWarning("");
              }}
              placeholder={
                isPlainDirection
                  ? "粘贴一段带有和合本译腔的文字……"
                  : "写下一句观点、一段日常，或一个有明确结局的故事……"
              }
              aria-label={`输入${inputLabel}`}
            />
            <div className="example-row">
              <span>试一例：</span>
              {currentExamples.map((example) => (
                <button key={example} type="button" onClick={() => setText(example)}>
                  {getExamplePreview(example)}
                </button>
              ))}
            </div>
            <button className="submit-button" type="button" disabled={!canSubmit} onClick={() => submit(false)}>
              {isLoading ? <RefreshCw className="spin" size={18} /> : <Sparkles size={18} />}
              {isLoading
                ? loadingLines[loadingIndex]
                : isPlainDirection
                  ? "翻回人话"
                  : edition === "kjv"
                    ? "Rewrite in KJV style"
                    : "把这段文案写成圣经体"}
            </button>
            {error && <p className="error-message" role="alert">{error}</p>}
            {warning && <p className="warning-message" role="status">{warning}</p>}
          </section>

          <section className="writing-panel output-panel" ref={outputRef}>
            <div className="panel-heading">
              <span>{outputLabel}</span>
              <small>{resultMeta}</small>
            </div>
            {result ? (
              <>
                <article className="result-text">
                  {!isPlainDirection && verses.length
                    ? verses.map((verse) => (
                        <span className="scripture-verse" key={verse.number}>
                          <sup>{verse.number}</sup>
                          {verse.text}
                        </span>
                      ))
                    : result}
                </article>
                <div className="result-actions">
                  <button type="button" onClick={copyResult}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "已复制" : "复制正文"}
                  </button>
                  <button type="button" onClick={downloadCard}>
                    <Download size={16} /> 导出图片
                  </button>
                  <button type="button" onClick={() => submit(true)} disabled={isLoading}>
                    <RefreshCw size={16} /> {edition === "kjv" ? "Rewrite again" : "再写一次"}
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-result">
                <ScrollText size={38} strokeWidth={1.25} />
                <strong>纸页尚空</strong>
                <p>在左侧输入文字，结果将在这里铺陈。</p>
              </div>
            )}
          </section>
        </div>

        <p className="disclaimer">
          本工具仅做文学文体仿写，输出不是《圣经》经文、经文翻译或宗教权威文本。
        </p>
      </section>

      <section className="skill-section">
        <div className="skill-copy">
          <span className="eyebrow dark">AI SKILL</span>
          <h2>把同一套规则带进 Codex</h2>
          <p>
            下载 <code>speak-scripture</code> Skill，在支持 Skills 的 AI 工具里保留原意与文本结构，进行过度庄严的和合本式改写。
          </p>
          <div className="skill-actions">
            <button type="button" onClick={copySkill}>
              {skillCopied ? <Check size={17} /> : <Copy size={17} />}
              {skillCopied ? "已复制 SKILL.md" : "复制 SKILL.md"}
            </button>
            <a href="/downloads/speak-scripture-skill.zip" download>
              <Download size={17} /> 下载 ZIP
            </a>
          </div>
        </div>
        <div className="skill-card" aria-label="speak-scripture Skill 预览">
          <div className="skill-card-top">
            <BookOpen size={25} />
            <span>CODEX SKILL · 1.0</span>
          </div>
          <h3>speak-scripture</h3>
          <p>Any modern Chinese copy, rendered in solemn scripture cadence.</p>
          <pre>使用 $speak-scripture，保留这段文案的原意与结构，把它改写成故意庄严过度的和合本译腔。</pre>
        </div>
      </section>

      <footer className="site-footer">
        <div>
          <strong>《圣经》文体翻译器</strong>
          <span>v{packageInfo.version} · BYOK · Next.js · DeepSeek</span>
        </div>
        <p>
          技术骨架复刻自
          <a href="https://github.com/lizi605/rushi-wowen-translator" target="_blank" rel="noreferrer">
            「如是我闻」翻译器
          </a>
          ，本项目已重写产品逻辑、提示词、视觉与测试。
        </p>
      </footer>

      {isKeyModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsKeyModalOpen(false)}>
          <section
            className="key-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="key-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" onClick={() => setIsKeyModalOpen(false)} aria-label="关闭">
              <X size={19} />
            </button>
            <span className="modal-icon"><KeyRound size={22} /></span>
            <h2 id="key-modal-title">配置模型 API</h2>
            <p>
              本站不提供共享额度。Key 与模型名只保存在此浏览器中；服务端会自动兼容主流 OpenAI 格式模型的常见参数差异。
            </p>
            <label htmlFor="api-key-input">API Key</label>
            <div className="key-input-wrap">
              <input
                id="api-key-input"
                type={showApiKey ? "text" : "password"}
                value={draftApiKey}
                onChange={(event) => setDraftApiKey(event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
              <button type="button" onClick={() => setShowApiKey((value) => !value)} aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}>
                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <label className="model-label" htmlFor="api-model-input">模型名称（可选）</label>
            <div className="key-input-wrap">
              <input
                id="api-model-input"
                type="text"
                value={draftApiModel}
                onChange={(event) => setDraftApiModel(event.target.value)}
                placeholder="留空自动选择，例如 deepseek-v4-flash、qwen-plus"
                autoComplete="off"
              />
            </div>
            <div className="privacy-note">
              <ShieldCheck size={18} />
              <span>模型名不受支持时会自动尝试接口返回的可用模型；仍不兼容时会明确报错，不会直接展示固定兜底稿。</span>
            </div>
            <div className="modal-actions">
              {apiKey && (
                <button className="clear-key" type="button" onClick={clearApiKey}>
                  <Trash2 size={16} /> 清除此机 Key
                </button>
              )}
              <button className="save-key" type="button" onClick={saveApiKey}>
                <Check size={16} /> 保存并使用
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
