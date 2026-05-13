// When '=' is pressed, spawn a delayed clone. Press it while in game.
// There are bugs. Character despawn if you leave the map and produce a lot of errors. This is just a test script

// Imports are made with `terra_require`
// You can specify name of the `sourceMappingURL` file and it will find it
// I will compile a list of modules an simplify imports later, but this will have to do
const actor = terra_require('terra-actor-entity');
const player = terra_require('player-model');
const game_state = terra_require('game-state');
const char_sheet = terra_require('char-sheet');
const figure = terra_require('figure-state');
const entity_collision = terra_require('entity-collision');

console.log("Test mod loaded!");

var repeat_chars = [];

// Get the current values of a player and apply them to the copy one second later
function update_simulated_character(character, interval) {
	// Update position and velocity
	let position = player.g_player.entity.core.pos.clone();
	let velocity = player.g_player.entity.move.vel.clone();

	// Copy current animation state
	let animation = player.g_player.entity.view.figState.anim;
	let anim_time = player.g_player.entity.view.figState.time;

	// Copy the look direcition
	let face_dir = player.g_player.entity.actor.face.clone();

	// Clone weapons of Juno to the clone
	let figures = [];
	for (const added of player.g_player.entity.view.figState.addedFig) {
		var add_figure = new figure.FigureAddState();
		add_figure.figure = added.figure;
		add_figure.parent = new figure.FigureState(player.g_player.entity, added.figure, null);
		figures.push(add_figure);
	}

	// This is NOT how you should do this kind of stuff
	// Simple enough to work for my testing though
	setTimeout(() => {
		// Apply all the saved variables after the timeout
		character.core.setPos(position);
		character.move.vel = velocity;
		character.move.physics.skip = false;
		character.view.figState.anim = animation;
		character.view.figState.time = anim_time;
		character.actor.face = face_dir;
		character.view.figState.addedFig = figures;
	}, interval);
}

// When '=' is pressed, spawn a delayed clone
window.addEventListener('keydown', (event) => {
	if (event.key === '=') {
		event.preventDefault();

		// Get Juno character from the character sheet
		var char = char_sheet.Character.get("CHA:main#Juno");

		// We are creating new Actor (NPC)
		var new_actor = new actor.TerraActor();

		// Copy position of our player
		new_actor.core.setPos(player.g_player.entity.core.pos);

		// Set sprite of this actor as Juno
		new_actor.setNpc(char, false);

		// Copy current animation state
		new_actor.view.figState.anim = player.g_player.entity.view.figState.anim;
		new_actor.view.figState.time = player.g_player.entity.view.figState.time;

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
		game_state.g_gState.addEntity(new_actor, false, false);

		repeat_chars.push(new_actor);
		let interval =  500 * (repeat_chars.length + 1); // Interval repeats for each created actor
		setInterval(() => { update_simulated_character(new_actor, interval); }, 1000 / 20); // Update 20 times per second
  	}

});

//# sourceURL=mods/test-mod/main.js
