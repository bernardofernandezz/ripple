import * as vscode from 'vscode';
import { EditImpact } from '../analysis/real-time-impact';
import { DependencyImpact } from '../analysis/dependency-install-impact';

export class ImpactNotification {
    private notificationPanel: vscode.WebviewPanel | undefined;

    public showEditImpact(impact: EditImpact): void {
        const message = this.getEditImpactMessage(impact);
        
        const actions: string[] = ['View Details', 'Show Graph'];
        if (impact.breakingChanges.length > 0) {
            actions.push('Generate Migration');
        }

        let showMethod: typeof vscode.window.showInformationMessage;
        if (impact.riskScore >= 70) {
            showMethod = vscode.window.showErrorMessage;
        } else if (impact.riskScore >= 40) {
            showMethod = vscode.window.showWarningMessage;
        } else {
            showMethod = vscode.window.showInformationMessage;
        }

        showMethod(
            message,
            ...actions
        ).then((selection: string | undefined) => {
            if (selection === 'View Details') {
                this.showImpactDetails(impact);
            } else if (selection === 'Show Graph') {
                vscode.commands.executeCommand('ripple.showImpact');
            } else if (selection === 'Generate Migration') {
                vscode.commands.executeCommand('ripple.generateMigration');
            }
        });
    }

    public showDependencyImpact(impact: DependencyImpact): void {
        const message = this.getDependencyImpactMessage(impact);
        
        const actions: string[] = ['View Details'];
        if (impact.conflicts.length > 0) {
            actions.push('Resolve Conflicts');
        }
        if (impact.migrationSteps.length > 0) {
            actions.push('View Migration Steps');
        }

        let showMethod: typeof vscode.window.showInformationMessage;
        if (impact.riskScore >= 70) {
            showMethod = vscode.window.showErrorMessage;
        } else if (impact.riskScore >= 40) {
            showMethod = vscode.window.showWarningMessage;
        } else {
            showMethod = vscode.window.showInformationMessage;
        }

        showMethod(
            message,
            ...actions
        ).then((selection: string | undefined) => {
            if (selection === 'View Details') {
                this.showDependencyDetails(impact);
            }
        });
    }

    private getEditImpactMessage(impact: EditImpact): string {
        const icon = impact.type === 'delete' ? '🗑️' : 
                    impact.type === 'add' ? '➕' : '✏️';
        const riskBadge = impact.riskScore >= 70 ? '🔴' :
                         impact.riskScore >= 40 ? '🟡' : '🟢';
        
        return `${icon} ${riskBadge} ${impact.affectedFiles.length} files affected (${impact.estimatedEffort} effort)`;
    }

    private getDependencyImpactMessage(impact: DependencyImpact): string {
        const icon = impact.type === 'remove' ? '📦❌' : '📦➕';
        const riskBadge = impact.riskScore >= 70 ? '🔴' :
                         impact.riskScore >= 40 ? '🟡' : '🟢';
        
        let message = `${icon} ${riskBadge} ${impact.packageName}`;
        if (impact.conflicts.length > 0) {
            message += ` - ${impact.conflicts.length} conflicts`;
        }
        if (impact.affectedFiles.length > 0) {
            message += ` - ${impact.affectedFiles.length} files affected`;
        }
        
        return message;
    }

