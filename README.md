# TerraModloader

TerraModloader (or just TerraML) is a modloader for Alabaster Dawn. It's as simple and non-destructive as possible, but still allows full control over the game code. 

⚠️ **Currently Work in Progress!** Expect things to change, break and not work all together. I plan to keep this modloader as simple as possible, but I will add features to ease creating mods.

#### Current supported version of the game: **0.1.0-7**

It should technically work even for never versions of the game, but don't be surprised if it doesn't

## Installation

1. Put file modloader.js in root directory of the game.
2. Add a line `"inject_js_start": "modloader.js",` to the `package.json`
```json
{
 "name": "Alabaster Dawn",
 "version": "0.0.0.0.0.1",
 "main": "terra/index.html",
 "inject_js_start": "modloader.js", // <-- add here
 "chromium-args": "...",
 // rest of the file
}
```
3. Create a `mods` folder in the root directory of the game and put all your mods in it
4. Thats it, now you can enjoy your modded experience!

## Mod creation

To create your brand new mod you'll need to create a starting file `main.js` and a manifest file `mod.json`

`mod.json` might look like this:
```json
{
	"version": "0.0.1",
	"name": "Test Mod",
	"description": "This is an example mod for TerraML",
	"author": "Sam Leeway",
	"main": "main.js",
	"priority": 10
}
```

A very basic mod example is available [here](examples/test-mod)!

### Enabling debug console
To debug your mod you will need to enable chrome DevTools. To do that, you need to install SDK build of NW.js. You can check current version of NW.js in the title screen of the game. 

At the time of writing it's `0.86.0` and is available [here](https://dl.nwjs.io/v0.86.0/). Download the correct version for your system, if you use Windows its most definately [`nwjs-sdk-v0.86.0-win-x64.zip`](https://dl.nwjs.io/v0.86.0/nwjs-sdk-v0.86.0-win-x64.zip). 

Unpack it into a root directory of the game. Now you can press F12 to open DevTools console!

### Source code

Right now it's early days of Alabaster Dawn modding and developing a mod requires looking at a massive WebPack `bundle.js` file provided by the game. 

A way to unpack the code back into different readable files is still in development at [webpack-debundler](https://github.com/Serverator/webpack-debundler) repo. It's very rough and undocumented, but works in a pinch.

> If anyone knows a way to connect source maps to unpacked files, hit me up! I will be really greatful!

### Other notes 

Right now mods activate only after full game initialization. 

Mods activate in order of set priority, from lowest to highest (with default of 0). This will probably be replaced with proper dependency system in the future.

## Why?

I loved CrossCode, it's one of my favorite games. Now that Alabaster Dawn is coming out, I decided that I have enough skills to add mutliplayer to the game to play with my friends. And my friends love simplicity, so I tried to make mod installation as painless as possible.

Multiplayer mod is still is on the way. Right now I'm only planning on player character sync, and maybe (a really big maybe) enemy sync as well.
