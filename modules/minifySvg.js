import { spawnSync } from 'child_process';
import fs from 'fs';
import { glob } from 'glob';
import imagemin from 'imagemin';
import imageminSvgo from 'imagemin-svgo';
import os from 'os';
import path from 'path';
import { logger } from './logger.js';

const fsp = fs.promises;

function commandExists(cmd) {
	try {
		const res = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
		return res.status === 0;
	} catch {
		return false;
	}
}

async function minifySvg(srcDir, distDir) {
	// find all svg files in source
	const svgFiles = await glob(path.join(srcDir, '**/*.svg'));
	const outputFiles = [];
	let beforeSize = 0;
	let afterSize = 0;
	const useCleaner = commandExists('svgcleaner');
	if (useCleaner) logger.info('svgcleaner detected, running before SVGO');
	for (const file of svgFiles) {
		const relativePath = path.relative(srcDir, file);
		const destPath = path.join(distDir, relativePath);
		await fsp.mkdir(path.dirname(destPath), { recursive: true });

		let sourceForSvgo = file;
		let tmpFile;
		if (useCleaner) {
			tmpFile = path.join(os.tmpdir(), path.basename(file));
			try {
				spawnSync('svgcleaner', [file, tmpFile]);
				sourceForSvgo = tmpFile;
			} catch {
				// ignore failure; fallback to original
			}
		}

		beforeSize += fs.statSync(file).size;
		const data = await fsp.readFile(sourceForSvgo);
		const optimized = await imagemin.buffer(data, {
			plugins: [
				imageminSvgo({
					multipass: true,
				}),
			],
		});

		await fsp.writeFile(destPath, optimized);
		afterSize += optimized.length;
		logger.info(`Minified SVG: ${relativePath} → ${destPath}`);
		const inSize = fs.statSync(file).size;
		const outSize = optimized.length;
		const diffColor = outSize < inSize ? 'green' : 'red';
		logger.debug(
			`SVG ${relativePath}: ` +
			logger.colorize(`${inSize}→${outSize}`, diffColor),
			{
				src: sourceForSvgo,
				dest: destPath,
				inBytes: inSize,
				outBytes: outSize,
			},
		);
		outputFiles.push(destPath);

		if (tmpFile) {
			await fsp.unlink(tmpFile).catch(() => { });
		}
	}

	return { paths: outputFiles, before: beforeSize, after: afterSize };
}

export { minifySvg };
