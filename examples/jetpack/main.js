// Ported from Jetpack mod on Selene modloader
// Thanks to 2767mr for the original code and idea

// Imports are made with `terraML.get` or `terraML.global`
// `terraML.get` - you need to specify a game file to look for imports in. More stable and recommended method
// `terraML.global` - already have all imports at rool level. Some imports might override each other

const { Observable } = terraML.get.observer;
const { g_addons } = terraML.get.addons;

// We need to create a new addon for the game and insert it into convenient `AddonManager`
class Jetpack extends Observable {
	onDeferredUpdate() {
  		if (terraML.global.g_input.bindings.actions.get("dash").isActive()) {
      		terraML.global.g_player.entity.actor.doJump(10, 10, 10);
    	}
	}
}

var jetpack = new Jetpack();

// This addon adding will be simplified in future versions
var addon = { addon: jetpack, orders: {} };
g_addons.add(addon);
g_addons.onDeferredUpdate.push(jetpack);

//# sourceURL=mods/jetpack/main.js
