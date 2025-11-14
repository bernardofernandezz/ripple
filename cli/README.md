# Ripple CLI

Command-line interface for Ripple dependency impact analysis.

## Installation

```bash
npm install -g @ripple/cli
```

## Usage

### Analyze Branch

```bash
ripple analyze --branch feature-branch --base main
```

### Generate Graph

```bash
ripple graph --output graph.svg --depth 5
```

### Watch Mode

```bash
ripple watch --pattern "**/*.{ts,js}"
```

## Options

- `--branch <branch>`: Branch to analyze (default: HEAD)
- `--base <branch>`: Base branch for comparison (default: main)
- `--format <format>`: Output format (text|json|html, default: text)
- `--output <file>`: Output file path
- `--threshold <score>`: Fail if risk exceeds threshold (default: 100)
- `--depth <number>`: Maximum dependency depth (default: 5)

## Examples

```bash
# Analyze current branch
ripple analyze

# Generate JSON report
ripple analyze --format json --output report.json

# Watch for changes
ripple watch

# Generate dependency graph
ripple graph --output dependencies.svg
```

## CI/CD Integration

```yaml
# .github/workflows/ripple-check.yml
- name: Run Ripple Analysis
  run: ripple analyze --threshold 70
```

