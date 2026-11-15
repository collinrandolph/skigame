# Builds the v2 world's surface on the reference planet's ground: trails routed over the real terrain, zones, gates,
# terminals and their orb loops, bridges, crystals and props. Writes additions.json for build_world.js to merge.
#   WORLD_WORK=<dir with h.f32, lines.json> python3 build_surface.py
from geo import *
REF = json.load(open(os.path.join(WORK, "lines.json")))
ski = sg <= STOP; skif = ski.ravel()
_clp = os.path.join(WORK, "cl.npy"); cl = np.load(_clp) if os.path.exists(_clp) else clearance(~ski); clf = cl.ravel(); sgf = sg.ravel(); hgf = hg.ravel()
WARN = []
def warn(*a): WARN.append(" ".join(str(x) for x in a)); print("  !!", *a)
def basis(c): a = np.array([0, 1, 0.]) if abs(c[1]) < 0.9 else np.array([1, 0, 0.]); e = norm(np.cross(a, c)); return e, np.cross(c, e)      # east, north (the layout's own frame)
def offset(c, r, bearing): e, n = basis(c); b = math.radians(bearing); return norm(c + (e*math.sin(b) + n*math.cos(b))*r/R)
def bearing(a, b): e, n = basis(a); t = b - a*np.dot(a, b); return math.degrees(math.atan2(np.dot(t, e), np.dot(t, n))) % 360
def angd(c): return R*np.arccos(np.clip(V @ c, -1, 1))
def r6(d): return [round(float(x), 6) for x in d]

# ---------------- the trails so far, and how far every cell is from one ----------------
TR = [dict(name=t["name"], closed=t["closed"], line=np.array([norm(p) for p in t["pts"]]), new=False) for t in REF["lines"]]
def T(name): return next(t for t in TR if t["name"] == name)
def field_update(arr, line):
    c = norm(line.mean(0)); rad = max(dist(c, p) for p in line[::4]) + 100
    sub = np.nonzero(V @ c >= math.cos(min(math.pi, rad/R)))[0]; best = np.full(len(sub), -1.0)
    for k in range(0, len(line), 150): best = np.maximum(best, (V[sub] @ line[k:k + 150].T).max(1))
    arr[sub] = np.minimum(arr[sub], R*np.arccos(np.clip(best, -1, 1)))
td = np.full(N, 1e9)
for t in TR: field_update(td, t["line"])
def line_len(line, closed=False): return sum(dist(line[i], line[i + 1]) for i in range(len(line) - 1)) + (dist(line[-1], line[0]) if closed else 0)
def nearest_on(name, d): line = T(name)["line"]; i = int(np.argmax(line @ d)); return i, line[i]
def nearest_any(d, names=None):
    best = None
    if names and not any(t["name"] in names for t in TR): names = None
    for t in TR:
        if names and t["name"] not in names: continue
        i = int(np.argmax(t["line"] @ d)); dd = dist(t["line"][i], d)
        if best is None or dd < best[0]: best = (dd, t["name"], i, t["line"][i])
    return best

# ---------------- gates: the narrowest point of each way between two regions ----------------
def choke(a, b):
    def near(lo, la): dd = angd(d_of(lo, la)); return int(np.argmin(np.where(skif & (clf >= 4), dd, 1e9)))
    G = graph(ski, 1 + 400/np.maximum(cl, 1)**2, gmax=0.4, gpen=0.3); p = route(G, near(*a), near(*b)); c = clf[p]; k = int(np.argmin(c)); return V[p[k]], c[k]
def on_trail_gate(d, reach=30):
    """A gate goes on the trail through the gap: the trail's point nearest, and the way the trail runs there."""
    dd, name, i, q = nearest_any(d)
    if dd > reach: return d, None, None
    line = T(name)["line"]; a, b = line[max(0, i - 2)], line[min(len(line) - 1, i + 2)]; return q, bearing(a, b), name
GATES = {}
for key, a, b in (("east", (45, -10), (70, -22)), ("north", (24, -2), (21, 20)), ("south", (140, -32), (125, -66))):
    d, c = choke(a, b); q, rot, name = on_trail_gate(d); GATES[key] = dict(d=q, rot=rot if rot is not None else 0, half=float(c), trail=name)
    print("gate", key, "at lon %.1f lat %.1f" % ll_of(q), "gap half-width %.0f m" % c, "on", name)

# ---------------- zones: what's joined once the gates are shut (bridges not counted) ----------------
shut = np.zeros(N, bool)
for g in GATES.values(): shut |= angd(g["d"]) <= 16
zl = components((skif & ~shut).reshape(Hg, Wg))
ZREF = {1: (40, -10), 2: (-45, 25), 3: (-120, 28), 4: (125, -66), "E": (18, -39)}
Z = {k: int(zl[nn(*v)]) for k, v in ZREF.items()}
print("zone components", Z, "areas ha", {k: round(float(CELL_AREA.ravel()[zl == v].sum()/1e4), 1) for k, v in Z.items()})
assert len(set(Z.values())) == 5, "zones are not sealed from each other"
def zone_of(d):
    c = zl[node(d)]
    for k, v in Z.items():
        if v == c: return k
    # (on a gate, or a cell the grid calls steep: the nearest zone cell within 25 m)
    dd = angd(d); ok = (dd < 25) & np.isin(zl, list(Z.values()))
    if ok.any(): c = zl[int(np.argmin(np.where(ok, dd, 1e9)))]; return next(k for k, v in Z.items() if v == c)
    return None

