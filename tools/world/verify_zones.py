# Are the zones really sealed? Check again with the most generous reading of the ground (a coarse cell counts as skiable
# if any part of it is), gates shut and bridges out. Each zone's reference point must still be in its own region.
from geo import *
A = json.load(open(os.path.join(WORK, "additions.json")))
s_min = s_full.reshape(Hg, 2, Wg, 2).min((1, 3)); gen = (s_min <= STOP).ravel()
shut = np.zeros(N, bool)
for g in A["game"]["gates"]:
    if g["name"] in ("East gate", "North gate", "South pass gate"): shut |= R*np.arccos(np.clip(V @ np.array(g["d"]), -1, 1)) <= 12
lab = components((gen & ~shut).reshape(Hg, Wg)); ids = {str(z["id"]): int(lab[node(z["ref"])]) for z in A["game"]["zones"]}
print("zone regions (generous ground, gates shut):", ids, "| all separate:", len(set(ids.values())) == 5)
open_ = components(gen.reshape(Hg, Wg)); print("with the gates open: zone 1 joins zone 2:", open_[node(A["game"]["zones"][0]["ref"])] == open_[node(A["game"]["zones"][1]["ref"])], "| zone 3 joins zone 4:", open_[node(A["game"]["zones"][2]["ref"])] == open_[node(A["game"]["zones"][4]["ref"])])
T_ = json.load(open(os.path.join(WORK, "alltrails.json"))); bad = []
for t in T_:
    zs = set(int(lab[node(p)]) for p in t["pts"]) - {-1}
    if len(zs) > 1 and t["name"] not in ("Trail 10", "Trail 8"): bad.append((t["name"], zs))
print("trails crossing a zone boundary (other than the two gated ones):", bad or "none")
for name in ("Trail 10", "Trail 8"):
    t = next(t for t in T_ if t["name"] == name); seq = []
    for p in t["pts"]:
        c = int(lab[node(p)]); k = next((k for k, v in ids.items() if v == c), None)
        if k and (not seq or seq[-1] != k): seq.append(k)
    print(name, "runs through zones:", " > ".join(seq))
for tm in A["game"]["terminals"]: assert str(tm["zone"]) == next(k for k, v in ids.items() if v == int(lab[node(tm["d"])])), tm["name"]
print("every terminal stands in its own zone; crystals in the highlands:", sum(int(lab[node(c)]) == ids["highlands"] for c in A["game"]["crystals"]), "of", len(A["game"]["crystals"]))
st = A["start"]["d"]; print("start is in zone", next(k for k, v in ids.items() if v == int(lab[node(st)])))
for b in A["bridges"]: print(b["name"], "joins zones", [next((k for k, v in ids.items() if v == int(lab[node(norm(p))])), "?") for p in (b["pts"][0], b["pts"][-1])])
