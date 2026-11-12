// ============================================================================================================
// Skate Ski v2: the game's rules, apart from drawing and input (window.SkiGame; also loads in Node for tests).
//
// It reads a layout's `game` block (planets/v2-world.json: zones, terminals with their orbs, gates, bridges, crystals,
// the underground's rooms) and keeps the player's progress. The page tells it where the skier is each frame and
// asks it what to show:
//   G.update({ n, ug })      n: the skier's direction from the planet's centre; ug: the cave layer they're in, or -1
//   G.prompt / G.confirm()   something to agree to here ("Start Terminal 3"), and agreeing to it
//   G.hint                   why something here won't open yet
//   G.toasts                 news to show once (the page empties it)
//   G.rev                    goes up whenever progress changes: the page redraws what depends on it, and saves
//   G.modelVariant(name, id) how a placed model should look now (a terminal running, a gate open)
//   G.bridgeOpen(name), G.gateOpen(name), G.doorOpen(layer), G.orbs(), G.crystals(), G.blockers(), G.goal()
// Every place is a unit vector; distances are over the ground (or the cave layer's shell when underground).
//
// The chapters so far: 1 power the Bowl's terminals (the gates open), 2 the home plain's (the drawbridges answer at
// their posts), 3 the far plain's (the mine portal opens), 4 wake the altar in the mine (the Highland bridge lights),
// 5 find the crystals in the highlands, 6 offer them at the Crystal gate (the Crystal bridge lights). 7 to 9 (the
// south plain, the crown door, the Starway) are still to come: `crowned` is here so the crown door has its lock.
// ============================================================================================================
(function(root){
'use strict';
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
const SG = { VERSION: 1 };
// how close counts (metres)
SG.REACH = { terminal: 8, orb: 3.5, post: 9, crystal: 3.5, gate: 14, altar: 12, room: 16, southGate: 30, closed: 16 };

SG.create = function(game, R){
  const G = { game, R, rev: 0, toasts: [], prompt: null, hint: null }, REACH = SG.REACH;
  const T = game.terminals || [], term = Object.fromEntries(T.map(t => [t.name, t]));
  const gates = Object.fromEntries((game.gates || []).map(g => [g.name, g])), bridges = Object.fromEntries((game.bridges || []).map(b => [b.name, b]));
  const UGD = game.underground || null, crystals = game.crystals || [];
  const fresh = () => ({ v: SG.VERSION, powered: {}, active: null, got: [], lowered: {}, altar: false, crystals: [], offered: false, southGate: false, crowned: false, seen: {}, checkpoint: null });
  let st = fresh();
  const bump = () => { G.rev++; };
  // news: once only when it has a key
  const toast = (text, key) => { if (key){ if (st.seen[key]) return; st.seen[key] = 1; bump(); } G.toasts.push(text); };
  const zoneTerms = z => T.filter(t => t.zone === z);
  G.zoneCount = z => { const l = zoneTerms(z); return [l.filter(t => st.powered[t.name]).length, l.length]; };
  G.zoneDone = z => { const [a, b] = G.zoneCount(z); return b > 0 && a === b; };
  const met = w => !w ? true : w.zone !== undefined ? G.zoneDone(w.zone) : w.flag ? !!st[w.flag] : true;
  G.gateOpen = name => { const g = gates[name]; return g ? met(g.when) : true; };
  // a drawbridge also has to be lowered at its post
  G.bridgeOpen = name => { const b = bridges[name]; return !b ? true : b.kind === 'draw' ? !!st.lowered[name] : met(b.when); };
  // the cave doors: the crown door (the deep) stays shut until you're crowned
  G.doorOpen = layer => !(UGD && UGD.crownDoor && UGD.crownDoor.layer === layer) || st.crowned;
  // how a placed model looks now, or null if it isn't the game's to change (kiosk: dormant, running, powered; the rest: shut, open)
  G.modelVariant = (name, id) => {
    if (id === 'kiosk' && term[name]) return st.powered[name] ? 2 : st.active === name ? 1 : 0;
    if ((id === 'gate' || id === 'mineportal' || id === 'crystalgate') && gates[name]) return G.gateOpen(name) ? 1 : 0;
    if (id === 'post' && name.endsWith(' post') && bridges[name.slice(0, -5)]) return G.bridgeOpen(name.slice(0, -5)) ? 1 : 0;
    return null;
  };
  G.orbs = () => st.active ? term[st.active].orbs.map((d, i) => ({ d, got: st.got.includes(i) })) : [];
  G.crystals = () => st.altar && !st.offered ? crystals.map((d, i) => ({ d, got: st.crystals.includes(i) })) : [];
  // ground the skier can't cross yet, beyond what the shut gates' own shapes block: the mine's ramp while its portal is shut
  G.blockers = () => UGD && UGD.rampStart && !G.gateOpen('Mine portal') ? [{ d: UGD.rampStart, r: 6 }] : [];
  // where to come back to: on the trail by the last terminal powered (its nearest orb), or null for the start
  G.checkpoint = () => { const t = term[st.checkpoint]; if (!t) return null; let best = t.d, bd = Infinity; for (const o of t.orbs){ const a = ang(o, t.d); if (a < bd){ bd = a; best = o; } } return best; };
  G.state = () => st;

  function start(t){ st.active = t.name; st.got = []; delete st.seen['full:' + t.name]; bump(); G.toasts.push(`${t.name} is running: ${t.orbs.length} orbs on its loop`); }
  function power(t){
    st.powered[t.name] = true; st.active = null; st.got = []; st.checkpoint = t.name; bump();
    const [a, b] = G.zoneCount(t.zone); G.toasts.push(`${t.name} powered: ${a} of ${b} in zone ${t.zone}`);
    if (a < b) return;
    const opened = (game.gates || []).filter(g => g.when && g.when.zone === t.zone).map(g => g.name), posts = (game.bridges || []).filter(b2 => b2.kind === 'draw' && b2.when && b2.when.zone === t.zone);
    G.toasts.push(`Zone ${t.zone} is live.` + (opened.length ? ` ${opened.join(' and ')} ${opened.length > 1 ? 'open' : 'opens'}.` : '') + (posts.length ? ' The drawbridge posts will answer now.' : ''));
  }

  G.update = function(ctx){
    const n = ctx.n, ug = ctx.ug === undefined || ctx.ug === null ? -1 : ctx.ug;
    const Rk = ug >= 0 && UGD && UGD.layers[ug] ? R - UGD.layers[ug].depth : R, near = (d, m) => !!d && ang(n, d)*Rk < m;
    let prompt = null, hint = null;
    if (ug < 0){
      if (st.active){ const t = term[st.active];
        t.orbs.forEach((d, i) => { if (!st.got.includes(i) && near(d, REACH.orb)){ st.got.push(i); bump(); } });
        if (st.got.length >= t.orbs.length) toast(`All ${t.orbs.length} orbs: back to ${t.name}`, 'full:' + t.name); }
      for (const t of T){
        if (!near(t.d, REACH.terminal)) continue;
        if (st.powered[t.name]) hint = `${t.name}: powered`;
        else if (st.active === t.name){ if (st.got.length >= t.orbs.length) power(t); else hint = `${t.name}: ${st.got.length} of ${t.orbs.length} orbs`; }
        else if (!st.active) prompt = { key: 'start:' + t.name, text: `Start ${t.name}`, detail: `Collect its ${t.orbs.length} orbs and come back`, act: () => start(t) };
        else prompt = { key: 'switch:' + t.name, text: `Start ${t.name} instead`, detail: `${st.active} will reset`, act: () => start(t) };
        break;
      }
      for (const b of game.bridges || []){
        if (b.kind !== 'draw' || !b.post || st.lowered[b.name] || !near(b.post, REACH.post)) continue;
        if (met(b.when)) prompt = { key: 'lower:' + b.name, text: `Lower the ${b.name}`, detail: '', act: () => { st.lowered[b.name] = true; bump(); G.toasts.push(`The ${b.name} is down`); } };
        else { const [a, c] = G.zoneCount(b.when.zone); hint = `${b.name}: no power. Zone ${b.when.zone} has ${a} of ${c} terminals live`; }
      }
      for (const b of game.bridges || []) if (b.kind !== 'draw' && !G.bridgeOpen(b.name) && b.foot && near(b.foot, REACH.closed)) hint = `${b.name}: dark`;
      if (st.altar && !st.offered) crystals.forEach((d, i) => { if (!st.crystals.includes(i) && near(d, REACH.crystal)){ st.crystals.push(i); bump(); G.toasts.push(`Crystal ${st.crystals.length} of ${crystals.length}`); } });
      const cg = gates['Crystal gate'];
      if (cg && !st.offered && near(cg.d, REACH.gate)){
        if (st.altar && st.crystals.length >= crystals.length) prompt = { key: 'offer', text: 'Offer the crystals', detail: 'The gate is waiting', act: () => { st.offered = true; bump(); G.toasts.push('The Crystal gate opens, and the Crystal bridge lights beyond it'); } };
        else hint = st.altar ? `The Crystal gate wants all ${crystals.length} crystals: you have ${st.crystals.length}` : 'The Crystal gate: sealed';
      }
      const sg = gates['South pass gate'];
      if (sg && st.offered && !st.southGate && near(sg.d, REACH.southGate)){ st.southGate = true; bump(); G.toasts.push('The South pass gate opens: a short way back to the far plain'); }
      for (const g of game.gates || []) if (g !== cg && g.d && !G.gateOpen(g.name) && near(g.d, REACH.closed)){
        if (g.when && g.when.zone !== undefined){ const [a, c] = G.zoneCount(g.when.zone); hint = `${g.name}: locked. Zone ${g.when.zone} has ${a} of ${c} terminals live`; } else hint = `${g.name}: locked`; }
    } else if (UGD){
      const al = UGD.crystalAltar, tp = UGD.teleporter;
      if (al && ug === al.layer && near(al.d, REACH.altar)){
        if (!st.altar) prompt = { key: 'altar', text: 'Wake the altar', detail: 'Something old is sleeping here', act: () => { st.altar = true; bump(); G.toasts.push('The altar wakes. Far above, in the Bowl, a bridge of light reaches for the highlands'); } };
        else hint = 'The altar: awake';
      }
      if (tp && ug === tp.layer && near(tp.d, REACH.room)) toast('The teleporter is dead. The old workings run on past it', 'teleporter');
    }
    if (!(prompt && G.prompt && prompt.key === G.prompt.key)) G.prompt = prompt;     // (the same offer stays the same object)
    G.hint = prompt ? null : hint;
  };
  G.confirm = () => { const p = G.prompt; if (!p) return false; G.prompt = null; p.act(); return true; };

  // what to do next: a headline and a line of progress
  G.goal = function(){
    const run = st.active ? (st.got.length >= term[st.active].orbs.length ? `Back to ${st.active}` : `${st.active}: ${st.got.length} of ${term[st.active].orbs.length} orbs`) : null;
    const zoneLine = z => { const [a, b] = G.zoneCount(z); return run || `${a} of ${b} terminals live`; };
    if (!G.zoneDone(1)) return { title: 'Restore power in the Bowl', detail: zoneLine(1) };
    if (!G.zoneDone(2)) return { title: 'Restore power on the home plain', detail: zoneLine(2) };
    if (!Object.keys(st.lowered).length) return { title: 'Lower a drawbridge over the river', detail: 'Ski up to the control post on the home bank' };
    if (!G.zoneDone(3)) return { title: 'Restore power on the far plain', detail: zoneLine(3) };
    if (!st.altar) return { title: 'Go down the mine', detail: 'The portal at the deep pit is open' };
    if (st.crystals.length < crystals.length) return { title: 'Find the crystals in the highlands', detail: `${st.crystals.length} of ${crystals.length} · the Highland bridge starts in the Bowl` };
    if (!st.offered) return { title: 'Take the crystals to the Crystal gate', detail: 'At the far end of the highlands' };
    return { title: 'Cross the Crystal bridge to the south plain', detail: 'The rest of the story is still being built' };
  };

  // saving: plain JSON. restore takes what it can from an older or damaged save rather than failing
  G.serialize = () => JSON.stringify(st);
  G.restore = function(json){
    let o = null; try { o = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) {}
    if (!o || typeof o !== 'object') return false;
    const f = fresh();
    for (const t of T) if (o.powered && o.powered[t.name]) f.powered[t.name] = true;
    if (term[o.active]){ f.active = o.active; f.got = (o.got || []).filter(i => Number.isInteger(i) && i >= 0 && i < term[o.active].orbs.length); }
    for (const k in o.lowered || {}) if (bridges[k] && o.lowered[k]) f.lowered[k] = true;
    f.crystals = (o.crystals || []).filter(i => Number.isInteger(i) && i >= 0 && i < crystals.length);
    for (const k of ['altar', 'offered', 'southGate', 'crowned']) f[k] = !!o[k];
    if (o.seen && typeof o.seen === 'object') for (const k in o.seen) f.seen[k] = 1;
    if (term[o.checkpoint]) f.checkpoint = o.checkpoint;
    st = f; G.prompt = null; G.hint = null; bump(); return true;
  };
  G.reset = () => { st = fresh(); G.prompt = null; G.hint = null; G.toasts.length = 0; bump(); };
  // for testing and for skipping ahead while the game is being built
  G.cheat = function(what){
    if (what === 'zone1' || what === 'zone2' || what === 'zone3'){ const z = +what.slice(4); for (const t of zoneTerms(z)){ st.powered[t.name] = true; st.checkpoint = t.name; } st.active = null; st.got = []; }
    else if (what === 'bridges'){ for (const b of game.bridges || []) if (b.kind === 'draw') st.lowered[b.name] = true; }
    else if (what === 'altar') st.altar = true;
    else if (what === 'crystals') st.crystals = crystals.map((_, i) => i);
    else if (what === 'offered') st.offered = true;
    else if (what === 'crowned') st.crowned = true;
    else return false;
    bump(); return true;
  };
  return G;
};
root.SkiGame = SG;
if (typeof module !== 'undefined' && module.exports) module.exports = SG;
})(typeof window !== 'undefined' ? window : globalThis);
