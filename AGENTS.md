# Repository Agent Instructions

上位workspaceの `AGENTS.md` がある場合は併用し、このrepoの `README.md`、`docs/`、同梱skillの `SKILL.md`、release checklistを作業前に確認する。

## LUNA主担当と上位サブエージェント

- 通常の主担当・統合責任者はLUNAとする。難しい設計、原因未特定bug、複数repo・layer、security・build・deploy・release gateでは、Sol等の上位エスカレーションmodelへboundedな独立reviewを依頼する。
- LUNAは委譲結果を差分と検証結果で確認して採否を決め、最終責任を持つ。上位modelを常時の司令塔へ自動昇格させない。

## AIオーケストレーション

<!-- BEGIN managed:subagent-delegation-policy:v1 -->
### サブエージェント委譲の必須運用

この節は、サブエージェント機能を持つAIクライアントに共通して適用する。本ファイル内の「適宜」「推奨」「小規模なら直接処理してよい」という記述より、この節の客観条件を優先する。

#### 委譲が必須となる条件

次のいずれかに該当し、利用可能なサブエージェント枠がある場合、主担当はタスク分解後、自身が大半の実装・編集を終える前に、少なくとも1件の実作業をサブエージェントへ委譲する。

- 調査、設計、実装、検証、レビューのうち、独立して進められる工程が2つ以上ある。
- 変更対象が3ファイル以上、または2つ以上のdirectory、component、layer、package、repoにまたがる。
- 原因未特定のbug調査、複数案の比較、広範囲のコード読解が必要である。
- user-visibleな挙動、公開API、schema、migration、認証、権限、課金、保存data、build、deploy、CIに影響する。
- ユーザーがサブエージェント、並列作業、独立レビュー、または複数モデルでの検討を明示的に求めた。

開始時に軽微と判断した作業が途中で上記条件へ拡大した場合は、その時点で委譲する。独立作業が2件以上あり、編集競合や共有resource競合が起きない場合は、利用可能な範囲で並列に委譲する。実質的な変更で2枠以上を利用できる場合は、実作業担当と、編集を行わない独立レビュー担当を分ける。

#### 直接処理できる例外

- 既知の単一fileまたは単一操作に閉じ、設計判断、挙動変更、外部state変更を伴わない軽微な作業である。
- 同一file、同一GUI session、同一port、同一transactionなどを共有し、安全に分離できない。
- サブエージェント機能が利用不可、上限到達、または失敗中である。
- 秘密情報、個人情報、本番dataなどのため、安全なscopeへ切り出せない。

必須条件に該当する作業を委譲しない場合は、具体的な理由と代替検証を作業報告に明記する。「自分で行うほうが速い」だけでは例外理由にならない。

#### 委譲と統合の要件

- 委譲依頼には、対象repo/path、目的、担当範囲、読み取り専用か編集可か、変更可・変更禁止file、前提と制約、秘密情報禁止、期待成果物、検証方法、返却形式を明記する。
- 複数agentに同じfileを同時編集させない。調査・レビュー担当は原則読み取り専用とし、複数の編集担当を使う場合は担当pathを重複させない。
- branch切替、commit、push、reset、stash、生成物削除は、coordinatorが明示的に許可したagentだけが行う。
- 同一のGUI、MCP port、database、build directory、cacheを使う操作は並列化しない。
- 主担当はサブエージェントの成果、差分、テスト結果を自身で確認し、未確認のまま採用しない。委譲しても統合責任と最終責任は主担当に残る。
- CodexとClaudeの相互レビューは、利用可能かつ安全な場合に追加で行う。外部クロスレビューだけを、利用可能な内部サブエージェントの代用にはしない。
<!-- END managed:subagent-delegation-policy:v1 -->

<!-- BEGIN managed:github-access-policy:v1 -->
## GitHubアクセスの標準経路

- clone、fetch、pull、branch、commit、push、Draft PR、Ready化、mergeは、接続済みの`workspace-git` MCPを第一選択とし、prepare → 会話承認ボタン → executeの境界を守る。
- `workspace-git`が拒否・未接続・未実装の場合、直接`git`／`gh`／GitHub MCPへ迂回しない。MCP未実装のread-only確認だけは、理由と対象を説明して明示承認を得た場合に限り別経路を検討する。
- Git transportのoriginは同じowner／repositoryを指すSSH URLに限定する。remote変更前に現在の接続先を確認し、非GitHub remote、CI専用checkout、submodule、runtime vendor、ignoreされたnested repositoryへ機械的に適用しない。
- connector失敗をrepository不存在や権限不足と即断しない。SSHが正常な管理PCで、HTTPS remote、PAT、credential helperを場当たり的に試行・変更しない。SSH障害時はaccount、host key、remote owner／repositoryを診断し、無断でHTTPSへ恒久変更しない。
- 秘密鍵path、token、credential値をrepository、ログ、prompt、knowledge本文へ保存しない。通信経路の標準化はcommit、push、PR作成、mergeの許可範囲を拡張しない。
<!-- END managed:github-access-policy:v1 -->
