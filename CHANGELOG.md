# Change Log

All notable changes to the Ripple extension will be documented in this file.

## [1.1.0] - Parser Abstraction & Multi-language Foundation

### Added
- Introduced `BaseParser` abstraction and parser registry with lazy loading to enable multi-language parsing.
- Wired extension, graph manager, and real-time features to resolve parsers per file for future Python/Go/etc. support.
- Added placeholder Python parser registration to unblock upcoming AST implementation.

### Changed
- Refactored TypeScript parser to emit normalized symbols/dependencies aligned with the new parser contract.
- Updated dependency graph to consume normalized parse results with caching hooks for future performance work.

## [1.0.0] - Ripple Launch

### Major Rebrand
- Rebranded from "Dependency Impact Analyzer" to "Ripple"
- New tagline: "See the impact of every code change before you make it"

### Added
- **Impact Dashboard**: Clean, scannable layout with risk scores and metrics
- **Enhanced Graph Visualization**: Multiple view modes (compact, detailed, heatmap, timeline)
- **Risk Gauge Component**: Visual risk scoring with color-coded zones
- **Progressive Disclosure UI**: Show essential info first, details on demand
- **Intelligent Refactoring**: Advanced migration planning with automated fixes
- **Codemod Generator**: Generate jscodeshift transforms for automated refactoring
- **Git Integration**: Analyze branch changes and generate PR comments
- **Interactive Tutorial**: Step-by-step onboarding for new users
- **Error Handling**: Graceful error recovery with user-friendly messages
- **Data Aggregation**: Smart grouping and summarization of impacts
- **Impact Metrics**: Comprehensive metrics including risk scoring and effort estimation

### Enhanced
- Improved dependency graph visualization with D3.js
- Better breaking change detection with severity classification
- Enhanced inline editor decorations
- More detailed impact analysis
- Performance optimizations for large codebases

### Changed
- All commands now use `ripple.*` namespace
- Configuration keys updated to `ripple.*`
- Improved UI/UX throughout

## [0.1.0] - Initial Release

### Added
- Real-time dependency graph visualization
- TypeScript/JavaScript dependency parsing
- Breaking change detection with severity classification
- Interactive graph panel with D3.js visualization
- Sidebar tree view for dependencies
- Impact summary with metrics (files affected, call sites, estimated LOC)
- Migration code generator with multiple strategies
- Inline editor decorations for breaking changes
- File watcher for automatic graph updates
- Configuration options for auto-analysis and transitive dependencies

### Features
- Analyze current symbol at cursor position
- Generate migration suggestions for breaking changes
- Preview migration code and documentation
- Visualize dependency relationships in interactive graph
- Track code changes and detect breaking changes

