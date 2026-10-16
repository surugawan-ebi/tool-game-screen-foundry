"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const { inspectRepository, formatFindings } = require("../scripts/repository-hygiene");

function withRepository(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gsf-hygiene-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  const write = (filePath, content) => {
    fs.mkdirSync(path.dirname(path.join(root, filePath)), { recursive: true });
    fs.writeFileSync(path.join(root, filePath), content);
  };
  try {
    git("init", "--quiet");
    run({ root, git, write });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("hygiene ignores private local files but catches force-tracked ignored files", () => {
  withRepository(({ root, git, write }) => {
    write(".gitignore", ".env*\n.claude/\nimagegen-jobs/*\n!imagegen-jobs/.gitkeep\n");
    write(".env", "TOKEN=private-value");
    write(".claude/settings.local.json", "{}");
    write("imagegen-jobs/local.json", "{}");
    write("imagegen-jobs/.gitkeep", "");
    git("add", ".gitignore", "imagegen-jobs/.gitkeep");
    assert.deepEqual(inspectRepository(root), []);
    git("add", "--force", ".env", ".claude/settings.local.json", "imagegen-jobs/local.json");
    assert.deepEqual(inspectRepository(root).map((finding) => finding.category).sort(), [
      "private-agent-configuration", "private-environment-file", "private-runtime-output"
    ]);
  });
});

test("hygiene scans nonignored candidates and redacts matched values", () => {
  withRepository(({ root, write }) => {
    const identity = "sensitive-person";
    write("notes.md", [
      ["", "Users", identity, "project"].join("/"),
      ["", "home", identity, "project"].join("/"),
      ["C:", "Users", identity, "project"].join("\\"),
      ["C:", "Users", identity, "project"].join("\\\\")
    ].join("\n"));
    const findings = inspectRepository(root);
    assert.equal(findings.length, 4);
    assert.ok(findings.every((finding) => finding.category === "personal-home-path"));
    assert.deepEqual(findings.map((finding) => finding.line), [1, 2, 3, 4]);
    assert.ok(!formatFindings(findings).includes(identity));
  });
});

test("hygiene checks staged content even when working content was sanitized", () => {
  withRepository(({ root, git, write }) => {
    write("notes.md", ["", "Users", "sensitive-person", "project"].join("/"));
    git("add", "notes.md");
    write("notes.md", "Use a project-relative path.");
    const findings = inspectRepository(root);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].source, "index");
    assert.equal(findings[0].category, "personal-home-path");
  });
});

test("hygiene allows portable examples, shared instructions, and public attribution", () => {
  withRepository(({ root, git, write }) => {
    write("README.md", [
      "https://github.com/public-author/example",
      ["", "Users", "<username>", "project"].join("/"),
      ["", "home", "user", "project"].join("/"),
      "Use /path/to/project or $HOME/project."
    ].join("\n"));
    write("AGENTS.md", "Run npm test before reporting changes.");
    write(".env.example", "TOKEN=replace-me");
    write(".agents/skills/example/SKILL.md", "Shared project skill.");
    git("add", ".");
    assert.deepEqual(inspectRepository(root), []);
  });
});

test("hygiene detects private-key content and machine-specific root policies", () => {
  withRepository(({ root, write }) => {
    write("unexpected.txt", ["-----BEGIN", "OPENSSH", "PRIVATE KEY-----"].join(" "));
    write("AGENTS.md", ["Require", "workspace-git", "on my workstation."].join(" "));
    write("nested/AGENTS.md", ["Require", "workspace-git", "on my workstation."].join(" "));
    write("nested/imagegen-status/state.json", "{}");
    const categories = inspectRepository(root).map((finding) => finding.category).sort();
    assert.deepEqual(categories, ["personal-agent-policy", "personal-agent-policy", "private-key-content", "private-runtime-output"]);
  });
});

test("hygiene does not follow symlinks to private files", { skip: process.platform === "win32" }, () => {
  withRepository(({ root, write }) => {
    write(".gitignore", "private/\n");
    write("private/secret.txt", ["", "Users", "sensitive-person", "project"].join("/"));
    fs.symlinkSync("private/secret.txt", path.join(root, "link.txt"));
    assert.deepEqual(inspectRepository(root), []);
  });
});

test("repository ignore rules exclude personal files while retaining public documentation", () => {
  withRepository(({ root, git, write }) => {
    write(".gitignore", fs.readFileSync(path.join(__dirname, "..", ".gitignore")));
    const privatePaths = [
      ".env", "nested/.env.local", ".claude/settings.json", ".codex/config.toml",
      ".agents/settings.json", "AGENTS.local.md", "nested/CLAUDE.local.md",
      ".mcp.json", ".mcp.local.json", ".npmrc", ".netrc", ".ssh/id_ed25519",
      "signing.pem", "signing.key", "signing.p12", "signing.pfx", "signing.mobileprovision",
      "imagegen-jobs/job.json", "imagegen-status/job.json", "nested/.game-creative-generation/session.json"
    ];
    for (const filePath of privatePaths) {
      write(filePath, "private fixture");
    }
    for (const filePath of ["AGENTS.md", "CLAUDE.md", ".env.example", "imagegen-jobs/.gitkeep"]) {
      write(filePath, "public fixture");
    }
    const ignored = git("check-ignore", "--no-index", ...privatePaths).toString("utf8").split(/\r?\n/u).filter(Boolean);
    assert.deepEqual(ignored.sort(), privatePaths.sort());
    assert.deepEqual(inspectRepository(root), []);
    git("add", "--force", ...privatePaths);
    assert.equal(inspectRepository(root).length, privatePaths.length);
  });
});

test("hygiene detects recognizable credentials without reporting credential values", () => {
  withRepository(({ root, write }) => {
    const credentials = [
      ["ghp", "A".repeat(36)].join("_"),
      ["github", "pat", "B".repeat(82)].join("_"),
      ["xoxb", "1".repeat(12), "2".repeat(12), "C".repeat(24)].join("-"),
      ["AKIA", "D".repeat(16)].join(""),
      ["sk", "proj", "E".repeat(48)].join("-"),
      ["https:", "", "person:private-password@example.invalid"].join("/")
    ];
    write("credentials.txt", credentials.join("\n"));
    const findings = inspectRepository(root);
    assert.equal(findings.length, credentials.length);
    assert.equal(findings.filter((finding) => finding.category === "credential-token").length, 5);
    assert.equal(findings.filter((finding) => finding.category === "credential-url").length, 1);
    assert.ok(credentials.every((credential) => !formatFindings(findings).includes(credential)));
  });
});
