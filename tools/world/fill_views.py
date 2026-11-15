# Turn the view audit's bare stretches into scenery wishes. Run after audit_views.py; it appends to scenery.json, and the
# next build places what fits. Repeat build > audit > fill until the audit stops improving (see V2-HANDOFF.md).
#
#   python3 fill_views.py ../../planets/v2-view-audit.json
#
# For each bare stretch: one tall landmark on the skier's heading (so it is dead ahead for the stretch), and a small
# prop beside the trail every SPACING metres. Each zone has its own kit, so the zones look different.
import sys
from geo import *
AUD = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "../../planets/v2-view-audit.json"))
SCN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenery.json")
have = json.load(open(SCN)) if os.path.exists(SCN) else []
zl = np.load(os.path.join(WORK, "zl.npy")).ravel(); Z = json.load(open(os.path.join(WORK, "zones.json"))); ZN = {v: k for k, v in Z.items()}
SPACING = 90.0; ROUND = 1 + max([e.get("round", 0) for e in have], default=0)

# (id, scale): tall ones stand 20 m or more so they show from 330 m and further; small ones are trailside texture
KIT = {
    "1": dict(tall=[("outcrop", 4), ("shard", 3.5)], small=[("shard", 1), ("outcrop", 1), ("weather", 1)]),
    "2": dict(tall=[("tower", 1), ("comms", 1.7), ("signal", 1.7), ("plant", 1.2), ("outcrop", 4.5)], small=[("weather", 1), ("solar", 1), ("camp", 1), ("fuel", 1), ("haul", 1), ("outcrop", 1), ("beacon", 1)]),
    "3": dict(tall=[("watcher", 2), ("arch", 3), ("shard", 4), ("outcrop", 5)], small=[("shard", 1), ("watcher", 0.6), ("outcrop", 1.2), ("arch", 1), ("shard", 1.6)]),
    "4": dict(tall=[("shard", 4.5), ("outcrop", 5), ("watcher", 2.2)], small=[("shard", 1.2), ("outcrop", 1), ("moose", 1)]),
    "E": dict(tall=[("shard", 4), ("outcrop", 4)], small=[("shard", 1), ("outcrop", 1)]),
}
def near(lo, la, m, kind=None):
    c = d_of(lo, la)
    return any(dist(c, d_of(e["lon"], e["lat"])) < m for e in have if kind is None or e.get("kind") == kind)
added = dict(tall=0, small=0)
for r in AUD["bare"]:
    z = str(r["zone"])
    if z not in KIT: continue
    k = KIT[z]
    # the landmark: at the aim point if that is ground in some zone, else as near it as the stretch's own zone comes
    lo, la = r["aim"]; za = ZN.get(int(zl[node(d_of(lo, la))]), z)
    if not near(lo, la, 140, "tall"):
        mid, sc = k["tall"][(len(have) + r["frm"]) % len(k["tall"])] if za == z else KIT.get(za, k)["tall"][len(have) % len(KIT.get(za, k)["tall"])]
        have.append(dict(id=mid, scale=sc, lon=lo, lat=la, zone=za, reach=130, off=30, far=200, kind="tall", round=ROUND, why="%s %s from %d m: bare for %d m" % (r["trail"], "fwd" if r["dir"] == 1 else "back", r["frm"], r["metres"])))
        added["tall"] += 1
    # trailside props along it (the audit lists the stretch every 30 m)
    for i in range(1, len(r["pts"]), max(1, round(SPACING/30))):
        lo, la = r["pts"][i]
        if near(lo, la, 55): continue
        mid, sc = k["small"][(len(have) + i) % len(k["small"])]
        have.append(dict(id=mid, scale=sc, lon=lo, lat=la, zone=z, reach=45, far=30, kind="small", round=ROUND, why="beside %s" % r["trail"]))
        added["small"] += 1
# crests and openings with nothing in line: a landmark 180 m on, where the view opens to
for c in AUD["crests"]:
    z = str(c["zone"])
    if c["sees"] or z not in KIT: continue
    lo, la = c["aim"]; za = ZN.get(int(zl[node(d_of(lo, la))]), z)
    if near(lo, la, 110, "tall"): continue
    kk = KIT.get(za, KIT[z])["tall"]; mid, sc = kk[(len(have) + c["at"]) % len(kk)]
    have.append(dict(id=mid, scale=sc, lon=lo, lat=la, zone=za, reach=90, off=30, far=200, kind="tall", round=ROUND, why="crest on %s %s at %d m" % (c["trail"], "fwd" if c["dir"] == 1 else "back", c["at"])))
    added["tall"] += 1
json.dump(have, open(SCN, "w"), indent=0)
print("round %d: %d landmarks and %d trailside props wished for; scenery.json now lists %d" % (ROUND, added["tall"], added["small"], len(have)))
