// Solo game: the platform still requires a rules module at the archive root.
// All simulation lives in the client, so this is the documented single-player stub —
// pure functions, no imports, no timers.

export const meta = { game: "ashes-of-the-sun-gate", minPlayers: 1, maxPlayers: 1 };
export function setup() { return {}; }
export function validateAction() { return { ok: true }; }
export function applyAction(state) { return state; }
export function isGameOver() { return { over: false }; }
export function viewFor(state) { return state; }
