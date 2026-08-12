"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { getDemoProject } = require("../lib/sample-data");
const {
  assertCreativeDirectionApproved,
  persistRegistry
} = require("../scripts/imagegen-handoff");
const { validateCreativeDirection } = require("../lib/creative-direction");

function writeScreenFixture(screenFolder, project) {
  fs.mkdirSync(screenFolder, { recursive: true });
  fs.writeFileSync(path.join(screenFolder, "screen-kv.json"), `${JSON.stringify(project.screenKv, null, 2)}\n`);
  fs.writeFileSync(path.join(screenFolder, "material-spec.json"), `${JSON.stringify(project.materialSpecSheet, null, 2)}\n`);
  fs.writeFileSync(path.join(screenFolder, "world-preset.json"), `${JSON.stringify(project.worldPreset, null, 2)}\n`);
}

test("creative direction gate requires an explicit approved decision", () => {
  const missing = validateCreativeDirection({});
  assert.equal(missing.ok, false);
  assert.equal(missing.status, "missing");
  assert.match(missing.message, /creativeDirection is required/u);

  assert.throws(
    () => assertCreativeDirectionApproved({ creativeDirection: { status: "draft" } }),
    (error) => error && error.code === "CREATIVE_DIRECTION_NOT_APPROVED"
  );
});

test("text-only direction is allowed only with a recorded rationale", () => {
  const withoutRationale = validateCreativeDirection({
    creativeDirection: {
      status: "approved",
      referenceMode: "text_only"
    }
  });
  assert.equal(withoutRationale.ok, false);
  assert.match(withoutRationale.message, /textOnlyRationale is required/u);

  const approved = validateCreativeDirection({
    creativeDirection: {
      status: "approved",
      visualThesis: "A warm hand-painted adventure world with crisp readable game UI.",
      referenceMode: "text_only",
      textOnlyRationale: "The brief intentionally defines a new world without a visual reference.",
      mustHave: ["warm focal lighting"],
      mustNotHave: ["photorealistic rendering"]
    },
    moodKeywords: ["warm", "adventurous", "readable"],
    shapeLanguage: "soft rounded silhouettes",
    materialKeywords: ["painted wood", "brushed metal"],
    lightingStyle: "warm directional light",
    detailDensity: "medium",
    palette: {
      primary: "#111111",
      secondary: "#222222",
      accent: "#333333",
      neutralDark: "#000000",
      neutralLight: "#ffffff"
    }
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.referenceMode, "text_only");
});

test("approved direction fails closed when a required brief field is incomplete", () => {
  const incomplete = validateCreativeDirection({
    creativeDirection: {
      status: "approved",
      visualThesis: "too short",
      referenceMode: "text_only",
      textOnlyRationale: "The brief has no image reference.",
      mustHave: [],
      mustNotHave: []
    },
    moodKeywords: ["only", "two"],
    palette: { primary: "#111111" },
    shapeLanguage: "",
    materialKeywords: ["one"],
    lightingStyle: "",
    detailDensity: ""
  });
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.message, /visualThesis|moodKeywords|mustHave/u);
});

test("reference-image direction requires at least one reference", () => {
  const missing = validateCreativeDirection({
    creativeDirection: {
      status: "approved",
      referenceMode: "reference_images"
    },
    referenceImages: []
  });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /referenceImages must contain/u);

  const approved = validateCreativeDirection({
    creativeDirection: {
      status: "approved",
      visualThesis: "A warm hand-painted adventure world with crisp readable game UI.",
      referenceMode: "reference_images",
      mustHave: ["warm focal lighting"],
      mustNotHave: ["photorealistic rendering"]
    },
    referenceImages: [{ path: "key-visual.png", role: "style_reference" }],
    moodKeywords: ["warm", "adventurous", "readable"],
    shapeLanguage: "soft rounded silhouettes",
    materialKeywords: ["painted wood", "brushed metal"],
    lightingStyle: "warm directional light",
    detailDensity: "medium",
    palette: {
      primary: "#111111",
      secondary: "#222222",
      accent: "#333333",
      neutralDark: "#000000",
      neutralLight: "#ffffff"
    }
  });
  assert.equal(approved.ok, true);
});

test("imagegen handoff stops before writing a job when direction is not approved", () => {
  const screenFolder = fs.mkdtempSync(path.join(os.tmpdir(), "gsf-direction-gate-"));
  try {
    const project = getDemoProject();
    project.worldPreset.imagegenWorkflow = {
      jobDir: path.join(screenFolder, "jobs"),
      outputDir: path.join(screenFolder, "generated"),
      targetAssetIds: ["bg_sky_port_home"]
    };
    writeScreenFixture(screenFolder, project);

    const result = spawnSync(process.execPath, [
      path.join(__dirname, "..", "scripts", "imagegen-handoff.js"),
      screenFolder
    ], { encoding: "utf8" });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Creative direction gate blocked imagegen handoff/u);
    assert.equal(fs.existsSync(path.join(screenFolder, "jobs")), false);
  } finally {
    fs.rmSync(screenFolder, { recursive: true, force: true });
  }
});

test("approved text-only direction permits handoff creation", () => {
  const screenFolder = fs.mkdtempSync(path.join(os.tmpdir(), "gsf-direction-approved-"));
  try {
    const project = getDemoProject();
    project.worldPreset.creativeDirection = {
      status: "approved",
      visualThesis: "A warm hand-painted adventure world with crisp readable game UI.",
      referenceMode: "text_only",
      textOnlyRationale: "The project brief defines the visual language without an image reference.",
      mustHave: ["warm focal lighting"],
      mustNotHave: ["photorealistic rendering"]
    };
    project.worldPreset.imagegenWorkflow = {
      jobDir: path.join(screenFolder, "jobs"),
      outputDir: path.join(screenFolder, "generated"),
      targetAssetIds: ["bg_sky_port_home"]
    };
    writeScreenFixture(screenFolder, project);

    const result = spawnSync(process.execPath, [
      path.join(__dirname, "..", "scripts", "imagegen-handoff.js"),
      screenFolder
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Imagegen handoff created/u);
    assert.ok(fs.existsSync(path.join(screenFolder, "jobs")));
  } finally {
    fs.rmSync(screenFolder, { recursive: true, force: true });
  }
});

test("headless adoption writes portable manifests without local generation contracts", () => {
  const screenFolder = fs.mkdtempSync(path.join(os.tmpdir(), "gsf-handoff-manifest-"));
  try {
    const generatedDir = path.join(screenFolder, "generated-assets");
    fs.mkdirSync(generatedDir);
    const imagePath = path.join(generatedDir, "btn_start.png");
    fs.writeFileSync(imagePath, Buffer.from("png"));
    const manifestPath = persistRegistry(screenFolder, {
      btn_start: {
        assetId: "btn_start",
        path: imagePath,
        backend: "codex_cli_imagegen",
        usesImagegen: true,
        prompt: `Use local reference ${path.join(screenFolder, "reference.png")}`,
        generationContract: {
          outputPath: imagePath
        },
        acceptance: {
          checks: [{ status: "pass", code: "final_pixel_size" }]
        }
      }
    });

    const text = fs.readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(text);
    assert.equal(manifest.assets[0].path, "generated-assets/btn_start.png");
    assert.equal(manifest.assets[0].prompt, undefined);
    assert.equal(manifest.assets[0].generationContract, undefined);
    assert.doesNotMatch(text, new RegExp(screenFolder.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  } finally {
    fs.rmSync(screenFolder, { recursive: true, force: true });
  }
});
