# The view audit: ride every trail both ways and record what the player has in front of them.
#
#   node dump_lines.js ../../planets/v2-world.json $WORLD_WORK/v2lines.json
#   python3 audit_views.py ../../planets/v2-world.json ../../planets/v2-view-audit
#
# writes <out>.json (every number), <out>.md (the readable report) and <out>.png (the map of bare stretches).
# What it knows: the ground (h.f32), the trails as the game lays them, the layout's models and landmarks, the drawbridges.
# What it does not know: the woods (the page scatters trees from a noise field this tool can't read yet), the sky,
# weather, light. Heights in HEIGHT are estimates of each model's silhouette, good to a few metres.
import sys
from geo import *

LAYOUT = sys.argv[1] if len(sys.argv) > 1 else "../../planets/v2-world.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else "../../planets/v2-view-audit"
world = json.load(open(LAYOUT)); lines = json.load(open(os.path.join(WORK, "v2lines.json")))

# ---- how the player sees (planetoid.html: camd 15 puts the camera 9.3 m up; "flat" 0.4 draws the planet as if it were
# R/(1 - 0.4) across, so the horizon sits 1.29x further off than the true curve would put it)
EYE = 9.3; RE = R/(1 - 0.4); FAR = 900.0
STEP = 10.0                      # metres between viewpoints
AHEAD, FRAME = 20.0, 42.0        # degrees either side of the heading: "dead ahead" and "on screen" (a landscape screen)
SEEN = 1.5                       # a thing counts once this many degrees of its height show over the ground between
NEAR = 45.0                      # a thing this close beside the trail counts as trailside texture
VISTA = 4.0                      # the far skyline stands this many degrees over the level: a mountain view
BARE_MIN, STALE_MIN = 120.0, 300.0   # report bare stretches and nothing-new stretches at least this long
SPEED = 6.5                      # m/s, a steady skate: turns metres into seconds in the report

HEIGHT = dict(dome=12, plant=18, pad=4, greenhouse=6, biolab=8, giant=6, ribs=9, circle=6, observatory=16, tower=30, excavator=10,
              haul=4, comms=14, weather=6, fuel=6, solar=4, beacon=10, arch=9, watcher=16, shard=7, camp=3, harvester=5, signal=14,
              shacks=4, kiosk=1.6, gate=12, post=1.5, outcrop=5, plateau=5, crystalgate=21, mineportal=6, altar=10, moose=2.2,
              diamond=1.5, elder=2.5)

def heights(D):                  # bilinear ground height for an (n, 3) array of unit vectors
    D = np.asarray(D, float); lo = np.arctan2(-D[:, 2], D[:, 0]); la = np.arcsin(np.clip(D[:, 1], -1, 1))
    x = (lo/(2*math.pi) + 0.5)*W - 0.5; y = (0.5 - la/math.pi)*H - 0.5
    i0 = np.floor(x).astype(int); j0 = np.clip(np.floor(y).astype(int), 0, H - 2); u = x - i0; v = np.clip(y - j0, 0, 1)
    g = lambda j, i: h_full[j, i % W]
    return (g(j0, i0)*(1 - u) + g(j0, i0 + 1)*u)*(1 - v) + (g(j0 + 1, i0)*(1 - u) + g(j0 + 1, i0 + 1)*u)*v
def unit(A): return A/np.linalg.norm(A, axis=-1, keepdims=True)

# ---- the things there are to see
FEAT = []
for m in world["models"]:
    Hm = HEIGHT.get(m["id"], 5)*m.get("scale", 1)
    FEAT.append(dict(name=m.get("name") or m["id"], kind=m["id"], d=norm(m["d"]), H=Hm))
for l in world["landmarks"]: FEAT.append(dict(name=l["name"], kind=l["type"], d=norm(l["d"]), H=float(l.get("height", 20))))
for b in lines["bridges"]:
    if b.get("kind") != "draw": continue          # light bridges are dark until late in the story: not scenery to count on
    P = np.array(b["pts"]); k = len(P)//2; FEAT.append(dict(name=b["name"], kind="drawbridge", d=norm(P[k]), H=max(6.0, b["h"][k] - float(heights(P[k:k + 1])[0]) + 4)))
