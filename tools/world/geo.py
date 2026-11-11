# Shared geometry for the v2 world builder: the reference planet's ground on a lon/lat grid, and a routing graph over it.
# Run sample_terrain.js first: it writes h.f32 (heights, 1728 x 864) and lines.json into the work directory.
import numpy as np, math, json, os
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra, connected_components
WORK = os.environ.get("WORLD_WORK", ".")
R = 550.0; W, H = 1728, 864; Wg, Hg = W//2, H//2
h_full = np.fromfile(os.path.join(WORK, "h.f32"), dtype=np.float32).reshape(H, W).astype(float)
_lat = (0.5 - (np.arange(H) + 0.5)/H)*math.pi
_dy = R*math.pi/H; _dx = R*2*math.pi/W*np.cos(_lat)[:, None]
s_full = np.hypot((np.roll(h_full, -1, 1) - np.roll(h_full, 1, 1))/(2*_dx), np.gradient(h_full, axis=0)/_dy)
hg = h_full.reshape(Hg, 2, Wg, 2).mean((1, 3)); sg = s_full.reshape(Hg, 2, Wg, 2).max((1, 3))
lat = (0.5 - (np.arange(Hg) + 0.5)/Hg)*math.pi; lon = ((np.arange(Wg) + 0.5)/Wg - 0.5)*2*math.pi
N = Wg*Hg
VX = (np.cos(lat)[:, None]*np.cos(lon)[None, :]).ravel(); VY = (np.sin(lat)[:, None]*np.ones(Wg)[None, :]).ravel(); VZ = (-np.cos(lat)[:, None]*np.sin(lon)[None, :]).ravel()
V = np.stack([VX, VY, VZ], 1)
STOP = 0.4                               # the layout's cliffs.stop: ground steeper than this stops a skier

def d_of(lo, la): lo, la = math.radians(lo), math.radians(la); return np.array([math.cos(la)*math.cos(lo), math.sin(la), -math.cos(la)*math.sin(lo)])
def ll_of(d): d = np.asarray(d, float); d = d/np.linalg.norm(d); return math.degrees(math.atan2(-d[2], d[0])), math.degrees(math.asin(max(-1, min(1, d[1]))))
def node(d):
    lo, la = ll_of(d); j = int(min(Hg - 1, max(0, (0.5 - la/180)*Hg))); i = int((lo/360 + 0.5)*Wg) % Wg; return j*Wg + i
def nn(lo, la): return node(d_of(lo, la))
def ang(a, b): return math.acos(max(-1.0, min(1.0, float(np.dot(a, b)))))
def dist(a, b): return R*ang(a, b)
def norm(v): v = np.asarray(v, float); return v/np.linalg.norm(v)
def height(d):                           # bilinear on the full grid
    lo, la = ll_of(d); x = (lo/360 + 0.5)*W - 0.5; y = (0.5 - la/180)*H - 0.5
    i0 = math.floor(x); j0 = min(H - 2, max(0, math.floor(y))); u = x - i0; v = min(1, max(0, y - j0))
    g = lambda j, i: h_full[j, i % W]
    return (g(j0, i0)*(1 - u) + g(j0, i0 + 1)*u)*(1 - v) + (g(j0 + 1, i0)*(1 - u) + g(j0 + 1, i0 + 1)*u)*v
def slope(d): lo, la = ll_of(d); return s_full[int(min(H - 1, max(0, (0.5 - la/180)*H))), int((lo/360 + 0.5)*W) % W]

