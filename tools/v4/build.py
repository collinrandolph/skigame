# v4's layout: v3's kind of trail network (compact loops, lanes between them) fitted into the skiable ground of the v2
# planet, whose terrain is the owner's sculpt. Reads the v2 work files (WORLD_WORK: h.f32, zl.npy, zones.json, cl.npy:
# see tools/world/README.md) and planets/v2-world.json for the story's fixed points (gates, bridges, the pit, the court).
# Writes v4/data/layout.js. Run from tools/world so geo.py is importable:  python3 ../v4/build.py
import sys, json, math, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "world"))
from geo import *
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..", "..")
V2 = json.load(open(os.path.join(ROOT, "planets", "v2-world.json"))); GAME = V2["game"]
zl = np.load(os.path.join(WORK, "zl.npy")).ravel(); Z = json.load(open(os.path.join(WORK, "zones.json")))
skiable = (sg <= STOP).ravel(); cl = clearance(~(sg <= STOP)).ravel(); sgf = sg.ravel(); hgf = hg.ravel()
def angd(c): return R*np.arccos(np.clip(V @ c, -1, 1))
def basis(c): a = np.array([0, 1, 0.]) if abs(c[1]) < 0.9 else np.array([1, 0, 0.]); e = norm(np.cross(a, c)); return e, np.cross(c, e)
def offset(c, r, brg): e, n = basis(c); b = math.radians(brg); return norm(c + (e*math.sin(b) + n*math.cos(b))*r/R)
def r5(d): lo, la = ll_of(d); return [round(lo, 3), round(la, 3)]
WOB = 1 + 0.5*np.abs(np.sin(V[:, 0]*37.1) + np.sin(V[:, 1]*29.3 + 1.7) + np.sin(V[:, 2]*41.7 + 0.4))/3      # a little waywardness, so routes are not ruler lines
def zgraph(mask, gmax=0.13): return graph(mask.reshape(Hg, Wg), factor=(WOB*(1 + 120/np.maximum(cl, 3)**2)*(1 + 3*(sgf/0.2)**2)).reshape(Hg, Wg), gmax=gmax)

ZNAME = {"1": "The Bowl", "2": "Home plain", "3": "Far plain", "4": "South plain", "E": "The Highlands"}
PLAN = {   # how many loops a zone gets, the biggest a loop may be, and their names (v3's, where there is one)
  "1": dict(n=2, cap=95, names=["Frostline Loop", "Dome Ring"]),
  "2": dict(n=5, cap=215, names=["Frostveil", "Ribs Rise", "South Veil", "Watcher's Round", "Signal Loop"]),
  "3": dict(n=4, cap=215, names=["The Cut", "Pit Ring", "Digger's Loop", "Ore Round"]),
  "4": dict(n=2, cap=120, names=["Court Round", "Circle Walk"]),
  "E": dict(n=1, cap=60, names=["Crystal Heights"]),
}
LOOPS, LINKS, TRAIL_NODES = [], [], {}
def ring(zone, c, r, name):
    """A closed trail round c at about r: waypoints on the circle, each moved to good ground, routed one to the next."""
    zm = (zl == Z[zone]) & (sgf <= 0.3); G = zgraph(zm); way = []
    for k in range(10):
        p = offset(c, r*(1 + 0.10*math.sin(k*1.9 + r)), k*36); d = angd(p); ok = zm & (d < 0.45*r + 25) & (cl > 10)
        if not ok.any(): continue
        way.append(int(np.argmin(np.where(ok, d, 1e9))))
    if len(way) < 5: return None
    nodes = []
    for a, b in zip(way, way[1:] + way[:1]):
        if a == b: continue
        p = route(G, a, b)
        if p is None: return None
        nodes += p[:-1]
    line = smooth_path(nodes + [nodes[0]], win=34, closed=True)[:-1]
    L = len(line)*2
    if L < 2*math.pi*r*0.6 or L > 2*math.pi*r*2.2: return None
    return dict(name=name, z=zone, closed=True, line=line, c=c, r=r)