FD = np.array([f["d"] for f in FEAT]); FH = np.array([f["H"] for f in FEAT]); FG = heights(FD)
print(len(FEAT), "things to see;", len(lines["lines"]), "trails")

# ---- viewpoints: every STEP metres along every surface trail, facing each way
surface = {t["name"] for t in world["trails"]}; tz = world.get("game", {}).get("trailZones", {})
VP = []                                            # (trail index, direction, metres along, position, heading unit vector)
TR = []
for ti, l in enumerate(lines["lines"]):
    if l["name"] not in surface: continue
    P = unit(np.array(l["pts"])); seg = R*np.arccos(np.clip((P[:-1]*P[1:]).sum(1), -1, 1)); s = np.concatenate([[0], np.cumsum(seg)])
    if s[-1] < 60: continue
    at = lambda q: unit(np.array([np.interp(q, s, P[:, k]) for k in range(3)]).T)
    ss = np.arange(0, s[-1], STEP); pos = at(ss); a = at(np.clip(ss - 5, 0, s[-1])); b = at(np.clip(ss + 10, 0, s[-1]))
    tan = b - a; tan = unit(tan - pos*(tan*pos).sum(1, keepdims=True))
    TR.append(dict(name=l["name"], length=float(s[-1]), zone=tz.get(l["name"]), n=len(ss), ti=len(TR), closed=l["closed"]))
    for dr in (1, -1):
        for k in range(len(ss)): VP.append((len(TR) - 1, dr, ss[k], pos[k], tan[k]*dr))
POS = np.array([v[3] for v in VP]); HEAD = np.array([v[4] for v in VP]); NV = len(VP)
G0 = heights(POS); YE = G0 + EYE
EAST = np.cross(HEAD, POS)                         # the player's right-hand side
print(NV, "viewpoints over", round(sum(t["length"] for t in TR)), "m of trail")

def profile_max(P0, P1, ye, Dm, K=64):
    """The steepest sight line from each eye to any ground on the way to its target (rise over run, the curve allowed for)."""
    best = np.full(len(P0), -9.0)
    for k in range(1, K):
        u = k/K; s = Dm*u; ok = s < Dm - 10
        q = unit(P0*(1 - u) + P1*u); m = (heights(q) - s*s/(2*RE) - ye)/np.maximum(s, 1)
        best = np.where(ok, np.maximum(best, m), best)
    return best

# ---- which things show from which viewpoint
dots = np.clip(POS @ FD.T, -1, 1); DIST = R*np.arccos(dots)
toF = FD[None, :, :] - POS[:, None, :]*dots[:, :, None]; toF /= np.maximum(np.linalg.norm(toF, axis=2, keepdims=True), 1e-9)
BEAR = np.degrees(np.arctan2((toF*EAST[:, None, :]).sum(2), (toF*HEAD[:, None, :]).sum(2)))     # 0 dead ahead, + to the right
cand = (DIST <= FAR) & (np.abs(BEAR) <= FRAME) & (DIST > 6)
vi, fi = np.nonzero(cand); Dm = DIST[vi, fi]
occ = profile_max(POS[vi], FD[fi], YE[vi], Dm)
top = (FG[fi] + FH[fi] - Dm*Dm/(2*RE) - YE[vi])/Dm; base = (FG[fi] - Dm*Dm/(2*RE) - YE[vi])/Dm
shown = np.degrees(np.maximum(0, top - np.maximum(base, occ)))       # degrees of the thing standing clear
SHOW = np.zeros(DIST.shape); SHOW[vi, fi] = shown
ahead = (SHOW >= SEEN) & (np.abs(BEAR) <= AHEAD); frame = SHOW >= SEEN
side = (DIST <= NEAR) & (np.abs(BEAR) <= 100)
n_ahead = ahead.sum(1); n_frame = frame.sum(1); n_side = side.sum(1)

