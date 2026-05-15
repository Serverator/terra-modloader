// Ported Jetpack mod on Selene modloader
// Thanks to 2767mr for the original code and idea

// Imports are made with `terra.file` or `terra.export`
// `terra.file` - you need to specify a game file to look for imports in. More stable and recommended method
// `terra.export` - already have all imports at rool level. Some imports might override each other

const { Observable } = terra.file.observer;
const { g_addons } = terra.file.addons;

// We need to create a new addon for the game and insert it into convenient `AddonManager`
class Jetpack extends Observable {
	onDeferredUpdate() {
		if (terra.export.g_input.bindings.actions.get("dash").isActive()) {
			if (terra.export.g_player.entity)
      			terra.export.g_player.entity.actor.doJump(10, 10, 10);
    	}
	}
}

terra.addAddon(new Jetpack());

//# sourceURL=mods/jetpack/main.js
