import * as vscode from 'vscode';

export interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    action?: string;
    target?: string;
    illustration?: string;
}

export class OnboardingFlow {
    private steps: OnboardingStep[] = [
        {
            id: 'welcome',
            title: 'Welcome to Ripple! 🌊',
            description: 'Ripple helps you see the impact of every code change before you make it. Let\'s get started!',
            illustration: '🌊'
        },
        {
            id: 'what-is-ripple',
            title: 'What is Ripple?',
            description: 'Ripple analyzes your codebase to show:\n\n• What happens if you delete or modify a function\n• How adding/removing dependencies affects your project\n• Which files will break if you change something\n• Real-time impact visualization',
            illustration: '📊'
        },
        {
            id: 'try-it',
            title: 'Try It Now!',
            description: '1. Place your cursor on any function or class\n2. Press Ctrl+Shift+D (or Cmd+Shift+D on Mac)\n3. See all files that depend on it!\n\nOr use the Command Palette: "Ripple: Analyze Current Symbol"',
            action: 'Try analyzing a symbol',
            target: 'ripple.analyzeCurrentSymbol'
        },
        {
            id: 'real-time-analysis',
            title: 'Real-Time Impact Analysis',
            description: 'As you edit code, Ripple shows:\n\n• 🟢 Safe changes (won\'t break anything)\n• 🟡 Warnings (might affect other code)\n• 🔴 Critical (will definitely break things)\n\nTry modifying a function signature to see it in action!',
            illustration: '⚡'
        },
        {
            id: 'dependency-analysis',
            title: 'Dependency Impact',
            description: 'Before installing a new package, Ripple can:\n\n• Show which parts of your code will be affected\n• Predict conflicts and breaking changes\n• Estimate migration effort\n\nUse "Ripple: Analyze Dependency" when adding packages!',
            illustration: '📦'
        },
        {
            id: 'graph-visualization',
            title: 'Interactive Graph',
            description: 'The dependency graph shows:\n\n• Search for specific functions\n• Click nodes to focus on dependencies\n• See impact severity with color coding\n• Navigate directly to code',
            action: 'Open graph',
            target: 'ripple.showImpact'
        },
        {
            id: 'ready',
            title: 'You\'re All Set! 🎉',
            description: 'Ripple is now active and ready to help you:\n\n✅ Refactor with confidence\n✅ Prevent breaking changes\n✅ Understand your codebase\n✅ Make informed decisions\n\nHappy coding!',
            illustration: '✨'
        }
    ];

    private currentStep: number = 0;
    private panel: vscode.WebviewPanel | undefined;

    public async start(): Promise<void> {
        this.currentStep = 0;
        this.showStep(0);
    }

    private showStep(index: number): void {
        if (index >= this.steps.length) {
            this.complete();
            return;
        }

        const step = this.steps[index];

        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'ripple-onboarding',
                'Ripple - Getting Started',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }

        this.panel.title = step.title;
        this.panel.webview.html = this.getStepHTML(step, index);

        this.panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'next') {
                    this.showStep(index + 1);
                } else if (message.command === 'previous') {
                    this.showStep(index - 1);
                } else if (message.command === 'skip') {
                    this.complete();
                } else if (message.command === 'tryAction' && step.target) {
                    vscode.commands.executeCommand(step.target);
                }
            },
            null,
            []
        );
    }

    private getStepHTML(step: OnboardingStep, index: number): string {
        const progress = ((index + 1) / this.steps.length) * 100;
        const hasAction = step.action && step.target;

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .container {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            text-align: center;
            max-width: 600px;
            margin: 0 auto;
        }

        .illustration {
            font-size: 80px;
            margin-bottom: 30px;
            animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }

        h1 {
            font-size: 32px;
            margin-bottom: 20px;
            font-weight: 600;
        }

        .description {
            font-size: 18px;
            line-height: 1.8;
            margin-bottom: 40px;
            white-space: pre-line;
            opacity: 0.95;
        }

        .action-button {
            background: white;
            color: #667eea;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
            margin: 10px;
        }

        .action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
        }

        .navigation {
            position: absolute;
            bottom: 30px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 40px;
        }

        .nav-button {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }

        .nav-button:hover {
            background: rgba(255,255,255,0.3);
        }

        .nav-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .progress-bar {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: rgba(255,255,255,0.2);
        }

        .progress-fill {
            height: 100%;
            background: white;
            transition: width 0.3s ease;
            width: ${progress}%;
        }

        .step-indicator {
            font-size: 14px;
            opacity: 0.8;
            margin-top: 20px;
        }

        .skip-button {
            background: transparent;
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            position: absolute;
            top: 20px;
            right: 20px;
        }

        .skip-button:hover {
            background: rgba(255,255,255,0.1);
        }
    </style>
</head>
<body>
    <div class="progress-bar">
        <div class="progress-fill"></div>
    </div>

    <button class="skip-button" onclick="skip()">Skip Tutorial</button>

    <div class="container">
        <div class="illustration">${step.illustration || '🌊'}</div>
        <h1>${step.title}</h1>
        <div class="description">${step.description}</div>
        
        ${hasAction ? `
            <button class="action-button" onclick="tryAction()">
                ${step.action}
            </button>
        ` : ''}

        <div class="step-indicator">Step ${index + 1} of ${this.steps.length}</div>
    </div>

    <div class="navigation">
        <button class="nav-button" onclick="previous()" ${index === 0 ? 'disabled' : ''}>
            ← Previous
        </button>
        <button class="nav-button" onclick="next()">
            ${index === this.steps.length - 1 ? 'Finish' : 'Next →'}
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function next() {
            vscode.postMessage({ command: 'next' });
        }

        function previous() {
            vscode.postMessage({ command: 'previous' });
        }

        function skip() {
            vscode.postMessage({ command: 'skip' });
        }

        function tryAction() {
            vscode.postMessage({ command: 'tryAction' });
        }
    </script>
</body>
</html>`;
    }

    private complete(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        vscode.window.showInformationMessage(
            '🎉 Welcome to Ripple! Press Ctrl+Shift+D to start analyzing your code.',
            'Got it!'
        );
    }
}

