🌊 Ripple
See the impact of every code change before you make it
<p align="center"> <img src="resources/banner.png" alt="Ripple Banner" width="75%"> </p>

Ripple is a VS Code/Cursor extension that performs real-time dependency impact analysis.
Whenever you modify a function, class, or module, Ripple maps all downstream dependents, highlights potential breaking changes, and even suggests migration paths.

## What is Ripple?
Ripple gives you immediate feedback on how a change ripples through your codebase. It:
- Parses your project (TypeScript/JavaScript, Python today; more languages coming)
- Builds dependency graphs and highlights breaking changes
- Surfaces migration suggestions and inline risk indicators
- Stays out of your way: async, debounced, and designed for large repos

## Visual identity
- Name: Ripple — “see the impact of every code change before you make it.”
- Icon: `resources/icon.svg` (wave mark); banner: `resources/banner.png`.
- Palette: blues and teals; use high-contrast modes when embedding in docs.
- Voice: concise, action-oriented, focused on impact and safety.

## Quick tutorial (2 minutes)
1) Install & open: load your repo in VS Code/Cursor with the Ripple extension enabled.
2) Build the graph: save a file or run `Ripple: Show Impact Graph` (Ctrl+Shift+D / Cmd+Shift+D).
3) Inspect a symbol: place cursor on a function/class → `Ripple: Analyze Current Symbol`.
4) Review impact: see dependents in the sidebar and graph; inline highlights show affected lines.
5) Handle risk: if breaking changes appear, open migration suggestions from the panel.
6) Python projects: enable Python support in settings (`Ripple › Languages › Python`), set `pythonPath` if needed, and re-run analysis.

✨ Why Ripple Exists

Ripple helps developers refactor confidently by providing:

⏳ Time Savings — Reduce refactor time by 50%+

🐛 Bug Prevention — Detect breaking changes early

🔍 Visibility — Understand how your code impacts the whole system

🧠 Architectural Awareness — Make informed technical decisions

🚀 Features
🔗 Real-Time Dependency Analysis

Interactive D3.js dependency graph

Impact dashboard with risk metrics

Breaking change detection (Critical, Warning, Safe)

Risk scoring from 0–100

🌐 Smart Visualizations

View modes: Compact, Detailed, Heatmap, Timeline

Progressive disclosure UI

Inline risk indicators in the editor

Semi-circular Risk Gauge

🛠️ Intelligent Refactoring

Auto-generated migration code

Codemod generator (jscodeshift)

Deprecation wrappers & adapters

Step-by-step migration plans

🌱 Git Integration

Analyze changes in your current branch

Auto-generate PR impact reports

CI/CD risk threshold enforcement

💡 Developer Experience

Interactive onboarding tutorial

Contextual help panels

Graceful error handling

Performance optimized for large codebases

📦 Installation
🧑‍💻 Development Setup
git clone <repo>
npm install


Press F5 to launch a new Extension Host.

🏭 Production Build
npm install
npm run compile
npm install -g vsce
vsce package
code --install-extension ripple-1.0.0.vsix

🎯 How to Use
🔥 Basic Usage

Open a TypeScript/JavaScript project.

Open the Impact Dashboard

Ctrl+Shift+D / Cmd+Shift+D

Or: Command Palette → "Ripple: Show Impact Graph"

Analyze a symbol

Place cursor on a function/class

Run "Ripple: Analyze Current Symbol"

View analysis

Sidebar → "Ripple" Panel

See Dependency Tree, Impact Summary, and Dashboard

🧠 Advanced Tools
✔ Migration Code Generation

After detecting a breaking change

Command Palette → "Ripple: Generate Migration Code"

✔ Git Branch Impact

Command Palette → "Ripple: Analyze Git Branch"

✔ Interactive Graph Controls

Click nodes → jump to source

Drag nodes → rearrange layout

Hover → see details

Zoom, reset and fit-to-screen controls

✔ Onboarding Tutorial

Command Palette → "Ripple: Start Tutorial"

⚙️ Configuration

Search for "Ripple" in VS Code Settings:

Setting	Description	Default
ripple.autoAnalyze	Auto-analyze on save	true
ripple.showTransitive	Show transitive deps	true
ripple.maxDepth	Max dependency depth	5
ripple.riskThreshold	Warning threshold	70
ripple.enableGitIntegration	Git analysis	true
🛠 Development Guide
Prerequisites

Node.js ≥ 16

TypeScript ≥ 5

VS Code ≥ 1.80

Commands
npm install        # install deps
npm run compile    # compile TypeScript
npm run watch      # dev mode
npm run lint       # lint code

Debugging

Open project in VS Code

Press F5

Place breakpoints in src/extension.ts

Use Debug Console for logs

📁 Project Structure
src/
├── extension.ts
├── parsers/
├── analysis/
│   ├── dependency-graph.ts
│   ├── impact-analyzer.ts
│   ├── change-detector.ts
│   └── data-aggregation.ts
├── visualization/
│   ├── graph-panel.ts
│   ├── decorations.ts
│   ├── impact-dashboard.ts
│   └── enhanced-graph.ts
├── refactoring/
│   ├── migration-generator.ts
│   ├── intelligent-refactor.ts
│   ├── codemod-generator.ts
│   └── preview-provider.ts
├── ui/
│   ├── tree-view-provider.ts
│   ├── progressive-disclosure.ts
│   ├── components/
│   │   └── risk-gauge.ts
│   └── onboarding/
│       └── tutorial.ts
├── integrations/
│   └── git-integration.ts
├── utils/
│   ├── cache-manager.ts
│   ├── file-watcher.ts
│   └── workspace-scanner.ts
└── errors/
    └── error-handler.ts

📊 Feature Status
✅ Implemented

TS/JS dependency parsing

Real-time graph visualization

Breaking change detection

Impact dashboard

Migration code generation

Editor inline decorations

Git branch analysis

File change monitoring

Progressive UI

Interactive tutorials

Error handling

🚧 v2.0 Roadmap

Python, Go, Rust parsing

Cloud sync (teams)

Historic change tracking

GitHub Actions integration

AI-powered refactoring

Vulnerability detection

CLI for CI/CD

i18n

Accessibility improvements

📝 License

MIT License

🤝 Contributing

Pull Requests welcome!
Open issues, propose features, or add improvements.

📧 Support

Issues → GitHub Issues

Docs → https://docs.ripple.dev

<p align="center"> <strong>Made with ❤️ by the Ripple Team</strong> </p>
