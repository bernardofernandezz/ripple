import { BreakingChange } from '../analysis/impact-analyzer';
import { Symbol } from '../parsers/parser-interface';

export interface MigrationSuggestion {
    type: 'adapter' | 'update' | 'deprecation' | 'wrapper';
    code: string;
    description: string;
    affectedFiles: string[];
}

export class MigrationGenerator {
    public generateMigration(change: BreakingChange): MigrationSuggestion[] {
        const suggestions: MigrationSuggestion[] = [];

        switch (change.changeType) {
            case 'signature':
                suggestions.push(...this.generateSignatureMigration(change));
                break;
            case 'removal':
                suggestions.push(this.generateRemovalMigration(change));
                break;
            case 'parameter':
                suggestions.push(...this.generateParameterMigration(change));
                break;
            case 'type':
                suggestions.push(...this.generateTypeMigration(change));
                break;
        }

        return suggestions;
    }

    private generateSignatureMigration(change: BreakingChange): MigrationSuggestion[] {
        const suggestions: MigrationSuggestion[] = [];

        // Option 1: Update all call sites
        suggestions.push({
            type: 'update',
            code: this.generateUpdateCode(change),
            description: 'Update all call sites to match new signature',
            affectedFiles: change.affectedLocations.map(loc => loc.file)
        });

        // Option 2: Create adapter function
        suggestions.push({
            type: 'adapter',
            code: this.generateAdapterCode(change),
            description: 'Create adapter function for backward compatibility',
            affectedFiles: []
        });

        return suggestions;
    }

    private generateParameterMigration(change: BreakingChange): MigrationSuggestion[] {
        const suggestions: MigrationSuggestion[] = [];

        if (change.description.includes('removed')) {
            suggestions.push({
                type: 'update',
                code: this.generateParameterRemovalCode(change),
                description: 'Remove parameters from all call sites',
                affectedFiles: change.affectedLocations.map(loc => loc.file)
            });
        } else if (change.description.includes('added')) {
            suggestions.push({
                type: 'update',
                code: this.generateParameterAdditionCode(change),
                description: 'Add new parameters to all call sites',
                affectedFiles: change.affectedLocations.map(loc => loc.file)
            });
        }

        return suggestions;
    }

    private generateTypeMigration(change: BreakingChange): MigrationSuggestion[] {
        return [{
            type: 'update',
            code: this.generateTypeUpdateCode(change),
            description: 'Update code to handle new return type',
            affectedFiles: change.affectedLocations.map(loc => loc.file)
        }];
    }

    private generateRemovalMigration(change: BreakingChange): MigrationSuggestion {
        return {
            type: 'deprecation',
            code: this.generateRemovalCode(change),
            description: 'Migration guide for removed symbol',
            affectedFiles: change.affectedLocations.map(loc => loc.file)
        };
    }

    private generateUpdateCode(change: BreakingChange): string {
        return `
// Migration for ${change.symbol.name}
// Old signature: ${change.description}

// Replace all occurrences of:
//   ${change.symbol.name}(oldParams)
// With:
//   ${change.symbol.name}(newParams)

// Affected files:
${change.affectedLocations.map(loc => `//   - ${loc.file}:${loc.line}`).join('\n')}
`;
    }

    private generateAdapterCode(change: BreakingChange): string {
        return `
// Adapter function for backward compatibility
// This allows old code to continue working while new code uses the new signature

export function ${change.symbol.name}_legacy(...oldParams: any[]) {
    // Adapt old parameters to new signature
    // TODO: Implement parameter mapping
    return ${change.symbol.name}(/* newParams */);
}

// Mark as deprecated
/** @deprecated Use ${change.symbol.name} instead */
export const ${change.symbol.name}_deprecated = ${change.symbol.name}_legacy;
`;
    }

    private generateParameterRemovalCode(change: BreakingChange): string {
        return `
// Remove parameters from call sites
// Old: ${change.symbol.name}(param1, param2, removedParam)
// New: ${change.symbol.name}(param1, param2)

// Search and replace in affected files:
${change.affectedLocations.map(loc => `//   ${loc.file}:${loc.line}`).join('\n')}
`;
    }

    private generateParameterAdditionCode(change: BreakingChange): string {
        return `
// Add new parameters to call sites
// Old: ${change.symbol.name}(param1, param2)
// New: ${change.symbol.name}(param1, param2, newParam)

// Update affected files:
${change.affectedLocations.map(loc => `//   ${loc.file}:${loc.line}`).join('\n')}
`;
    }

    private generateTypeUpdateCode(change: BreakingChange): string {
        return `
// Handle return type change
// Old return type: ${change.description.split('from')[1]?.split('to')[0] || 'unknown'}
// New return type: ${change.description.split('to')[1] || 'unknown'}

// Update code that uses the return value:
${change.affectedLocations.map(loc => `//   ${loc.file}:${loc.line}`).join('\n')}
`;
    }

    private generateRemovalCode(change: BreakingChange): string {
        return `
// ${change.symbol.name} has been removed
// Migration options:

// Option 1: Use alternative function
// Replace: ${change.symbol.name}(...)
// With: alternativeFunction(...)

// Option 2: Copy implementation
// If you need the old behavior, copy the implementation from a previous version

// Option 3: Remove usage
// If the functionality is no longer needed, remove all call sites

// Affected locations:
${change.affectedLocations.map(loc => `//   - ${loc.file}:${loc.line}:${loc.column}`).join('\n')}
`;
    }
}

