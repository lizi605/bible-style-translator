import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("page presents the general Union Version transformer", async () => {
  const page = await readFile(path.join(root, "app/page.tsx"), "utf8");
  const layout = await readFile(path.join(root, "app/layout.tsx"), "utf8");
  assert.match(page, /《圣经》文体翻译器/);
  assert.match(page, /bible-style-deepseek-api-key/);
  assert.match(page, /mode: "original"/);
  assert.match(page, /用寻常的话/);
  assert.match(page, /写出你的《圣经》故事/);
  assert.equal((layout.match(/用寻常的话 写出你的《圣经》故事/g) || []).length, 2);
  assert.equal((page.match(/量产你的圣经小故事/g) || []).length, 2);
  assert.match(page, /把这段文案写成圣经体/);
  assert.doesNotMatch(page, /选择改写玩法/);
  assert.match(page, /onClick=\{\(\) => switchDirection\(item\.id\)\}/);
  assert.match(page, /onClick=\{\(\) => setLevel\(item\.id\)\}/);
  assert.match(page, /不是《圣经》经文、经文翻译或宗教权威文本/);
});

test("route uses bounded fact planning followed by scripture-style realization", async () => {
  const route = await readFile(path.join(root, "app/api/translate/route.ts"), "utf8");
  assert.match(route, /authorization/);
  assert.doesNotMatch(route, /process\.env\.DEEPSEEK_API_KEY/);
  assert.match(route, /buildSkeletonIdentificationPrompt/);
  assert.match(route, /parseScriptureSkeletonPlan/);
  assert.match(route, /renderScriptureSkeletonPlan/);
  assert.match(route, /direct_rescue_assessed/);
  assert.match(route, /没有返回近似原文的保守稿/);
  assert.match(route, /attempt < 2/);
  assert.match(route, /response_format/);
  assert.match(route, /groundScriptureSkeletonPlan\(parsedPlan, text\)[\s\S]*assessScriptureStoryPlan\(groundedPlan, text\)/);
  assert.match(route, /assessScriptureStoryResult/);
  assert.match(route, /STRUCTURED_STORY_REALIZATION_SYSTEM_PROMPT/);
  assert.match(route, /buildStructuredStoryRealizationPrompt/);
  assert.match(route, /assessUnionStyleResult/);
  assert.match(route, /previousIssues/);
  assert.match(route, /temperature: 0\.05/);
  assert.doesNotMatch(route, /repairScriptureResult/);
  assert.doesNotMatch(route, /polishScriptureDraft/);
  assert.doesNotMatch(route, /scriptureCandidatePenalty/);
  assert.doesNotMatch(route, /buildScriptureReplacementPrompt/);
  assert.match(route, /TRANSLATE_TIME_BUDGET_MS/);
  assert.match(route, /DEEPSEEK_CALL_TIMEOUT_MS/);
  assert.match(route, /normalizeUnionNarration/);
  assert.match(route, /normalizeCuvSceneLexicon/);
  assert.match(route, /renderDefinitionSource/);
  assert.match(route, /segmentScriptureText/);
});

test("deterministic skeleton logic is not coupled to the demonstration story", async () => {
  const skeletons = await readFile(path.join(root, "lib/scriptureSkeletons.ts"), "utf8");
  assert.doesNotMatch(skeletons, /刘华强|宋老虎|赵祥生|振涛|韩跃平|大海/);
  assert.match(skeletons, /通知|观点|条例/);
  assert.match(skeletons, /trade_price/);
  assert.match(skeletons, /guarantee/);
  assert.match(skeletons, /command/);
});

test("visual and downloadable skill assets remain synchronized", async () => {
  const page = await readFile(path.join(root, "app/page.tsx"), "utf8");
  const sourceSkill = await readFile(path.join(root, "skill-package/speak-scripture/SKILL.md"), "utf8");
  const publicSkill = await readFile(path.join(root, "public/downloads/speak-scripture-SKILL.md"), "utf8");
  assert.match(page, /church-jesus-hero-v2\.png/);
  assert.match(page, /speak-scripture-SKILL\.md/);
  assert.match(page, /speak-scripture-skill\.zip/);
  assert.equal(publicSkill, sourceSkill);
  assert.match(sourceSkill, /Chinese Union Version/i);
  assert.match(sourceSkill, /Preserve the story or information spine/i);
  assert.match(sourceSkill, /Text-type and maxim gate/i);
  assert.match(sourceSkill, /Do not collapse unrelated maxims/i);
  assert.match(page, /scripture-verse/);
  assert.match(page, /formatScriptureVerses/);
});

test("deployment config uses the independent worker name", async () => {
  const wrangler = await readFile(path.join(root, "wrangler.jsonc"), "utf8");
  const packageJson = await readFile(path.join(root, "package.json"), "utf8");
  const assetPreparation = await readFile(
    path.join(root, "scripts/prepare-cloudflare-assets.mjs"),
    "utf8",
  );
  assert.match(wrangler, /bible-style-translator/);
  assert.match(packageJson, /"name": "bible-style-translator"/);
  assert.match(packageJson, /prepare-cloudflare-assets\.mjs/);
  assert.match(assetPreparation, /_next\/static\/css/);
  assert.match(assetPreparation, /rel="stylesheet"/);
});

test("desktop package runs a bundled local server instead of the public Worker", async () => {
  const packageJson = await readFile(path.join(root, "package.json"), "utf8");
  const nextConfig = await readFile(path.join(root, "next.config.ts"), "utf8");
  const desktopMain = await readFile(path.join(root, "desktop/main.cjs"), "utf8");
  const desktopPreparation = await readFile(
    path.join(root, "scripts/prepare-desktop-server.mjs"),
    "utf8",
  );

  assert.match(packageJson, /"desktop:dist"/);
  assert.match(packageJson, /electron-builder --win portable --x64/);
  assert.match(nextConfig, /output: "standalone"/);
  assert.match(desktopMain, /http:\/\/127\.0\.0\.1/);
  assert.match(desktopMain, /server_modules/);
  assert.doesNotMatch(desktopMain, /workers\.dev/);
  assert.match(desktopPreparation, /\.next\/static/);
  assert.match(desktopPreparation, /server_modules/);
});
