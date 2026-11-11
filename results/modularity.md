# Modularity report

| Module | Layer | Imports | Uses browser APIs | Lines of code |
|---|---|---|---|---|
| motion.js | 1 sensing | – | yes | 28 |
| noise.js | 1 sensing | – | yes | 50 |
| filter.js | 2 model | – | no | 23 |
| fit.js | 2 model | – | no | 39 |
| load.js | 2 model | – | no | 44 |
| placement.js | 2 model | – | no | 35 |
| policy-bayes.js | 2 model | policy.js | no | 205 |
| policy-fixed.js | 2 model | policy.js | no | 40 |
| policy.js | 2 model | – | no | 187 |
| study.js | 2 model | – | no | 56 |
| app.js | 3 interaction | policy.js, policy-bayes.js, noise.js, motion.js, filter.js, policy-fixed.js, study-ui.js, load.js, placement.js | yes | 511 |
| calibration-ui.js | 3 interaction | load.js | yes | 73 |
| study-ui.js | 3 interaction | study.js, load.js, calibration-ui.js | yes | 222 |

Layer rules: no violations (no upward imports; the model layer is DOM-free and runs under Node).

Test files: bayes.test.mjs, parity.test.mjs, study.test.mjs. Policies share one interface (recognize / boundary / event), so the study swaps adaptive and non-adaptive arms without changing the UI; sensors, content (JSON) and targets can be replaced independently.