# ---- the skyline ahead: how high the far ground stands, and how far the player can see along the trail's heading
def march(off_deg):
    c, s_ = math.cos(math.radians(off_deg)), math.sin(math.radians(off_deg)); dirv = HEAD*c + EAST*s_
    best = np.full(NV, -9.0); far_best = np.full(NV, -9.0); reach = np.zeros(NV)
    for s in np.arange(20, FAR + 1, 15.0):
        q = unit(POS*math.cos(s/R) + dirv*math.sin(s/R)); m = (heights(q) - s*s/(2*RE) - YE)/s
        vis = m >= best - 1e-4; reach = np.where(vis, s, reach); best = np.maximum(best, m)
        if s >= 80: far_best = np.where(vis, np.maximum(far_best, m), far_best)
    return np.degrees(far_best), reach
sk = [march(o) for o in (-16, -8, 0, 8, 16)]
SKY = np.median(np.array([a for a, _ in sk]), 0); REACH = np.median(np.array([b for _, b in sk]), 0)
vista = SKY >= VISTA

# ---- the summit: the planet's tallest thing. from how much of the ride does its top 30 m show at all, and on screen?
pk = V[int(np.argmax(hg))]; PKH = float(hg.max()); dpk = R*np.arccos(np.clip(POS @ pk, -1, 1)); okp = (dpk > 40) & (dpk < 1500)
# (the summit is ground, not a prop: it shows when the highest sight line towards it lands on its top 30 m)
def skyline_ground(P0, P1, ye, Dm, K=96):
    best = np.full(len(P0), -9.0); hb = np.zeros(len(P0))
    for k in range(1, K + 1):
        u = k/K; s = Dm*u; hq = heights(unit(P0*(1 - u) + P1*u)); m = (hq - s*s/(2*RE) - ye)/np.maximum(s, 1)
        up = m > best; best = np.where(up, m, best); hb = np.where(up, hq, hb)
    return hb
hgp = skyline_ground(POS[okp], np.repeat(pk[None, :], okp.sum(), 0), YE[okp], dpk[okp])
PEAK_SHOW = np.zeros(NV); PEAK_SHOW[okp] = (hgp >= PKH - 30)*1.0
tp = pk[None, :] - POS*(POS @ pk)[:, None]; tp = unit(tp); pbear = np.degrees(np.arctan2((tp*EAST).sum(1), (tp*HEAD).sum(1)))
PEAK_ANY = float((PEAK_SHOW >= 0.5).mean()); PEAK_FRAME = float(((PEAK_SHOW >= 0.5) & (np.abs(pbear) <= FRAME)).mean())

CLASS = np.where(n_ahead > 0, 0, np.where(n_frame > 0, 1, np.where(n_side > 0, 2, np.where(vista, 3, 4))))
CNAME = ["landmark dead ahead", "landmark on screen", "trailside prop only", "mountain view only", "bare"]

