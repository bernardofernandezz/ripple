import { Symbol } from '../parsers/parser-interface';
import { BreakingChange } from './impact-analyzer';

export interface Impact {
    file: string;
    symbol: Symbol;
    dependentCount: number;
    severity: 'critical' | 'warning' | 'safe';
}

export interface ModuleImpact {
    module: string;
    count: number;
    files: Impact[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class ImpactAggregator {
    public groupByModule(impacts: Impact[]): ModuleImpact[] {
        const groups = new Map<string, Impact[]>();

        impacts.forEach(impact => {
            const module = this.extractModule(impact.file);
            if (!groups.has(module)) {
                groups.set(module, []);
            }
            groups.get(module)!.push(impact);
        });

        return Array.from(groups.entries()).map(([module, files]) => ({
            module,
            count: files.length,
            files,
            riskLevel: this.calculateModuleRisk(files)
        }));
    }

    public summarizeList<T>(items: T[], maxVisible: number = 5): {
        visible: T[];
        hiddenCount: number;
    } {
        return {
            visible: items.slice(0, maxVisible),
            hiddenCount: Math.max(0, items.length - maxVisible)
        };
    }

    public getTopImpactedFiles(
        impacts: Impact[],
        limit: number = 10
    ): Array<{ file: string; count: number; severity: 'critical' | 'warning' | 'safe' }> {
        const fileMap = new Map<string, { count: number; severity: 'critical' | 'warning' | 'safe' }>();

        impacts.forEach(impact => {
            const existing = fileMap.get(impact.file);
            if (existing) {
                existing.count += impact.dependentCount;
                // Upgrade severity if needed
                if (impact.severity === 'critical' || existing.severity === 'critical') {
                    existing.severity = 'critical';
                } else if (impact.severity === 'warning' || existing.severity === 'warning') {
                    existing.severity = 'warning';
                }
            } else {
                fileMap.set(impact.file, {
                    count: impact.dependentCount,
                    severity: impact.severity
                });
            }
        });

        return Array.from(fileMap.entries())
            .map(([file, data]) => ({ file, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    private extractModule(file: string): string {
        // Extract top-level directory as module name
        const parts = file.split(/[/\\]/);
        if (parts.length > 1) {
            // Skip 'src', 'lib', etc. and get first meaningful directory
            const skipDirs = ['src', 'lib', 'app', 'packages'];
            let moduleIndex = 0;
            while (moduleIndex < parts.length && skipDirs.includes(parts[moduleIndex])) {
                moduleIndex++;
            }
            return parts[moduleIndex] || 'root';
        }
        return 'root';
    }

    private calculateModuleRisk(files: Impact[]): ModuleImpact['riskLevel'] {
        const hasCritical = files.some(f => f.severity === 'critical');
        const hasWarning = files.some(f => f.severity === 'warning');
        const totalDependents = files.reduce((sum, f) => sum + f.dependentCount, 0);

        if (hasCritical || totalDependents > 50) return 'critical';
        if (hasWarning || totalDependents > 20) return 'high';
        if (totalDependents > 10) return 'medium';
        return 'low';
    }
}

