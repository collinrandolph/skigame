// Plays the v2 world's rules through chapters 1 to 6 without a browser: node tools/test/game-core.test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const SG = require('../../prototypes/game-core.js'), L = JSON.parse(fs.readFileSync(path.join(__dirname, '../../planets/v2-world.json'), 'utf8')), game = L.game, R = L.radius;
const G = SG.create(game, R), far = [0, -1, 0];           // the south pole: nothing is there
const at = (d, ug = -1) => G.update({ n: d, ug }), news = () => G.toasts.splice(0).join(' | ');
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
const model = name => L.models.find(m => m.name === name), V = name => G.modelVariant(name, model(name).id);

// a fresh game: everything shut
ok(!G.gateOpen('East gate') && !G.gateOpen('North gate') && !G.gateOpen('Mine portal'), 'gates start shut');
ok(game.bridges.every(b => !G.bridgeOpen(b.name)), 'bridges start dark or up');
ok(V('East gate') === 0 && V('Terminal 1') === 0 && V('West drawbridge post') === 0 && V('Mine portal') === 0 && V('Crystal gate') === 0, 'models start dormant');
ok(G.modelVariant('Landing pad', 'pad') === null, 'other models are left alone');
ok(G.blockers().length === 1, 'the mine ramp is blocked'); ok(!G.doorOpen(1) && G.doorOpen(0), 'the crown door is locked, the mine door is not');
ok(G.goal().title.includes('Bowl'), 'first goal'); ok(G.checkpoint() === null, 'no checkpoint yet');