# ---- stretches: bare runs, and runs where nothing new comes on screen
def ll(d): lo, la = ll_of(d); return [round(lo, 2), round(la, 2)]
def ahead_point(p, hd, m): return unit((p*math.cos(m/R) + hd*math.sin(m/R))[None, :])[0]
runs_bare, runs_stale, per_trail, crests = [], [], [], []
i0 = 0
for t in TR:
    for dr in (1, -1):
        idx = np.arange(i0, i0 + t["n"]); i0 += t["n"]
        if dr == -1: idx = idx[::-1]                # in the order the player meets them
        c = CLASS[idx]; label = "%s, %s" % (t["name"], "forwards" if dr == 1 else "backwards")
        # bare runs
        k = 0; longest = 0
        while k < len(c):
            if c[k] != 4: k += 1; continue
            j = k
            while j < len(c) and c[j] == 4: j += 1
            L = (j - k)*STEP; longest = max(longest, L)
            if L >= BARE_MIN:
                a, mid = idx[k], idx[(k + j)//2]
                tgt = ahead_point(POS[mid], HEAD[mid], 160)
                runs_bare.append(dict(trail=t["name"], dir=dr, zone=t["zone"], frm=round(float(VP[a][2])), metres=L, seconds=round(L/SPEED), start=ll(POS[a]), mid=ll(POS[mid]),
                                      heading=round(float(np.degrees(np.arctan2(np.dot(HEAD[mid], np.cross([0, 1, 0], POS[mid])/np.linalg.norm(np.cross([0, 1, 0], POS[mid]))), np.dot(HEAD[mid], np.cross(POS[mid], np.cross([0, 1, 0], POS[mid]))/np.linalg.norm(np.cross([0, 1, 0], POS[mid])))))) % 360),
                                      aim=ll(tgt), aim_slope=round(float(slope(tgt)), 2), skyline=round(float(SKY[mid]), 1), pts=[ll(POS[v]) for v in idx[k:j:3]]))
            k = j
        # nothing-new runs: metres since something came on screen that was not there a moment ago
        seen_prev = set(); since = 0.0; start = 0; worst = 0
        for n_, v in enumerate(idx):
            now = set(np.nonzero(frame[v] | side[v])[0])
            if now - seen_prev:
                if since >= STALE_MIN: runs_stale.append(dict(trail=t["name"], dir=dr, zone=t["zone"], frm=round(float(VP[idx[start]][2])), metres=since, seconds=round(since/SPEED), start=ll(POS[idx[start]])))
                worst = max(worst, since); since = 0.0; start = n_
            else: since += STEP
            seen_prev = now
        if since >= STALE_MIN: runs_stale.append(dict(trail=t["name"], dir=dr, zone=t["zone"], frm=round(float(VP[idx[start]][2])), metres=since, seconds=round(since/SPEED), start=ll(POS[idx[start]])))
        worst = max(worst, since)
        # crests and openings: the view along the heading jumps out by 150 m or more within 30 m of travel
        r = REACH[idx]
        for n_ in range(3, len(idx)):
            if r[n_] - r[n_ - 3] >= 150 and (not crests or crests[-1]["_k"] != (label, n_ - 1)) and all(r[n_] >= r[max(0, n_ - 3):n_ + 1]):
                v = idx[n_]; inline = np.nonzero((np.abs(BEAR[v]) <= 8) & (DIST[v] <= 600) & (DIST[v] > 30))[0]
                vis = [FEAT[f]["name"] for f in inline if SHOW[v, f] >= SEEN]
                if crests and crests[-1]["trail"] == t["name"] and crests[-1]["dir"] == dr and abs(crests[-1]["at"] - float(VP[v][2])) < 60: continue
                crests.append(dict(_k=(label, n_), trail=t["name"], dir=dr, zone=t["zone"], at=round(float(VP[v][2])), where=ll(POS[v]), opens_to=round(float(r[n_])), skyline=round(float(SKY[v]), 1),
                                   sees=vis, hidden_in_line=[FEAT[f]["name"] for f in inline if SHOW[v, f] < SEEN], aim=ll(ahead_point(POS[v], HEAD[v], 180))))
        share = [round(float((c == q).mean()), 3) for q in range(5)]
        per_trail.append(dict(trail=t["name"], dir=dr, zone=t["zone"], metres=round(t["length"]), share=share, longest_bare=longest, longest_nothing_new=worst))
for c in crests: c.pop("_k")

# ---- the report
tot = np.array([(CLASS == q).mean() for q in range(5)])
zones = {}
for p in per_trail:
    z = zones.setdefault(str(p["zone"]), dict(metres=0, w=np.zeros(5))); z["metres"] += p["metres"]/2; z["w"] += np.array(p["share"])*p["metres"]/2
runs_bare.sort(key=lambda r: -r["metres"]); runs_stale.sort(key=lambda r: -r["metres"])
empty_crests = [c for c in crests if not c["sees"]]
out = dict(settings=dict(eye=EYE, drawn_radius=RE, far=FAR, step=STEP, ahead=AHEAD, frame=FRAME, seen_deg=SEEN, near=NEAR, vista_deg=VISTA, speed=SPEED),
           summit=dict(height=round(PKH), visible_any=round(PEAK_ANY, 3), on_screen=round(PEAK_FRAME, 3)), classes=CNAME, overall=[round(float(x), 3) for x in tot],
           zones={k: dict(metres=round(z["metres"]), share=[round(float(x), 3) for x in z["w"]/max(1, z["metres"])]) for k, z in zones.items()},
           trails=per_trail, bare=runs_bare, nothing_new=runs_stale, crests=crests,
           features=[dict(name=f["name"], kind=f["kind"], at=ll(f["d"]), height=f["H"], seen_from=int(frame[:, k].sum()), ahead_from=int(ahead[:, k].sum())) for k, f in enumerate(FEAT)])
json.dump(out, open(OUT + ".json", "w"), indent=1)

pct = lambda x: "%d%%" % round(100*x)
md = ["# v2 view audit", "",
      "Generated by `tools/world/audit_views.py`. Do not edit by hand: run the tool again after changing the world.", "",
      "The tool rides every trail in both directions and, every %d m, works out what is on screen ahead of the skier: which props and landmarks stand clear of the ground and the planet's curve, how high the far skyline is, how far the view runs." % STEP,
      "It does not know about the woods, the sky or the weather.", "",
      "## Overall", "", "%d m of trail, %d viewpoints, %d things to see." % (round(sum(t["length"] for t in TR)), NV, len(FEAT)), "",
      "| What is on screen | Share of the ride |", "|---|---|"] + ["| %s | %s |" % (CNAME[q], pct(tot[q])) for q in range(5)] + ["",
      "The summit (%d m, the tallest thing on the planet) shows over the curve from %s of the ride if the skier turned to look, and is on screen for %s of it." % (round(PKH), pct(PEAK_ANY), pct(PEAK_FRAME)), "",
      "With the camera %.1f m up and the planet drawn %d m across, level ground drops out of sight %d m away; a 60 m ridge is gone by %d m and a 15 m prop by %d m." % (EYE, round(RE), round(math.sqrt(2*RE*EYE)), round(math.sqrt(2*RE*EYE) + math.sqrt(2*RE*60)), round(math.sqrt(2*RE*EYE) + math.sqrt(2*RE*15))), "",
      "## By zone", "", "| Zone | Trail | Landmark ahead | On screen | Trailside only | Mountains only | Bare |", "|---|---|---|---|---|---|---|"]
for k, z in sorted(out["zones"].items()): md.append("| %s | %d m | %s |" % (k, z["metres"], " | ".join(pct(x) for x in z["share"])))
md += ["", "## Longest bare stretches", "", "Nothing on screen but snow and a low horizon. `Aim` is a point 160 m ahead of the middle of the stretch on the skier's heading: a tall landmark there (or further along that line) would be dead ahead for the whole stretch.", "",
       "| Trail | Way | From | Length | About | Zone | Middle (lon, lat) | Heading | Aim (lon, lat) |", "|---|---|---|---|---|---|---|---|---|"]
for r in runs_bare[:40]: md.append("| %s | %s | %d m | %d m | %d s | %s | %s, %s | %d° | %s, %s |" % (r["trail"], "fwd" if r["dir"] == 1 else "back", r["frm"], r["metres"], r["seconds"], r["zone"], r["mid"][0], r["mid"][1], r["heading"], r["aim"][0], r["aim"][1]))
md += ["", "%d bare stretches of %d m or more in all, %d m between them (both directions counted)." % (len(runs_bare), BARE_MIN, sum(r["metres"] for r in runs_bare)), "",
       "## Longest stretches with nothing new", "", "Something may be on screen, but nothing has come into view that was not already there.", "",
       "| Trail | Way | From | Length | About | Zone |", "|---|---|---|---|---|---|"]
for r in runs_stale[:25]: md.append("| %s | %s | %d m | %d m | %d s | %s |" % (r["trail"], "fwd" if r["dir"] == 1 else "back", r["frm"], r["metres"], r["seconds"], r["zone"]))
md += ["", "## Crests and openings with nothing to look at", "", "Places where the view along the trail suddenly runs out 150 m or more further. These are the natural spots for a reveal; the ones listed have no landmark standing within 8° of the heading.", "",
       "| Trail | Way | At | Zone | Where (lon, lat) | View runs to | Hidden on that line | Aim (lon, lat) |", "|---|---|---|---|---|---|---|---|"]
for c in sorted(empty_crests, key=lambda c: -c["opens_to"])[:40]: md.append("| %s | %s | %d m | %s | %s, %s | %d m | %s | %s, %s |" % (c["trail"], "fwd" if c["dir"] == 1 else "back", c["at"], c["zone"], c["where"][0], c["where"][1], c["opens_to"], ", ".join(c["hidden_in_line"][:3]) or "nothing", c["aim"][0], c["aim"][1]))
md += ["", "%d crests and openings found, %d with a landmark already in line, %d without." % (len(crests), len(crests) - len(empty_crests), len(empty_crests)), "",
       "## Things nobody sees", "", "Props and landmarks that are on screen from fewer than 5 viewpoints (50 m of riding, either way).", ""]
md += ["- %s (%s) at %s, %s: seen from %d viewpoints" % (f["name"], f["kind"], f["at"][0], f["at"][1], f["seen_from"]) for f in sorted(out["features"], key=lambda f: f["seen_from"]) if f["seen_from"] < 5] or ["None."]
md += ["", "## Per trail", "", "| Trail | Way | Zone | Length | Landmark ahead | On screen | Trailside | Mountains | Bare | Longest bare | Longest nothing new |", "|---|---|---|---|---|---|---|---|---|---|---|"]
for p in sorted(per_trail, key=lambda p: -p["share"][4]*p["metres"]): md.append("| %s | %s | %s | %d m | %s | %d m | %d m |" % (p["trail"], "fwd" if p["dir"] == 1 else "back", p["zone"], p["metres"], " | ".join(pct(x) for x in p["share"]), p["longest_bare"], p["longest_nothing_new"]))
open(OUT + ".md", "w").write("\n".join(md) + "\n")

# ---- the map: trails coloured by what is on screen (the worse of the two directions), landmarks, aim points
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(22, 11)); lon_e = [-180, 180, -90, 90]
ax.imshow(h_full, extent=lon_e, cmap="Greys", alpha=0.55, vmin=-40, vmax=190, aspect="auto")
ax.contourf(np.linspace(-180, 180, W), np.linspace(90, -90, H), (s_full > STOP).astype(float), levels=[0.5, 1.5], colors=["#5b6b7a"], alpha=0.35)
COL = ["#1a9850", "#91cf60", "#d9c84a", "#6baed6", "#d73027"]
# pair the two directions of each viewpoint: worst class wins
i0 = 0
for t in TR:
    a = np.arange(i0, i0 + t["n"]); b = a + t["n"]; i0 += 2*t["n"]
    w = np.maximum(CLASS[a], CLASS[b]); L = np.array([ll_of(p) for p in POS[a]])
    for q in range(5):
        m = w == q
        if m.any(): ax.scatter(L[m, 0], L[m, 1], s=7, c=COL[q], linewidths=0, zorder=3)
