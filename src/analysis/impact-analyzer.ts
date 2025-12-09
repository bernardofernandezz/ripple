import { Symbol } from '../parsers/base-parser';
import { CodeChange } from './change-detector';

export interface BreakingChange {
    symbol: Symbol;
    changeType: 'signature' | 'removal' | 'visibility' | 'type' | 'parameter';
    severity: 'critical' | 'warning' | 'safe';
    description: string;
    affectedLocations: { file: string; line: number; column: number }[];
    estimatedImpact: {
        filesAffected: number;
        callSitesAffected: number;
        estimatedLOC: number;
    };
}

export class ImpactAnalyzer {
    public detectBreakingChanges(
        oldSymbol: Symbol | undefined,
        newSymbol: Symbol,
        affectedLocations: { file: string; line: number; column: number }[]
    ): BreakingChange | null {
        if (!oldSymbol) {
            return null; // New symbol, not a breaking change
        }

        // Check for removal
        if (!newSymbol || newSymbol.name === '') {
            return {
                symbol: oldSymbol,
                changeType: 'removal',
                severity: 'critical',
                description: `Symbol "${oldSymbol.name}" has been removed`,
                affectedLocations,
                estimatedImpact: this.calculateImpact(affectedLocations)
            };
        }

        // Check signature changes
        const signatureChange = this.detectSignatureChange(oldSymbol, newSymbol);
        if (signatureChange) {
            return {
                symbol: newSymbol,
                changeType: 'signature',
                severity: signatureChange.severity,
                description: signatureChange.description,
                affectedLocations,
                estimatedImpact: this.calculateImpact(affectedLocations)
            };
        }

        // Check parameter changes
        const parameterChange = this.detectParameterChange(oldSymbol, newSymbol);
        if (parameterChange) {
            return {
                symbol: newSymbol,
                changeType: 'parameter',
                severity: parameterChange.severity,
                description: parameterChange.description,
                affectedLocations,
                estimatedImpact: this.calculateImpact(affectedLocations)
            };
        }

        // Check return type changes
        const returnTypeChange = this.detectReturnTypeChange(oldSymbol, newSymbol);
        if (returnTypeChange) {
            return {
                symbol: newSymbol,
                changeType: 'type',
                severity: returnTypeChange.severity,
                description: returnTypeChange.description,
                affectedLocations,
                estimatedImpact: this.calculateImpact(affectedLocations)
            };
        }

        return null;
    }

    private detectSignatureChange(oldSymbol: Symbol, newSymbol: Symbol): { severity: 'critical' | 'warning' | 'safe', description: string } | null {
        if (oldSymbol.signature === newSymbol.signature) {
            return null;
        }

        const description = `Signature changed from "${oldSymbol.signature || 'unknown'}" to "${newSymbol.signature || 'unknown'}"`;
        
        // If signatures are completely different, it's critical
        if (!oldSymbol.signature || !newSymbol.signature) {
            return { severity: 'critical', description };
        }

        // More detailed analysis would go here
        return { severity: 'warning', description };
    }

    private detectParameterChange(oldSymbol: Symbol, newSymbol: Symbol): { severity: 'critical' | 'warning' | 'safe', description: string } | null {
        const oldParams = oldSymbol.parameters || [];
        const newParams = newSymbol.parameters || [];

        if (oldParams.length === newParams.length && 
            JSON.stringify(oldParams) === JSON.stringify(newParams)) {
            return null;
        }

        // Check for removed parameters
        const removedParams = oldParams.filter(
            old => !newParams.some(newP => newP.name === old.name)
        );

        if (removedParams.length > 0) {
            return {
                severity: 'critical',
                description: `Parameters removed: ${removedParams.map(p => p.name).join(', ')}`
            };
        }

        // Check for added required parameters
        const addedRequiredParams = newParams.filter(
            newP => !newP.optional && !oldParams.some(old => old.name === newP.name)
        );

        if (addedRequiredParams.length > 0) {
            return {
                severity: 'critical',
                description: `Required parameters added: ${addedRequiredParams.map(p => p.name).join(', ')}`
            };
        }

        // Check for added optional parameters (safe)
        const addedOptionalParams = newParams.filter(
            newP => newP.optional && !oldParams.some(old => old.name === newP.name)
        );

        if (addedOptionalParams.length > 0) {
            return {
                severity: 'safe',
                description: `Optional parameters added: ${addedOptionalParams.map(p => p.name).join(', ')}`
            };
        }

        // Parameter type changes
        const typeChangedParams = oldParams.filter(old => {
            const newParam = newParams.find(newP => newP.name === old.name);
            return newParam && newParam.type !== old.type;
        });

        if (typeChangedParams.length > 0) {
            return {
                severity: 'warning',
                description: `Parameter types changed: ${typeChangedParams.map(p => p.name).join(', ')}`
            };
        }

        return {
            severity: 'warning',
            description: 'Parameters modified'
        };
    }

    private detectReturnTypeChange(oldSymbol: Symbol, newSymbol: Symbol): { severity: 'critical' | 'warning' | 'safe', description: string } | null {
        if (oldSymbol.returnType === newSymbol.returnType) {
            return null;
        }

        const description = `Return type changed from "${oldSymbol.returnType || 'unknown'}" to "${newSymbol.returnType || 'unknown'}"`;

        // If return type becomes void or undefined, it's a warning
        if (newSymbol.returnType === 'void' || newSymbol.returnType === 'undefined') {
            return { severity: 'warning', description };
        }

        // If return type becomes more specific (narrowing), it's safe
        // If return type becomes less specific (widening), it's a warning
        // For now, treat all return type changes as warnings
        return { severity: 'warning', description };
    }

    private calculateImpact(affectedLocations: { file: string; line: number; column: number }[]): {
        filesAffected: number;
        callSitesAffected: number;
        estimatedLOC: number;
    } {
        const uniqueFiles = new Set(affectedLocations.map(loc => loc.file));
        
        return {
            filesAffected: uniqueFiles.size,
            callSitesAffected: affectedLocations.length,
            estimatedLOC: affectedLocations.length * 2 // Rough estimate: 2 LOC per call site
        };
    }

    public analyzeChange(change: CodeChange, affectedLocations: { file: string; line: number; column: number }[]): BreakingChange | null {
        return this.detectBreakingChanges(change.oldSymbol, change.symbol, affectedLocations);
    }
}

