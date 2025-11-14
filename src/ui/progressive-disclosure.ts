export interface DisclosureLevel {
    level: 1 | 2 | 3;
    visible: boolean;
}

export class ProgressiveDisclosureUI {
    private currentLevel: DisclosureLevel = { level: 1, visible: true };

    public renderLevel1(metrics: {
        riskScore: number;
        filesAffected: number;
        estimatedEffort: string;
    }): string {
        return `
        ┌──────────────────────────┐
        │  Risk: ${this.getRiskBadge(metrics.riskScore)} ${metrics.riskScore}/100
        │  Files: ${metrics.filesAffected}
        │  Effort: ${this.getEffortIcon(metrics.estimatedEffort)} ${metrics.estimatedEffort}
        └──────────────────────────┘
        `;
    }

    public renderLevel2(expanded: boolean, data: {
        direct: number;
        transitive: number;
        topFiles: Array<{ file: string; count: number }>;
    }): string {
        if (!expanded) {
            return `[▶ Show Details]`;
        }

        const directPercent = data.direct + data.transitive > 0
            ? Math.round((data.direct / (data.direct + data.transitive)) * 100)
            : 0;

        return `
        [▼ Hide Details]
        
        📊 Breakdown:
          • Direct: ${data.direct} files (${directPercent}%)
          • Transitive: ${data.transitive} files (${100 - directPercent}%)
        
        🎯 Top Impacted:
          ${data.topFiles.slice(0, 3).map((f, i) => 
            `${i + 1}. ${f.file.split('/').pop()} (${f.count} refs)`
          ).join('\n          ')}
        
        🛠️ Actions:
          [View Graph] [Generate Migration] [Run Tests]
        `;
    }

    public renderLevel3(fullData: any): string {
        // Full detailed view - would render complete dashboard
        return 'Full dashboard view';
    }

    public setLevel(level: 1 | 2 | 3): void {
        this.currentLevel = { level, visible: true };
    }

    public getCurrentLevel(): DisclosureLevel {
        return this.currentLevel;
    }

    private getRiskBadge(score: number): string {
        if (score <= 30) return '🟢';
        if (score <= 60) return '🟡';
        if (score <= 85) return '🟠';
        return '🔴';
    }

    private getEffortIcon(effort: string): string {
        switch (effort.toLowerCase()) {
            case 'low': return '⚡';
            case 'medium': return '⏱️';
            case 'high': return '🔨';
            case 'critical': return '🚨';
            default: return '⏱️';
        }
    }
}

