# Claude Code Instructions

作業開始前に `@AGENTS.md` を全文読み、上位workspaceの `AGENTS.md` がある場合は併用する。サブエージェント委譲の必須条件、例外、編集競合防止、独立レビュー要件は `AGENTS.md` を正本とする。

<!-- BEGIN managed:github-access-policy-bridge:v1 -->
## GitHub access bridge

GitHubのclone／fetch／pull／branch／commit／push、PR操作では、`AGENTS.md`の「GitHubアクセスの標準経路」を必ず適用する。Claude Codeでも接続済み`workspace-git` MCPを第一選択とし、prepare → 会話承認ボタン → executeを守る。MCP拒否時に直接`git`／`gh`へ迂回せず、MCP未実装のread-only確認以外は停止して報告する。
<!-- END managed:github-access-policy-bridge:v1 -->
