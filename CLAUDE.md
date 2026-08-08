# Claude Code Instructions

作業開始前に `@AGENTS.md` を全文読み、上位workspaceの `AGENTS.md` がある場合は併用する。サブエージェント委譲の必須条件、例外、編集競合防止、独立レビュー要件は `AGENTS.md` を正本とする。

<!-- BEGIN managed:github-access-policy-bridge:v1 -->
## GitHub access bridge

GitHubのclone／fetch／pull／push、PR操作、認証fallbackでは、`AGENTS.md`の「GitHubアクセスの標準経路」を必ず適用する。Claude CodeでもGit transportはSSH、PR操作は認証済み`gh`を標準とするが、上位workspaceの`local-mcp`／`workspace-git`優先規則とprepare → 人間承認 → execute境界を優先し、安全拒否を別経路で迂回しない。connector失敗時も上位規則が許可する場合に限ってfallbackする。
<!-- END managed:github-access-policy-bridge:v1 -->
