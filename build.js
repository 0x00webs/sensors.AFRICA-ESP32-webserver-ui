import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import {
	logger,
	minifyCss,
	minifyHtml,
	minifyImages,
	minifyJs,
	minifySvg,
} from './modules/index.js';
const fsp = fs.promises;

async function build() {
	const srcDir = 'src';
	const htmlFiles = await glob(`${srcDir}/**/*.html`);
	const distDir = 'dist';

	// clean dist directory
	if (fs.existsSync(distDir)) {
		await fsp.rm(distDir, { recursive: true, force: true });
		logger.info('Cleaned dist directory');
	}

	if (!fs.existsSync(distDir)) await fsp.mkdir(distDir, { recursive: true });

	// run minifiers and receive size info
	const cssResult = await minifyCss(htmlFiles, distDir, srcDir);
	const jsResult = await minifyJs(htmlFiles, distDir, srcDir);
	const imgResult = await minifyImages(srcDir, distDir);
	const svgResult = await minifySvg(srcDir, distDir);
	const [minifiedCss] = cssResult.paths;
	const [minifiedScript] = jsResult.paths;
	await minifyHtml(htmlFiles, minifiedCss, minifiedScript, distDir, srcDir);

	// compute html before/after sizes
	let htmlBefore = 0,
		htmlAfter = 0;
	for (const file of htmlFiles) {
		const content = await fsp.readFile(file, 'utf-8');
		htmlBefore += content.length;
		const outPath = path.join(distDir, path.basename(file));
		if (fs.existsSync(outPath)) htmlAfter += fs.statSync(outPath).size;
	}

	logger.info('Build completed successfully!');
	const htmlColor = htmlAfter < htmlBefore ? 'green' : 'red';
	logger.info(
		`HTML size: ` +
		logger.colorize(`${htmlBefore}→${htmlAfter}`, htmlColor) +
		' bytes',
	);
	const cssColor = cssResult.after < cssResult.before ? 'green' : 'red';
	logger.info(
		`Minified CSS: ${minifiedCss} (` +
		logger.colorize(
			`${cssResult.before}→${cssResult.after}`,
			cssColor,
		) +
		` bytes)`,
	);
	const jsColor = jsResult.after < jsResult.before ? 'green' : 'red';
	logger.info(
		`Minified JS: ${minifiedScript} (` +
		logger.colorize(`${jsResult.before}→${jsResult.after}`, jsColor) +
		` bytes)`,
	);
	const imgColor = imgResult.after < imgResult.before ? 'green' : 'red';
	logger.info(
		`Minified Images: ${imgResult.paths} (` +
		logger.colorize(
			`${imgResult.before}→${imgResult.after}`,
			imgColor,
		) +
		` bytes)`,
	);
	const svgColor = svgResult.after < svgResult.before ? 'green' : 'red';
	logger.info(
		`Minified SVGs: ${svgResult.paths} (` +
		logger.colorize(
			`${svgResult.before}→${svgResult.after}`,
			svgColor,
		) +
		` bytes)`,
	);
	logger.info(`Total size: ${getDirectorySize(distDir)} bytes`);
	logger.info(`Dist directory: ${distDir}`);
}

function getDirectorySize(dir) {
	let total = 0;
	const files = fs.readdirSync(dir, { withFileTypes: true });
	for (const file of files) {
		const fullPath = path.join(dir, file.name);
		if (file.isDirectory()) {
			total += getDirectorySize(fullPath);
		} else {
			total += fs.statSync(fullPath).size;
		}
	}
	return total;
}

await build().catch((error) => {
	logger.error('Error during build:', error);
	process.exit(1);
});
