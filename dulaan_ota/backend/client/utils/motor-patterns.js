/**
 * Motor Pattern Library - Predefined PWM patterns for motor control
 * Each pattern defines a sequence of PWM values over time
 */

/**
 * Pattern data structure:
 * {
 *   id: string,           // Unique identifier
 *   name: string,         // Display name (English)
 *   name_sp: string,      // Display name (Spanish)
 *   description: string,  // Pattern description (English)
 *   description_sp: string, // Pattern description (Spanish)
 *   category: string,     // Pattern category
 *   duration: number,     // Total duration in milliseconds
 *   loop: boolean,        // Whether to loop the pattern
 *   frames: [             // Array of time-PWM pairs
 *     { time: number, pwm: number }
 *   ]
 * }
 */

// Relaxing patterns - gentle, calming, peaceful
export const RELAXING_PATTERNS = {
    gentle_waves: {
        id: "gentle_waves",
        name: "Gentle Waves",
        name_sp: "Ondas Suaves",
        description: "Gentle waves, relaxing",
        description_sp: "Ondas suaves, relajantes",
        category: "relaxing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(20 * 2.55) },      // 51
            { time: 1000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 2000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 3000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 4000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 5000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 6000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 7000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 8000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 9000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 10000, pwm: Math.round(40 * 2.55) }   // 102
        ]
    },

    meditation_flow: {
        id: "meditation_flow",
        name: "Meditation Flow",
        name_sp: "Flujo de Meditación",
        description: "Meditation flow, stable and peaceful",
        description_sp: "Flujo de meditación, estable y pacífico",
        category: "relaxing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(40 * 2.55) },      // 102
            { time: 1000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 2000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 3000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 4000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 5000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 6000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 7000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 8000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 9000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 10000, pwm: Math.round(40 * 2.55) }   // 102
        ]
    },

    twilight_drift: {
        id: "twilight_drift",
        name: "Twilight Drift",
        name_sp: "Deriva del Crepúsculo",
        description: "Twilight drift, relaxing wind-down",
        description_sp: "Deriva del crepúsculo, relajación gradual",
        category: "relaxing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(60 * 2.55) },      // 153
            { time: 1000, pwm: Math.round(50 * 2.55) },   // 128
            { time: 2000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 3000, pwm: Math.round(30 * 2.55) },   // 77
            { time: 4000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 5000, pwm: Math.round(10 * 2.55) },   // 26
            { time: 6000, pwm: 0 },                       // 0
            { time: 7000, pwm: Math.round(10 * 2.55) },   // 26
            { time: 8000, pwm: 0 },                       // 0
            { time: 9000, pwm: 0 },                       // 0
            { time: 10000, pwm: 0 }                       // 0
        ]
    },

    ocean_breeze: {
        id: "ocean_breeze",
        name: "Ocean Breeze",
        name_sp: "Brisa del Océano",
        description: "Ocean breeze on face, light and airy",
        description_sp: "Brisa del océano en el rostro, ligera y aireada",
        category: "relaxing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(30 * 2.55) },      // 77
            { time: 1000, pwm: Math.round(50 * 2.55) },   // 128
            { time: 2000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 3000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 4000, pwm: Math.round(30 * 2.55) },   // 77
            { time: 5000, pwm: Math.round(50 * 2.55) },   // 128
            { time: 6000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 7000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 8000, pwm: Math.round(30 * 2.55) },   // 77
            { time: 9000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 10000, pwm: Math.round(20 * 2.55) }   // 51
        ]
    }
};

// Energizing patterns - boosting, awakening, focusing
export const ENERGIZING_PATTERNS = {
    power_pulse: {
        id: "power_pulse",
        name: "Power Pulse",
        name_sp: "Pulso de Poder",
        description: "Powerful pulse, energy boost",
        description_sp: "Pulso poderoso, impulso de energía",
        category: "energizing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(90 * 2.55) },      // 230
            { time: 1000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 2000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 3000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 4000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 5000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 6000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 7000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 8000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 9000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 10000, pwm: Math.round(90 * 2.55) }   // 230
        ]
    },

    sunrise_awakening: {
        id: "sunrise_awakening",
        name: "Sunrise Awakening",
        name_sp: "Despertar del Amanecer",
        description: "Sunrise awakening, gradually strengthening",
        description_sp: "Despertar del amanecer, fortalecimiento gradual",
        category: "energizing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(10 * 2.55) },      // 26
            { time: 1000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 2000, pwm: Math.round(30 * 2.55) },   // 77
            { time: 3000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 4000, pwm: Math.round(50 * 2.55) },   // 128
            { time: 5000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 6000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 7000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 8000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 9000, pwm: Math.round(100 * 2.55) },  // 255
            { time: 10000, pwm: Math.round(100 * 2.55) }  // 255
        ]
    },

    focus_booster: {
        id: "focus_booster",
        name: "Focus Booster",
        name_sp: "Potenciador de Concentración",
        description: "Focus enhancement, stable concentration",
        description_sp: "Mejora de concentración, enfoque estable",
        category: "energizing",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(70 * 2.55) },      // 179
            { time: 1000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 2000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 3000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 4000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 5000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 6000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 7000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 8000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 9000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 10000, pwm: Math.round(70 * 2.55) }   // 179
        ]
    }
};

