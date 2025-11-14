import { BreakingChange } from '../analysis/impact-analyzer';

export class CodemodGenerator {
    public generateJscodeshiftTransform(change: BreakingChange): string {
        return `
// jscodeshift transform for ${change.symbol.name}
// Run: jscodeshift -t this-file.js src/**/*.ts

module.exports = function(fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
    
    // Find all call expressions
    root.find(j.CallExpression, {
        callee: { name: '${change.symbol.name}' }
    })
    .forEach(path => {
        const args = path.value.arguments;
        ${this.generateTransformLogic(change)}
    });
    
    return root.toSource();
};
`;
    }

    private generateTransformLogic(change: BreakingChange): string {
        switch (change.changeType) {
            case 'signature':
                return `
        // Add new required parameter
        if (args.length < ${this.estimateNewParamCount(change)}) {
            args.push(j.identifier('defaultValue'));
        }
                `;
            case 'parameter':
                if (change.description.includes('removed')) {
                    return `
        // Remove deprecated parameters
        if (args.length > 0) {
            path.value.arguments = args.slice(0, args.length - 1);
        }
                    `;
                } else {
                    return `
        // Add new parameters
        if (args.length < ${this.estimateNewParamCount(change)}) {
            args.push(j.literal(null));
        }
                    `;
                }
            default:
                return '// Manual migration required';
        }
    }

    private estimateNewParamCount(change: BreakingChange): number {
        // Simplified estimation
        return 2; // Would parse actual signature
    }

    public generateDeprecationWrapper(change: BreakingChange): string {
        return `
/**
 * @deprecated Use ${change.symbol.name}() instead
 * This wrapper is provided for backward compatibility
 */
function ${change.symbol.name}_deprecated(oldParams) {
    console.warn('${change.symbol.name}_deprecated is deprecated. Migrate to ${change.symbol.name}()');
    
    // Adapt old parameters to new signature
    const newParams = {
        ...oldParams,
        // Add new required parameters with sensible defaults
    };
    
    return ${change.symbol.name}(newParams);
}
`;
    }
}

