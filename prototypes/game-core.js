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
// 5 find the crystals in the highlands, 6 offer them at the Crystal gate (the Crystal bridge lights), 7 on the south
// plain a calf from the herds follows you; bring it to the giant asleep on the Broken Circle and the giant gets up; each
// calf you bring to the court there takes a diamond and is crowned, and at the third the court dresses you in its
// purple, 8 which the crown door in the mine knows: 30 crown crystals in the crown room, 9 offered at the Broken
// Circle's altar they light the Starway; at its top, the observatory, the story ends.
// ============================================================================================================
(function(root){
'use strict';
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
const SG = { VERSION: 1 };
// how close counts (metres)
SG.REACH = { terminal: 8, orb: 3.5, post: 9, crystal: 3.5, gate: 14, altar: 12, room: 16, southGate: 30, closed: 16, calf: 9, giant: 48, court: 24, courtAltar: 14, top: 34 };

SG.create = function(game, R){
  const G = { game, R, rev: 0, toasts: [], prompt: null, hint: null }, REACH = SG.REACH;
  const T = game.terminals || [], term = Object.fromEntries(T.map(t => [t.name, t]));
  const gates = Object.fromEntries((game.gates || []).map(g => [g.name, g])), bridges = Object.fromEntries((game.bridges || []).map(b => [b.name, b]));
  const UGD = game.underground || null, crystals = game.crystals || [];
  const calves = game.calves || [], court = game.court || null, NEED = court ? court.calvesNeeded || 3 : 0, crownD = UGD && UGD.crownCrystals ? UGD.crownCrystals.d : [], starway = game.starway || null;
  const fresh = () => ({ v: SG.VERSION, powered: {}, active: null, got: [], lowered: {}, altar: false, crystals: [], offered: false, southGate: false,
    calf: null, taken: [], giantUp: false, crowned: false, crown: [], ceremony: false, ended: false, seen: {}, checkpoint: null });
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
    if (id === 'diamond' && /^Court diamond \d+$/.test(name)) return st.taken.length >= +name.slice(14) ? 1 : 0;      // lit once its calf stands on it
    if (id === 'altar' && name === 'Altar' && court) return st.ceremony ? 0 : st.crowned ? 2 : 0;                     // the ceremony's, while it's asking
    if (id === 'post' && name.endsWith(' post') && bridges[name.slice(0, -5)]) return G.bridgeOpen(name.slice(0, -5)) ? 1 : 0;
    return null;
  };
  G.orbs = () => st.active ? term[st.active].orbs.map((d, i) => ({ d, got: st.got.includes(i) })) : [];
  G.crystals = () => st.altar && !st.offered ? crystals.map((d, i) => ({ d, got: st.crystals.includes(i) })) : [];
  // the court's ground is under the sleeping giant until a calf wakes it: nothing there shows before then
  G.modelHidden = (name, id) => !court ? false : id === 'giant' ? st.giantUp : (id === 'diamond' || id === 'elder' || (id === 'altar' && name === 'Altar')) ? !st.giantUp : false;
  // every calf: with its herd, following you, or crowned on its diamond (spot: where it stands then)
  G.calves = () => calves.map((d, i) => { const k = st.taken.indexOf(i); return { d, i, state: k >= 0 ? 'court' : st.calf === i ? 'follow' : 'herd', spot: k >= 0 && court ? court.diamonds[k] || court.d : null }; });
  G.crownCrystals = () => st.crowned && !st.ceremony ? crownD.map((d, i) => ({ d, got: st.crown.includes(i) })) : [];
  G.crownLayer = UGD && UGD.crownCrystals ? UGD.crownCrystals.layer : -1;
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
      // ---- the south plain: a calf, the giant, the court
      if (court){
        if (st.calf === null && st.taken.length < NEED) for (let i = 0; i < calves.length; i++) if (!st.taken.includes(i) && near(calves[i], REACH.calf)){
          st.calf = i; bump(); G.toasts.push(st.taken.length ? 'Another calf leaves its herd to follow you' : 'A calf leaves its herd and follows you'); break; }
        if (!st.giantUp && game.giant && near(game.giant, REACH.giant)){
          if (st.calf !== null){ st.giantUp = true; bump(); G.toasts.push('The giant stirs at the calf\'s call, stands, and steps off the Broken Circle. The court was under it all along'); }
          else hint = 'The giant sleeps across the Broken Circle. It might wake for one of its own';
        } else if (st.giantUp && near(court.d, REACH.court)){
          if (st.calf !== null && st.taken.length < NEED){
            st.taken.push(st.calf); st.calf = null; bump(); G.toasts.push(`The calf takes its diamond and is crowned: ${st.taken.length} of ${NEED}`);
            if (st.taken.length >= NEED){ st.crowned = true; G.toasts.push(`The court dresses you in its purple, and the altar rises. It asks for ${crownD.length} crown crystals: the crown door in the mine will know you now`); }
          } else if (!st.crowned) hint = `The court waits: ${st.taken.length} of ${NEED} calves crowned. The herds are across the plain`;
          else if (!st.ceremony && near(court.d, REACH.courtAltar)){
            if (st.crown.length >= crownD.length) prompt = { key: 'ceremony', text: 'Offer the crown crystals', detail: 'The court is watching', act: () => { st.ceremony = true; bump(); G.toasts.push('The altar takes them and sinks away. Beside the court the Starway wakes, turning up into the sky toward the peak'); } };
            else hint = `The altar asks for ${crownD.length} crown crystals: you have ${st.crown.length}. They are in the mine, behind the crown door`;
          }
        }
        if (st.ceremony && !st.ended && starway && near(starway.top, REACH.top)){ st.ended = true; bump(); }
      }
      for (const g of game.gates || []) if (g !== cg && g.d && !G.gateOpen(g.name) && near(g.d, REACH.closed)){
        if (g.when && g.when.zone !== undefined){ const [a, c] = G.zoneCount(g.when.zone); hint = `${g.name}: locked. Zone ${g.when.zone} has ${a} of ${c} terminals live`; } else hint = `${g.name}: locked`; }
    } else if (UGD){
      const al = UGD.crystalAltar, tp = UGD.teleporter;
      if (al && ug === al.layer && near(al.d, REACH.altar)){
        if (!st.altar) prompt = { key: 'altar', text: 'Wake the altar', detail: 'Something old is sleeping here', act: () => { st.altar = true; bump(); G.toasts.push('The altar wakes. Far above, in the Bowl, a bridge of light reaches for the highlands'); } };
        else hint = 'The altar: awake';
      }
      if (tp && ug === tp.layer && near(tp.d, REACH.room)) toast('The teleporter is dead. The old workings run on past it', 'teleporter');
      if (st.crowned && !st.ceremony && ug === G.crownLayer) crownD.forEach((d, i) => { if (!st.crown.includes(i) && near(d, REACH.crystal)){ st.crown.push(i); bump(); G.toasts.push(st.crown.length >= crownD.length ? `All ${crownD.length} crown crystals: back to the Broken Circle` : `Crown crystal ${st.crown.length} of ${crownD.length}`); } });
      const cdr = UGD.crownDoor;
      if (cdr && !st.crowned && cdr.d && near(cdr.d, REACH.closed)) hint = 'The crown door: it opens for the court\'s purple';
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
    if (!court) return { title: 'Cross the Crystal bridge to the south plain', detail: '' };
    if (st.ended) return { title: 'The end', detail: 'The observatory, at the top of the Starway' };
    if (st.ceremony) return { title: 'Ride the Starway', detail: 'It starts beside the Broken Circle and ends at the observatory on the peak' };
    if (st.crowned) return st.crown.length >= crownD.length ? { title: 'Take the crown crystals to the Broken Circle', detail: 'The altar is waiting' }
      : { title: 'Find the crown crystals', detail: `${st.crown.length} of ${crownD.length} · in the mine, behind the crown door on the deep landing` };
    if (!st.giantUp) return st.calf !== null ? { title: 'Take the calf to the sleeping giant', detail: 'On the Broken Circle, across the south plain' } : { title: 'Cross to the south plain', detail: 'The herds are there, and something vast is asleep on the Broken Circle' };
    return { title: 'Bring calves to the court', detail: `${st.taken.length} of ${NEED} crowned` + (st.calf !== null ? ' · one is following you' : ' · the herds are across the plain') };
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
    for (const k of ['altar', 'offered', 'southGate', 'giantUp', 'ceremony', 'ended']) f[k] = !!o[k];
    f.taken = [...new Set((o.taken || []).filter(i => Number.isInteger(i) && i >= 0 && i < calves.length))].slice(0, NEED);
    if (Number.isInteger(o.calf) && o.calf >= 0 && o.calf < calves.length && !f.taken.includes(o.calf) && f.taken.length < NEED) f.calf = o.calf;
    f.crowned = court ? f.taken.length >= NEED && NEED > 0 : !!o.crowned;
    f.crown = [...new Set((o.crown || []).filter(i => Number.isInteger(i) && i >= 0 && i < crownD.length))];
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
    else if (what === 'calf'){ const i = calves.findIndex((_, k) => !st.taken.includes(k)); if (i >= 0 && st.taken.length < NEED) st.calf = i; }
    else if (what === 'giant') st.giantUp = true;
    else if (what === 'crowned'){ st.giantUp = true; st.calf = null; for (let i = 0; st.taken.length < NEED && i < calves.length; i++) if (!st.taken.includes(i)) st.taken.push(i); st.crowned = true; }
    else if (what === 'crown') st.crown = crownD.map((_, i) => i);
    else if (what === 'ceremony') st.ceremony = true;
    else return false;
    bump(); return true;
  };
  return G;
};
root.SkiGame = SG;
if (typeof module !== 'undefined' && module.exports) module.exports = SG;
})(typeof window !== 'undefined' ? window : globalThis);