# ---------------- routing ----------------
_r = np.random.default_rng(11); _ax = [norm(_r.normal(size=3)) for _ in range(6)]
WOB = np.clip(1 + 0.42*np.sin(23*(V @ _ax[0]) + 1)*np.sin(19*(V @ _ax[1]) + 2) + 0.25*np.sin(41*(V @ _ax[2]) + 0.5)*np.sin(37*(V @ _ax[3])) + 0.15*np.sin(71*(V @ _ax[4]) + 3), 0.45, 2)
PASS = skif & (clf >= 4.5)
def factor(own): t = np.minimum(td, own); return WOB*(1 + 4*np.exp(-(t/24)**2))*(1 + 150/np.maximum(clf, 3)**2)*(1 + 3*(sgf/0.2)**2)      # off other trails, off cliffs, on gentle ground
def snap(lo, la, zone=None, mincl=12, maxd=140):
    c = d_of(lo, la); dd = angd(c)
    for mc in (mincl, 9, 6):
        ok = PASS & (clf >= mc) & (dd <= maxd)
        if zone is not None: ok &= zl == Z[zone]
        if ok.any(): return int(np.argmin(np.where(ok, dd, 1e9)))
    raise RuntimeError("nowhere to stand near %s %s in zone %s" % (lo, la, zone))
def resample(P, step=2.0):
    out = [P[0]]
    for q in P[1:]:
        while True:
            d = dist(out[-1], q)
            if d < step: break
            out.append(norm(out[-1]*(1 - step/d) + q*(step/d)))
    out.append(P[-1]); return np.array(out)
def smooth(P, win, closed):
    n = len(P); k = max(1, int(win/2)); Q = np.empty_like(P)
    for i in range(n):
        if closed: idx = [(i + j) % n for j in range(-k, k + 1)]
        else: kk = min(k, i, n - 1 - i); idx = list(range(i - kk, i + kk + 1))
        Q[i] = norm(P[idx].mean(0))
    return Q
def add_trail(name, stops, closed=False, start=None, end=None, zone=None, gmax=0.11, win=26):
    """Route a trail through the stops (cells), leg by leg; each leg keeps off the trails already there and off itself."""
    legs = list(zip(stops[:-1], stops[1:])) + ([(stops[-1], stops[0])] if closed else []); cells = []; own = np.full(N, 1e9)
    ok = PASS if zone is None else PASS & ((zl == Z[zone]) | shut)
    for a, b in legs:
        p = None
        for gm in (gmax, 0.15, 0.2):
            p = route(graph(ok.reshape(Hg, Wg), factor(own).reshape(Hg, Wg), gmax=gm), a, b)
            if p is not None: break
        if p is None: warn(name, "no route for a leg", ll_of(V[a]), ll_of(V[b])); return None
        cells += p[:-1]; field_update(own, V[np.array(p[:max(1, len(p) - 12)])])
    if not closed: cells.append(legs[-1][1])
    raw = V[np.array(cells)]
    if start is not None: raw = np.vstack([start[None], raw])
    if end is not None: raw = np.vstack([raw, end[None]])
    raw = resample(raw); sm = smooth(raw, win, closed)
    w = np.clip((clf[[node(p) for p in raw]] - 6)/8, 0, 1)[:, None]          # tight ground: keep the routed line, don't cut the corner
    line = smooth(np.array([norm(v) for v in raw*(1 - w) + sm*w]), 6, closed)
    if not closed: line[0], line[-1] = raw[0], raw[-1]
    n = len(line); m = max(4 if closed else 2, round(n*2/20)); idx = np.linspace(0, n - 1, m + 1).round().astype(int)
    pts = [line[i] for i in (idx[:-1] if closed else idx)]
    if not closed and line_len(line) < 15: print("trail %-22s too short to bother (%.0f m): the trails already meet" % (name, line_len(line))); return None
    t = dict(name=name, closed=closed, line=line, new=True, pts=pts); TR.append(t); field_update(td, line)
    print("trail %-22s %5.0f m  %d points" % (name, line_len(line, closed), len(pts))); return t
def loop(name, lo, la, r, zone, n=4, phase=0.0, squash=1.0, **kw):
    c = d_of(lo, la); stops = []
    for k in range(n):
        b = phase + 360*k/n; rr = r*(squash if k % 2 else 1.0)
        try: s = snap(*ll_of(offset(c, rr, b)), zone=zone, mincl=14, maxd=r*0.75)
        except RuntimeError: continue
        if s not in stops: stops.append(s)
    if len(stops) < 3: warn(name, "not enough room for a loop"); return None
    return add_trail(name, stops, closed=True, zone=zone, **kw)
def link(name, a, b, zone=None, via=(), **kw):
    """A trail between two places. Each end is ('trail', name, lon, lat): the point of that trail nearest there; or
    ('near', lon, lat): the nearest trail of any kind; or ('at', lon, lat): open ground."""
    def end(e):
        if e[0] == "trail": i, q = nearest_on(e[1], d_of(e[2], e[3])); return node(q), q
        if e[0] == "near": dd, nm, i, q = nearest_any(d_of(e[1], e[2]), e[3] if len(e) > 3 else None); return node(q), q
        s = snap(e[1], e[2], zone=zone); return s, None
    for e in (a, b):
        for nm in ([e[1]] if e[0] == "trail" else (e[3] if e[0] == "near" and len(e) > 3 else [])):
            if not any(t["name"] == nm for t in TR): warn(name, "skipped:", nm, "wasn't built"); return None
    (na, qa), (nb, qb) = end(a), end(b); mids = [snap(lo, la, zone=zone) for lo, la in via]
    return add_trail(name, [na] + mids + [nb], start=qa, end=qb, zone=zone, **kw)

