console.debug("[TerraML] Initializing TerraML...");

window.terra ??= {};
terra.internal ??= {};

/** Run this function right before `startGame()` is called, but after webpack is initialized  */
async function preGameStart() {
	window.__webpack_modules__ = __webpack_require__.m;

	try {
		setupWebpackExports();

		await loadMods();
	} catch (err) {
		console.error(`[TerraML] Unexpected error encountered':`, err);
	}

}

terra.internal._pre_start = preGameStart;

function injectAndRunGame(code) {
	terra.internal.bundle_src_original = code;

	let injectSuccessful = false;

	code = code.replace(/\(\(\)\s*=>\s*\{\s*\/\/\s*webpackBootstrap/, () => {
		injectSuccessful = true;
		return "( async () => { // webpackBootstrap";
	});

	// Export __webpack_require__ to be used outside of the webpack file
	code = code.replace(/(?:\.\.\/)*terra\/js\/game\/index\.js/, (match) => {
		injectSuccessful = true;
		return match + `\nwindow.__webpack_require__ = __webpack_require__;\nawait terra.internal._pre_start();`;
	});

	if (!injectSuccessful) {
		console.error("[TerraML] Failed to inject webpack!")
	}

	// Turn unused webpack module exports into real exports
	// Enjoy more open modding capabilities!
	code = code.replace(
		/\/\*\s*unused harmony exports?\s*(.*?) \*\//g,
		(match, names) => {
			const additions = names.split(",")
				.map(n => n.trim())
				.map(n => `${n}: () => ${n}`)
				.join(", ");
			return `${match}\n__webpack_require__.d(__webpack_exports__, { ${additions} });`;
		}
	);

	code = code.replace(
		/\/\/\s*UNUSED EXPORTS:\s*(.*?)\s*$/gm,
		(match, names) => {
			const additions = names.split(",")
				.map(n => n.trim())
				.map(n => `${n}: () => ${n}`)
				.join(", ");
			return `${match}\n__webpack_require__.d(__webpack_exports__, { ${additions} });`;
		}
	);

	code += "\n//# sourceURL=dist/bundle.js";

	terra.internal.bundle_src = code;

	console.debug("[TerraML] Webpack successfully injected!");

	// Run the original game as ES module
	const blob = new Blob([code], { type: "text/javascript" });
	const url = URL.createObjectURL(blob);
	import(url).finally(() => URL.revokeObjectURL(url));
}

/** Appends addon to the game's AddonManager */
function addAddon(addon, orders = {}) {
	terra.export.g_addons.add({ addon, orders });
}

terra.addAddon = addAddon;

// Hook into 'bundle.js' script initialization to inject our modloader goodness
new MutationObserver(function (mutations, observer) {
	for (const { addedNodes } of mutations) {
		for (const node of addedNodes) {
			if (node.tagName !== "SCRIPT") continue;
			const src = node.getAttribute("src");
			if (!src || !src.includes("bundle.js")) continue;

			observer.disconnect();
			node.remove();

			fetch(src)
				.then(r => r.text())
				.then(code => injectAndRunGame(code));
		}
	}
}).observe(document.documentElement, { childList: true, subtree: true });

/** Parses webpack modules to expose game exports  */
function setupWebpackExports() {
	const fileExports = {};  // "player.js" -> { id, exports: { realName -> minKey }, result }
	terra.internal.fileExports = fileExports;
	const globalExports = {};
	terra.internal.globalExports = globalExports;

	// Parse all webpack modules
	for (const [id, factory] of Object.entries(__webpack_modules__)) {
		const moduleCode = factory.toString();

		const fileMarkers = [];
		for (const match of moduleCode.matchAll(/\/\/# sourceMappingURL=(.+?)\.map/g)) {
			fileMarkers.push({ pos: match.index, file: match[1].split("/").pop() });
		}

		if (!fileMarkers.length) continue;

		// Get all exports of a module
		const _moduleExports = {};
		for (const block of moduleCode.matchAll(/__webpack_require__\.d\(__webpack_exports__,\s*\{([\s\S]*?)\}\s*\)/g)) {
			for (const [, minKey, realName] of block[1].matchAll(
				/([\w$]+)\s*:\s*\(\s*\)\s*=>\s*\(?(?:\/\*[^*]*\*\/\s*)?([\w$]+)\)?/g
			)) {
				_moduleExports[realName] = minKey;
			}
		}

		// Map exports to their specific source files for concatenated modules
		const _fileExports = {};
		if (fileMarkers.length === 1) {
			_fileExports[fileMarkers[0].file] = { ..._moduleExports };
		} else {
			for (const [realName, minKey] of Object.entries(_moduleExports)) {
				const match = new RegExp(`(?:var|let|const|function\\*?|class)\\s+${realName}[\\s=({]`).exec(moduleCode);
				if (!match) continue;
				const marker = fileMarkers.find(m => m.pos > match.index);
				if (!marker) continue;
				(_fileExports[marker.file] ??= {})[realName] = minKey;
			}
		}

		const raw = __webpack_require__(id);
		for (const marker of fileMarkers) {
			const exports = _fileExports[marker.file] ?? _moduleExports;

			// Build a live result object for this file
			const result = {};
			for (const [realName, minKey] of Object.entries(exports)) {
				Object.defineProperty(result, realName, {
					get: () => raw[minKey],
					enumerable: true,
					configurable: true
				});
			}

			fileExports[marker.file] = { id, exports, result };

			// Merge into global exports (first definition wins to avoid conflicts)
			for (const [realName, minKey] of Object.entries(exports)) {
				if (!Object.prototype.hasOwnProperty.call(globalExports, realName)) {
					Object.defineProperty(globalExports, realName, {
						get: () => raw[minKey],
						enumerable: true,
						configurable: true
					});
				}
			}
		}
	}

	// terra.export — flat access to every export across all modules
	window.terra.export = globalExports;

	// terra.file — camelCase per-file access, plain object
	const getFile = {};
	for (const [file, { result }] of Object.entries(fileExports)) {
		const camel = file.replace(/\.js$/, "").replace(/[-_]./g, m => m[1].toUpperCase());
		Object.defineProperty(getFile, camel, {
			value: result,
			enumerable: true,
			configurable: true
		});
	}
	window.terra.file = getFile;

	console.debug("[TerraML] Webpack exports set up!");
}

/** Reads the directories and loads the mods one by one */
async function loadMods() {
	const fs = require("fs");
	const path = require("path");

	const modDirectory = "./mods";

	if (!fs.existsSync(modDirectory)) {
		fs.mkdirSync(modDirectory);
	}

	let modManifests = [];

	for (const folder of fs.readdirSync(modDirectory)) {
		const folderPath = path.join(modDirectory, folder);
		if (!fs.statSync(folderPath).isDirectory()) continue;

		const manifestPath = path.join(folderPath, "manifest.json");
		if (!fs.existsSync(manifestPath)) continue;

		try {
			const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
			manifest.name = manifest.name || folder;
			manifest.main = manifest.main || "main.js";
			manifest.path = path.resolve(folderPath, manifest.main);
			modManifests.push(manifest);
		} catch (err) {
			console.warn(`[TerraML] Failed to load mod in ${folderPath}:`, err);
		}
	}

	modManifests.sort((a, b) => (b.priority || 0) - (a.priority || 0));

	console.log(`[TerraML] Found mods: ${modManifests.length}`);
	let loadedMods = 0;

	for (const manifest of modManifests) {
		if (!fs.existsSync(manifest.path)) {
			console.warn(`[TerraML] Failed to load mod ${manifest.name}: '${manifest.main}' does not exist`);
			continue;
		}
		try {
			console.debug(`[TerraML] Loading mod: ${manifest.name} (ver. ${manifest.version})`);
			const fileUrl = "file://" + manifest.path.replace(/\\/g, "/");
			await import(fileUrl);
			console.debug(`[TerraML] Loaded: ${manifest.name}`);
			loadedMods++;
		} catch (err) {
			console.warn(`[TerraML] Error in '${manifest.name}':`, err);
		}
	}

	terra.internal.modManifests = modManifests;
	terra.internal.totalMods = modManifests.length;
	terra.internal.loadedMods = loadedMods;

	// Add mod counter to title screen
	let originalStartGame = terra.export.SceneManager.prototype.startGame;
	terra.export.SceneManager.prototype.startGame = function (...args) {
		const titleScreenHook = terra.export.g_gui.hooks.find(hook =>
			hook.gui && hook.gui.constructor.name === "TitleScreen"
		);

		titleScreenHook.gui.version.textBlock.setText(`${titleScreenHook.gui.version.textBlock.decoratedText} | Mods: ${loadedMods}`);

		return originalStartGame.apply(this, args);
	}

	console.log(`[TerraML] Loaded mods: ${loadedMods}`);
}

const Module = require('module');
const { fileURLToPath } = require('url');
const path = require('path');

window.makeRequire = (metaUrl) => {
	const dir = path.dirname(fileURLToPath(metaUrl));
	const localRequire = Module.createRequire(metaUrl);

	return (id) => {
		// Relative path → resolve from caller's directory
		if (id.startsWith('.')) return localRequire(path.resolve(dir, id));
		// Bare specifier (npm package or built-in) → normal resolution
		return localRequire(id);
	};
}

//# sourceURL=modloader.js
