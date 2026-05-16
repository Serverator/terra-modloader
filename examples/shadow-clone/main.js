// Spawns a delayed clone of a player that will repeat the actions of the past
// Does not interact with the world in any way, does not have any effects or collision checks (yet)

const actor = terra.file.terraActorEntity;
const player = terra.file.playerModel;
const char_sheet = terra.file.charSheet;
const figure = terra.file.figureState;

let cloned_actor = null;
let saved_states = [];

function create_juno_clone() {
	// Get Juno character from the character sheet
	var char = char_sheet.Character.get("CHA:main#Juno");

	// We are creating new Actor (NPC)
	var new_actor = new actor.TerraActor();

	// Copy position of our player
	new_actor.core.setPos(player.g_player.entity.core.pos);

	// Set sprite of this actor as Juno
	new_actor.setNpc(char, false);

	// Copy current animation state
	if (player.g_player.entity.view.figState.anim) {
		new_actor.view.figState.anim = player.g_player.entity.view.figState.anim;
		new_actor.view.figState.time = player.g_player.entity.view.figState.time;
	} else {
		new_actor.view.figState.setAnim("idle", null);
	}

	// Disable friction -- movement looks smoother
	new_actor.move.friction.air = 0;
	new_actor.move.friction.ground = 0;

	// Face is the direction character is looking
	new_actor.actor.face = player.g_player.entity.actor.face.clone();
	new_actor.view.figState.faceAngles = player.g_player.entity.view.figState.faceAngles;

	// Clone weapons of Juno to the clone
	// Maybe incorrect, but it works, ey?
	new_actor.view.figState.addedFig = [];
	for (const added of player.g_player.entity.view.figState.addedFig) {
		var add_figure = new figure.FigureAddState();
		add_figure.figure = added.figure;
		add_figure.parent = new figure.FigureState(added.parent.view, added.figure, null);
		new_actor.view.figState.addedFig.push(add_figure);
	}

	// Inserts that entity in the world
	terra.export.g_gState.addEntity(new_actor, true, false);

	return new_actor;
}

class ShadowClone extends terra.export.Observable {
	onPreUpdate() {
		if (!terra.export.g_player.entity || player.g_player.entity.core.pos.v.every(v => v === 0)) {
			return;
		}

		let state = {}
		// Update position and velocity
		state.position = player.g_player.entity.core.pos.clone();
		state.velocity = player.g_player.entity.move.vel.clone();

		// Copy current animation state
		state.animation = player.g_player.entity.view.figState.anim;
		state.anim_time = player.g_player.entity.view.figState.time;

		// Copy the look direcition
		state.face_dir = player.g_player.entity.actor.face.clone();

		// Clone weapons of Juno to the clone
		state.figures = [];
		for (const added of player.g_player.entity.view.figState.addedFig) {
			var add_figure = new figure.FigureAddState();
			add_figure.figure = added.figure;
			add_figure.parent = new figure.FigureState(player.g_player.entity, added.figure, null);
			state.figures.push(add_figure);
		}

		saved_states.push(state);

		if (saved_states.length > 120 && cloned_actor) {
			let saved_state = saved_states.shift();

			cloned_actor.core.setPos(saved_state.position);
			cloned_actor.move.vel = saved_state.velocity;
			cloned_actor.view.figState.anim = saved_state.animation;
			cloned_actor.view.figState.time = saved_state.anim_time;
			cloned_actor.actor.face = saved_state.face_dir;
			cloned_actor.view.figState.addedFig = saved_state.figures;
		}
	}

	// When entering new map clean up the reference
	onGameMapLoad() {
		cloned_actor = null;
		saved_states = [];
	}

	// Create second actor on map start
	onGameMapStart() {
		cloned_actor = create_juno_clone();
	}
}

terra.addAddon(new ShadowClone(), { onGameMapStart: 35000 });

//# sourceURL=mods/shadow-clone/main.js