# ============================ the world ============================
# ---- zone 2, the home plain: three loops across the empty north and east, tied into Trail 10 (the perimeter) ----
loop("Northfield loop", 2, 58, 105, 2, n=4, phase=20)
loop("Longlight loop", 58, 60, 95, 2, n=4, phase=50)
loop("Eastbank loop", 90, 24, 95, 2, n=4, phase=10)
link("Northfield road", ("trail", "Trail 10", -16, 28), ("near", -12, 55, ["Northfield loop"]), zone=2)
link("High traverse", ("near", 18, 62, ["Northfield loop"]), ("near", 42, 60, ["Longlight loop"]), zone=2)
link("Longlight road", ("near", 72, 52, ["Longlight loop"]), ("near", 88, 36, ["Eastbank loop"]), zone=2)
link("Trenchside", ("near", 70, 68, ["Longlight loop"]), ("trail", "Trail 10", 97, 62), zone=2)
link("Bridge road east", ("near", 100, 18, ["Eastbank loop"]), ("trail", "Trail 10", 117, 10), zone=2)
link("Mouth road", ("trail", "Trail 10", 69, -26), ("near", 86, 12, ["Eastbank loop"]), zone=2)
link("Far north trail", ("near", -8, 68, ["Northfield loop"]), ("trail", "Trail 10", -68, 58), zone=2, via=[(-35, 62)])
loop("Northcap loop", 20, 75, 62, 2, n=4, phase=0)
link("Northcap road", ("near", 20, 70, ["Northcap loop"]), ("near", 14, 66, ["Northfield loop", "High traverse"]), zone=2)
# ---- zone 3, the far plain ----
loop("Westreach loop", -112, 52, 100, 3, n=4, phase=30)
loop("Basin loop", -100, -38, 105, 3, n=4, phase=0)
loop("Farside loop", 152, 6, 95, 3, n=4, phase=40)
loop("Peakfoot loop", -112, 8, 85, 3, n=4, phase=15)
link("Westreach road", ("trail", "Trail 16", -108, 38), ("near", -112, 44, ["Westreach loop"]), zone=3)
link("Peakfoot road", ("trail", "Trail 16", -100, 36), ("near", -110, 16, ["Peakfoot loop"]), zone=3)
link("Basin road", ("near", -108, 0, ["Peakfoot loop"]), ("near", -100, -28, ["Basin loop"]), zone=3)
link("Riverside south", ("near", -92, -44, ["Basin loop"]), ("trail", "Trail 16", -88, 30), zone=3, via=[(-78, -20), (-76, 10)])
link("Farside road", ("near", 150, -2, ["Farside loop"]), ("near", 142, -22, ["Trail 16", "Trail 20"]), zone=3)
link("Bridge road west", ("near", 146, 12, ["Farside loop"]), ("near", 126, -4, ["Trail 16", "Trail 20"]), zone=3)
loop("Deepsouth loop", -98, -68, 62, 3, n=4, phase=0)
link("Deepsouth road", ("near", -104, -50, ["Basin loop"]), ("near", -98, -62, ["Deepsouth loop"]), zone=3)
loop("Pitside loop", -146, 23, 72, 3, n=4, phase=20)
link("Pitside road", ("near", -146, 30, ["Pitside loop"]), ("trail", "Trail 16", -146, 38), zone=3)
loop("Northreach loop", -138, 60, 80, 3, n=4, phase=0)
link("Northreach road", ("near", -138, 52, ["Northreach loop"]), ("trail", "Trail 16", -136, 40), zone=3)
link("Rimway", ("near", -128, 62, ["Northreach loop"]), ("near", -120, 58, ["Westreach loop"]), zone=3)
# ---- zone 4, the south plain ----
loop("Herd round", 128, -68, 120, 4, n=5, phase=0)
loop("Altar loop", -172, -60, 75, 4, n=4, phase=0)
link("South pass road", ("trail", "Trail 8", 128, -45), ("near", 132, -60, ["Herd round"]), zone=4)
link("Altar road", ("near", 150, -72, ["Herd round"]), ("near", -176, -62, ["Altar loop"]), zone=4)

# ---- the pit: which of its two low notches the mine road can reach ----
pit = norm(REF["stamps"][0]["pts"][0]); pe, pn = basis(pit)
def pit_at(deg, r): t = math.radians(deg); return norm(pit + (pe*math.cos(t) + pn*math.sin(t))*r/R)     # planet-terrain.js rampBuild's own angle
MINE = None
for deg in (315, 255, 250, 245, 240, 320, 310):
    inner = None
    for r in range(215, 140, -3):                      # walk in along the notch: the last ground a skier can stand on
        q = pit_at(deg, r); k = node(q)
        if PASS[k] and zl[k] == Z[3]: inner = (r, q)
        elif inner: break
    if inner and inner[0] < 200: MINE = dict(deg=deg, r=inner[0], d=inner[1], h=float(height(inner[1]))); break
