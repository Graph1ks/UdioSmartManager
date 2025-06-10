import { DEBUG_MODE } from './config.js';

export class Logger {
    constructor(moduleName) {
        this.moduleName = moduleName;
    }

    /**
     * Logs a standard message. Only outputs to console if DEBUG_MODE is true.
     * @param {...any} args - The message and/or objects to log.
     */
    log(...args) {
        if (DEBUG_MODE) {
            console.log(`[UdioSmartManager|${this.moduleName}]`, ...args);
        }
    }

    /**
     * Logs a warning message. Only outputs to console if DEBUG_MODE is true.
     * @param {...any} args - The message and/or objects to log as a warning.
     */
    warn(...args) {
        if (DEBUG_MODE) {
            console.warn(`[UdioSmartManager|${this.moduleName}]`, ...args);
        }
    }

    /**
     * Logs an error message. ALWAYS outputs to the console regardless of DEBUG_MODE.
     * @param {...any} args - The message and/or error objects to log.
     */
    error(...args) {
        console.error(`[UdioSmartManager|${this.moduleName}]`, ...args);
    }
}