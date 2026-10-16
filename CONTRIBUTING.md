# Contributing

このリポジトリは public beta です。仕様や UI はまだ変わりますが、外部プロジェクトで安全に試せる状態を優先しています。

This repository is in public beta. The schema and UI may still change, but the priority is keeping the tool safe and practical for external projects.

## Development Setup

前提: Node.js 20 以上。  
Prerequisite: Node.js 20 or newer.

```sh
npm run release:check
npm run dev
```

Open:

```text
http://127.0.0.1:4311
```

To install the bundled Codex skill locally:

```sh
npm run skill:install
```

To create or validate an external creative project:

```sh
npm run init-project -- /path/to/game/creative
npm run add-screen -- /path/to/game/creative shop --screen-name SHOP
npm run validate:project -- /path/to/game/creative shop
```

## Pull Request Checklist

- Run `npm run release:check`.
- Keep generated `imagegen-jobs/` files out of Git.
- Keep external game project files out of this repository.
- Update [docs/schema.md](docs/schema.md) when changing file contracts.
- Update [README.md](README.md) when changing user-facing workflow.
- Add or update tests for behavior changes.

## Personal Configuration and Public Files

`AGENTS.md` and `CLAUDE.md` are shared, public contributor instructions. Keep
personal model preferences, private tool connections, approval integrations, and
machine paths in user-level settings or ignored `AGENTS.local.md` and
`CLAUDE.local.md` files. Local instruction files must be loaded according to your
agent client's configuration; their filenames do not guarantee automatic loading.

Local agent directories (`.codex/`, `.claude/`, `.agents/`), MCP configuration,
environment files, and credential material are ignored. Keep shared project skills
in `skills/`. `.env.example` may contain placeholders only. Public author credits
and repository links are intentional project metadata.

`npm run release:check` inspects tracked files and nonignored new files for private
configuration and local paths. It also checks staged content and reports categories
and locations without printing matched values. These checks are heuristics, not a
guarantee that every secret format will be detected.

Adding an ignore rule does not untrack existing files or remove earlier commits.
Review the index before publishing. If credentials were previously published,
revoke or rotate them first; coordinate any history cleanup separately. Keep audit
reports containing private values outside the repository.

## Design Boundaries

- This is a local-first workbench, not a hosted service.
- Do not add network calls to external generation services without an explicit opt-in design.
- Do not turn the product into a general image generator.
- Keep runtime text, values, labels, and notification counts separate from generated PNGs unless the asset explicitly owns baked text.
- Prefer portable project-relative paths over machine-local absolute paths.

## Code Style

- CommonJS modules.
- No build step for the browser app.
- No runtime dependencies unless they remove meaningful complexity.
- Keep behavior testable through `dispatchApi` or small exported helpers.
- Use focused tests that protect the screen assembly contract.
