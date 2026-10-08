<!-- Generated from docs/help/en.json; source SHA-256 1d8a8515cf743144e27893fc6fb1e85fc06b290f1744ab0ebc57665893e6d684. Do not edit this output.
Run node scripts/help/generate.cjs after changing the canonical help.
Requested locale: ja-JP; served locale: ja-JP; status: machine-translated. -->
# ZIAForge ユーザーガイド

意図から検証済みの成果物へ。Code、Work、およびアプリケーション制御の実践ガイド。

英語が正本です。機械翻訳されたヘルプは、人間がレビューした翻訳とは区別してラベル付けされています。自動チェックは、母国語としての正確性を保証するものではありません。

> このガイドは現在の英語ソースから機械翻訳されたものです。人間によるレビューを歓迎します。

## ガイドのセクション

- [はじめに](#start)
- [適切なデスクトップパッケージのインストール](#install-platforms)
- [Code: 5つのルート](#code)
- [Forge ディスカッション](#forge)
- [ドキュメントと決定事項](#decisions)
- [実行とレビュー](#execution)
- [並列レビューチームとレポートアーキテクト](#review-teams)
- [エージェントの専門化とプロンプトポリシー](#specializations)
- [Work: 質問からドキュメントへ](#work)
- [プリセット、モデル、およびアクセス](#models)
- [チャット、「停止」、およびキュー](#chat)
- [ファイル、Git、および完了](#files)
- [API connections](#api)
- [設定、言語、および安全なリセット](#settings)
- [ヘルプアシスタントに質問する](#help-assistant)
- [アシスタントとTelegram](#assistant-control)
- [プライベートTelegramボットの操作](#telegram)
- [所有者専用のネイティブコンピューター権限](#native-permissions)
- [ブラウザとリモートインスタンス](#remote)
- [OpenClaw、Hermesおよびその他の外部エージェント](#external-agents)
- [ローカルCLIと自動化の制限事項](#local-cli)
- [バージョンとアップデート](#updates)
- [再起動とリカバリ](#restart)
- [トラブルシューティング](#troubleshooting)
- [問題の報告とエビデンスの検査](#diagnostics)
- [ローカルデータと境界](#privacy)
- [このオープンソースプロジェクトの理解と変更](#project-contributors)

<a id="start"></a>

## はじめに

ZIAForgeは、ディスカッション、計画、実行、検証を1つのタスク内に保持します。GitプロジェクトにはCodeを、通常のフォルダー内のドキュメント、調査、その他の成果物にはWorkを選択してください。

まずは別のプロジェクトで小さなタスクから始めてください。ネイティブ CLI を選択する場合は、まずターミナルでそれをインストールし、独自のアカウントでサインインしてください。あるいは、API 接続を設定します。CLI サブスクリプションと有料の API は別々の接続方法です。ZIAForge がサインインを行ったり、両者間でクレジットを移動させたりすることはありません。

1. 「設定」を開き、ワークスペースフォルダーと言語を確認します。「バージョン情報」には、実行中のビルドの正確な識別情報が表示されます。
2. Code の場合は、サイドバーで Git リポジトリを追加します。Work の場合は、タスク作成時に別のフォルダーを選択します。
3. CLI、モデル、推論の取り組み、およびアクセスレベルを指定してプリセットを保存します。保存されたプリセットを使用せず、直接「カスタム」を選択することもできます。
4. タスクを作成し、そのルート、ロール、手動または自動の進行を選択します。「開始」の前に選択内容を確認してください。

> メンテナーから提供された成果物とチェックサムを使用してください。プレビューは署名されていないか、公開された更新フィードがない場合があります。デスクトップおよびネイティブプロバイダーのサポートは、正確な OS、アーキテクチャ、成果物に対して検証されている必要があります。ソースコードのサポートのみではリリース認証にはなりません。

関連する指示: [プロジェクトの概要](../../../README.md) · [プロバイダーの互換性](../../PROVIDER_COMPATIBILITY.md).

<a id="install-platforms"></a>

## 適切なデスクトップパッケージのインストール

お使いのオペレーティングシステムと CPU アーキテクチャ（x64 または arm64）に対応したパッケージを選択してください。ビルドパイプラインは、macOS DMG/ZIP、Windows NSIS インストーラー/ZIP、および Linux DEB/RPM/AppImage/tar.gz/ZIP 形式を生成できます。生成されたファイルやクロスビルドは、そのインストーラーやネイティブ UI がお使いのマシンで合格したことの証拠にはなりません。該当リリースの検証記録を参照してください。

Electron 44を使用するmacOSビルドには、macOS 13以降が必要です。Apple Siliconではarm64パッケージを、Intelではx64パッケージを使用してください。置き換える前に、古いアプリを完全に終了してください。プレビューパッケージは未署名かつ公証されていない場合があります。開発成果物を署名済みのパブリックリリースと混同しないでください。

Windowsでは、同梱されているElectronバージョンでサポートされているオペレーティングシステムと、PATHで利用可能なGitが必要です。一致するアーキテクチャを選択してください。未署名のプレビューにはAuthenticode認証がありません。ポータブルなZIPは、実行可能ファイルだけでなく、完全なアプリケーションディレクトリとランタイムファイルを保持している必要があります。

Linux には、互換性のあるグラフィカルデスクトップ、Electron に必要なシステムライブラリ、および Git が必要です。暗号化された制御資格情報には、gnome-libsecret や KWallet など、動作する Secret Service を提供してください。安全でない basic_text バックエンドは受け付けられません。ヘッドレス/コンテナでのスモーク検証の証拠は、あらゆるデスクトップやディストリビューションを保証するものではありません。

DEB は apt install ./file.deb でインストールするか、RPM はディストリビューションのパッケージマネージャーを通じてインストールします。AppImage には実行権限と適切な FUSE サポートが必要です。サポートされている環境では --appimage-extract-and-run も代替手段となります。tar.gz および ZIP パッケージは、すべてのランタイムファイルを含めて展開してください。パッケージを置き換える際は、ユーザーデータとアプリケーションファイルを区別して保持してください。

ソースからビルドするには、通常のElectronインストーラーを含め、Node 24、Git、npm ciを使用します。ネイティブの再ビルドにはプラットフォームツールが必要です。macOSではXcodeコマンドラインツール、WindowsではMSVC C++、Windows SDK、Python、Linuxではコンパイラ、make、Python、pkg-configおよび必要なパッケージングツールが必要です。正確なコマンドと現在のプラットフォームの制限については、PLATFORM_BUILDS.mdに従ってください。

リリースバージョンは中央で一元管理され、出力は不変です。CI検証ビルドは公開されたインストーラーではありません。ソースアーカイブにはソース、ロックファイル、ドキュメント、スクリプトが含まれます。依存関係、認証情報、ユーザープロファイル、プライベートな研究内容は除外されます。x64ビルドの成功から、ネイティブなARMまたはWindowsでの検証結果を推測しないでください。

関連する指示: [プラットフォームパッケージ、前提条件、および検証の制限](../../PLATFORM_BUILDS.md) · [ビルド識別情報とリリースチェック](../../RELEASE_READINESS.md).

<a id="code"></a>

## Code: 5つのルート

Auto は範囲を評価します。単純な質問は回答で終了する場合がありますが、より大きなタスクには準備が必要です。「バグ修正」は原因を調査して修正を準備します。「仕様優先」は技術的な解決策から開始し、「要件優先」は要件と受け入れ基準から開始します。

マルチモデルは、調査、設計、実装、レビューに個別のコンテキストを使用します。ルート名が異なるプロバイダーを要求するわけではありません。各ロールは、選択したプリセットまたはカスタム構成を使用します。

Worktree はタスクの Git の変更を分離します。「ブランチ」は選択したチェックアウトで動作します。開始前にプロジェクト、ブランチ、モデルを確認してください。タスクの説明が通常のチャットにも送信されることはありません。

製品または技術的な選択肢が未解決のアイデアには「要件優先」を使用し、ディスカッションで基礎を構築してください。Auto はリクエストを分類するものであり、あらゆる短いフレーズを直ちに実装するためのコマンドではありません。「下書きを保存」はモデルに接続せずにリクエストを保持し、「開始」は管理対象フローを保存して1回起動します。1〜4個のタスクコピーには独立した作成 ID とロール設定があります。

関連する指示: [Code ワークフロー規約](../../WORKFLOWS.md) · [Code プロンプトプロファイル](../../CODE_WORKFLOW_PROMPTS.md).

<a id="forge"></a>

## Forge ディスカッション

「開始」で中央のディスカッションが開きます。自然に応答し、反論・質問をし、制約を追加して技術的な選択肢を議論してください。会話と質問はタスク内に保持されます。

テキストを送信しても、ドキュメントの受け入れや新しい実装計画の承認にはなりません。実行中の明確化は、まず管理対象ターンを一時停止し、影響を受けるスコープを再確認します。すでに受け入れられたステップ内の質問への回答であれば、そのステップを継続できます。

基礎を意図的に見直すには、「要件」、「仕様」、または「計画」を選択します。新しいバージョンでは、依存する決定事項の新たな受け入れが必要になります。完了したステップとその証拠は残り、置き換えられた未完了のフェーズは履歴に残ります。

管理対象フェーズのセッションは自由なチャットとは異なります。ワークフローが所有するセッションに直接手動プロンプトを送信するのではなく、Forge ディスカッションを使用してください。

関連する指示: [Forge ディスカッション規約](../../WORKFLOWS.md).

<a id="decisions"></a>

## ドキュメントと決定事項

ドキュメントを開き、そのバージョンを確認して、必要に応じて編集を行います。ディスカッションを通じて編集を送信すると新しいバージョンが生成されます。レポートや検証済みの結果が過去に遡って書き換えられることはありません。

提案された計画を受け入れる前に、順序、指示、受け入れ基準、検証コマンドを編集してください。理解している具体的なコマンドのみを承認してください。それらはタスクフォルダー内で実行されます。マルチモデルはタスク全体の実装ステップを1つ提案し、その詳細はドキュメントと指示に含まれます。

「承認」は個別の意図的な決定です。Auto が質問や要件、仕様、計画の受け入れをバイパスすることはありません。外部で変更されたドキュメントで以前の承認を再利用することはできません。

準備ファイルは成果物として表示されます。そのバージョン、生成フェーズ、ハッシュによって成果物に紐付けられます。Code のドキュメントは worktree の外部に保持され、コミットに自動的に入ることはありません。

受け入れる前に、ドキュメントと表示された決定の両方を確認してください。受け入れにより、現在のゲート ID、計画リビジョン、および保持されているドキュメントハッシュがバインドされます。範囲や証拠が誤っている場合は「変更をリクエスト」してください。決定が古くなった場合は、新たな選択を行う前に保存された状態を再読み込みしてください。変更されたファイルを以前のバージョンのまま受け入れることはできません。

関連する指示: [ワークフローゲートとドキュメントバージョン](../../WORKFLOWS.md).

<a id="execution"></a>

## 実行とレビュー

「To-do」には、実際の手順、現在の試行、検証、およびレビューの結果が表示されます。エージェントが「完了」と言ってもステップが完了したことにはなりません。計画で要求されている証拠が存在する必要があります。

手動モードでは、該当するステップ間で一時停止します。Auto は検証済みステップを進め、制限付きの再試行を許可します。「指定後に停止」は常にチェックポイントを作成します。「一時停止」はワークフローのアクティブな作業を停止します。パネルを閉じても停止することはありません。

独立したレビュアーは、ファイルと検証結果を含む独立したコンテキストを使用します。必須とされているすべてのブロッキング指摘事項は解決されなければなりません。複数のレビュアーの多数決でブロッキングエラーを無効化することはできません。

マルチモデルでは、指摘事項の修正に明示的な決定が必要です。修正によって別のレビューが暗黙的に開始されることはありません。「再レビュー」で新たなサイクルが開かれます。レビューコメントにより、実装を繰り返すことなくコーディネーターに再検討を要求できます。

完了したステップを暗黙的に編集することはできません。TDD では、Red は期待される理由で実際に失敗する必要があり、その後に Green がパスしなければなりません。試行回数の制限により、無限の再試行を防ぎます。

設定 → レビューチーム で独立した CLI/API レビュアーを保存し、Code または Work でそのチームを選択します。レビュアーは並行して実行され、その後にチームのレポートアーキテクトが続きます。チームを保存せずに独立したレビュアーを構成することも可能です。レポートアーキテクトは匿名化された構造化レポートのみを受け取り、プロジェクトファイルやツールは持ちません。この分離には現在 Claude Code または API が必要です。

各実装ステップには、実行可能なチェック、必須の独立レビュー、またはその両方が必要です。一方、準備フェーズでは検証済みの結果と成果物の受領通知が保持されます。これらは実装テストが実行されたかのように見せかけるものではありません。コマンドは、実際の終了ステータスとその所有プロセスのクリーンアップが確認された場合にのみ成功となります。TDD の Red チェックは、実装および Green の検証の前に正常に失敗しなければなりません。実行ファイルの欠落やタイムアウトは有効な Red の結果ではありません。

デフォルトのサーキットブレーカーは、1つのステップで3回、または合計50回失敗した後に停止します。中断は試行を1回消費しますが、それ自体は失敗した試行としてはカウントされません。制限と完了した証拠は再起動後も保持され、「再試行」してもリセットされません。別の試行を承認する前に、保持されている失敗内容を確認してください。

関連する指示: [検証とレビュー](../../WORKFLOWS.md).

<a id="review-teams"></a>

## 並列レビューチームとレポートアーキテクト

設定 → レビューチーム を開き、チームを保存します。独自の CLI または API、モデル、推論の取り組み、専門化を備えた独立したレビュアーを追加し、レポートアーキテクトを選択します。タスクのレビュー構成でチームを選択してください。実行者プリセットをレビュアーが使用することもでき、「カスタム」も引き続き利用可能です。独立したロールには引き続き個別のコンテキストがあります。

レビュアーは同一のタスク証拠に対して並行して実行されます。必要な各レポート、エラー、判定が保持されます。アーキテクトは、レビュアー名、モデルやプロバイダーの識別情報、元のタスク内容、リポジトリアクセス、ツールのない、匿名化された番号付きレポートを受け取ります。レポートを比較して1つの構造化された判定を返します。新たなソースレビューを実施することはありません。

ブロッキング指摘事項や必須レビュアーによる却下は、多数決やアーキテクトの意向によって免除されることはありません。レポートの欠落や不正な形式は承認を妨げます。受け入れや修正の承認を行う前に、個々の指摘事項と集約された決定を確認してください。保存されたチームは実行用に解決されて固定されます。そのプリセットを編集しても、完了した証拠が書き換えられることはありません。

レポート専用アーキテクトは、現在サポートされている Claude または API のツールなし構成を使用します。Codex および Antigravity は引き続きレビュアーとして利用可能ですが、検証済みのツールなし規約が存在するまでは、この隔離されたアーキテクトロールとしては拒絶されます。「ツールなし」というプロンプトだけでは不十分です。

> Code マルチモデルの設計/レビューパイプラインと、保存された並列レビューチームは個別の制御です。選択したカスタムレビューポリシーを維持してください。1つのルートがすべてのレビュー機能を有効にすると想定しないでください。

関連する指示: [型付けされたチーム構成](../../../shared/review-team.ts) · [レビュー集約](../../../electron/workflow/ReviewAggregation.ts).

<a id="specializations"></a>

## エージェントの専門化とプロンプトポリシー

モデルは実行エンジンであり、専門化は指示プロファイルです。追加の専門化を行わない場合は「なし」、デフォルトガイドには「標準」、関連する組み込みガイドには Auto、選択したガイドと独自の制限付き指示には「手動」を選択します。プリセットに選択内容を保持できます。

オリジナルのカタログは、一般的なコーディング、アーキテクチャ、セキュリティ、信頼性、パフォーマンス、テスト、インターフェースの使いやすさを網羅しています。Auto は利用可能なタスク/ステップのテキストを使用してガイドを選択します。秘密裏に別のモデルを呼び出したり、専門知識を証明したりするものではありません。計画の提案は、実装計画を受け入れる前に検査および変更できます。

レビューの専門化は注意を向けるのに役立ちますが、独立した証拠、アクセス制限、または構造化された判定に取って代わることは決してありません。カスタムの指示はタスクのスコープの一部として扱ってください。ドキュメントの受け入れ、ツールポリシー、認証、またはレビュアーの不合格を回避するために使用しないでください。

関連する指示: [オリジナルプロンプトカタログ](../../../shared/specializations.ts).

<a id="work"></a>

## Work: 質問からドキュメントへ

Work は Git を必要としません。「デフォルト」は個別のタスクフォルダーを作成し、「カスタム」はネイティブピッカーを通じて既存のフォルダーを選択します。「下書きを保存」は推論を行わずに設定を保存し、「開始」は最初のフェーズを実行します。

Auto は直接回答するか、実際の To-do を含む適切な計画を提案します。「ブレインストーミング」は ideas.md を作成し、その後さらなるアイデアまたは評価を選択します。「リサーチ」は findings.md、情報源、および制限事項を保持します。「執筆」は意図から、そして有用な場合は outline.md から説明的なドキュメントまたは draft.md へと進みます。改訂では以前のバージョンが保持されます。

ネイティブピッカーで入力ファイルを選択し、@ で参照します。アプリはそれらを不変のタスク入力としてコピーし、実行前にその識別情報を検証します。「デフォルト」はアプリケーションが所有するタスクフォルダーを作成します。「カスタム」フォルダーへのアクセスは、保存された所有者権限付与です。保存された未開始の下書きは、そのフォルダーを変更できます。

独立した実行者設定で 1〜4 個のコピーを作成します。重複するフォルダーを使用するタスクは同時に書き込みを行うことができません。この調整は ZIAForge の操作に適用され、任意の外部プログラムには適用されません。

Deep Brainstorm はデフォルトで3人の独立したワーカーを使用し、最大8人までサポートします。個別のコンテキストでのプリセットの再利用を含め、ワーカーの順序と構成を選択してください。ワーカーの質問は元の発生源を保持し、不正な形式のレポートには1回の形式修復の試行が行われます。部分的な失敗は全員一致の成功として提示されるのではなく、可視化されたままになります。

Deep は保持されたワーカーレポートを brainstorm_report.md に結合し、常にユーザーの決定を求めます。軽微なフォローアップではコーディネーターを通じてレポートを改訂し、大幅な変更では固定されたワーカーの新たなラウンドを開始します。成果物はそのバージョンを維持します。

解決されたロールはタスク作成時または明示的な下書き保存時に固定されます。最初の呼び出し以降は、自動/手動の進行のみ変更できます。異なるロールやモデル設定には新しいタスクを使用してください。グローバルプリセットを編集しても、以降のフェーズが暗黙的に変更されることはありません。

手動モードでは、内容の多い「執筆」のアウトラインを含め、該当するフェーズ間で一時停止します。Auto はそのアウトラインを通じて続行できます。質問、提案された実行可能計画、「ブレインストーミング」の方向性、および Deep レポートのレビューは、Auto においても明示的な決定のままです。引用があることのみではブラウジングが行われたことの証明にはならず、バイナリファイルが保持されていることのみではそのレンダリングの証明にはなりません。

関連する指示: [Work のモードと決定事項](../../WORK_WORKFLOWS.md).

<a id="models"></a>

## プリセット、モデル、およびアクセス

プリセットは、CLI/API、モデル、推論の取り組み、および権限を保存します。チャットのフッターには、プリセット、CLI、モデル、およびオプションのセグメントがあります。「カスタム」はプリセットなしで動作します。「プリセットを作成」で現在の選択内容が保存されます。

カタログは、サポートされている場合、選択されたインストール済みの CLI または API から取得されます。「更新」は選択を変更せずにリストを更新します。検出が利用できない場合は、明示的なモデル ID を入力してください。ただしプロバイダーがそれをサポートしている必要があります。推論レベルはモデルと CLI に依存します。「プロバイダーのデフォルト」は明示的な none トークンとは異なります。

バックエンドの確認応答があった後にのみ変更を適用してください。アクティブなターン中またはキューが空でない場合、切り替えは制限されます。下書きと表示されている履歴は残りますが、プロバイダーを変更しても非公開の内部状態は引き継がれません。

Forge では、ロールラベルが重要です。準備段階では別のプランナーを使用できます。フッターにより表示されるロールが変更されます。レビュアーとヘルパーはワークフロー設定で選択されます。すでに検証済みの実装に関するポリシーはロックされている場合があります。

権限はプロバイダーによって異なります。「読み取り専用」と「ワークスペースへの書き込み」は、アダプターがサポートしている場合に使用可能です。Antigravity は、ネイティブの CLI 設定または明示的に選択されたフルアクセスを使用します。フルアクセスはサンドボックスではありません。

専門化はプロンプトのガイダンスを追加するものであり、別のモデルや権限を追加するものではありません。プリセットとロールは「なし」、「標準」、Auto、および「手動」をサポートします。Auto は追加のモデル呼び出しなしでステップのテキストからプロファイルを選択します。「手動」は最大4つの専門分野とカスタム指示を受け付けます。プランナーが提案した割り当ては、計画を受け入れる前に編集できます。

手動で入力したモデル ID や取り組みは自由な選択ですが、プロバイダーによって拒否される場合があります。グローバルプリセットを編集しても、実行中のチャットや受け入れ済みの計画が遡及的に変更されることはありません。アイドル状態の会話を意図的に変更するには、その会話自体の設定コントロールを使用して確認応答を待ってください。無効化されたオプションは機能またはライフサイクルの制限と解釈すべきであり、保存された JSON を編集して回避してはなりません。

関連する指示: [プロバイダーの機能](../../PROVIDER_COMPATIBILITY.md).

<a id="chat"></a>

## チャット、「停止」、およびキュー

開いているタブ、「最近」、および下書きは1つのタスクに属します。タブを閉じると「開いている」からは削除されますが「最近」には残り、プロバイダーのプロセスや管理対象ワークフローが停止することはありません。履歴メニューから履歴の検索、チャットの再開、または追加のタブをすべて閉じることができます。

「停止」は現在のターンを中断します。次の「送信」を行う前に停止が完了するのを待ってください。中断の確認はプロセスの完了を意味しません。その間、次の下書きを入力することは可能です。

通常のチャットでは、「キュー」によって以降のリクエストが現在の下書きとは別に保存されます。「キューを一時停止」は以降の配信を保留します。「停止」および「終了」はキューを一時停止します。再起動後は、まず「再開」し、その後明示的に「キューを続行」してください。

「不確実」は配信状態が不明であることを意味します。そのようなメッセージが自動的に再送信されることはありません。履歴を確認し、適切であればテキストをコピーして、キューに入ったアイテムを破棄してください。それを再度送信することは、新しい意図的なリクエストとなります。

管理対象フェーズのチャットは通常のキューではなく、それぞれのワークフローを使用します。「ステージに追従」は現在のフェーズを表示します。手動で別のタブを選択すると追従が停止します。CLI ログには、応答とは別に診断情報が表示されます。

Markdown の応答では、見出し、リスト、テーブル、リンク、およびフェンスで囲まれたコードがレンダリングされます。ツールカードと CLI 診断情報は回答とは分かれたままです。モデルから報告された思考やトークンメトリクスは、プロバイダーが実際にそれらを公開している場合にのみ表示されます。アニメーションから非公開の推論や使用量を推測しないでください。

不確実な送信またはキュー受付の後は、履歴を確認し、提示されている場合は保持された同一のリクエストのみを再試行してください。キューの受領通知はストレージがアイテムを受け付けたことを意味し、推論が完了したことを意味するものではありません。不確実なキューアイテムの削除は明示的な破棄としてのみ行い、すでに配信されたプロンプトを取り消すことはできません。

関連する指示: [永続的メッセージキュー](../../MESSAGE_QUEUE.md).

<a id="files"></a>

## ファイル、Git、および完了

「ファイル」にはタスクフォルダーが表示されます。結果を要件と比較し、ドキュメントを開き、diff を検査します。バイナリファイルを保持していても、対象アプリケーションで正しくレンダリングされることの証明にはなりません。

Git は、ステータス、変更点、および結果が記録された操作を提供します。コミット、マージ、プッシュはデフォルトで手動です。自動操作は、完全に検証された計画に対する個別の選択肢です。

検証から公開までの間に作業ファイルを変更しないでください。承認は正確なバイトに紐付けられています。コンフリクト、プッシュの失敗、および不明な操作結果は、明示的な決定が行われるまで進行をブロックします。Auto が公開を暗黙的に承認することはありません。

Work は Git ブランチを作成せず、Git の完了処理もありません。バージョンやソースを含め、選択したフォルダーから必要なドキュメントを保持してください。

ファイルエディターは、拡張子別の構文、検索と置換、元に戻す履歴、行の折り返し、およびタブごとの下書きを提供します。保存時はサポートされている UTF-8/UTF-16 エンコーディングが維持され、外部変更の競合は拒否されます。その他のエンコーディングやバイナリコンテンツには外部エディターが必要です。未保存の下書きがある場合、所有者が保存または破棄するまでアプリケーションの「終了」はできません。

完全な構文機能は最大 8 MiB まで有効です。それ以上の大きさのテキストファイルは 256 KiB のウィンドウで開きます。8〜64 MiB は構文機能なしで明示的に全体を読み込むことができます。64 MiB を超える場合は、ウィンドウ編集と制限付きの次一致検索を使用してください。これは制限付きの大規模ファイルモードであり、任意の大きなドキュメントに対する Sublime Text と同等の機能ではありません。

「フォルダーを開く」では、元のリポジトリのみを暗黙的に開くのではなく、現在のタスクまたはブランチ/worktree のコンテキストを使用します。ファイル行からそのファイルの親ディレクトリを表示できます。パスはバックエンドによって登録済みのタスク権限と照合され検証されます。バイナリファイルはプレーンテキストとして編集できません。対象のビューアーを使用し、元のバイトを保持してください。

Worktree の削除は、個別の保護されたアクションです。削除する前に、アイドル状態のセッションも含め、接続されている構造化セッションとターミナルを終了してください。保存された Git の結果とリカバリ状態を確認してください。タスクレコードの削除は、コミットされていない作業を安全に保持することの代わりにはなりません。

関連する指示: [型付けされたエディター規約](../../../shared/editor.ts) · [Git ポリシー](../../WORKFLOWS.md).

<a id="api"></a>

## API connections

> ガイドの全文はまだ選択されたインターフェース言語に翻訳されていません。英語の参照用ガイドを表示しています。

Connections adds an explicitly selected OpenAI-compatible endpoint. Enter a name, base URL, model and a key if needed. Select Chat Completions for existing integrations or Responses for function rounds, provider tool progress and generated images. Existing connections retain Chat Completions until you change them explicitly. For an existing connection, Set up Responses opens a draft for that same endpoint; review the profile and click Save connection. Choose Codex connector or Grok Connector v1 only for a gateway that supports that extension. The saved key is retained when the endpoint is unchanged and the key field stays blank.

HTTPS is required except for loopback HTTP. Use a plain endpoint without credentials, queries or fragments. Redirects are refused. Keys use supported OS encryption and are never returned to the UI. Changing the endpoint requires re-entering or clearing its key. Leaving the key field blank preserves a saved key.

Workspace file tools execute in the backend-resolved local task folder, with relative paths and checks against traversal and links. Every file write needs explicit approval and an unchanged expected revision. Read-only sessions expose only read tools. In Responses, Allow local commands separately enables approved executable/argument calls on macOS and Linux. Command supervision is unavailable on Windows; the adapter does not advertise that tool there. Commands always require owner approval and are not an operating-system sandbox.

The Codex connector profile identifies that gateway’s Responses tool-progress extension. Native provider tools execute on the server, separately from caller tools on your computer. Local read-only permissions do not constrain the server. A connector cannot be selected for a report-only architect that requires all tools disabled: unsupported isolation fails rather than silently allowing native tools. Select an endpoint that can enforce the required policy.

Generated PNG, JPEG and WebP results appear as separate image cards, with Save image, outside collapsed tool output. Images are validated and kept in private application storage; model-supplied URLs and Markdown images are not fetched automatically. Opening saved history, retrying an image read and saving a cached image do not request a new generation. Results are bounded to 32 MiB and 32 million pixels per image, with a shared 512 MiB private media cache. Preserve needed images before manually clearing the private cache if it becomes full. Click a chat image to open the image viewer. Zoom in or out, choose Actual size (100%) or Fit to window, and drag to inspect a detail. Escape or Close image viewer returns to the chat. Viewing and zooming reuse the loaded private image; they do not request a new generation.

Responses conversations retain the acknowledged response identity and exact function call IDs. Interrupted inputs are not automatically resent. An uncertain local edit or command is not rerun after restart; preserve the history and explicitly create a new context after inspection. Changes to a saved transport or endpoint require explicit reconfiguration. Provider status, cancellation and expiry failures are reported without hiding them behind a CLI fallback. The chat header shows the protocol pinned to that run. After saving connection changes, open the chat’s CLI / API selector and click Apply, even if the same connection is already selected. This creates a new run with the saved configuration and retains chat history. Saving a connection alone does not migrate active chats. Older text-only image links remain text; switching protocol does not regenerate or import previous results.

API connections use their configured endpoint and authentication, separately from native CLI subscriptions. Some gateways use subscriptions internally; ZIAForge does not copy native authentication into an API. Models, tool policies, reasoning parameters and billing depend on the endpoint. Discovery alone does not prove inference. Keep keys in Connections, never in task prose or screenshots.

For Grok Connector v1, save an explicit Responses connection and use Inspect connector to read its advertised capabilities, models and usage without running inference. Model reasoning levels and context window choices come from the catalog. The optional native turn limit is 1–100. Missing quota percentages remain unknown; the usage period end is not a subscription payment or expiration date. Apply connection changes in each existing chat before they take effect there.

Grok questions appear as cards with the exact native question and option labels. Choose the requested answers or enter a custom response, then send once. Plan interviews can offer discussion or skip actions. Provider permission cards show the exact native choices and require your selection by default. These differ from local file/command approvals. Stop, expiry or restart makes old cards inactive; an uncertain submission is not repeated automatically.

In Connections, a Grok connection can enable Automatically approve one-time provider permissions; it is off by default. This applies to new chats or an existing chat after you explicitly reconfigure it with Apply. Saving the connection alone does not change a running chat. When enabled, ZIAForge automatically submits only one unambiguous, unexpired one-time permission offered by Grok and records that automatic decision before sending it. The card identifies an automatic approval. Questions and local file or command approvals still require your answer. Read-only chats keep manual provider permissions. Persistent permissions are never selected automatically; missing or ambiguous one-time choices remain manual. Old or uncertain submissions are never replayed or retried automatically.

In a Grok chat, the attachment button opens the system picker for PNG, JPEG and WebP. Four images are allowed per message, up to 16 MiB each and 20 MiB combined, with 32 million pixels per image. Private draft copies have a 128 MiB budget and belong to that chat run. They are transmitted only when you send. Failed or uncertain sends retain their draft identities. Image messages cannot use the text-only queue. Remove or explicitly discard a pending image draft before changing or resuming its run; discarding a draft does not undo an already delivered message. Accepted image messages retain private image cards for later inspection, zoom and saving.

Grok provider tools are restricted to supported web retrieval, images, interactive questions and capability-gated video generation. Local project tools still execute on the computer in the backend-selected task folder. Read-only review excludes provider image/video generation and editing, questions, local writes and commands. Tool-free Help and report-only architect sessions cannot use this connector profile. Audio generation, transcription and realtime voice are not offered; an MP4 may contain its normal audio track. A discovered tool alone is not evidence of a usable result.

For video, use a writable Grok chat, attach a reference image or continue the chat that created one, and describe the motion and desired parameters. To choose an older image explicitly, use Save image and attach the saved file. Viewing or saving the image does not regenerate it. There is no separate video-parameter form: the request uses the conversation and its native questions/permission cards. Before a new user turn, ZIAForge enables only video tools that the connector advertises as available, enabled and verified. Discovery failure leaves video unavailable for that turn. Changes in native capabilities can start a new provider context with your visible history and eligible cached images while keeping the local chat; interrupted operations are not replayed. If an image cannot fit the attachment limits, the handoff reports that omission; attach the intended reference explicitly.

The connector offers image_to_video with a required reference image, 6 or 10 seconds and 480p/720p presets. Its reference_to_video mode supports 1–15 seconds and aspect ratios 1:1, 16:9, 9:16, 4:3, 3:4, 3:2 or 2:3; the agent may generate a reference first when needed. Request the intended settings in chat. ZIAForge does not expose the separate /grok/media endpoint or its auto selector. Presets and supported parameters are provider capabilities, not a guarantee of exact pixel height, frame timing or every artistic result.

A completed Grok video appears only after the protected MP4 file is downloaded and its MIME, size, SHA-256 and structure are checked. Text saying a video is ready, an image fallback or a storage link is not a playable video. Errors remain visible without requesting a replacement generation. Use the video card controls to play, pause, seek or adjust sound when present. Playback does not start automatically. Save video opens the system destination dialog. Saved chat history retains the private MP4 after a full application Quit/restart; playback and saving use local bytes without inference or another provider download. Videos are limited to 128 MiB each within the shared 512 MiB media cache. Save needed media before manually clearing a full cache. The computer must support the video codec; unsupported or damaged files show an error.

関連する指示: [API connections](../../API_CONNECTIONS.md) · [Grok Connector v1](../../GROK_CONNECTOR.md).

<a id="settings"></a>

## 設定、言語、および安全なリセット

一般設定では、ワークスペース、インターフェース言語、デフォルトを選択します。「接続」では API エンドポイントを管理します。プリセットとレビューチームはロール構成を保持します。「リモート制御」ではローカルの資格情報、サーバーのスコープ、所有者権限を管理し、「アップデート」ではリリースのソース/チャンネルを管理します。「バージョン情報」には、実行中のビルドの正確な識別情報が表示されます。

インターフェース言語は、プロンプト言語およびドキュメントのレビュー状態とは別個のものです。製品名、コマンドID、ファイル拡張子、プロバイダーモデルID、およびユーザー作成名は識別子のまま維持されます。ヘルプは、最新の翻訳が利用可能な場合は選択されたインターフェース言語に従います。機械翻訳にはその旨が表示され、英語が正規のリファレンスとして維持されます。

「保存」を押すと、表示されている設定が適用されます。データベースのリセットまたは初期化（ファクトリーリセット）を行うと、アプリケーションのメタデータが削除される可能性があります。リセットを意図的に使用する前に、ファイルを保持し、テスト済みのバックアップを用意してください。これらの操作はローカル所有者のアクションです。失敗したワークフローや破損したレコードを調査するための近道として使用しないでください。

関連する指示: [ローカライズ手順](../../LOCALIZATION.md) · [データ復旧](../../DATA_RECOVERY.md).

<a id="help-assistant"></a>

## ヘルプアシスタントに質問する

ヘルプを開き、そのアシスタントパネルで保存済みの接続プリセットを選択して、ZIAForgeについて質問してください。回答には最新の正規英語版ガイドとお使いの選択されたインターフェース言語が使用されます。セクション参照ボタンを押すと該当するガイドトピックが開くため、説明とリファレンスを見比べることができます。

このアシスタントは、最大100件の保存エントリーおよび3 MiBまでの独立したプライベート会話を保持します。最大12,000文字の質問を入力してください。「送信」で質問し、「停止」で質問を手元に残したままアクティブな回答をキャンセルし、「クリア」でこのヘルプ会話を削除します。未送信の下書きとプリセットの選択は、同一アプリセッション内でヘルプを閉じたり再度開いたりしても維持されますが、下書きはディスクには保存されません。アシスタントがアプリケーションコマンドを送信したり、ワークフローを変更したり、ゲートを承認したりすることはありません。アドバイスは、タスク、アカウント、外部接続のライブ検証ではありません。

Claude CodeおよびAPIヘルプセッションでは、サポートされているツール不使用ポリシーが適用されます。ネイティブのCodexおよびAntigravityヘルプセッションには、既存のローカル所有者ネイティブコンピューター権限が必要です。無効になっている場合、アプリは別のプロバイダーを選択するのではなく、前提条件を説明します。有効化できるのはローカル制御設定の所有者のみであり、アシスタント自身が有効化することはできません。

Codexヘルプは読み取り専用サンドボックスを使用し、ツールの承認リクエストを拒否します。Antigravityはplanモードとそのネイティブサンドボックスフラグを使用します。これらのネイティブモードは、オペレーティングシステムの完全な隔離を保証するものではありません。ソースガイドのハッシュによって回答に使用されたリファレンスが特定されますが、生成された説明に誤りが含まれる可能性は残るため、行動する前に関連セクションを確認してください。過去の回答は、そのソースガイドのバージョンが現在のガイドと異なる場合にマークが付けられます。

関連する指示: [正規ガイドと翻訳の保守](../../HELP_MAINTENANCE.md) · [アプリケーションアシスタントと権限](../../AGENT_CONTROL.md).

<a id="assistant-control"></a>

## アシスタントとTelegram

アシスタントは、選択されたプリセットと同じアプリケーション制御APIを使用します。状態を検査する権限と操作を実行する権限は分かれています。コマンドと結果を必ず検査してください。アシスタントの説明文は、アクションが完了したことの証明にはなりません。

Telegramは、ローカル所有者のみが、既存のボットトークンと数値の所有者IDを使用して有効化できます。制御はその所有者のプライベートチャット専用です。未設定または非アクティブなボットがアプリケーションメッセージを受信してはなりません。

通常のチャットにボットトークンを貼り付けないでください。連携を設定しても、Telegramの接続性が証明されるわけではなく、ボットが自動的に作成されることもありません。スクリーンショットや応答には、ワークスペースのプライベートデータが含まれる場合があります。

アシスタントプリセットを選択し、アプリケーション操作の権限を検査とは別に付与してください。CodexおよびAntigravityアシスタントの実行には所有者のネイティブ権限が必要であり、ツール不使用のAPIやClaudeセッションに暗黙のうちに置き換えられることはありません。スクリーンショットはアシスタントの会話に表示できますが、現在のモデル入力には画像解析が含まれていません。アシスタントが画像を表示したからといって、視覚的に検査したと思い込まないでください。

アシスタントは、型定義されたツールを介して、要約、タスク、チャット、ワークフロー状態、プロセスコンテキスト、およびアプリケーションウィンドウを検査できます。また、許可された通常設定の変更や、承認されたアプリケーション操作の起動が可能です。ネイティブ権限の付与、保存された資格情報の開示、ルートワークスペース権限のリモート変更、あるいは単に都合が良いという理由でForgeゲートを承認することはできません。

関連する指示: [アプリケーション制御コントラクト](../../AGENT_CONTROL.md).

<a id="telegram"></a>

## プライベートTelegramボットの操作

ご自身のボットを作成または取得し、そのプライベートチャットを開始して、ローカル制御設定にボットトークンと数値のTelegramユーザーIDを入力してください。アプリを接続させる意図がある場合にのみ、連携を有効化します。所有者IDはユーザー識別子であり、ユーザー名やボットIDではありません。その同じプライベートチャット内の、そのユーザーからのメッセージのみが受け付けられます。

実行中のバージョン、プロジェクト/タスク数、およびタスクステータスの概要を確認するには、/start、/menu、または/statusを使用します。ボタンを押すと、「プロジェクト」、「タスク」、「スクリーンショット」、「ヘルプ」、「言語」が開きます。リストは1ページあたり8項目表示され、「戻る」、「更新」、「ホーム」、および「前へ/次へ」のナビゲーションが備わっています。プロジェクトボタンでタスクリストを絞り込むことができます。タスクカードには、保存されたワークフローの進捗状況、モデル/プリセット、および保留中の質問がある場合はそれが表示されます。

タスクの「チャット」を開くと、進行中/最近の会話やワークフローフェーズのチャットをプレビューできます。各プレビューには最新のユーザー/アシスタントメッセージが最大6件表示され、それぞれ視覚的に200文字に短縮されます。プライベートな推論思考は表示されません。履歴を読んでもプロバイダーは起動しません。プレビューは読み取り専用です。通常のテキストや/ask TEXTは引き続きアプリケーションアシスタント宛てとなり、閲覧中のタスクチャットに暗黙的に向けられることは決してありません。

「実行 / 続行」は現在のCodeまたはWorkワークフローを再読み込みし、対象となる保存済みワークフローを開始します。「一時停止」はその一時停止を要求します。どちらも要件、仕様、計画、レビュー結果、質問を承認するものではありません。保留中の決定事項があると「実行」は阻止されます。決定はアプリケーション内で行うか、正確な現在のゲートとリビジョンを指定して明示的に承認された型定義コマンドを使用してください。

「言語」または/languageを使用して、56のインターフェース言語のいずれかをその現地語名で選択します。これにより、このボットと所有者専用の設定が保持されます。「アプリの言語を使用」を選択すると、その設定がクリアされます。これによりアプリケーションの言語やアクセス権限が変更されることはなく、既存のメッセージが自動的に再送信されることもありません。

ナビゲーションを行うと、通常は同じ公開済みメニューメッセージが更新されます。ボタンには不透明な識別子があり、15分後に期限切れとなり、1回のみ使用できます。カードを変更すると、その古いボタンは無効になります。期限切れ、使用済み、メッセージの不一致、および過去のプロセスのボタンではアクションを実行できません。確定的に編集不可能なメッセージは新しいカードに置き換えることができますが、原因不明のネットワークエラーが発生しても新しいメッセージとして再試行されることはありません。

有効化時、ポーラーは過去の未処理メッセージ（バックログ）を破棄し、ディスパッチ前に更新の受付を記録するため、中断されたコマンドが再起動時に自動的に再実行されることはありません。これにより再実行は防止されますが、完了が保証されるわけではありません。エラー発生後に意図的に新しい作業を発行する前に、ステータス/コンテキストを確認してください。タスクステータスの自動通知はありません。

明示的なコマンドは引き続き利用可能です：/projects、/tasks、/task TASK_ID、/run TASK_ID、/pause TASK_ID、/screenshot、および/ask TEXT。/new {JSON}は型定義されたcreateTaskを介してタスクを作成し、/command {JSON}は明示的なカタログコマンドを送信します。引数の形式については最新のカタログを参照してください。アプリケーション内と同様に、同一のバックエンド認証とフォルダー権限が適用されます。

アプリが保存されたボットトークンの値をアシスタントに送信することは決してありません。それにもかかわらず、スクリーンショット、要約、および会話テキストにはプロジェクトの機密情報が含まれる可能性があります。ボットや所有者アカウントが信頼できなくなった場合は、ローカルで連携を停止してください。トークンが漏洩した場合はボットプロバイダー側でローテーション（再発行）し、ローカルの暗号化設定を更新してください。

関連する指示: [プライベートボットとコマンド](../../AGENT_CONTROL.md).

<a id="native-permissions"></a>

## 所有者専用のネイティブコンピューター権限

ネイティブコンピューターアクセスはデフォルトで無効になっています。ローカルの「設定 → リモート制御」で有効化できるのは所有者のみです。アシスタントやHTTP/MCP/Telegramコマンドが、自身のためにこのフラグを有効化することはできません。操作が拒否された場合、アシスタントはその設定について説明し、所有者に判断を委ねる必要があります。

明示的に有効化されている場合、computer.runは実行可能ファイル、引数配列、およびオプションの絶対作業ディレクトリを受け付けます。シェルの展開は使用されず、30秒の制限があり、出力は1 MiBに制限されます。指定されたディレクトリが存在しないか無効な場合は拒否されます。cwdを省略した場合はHOMEではなく、アプリが所有する設定ディレクトリが使用されます。「終了」は、所有されているアクティブなコマンドをキャンセルし、そのプロセスのクリーンアップを待機します。

アプリケーションの読み取り/操作スコープとネイティブアクセスは、別個の決定事項です。ワークツリーは、制限のないプロバイダーのファイルシステムアクセスを制限するものではありません。タスク終了後にネイティブアクセスが不要になった場合は取り消し、アシスタントの説明文を証明として受け入れるのではなく、コマンドのレシートを検査してください。

関連する指示: [所有者限定の制御コントラクト](../../../shared/control.ts).

<a id="remote"></a>

## ブラウザとリモートインスタンス

ローカル所有者はサーバーを有効化し、そのアドレス、ポート、およびスコープ（検査用のread、またはアクション用のoperate）を選択します。デフォルトの127.0.0.1アドレスはこのコンピューター上でのみ利用可能です。0.0.0.0はネットワークインターフェース全体でリッスンするため、有効化する前にネットワークアクセスを確認してください。

トークンログイン後、ブラウザで同じインターフェースが開きます。公開リンクやスクリーンショットにトークンを含めないでください。HTTP単体では通信が暗号化されないため、信頼できないネットワーク上では保護されたチャネルを使用してください。

所有者はURLとトークンによって他のインスタンスを設定します。バックエンドはリクエストをプロキシしますが、これによりプロジェクトがローカルマシンにコピーされるわけではありません。アクションを実行する前に、選択されているインスタンスを必ず確認してください。

型定義されたコマンドとイベントがアプリケーション制御を伝達します。readスコープではタスクの変更は許可されません。ネイティブコンピューター制御はローカル所有者による個別の選択事項であり、最初は無効になっています。

ブラウザ、Telegram、および外部エージェントによる制御を行うには、アプリを実行し続ける必要があります。各インスタンスには、独自のプライベートプロファイル、タスク状態、トークン、およびサーバーポートがあります。独立したインスタンス間で1つのプロファイルを同時に再利用しないでください。ブラウザのイベントとコマンドの応答は選択されたインスタンスに限定されます。UIを切り替えても、ファイルが再配置されたりネイティブログインがコピーされたりすることはありません。

関連する指示: [HTTPとインスタンス制御](../../AGENT_CONTROL.md).

<a id="external-agents"></a>

## OpenClaw、Hermesおよびその他の外部エージェント

認証済みのアプリケーション制御APIまたは同梱のMCP stdioブリッジを使用してください。ローカルでサーバーを有効化し、read（読み取り）またはoperate（操作）を選択した上で、該当インスタンスのURLとトークンを使用して各クライアントを設定します。スタンドアロンのMCPブリッジを実行するにはNode.js 22以降が必要です。Electronアプリはお使いのエージェントクライアントをインストールしません。ブラウザのURLはストリーマブルなHTTP MCPエンドポイントではないため、stdioブリッジにZIAFORGE_URLとして指定してください。

このブリッジは、ziaforge_status、ziaforge_commands、ziaforge_command、およびziaforge_screenshotを公開します。まずはステータスと最新のコマンドカタログから開始し、その後選択したタスクのsystem.contextを読み取ってください。型定義されたコマンドは、ローカルUIと同じリビジョン、ゲート、タスクフォルダー、およびクリーンアップのチェックに従います。

最新のコマンドカタログには、正規の英語版ヘルプであるdocumentation.guideが、そのソースパスおよびsourceSha256とともに含まれています。内部のアプリケーションアーキテクトも、自身のツールを通じて同じリファレンスを受け取ります。これにより、古いメモに頼ることなく、エージェントに製品全体のコンテキストが提供されます。ただし、ドキュメントによってアクセス権が付与されたり、最新の人間の判断の代わりになったりすることは決してありません。

エージェントは、人間からの短いアイデアをもとに、要件、技術的な決定、および計画について議論する必要があります。明示的な人間のゲート、選択されたモデル、手動/Autoポリシー、および必須のレビューを維持しなければなりません。承認を捏造したり、不確実なコマンドを新しいIDで再実行したり、所有者の意図なしにGitの変更を公開したりしてはなりません。

複数のインストール環境に対しては、名前付きのMCPサーバーを複数設定してください。インスタンスの切り替えはルーティングの決定であり、同期ではありません。OpenClawおよびHermesの設定例はAGENT_CONTROL.mdに記載されています。インストールされているクライアントのバージョンに合わせて、クライアント固有の設定と互換性を確認する必要があります。

外部のrequestIdキャッシュは、アプリの実行中に制限されたリクエストの重複を排除するだけです。永続的な操作には固有の識別子が使用されます。タスク作成にはcreateRequestId、ワークフローの決定にはcommandId、メッセージにはclientMessageId、Gitの変更操作にはoperationIdが使われます。確認応答が不明な場合は元の識別子とペイロードを保持し、意図的に新しい作業を発行する前に保存された状態を読み取ってください。

関連する指示: [MCPクライアントの手順](../../AGENT_CONTROL.md).

<a id="local-cli"></a>

## ローカルCLIと自動化の制限事項

ziafディスパッチャーは、同じ実行中のアプリと保存されたワークフローを制御します。ソースからは、npm run ziaf -- list、npm run ziaf -- status --task TASK_ID --json、npm run ziaf -- start --task TASK_ID、またはnpm run ziaf -- pause --task TASK_IDを使用します。「開始」の確認応答が成功しても、タスクが完了したことを意味するわけではありません。

--until-successは、保存されたワークフローに対して意図的にAutoを有効にしますが、質問、レビュー、承認ゲート、制限、およびチェックポイントは引き続き適用されます。Ctrl+Cは監視中のディスパッチャーを終了しますが、アプリケーションワークフローを暗黙的に停止することはありません。終了コード、ローカルエンドポイント、およびプロファイルの処理については、CLI.mdを参照してください。

自動化インターフェースは現在、表示用の定義とローカル実行カウンターを保存しているだけです。これは認証された定期スケジューラーではなく、バックグラウンドでのモデルターンが実行されたことを証明するものでもありません。実際の実行には、保存されたワークフロー制御、ziaf、または認証済みAPIを使用し、それらのレシートを検査してください。デモ用のパネルを無人スケジューリングと混同しないでください。

関連する指示: [ディスパッチャーコマンド](../../CLI.md).

<a id="updates"></a>

## バージョンとアップデート

「バージョン情報」には、実行中の正確なバージョンが表示されます。パブリックアップデートには、信頼できるGitHubリリースポジトリと、安定版（stable）またはプレビュー（preview）チャンネルが必要です。確認、ダウンロード、インストールの状態は分かれています。エラーが発生しても、アップデートがインストールされたことを意味するわけではありません。

自動インストールは署名済みのmacOSリリース向けです。未署名の開発ビルドは、この仕組みを通じて自動的にインストールされることはありません。手動で置き換える場合は、現在のアプリを完全に終了し、検証済みのアーティファクトを使用してください。

自動確認は、有効化されると即座に実行され、その後は6時間ごとに実行されます。

安定版にはプレビューリリースが含まれず、プレビューでは開発リリースも許可されます。確認が成功しても、利用可能なリリースのメタデータが確認されたにすぎません。ダウンロードとインストールには、プラットフォームパッケージと設定済みのリリースフィードが必要です。Linux DEBの配信は独立したインストーラーパスです。DEBがmacOSのアップデート機能によって自動的にアップグレードされると思い込まないでください。

関連する指示: [リリースの準備状況](../../RELEASE_READINESS.md).

<a id="restart"></a>

## 再起動とリカバリ

macOSでは、完全なシャットダウンを行うために「終了」/ ⌘Qを使用してください。ウィンドウを閉じるだけでは、アプリが実行されたままになる場合があります。アプリケーションを置き換える前に、古いバージョンを完全に終了してください。

起動後、同じタスクを選択してください。履歴と下書きが復元されます。「再開」はネイティブ/ローカルのコンテキストを復元しますが、下書きを送信したり、キューの一時停止を解除したり、不明な操作の繰り返しを承認したりすることはありません。

「リカバリ」が表示された場合、JSONを手作業で編集しないでください。影響を受けたドキュメントの種類を検査し、元のファイルを保持した上で、検証済みのバックアップを選択してください。古いキューを復元すると、そのアイテムには不確実のマークが付けられます。

配信状態が不明な場合、管理されたワークフローで新しいコンテキストのために明示的な許可が必要になることがあります。過去の作業や失敗した試行はそのまま残ります。捏造された成功よりも、目に見える拒否のほうが安全です。

すべてのアプリインスタンスを閉じた状態で、タスクファイルとアプリプロファイルをバックアップしてください。フォルダーをコピーしただけでは、検証済みの復元とは言えません。リカバリで検証済みバックアップの選択を求められた場合は、破損したファイルそのものも保持してください。古いワークフローやキューを復元しても、不確実な推論やGit操作の再実行が承認されるわけではありません。

関連する指示: [リカバリコントラクト](../../DATA_RECOVERY.md).

<a id="troubleshooting"></a>

## トラブルシューティング

CLIが見つからない場合：通常のターミナルでインストール状況とバージョンを確認し、ZIAForgeを再起動してください。実行可能ファイルが存在していても、サインインしているとは限りません。プロバイダー独自のサインイン機能を使用してください。

モデルが利用できない、または認証に失敗した場合：検出を更新し、利用可能なIDを選択した上で、アカウントと利用制限を確認してください。履歴を検査する前に、不確実なリクエストを繰り返さないでください。

ワークフローが停止した場合：現在のフェーズ、質問、検証レシート、またはCLIログを開いてください。未回答の質問、コマンド、フォルダーの権限、試行回数の上限など、具体的な原因に対処します。「続行」を押しても、失敗したチェックを成功に変えることはできません。

フォルダーが見つからない、または置き換えられた場合：元のフォルダーへのアクセスを復元するか、新しいタスクを作成してください。アプリがHOMEから処理を続行してはなりません。別のcwdが確認された場合は、ターンを停止して診断情報を保持してください。

報告を行う際は、「バージョン情報」のバージョン、ルート、CLI/モデル、期待される動作と実際の動作、スクリーンショット、および安全なログの抜粋を含めてください。機密情報、個人コンテンツ、および公開できないパスは削除してください。

リモートページが利用できない場合：所有者がサーバーを有効化していることを確認し、リッスンしているアドレスとポートを確認した上で、正しいインスタンスのトークンで認証してください。401は認証を示し、変更操作の拒否はreadスコープまたは所有者限定の制御である可能性があります。トークンを変更すると、既存のブラウザクライアントは切断されます。独立したDevToolsの検査ポートをリモートアプリケーション制御として公開しないでください。

エディタの保存が拒否された場合：下書きを保持し、ディスク上の現在のファイルを検査して、外部変更による競合を解決してください。アプリケーションメタデータを書き換えて比較を回避しないでください。大きなファイルの全体読み込みが利用できない場合は、サポートされているウィンドウ編集/検索または外部エディタを使用してください。

Telegramが利用できない場合：ボットトークン、数値の所有者、プライベートチャット、およびステータスをローカルで確認してください。競合するWebhookまたはポーラーによってポーリングがブロックされる可能性があります。ZIAForgeが自動的にWebhookを削除したり、別のポーラーを引き継いだりすることはありません。境界が不明な状態で拒否または中断されたコマンドが、自動的に再実行されることはありません。

関連する指示: [テストと診断](../../TESTING.md).

<a id="diagnostics"></a>

## 問題の報告とエビデンスの検査

「バージョン情報」に表示される正確な実行中ビルド、OS/アーキテクチャ、タスクモード、選択したプロバイダー/モデル、および問題を再現する手順を記録してください。期待される結果と実際に確認された結果を記述します。プライベートプロファイル全体ではなく、安全なスクリーンショットと、保持されている関連するコマンドまたは検証レシートを含めてください。

CLIログ、イベントジャーナル、モデルのトランスクリプト、ブラウザトレース、およびスクリーンショットには、ソースコード、個人パス、またはトークンが含まれる可能性があります。共有する前に検査し、墨消し（マスキング）を行ってください。最善を尽くすログマスキング機能があっても、スクリーンショットやアーカイブが公開可能であると保証されるわけではありません。

コントリビューター向けとして、qa:doctorは環境/ビルドの識別情報を読み取り、qa:inspectはプロバイダースタブを備えた分離プロファイルを開きます。フィクスチャは、モデルと通信することなく、テスト対象のアプリケーションパスを検証します。実際の推論、Telegramの接続性、ネイティブLinuxデスクトップ、署名、およびパッケージ化されたアーティファクトのチェックは、それぞれ独立したエビデンスです。再現可能なコマンドとクリーンアップについては、TESTING.mdを参照してください。

関連する指示: [エビデンスコマンド](../../TESTING.md).

<a id="privacy"></a>

## ローカルデータと境界

プロジェクト、履歴、計画、ドキュメント、および診断情報には、プライベートなテキストが含まれている可能性があります。プロファイル、生のキャプチャ、キー、または完全なログをソースコードとともに公開しないでください。

Linuxでは、API、制御、Telegram、およびインスタンスの資格情報を保存するために、ロック解除されたGNOME Secret ServiceまたはKWalletが必要です。サポートされているシークレットストアがない場合、ZIAForgeはElectronのbasic_textフォールバックを使用せず、これらシークレットの保存を拒否します。

ローカルストレージだからといってリクエストがコンピュータ内に留まるわけではありません。選択されたCLI/APIはプロバイダーにリクエストを送信します。作業フォルダーやプロセスの監視は、OSの分離ではありません。選択された権限を検査してください。

エビデンスの種類を区別してください。フィクスチャはモデルなしでアプリケーションをテストし、ネイティブライブは実際のCLI/アカウントを動作させ、パッケージ化チェックは特定のアーティファクトを認定します。1つに合格したからといって、他が保証されるわけではありません。

アプリケーションのスコープ、ワークツリー、および読み取り専用プロンプトは、オペレーティングシステムによる強制とは異なります。Antigravityのレビュー担当/ヘルパーポリシーは、ファイルシステムの読み取り専用アクセスを強制するのではなく、収集されたワークスペースのエビデンスの変化を検出します。ネイティブコンピューター制御は、通常のアプリツールの境界外で所有者が承認したプログラムを実行します。不要になったらオフにしてください。

関連する指示: [出所と公開](../../RELEASE_READINESS.md).

<a id="project-contributors"></a>

## このオープンソースプロジェクトの理解と変更

まずAGENTS.mdとCONTRIBUTING.mdを読み、次に最新のソース境界についてPROJECT_MAP.mdを確認してください。実装された型定義コントラクトと最新のワークフロー/プロバイダードキュメントが動作を規定します。CONCEPT.mdやARCHITECTURE.mdのターミナル優先の記述部分は過去の意図を保持するものであり、現在のリリースの仕様と混同してはなりません。

英語版ヘルプのソースはdocs/help/en.jsonです。生成されたUSER_GUIDE.mdやwebsite/guide.htmlを手動で編集しないでください。正規のセクションを変更し、影響を受けるコントラクトを更新して、node scripts/help/generate.cjsを実行します。アプリ内ヘルプも同じソースを読み取ります。制限事項、権限、サポートされていないパスなど、実際の実装と照らし合わせて追加内容をレビューしてください。

56のインターフェースロケールにはそれぞれ、docs/help/locales.json内に個別のヘルプステータスがあります。ヘルプが存在しないか不完全な場合は英語にフォールバックします。完全な機械翻訳テキストはラベル付けされ、人間のレビューを主張することなく、英語ソースのハッシュに関連付けられます。人間がレビューした翻訳には、さらにレビュー担当者が記録されます。すべての翻訳は、セクションID、アクション、ファイル/コマンド識別子、および技術的制限を保持し、正しい文字方向を使用し、英語ソースが変更された際に更新される必要があります。

リリース前に、node scripts/help/generate.cjs --checkを実行して、古い生成出力、無効なロケールスケルトン、または破損したローカルコントラクトリンクを検出してください。UIの翻訳チェックとアプリケーション動作チェックは別々のままです。HELP_MAINTENANCE.mdにはコントリビューターおよびAIの更新手順が記載されています。ドキュメントで、実行されていないテストに合格したと主張してはなりません。

関連する指示: [最新のプロジェクトマップ](../../PROJECT_MAP.md) · [ドキュメントの保守](../../HELP_MAINTENANCE.md) · [コントリビューター向け手順](../../../CONTRIBUTING.md) · [エージェント向け手順](../../../AGENTS.md).
