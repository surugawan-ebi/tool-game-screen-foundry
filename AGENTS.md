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

## Task completion and workspace cleanup

- Cleanup is part of the task owner's responsibility. Report implementation, validation, publication/merge, and cleanup separately; a saved PR is not a merge into the target branch.
- Delete only the task's local and remote topic branches after verifying the PR was merged, the intended changes are preserved in the target branch (including squash/rebase merges), and no other PR or active work depends on them. Never include default, shared, or protected branches.
- For a PR-only request, keep the review-pending branch. Do not merge a PR merely to allow cleanup. A temporary clone may be cleaned independently once its required work is durably saved and can be retrieved again, provided no active work depends on that clone.
- Before cleaning a temporary clone, verify its exact identity and ownership, saved results, absence of unsaved staged/unstaged/untracked work, and absence of active executions or dependent work. Use the documented cleanup lifecycle and reconcile its lease/registry records; do not delete directories or edit registry state as a substitute.
- If a branch or clone must remain, record the reason, responsible owner, next action, and review date. Report blocked or unverified cleanup as pending, not complete.
- These responsibilities do not grant new deletion, merge, or publication permissions. Preserve existing approval, lease, identity, snapshot, and safety checks. If a supported cleanup route is unavailable or refuses the action, stop that action and report the specific blocker without bypassing it.

### 作業完了時・日末の保全と通常checkoutへの復帰

- 作業完了時は、依頼範囲と既存の承認条件の内側で関連PRの統合を確認し、通常のローカルcheckoutを最新mainかつcleanへ戻すところまでを目標とする。PR作成までの依頼やレビュー・承認待ちは、完了扱いでマージせず、上記の保持条件に従って残件を報告する。
- 日末に未完の作業がある場合は、その作業ブランチへ対象差分をcommitして保全する。秘密情報、権利未確認の素材、無関係な変更を混入させず、既存の承認・正式手順で安全に実施できない場合は原本を保持し、未保全の範囲と次の対応を記録する。未完作業をmainへ強制的にマージしない。
- 保全を確認した後、他の作業へ影響しない場合に通常checkoutをmainかつcleanへ戻す。実行中・参照中のprocessやworktree、他担当のWIP、未保存のdirty・untracked、未解決の競合がある場合は、branch切替や同期を強行せず、現在の状態と保持理由を残す。reset・stash・差分破棄でcleanを装わない。
- cleanであることとremoteの最新mainへ同期していることは別々に確認し、確認できない状態を同期済みと報告しない。必要なremoteバックアップは既存の許可範囲で行い、local commit済みとremote保存済みを区別する。
- この節はcommit・push・merge・branch切替・main同期・削除の実行権限を新設しない。本人専用承認、repo固有の条件、稼働中作業の保護を維持し、実施済み・保留・次の対応を分けて報告する。
