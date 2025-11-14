import * as vscode from 'vscode';
import { Symbol } from '../parsers/parser-interface';
import { BreakingChange } from '../analysis/impact-analyzer';

export class DependencyTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly symbol?: Symbol,
        public readonly breakingChange?: BreakingChange
    ) {
        super(label, collapsibleState);

        if (breakingChange) {
            this.description = breakingChange.severity;
            this.iconPath = this.getSeverityIcon(breakingChange.severity);
            this.tooltip = breakingChange.description;
        } else if (symbol) {
            this.description = symbol.kind;
            this.tooltip = `${symbol.name} (${symbol.location.file}:${symbol.location.line})`;
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [
                    vscode.Uri.file(symbol.location.file),
                    {
                        selection: new vscode.Range(
                            symbol.location.line - 1,
                            symbol.location.column - 1,
                            symbol.location.line - 1,
                            symbol.location.column - 1
                        )
                    }
                ]
            };
        }
    }

    private getSeverityIcon(severity: string): vscode.ThemeIcon {
        switch (severity) {
            case 'critical':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
            case 'warning':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
            case 'safe':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('editorInfo.foreground'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}

export class DependencyTreeProvider implements vscode.TreeDataProvider<DependencyTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DependencyTreeItem | undefined | null | void> = new vscode.EventEmitter<DependencyTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DependencyTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private dependents: Symbol[] = [];
    private breakingChanges: BreakingChange[] = [];

    constructor() {}

    public refresh(dependents: Symbol[], breakingChanges: BreakingChange[]): void {
        this.dependents = dependents;
        this.breakingChanges = breakingChanges;
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: DependencyTreeItem): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: DependencyTreeItem): Thenable<DependencyTreeItem[]> {
        if (!element) {
            // Root level - show breaking changes and dependents
            const items: DependencyTreeItem[] = [];

            if (this.breakingChanges.length > 0) {
                items.push(new DependencyTreeItem(
                    'Breaking Changes',
                    vscode.TreeItemCollapsibleState.Expanded
                ));
            }

            items.push(new DependencyTreeItem(
                'Dependents',
                this.dependents.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
            ));

            return Promise.resolve(items);
        }

        if (element.label === 'Breaking Changes') {
            return Promise.resolve(
                this.breakingChanges.map(change => new DependencyTreeItem(
                    `${change.symbol.name} - ${change.description}`,
                    vscode.TreeItemCollapsibleState.None,
                    change.symbol,
                    change
                ))
            );
        }

        if (element.label === 'Dependents') {
            return Promise.resolve(
                this.dependents.map(symbol => new DependencyTreeItem(
                    `${symbol.name} (${symbol.kind})`,
                    vscode.TreeItemCollapsibleState.None,
                    symbol
                ))
            );
        }

        return Promise.resolve([]);
    }
}

export class ImpactSummaryProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private impactData: { filesAffected: number; callSitesAffected: number; estimatedLOC: number } | null = null;

    constructor() {}

    public updateImpact(impactData: { filesAffected: number; callSitesAffected: number; estimatedLOC: number }): void {
        this.impactData = impactData;
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this.impactData) {
            return Promise.resolve([
                new vscode.TreeItem('No impact data available', vscode.TreeItemCollapsibleState.None)
            ]);
        }

        return Promise.resolve([
            new vscode.TreeItem(`Files Affected: ${this.impactData.filesAffected}`, vscode.TreeItemCollapsibleState.None),
            new vscode.TreeItem(`Call Sites Affected: ${this.impactData.callSitesAffected}`, vscode.TreeItemCollapsibleState.None),
            new vscode.TreeItem(`Estimated LOC: ${this.impactData.estimatedLOC}`, vscode.TreeItemCollapsibleState.None)
        ]);
    }
}