if MINE:
    print("mine head: pit bearing %d, %d m from its centre, ground %.0f m" % (MINE["deg"], MINE["r"], MINE["h"]))
    dd, nm, i, q = nearest_any(MINE["d"])
    if dd > 6: add_trail("Mine road", [node(q), node(MINE["d"])], start=q, end=MINE["d"], zone=3)
    MINE["from"] = nm; MINE["portal"] = pit_at(MINE["deg"], MINE["r"] + 10)
else: warn("the pit's rim can't be reached from zone 3")

# ---- the highlands: a light bridge up from the bowl's west valley (the one clean span the ground offers: searched from
# every zone, see find_bridge_span.py), and a trail on from its far end ----
t10 = T("Trail 10")["line"]; hs = np.array([height(p) for p in t10]); KR = 0.16           # the deck's on-ramps climb 12 m over 75
Ecell = np.nonzero((zl == Z["E"]) & PASS & (clf >= 7))[0][::2]
def span_ok(a, b):
    """Can a light bridge's deck run from a to b? The ground under it has to stay below what the ramps can reach."""
    L = dist(a, b); n = max(4, int(L/5)); g0, g1 = height(a), height(b)
    for k in range(1, n):
        u = k/n; q = norm(a*(1 - u) + b*u); sdist = L*u
        if 18 < sdist < L - 18 and height(q) > min(g0 + sdist*KR, g1 + (L - sdist)*KR): return False
    return True
best = None
for i in range(0, len(t10), 2):
    if hs[i] < 28 or zone_of(t10[i]) != 1: continue
    dd = R*np.arccos(np.clip(V[Ecell] @ t10[i], -1, 1))
    for k in np.argsort(dd):
        if dd[k] < 60: continue
        if dd[k] > 320 or (best is not None and dd[k] >= best[0]): break
        if abs(hgf[Ecell[k]] - hs[i])/dd[k] <= KR*0.95 and span_ok(t10[i], V[Ecell[k]]): best = (dd[k], i, Ecell[k]); break
foot, head = t10[best[1]], V[best[2]]
print("highland bridge: from Trail 10 in the bowl at %.0f m (lon %.1f lat %.1f) to the highlands at %.0f m (lon %.1f lat %.1f), %.0f m" % (hs[best[1]], *ll_of(foot), height(head), *ll_of(head), dist(foot, head)))
HL = ["Trail 2", "Trail 3", "Trail 4", "Trail 5", "Trail 6", "Trail 18"]; _dd, _nm, _i, _q = nearest_any(head, HL)
if _dd < 15: head = _q                                   # close enough: land the bridge on the trail itself
else: add_trail("Bridgehead trail", [node(head), node(_q)], start=head, end=_q, zone="E", gmax=0.18)
loop("Southcrown loop", 4, -66, 60, "E", n=4, phase=0)
link("Southcrown road", ("near", 4, -66, ["Southcrown loop"]), ("near", 2, -68, ["Trail 2", "Trail 18"]), zone="E")

BRIDGES = [dict(name="West drawbridge", pts=REF["bridges"][1]["pts"], kind="draw", **{k: REF["bridges"][1][k] for k in ("clearance", "ramp", "width", "maxGrade")}),
           dict(name="East drawbridge", pts=REF["bridges"][2]["pts"], kind="draw", **{k: REF["bridges"][2][k] for k in ("clearance", "ramp", "width", "maxGrade")}),
           dict(name="Highland bridge", pts=[r6(foot), r6(head)], kind="light", clearance=12, ramp=75, width=2.5, maxGrade=0.1),
           dict(name="Crystal bridge", pts=REF["bridges"][0]["pts"], kind="light", **{k: REF["bridges"][0][k] for k in ("clearance", "ramp", "width", "maxGrade")})]

# ---------------- props ----------------
MODELS = []; PLACED = []
SIZE = dict(dome=22, plant=26, pad=20, greenhouse=20, biolab=20, giant=26, ribs=26, circle=18, observatory=20, tower=12, excavator=14, haul=7, comms=9, weather=5, fuel=12, solar=10, beacon=5,
            arch=9, watcher=8, shard=5, camp=12, harvester=7, signal=6, shacks=12, kiosk=1.5, gate=14, post=1.2, outcrop=6, plateau=5, crystalgate=12, mineportal=8, altar=3, moose=3, diamond=1.5, elder=3)
def put(mid, d, rot=0, v=0, seed=1, name=None, scale=1, solid=True):
    MODELS.append(dict(name=name or mid, id=mid, v=v, seed=seed, d=r6(d), rot=round(float(rot), 1), scale=scale, solid=solid)); PLACED.append((d, SIZE.get(mid, 6)*scale)); return d
def place(mid, lo, la, zone, name=None, reach=170, v=0, seed=1, scale=1, flat=0.14, face_trail=True):
    """Stand a model on level ground near (lon, lat): off the trails by its own size, clear of cliffs and other models."""
    r = SIZE.get(mid, 6)*scale; c = d_of(lo, la); dd = angd(c)
    ok = PASS & (zl == Z[zone]) & (dd <= reach) & (td >= r + 7) & (td <= r + 60) & (clf >= r + 4) & (sgf <= flat)
    for q, rq in PLACED: ok &= angd(q) >= r + rq + 6
    if not ok.any(): warn("no room for", mid, "near", lo, la); return None
    k = int(np.argmin(np.where(ok, dd + 0.6*td, 1e9))); d = V[k]
    rot = bearing(d, nearest_any(d)[3]) if face_trail else (seed*67) % 360
    return put(mid, d, rot=rot, v=v, seed=seed, name=name, scale=scale)
