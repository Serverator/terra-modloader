console.debug("[TerraML] Initializing TerraML...");

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
				.then(code => {

					// Export __webpack_require__ to be used outside of the webpack file
					code = code.replace(
						"__webpack_require__.m = __webpack_modules__;",
						"__webpack_require__.m = __webpack_modules__;\nwindow.__webpack_require__ = __webpack_require__;"
					);

					// Turn unused webpack module exports into real exports
					// Enjoy more open modding capabilities!
					code = code.replace(
						/\/\* unused harmony exports? (.*?) \*\//g,
						(match, names) => {
							const additions = names.split(",")
								.map(n => n.trim())
								.map(n => `${n}: () => ${n}`)
								.join(", ");
							return `${match}\n__webpack_require__.d(__webpack_exports__, { ${additions} });`;
						}
					);

					// Run the original game
					eval(code);

					window.__webpack_modules__ = __webpack_require__.m;

					console.debug("[TerraML] Webpack successfully injected!");
					buildModuleResolver();
					load_mods();
				});
		}
	}
}).observe(document.documentElement, { childList: true, subtree: true });

// Parses webpack modules to make module imports way simpler
function buildModuleResolver() {

	// List of files and available exports for them
	// "player_model.js" -> { id, exports: { g_player: "w", ... } }
	const exportMap = {};
	const idMap = {};
	window.webpack_exports = exportMap;
	window.webpack_ids = idMap;

	for (const [id, factory] of Object.entries(__webpack_require__.m)) {
		const src = factory.toString();

		// Extract all source filenames (concatenated modules have multiple)
		const files = [...src.matchAll(/\/\/# sourceMappingURL=(.+?)\.map/g)]
			.map(m => m[1].split("/").pop()); // basename only: "player.js"

		if (!files.length) continue;

		// Extract minifiedKey -> realName from __webpack_require__.d(...)
		const exports = {};
		for (const block of src.matchAll(/__webpack_require__\.d\(__webpack_exports__,\s*\{([\s\S]*?)\}\s*\)/g)) {
			for (const [, minKey, realName] of block[1].matchAll(
				/(\w+)\s*:\s*\(\s*\)\s*=>\s*\(?(?:\/\*[^*]*\*\/\s*)?(\w+)\)?/g
			)) {
				exports[realName] = minKey;
			}
		}

		// All filenames in a concatenated module share the same exports
		for (const file of files) {
			exportMap[file] = { id, exports };
			idMap[id] = { id, exports };
		}
	}

	// Add function terra_require(module) to global space
	// `module` can be a file name, path or webpack id (NOT RECOMMENDED)
	window.terra_require = function terra_require(query) {
		let entry;

		if (typeof query === "number" || /^\d+$/.test(query)) {
			entry = idMap[+query];
			// Fall back to raw if module has no sourcemap/exports info
			if (!entry) return __webpack_require__(+query);
		} else {
			const filename = query.split("/").pop().replace(/\.js$/, "") + ".js";
			entry = exportMap[filename];
		}

		if (!entry) throw new Error(`[TerraML] Module not found: ${query}`);

		const raw = __webpack_require__(entry.id);
		const result = {};
		for (const [realName, minKey] of Object.entries(entry.exports)) {
			Object.defineProperty(result, realName, {
				get: () => raw[minKey],
				enumerable: true,
				configurable: true
			});
		}
		return result;
	};
}

// Reads the directories and loads the mods one by one
function load_mods() {
	const fs = require('fs');
	const path = require('path');

	console.debug("[TerraML] Started mod loading");

	const modDirectory = "./mods";

	if (!fs.existsSync(modDirectory)) {
		fs.mkdirSync(modDirectory);
	}

	let folders = fs.readdirSync(modDirectory);

	let modManifests = [];

	for (const folder of folders) {
		const folderPath = path.join(modDirectory, folder);

		if (!fs.statSync(folderPath).isDirectory()) {
			continue;
		}

		const manifestPath = path.join(folderPath, 'mod.json');
		if (!fs.existsSync(manifestPath)) {
			continue;
		}

		try {
			const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

			manifest.name = manifest.name || folder;
			manifest.main = manifest.main || "main.js";

			manifest.path = folderPath;

			manifest.path = path.join(manifest.path, manifest.main || "main.js");

			modManifests.push(manifest);
		} catch (err) {
			console.warn(`[TerraML] Failed to load mod in ${folderPath}:`, err)
		}
	}

	// Sort mods by specified priority
	modManifests.sort((a, b) => {
		return (b.priority || 0) - (a.priority || 0);
	});

	console.log(`[TerraML] Found mods: ${modManifests.length}`);
	var loadedMods = 0;

	for (const manifest of modManifests) {
		if (!fs.existsSync(manifest.path)) {
			console.warn(`[TerraML] Failed to load mod ${manifest.name}: Starting file '${manifest.main}' does not exist`)
			continue;
		}

		try {
			console.debug(`[TerraML] Started loading mod: ${manifest.name} (ver. ${manifest.version})`);
			const code = fs.readFileSync(manifest.path, 'utf8');
			eval(code);
			console.debug(`[TerraML] Loaded Mod: ${manifest.name} (ver. ${manifest.version})`);
			loadedMods += 1;
		} catch (err) {
			console.warn(`[TerraML] Error while starting '${manifest.name}':`, err)
		}
	}
	console.log(`[TerraML] Loaded mods: ${loadedMods}`);
}

//# sourceURL=modloader.js