/**
 * Logger module with colorized output and configurable log levels.
 * @module logger
 */

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
let currentLevel =
	process.env.LOG_LEVEL || process.env.VERBOSE ? 'debug' : 'info';

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	green: '\x1b[32m',
	cyan: '\x1b[36m',
	gray: '\x1b[90m',
};

/**
 * Applies ANSI color codes to text.
 * @param {string} text - The text to colorize.
 * @param {string} color - The color name (key in colors object).
 * @returns {string} The colorized text, or original text if color is invalid.
 */
function colorize(text, color) {
	if (!colors[color]) return text;
	return colors[color] + text + colors.reset;
}

/**
 * Sets the current log level.
 * @param {string} level - Log level: 'error', 'warn', 'info', or 'debug'.
 */
function setLevel(level) {
	if (levels[level] !== undefined) {
		currentLevel = level;
	}
}

/**
 * Checks if a message with the given level should be logged.
 * @param {string} level - The log level to check.
 * @returns {boolean} True if the level should be logged.
 */
function shouldLog(level) {
	return levels[level] <= levels[currentLevel];
}

/**
 * Returns a colorized prefix for the given log level.
 * @param {string} level - The log level.
 * @returns {string} Colorized prefix string.
 */
function colorPrefix(level) {
	switch (level) {
		case 'error':
			return colors.red + '[ERROR]' + colors.reset;
		case 'warn':
			return colors.yellow + '[WARN]' + colors.reset;
		case 'info':
			return colors.green + '[INFO]' + colors.reset;
		case 'debug':
			return colors.cyan + '[DEBUG]' + colors.reset;
		default:
			return '[LOG]';
	}
}

/**
 * Logs a message with the specified level and arguments.
 * @param {string} level - The log level.
 * @param {...*} args - Arguments to log.
 */
function log(level, ...args) {
	if (shouldLog(level)) {
		const prefix = colorPrefix(level);
		if (level === 'debug') {
			console.debug(prefix, ...args);
		} else if (level === 'info') {
			console.log(prefix, ...args);
		} else if (level === 'warn') {
			console.warn(prefix, ...args);
		} else if (level === 'error') {
			console.error(prefix, ...args);
		} else {
			console.log(prefix, ...args);
		}
	}
}

/**
 * Logger object with methods for different log levels.
 * @typedef {Object} Logger
 * @property {Function} setLevel - Set the log level.
 * @property {Function} error - Log an error message.
 * @property {Function} warn - Log a warning message.
 * @property {Function} info - Log an info message.
 * @property {Function} debug - Log a debug message.
 * @property {Function} colorize - Colorize text.
 */

export const logger = {
	setLevel,
	error: (...a) => log('error', ...a),
	warn: (...a) => log('warn', ...a),
	info: (...a) => log('info', ...a),
	debug: (...a) => log('debug', ...a),
	colorize,
};
