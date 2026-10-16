"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const placeholderUsers = new Set([
  "<user>", "<username>", "<name>", "user", "username", "your-user", "your-name", "you"
]);
const runtimeDirectories = new Set([
  "imagegen-jobs", "imagegen-status", ".reference-quality-profiles",
  ".game-creative-generation", "node_modules", "tmp", "logs", "coverage"
]);

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error("Git inspection failed");
  }
  return result.stdout;
}

function gitPaths(root, args) {
  return git(root, args).toString("utf8").split("\0").filter(Boolean);
}

function fileCategory(filePath) {
  const segments = filePath.split("/");
  const basename = segments.at(-1);
  if (/^\.env(?:\.|$)/u.test(basename) && !/^\.env\.(?:example|sample|template)$/u.test(basename)) {
    return "private-environment-file";
  }
  if (/^(?:(?:AGENTS|CLAUDE)\.local\.md|\.mcp(?:\.local)?\.json)$/u.test(basename)
      || /(?:^|\/)\.(?:codex|claude|agents)\/(?:auth\.json|config\.toml|settings(?:\.local)?\.json|sessions\/|history\.jsonl|log\/)/u.test(filePath)) {
    return "private-agent-configuration";
  }
  if (/^(?:id_(?:rsa|dsa|ecdsa|ed25519)|credentials|\.netrc|\.npmrc)$/u.test(basename)
      || /\.(?:pem|p12|pfx|keystore|jks|key|mobileprovision)$/iu.test(basename)
      || segments.slice(0, -1).includes(".ssh")) {
    return "credential-file";
  }
  if (filePath !== "imagegen-jobs/.gitkeep" && segments.slice(0, -1).some((segment) => runtimeDirectories.has(segment))) {
    return "private-runtime-output";
  }
  return null;
}

function lineCategories(line, filePath) {
  const categories = [];
  const homePaths = /(?:\/(?:Users|home)\/|[A-Za-z]:[\\/]+Users[\\/]+)(<[^>\r\n]+>|[^\\/\s"'`<>:,;)\]}]+)/giu;
  if ([...line.matchAll(homePaths)].some((match) => !placeholderUsers.has(match[1].toLowerCase()))) {
    categories.push("personal-home-path");
  }
  if (/\/private\/(?:tmp|var\/folders)\//u.test(line)
      || /\/Applications\/Codex[^\s"'`]*\.app/u.test(line)) {
    categories.push("machine-local-path");
  }
  if (/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/u.test(line)) {
    categories.push("private-key-content");
  }
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,}|xox[baprs]-[A-Za-z0-9-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,})\b/u.test(line)) {
    categories.push("credential-token");
  }
  const credentialUrls = /[a-z][a-z0-9+.-]*:\/\/([^\s/:@]+):([^\s/@]+)@/giu;
  if ([...line.matchAll(credentialUrls)].some((match) =>
    !/^(?:<[^>]+>|\$\{[^}]+\}|password|pass|replace-me|example)$/iu.test(match[2]))) {
    categories.push("credential-url");
  }
  if (/(?:^|\/)(?:AGENTS|CLAUDE)\.md$/u.test(filePath)
      && /(?:local-mcp|workspace-git|bounded_local_commit_grant|Personal Local Agent Rules|machine-local instructions|Slack channel C[A-Z0-9]+)/u.test(line)) {
    categories.push("personal-agent-policy");
  }
  return categories;
}

function inspectContent(buffer, filePath, source) {
  if (buffer.includes(0)) {
    return [];
  }
  return buffer.toString("utf8").split(/\r?\n/u).flatMap((line, index) =>
    lineCategories(line, filePath).map((category) => ({ path: filePath, line: index + 1, category, source })));
}

function inspectRepository(root) {
  const resolvedRoot = fs.realpathSync(root);
  const tracked = new Set(gitPaths(root, ["ls-files", "--cached", "-z"]));
  const untracked = gitPaths(root, ["ls-files", "--others", "--exclude-standard", "-z"]);
  const staged = new Set(gitPaths(root, ["diff", "--cached", "--name-only", "--diff-filter=ACMRT", "-z"]));
  const findings = [];
  for (const filePath of new Set([...tracked, ...untracked])) {
    const category = fileCategory(filePath);
    if (category) {
      findings.push({ path: filePath, category, source: tracked.has(filePath) ? "tracked" : "untracked" });
      continue;
    }
    const absolutePath = path.resolve(root, filePath);
    let stat;
    try {
      stat = fs.lstatSync(absolutePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    if (stat) {
      const parent = fs.realpathSync(path.dirname(absolutePath));
      const relativeParent = path.relative(resolvedRoot, parent);
      if (relativeParent.startsWith(`..${path.sep}`) || relativeParent === ".." || path.isAbsolute(relativeParent)) {
        findings.push({ path: filePath, category: "external-file-reference", source: "working-tree" });
      } else if (stat.isSymbolicLink()) {
        findings.push(...inspectContent(Buffer.from(fs.readlinkSync(absolutePath)), filePath, "working-tree"));
      } else if (stat.isFile()) {
        findings.push(...inspectContent(fs.readFileSync(absolutePath), filePath, "working-tree"));
      }
    }
    if (staged.has(filePath) || (tracked.has(filePath) && !stat)) {
      findings.push(...inspectContent(git(root, ["show", `:${filePath}`]), filePath, "index"));
    }
  }
  return findings;
}

function formatFindings(findings) {
  return findings.map((finding) =>
    `${JSON.stringify(finding.path)}${finding.line ? `:${finding.line}` : ""}: ${finding.category} (${finding.source})`).join("\n");
}

module.exports = { inspectRepository, formatFindings };