// Dynamic patterns - rhythmic, lively, alternating
export const DYNAMIC_PATTERNS = {
    rhythmic_dance: {
        id: "rhythmic_dance",
        name: "Rhythmic Dance",
        name_sp: "Danza Rítmica",
        description: "Rhythmic dance, lively",
        description_sp: "Danza rítmica, animada",
        category: "dynamic",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(80 * 2.55) },      // 204
            { time: 1000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 2000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 3000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 4000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 5000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 6000, pwm: Math.round(60 * 2.55) },   // 153
            { time: 7000, pwm: Math.round(40 * 2.55) },   // 102
            { time: 8000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 9000, pwm: Math.round(20 * 2.55) },   // 51
            { time: 10000, pwm: Math.round(20 * 2.55) }   // 51
        ]
    },

    storm_rush: {
        id: "storm_rush",
        name: "Storm Rush",
        name_sp: "Tormenta Intensa",
        description: "Storm and rain, intense burst",
        description_sp: "Tormenta y lluvia, ráfaga intensa",
        category: "dynamic",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(100 * 2.55) },     // 255
            { time: 1000, pwm: 0 },                       // 0
            { time: 2000, pwm: Math.round(100 * 2.55) },  // 255
            { time: 3000, pwm: 0 },                       // 0
            { time: 4000, pwm: Math.round(80 * 2.55) },   // 204
            { time: 5000, pwm: 0 },                       // 0
            { time: 6000, pwm: Math.round(100 * 2.55) },  // 255
            { time: 7000, pwm: 0 },                       // 0
            { time: 8000, pwm: Math.round(100 * 2.55) },  // 255
            { time: 9000, pwm: 0 },                       // 0
            { time: 10000, pwm: 0 }                       // 0
        ]
    },

    tech_pulse: {
        id: "tech_pulse",
        name: "Tech Pulse",
        name_sp: "Pulso Tecnológico",
        description: "Tech rhythm, modern feel",
        description_sp: "Ritmo tecnológico, sensación moderna",
        category: "dynamic",
        duration: 10000,
        loop: true,
        frames: [
            { time: 0, pwm: Math.round(90 * 2.55) },      // 230
            { time: 1000, pwm: 0 },                       // 0
            { time: 2000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 3000, pwm: 0 },                       // 0
            { time: 4000, pwm: Math.round(70 * 2.55) },   // 179
            { time: 5000, pwm: 0 },                       // 0
            { time: 6000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 7000, pwm: 0 },                       // 0
            { time: 8000, pwm: Math.round(90 * 2.55) },   // 230
            { time: 9000, pwm: 0 },                       // 0
            { time: 10000, pwm: 0 }                       // 0
        ]
    }
};

// Remove special patterns - replaced with user-defined patterns

// Combine all patterns into a single library
export const MOTOR_PATTERN_LIBRARY = {
    ...RELAXING_PATTERNS,
    ...ENERGIZING_PATTERNS,
    ...DYNAMIC_PATTERNS
};

// Pattern categories for organization
export const PATTERN_CATEGORIES = {
    relaxing: {
        name: "Relaxing",
        description: "Gentle, calming, peaceful patterns",
        patterns: Object.keys(RELAXING_PATTERNS)
    },
    energizing: {
        name: "Energizing", 
        description: "Boosting, awakening, focusing patterns",
        patterns: Object.keys(ENERGIZING_PATTERNS)
    },
    dynamic: {
        name: "Dynamic",
        description: "Rhythmic, lively, alternating patterns", 
        patterns: Object.keys(DYNAMIC_PATTERNS)
    }
};

// Utility functions
export const PatternUtils = {
    /**
     * Get all pattern IDs
     */
    getAllPatternIds() {
        return Object.keys(MOTOR_PATTERN_LIBRARY);
    },

    /**
     * Get patterns by category
     */
    getPatternsByCategory(category) {
        return Object.values(MOTOR_PATTERN_LIBRARY).filter(pattern => pattern.category === category);
    },

    /**
     * Get pattern by ID
     */
    getPattern(id) {
        return MOTOR_PATTERN_LIBRARY[id] || null;
    },

    /**
     * Validate pattern structure
     */
    validatePattern(pattern) {
        const required = ['id', 'name', 'name_sp', 'description', 'description_sp', 'category', 'duration', 'loop', 'frames'];
        const missing = required.filter(field => !(field in pattern));
        
        if (missing.length > 0) {
            return { valid: false, errors: [`Missing required fields: ${missing.join(', ')}`] };
        }

        if (!Array.isArray(pattern.frames)) {
            return { valid: false, errors: ['Frames must be an array'] };
        }

        const frameErrors = [];
        pattern.frames.forEach((frame, index) => {
            if (typeof frame.time !== 'number' || typeof frame.pwm !== 'number') {
                frameErrors.push(`Frame ${index}: time and pwm must be numbers`);
            }
            if (frame.pwm < 0 || frame.pwm > 255) {
                frameErrors.push(`Frame ${index}: pwm must be between 0 and 255`);
            }
        });

        return { valid: frameErrors.length === 0, errors: frameErrors };
    },

    /**
     * Generate random pattern for random_walk
     */
    generateRandomPattern(duration = 5000, frameCount = 10) {
        const frames = [];
        const timeStep = duration / (frameCount - 1);
        
        for (let i = 0; i < frameCount; i++) {
            frames.push({
                time: Math.round(i * timeStep),
                pwm: Math.round(Math.random() * 255)
            });
        }
        
        return frames;
    }
};

// Global access
if (typeof window !== 'undefined') {
    window.MotorPatterns = {
        MOTOR_PATTERN_LIBRARY,
        PATTERN_CATEGORIES,
        PatternUtils
    };
}