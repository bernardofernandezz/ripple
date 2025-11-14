import { BreakingChange } from '../analysis/impact-analyzer';
import { Symbol } from '../parsers/parser-interface';

export interface MigrationPlan {
    strategy: MigrationStrategy;
    steps: MigrationStep[];
    automatedFixes: CodeFix[];
    manualActions: ManualAction[];
    testingSuggestions: string[];
    estimatedEffort: 'low' | 'medium' | 'high' | 'critical';
}

export interface MigrationStrategy {
    type: 'automated' | 'deprecation' | 'breaking';
    description: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface MigrationStep {
    order: number;
    description: string;
    automated: boolean;
    files: string[];
}

export interface CodeFix {
    title: string;
    edits: CodeEdit[];
    description: string;
    automated: boolean;
}

export interface CodeEdit {
    file: string;
    line: number;
    oldCode: string;
    newCode: string;
}

export interface ManualAction {
    description: string;
    reason: string;
    files: string[];
}

export interface ChangeAnalysis {
    changeType: 'parameter-addition' | 'parameter-removal' | 'return-type-change' | 'rename' | 'other';
    canAutomate: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    backwardCompatible: boolean;
    oldSignature?: {
        parameters: Array<{ name: string; type: string; optional: boolean }>;
    };
    newSignature?: {
        parameters: Array<{ name: string; type: string; optional: boolean }>;
        parameterCount: number;
    };
    callSites: Array<{
        file: string;
        line: number;
        code: string;
    }>;
}

export class IntelligentRefactor {
    public generateMigrationPlan(change: BreakingChange): MigrationPlan {
        const analysis = this.analyzeChange(change);

        return {
            strategy: this.determineStrategy(analysis),
            steps: this.generateSteps(analysis),
            automatedFixes: this.generateAutomatedFixes(analysis),
            manualActions: this.identifyManualActions(analysis),
            testingSuggestions: this.generateTestingSuggestions(analysis),
            estimatedEffort: this.calculateEffort(analysis)
        };
    }

    private analyzeChange(change: BreakingChange): ChangeAnalysis {
        // Simplified analysis - would need more sophisticated AST parsing
        const changeType = this.detectChangeType(change);
        
        return {
            changeType,
            canAutomate: changeType !== 'other',
            riskLevel: change.severity === 'critical' ? 'critical' : 
                      change.severity === 'warning' ? 'high' : 'low',
            backwardCompatible: change.severity === 'safe',
            callSites: change.affectedLocations.map(loc => ({
                file: loc.file,
                line: loc.line,
                code: '' // Would extract from source
            }))
        };
    }

    private detectChangeType(change: BreakingChange): ChangeAnalysis['changeType'] {
        if (change.changeType === 'parameter') {
            if (change.description.includes('removed')) {
                return 'parameter-removal';
            }
            if (change.description.includes('added')) {
                return 'parameter-addition';
            }
        }
        if (change.changeType === 'type') {
            return 'return-type-change';
        }
        return 'other';
    }

    private determineStrategy(analysis: ChangeAnalysis): MigrationStrategy {
        if (analysis.canAutomate && analysis.riskLevel === 'low') {
            return {
                type: 'automated',
                description: 'Fully automated refactoring possible',
                confidence: 'high'
            };
        } else if (analysis.backwardCompatible) {
            return {
                type: 'deprecation',
                description: 'Deprecate old API, provide adapter',
                confidence: 'medium'
            };
        } else {
            return {
                type: 'breaking',
                description: 'Breaking change with migration guide',
                confidence: 'low'
            };
        }
    }

    private generateSteps(analysis: ChangeAnalysis): MigrationStep[] {
        const steps: MigrationStep[] = [];

        if (analysis.changeType === 'parameter-addition') {
            steps.push({
                order: 1,
                description: 'Add new parameters to all call sites',
                automated: true,
                files: analysis.callSites.map(s => s.file)
            });
        } else if (analysis.changeType === 'parameter-removal') {
            steps.push({
                order: 1,
                description: 'Remove parameters from all call sites',
                automated: true,
                files: analysis.callSites.map(s => s.file)
            });
        }

        return steps;
    }

    private generateAutomatedFixes(analysis: ChangeAnalysis): CodeFix[] {
        const fixes: CodeFix[] = [];

        switch (analysis.changeType) {
            case 'parameter-addition':
                fixes.push(this.generateParameterAdditionFix(analysis));
                break;
            case 'parameter-removal':
                fixes.push(this.generateParameterRemovalFix(analysis));
                break;
            case 'return-type-change':
                fixes.push(this.generateReturnTypeChangeFix(analysis));
                break;
        }

        return fixes;
    }

    private generateParameterAdditionFix(analysis: ChangeAnalysis): CodeFix {
        return {
            title: 'Add new parameters to call sites',
            edits: analysis.callSites.map(site => ({
                file: site.file,
                line: site.line,
                oldCode: site.code,
                newCode: this.insertParameters(site.code, [])
            })),
            description: 'Automatically adds new parameters with default values',
            automated: true
        };
    }

    private generateParameterRemovalFix(analysis: ChangeAnalysis): CodeFix {
        return {
            title: 'Remove parameters from call sites',
            edits: analysis.callSites.map(site => ({
                file: site.file,
                line: site.line,
                oldCode: site.code,
                newCode: this.removeParameters(site.code, [])
            })),
            description: 'Removes deprecated parameters',
            automated: true
        };
    }

    private generateReturnTypeChangeFix(analysis: ChangeAnalysis): CodeFix {
        return {
            title: 'Update return type handling',
            edits: [],
            description: 'Manual review required for return type changes',
            automated: false
        };
    }

    private identifyManualActions(analysis: ChangeAnalysis): ManualAction[] {
        const actions: ManualAction[] = [];

        if (analysis.changeType === 'return-type-change') {
            actions.push({
                description: 'Review and update code that uses return value',
                reason: 'Return type changes require manual verification',
                files: analysis.callSites.map(s => s.file)
            });
        }

        return actions;
    }

    private generateTestingSuggestions(analysis: ChangeAnalysis): string[] {
        const suggestions: string[] = [];

        if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
            suggestions.push('Add integration tests for affected modules');
            suggestions.push('Update existing unit tests');
        }

        if (analysis.callSites.length > 10) {
            suggestions.push('Run full test suite before merging');
        }

        return suggestions;
    }

    private calculateEffort(analysis: ChangeAnalysis): MigrationPlan['estimatedEffort'] {
        const fileCount = new Set(analysis.callSites.map(s => s.file)).size;

        if (fileCount > 50 || analysis.riskLevel === 'critical') return 'critical';
        if (fileCount > 20 || analysis.riskLevel === 'high') return 'high';
        if (fileCount > 10) return 'medium';
        return 'low';
    }

    private insertParameters(code: string, params: Array<{ name: string; defaultValue?: string }>): string {
        // Simplified - would need proper AST transformation
        return code; // Placeholder
    }

    private removeParameters(code: string, paramNames: string[]): string {
        // Simplified - would need proper AST transformation
        return code; // Placeholder
    }
}