for zone, plan in PLAN.items():
    zm = zl == Z[zone]; taken = np.zeros(N, bool); got = 0
    for k in range(plan["n"]*6):
        if got >= plan["n"]: break
        cand = np.where(zm & ~taken, cl, -1); i = int(np.argmax(cand)); C = cand[i]
        if C < 34: break
        c = V[i]; r = min(plan["cap"] if got == 0 else plan["cap"]*0.72, 0.62*C)
        lp = ring(zone, c, r, plan["names"][got]) if r >= 30 else None
        taken |= angd(c) < (r + (55 if lp else 0) + 0.62*C*0.9 if lp else 60)
        if lp: LOOPS.append(lp); got += 1
    print(zone, ZNAME[zone], "loops:", [(l["name"], round(l["r"]), len(l["line"])*2) for l in LOOPS if l["z"] == zone])
def nearest_trail(d, zone):
    best = None
    for t in LOOPS + LINKS:
        if zone is not None and t["z"] != zone: continue
        k = int(np.argmax(t["line"] @ d)); dd = dist(t["line"][k], d)
        if best is None or dd < best[0]: best = (dd, t, k)
    return best
def lane(name, a, b, zone, loose=False):
    """A routed open trail from point a to point b (unit vectors)."""
    zm = (skiable & (sgf <= 0.34) & ((zl == Z[zone]) | (angd(a) < 70) | (angd(b) < 70))) if not loose else skiable & (np.minimum(angd(a), angd(b)) < 420)
    na = int(np.argmin(np.where(zm, angd(a), 1e9))); nb = int(np.argmin(np.where(zm, angd(b), 1e9)))
    p = route(zgraph(zm, 0.15 if not loose else 0.3), na, nb)
    if p is None and not loose: return lane(name, a, b, zone, loose=True)        # (a pass can be steeper or narrower than a trail would choose)
    if p is None: print("  !! no way for", name); return None
    line = smooth_path(p, win=22); line = np.vstack([a[None, :], line[3:-3], b[None, :]]) if len(line) > 12 else np.vstack([a, b])
    t = dict(name=name, z=zone, closed=False, line=line); LINKS.append(t); return t
# lanes between a zone's loops: each loop to its nearest neighbour already joined (a tree), then one more to close a circuit
LANE_NAMES = {"1": ["Pad Lane"], "2": ["Ribs Climb", "Low Road", "Tower Lane", "Mast Lane", "Veil Cut"], "3": ["Pit Lane", "Ore Lane", "Shaft Lane", "Haul Lane"], "4": ["Temple Lane"], "E": []}
for zone in PLAN:
    ls = [l for l in LOOPS if l["z"] == zone]; joined = ls[:1]; names = list(LANE_NAMES[zone])
    def gap(a, b): D = np.arccos(np.clip(a["line"] @ b["line"].T, -1, 1))*R; i, j = np.unravel_index(np.argmin(D), D.shape); return D[i, j], a["line"][i], b["line"][j]
    pairs = []
    while len(joined) < len(ls):
        best = min(((gap(a, b), a, b) for a in joined for b in ls if b not in joined), key=lambda q: q[0][0]); (d, pa, pb), a, b = best
        lane(names.pop(0) if names else "%s lane %d" % (ZNAME[zone], len(LINKS)), pa, pb, zone); joined.append(b); pairs.append((a["name"], b["name"]))
    if len(ls) >= 3:
        rest = [(gap(a, b), a, b) for i, a in enumerate(ls) for b in ls[i + 1:] if (a["name"], b["name"]) not in pairs and (b["name"], a["name"]) not in pairs]
        if rest: (d, pa, pb), a, b = min(rest, key=lambda q: q[0][0]); lane(names.pop(0) if names else ZNAME[zone] + " cut", pa, pb, zone)
# spurs: in the small and the narrow zones a loop leaves most of the ground unvisited; run a trail out to the furthest corners
SPURS = {"1": ["Rim Spur"], "4": ["Herd Lane", "Far Corner"], "E": ["High Traverse", "Outlook Spur", "Ledge Spur", "Cairn Spur"]}
def trail_dist(zone):
    d = np.full(N, 1e9)
    for t in LOOPS + LINKS:
        if t["z"] == zone:
            for q in t["line"][::6]: d = np.minimum(d, angd(q))
    return d
for zone, names in SPURS.items():
    for nm in names:
        td = trail_dist(zone); ok = (zl == Z[zone]) & (cl > 9) & (sgf < 0.25); far = np.where(ok, td, -1); i = int(np.argmax(far))
        if far[i] < 70: break
        q = nearest_trail(V[i], zone); lane(nm, q[1]["line"][q[2]], V[i], zone)