for f in FEAT:
    lo, la = ll_of(f["d"]); ax.plot(lo, la, "^", ms=3 + min(8, f["H"]/4), mfc="none", mec="k", mew=0.7, zorder=4)
for r in runs_bare[:40]: ax.plot(r["aim"][0], r["aim"][1], "x", c="#d73027", ms=7, zorder=5)
for c in empty_crests: ax.plot(c["where"][0], c["where"][1], "o", mfc="none", mec="#7b3fe0", ms=9, mew=1.2, zorder=5)
import matplotlib.patches as mp
ax.legend(handles=[mp.Patch(color=COL[q], label=CNAME[q]) for q in range(5)] + [plt.Line2D([], [], marker="^", ls="", mfc="none", mec="k", label="prop or landmark (size = height)"),
          plt.Line2D([], [], marker="x", ls="", c="#d73027", label="aim point for a bare stretch"), plt.Line2D([], [], marker="o", ls="", mfc="none", mec="#7b3fe0", label="crest or opening with nothing in line")], loc="lower left", fontsize=10)
ax.set_title("v2 view audit: what is on screen along each trail (the worse of the two directions)"); ax.set_xlabel("longitude"); ax.set_ylabel("latitude")
plt.tight_layout(); plt.savefig(OUT + ".png", dpi=80)
print("overall:", ", ".join("%s %s" % (CNAME[q], pct(tot[q])) for q in range(5)))
print(len(runs_bare), "bare stretches;", len(runs_stale), "nothing-new stretches;", len(crests), "crests,", len(empty_crests), "with nothing in line")
