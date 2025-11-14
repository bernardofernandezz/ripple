export interface ImpactMetrics {
    totalFilesAffected: number;
    directDependents: number;
    transitiveDependents: number;
    estimatedEffort: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number; // 0-100
    breakingChangeCount: number;
    linesOfCodeImpacted: number;
    topImpactedFiles: Array<{
        file: string;
        count: number;
        severity: 'critical' | 'warning' | 'safe';
    }>;
}

export class ImpactDashboard {
    public renderQuickSummary(metrics: ImpactMetrics): string {
        return `
        ┌─────────────────────────────────────┐
        │  📊 IMPACT SUMMARY                  │
        ├─────────────────────────────────────┤
        │  Risk Level: ${this.getRiskBadge(metrics.riskScore)}
        │  Files Affected: ${metrics.totalFilesAffected}
        │  Estimated Effort: ${this.getEffortIcon(metrics.estimatedEffort)} ${metrics.estimatedEffort.toUpperCase()}
        └─────────────────────────────────────┘
        `;
    }

    public getRiskBadge(riskScore: number): string {
        if (riskScore <= 30) return '🟢 LOW';
        if (riskScore <= 60) return '🟡 MODERATE';
        if (riskScore <= 85) return '🟠 HIGH';
        return '🔴 CRITICAL';
    }

    public getEffortIcon(effort: ImpactMetrics['estimatedEffort']): string {
        switch (effort) {
            case 'low': return '⚡';
            case 'medium': return '⏱️';
            case 'high': return '🔨';
            case 'critical': return '🚨';
            default: return '⏱️';
        }
    }

    public renderBreakdown(metrics: ImpactMetrics): string {
        const directPercent = metrics.totalFilesAffected > 0
            ? Math.round((metrics.directDependents / metrics.totalFilesAffected) * 100)
            : 0;
        const transitivePercent = metrics.totalFilesAffected > 0
            ? Math.round((metrics.transitiveDependents / metrics.totalFilesAffected) * 100)
            : 0;

        return `
        📍 Direct Dependencies: ${metrics.directDependents}
        🔗 Transitive Dependencies: ${metrics.transitiveDependents}
        ⚠️  Breaking Changes: ${metrics.breakingChangeCount}
        📝 Lines to Update: ~${metrics.linesOfCodeImpacted}
        `;
    }

    public calculateRiskScore(
        breakingChanges: number,
        filesAffected: number,
        locImpacted: number
    ): number {
        // Risk score calculation: 0-100
        let score = 0;

        // Breaking changes contribute up to 50 points
        score += Math.min(breakingChanges * 10, 50);

        // Files affected contribute up to 30 points
        score += Math.min(filesAffected * 2, 30);

        // LOC impacted contribute up to 20 points
        score += Math.min(locImpacted / 10, 20);

        return Math.min(Math.round(score), 100);
    }

    public estimateEffort(riskScore: number, filesAffected: number): ImpactMetrics['estimatedEffort'] {
        if (riskScore >= 85 || filesAffected > 50) return 'critical';
        if (riskScore >= 60 || filesAffected > 20) return 'high';
        if (riskScore >= 30 || filesAffected > 10) return 'medium';
        return 'low';
    }
}

