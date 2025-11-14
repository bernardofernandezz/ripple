import * as vscode from 'vscode';

export interface TutorialStep {
    id: string;
    title: string;
    content: string;
    target?: string;
    action: string;
    trigger?: string;
    expectedAction?: string;
}

export class InteractiveTutorial {
    private steps: TutorialStep[] = [
        {
            id: 'welcome',
            title: '👋 Welcome to Ripple!',
            content: 'Ripple helps you understand code change impact before you commit.',
            target: 'workbench.view.extension.ripple',
            action: 'Open Ripple panel'
        },
        {
            id: 'first-analysis',
            title: '🔍 Analyze a Function',
            content: 'Place cursor on any function to see all its dependencies.',
            target: 'editor',
            trigger: 'cursor-moved',
            expectedAction: 'cursor-on-function',
            action: 'Try it now'
        },
        {
            id: 'view-graph',
            title: '📊 View Dependency Graph',
            content: 'Click "Show Impact Graph" to visualize change propagation.',
            target: 'ripple.showImpact',
            action: 'View graph'
        },
        {
            id: 'breaking-changes',
            title: '⚠️ Detect Breaking Changes',
            content: 'Modify a function signature and watch Ripple highlight issues.',
            target: 'editor',
            trigger: 'code-changed',
            expectedAction: 'breaking-change-detected',
            action: 'Try it now'
        },
        {
            id: 'generate-migration',
            title: '🛠️ Auto-Generate Migration Code',
            content: 'Ripple can generate migration code to update dependent files.',
            target: 'ripple.generateMigration',
            action: 'Try it now'
        }
    ];

    private currentStepIndex: number = 0;
    private panel: vscode.WebviewPanel | undefined;

    public start(): void {
        vscode.window.showInformationMessage(
            'Want a quick tour of Ripple?',
            'Yes, show me',
            'No, thanks'
        ).then(choice => {
            if (choice === 'Yes, show me') {
                this.showStep(0);
            }
        });
    }

    public showStep(index: number): void {
        if (index >= this.steps.length) {
            this.completeTutorial();
            return;
        }

        this.currentStepIndex = index;
        const step = this.steps[index];

        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'ripple-tutorial',
                'Ripple Tutorial',
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }

        this.panel.title = step.title;
        this.panel.webview.html = this.getTutorialStepHTML(step, index);

        this.panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'stepCompleted') {
                this.nextStep();
            } else if (message.command === 'skipTutorial') {
                this.completeTutorial();
            }
        });
    }

    private nextStep(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        this.showStep(this.currentStepIndex + 1);
    }

    private completeTutorial(): void {
        if (this.panel) {
            this.panel.dispose();
        }
        vscode.window.showInformationMessage('Tutorial complete! Happy coding with Ripple! 🎉');
    }

    private getTutorialStepHTML(step: TutorialStep, index: number): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
        }
        .step-container {
            max-width: 500px;
            margin: 0 auto;
            text-align: center;
        }
        h1 { 
            font-size: 32px; 
            margin-bottom: 20px; 
            font-weight: 600;
        }
        p { 
            font-size: 18px; 
            line-height: 1.6; 
            margin-bottom: 30px;
        }
        .action-button {
            background: white;
            color: #667eea;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 30px;
            font-weight: 600;
            transition: transform 0.2s;
        }
        .action-button:hover {
            transform: scale(1.05);
        }
        .skip-button {
            background: transparent;
            color: white;
            border: 1px solid white;
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 20px;
        }
        .progress {
            margin-top: 40px;
            font-size: 14px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="step-container">
        <h1>${step.title}</h1>
        <p>${step.content}</p>
        <button class="action-button" onclick="performAction()">${step.action}</button>
        <div>
            <button class="skip-button" onclick="skipTutorial()">Skip Tutorial</button>
        </div>
        <div class="progress">Step ${index + 1} of ${this.steps.length}</div>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function performAction() {
            vscode.postMessage({ command: 'stepCompleted' });
        }
        function skipTutorial() {
            vscode.postMessage({ command: 'skipTutorial' });
        }
    </script>
</body>
</html>
        `;
    }
}