function runTerminal(name){
  const t = game.terminals.find(x => x.name === name);
  at(t.d); ok(G.prompt && (G.prompt.key === 'start:' + name || G.prompt.key === 'switch:' + name), name + ' offers to start'); const p = G.prompt; at(t.d); ok(G.prompt === p, 'the offer is stable while you stand there');
  ok(G.confirm(), 'confirm'); ok(V(name) === 1, name + ' shows running'); ok(G.orbs().length === t.orbs.length && G.orbs().every(o => !o.got), 'its orbs are out');
  at(t.d); ok(!G.prompt && /0 of/.test(G.hint), 'no offer while running: a count instead');
  t.orbs.slice(0, -1).forEach(o => at(o)); at(t.d); ok(!G.state().powered[name], name + ' stays off with an orb missing');
  at(t.orbs[t.orbs.length - 1]); ok(G.orbs().every(o => o.got), 'all orbs taken'); ok(/back to/.test(news()), 'told to go back');
  at(t.d); ok(G.state().powered[name] && V(name) === 2 && !G.orbs().length, name + ' powers on return');
  at(t.d); ok(!G.prompt, 'a powered terminal offers nothing');
}
// chapter 1
runTerminal('Terminal 1'); ok(!G.gateOpen('East gate'), 'one terminal is not enough'); at(game.gates[0].d); ok(/1 of 2/.test(G.hint), 'the shut gate says why');
const saved = G.serialize();
runTerminal('Terminal 2'); ok(G.gateOpen('East gate') && G.gateOpen('North gate') && V('East gate') === 1 && V('North gate') === 1, 'zone 1 opens both gates'); ok(/East gate and North gate open/.test(news()), 'and says so');
ok(G.goal().title.includes('home plain'), 'goal moves on'); ok(G.checkpoint() && Math.acos(Math.min(1, G.checkpoint().reduce((s, v, i) => s + v*game.terminals[1].d[i], 0)))*R < 60, 'checkpoint is on the trail by the last terminal');
// switching terminals mid-run
{ const a = game.terminals[2], b = game.terminals[3]; at(a.d); G.confirm(); at(a.orbs[0]); at(b.d); ok(G.prompt && G.prompt.key === 'switch:' + b.name, 'another terminal offers a switch'); G.confirm(); ok(G.state().active === b.name && !G.state().got.length, 'switching resets the run'); at(far); ok(!G.prompt && !G.hint, 'nothing out in the open'); }
// chapter 2
const post = game.bridges[0].post; at(post); ok(!G.prompt && /no power/.test(G.hint), 'the post is dead before zone 2 is live');
for (const t of game.terminals.filter(t => t.zone === 2)) runTerminal(t.name);
ok(!G.bridgeOpen('West drawbridge'), 'the bridge waits for its post'); ok(G.goal().title.includes('drawbridge'), 'goal: lower a bridge');
at(post); ok(G.prompt && G.prompt.key === 'lower:West drawbridge', 'the post answers'); G.confirm(); ok(G.bridgeOpen('West drawbridge') && !G.bridgeOpen('East drawbridge') && V('West drawbridge post') === 1 && V('East drawbridge post') === 0, 'one bridge down, the other still up');
// chapter 3
for (const t of game.terminals.filter(t => t.zone === 3)) runTerminal(t.name);
ok(G.gateOpen('Mine portal') && V('Mine portal') === 1 && !G.blockers().length, 'the mine opens'); ok(G.goal().title.includes('mine'), 'goal: the mine');
// chapter 4: underground. the same spot on the surface does nothing
const U = game.underground; at(U.crystalAltar.d, -1); ok(!G.prompt, 'the altar is not on the surface'); at(U.crystalAltar.d, 1); ok(!G.prompt, 'nor on the deep layer');
at(U.teleporter.d, 0); ok(/teleporter is dead/.test(news()), 'the teleporter hall has its line'); at(U.teleporter.d, 0); ok(news() === '', 'only once');
ok(!G.crystals().length && !G.bridgeOpen('Highland bridge'), 'no crystals or bridge before the altar');
at(U.crystalAltar.d, 0); ok(G.prompt && G.prompt.key === 'altar', 'the altar offers'); G.confirm(); ok(G.bridgeOpen('Highland bridge') && !G.bridgeOpen('Crystal bridge') && G.crystals().length === 20, 'the Highland bridge lights and the crystals show');
// chapter 5 and 6
const cg = game.gates.find(g => g.name === 'Crystal gate'); at(cg.d); ok(!G.prompt && /you have 0/.test(G.hint), 'the gate counts');
game.crystals.slice(0, 19).forEach(c => at(c)); at(cg.d); ok(!G.prompt, '19 is not enough'); at(game.crystals[19]); ok(G.goal().title.includes('Crystal gate'), 'goal: the gate');
at(game.gates.find(g => g.name === 'South pass gate').d); ok(!G.gateOpen('South pass gate'), 'the south pass stays shut before the offering');
at(cg.d); ok(G.prompt && G.prompt.key === 'offer', 'the gate offers'); G.confirm(); ok(G.gateOpen('Crystal gate') && G.bridgeOpen('Crystal bridge') && V('Crystal gate') === 1 && !G.crystals().length, 'offered: gate and bridge open');
at(game.gates.find(g => g.name === 'South pass gate').d); ok(G.gateOpen('South pass gate'), 'the south pass opens when reached');
// saving
const G2 = SG.create(game, R); ok(G2.restore(saved), 'an early save loads'); ok(G2.state().powered['Terminal 1'] && !G2.state().powered['Terminal 2'] && !G2.gateOpen('East gate'), 'and holds what it should');
const G3 = SG.create(game, R); ok(G3.restore(G.serialize()) && G3.gateOpen('South pass gate') && G3.bridgeOpen('West drawbridge') && G3.state().crystals.length === 20, 'a late save round-trips');
ok(!SG.create(game, R).restore('not json') && SG.create(game, R).restore('{"powered":{"Nope":true},"active":"Nope","got":[99],"crystals":["x",5]}'), 'bad saves are refused or cleaned');
{ const g = SG.create(game, R); g.restore('{"powered":{"Nope":true},"active":"Terminal 1","got":[99,2],"crystals":["x",5]}'); ok(!g.state().powered.Nope && g.state().got.join() === '2' && g.state().crystals.join() === '5', 'cleaned to what exists'); }
G.reset(); ok(!G.gateOpen('East gate') && G.goal().title.includes('Bowl'), 'reset starts over');
// every game-controlled model in the layout is one the core knows
for (const m of L.models) if (['kiosk', 'gate', 'mineportal', 'crystalgate', 'post'].includes(m.id)) ok(G.modelVariant(m.name, m.id) !== null, m.name + ' is known to the game');
for (const b of L.bridges) ok(game.bridges.some(x => x.name === b.name), b.name + ' has a rule');
console.log('game core:', checks, 'checks passed');
