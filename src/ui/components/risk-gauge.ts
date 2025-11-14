export class RiskGauge {
    public render(score: number, container: HTMLElement): string {
        const color = this.getColorForScore(score);
        const label = this.getRiskLabel(score);

        return `
        <svg width="200" height="120" viewBox="0 0 200 120">
            <defs>
                <path id="gauge-arc" d="M 20 100 A 80 80 0 0 1 180 100" 
                      fill="none" stroke="#374151" stroke-width="20"/>
            </defs>
            
            <!-- Background arc -->
            <use href="#gauge-arc" stroke="#374151"/>
            
            <!-- Risk arc -->
            <path d="M 20 100 A 80 80 0 0 1 ${20 + (score / 100) * 160} ${100 - Math.sin((score / 100) * Math.PI) * 80}"
                  fill="none" stroke="${color}" stroke-width="20" 
                  stroke-linecap="round"/>
            
            <!-- Score text -->
            <text x="100" y="80" text-anchor="middle" 
                  font-size="32" font-weight="bold" fill="${color}">
                ${score}
            </text>
            
            <!-- Label -->
            <text x="100" y="105" text-anchor="middle" 
                  font-size="12" fill="#9CA3AF">
                ${label}
            </text>
        </svg>
        `;
    }

    private getColorForScore(score: number): string {
        if (score <= 30) return '#10B981'; // Green
        if (score <= 60) return '#F59E0B'; // Amber
        if (score <= 85) return '#F97316'; // Orange
        return '#DC2626'; // Red
    }

    private getRiskLabel(score: number): string {
        if (score <= 30) return 'LOW RISK';
        if (score <= 60) return 'MODERATE';
        if (score <= 85) return 'HIGH RISK';
        return 'CRITICAL';
    }
}

