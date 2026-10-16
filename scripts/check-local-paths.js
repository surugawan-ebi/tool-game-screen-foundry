"use strict";

const path = require("path");
const { inspectRepository, formatFindings } = require("./repository-hygiene");

try {
  const findings = inspectRepository(path.resolve(__dirname, ".."));
  if (findings.length) {
    process.stderr.write(`Repository hygiene check failed:\n${formatFindings(findings)}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Repository hygiene check ok\n");
  }
} catch {
  process.stderr.write("Repository hygiene check could not inspect the Git index or candidate files.\n");
  process.exitCode = 1;
}
