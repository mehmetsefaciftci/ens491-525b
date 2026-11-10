"""Export the Python prototype's 20 scenarios and its decisions as JSON,
so the JavaScript port can be checked for parity (test/parity.test.mjs).
Usage: python export_python_reference.py <path-to-python-prototype> <out.json>"""
import json, sys
sys.path.insert(0, sys.argv[1])
from scenarios import SCENARIOS
from run_all import run

out = []
for sc in SCENARIOS:
    u = sc["user"]
    res_h, log_h = run(sc, True)
    res_n, _ = run(sc, False)
    out.append(dict(
        id=sc["id"], cat=sc["cat"], title=sc["title"],
        user=dict(familiarity=u.familiarity, accessibility=sorted(u.accessibility)),
        steps=[list(s) for s in sc["steps"]],
        expect=[list(e) for e in sc["expect"]],
        expect_flag=list(sc["expect_flag"]) if "expect_flag" in sc else None,
        py_with_history=[[a, k, f] for a, k, f in res_h],
        py_no_history=[[a, k, f] for a, k, f in res_n],
        py_utilities=[e.get("utility_by_action") for e in log_h if "keep_or_switch" in e],
    ))
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(len(out), "scenarios exported")
