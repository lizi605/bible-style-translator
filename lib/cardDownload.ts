function toShanghaiParts(date: Date) {
  const shanghaiDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const iso = shanghaiDate.toISOString();
  return {
    date: iso.slice(0, 10).replaceAll("-", ""),
    time: iso.slice(11, 19).replaceAll(":", ""),
  };
}

function sanitizeFilenamePart(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|\s]+/g, "")
    .replace(/[.。]+$/g, "")
    .slice(0, 12);
  return cleaned || "成篇";
}

function shortHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

const FORBIDDEN_LINE_START = /^[，。！？；：、）》】〕〉”’…—]/u;
const FORBIDDEN_LINE_END = /[（《【〔〈“‘]$/u;

export function wrapMeasuredCardText(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
) {
  const paragraphs = text.split(/\n+/u);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const character of paragraph) {
      const candidate = line + character;
      if (measure(candidate) <= maxWidth || !line) {
        line = candidate;
        continue;
      }
      if (FORBIDDEN_LINE_START.test(character)) {
        line += character;
        continue;
      }
      if (FORBIDDEN_LINE_END.test(line)) {
        const opening = line.slice(-1);
        const settled = line.slice(0, -1);
        if (settled) lines.push(settled);
        line = opening + character;
        continue;
      }
      lines.push(line);
      line = character;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function buildCardDownloadFilename(
  levelTitle: string,
  date = new Date(),
  result = "",
) {
  const parts = toShanghaiParts(date);
  const title = sanitizeFilenamePart(levelTitle);
  const digest = shortHash(`${levelTitle}\n${parts.date}\n${parts.time}\n${result}`);
  return `圣经文体翻译器-${title}-${parts.date}-${parts.time}-${digest}.png`;
}
