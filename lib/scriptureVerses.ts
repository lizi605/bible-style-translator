export type ScriptureVerse = {
  number: number;
  text: string;
};

function splitSentences(value: string) {
  const units: string[] = [];
  let current = "";
  let quoteDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    current += character;
    if (/[“‘]/u.test(character)) quoteDepth += 1;
    if (/[”’]/u.test(character)) {
      quoteDepth = Math.max(0, quoteDepth - 1);
      if (quoteDepth === 0 && /[。！？!?]/u.test(value[index - 1] || "")) {
        if (current.trim()) units.push(current.trim());
        current = "";
        continue;
      }
    }

    if (/\n/u.test(character) && !current.trim()) {
      current = "";
      continue;
    }

    if (/[。！？!?]/u.test(character) && quoteDepth === 0) {
      while (/[”’]/u.test(value[index + 1] || "")) {
        current += value[index + 1];
        index += 1;
      }
      if (current.trim()) units.push(current.trim());
      current = "";
    }
  }

  if (current.trim()) units.push(current.trim());
  return units;
}

function findSplitPoint(value: string) {
  let quoteDepth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (/[“‘]/u.test(character)) quoteDepth += 1;
    if (/[”’]/u.test(character)) quoteDepth = Math.max(0, quoteDepth - 1);
    if (quoteDepth > 0) continue;

    if (character === "：" && index >= 12 && value.length - index >= 18) return index + 1;
    if (character === "；" && index >= 26 && value.length - index >= 24) {
      const left = value.slice(0, index);
      const right = value.slice(index + 1);
      if (/凡/u.test(left) && /^\s*凡/u.test(right)) continue;
      if (/不是/u.test(left) && /^\s*乃是/u.test(right)) continue;
      return index + 1;
    }
  }
  return -1;
}

function splitLongUnit(value: string): string[] {
  if ([...value].length <= 56) return [value];
  const splitAt = findSplitPoint(value);
  if (splitAt < 0) return [value];
  const left = value.slice(0, splitAt).trim();
  const right = value.slice(splitAt).trim();
  return [left, ...splitLongUnit(right)].filter(Boolean);
}

function groupLongStoryVerses(segments: string[], sourceLength: number) {
  if (segments.length <= 6 || sourceLength < 360) return segments;
  const grouped: string[] = [];
  let current = "";

  for (const segment of segments) {
    const combined = `${current}${segment}`;
    if (current && [...current].length >= 46) {
      grouped.push(current);
      current = segment;
      continue;
    }
    if (current && [...combined].length > 94) {
      grouped.push(current);
      current = segment;
      continue;
    }
    current = combined;
  }
  if (current) grouped.push(current);

  if (
    grouped.length >= 2 &&
    [...grouped[grouped.length - 1]].length < 28 &&
    [...`${grouped[grouped.length - 2]}${grouped[grouped.length - 1]}`].length <= 108
  ) {
    const tail = grouped.pop() || "";
    grouped[grouped.length - 1] += tail;
  }
  return grouped;
}

export function segmentScriptureText(value: string): ScriptureVerse[] {
  const text = value.trim();
  if (!text) return [];
  const rawSegments = splitSentences(text).flatMap(splitLongUnit).filter(Boolean);
  const segments = groupLongStoryVerses(rawSegments, [...text].length);
  return segments.map((text, index) => ({ number: index + 1, text }));
}

export function formatScriptureVerses(verses: readonly ScriptureVerse[]) {
  return verses.map((verse) => `${verse.number} ${verse.text}`).join("\n");
}
