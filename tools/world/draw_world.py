# The world map: the planet's ground, zones tinted, trails, bridges, gates, terminals, props.
import sys; from geo import *
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
A = json.load(open(os.path.join(WORK, "additions.json"))); TRS = json.load(open(os.path.join(WORK, "alltrails.json"))); zl = np.load(os.path.join(WORK, "zl.npy")); Z = json.load(open(os.path.join(WORK, "zones.json")))
out = sys.argv[1]; label = len(sys.argv) > 2 and sys.argv[2] == "names"
ZC = {"1": "#f2b84b", "2": "#7fb6e6", "3": "#8fd19a", "4": "#c9a3e8", "E": "#e88f8f"}
fig, ax = plt.subplots(figsize=(22, 11.4), dpi=110)
ls = LightSource(azdeg=315, altdeg=45); sh = ls.hillshade(np.clip(hg, -80, 190), vert_exag=0.5, dx=4, dy=4)
img = np.ones((Hg, Wg, 3))*0.93
for k, c in ZC.items(): img[zl == Z[k]] = matplotlib.colors.to_rgb(c)
img[sg > STOP] = (0.42, 0.44, 0.47); img = img*(0.55 + 0.45*sh[..., None])
ax.imshow(img, extent=[-180, 180, -90, 90], aspect="auto")
def plot(pts, **kw):
    p = np.array([ll_of(q) for q in pts]); brk = np.where(np.abs(np.diff(p[:, 0])) > 180)[0] + 1
    for seg in np.split(p, brk): ax.plot(seg[:, 0], seg[:, 1], **kw)
    return p