def beside(name_or_line, i, off, side=None):
    """A spot `off` metres to one side of a trail's i-th line point (the side with more room unless told)."""
    line = T(name_or_line)["line"] if isinstance(name_or_line, str) else name_or_line; n = len(line); a, b = line[max(0, i - 2)], line[min(n - 1, i + 2)]
    p = line[i]; t = norm(b - a); s = np.cross(p, t); c = [norm(p + s*sg_*off/R) for sg_ in (1, -1)]
    if side is None: side = 0 if clf[node(c[0])] >= clf[node(c[1])] else 1
    return c[side], p

# gates. (the gate and mine portal models have their doorway across their own z, so the way through is their x:
# a quarter turn from the trail's bearing. the crystal gate's doorway is across its x: it faces along the trail as it is)
for _k, _nm in (("east", "East gate"), ("north", "North gate"), ("south", "South pass gate")): put("gate", GATES[_k]["d"], rot=(GATES[_k]["rot"] - 90) % 360, name=_nm)
lb1 = [norm(p) for p in REF["bridges"][0]["pts"]]; cg = lb1[0] if zone_of(lb1[0]) == "E" else lb1[-1]; cg_other = lb1[-1] if cg is lb1[0] else lb1[0]
i, q = nearest_on("Trail 2", cg); cgd = T("Trail 2")["line"][max(0, min(len(T("Trail 2")["line"]) - 1, i + (8 if i < 20 else -8)))]
put("crystalgate", cgd, rot=bearing(cgd, cg), name="Crystal gate")
if MINE: put("mineportal", MINE["portal"], rot=(bearing(MINE["portal"], MINE["d"]) - 90) % 360, name="Mine portal")

# terminals: a kiosk beside its loop, a tall marker behind it, orbs round the loop
TERMINALS = []; LANDMARKS = []
def orbs_along(parts, n):
    """n orbs evenly along a circuit made of (trail, from, to) parts (fractions of each trail's length)."""
    pts = []
    for name, f0, f1 in parts:
        line = T(name)["line"]; m = len(line); i0, i1 = int(f0*(m - 1)), int(f1*(m - 1)); pts += list(line[i0:i1 + 1] if i1 >= i0 else line[i1:i0 + 1][::-1])
    pts = resample(np.array(pts), 2.0); idx = (np.arange(n) + 0.5)*len(pts)/n; return [pts[int(k)] for k in idx], line_len(pts)
def terminal(n, zone, parts, at, orbs, existing=None):
    if not all(any(t["name"] == p_[0] for t in TR) for p_ in parts): warn("terminal", n, "has no loop"); return
    name, frac = at; line = T(name)["line"]; i = int(frac*(len(line) - 1))
    if existing is not None: d = norm(existing); p = nearest_any(d)[3]
    else: d, p = beside(name, i, 6.5)
    put("kiosk", d, rot=bearing(d, p), v=0, name="Terminal %d" % n)
    back = norm(d + (d - p)/np.linalg.norm(d - p)*9/R); LANDMARKS.append(dict(name="Terminal %d" % n, type="terminal", d=r6(back), height=40, color="#8a5cd6"))
    ob, L = orbs_along(parts, orbs); TERMINALS.append(dict(name="Terminal %d" % n, zone=zone, d=r6(d), loop=[p_[0] for p_ in parts], loopLength=round(L), orbs=[r6(o) for o in ob]))
    print("terminal %d (zone %s): loop %s, %.0f m, %d orbs" % (n, zone, "+".join(p_[0] for p_ in parts), L, orbs))
# zone 1: the bowl's ring (Trail 11) and its cross-trail (Trail 12) make two circuits sharing the middle
t11, t12 = T("Trail 11")["line"], T("Trail 12")["line"]; fx = int(np.argmax(t11 @ t12[-1]))/(len(t11) - 1)
print("bowl: Trail 12 meets Trail 11 %.0f%% of the way round, %.0f m apart; Trail 11's ends are %.0f m apart" % (fx*100, dist(t11[int(fx*(len(t11) - 1))], t12[-1]), dist(t11[0], t11[-1])))
terminal(1, 1, [("Trail 12", 0, 1), ("Trail 11", fx, 0)], ("Trail 12", 0.8), 10, existing=REF["landmarks"][0]["d"])
terminal(2, 1, [("Trail 12", 0, 1), ("Trail 11", fx, 1)], ("Trail 11", 0.6), 10, existing=REF["landmarks"][1]["d"])
terminal(3, 2, [("Trail 9", 0, 1)], ("Trail 9", 0.55), 10)
terminal(4, 2, [("Northfield loop", 0, 1)], ("Northfield loop", 0.3), 10)
terminal(5, 2, [("Eastbank loop", 0, 1)], ("Eastbank loop", 0.6), 10)
terminal(6, 3, [("Westreach loop", 0, 1)], ("Westreach loop", 0.3), 15)
terminal(7, 3, [("Basin loop", 0, 1)], ("Basin loop", 0.5), 15)
terminal(8, 3, [("Farside loop", 0, 1)], ("Farside loop", 0.4), 15)
for m in REF["landmarks"]:
    if m["type"] == "beacon": LANDMARKS.append(m)

