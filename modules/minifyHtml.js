import fs from 'fs';
import { minify } from 'html-minifier-next';
import path from 'path';
import { logger } from './logger.js';
const fsp = fs.promises;

async function minifyHtml(htmlFiles, minifiedCss, minifiedScript, distDir) {
	const minifiedPaths = [];

	for (const htmlFile of htmlFiles) {
		let content = await fsp.readFile(htmlFile, 'utf-8');
		const fileName = path.basename(htmlFile);

		// Update asset references
		content = content
			.replace(
				/<link\s+rel=["']stylesheet["']\s+href=["']([^"']+)["']\s*\/?>/g,
				`<link rel="stylesheet" href="${path.basename(minifiedCss)}">`,
			)
			.replace(
				/<script\s+src=["']([^"']+)["']\s*><\/script>/g,
				`<script src="${path.basename(minifiedScript)}"></script>`,
			);

		// Perform HTML Minification
		const minifiedContent = await minify(content, {
			preset: 'comprehensive', // Recommended for maximum savings
			minifyJS: { engine: 'swc' }, // High-performance JS engine
			minifyCSS: true,
		});

		const minifiedPath = path.join(distDir, fileName);
		await fsp.writeFile(minifiedPath, minifiedContent, 'utf-8');

		logger.info(`Minified: ${fileName} (${minifiedContent.length} bytes)`);
		logger.debug({
			input: htmlFile,
			output: minifiedPath,
			inBytes: content.length,
			outBytes: minifiedContent.length,
		});
		minifiedPaths.push(minifiedPath);
	}

	return minifiedPaths;
}

export { minifyHtml };
