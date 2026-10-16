# Repository Agent Instructions

Read `README.md`, `CONTRIBUTING.md`, the relevant documents in `docs/`, and
`skills/game-screen-foundry/SKILL.md` before changing this repository.

## Scope and collaboration

- Keep changes focused on the requested task and preserve unrelated local changes.
- Use the agent and tools available to the contributor; no particular model or private service is required.
- When independent work can be delegated, give each contributor a bounded scope and avoid concurrent edits to the same files or shared GUI sessions.
- Independently review delegated changes and run relevant checks before reporting completion.
- Follow the user's authorization and the execution environment's approval rules for Git publication and other external writes. Do not bypass a denied operation.

## Project contracts

- Preserve the screen contract: `screen-kv.json`, `material-spec.json`, and `world-preset.json`.
- Follow the bundled skill's creative-direction gate before visual generation or layout changes.
- Keep runtime text separate from generated artwork unless the contract explicitly assigns it to the asset.
- Use portable project-relative paths in committed examples and documentation.
- Keep private projects, credentials, generation jobs, and personal agent settings out of Git.

## Validation

- Run `npm run release:check` before handing off changes. See `docs/release-checklist.md`.
- Add focused regression tests for behavior changes and update the relevant documentation.
- Electron desktop and snapshot commands initialize a GUI, including hidden-window snapshots. Use an environment permitted to launch GUI processes; do not repeatedly retry a sandbox-related crash.
- Report checks that could not run and distinguish environment failures from project failures.

## Personal instructions

Keep machine-specific model preferences, tool routing, and approval integrations in your
agent's user-level settings or ignored `AGENTS.local.md` / `CLAUDE.local.md` files.
Local instruction discovery depends on the client: load those files explicitly when
needed. They are not required to build, test, or contribute to this project.
