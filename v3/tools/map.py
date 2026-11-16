import json, sys, numpy as np, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
d = json.load(open(sys.argv[1])); h = np.array(d['h']).reshape(d['Hd'], d['Wd'])
fig, ax = plt.subplots(figsize=(22, 11)); im = ax.imshow(h, extent=[-180, 180, -90, 90], cmap='terrain', vmin=-20, vmax=150, aspect='auto'); plt.colorbar(im, shrink=0.6)
t = np.array(d['trees']); ax.plot(t[:, 0], t[:, 1], ',', c='#0b3d1a')
for tr in d['trails']:
    p = np.array(tr['pts']); brk = np.abs(np.diff(p[:, 0])) > 180; p = p.astype(float); p[1:][brk] = np.nan
    ax.plot(p[:, 0], p[:, 1], 'k-', lw=1.6); ax.text(np.nanmean(p[:, 0]), np.nanmax(p[:, 1]) + 1.5, tr['name'], fontsize=9, ha='center')
b = np.array(d['bridge']); ax.plot(b[:, 0], b[:, 1], 'm-', lw=1.5)
seen = set()
for s in d['sites']:
    ax.plot(*s['at'], 'r^' if s['kind'] != 'relay' else 'y*', ms=5 if s['kind'] != 'relay' else 12, mec='k')
    if s['name'] not in seen: seen.add(s['name']); ax.text(s['at'][0] + 1, s['at'][1] + 1, s['name'], fontsize=7, color='#600')
ax.plot(*d['start'], 'go', ms=9); plt.tight_layout(); plt.savefig(sys.argv[2], dpi=60)