# ---- the story's fixed points, from v2, and roads to them
def zone_at(d, reach=60):
    dd = angd(d); ok = (dd < reach) & np.isin(zl, list(Z.values()))
    if not ok.any(): return None
    lab = zl[int(np.argmin(np.where(ok, dd, 1e9)))]; return next(k for k, v in Z.items() if v == lab)
def road_to(name, P, zone):
    q = nearest_trail(P, zone)
    if q is None: print("  !! no trail in zone", zone, "for", name); return None
    return lane(name, q[1]["line"][q[2]], P, zone)
gates = {g["name"]: norm(g["d"]) for g in GAME["gates"]}; mod = {m["name"]: m for m in V2["models"]}
bridges = {b["name"]: [norm(p) for p in b["pts"]] for b in V2["bridges"]}
OUT = dict(radius=R, stop=STOP, gates=[], draws=[], lights=[])
def through(gname, za, zb, name):           # one road through a gate: from zone a's nearest trail, through the gate, to zone b's
    g = gates[gname]; a = road_to(name, g, za); b = road_to(name + ", beyond", g, zb)
    OUT["gates"].append(dict(name=gname, at=r5(g), rot=mod[gname]["rot"], zones=[za, zb]))
through("East gate", "1", "2", "East Road"); through("North gate", "1", "2", "North Road"); through("South pass gate", "4", "3", "South Pass")
for bn, kind in [("West drawbridge", "draw"), ("East drawbridge", "draw"), ("Highland bridge", "light"), ("Crystal bridge", "light")]:
    a, b = bridges[bn][0], bridges[bn][-1]; za, zb = zone_at(a), zone_at(b)
    print(bn, "joins", za, zb)
    for end, zz, tag in [(a, za, "near"), (b, zb, "far")]:
        if bn == "Crystal bridge" and zz == "E": continue          # (the Gate Walk, below, is its road)
        if zz: road_to("%s, %s side" % (bn.replace(" drawbridge", " Bridge Road").replace(" bridge", " Bridge Road"), ZNAME[zz]), end, zz)
    OUT["draws" if kind == "draw" else "lights"].append(dict(name=bn, a=r5(a), b=r5(b), zones=[za, zb]))
# the Crystal gate stands in the highlands' neck: the road from the Crystal bridge's highland end runs through it to the highland trail
cg = gates["Crystal gate"]; cb = [p for p in bridges["Crystal bridge"] if zone_at(p) != "4"][0]
q = nearest_trail(cg, "E"); t1 = lane("Gate Walk", q[1]["line"][q[2]], cg, "E", loose=True); t2 = lane("Gate Walk, beyond", cg, cb, "E", loose=True)
OUT["gates"].append(dict(name="Crystal gate", at=r5(cg), rot=mod["Crystal gate"]["rot"], zones=["E", "E"]))
# the pit and the mine's mouth; the court
UG = GAME["underground"]; portal = gates["Mine portal"]; road_to("Adit Lane", portal, "3")
OUT["mine"] = dict(portal=r5(portal), rot=mod["Mine portal"]["rot"], rampStart=r5(norm(UG["rampStart"])) if "rampStart" in UG else None)
court = norm(GAME["court"]["d"]); road_to("Circle Approach", court, "4"); OUT["court"] = r5(court)
OUT["start"] = r5(LOOPS[0]["line"][0]); OUT["summit"] = r5(V[int(np.argmax(hgf))]); OUT["summitH"] = float(hgf.max())
OUT["zones"] = [dict(id=k, name=v) for k, v in ZNAME.items()]
OUT["trails"] = [dict(name=t["name"], z=t["z"], closed=t["closed"], pts=[r5(p) for p in thin(t["line"], 16, t["closed"])]) for t in LOOPS + LINKS]
print(len(LOOPS), "loops,", len(LINKS), "lanes,", round(sum(len(t["line"])*2 for t in LOOPS + LINKS)), "m of trail")
open(os.path.join(ROOT, "v4", "data", "layout.js"), "w").write("// Generated by tools/v4/build.py. Do not edit.\n(function(r){ const L = " + json.dumps(OUT, separators=(",", ":")) + "; if (typeof module !== 'undefined' && module.exports) module.exports = L; else r.HALE_LAYOUT = L; })(typeof window !== 'undefined' ? window : globalThis);\n")
json.dump(dict(trails=[dict(name=t["name"], z=t["z"], pts=[r5(p) for p in t["line"][::4]]) for t in LOOPS + LINKS], out=OUT), open(os.path.join(WORK, "v4layout.json"), "w"))
