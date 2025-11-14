import * as vscode from 'vscode';
import { DependencyGraphManager } from './dependency-graph';

export interface DependencyImpact {
    packageName: string;
    version: string;
    type: 'install' | 'remove' | 'update';
    conflicts: Array<{
        package: string;
        reason: string;
        severity: 'critical' | 'warning' | 'info';
    }>;
    affectedFiles: Array<{
        file: string;
        reason: string;
        action: 'update' | 'add' | 'remove' | 'verify';
    }>;
    breakingChanges: Array<{
        description: string;
        affectedFiles: string[];
    }>;
    migrationSteps: string[];
    riskScore: number;
    estimatedEffort: 'low' | 'medium' | 'high' | 'critical';
}

export class DependencyInstallImpactAnalyzer {
    constructor(private graphManager: DependencyGraphManager) {}

    public async analyzeInstall(
        packageName: string,
        version: string
    ): Promise<DependencyImpact> {
        // Analyze what happens if we install this package
        const conflicts = await this.detectConflicts(packageName, version);
        const affectedFiles = await this.findAffectedFiles(packageName);
        const breakingChanges = await this.detectBreakingChanges(packageName, version);
        const migrationSteps = this.generateMigrationSteps(packageName, version, affectedFiles);

        const riskScore = this.calculateRiskScore(conflicts, breakingChanges, affectedFiles);
        const estimatedEffort = this.estimateEffort(riskScore, affectedFiles.length);

        return {
            packageName,
            version,
            type: 'install',
            conflicts,
            affectedFiles,
            breakingChanges,
            migrationSteps,
            riskScore,
            estimatedEffort
        };
    }

    public async analyzeRemove(
        packageName: string
    ): Promise<DependencyImpact> {
        // Analyze what breaks if we remove this package
        const affectedFiles = await this.findFilesUsingPackage(packageName);
        const breakingChanges = affectedFiles.map(file => ({
            description: `File uses removed package "${packageName}"`,
            affectedFiles: [file.file]
        }));

        const riskScore = this.calculateRiskScore([], breakingChanges, affectedFiles);
        const estimatedEffort = this.estimateEffort(riskScore, affectedFiles.length);

        return {
            packageName,
            version: '',
            type: 'remove',
            conflicts: [],
            affectedFiles: affectedFiles.map(f => ({
                ...f,
                action: 'remove' as const
            })),
            breakingChanges,
            migrationSteps: this.generateRemovalSteps(packageName, affectedFiles),
            riskScore,
            estimatedEffort
        };
    }

    private async detectConflicts(
        packageName: string,
        version: string
    ): Promise<DependencyImpact['conflicts']> {
        const conflicts: DependencyImpact['conflicts'] = [];

        try {
            // Check package.json for existing dependencies
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) return conflicts;

            const packageJsonPath = require('path').join(workspaceRoot, 'package.json');
            const fs = require('fs');
            
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const allDeps = {
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies,
                    ...packageJson.peerDependencies
                };

                // Check for version conflicts
                if (allDeps[packageName]) {
                    conflicts.push({
                        package: packageName,
                        reason: `Already installed with version ${allDeps[packageName]}`,
                        severity: 'warning'
                    });
                }

                // Check for peer dependency issues (simplified)
                // In real implementation, would check peer dependencies
            }
        } catch (error) {
            console.error('Error detecting conflicts:', error);
        }

        return conflicts;
    }

    private async findAffectedFiles(
        packageName: string
    ): Promise<DependencyImpact['affectedFiles']> {
        const affectedFiles: DependencyImpact['affectedFiles'] = [];

        try {
            // Find files that might import/use this package
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,tsx,js,jsx}',
                '**/node_modules/**'
            );

            for (const file of files) {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                
                // Simple check for package usage patterns
                if (text.includes(packageName) || text.includes(packageName.replace('-', '_'))) {
                    affectedFiles.push({
                        file: file.fsPath,
                        reason: `May use or import "${packageName}"`,
                        action: 'verify'
                    });
                }
            }
        } catch (error) {
            console.error('Error finding affected files:', error);
        }

        return affectedFiles;
    }

    private async findFilesUsingPackage(
        packageName: string
    ): Promise<Array<{ file: string; reason: string }>> {
        const files: Array<{ file: string; reason: string }> = [];

        try {
            const workspaceFiles = await vscode.workspace.findFiles(
                '**/*.{ts,tsx,js,jsx}',
                '**/node_modules/**'
            );

            for (const file of workspaceFiles) {
                const document = await vscode.workspace.openTextDocument(file);
                const text = document.getText();
                
                // Check for imports/requires of this package
                const importPattern = new RegExp(
                    `(import|require|from)\\s+['"]${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
                    'i'
                );

                if (importPattern.test(text)) {
                    files.push({
                        file: file.fsPath,
                        reason: `Imports or requires "${packageName}"`
                    });
                }
            }
        } catch (error) {
            console.error('Error finding files using package:', error);
        }

        return files;
    }

    private async detectBreakingChanges(
        packageName: string,
        version: string
    ): Promise<DependencyImpact['breakingChanges']> {
        // In a real implementation, this would:
        // 1. Check package changelog
        // 2. Compare versions
        // 3. Check for known breaking changes
        // For now, return empty array
        return [];
    }

    private generateMigrationSteps(
        packageName: string,
        version: string,
        affectedFiles: DependencyImpact['affectedFiles']
    ): string[] {
        const steps: string[] = [];

        steps.push(`Install ${packageName}@${version}`);
        
        if (affectedFiles.length > 0) {
            steps.push(`Review ${affectedFiles.length} potentially affected files`);
            steps.push('Update imports if needed');
            steps.push('Test affected functionality');
        }

        return steps;
    }

    private generateRemovalSteps(
        packageName: string,
        affectedFiles: Array<{ file: string; reason: string }>
    ): string[] {
        const steps: string[] = [];

        if (affectedFiles.length > 0) {
            steps.push(`⚠️ Warning: ${affectedFiles.length} files use this package`);
            steps.push('Remove or replace imports in affected files');
            steps.push(`Remove ${packageName} from package.json`);
            steps.push('Run tests to verify nothing breaks');
        } else {
            steps.push(`Remove ${packageName} from package.json`);
            steps.push('No files appear to use this package');
        }

        return steps;
    }

    private calculateRiskScore(
        conflicts: DependencyImpact['conflicts'],
        breakingChanges: DependencyImpact['breakingChanges'],
        affectedFiles: Array<{ file: string }>
    ): number {
        let score = 0;

        // Conflicts
        conflicts.forEach(c => {
            if (c.severity === 'critical') score += 30;
            else if (c.severity === 'warning') score += 15;
        });

        // Breaking changes
        score += breakingChanges.length * 20;

        // Affected files
        score += Math.min(affectedFiles.length * 2, 30);

        return Math.min(score, 100);
    }

    private estimateEffort(
        riskScore: number,
        affectedFilesCount: number
    ): DependencyImpact['estimatedEffort'] {
        if (riskScore >= 85 || affectedFilesCount > 50) return 'critical';
        if (riskScore >= 60 || affectedFilesCount > 20) return 'high';
        if (riskScore >= 30 || affectedFilesCount > 10) return 'medium';
        return 'low';
    }
}

