# The underground, in plan round the deep pit: the spiral ramp, its two doors, and each layer's tunnels and chambers.
import sys; from geo import *
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.patches import Circle
B = json.load(open(os.path.join(WORK, "built.json"))); A = json.load(open(os.path.join(WORK, "additions.json"))); REF = json.load(open(os.path.join(WORK, "lines.json"))); RP = json.load(open(os.path.join(WORK, "report.json")))
TRS = json.load(open(os.path.join(WORK, "alltrails.json")))
pit = norm(REF["stamps"][0]["pts"][0]); a0 = np.array([0, 1, 0.]); e = norm(np.cross(a0, pit)); n = np.cross(pit, e)
def xy(d): d = norm(d); ang_ = math.acos(max(-1, min(1, float(d @ pit)))); t = d - pit*(d @ pit); l = np.linalg.norm(t) or 1; return R*ang_*float(t @ e)/l, R*ang_*float(t @ n)/l
S = 440; g = np.linspace(-S, S, 221); Hm = np.array([[height(norm(pit*math.cos(math.hypot(x, y)/R) + (e*x + n*y)/max(1e-9, math.hypot(x, y))*math.sin(math.hypot(x, y)/R))) for x in g] for y in g])
fig, ax = plt.subplots(figsize=(11.5, 11.5), dpi=120); ax.set_aspect("equal")
ax.contourf(g, g, Hm, levels=[-260, -200, -170, -130, -90, -50, -20, 0, 15, 30, 60], cmap="Greys_r", alpha=0.55)
cs = ax.contour(g, g, Hm, levels=[-170, -90, 0], colors=["#7a1f6e", "#b0362a", "#1d2a36"], linewidths=1.0, linestyles="--"); ax.clabel(cs, fmt={-170: "170 m down", -90: "90 m down", 0: "ground level"}, fontsize=8)
for t in TRS:
    p = np.array([xy(q) for q in t["pts"] if R*ang(norm(q), pit) < S*1.5])
    if len(p) > 1: ax.plot(p[:, 0], p[:, 1], color="#1d2a36", lw=1.3, alpha=0.8)
rp = np.array([xy(q) for q in B["ramp"]]); ax.plot(rp[:, 0], rp[:, 1], color="#e08a00", lw=3.2, solid_capstyle="round", zorder=5); ax.plot(*rp[0], "v", color="#e08a00", ms=13, mec="k", zorder=6)
COL = {0: "#b0362a", 1: "#7a1f6e"}; U = A["game"].get("underground") or json.load(open(sys.argv[2]))["game"]["underground"]
for c in B["stamps"]:
    x, y = xy(c["d"])
    if c["type"] == "chamber": ax.add_patch(Circle((x, y), c["radius"], fc=COL[c["layer"]], ec="k", lw=0.8, alpha=0.35, zorder=4))
    else: ax.add_patch(Circle((x, y), c["radius"], fc="#333", ec="none", zorder=6))
for t in B["tunnels"]:
    p = np.array([xy(q) for q in t["pts"]]); ax.plot(p[:, 0], p[:, 1], color=COL[t["layer"]], lw=5, alpha=0.75, solid_capstyle="round", zorder=5)
    m = p[len(p)//2]; ax.text(m[0], m[1], t["name"], fontsize=7.5, ha="center", va="center", zorder=9, bbox=dict(fc="white", ec="none", alpha=0.8, pad=0.8))
def tag(d, text, dx, dy, fc="white"): x, y = xy(d); ax.annotate(text, xy=(x, y), xytext=(x + dx, y + dy), fontsize=9.5, weight="bold", ha="center", va="center", zorder=12, bbox=dict(fc=fc, ec="#1d2a36", lw=0.8, pad=2.5), arrowprops=dict(arrowstyle="-", color="#1d2a36", lw=0.9))
tag(B["ramp"][0], "MINE PORTAL\nramp starts", -8, -42, "#ffd9a0")
tag(U["mineDoor"]["d"], "Mine door\n(90 m down)", 55, 28, "#f4c9c2"); tag(U["teleporter"]["d"], "TELEPORTER HALL", 20, 52, "#f4c9c2"); tag(U["crystalAltar"]["d"], "ALTAR CAVE\ncrystal altar", -70, 40, "#f4c9c2"); tag(U["oreBay"]["d"], "ore bay", 40, -30, "#f4c9c2")
tag(U["crownDoor"]["d"], "CROWN DOOR\n(170 m down)", -62, -30, "#e6cfe2"); tag(U["crownRoom"]["d"], "CROWN ROOM", 95, 10, "#e6cfe2")
ax.plot(0, 0, "x", color="k", ms=9); ax.text(0, -14, "pit floor\n250 m down", ha="center", va="top", fontsize=8)
ax.set_xlim(-S, S); ax.set_ylim(-S, S); ax.set_xlabel("metres"); ax.set_ylabel("metres")
ax.set_title("The underground, seen from above the deep pit (drawn at surface scale: the deeper layer is really about 30% smaller)\norange: the spiral ramp (1.5 km, 12%) · red: layer 1, the mine · purple: layer 2, the deep · black: surface trails", fontsize=11)
fig.tight_layout(); fig.savefig(sys.argv[1])
