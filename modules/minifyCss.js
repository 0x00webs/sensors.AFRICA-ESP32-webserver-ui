import { minify } from 'csso';
import fs from 'fs';
import path from 'path';
import { PurgeCSS } from 'purgecss';
import { logger } from './logger.js';

const fsp = fs.promises;

async function minifyCss(htmlFiles, distDir, srcDir) {
	const cssFiles = new Set();
	const linkRegex =
		/<link\s+rel=["']stylesheet["']\s+href=["']([^"']+)["']\s*\/?>/g;

	// Extract CSS paths from HTML
	for (const htmlFile of htmlFiles) {
		const content = await fsp.readFile(htmlFile, 'utf-8');
		let match;
		while ((match = linkRegex.exec(content)) !== null) {
			// Resolve to absolute path to ensure uniqueness and file accessibility
			const fullPath = path.resolve(srcDir, match[1]);
			cssFiles.add(fullPath);
		}
	}

	const cssArray = Array.from(cssFiles);
	if (cssArray.length === 0) {
		logger.warn('No CSS files found in the provided HTML files.');
		return { paths: [], before: 0, after: 0 };
	}

	// log each source file size and emit info/debug entry per file
	for (const f of cssArray) {
		if (fs.existsSync(f)) {
			const sz = fs.statSync(f).size;
			logger.info(`Minifying CSS file: ${path.basename(f)}`);
			logger.debug({
				input: f,
				output: 'bundle(styles.min.css)',
				inBytes: sz,
				outBytes: null,
			});
		}
	}

	// compute original size
	let beforeSize = 0;
	for (const f of cssArray) {
		if (fs.existsSync(f)) beforeSize += fs.statSync(f).size;
	}

	// Purge unused styles
	const purgeCSSResults = await new PurgeCSS().purge({
		content: htmlFiles,
		css: cssArray,
	});

	// Combine & Minify
	const combinedCss = purgeCSSResults.map((r) => r.css).join('\n');
	const minified = minify(combinedCss).css;

	// Write output
	const minifiedPath = path.join(distDir, 'styles.min.css');

	await fsp.mkdir(distDir, { recursive: true });
	await fsp.writeFile(minifiedPath, minified, 'utf-8');

	const afterSize = minified.length;
	const diffColor = afterSize < beforeSize ? 'green' : 'red';
	logger.info(
		`Created bundle: styles.min.css (` +
		logger.colorize(`${beforeSize}→${afterSize} bytes`, diffColor) +
			`)
	`,
	);
	logger.debug({ before: beforeSize, after: afterSize, path: minifiedPath });

	return { paths: [minifiedPath], before: beforeSize, after: afterSize };
}

export { minifyCss };