    private showImpactDetails(impact: EditImpact): void {
        if (!this.notificationPanel) {
            this.notificationPanel = vscode.window.createWebviewPanel(
                'ripple-impact-details',
                'Ripple - Impact Analysis',
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            this.notificationPanel.onDidDispose(() => {
                this.notificationPanel = undefined;
            });
        }

        this.notificationPanel.webview.html = this.getImpactDetailsHTML(impact);
    }

    private showDependencyDetails(impact: DependencyImpact): void {
        if (!this.notificationPanel) {
            this.notificationPanel = vscode.window.createWebviewPanel(
                'ripple-dependency-impact',
                `Ripple - ${impact.packageName} Impact`,
                vscode.ViewColumn.Beside,
                { enableScripts: true }
            );

            this.notificationPanel.onDidDispose(() => {
                this.notificationPanel = undefined;
            });
        }

        this.notificationPanel.webview.html = this.getDependencyDetailsHTML(impact);
    }

    private getImpactDetailsHTML(impact: EditImpact): string {
        const riskColor = impact.riskScore >= 70 ? '#dc2626' :
                         impact.riskScore >= 40 ? '#f59e0b' : '#10b981';

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 24px;
        }
        .header {
            border-bottom: 2px solid ${riskColor};
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .header h1 {
            color: ${riskColor};
            margin-bottom: 8px;
        }
        .metric {
            display: inline-block;
            margin-right: 24px;
            padding: 8px 16px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: ${riskColor};
        }
        .metric-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .section {
            margin: 24px 0;
        }
        .section h2 {
            margin-bottom: 12px;
            color: var(--vscode-textLink-foreground);
        }
        .file-list {
            list-style: none;
            padding: 0;
        }
        .file-item {
            padding: 8px 12px;
            margin: 4px 0;
            background: var(--vscode-list-hoverBackground);
            border-left: 3px solid ${riskColor};
            border-radius: 4px;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            margin-left: 8px;
        }
        .badge.critical { background: #dc2626; color: white; }
        .badge.warning { background: #f59e0b; color: white; }
        .badge.safe { background: #10b981; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${impact.type === 'delete' ? '🗑️' : impact.type === 'add' ? '➕' : '✏️'} Code Change Impact</h1>
        <div>
            <div class="metric">
                <div class="metric-value">${impact.riskScore}</div>
                <div class="metric-label">Risk Score</div>
            </div>
            <div class="metric">
                <div class="metric-value">${impact.affectedFiles.length}</div>
                <div class="metric-label">Files Affected</div>
            </div>
            <div class="metric">
                <div class="metric-value">${impact.estimatedEffort}</div>
                <div class="metric-label">Effort</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📍 Change Location</h2>
        <p><strong>File:</strong> ${impact.location.file}</p>
        <p><strong>Line:</strong> ${impact.location.line}</p>
        ${impact.symbol ? `<p><strong>Symbol:</strong> ${impact.symbol.name} (${impact.symbol.kind})</p>` : ''}
    </div>

    <div class="section">
        <h2>📋 Affected Files</h2>
        <ul class="file-list">
            ${impact.affectedFiles.map(file => `
                <li class="file-item">
                    <strong>${file.file}</strong> (line ${file.line})
                    <span class="badge ${file.severity}">${file.severity}</span>
                    <div style="font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                        ${file.reason}
                    </div>
                </li>
            `).join('')}
        </ul>
    </div>

    ${impact.breakingChanges.length > 0 ? `
        <div class="section">
            <h2>⚠️ Breaking Changes</h2>
            <ul class="file-list">
                ${impact.breakingChanges.map(change => `
                    <li class="file-item">
                        <strong>${change.description}</strong>
                        <span class="badge ${change.severity}">${change.severity}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    ` : ''}
</body>
</html>`;
    }

    private getDependencyDetailsHTML(impact: DependencyImpact): string {
        const riskColor = impact.riskScore >= 70 ? '#dc2626' :
                         impact.riskScore >= 40 ? '#f59e0b' : '#10b981';

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 24px;
        }
        .header {
            border-bottom: 2px solid ${riskColor};
            padding-bottom: 16px;
            margin-bottom: 24px;
        }
        .header h1 {
            color: ${riskColor};
            margin-bottom: 8px;
        }
        .section {
            margin: 24px 0;
        }
        .section h2 {
            margin-bottom: 12px;
            color: var(--vscode-textLink-foreground);
        }
        .step-list {
            list-style: none;
            padding: 0;
        }
        .step-item {
            padding: 12px;
            margin: 8px 0;
            background: var(--vscode-list-hoverBackground);
            border-left: 3px solid ${riskColor};
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📦 ${impact.packageName} ${impact.type === 'remove' ? 'Removal' : 'Installation'} Impact</h1>
        <p><strong>Version:</strong> ${impact.version || 'N/A'}</p>
        <p><strong>Risk Score:</strong> ${impact.riskScore}/100</p>
        <p><strong>Estimated Effort:</strong> ${impact.estimatedEffort}</p>
    </div>

    ${impact.conflicts.length > 0 ? `
        <div class="section">
            <h2>⚠️ Conflicts</h2>
            <ul class="step-list">
                ${impact.conflicts.map(conflict => `
                    <li class="step-item">
                        <strong>${conflict.package}</strong>: ${conflict.reason}
                    </li>
                `).join('')}
            </ul>
        </div>
    ` : ''}

    ${impact.affectedFiles.length > 0 ? `
        <div class="section">
            <h2>📋 Affected Files (${impact.affectedFiles.length})</h2>
            <ul class="step-list">
                ${impact.affectedFiles.slice(0, 10).map(file => `
                    <li class="step-item">
                        <strong>${file.file}</strong><br>
                        <small>${file.reason}</small>
                    </li>
                `).join('')}
                ${impact.affectedFiles.length > 10 ? `<li>... and ${impact.affectedFiles.length - 10} more files</li>` : ''}
            </ul>
        </div>
    ` : ''}

    ${impact.migrationSteps.length > 0 ? `
        <div class="section">
            <h2>🛠️ Migration Steps</h2>
            <ol class="step-list">
                ${impact.migrationSteps.map((step, i) => `
                    <li class="step-item">
                        ${step}
                    </li>
                `).join('')}
            </ol>
        </div>
    ` : ''}
</body>
</html>`;
    }
}