# the start: in the bowl, on the cross-trail by the landing pad
START = t12[int(0.45*(len(t12) - 1))]
# drawbridge control posts on the home bank
for b in BRIDGES[:2]:
    ends = [norm(b["pts"][0]), norm(b["pts"][-1])]; home = ends[0] if zone_of(ends[0]) == 2 else ends[1]; far = ends[1] if home is ends[0] else ends[0]
    e, n_ = basis(home); t = norm(far - home*np.dot(home, far)); s = np.cross(home, t); put("post", norm(home + (s*5 - t*4)/R), rot=bearing(home, far), name=b["name"] + " post"); b["home"] = r6(home)
# the outpost (zone 1), the works (zone 2), the camps (zone 3)
place("pad", 42, -13, 1, name="Landing pad"); place("tower", 37, -10, 1, name="Command tower"); place("dome", 44, -17, 1, name="Research dome"); place("weather", 36, -16, 1); place("solar", 47, -8, 1)
place("plant", -34, 20, 2, name="Processing plant"); place("excavator", -46, 16, 2, seed=3); place("haul", -40, 6, 2); place("fuel", -30, 14, 2)
place("greenhouse", 2, 52, 2); place("biolab", 10, 64, 2); place("comms", 56, 62, 2, name="Comms dish"); place("solar", 64, 56, 2, seed=2); place("fuel", 92, 18, 2, seed=2); place("weather", 86, 30, 2, seed=2)
place("beacon", 28, 34, 2, seed=2); place("beacon", 70, -20, 2, seed=3); place("beacon", -14, 30, 2, seed=4); place("beacon", 110, 8, 2, seed=5); place("beacon", -62, 40, 2, seed=6); place("haul", -30, -30, 2, seed=2)
place("camp", -110, 56, 3, seed=1); place("shacks", -104, 46, 3); place("signal", -116, 44, 3, name="Signal tower"); place("camp", -98, -34, 3, seed=2); place("harvester", -104, -38, 3); place("camp", 150, 10, 3, seed=3)
place("signal", 156, 2, 3, seed=2); place("shacks", -112, 10, 3, seed=2); place("camp", -84, 34, 3, seed=4); place("camp", 128, -8, 3, seed=5)
if MINE: lo, la = ll_of(pit_at(MINE["deg"], MINE["r"] + 70)); place("excavator", lo, la, 3, seed=5); place("haul", lo, la, 3, seed=3); place("shacks", lo, la, 3, seed=3)
# the highlands' ruins, the south plain's herd ground
place("watcher", 10, -4, "E", name="The watcher", face_trail=False); place("ribs", 18, -30, "E", name="The sleeping ribs", face_trail=False); place("watcher", 16, -60, "E", seed=2, face_trail=False)
for k, (lo, la) in enumerate([(10, -16), (14, -36), (20, -46), (8, -62), (30, -34), (-2, -68), (10, 2)]): place("shard", lo, la, "E", seed=k + 1, face_trail=False)
i = int(0.5*(len(T("Trail 2")["line"]) - 1)); a_ = T("Trail 2")["line"]; put("arch", a_[i], rot=bearing(a_[i], a_[min(len(a_) - 1, i + 3)]), name="Spine arch", solid=False)
# the Broken Circle: the court's ground. the giant sleeps right across it (so nothing there can be reached until a calf
# wakes it); under it the altar, three diamonds for the calves, and the elders waiting on the peak's side
SIZE["giant"] = 3                                      # (the model is life size: the layout stands it eleven times over)
ALTAR = place("circle", -172, -60, 4, name="The Broken Circle", face_trail=False)
pk = int(np.argmax(hgf)); PEAK = V[pk]; GIANT = None; DIAMONDS = []
if ALTAR is not None:
    toPeak = bearing(ALTAR, PEAK)
    put("altar", ALTAR, name="Altar")
    GIANT = put("giant", ALTAR, rot=(toPeak + 90) % 360, name="The sleeping giant", scale=11)
    for k in range(3): DIAMONDS.append(put("diamond", offset(ALTAR, 10, toPeak + 60 + 120*k), name="Court diamond %d" % (k + 1), solid=False))
    for k, (b_, r_) in enumerate([(toPeak - 62, 24), (toPeak - 90, 26), (toPeak - 118, 24)]): put("elder", offset(ALTAR, r_, b_), rot=(b_ + 180) % 360, name="Elder %d" % (k + 1))
# the herds, on the Herd round's side of the plain: grown moose standing about, and calves between them and the trail
CALVES = []
for k, (lo, la) in enumerate([(118, -64), (143, -68), (126, -77)]):
    c = place("moose", lo, la, 4, name="Herd bull", seed=k + 1, scale=1.6, face_trail=False)
    if c is None: continue
    for j, (b_, r_) in enumerate([(30 + 50*k, 8), (170 + 40*k, 9)]): put("moose", offset(c, r_, b_), rot=(b_*3 + 40) % 360, seed=10*k + j, name="Herd moose")
    q = nearest_any(c)[3]; t_ = norm(c - q*np.dot(q, c)); t_ = norm(t_ - q*np.dot(t_, q)); s_ = np.cross(q, t_)
    for j in (-1, 1):
        d = norm(q + (t_*5.5 + s_*j*3.5)/R)
        if PASS[node(d)] and zone_of(d) == 4: CALVES.append(d)
