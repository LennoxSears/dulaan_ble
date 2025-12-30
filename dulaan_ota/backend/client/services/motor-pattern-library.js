/**
 * Motor Pattern Library Service - Pattern storage and management
 * Handles pattern storage, validation, and retrieval (playback handled by pattern-control.js)
 */

import { MOTOR_PATTERN_LIBRARY, PATTERN_CATEGORIES, PatternUtils } from '../utils/motor-patterns.js';

class MotorPatternLibrary {
    constructor() {
        // Pattern library
        this.patterns = { ...MOTOR_PATTERN_LIBRARY };
        this.categories = { ...PATTERN_CATEGORIES };
    }

    /**
     * Get all available patterns
     */
    getAllPatterns() {
        return Object.values(this.patterns);
    }

    /**
     * Get patterns by category
     */
    getPatternsByCategory(category) {
        return Object.values(this.patterns).filter(pattern => pattern.category === category);
    }

    /**
     * Get pattern by ID
     */
    getPattern(id) {
        return this.patterns[id] || null;
    }

    /**
     * Add custom pattern to library
     */
    addPattern(pattern) {
        const validation = PatternUtils.validatePattern(pattern);
        if (!validation.valid) {
            throw new Error(`Invalid pattern: ${validation.errors.join(', ')}`);
        }

        this.patterns[pattern.id] = { ...pattern };
        console.log(`[Pattern Library] Added custom pattern: ${pattern.name}`);
        return true;
    }

    /**
     * Remove pattern from library
     */
    removePattern(id) {
        if (this.patterns[id]) {
            delete this.patterns[id];
            console.log(`[Pattern Library] Removed pattern: ${id}`);
            return true;
        }
        return false;
    }

    /**
     * Get pattern library statistics
     */
    getLibraryStats() {
        const patterns = Object.values(this.patterns);
        const categories = {};

        patterns.forEach(pattern => {
            if (!categories[pattern.category]) {
                categories[pattern.category] = 0;
            }
            categories[pattern.category]++;
        });

        return {
            totalPatterns: patterns.length,
            categories: categories
        };
    }
}

// Create singleton instance
const motorPatternLibrary = new MotorPatternLibrary();

// Export both class and instance
export { MotorPatternLibrary, motorPatternLibrary };

// Global access
if (typeof window !== 'undefined') {
    window.motorPatternLibrary = motorPatternLibrary;
}