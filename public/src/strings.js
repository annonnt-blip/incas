// All player-visible text lives here. Adding a language is a data change, never a code change.
// Every key used by game.js is looked up through T(key) — there are zero UI literals in game code.

export const LANGS = { en: "English" };

const en = {
  // --- shell / menu ---
  "title": "ASHES OF THE SUN GATE",
  "subtitle": "Something older than the empire is buried under this temple. It is still warm.",
  "menu.start": "Descend",
  "menu.continue": "Continue",
  "menu.controls": "Controls",
  "menu.options": "Options",
  "menu.back": "Back",
  "menu.loading": "Lighting the lamp…",
  "menu.loadingAssets": "Reading the stones…",

  // --- controls card ---
  "ctrl.title": "Controls",
  "ctrl.move": "Move",
  "ctrl.moveKeys": "W A S D  /  Arrow keys  /  drag the left side",
  "ctrl.look": "Look",
  "ctrl.lookKeys": "Mouse  /  drag the right side",
  "ctrl.sprint": "Hurry",
  "ctrl.sprintKeys": "Shift  /  L3",
  "ctrl.interact": "Inspect",
  "ctrl.interactKeys": "E  /  A button  /  the on-screen button",
  "ctrl.attune": "Attune the lamp",
  "ctrl.attuneKeys": "1 2 3  /  LB RB  /  the glyph chips",
  "ctrl.codex": "Codex",
  "ctrl.codexKeys": "Tab  /  Y button",
  "ctrl.pause": "Pause",
  "ctrl.pauseKeys": "Esc  /  Start",
  "ctrl.hint": "Everything in this ruin is opened by light, not by force.",

  // --- options ---
  "opt.title": "Options",
  "opt.sensitivity": "Look sensitivity",
  "opt.invertY": "Invert vertical look",
  "opt.textScale": "Text size",
  "opt.shake": "Camera shake",
  "opt.flash": "Bright flashes",
  "opt.grain": "Film grain",
  "opt.quality": "Render detail",
  "opt.music": "Music volume",
  "opt.sfx": "Effects volume",
  "opt.on": "On",
  "opt.off": "Off",
  "opt.qualityLow": "Low",
  "opt.qualityMed": "Medium",
  "opt.qualityHigh": "High",
  "opt.language": "Language",

  // --- pause ---
  "pause.title": "Paused",
  "pause.resume": "Resume",
  "pause.restart": "Start over",
  "pause.quit": "Leave the ruin",
  "pause.confirmRestart": "Start over? Everything you have found will be forgotten.",
  "pause.yes": "Yes",
  "pause.no": "No",

  // --- HUD ---
  "hud.lamp": "Lamp",
  "hud.objective": "Now",
  "hud.codexHint": "Tab — codex",
  "hud.focus": "Click the game to use the keyboard",
  "hud.drag": "Drag the left side to walk · the right side to look · W A S D works too",
  "hud.buttons": "Hold the arrows to walk · drag anywhere to look · W A S D works too",
  "hud.newEntry": "Codex updated",
  "hud.glyphLearned": "New light learned",

  // --- glyphs ---
  "glyph.none": "Bare flame",
  "glyph.none.desc": "An ordinary fire. It shows you the floor and nothing else.",
  "glyph.inti": "INTI",
  "glyph.inti.desc": "The sun-light. Gold. It wakes anything the Inca built to be woken.",
  "glyph.quilla": "QUILLA",
  "glyph.quilla.desc": "The moon-light. Pale. It shows what was written to stay hidden.",
  "glyph.chaska": "CHASKA",
  "glyph.chaska.desc": "The star-light. Cold and not from here. The deep stone answers only to this.",

  // --- prompts ---
  "prompt.inspect": "Inspect",
  "prompt.read": "Read",
  "prompt.take": "Take",
  "prompt.light": "Light the brazier",
  "prompt.rest": "Draw fire",
  "prompt.attuneGate": "Press your light to the seal",
  "prompt.gateOpen": "The way is open",
  "prompt.touchNode": "Touch the node",
  "prompt.core": "Reach into the engine",

  // --- refusals: every refusal says why, and how to lift it ---
  "deny.gate": "The seal drinks your light and gives nothing back. It was cut for a different colour.",
  "deny.gate.hint": "This seal answers to %s. Attune your lamp and press it again.",
  "deny.mural": "The wall is bare stone. Whatever was written here was not written for firelight.",
  "deny.mural.hint": "%s light would show it.",
  "deny.node": "The node is dead under this light.",
  "deny.node.hint": "It is not stone. It answers to %s.",
  "deny.noCharge": "Your lamp is out. You cannot attune a flame that is not burning.",
  "deny.dark": "You cannot read in the dark.",

  // --- feedback lines ---
  "fb.brazierLit": "The old fire takes. Warmth crawls back up your arm.",
  "fb.brazierDrawn": "You draw fire into the lamp.",
  "fb.brazierEmpty": "The bowl is cold ash now. It has nothing left to give.",
  "fb.gateOpened": "The stone remembers, and moves.",
  "fb.attuned": "The flame changes colour. The room changes with it.",
  "fb.attuneNoGlyph": "You have not learned that light yet.",
  "fb.relicTaken": "Taken. The codex remembers it for you.",
  "fb.nothing": "Nothing here answers you.",

  // --- objectives ---
  "obj.1": "Get off the rope and find a light.",
  "obj.2": "The gallery collapsed. Find another way through the rubble.",
  "obj.3": "A sealed door, cut with a sun. Learn its light.",
  "obj.4": "Open the Sun Gate.",
  "obj.5": "Cross the Hall of the Sun and find what the priests were hiding.",
  "obj.6": "The moon seal waits above the shrine. Press your new light to it.",
  "obj.7": "Reach the observatory. The star-shaft is above it.",
  "obj.8": "Find the star-light. Something under the floor is already using it.",
  "obj.9": "Open the last seal.",
  "obj.10": "Reach the engine.",
  "obj.done": "Leave. Or don't.",

  // --- watcher ---
  "watch.near": "Something is moving where your light is not.",
  "watch.caught": "Cold hands. Then the smell of smoke, and a fire you did not light.",
  "watch.wake": "You wake beside a brazier. Your lamp is burning. Nothing has been taken.",
  "watch.warn": "Your lamp is dying.",

  // --- codex ---
  "codex.title": "Codex",
  "codex.tabLights": "Lights",
  "codex.tabFinds": "Finds",
  "codex.tabWalls": "Walls",
  "codex.empty": "Nothing yet.",
  "codex.close": "Close",
  "codex.found": "%d of %d found",

  // --- relics ---
  "relic.rope.name": "Frayed climbing rope",
  "relic.rope.text": "Not yours. Hemp, hand-laid, and old — but the cut end is clean and modern. Someone came down here with good gear and left without their rope.",
  "relic.tumi.name": "Tumi blade, ceremonial",
  "relic.tumi.text": "A gold crescent knife. The edge was never sharpened. Whatever this was for, it was not cutting — the handle is worn smooth in the shape of a hand holding it up, toward something.",
  "relic.quipu.name": "Burnt quipu",
  "relic.quipu.text": "A knotted record, half charred. The surviving cords are not counting llamas or grain. They count days between two events, over and over, for four hundred years. Someone was keeping watch.",
  "relic.mask.name": "Keeper's mask",
  "relic.mask.text": "Hammered gold, eyes cut as narrow slits — not to be seen through, but to see less. The inside of the mask is scored with fingernail marks.",
  "relic.lens.name": "Obsidian disc",
  "relic.lens.text": "Ground perfectly flat and polished on both faces. There is no tool in this valley that could have made it. Held up to the lamp, it does not darken the flame. It sorts it.",
  "relic.journal.name": "Surveyor's notebook, 1911",
  "relic.journal.text": "Water-ruined. One page legible: \"The lower chambers are not masonry. The masonry stops. I have told the porters we are turning back and I have told them why, and they did not need telling.\"",
  "relic.shard.name": "Alloy shard",
  "relic.shard.text": "Light as balsa, cold as river stone, and it will not warm in your hand no matter how long you hold it. The broken edge has no grain. It did not break — it was ended.",
  "relic.seed.name": "Seed of the third light",
  "relic.seed.text": "A bead of something like glass with a spark held motionless inside it. The spark has not moved in five hundred years. It is moving now, since you picked it up.",

  // --- murals (each needs a specific attunement to read) ---
  "mural.1.name": "The first wall",
  "mural.1.text": "WE DID NOT BUILD THE DEEP HOUSE. WE FOUND IT OPEN AND WE CLOSED IT. THE STONE ABOVE IS OURS. THE STONE BELOW IS A LID.",
  "mural.2.name": "The accounting",
  "mural.2.text": "IN THE YEAR THE RIVER TURNED, THE LIGHT UNDER THE FLOOR WOKE FOR ONE NIGHT. IT WAS A GOOD LIGHT. IT MADE THE MAIZE STAND UP IN THE DARK. IN THE MORNING THE VALLEY OF QOLLQA WAS ASH AND EVERY BIRD IN IT WAS ASH.",
  "mural.3.name": "The rule of the keepers",
  "mural.3.text": "SO: NO SUN-LIGHT BELOW THE SECOND GATE. NO MOON-LIGHT SPOKEN ALOUD. THE THIRD LIGHT IS NOT A LIGHT AND MUST NOT BE CARRIED. WE ARE NOT PRIESTS. WE ARE THE LID.",
  "mural.4.name": "The last watch",
  "mural.4.text": "THE STRANGERS ARE IN CAJAMARCA. THEY WILL COME FOR THE GOLD AND THEY WILL FIND THE GOLD AND STOP. LEAVE THE GOLD WHERE THEY WILL TRIP OVER IT. SEAL THE REST. LET THEM THINK WE WORSHIPPED THE SKY.",
  "mural.5.name": "The engine wall",
  "mural.5.text": "IT IS NOT SLEEPING. IT IS WAITING TO BE ASKED PROPERLY. WE NEVER LEARNED THE ASKING. WE ONLY LEARNED THE REFUSING. IF YOU HAVE COME THIS FAR CARRYING THE THIRD LIGHT, THEN YOU ARE NOT ONE OF US, AND THE CHOICE IS YOURS AND NOT OURS.",

  // --- glyph stones ---
  "stone.inti": "A stele, chest-high, cut with a stepped cross. When your flame touches it the carving fills with gold and the gold climbs down into your lamp.",
  "stone.quilla": "Cold pale light bleeds out of the crescent and settles over your flame like frost. The room does not get brighter. It gets more honest.",
  "stone.chaska": "This one is not carved. The pattern is under the surface of the stone, the way a bone is under skin. Your lamp takes the colour before you decide to let it.",

  // --- alien nodes ---
  "node.first": "Under the flagstones, something the length of a bridge shifts its weight.",
  "node.hum": "The hum climbs a note. It is answering you, and it is not in a hurry.",
  "node.core": "The engine has no controls. It has an opening the exact size of a hand, worn smooth, and it has been waiting an extremely long time for one.",

  // --- ending ---
  "end.choose": "The opening is warm.",
  "end.seal": "Close it",
  "end.wake": "Ask it",
  "end.sealTitle": "THE LID HOLDS",
  "end.sealText": "You push the seed back into the socket and the light goes out of the room, out of the corridor, out of the whole buried house behind you, one chamber at a time, like someone walking away turning off lamps.\n\nYou climb out at dawn. The temple above is just a temple. The guidebooks are right about it, and they will go on being right, and that is the last favour the Keepers ever did anyone.\n\nYou kept their rule. You never found out what it was for.",
  "end.wakeTitle": "IT WAS ASKED PROPERLY",
  "end.wakeText": "You put your hand in the opening.\n\nThe engine does not roar. It brightens — politely, the way a person straightens when spoken to — and the cold cyan runs up out of the floor and through four hundred metres of Inca masonry and out of the temple mouth into the night sky, and every carved stone in the valley lights up from the inside at once, because every one of them is part of it, because the temple was never a temple.\n\nIt is still brightening. Somewhere very far away, something notices.",
  "end.stats": "Relics recovered: %d of %d   ·   Walls read: %d of %d   ·   Time below: %s",
  "end.again": "Descend again",
  "end.credit": "Made with Higgsfield.",
};

const DICT = { en };

export let lang = "en";
export function setLang(l) { if (DICT[l]) lang = l; }
export function T(key, ...args) {
  const s = (DICT[lang] && DICT[lang][key]) ?? (DICT.en[key] ?? key);
  let i = 0;
  return s.replace(/%[sd]/g, () => args[i++] ?? "");
}
