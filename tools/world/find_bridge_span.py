from geo import *
zl = np.load(os.path.join(WORK, "zl.npy")).ravel(); Z = json.load(open(os.path.join(WORK, "zones.json"))); cl = np.load(os.path.join(WORK, "cl.npy")).ravel(); hgf = hg.ravel()
E = np.nonzero((zl == Z["E"]) & (cl >= 7))[0][::3]
for zname, hmin in (("2", 30), ("1", 5), ("3", 5), ("4", 5)):
    F = np.nonzero((zl == Z[zname]) & (cl >= 7) & (hgf >= hmin))[0][::4]
    D = R*np.arccos(np.clip(V[F] @ V[E].T, -1, 1)); dh = hgf[E][None, :] - hgf[F][:, None]
    for KR in (0.16, 0.2, 0.25):
        ok = (D > 60) & (D < 420) & (np.abs(dh)/D <= KR*0.95); ii, jj = np.nonzero(ok); order = np.argsort(D[ii, jj]); found = None; tested = 0
        for o in order[:60000]:
            a, b = V[F[ii[o]]], V[E[jj[o]]]; L = D[ii[o], jj[o]]; n = max(4, int(L/5)); g0, g1 = height(a), height(b); good = True; tested += 1
            for k in range(1, n):
                u = k/n; sd = L*u
                if 18 < sd < L - 18 and height(norm(a*(1 - u) + b*u)) > min(g0 + sd*KR, g1 + (L - sd)*KR): good = False; break
            if good: found = (L, a, b, g0, g1); break
        print("zone", zname, "ramp grade", KR, "pairs", len(order), "tested", tested, "->", ("%.0f m from (%.1f, %.1f) h %.0f to (%.1f, %.1f) h %.0f" % (found[0], *ll_of(found[1]), found[3], *ll_of(found[2]), found[4])) if found else "none")