for t in TRS:
    pts = t["pts"] + ([t["pts"][0]] if t["closed"] else []); p = plot(pts, color="#c0392b" if t["new"] else "#1d2a36", lw=1.5 if t["new"] else 1.2, zorder=4)
    if label: m = p[len(p)//2]; ax.text(m[0], m[1], t["name"].replace("Trail ", "T"), fontsize=6.5, color="#1d2a36", bbox=dict(fc="white", ec="none", alpha=0.75, pad=0.6), zorder=8)
for b in A["bridges"]: plot(b["pts"], color="#ffd400" if b["kind"] == "light" else "#ff7a00", lw=4.5, zorder=5, solid_capstyle="butt")
MK = {"kiosk": ("s", "#6a3fc0", 70), "gate": ("D", "#111", 70), "crystalgate": ("D", "#a13fd6", 80), "mineportal": ("v", "#b0362a", 110), "observatory": ("*", "#c79a1e", 260), "circle": ("h", "#a13fd6", 120), "giant": ("p", "#7b3fe0", 140)}
for m in A["models"]:
    lo, la = ll_of(m["d"]); mk = MK.get(m["id"])
    if mk: ax.scatter([lo], [la], marker=mk[0], c=mk[1], s=mk[2], edgecolors="white", linewidths=0.8, zorder=7)
    elif m["id"] not in ("post", "altar"): ax.scatter([lo], [la], marker="o", c="#555", s=14, edgecolors="white", linewidths=0.4, zorder=6)
    if label and m["id"] not in ("shard", "outcrop", "post", "altar"): ax.text(lo + 1, la + 1, m["name"], fontsize=6, color="#333", zorder=8)
c = np.array([ll_of(q) for q in A["game"]["crystals"]]); 
if len(c): ax.scatter(c[:, 0], c[:, 1], marker="d", c="#d05cff", s=22, edgecolors="white", linewidths=0.4, zorder=7)
lo, la = ll_of(A["start"]["d"]); ax.scatter([lo], [la], marker="*", c="white", s=320, edgecolors="black", zorder=9)
if A["game"].get("starway"): plot([A["game"]["starway"]["foot"], A["game"]["starway"]["top"]], color="#c79a1e", lw=2.5, ls=(0, (2, 2)), zorder=5)
ax.set_xticks(range(-180, 181, 30)); ax.set_yticks(range(-90, 91, 15)); ax.grid(color="white", alpha=0.25, lw=0.5); ax.tick_params(labelsize=8)
if not label:
    G = {g["name"]: ll_of(g["d"]) for g in A["game"]["gates"] if g["d"]}; Bm = {b["name"]: ll_of(norm(np.array(b["pts"][0]) + np.array(b["pts"][-1]))) for b in A["bridges"]}
    Mm = {m["name"]: ll_of(m["d"]) for m in A["models"]}
    def tag(xy, text, dx, dy, fc="white"):
        ax.annotate(text, xy=xy, xytext=(xy[0] + dx, xy[1] + dy), fontsize=9.5, weight="bold", ha="center", va="center", zorder=12, bbox=dict(fc=fc, ec="#1d2a36", lw=0.8, pad=2.5, alpha=0.95), arrowprops=dict(arrowstyle="-", color="#1d2a36", lw=0.9))
    tag(ll_of(A["start"]["d"]), "1  START · the Bowl\n2 terminals", 4, 13, ZC["1"])
    tag(G["East gate"], "East gate", 19, 4); tag(G["North gate"], "North gate", 10, 6)
    tag(Bm["West drawbridge"], "2  West drawbridge", -4, 9, "#ffc78f"); tag(Bm["East drawbridge"], "2  East drawbridge", -14, -8, "#ffc78f")
    tag(G["Mine portal"], "4  MINE (down the pit)\n8  crown door", 17, 12, "#f4c9c2")
    tag(Bm["Highland bridge"], "5  Highland bridge\nto the crystal search", -22, 3, "#ffe680")
    tag(G["Crystal gate"], "6  Crystal gate\n+ Crystal bridge", 14, 9, "#ffe680")
    tag(G["South pass gate"], "South pass gate\n(opens from zone 4)", 17, 7)
    tag(Mm["The Broken Circle"], "7  Broken Circle\naltar · moose puzzle", 18, -9, ZC["4"]); tag(Mm["The sleeping giant"], "the sleeping giant", -2, -10, ZC["4"])
    tag(Mm["The observatory"], "9  Starway to\nthe observatory", 4, 11, "#f3dc8c")
    for xy, t in (((0, 68), "ZONE 2 · HOME PLAIN  (3 terminals)"), ((-118, 30), "ZONE 3 · FAR PLAIN\n(3 terminals)"), ((150, -20), "ZONE 3"), ((135, -84), "ZONE 4 · SOUTH PLAIN"), ((-2, -52), "HIGHLANDS")):
        ax.text(*xy, t, fontsize=11, weight="bold", color="#1d2a36", ha="center", va="center", zorder=11, alpha=0.9)
import matplotlib.lines as ml, matplotlib.patches as mp
H_ = [mp.Patch(fc=ZC["1"], label="Zone 1 · the Bowl"), mp.Patch(fc=ZC["2"], label="Zone 2 · home plain"), mp.Patch(fc=ZC["3"], label="Zone 3 · far plain"), mp.Patch(fc=ZC["E"], label="Highlands · crystal search"), mp.Patch(fc=ZC["4"], label="Zone 4 · south plain"), mp.Patch(fc="#6b7078", label="too steep to ski"),
      ml.Line2D([], [], color="#1d2a36", lw=1.5, label="your trails"), ml.Line2D([], [], color="#c0392b", lw=1.8, label="new trails"), ml.Line2D([], [], color="#ff7a00", lw=4, label="drawbridge"), ml.Line2D([], [], color="#ffd400", lw=4, label="light bridge"),
      ml.Line2D([], [], marker="s", ls="", mfc="#6a3fc0", mec="white", ms=8, label="terminal"), ml.Line2D([], [], marker="D", ls="", mfc="#111", mec="white", ms=8, label="gate"), ml.Line2D([], [], marker="v", ls="", mfc="#b0362a", mec="white", ms=10, label="mine"), ml.Line2D([], [], marker="d", ls="", mfc="#d05cff", mec="white", ms=7, label="crystal")]
fig.legend(handles=H_, loc="lower center", ncol=7, frameon=False, fontsize=10, bbox_to_anchor=(0.5, 0.0))
ax.set_title("Skate Ski v2 world on your planet (flat map of the whole globe: the top and bottom edges are stretched sideways)", fontsize=12)
fig.tight_layout(rect=[0, 0.055, 1, 1]); fig.savefig(out)