print("herd calves:", len(CALVES))
for k, (lo, la) in enumerate([(118, -62), (140, -64), (132, -76), (110, -70), (160, -70), (-178, -64), (150, -58), (105, -50)]): place("outcrop", lo, la, 4, seed=k + 1, face_trail=False)
put("observatory", PEAK, rot=0, name="The observatory")

# crystals: twenty through the highlands, beside the trails, a good walk apart
hl = [t for t in TR if zone_of(t["line"][len(t["line"])//2]) == "E"]; total = sum(line_len(t["line"], t["closed"]) for t in hl)
tdE = np.full(N, 1e9)
for t in hl: field_update(tdE, t["line"])
okc = (zl == Z["E"]) & skif & (clf >= 2.5) & (tdE >= 6) & (tdE <= 22)
for q, rq in PLACED: okc &= angd(q) >= rq + 4
cand = np.nonzero(okc)[0]; rr = np.random.default_rng(5); CRYSTALS = [V[cand[int(rr.integers(len(cand)))]]]; far = angd(CRYSTALS[0])[cand]
while len(CRYSTALS) < 20:                               # each next one as far from the others as it can be
    k = int(np.argmax(far)); CRYSTALS.append(V[cand[k]]); far = np.minimum(far, angd(V[cand[k]])[cand])
print("crystals placed: %d over %d m of highland trail, nearest pair %.0f m apart" % (len(CRYSTALS), total, min(dist(a, b) for i, a in enumerate(CRYSTALS) for b in CRYSTALS[i + 1:])))
if len(CRYSTALS) < 20: warn("only", len(CRYSTALS), "crystals fitted")

# the Starway: a bridge of light from the Broken Circle to the observatory on the peak, 190 m up and 385 m away. the
# mountain is too steep to climb and joins the ranges round it, so the bridge can't wind round it either: it gains its
# height over the open plain first, in a widening-to-tightening spiral beside the court (each turn 12 m inside the
# last, so no part of it hangs over another), then crosses to the summit in one straight span
SW = None
if ALTAR is not None:
    K, R_A, PITCH, R_TOP = 0.2, 82.0, 12.0, 31.0          # the deck's grade; the spiral's first radius and what it closes by each turn
    def starway(C, turn):
        ce, cn = basis(C); va = ALTAR - C*np.dot(ALTAR, C); th0 = math.atan2(np.dot(va, cn), np.dot(va, ce))
        at = lambda r, th: norm(C + (ce*math.cos(th) + cn*math.sin(th))*r/R)
        pts = []; best = None
        for i in range(0, int(3.4*72) + 1):
            f = i/72; q = at(R_A - PITCH*f, th0 + turn*2*math.pi*f); pts.append(q)
            if f >= 1.9 and len(pts) > 2:                  # leave the spiral where it's pointing at the peak
                t_ = norm(pts[-1] - pts[-2]); tp = PEAK - q*np.dot(PEAK, q); tp = norm(tp)
                if np.dot(t_, tp) > math.cos(math.radians(2.5)): best = len(pts); break
        if best is None: return None
        out = norm(pts[-1] - PEAK*np.dot(pts[-1], PEAK)); land = lambda r: norm(PEAK + out*r/R)
        # the span must set the skier down on the summit plateau itself, not its rim: the first spot, coming in, with
        # level skiable ground under it and for 8 m further on (the rim is steeper than a skier can stand on)
        r_top = next((r for r in np.arange(R_TOP + 12, 4, -1.0) if all(slope(land(r - e)) <= 0.3 for e in (0, 4, 8))), None)
        if r_top is None: return None
        top = land(r_top)
        n = max(2, int(dist(pts[-1], top)/20)); pts += [norm(pts[-1]*(1 - j/n) + top*(j/n)) for j in range(1, n + 1)]
        line = resample(np.array(pts), 4.0); sd = np.concatenate([[0], np.cumsum([dist(line[i], line[i + 1]) for i in range(len(line) - 1)])]); L_ = sd[-1]
        g = np.array([height(q) for q in line]); deck = np.minimum(g[0] + K*sd, g[-1] + K*(L_ - sd)); mid = (sd > 45) & (sd < L_ - 45)
        return dict(pts=pts, L=L_, clear=float((deck - g)[mid].min()), rise=float(g[-1] - g[0]), foot=pts[0], top=top, high=float((deck - g).max()), turns=(best - 1)/72)
    cands = []
    for cb in range(0, 360, 15):
        for cd in (R_A + 30, R_A + 42, R_A + 56):
            C = offset(ALTAR, cd, cb)
            for turn in (1, -1):
                w = starway(C, turn)
                if w and w["clear"] >= 8 and PASS[node(w["foot"])] and zone_of(w["foot"]) == 4 and all(dist(w["foot"], q) > rq + 6 for q, rq in PLACED if rq < 30): cands.append(w)
    if cands:
        w = min(cands, key=lambda c: c["L"])
        BRIDGES.append(dict(name="Starway", pts=[r6(q) for q in w["pts"]], kind="light", clearance=400, ramp=round(400/K), width=3.5, maxGrade=0.25))
        SW = dict(foot=r6(w["foot"]), top=r6(w["top"]), length=round(w["L"]), rise=round(w["rise"]))
        print("starway: %d m (%.2f turns over the plain, then the span), rising %d m at %d%%, at least %.0f m over the ground and up to %d m; foot %.0f m from the altar; %d ways tried fit" % (w["L"], w["turns"], w["rise"], K*100, w["clear"], w["high"], dist(w["foot"], ALTAR), len(cands)))
    else: warn("no Starway found")

# ---------------- write it out ----------------
new = [t for t in TR if t["new"]]
tz = {t["name"]: zone_of(t["line"][len(t["line"])//2]) for t in TR}
tz["Trail 10"] = 2
out = dict(
    trails=[dict(name=t["name"], closed=t["closed"], pts=[r6(p) for p in t["pts"]], carve=False, bed=4, shoulder=10, smooth=40, maxGrade=0.2) for t in new],
    bridges=BRIDGES, models=MODELS, landmarks=LANDMARKS, start=dict(d=r6(START)),
    mine=dict(deg=MINE["deg"], r=MINE["r"], h=MINE["h"], d=r6(MINE["d"])) if MINE else None,
    game=dict(version=1, note="Skate Ski v2 world data: read by the game, kept by the planet editor. Positions are unit vectors from the planet's centre.",
        zones=[dict(id=1, name="The Bowl", ref=r6(d_of(*ZREF[1]))), dict(id=2, name="Home plain", ref=r6(d_of(*ZREF[2]))), dict(id=3, name="Far plain", ref=r6(d_of(*ZREF[3]))),
               dict(id="highlands", name="The Highlands", ref=r6(d_of(*ZREF["E"]))), dict(id=4, name="South plain", ref=r6(d_of(*ZREF[4])))],
        trailZones=tz, terminals=TERMINALS,
        gates=[dict(name="East gate", d=r6(GATES["east"]["d"]), between=[1, 2], opens="zone 1 terminals powered", when=dict(zone=1)), dict(name="North gate", d=r6(GATES["north"]["d"]), between=[1, 2], opens="zone 1 terminals powered", when=dict(zone=1)),
               dict(name="Mine portal", d=r6(MINE["portal"]) if MINE else None, between=[3, "mine"], opens="zone 3 terminals powered", when=dict(zone=3)),
               dict(name="Crystal gate", d=r6(cgd), between=["highlands", 4], opens="20 crystals offered; lights the Crystal bridge", when=dict(flag="offered")),
               dict(name="South pass gate", d=r6(GATES["south"]["d"]), between=[3, 4], opens="from the zone 4 side, once reached", when=dict(flag="southGate"))],
        bridges=[dict(name="West drawbridge", kind="draw", opens="zone 2 terminals powered", when=dict(zone=2), post=BRIDGES[0]["home"]), dict(name="East drawbridge", kind="draw", opens="zone 2 terminals powered", when=dict(zone=2), post=BRIDGES[1]["home"]),
                 dict(name="Highland bridge", kind="light", opens="the crystal altar woken", when=dict(flag="altar")), dict(name="Crystal bridge", kind="light", opens="20 crystals offered at the Crystal gate", when=dict(flag="offered")),
                 dict(name="Starway", kind="light", opens="30 crown crystals offered at the Broken Circle", when=dict(flag="ceremony"), foot=SW["foot"] if SW else None)],
        crystals=[r6(c) for c in CRYSTALS], altar=r6(ALTAR) if ALTAR is not None else None, giant=r6(GIANT) if GIANT is not None else None, starway=SW,
        calves=[r6(c) for c in CALVES], court=dict(d=r6(ALTAR), diamonds=[r6(d) for d in DIAMONDS], calvesNeeded=3) if ALTAR is not None else None,
        chapters=["Zone 1: power 2 terminals; the East and North gates open", "Zone 2: power 3 terminals; the two drawbridges over the river lower", "Zone 3: power 3 terminals; the mine portal opens",
                  "The mine: reach the teleporter (dead) and wake the crystal altar; the Highland bridge lights, back in the Bowl", "Crystal search: find 20 crystals in the highlands", "Crystal gate: offer them; the Crystal bridge lights down into zone 4",
                  "Zone 4: a calf from the herds wakes the giant asleep on the Broken Circle; three calves crowned there and the court dresses you in purple; the South pass gate opens as a shortcut",
                  "The crown door in the mine knows the purple: 30 crown crystals in the crown room", "Offer them at the Broken Circle and the Starway lights, winding up the peak to the observatory: the end"]),
    report=dict(warnings=WARN, newTrailMetres=round(sum(line_len(t["line"], t["closed"]) for t in new)), oldTrailMetres=round(sum(line_len(t["line"], t["closed"]) for t in TR if not t["new"])),
        zoneAreasHa={str(k): round(float(CELL_AREA.ravel()[zl == v].sum()/1e4), 1) for k, v in Z.items()},
        zoneTrailMetres={str(z): round(sum(line_len(t["line"], t["closed"]) for t in TR if tz[t["name"]] == z)) for z in (1, 2, 3, 4, "E")}))
json.dump(out, open(os.path.join(WORK, "additions.json"), "w"))
np.save(os.path.join(WORK, "zl.npy"), zl.reshape(Hg, Wg)); json.dump({k: v for k, v in Z.items()}, open(os.path.join(WORK, "zones.json"), "w"))
json.dump([dict(name=t["name"], closed=t["closed"], new=t["new"], pts=[r6(p) for p in t["line"][::3]]) for t in TR], open(os.path.join(WORK, "alltrails.json"), "w"))
print("new trail %d m, existing %d m; warnings: %d" % (out["report"]["newTrailMetres"], out["report"]["oldTrailMetres"], len(WARN)))
