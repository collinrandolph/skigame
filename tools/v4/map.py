import sys, json, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "world"))
from geo import *
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
L = json.load(open(os.path.join(WORK, "v4layout.json"))); zl = np.load(os.path.join(WORK, "zl.npy")); Z = json.load(open(os.path.join(WORK, "zones.json")))
fig, ax = plt.subplots(figsize=(24, 12)); ax.imshow(h_full, extent=[-180, 180, -90, 90], cmap='Greys', vmin=-40, vmax=190, aspect='auto', alpha=0.6)
col = {"1": "#e41a1c", "2": "#377eb8", "3": "#4daf4a", "4": "#984ea3", "E": "#ff7f00"}
for k, v in Z.items(): ax.contourf(np.linspace(-180, 180, zl.shape[1]), np.linspace(90, -90, zl.shape[0]), (zl == v).astype(float), levels=[0.5, 1.5], colors=[col[k]], alpha=0.16)
for t in L["trails"]:
    p = np.array(t["pts"], float); brk = np.abs(np.diff(p[:, 0])) > 180; p[1:][brk] = np.nan; ax.plot(p[:, 0], p[:, 1], '-', c=col[t["z"]], lw=1.8)
    ax.text(np.nanmean(p[:, 0]), np.nanmean(p[:, 1]), t["name"], fontsize=7, ha='center')
o = L["out"]
for g in o["gates"]: ax.plot(*g["at"], 'ks', ms=7); ax.text(g["at"][0] + 1, g["at"][1] + 1, g["name"], fontsize=8, weight='bold')
for b in o["draws"] + o["lights"]: ax.plot([b["a"][0], b["b"][0]], [b["a"][1], b["b"][1]], 'm-', lw=3); ax.text(b["a"][0], b["a"][1] + 1.5, b["name"], fontsize=8, color='m')
ax.plot(*o["mine"]["portal"], 'k^', ms=10); ax.plot(*o["court"], 'y*', ms=14, mec='k'); ax.plot(*o["summit"], 'r^', ms=12); ax.plot(*o["start"], 'go', ms=9)
plt.tight_layout(); plt.savefig(sys.argv[1], dpi=60)