# ---- the edge list (both ways): steps east, south, and diagonals stretched so they stay about 45 degrees near the poles
def _edges():
    rows, cols = [], []
    J, I = np.meshgrid(np.arange(Hg), np.arange(Wg), indexing="ij")
    dxr = R*2*math.pi/Wg*np.cos(lat); dyr = R*math.pi/Hg
    k = np.maximum(1, np.round(dyr/np.maximum(dxr, 1e-6)).astype(int)); k = np.minimum(k, Wg//8)[:, None]*np.ones((1, Wg), int)
    def add(dj, di):
        j2 = J + dj; ok = (j2 >= 0) & (j2 < Hg); i2 = (I + di) % Wg
        a = (J*Wg + I)[ok]; b = (j2*Wg + i2)[ok]; rows.append(a); cols.append(b); rows.append(b); cols.append(a)
    add(0, 1); add(0, k); add(1, 0); add(1, k); add(1, -k); add(1, 2*k); add(1, -2*k); add(2, k); add(2, -k)
    a = np.concatenate(rows); b = np.concatenate(cols)
    keep = a != b; a, b = a[keep], b[keep]
    dots = np.clip((V[a]*V[b]).sum(1), -1, 1); d = R*np.arccos(dots)
    return a, b, np.maximum(d, 0.05)
EA, EB, ED = _edges()
EG = np.abs(hg.ravel()[EA] - hg.ravel()[EB])/ED          # each edge's grade

def graph(passable, factor=None, gmax=0.16, gpen=0.07):
    """A routing graph: edges between passable cells no steeper than gmax; cost = length x (1 + (grade/gpen)^2/2) x factor."""
    ok = passable.ravel()[EA] & passable.ravel()[EB] & (EG <= gmax)
    w = ED[ok]*(1 + 0.5*(EG[ok]/gpen)**2)
    if factor is not None: f = factor.ravel(); w = w*0.5*(f[EA[ok]] + f[EB[ok]])
    return csr_matrix((w, (EA[ok], EB[ok])), shape=(N, N))
def route(G, a, b):
    dd, pr = dijkstra(G, indices=a, return_predecessors=True)
    if not np.isfinite(dd[b]): return None
    p = [b]
    while p[-1] != a: p.append(pr[p[-1]])
    return p[::-1]
def clearance(blocked):
    """Metres from every cell to the nearest blocked cell (over the sphere, not the map)."""
    src = np.nonzero(blocked.ravel())[0]
    a = np.concatenate([EA, np.full(len(src), N)]); b = np.concatenate([EB, src]); w = np.concatenate([ED, np.full(len(src), 1e-9)])
    G = csr_matrix((w, (a, b)), shape=(N + 1, N + 1)); return dijkstra(G, indices=N)[:N].reshape(Hg, Wg)
def components(passable):
    ok = passable.ravel()[EA] & passable.ravel()[EB]
    n, lab = connected_components(csr_matrix((np.ones(ok.sum()), (EA[ok], EB[ok])), shape=(N, N)), directed=False)
    lab = lab.copy(); lab[~passable.ravel()] = -1; return lab
CELL_AREA = ((R*math.pi/Hg)*(R*2*math.pi/Wg)*np.cos(lat))[:, None]*np.ones((1, Wg))
def smooth_path(nodes, win=18, closed=False):
    """Cells to a smooth line of unit vectors: resample 2 m apart, then average over `win` metres each way."""
    P = V[np.array(nodes)]
    out = [P[0]]
    for q in P[1:]:
        while True:
            d = dist(out[-1], q)
            if d < 2: break
            t = 2/d; out.append(norm(out[-1]*(1 - t) + q*t))
    P = np.array(out + [P[-1]]); n = len(P); k = max(1, int(win/2)); Q = np.empty_like(P)
    for i in range(n):
        if closed: idx = [(i + j) % n for j in range(-k, k + 1)]
        else: kk = min(k, i, n - 1 - i); idx = range(i - kk, i + kk + 1)
        Q[i] = norm(P[list(idx)].mean(0))
    return Q
def thin(Q, step=22, closed=False):
    """Control points about `step` metres apart along a 2 m line (the editor's curve runs through them)."""
    n = len(Q); m = max(3 if closed else 2, round((n - 1)*2/step)); idx = np.linspace(0, n - 1, m + 1).round().astype(int)
    if closed: idx = idx[:-1]
    return [Q[i] for i in idx]
