# Requirements traceability: project brief #525 → design → evidence

Team 525B · 11 Nov 2026 · "Status" says what exists today; "Remaining" says what is still open.

| # | Requirement (project brief) | How the project meets it | Evidence | Status | Remaining |
|---|---|---|---|---|---|
| 1 | Context-aware information filtering | Density choice (brief/detailed) plus fact-level filtering: facts the visitor already knows are dropped, detail is shortened while walking or for audio in a noisy room; core facts are never filtered; every dropped fact is logged with a reason | `src/filter.js`, `test/study.test.mjs` (6 tests), `filtered` field in decision logs | Met | Tune thresholds in the pilot |
| 2 | Modality selection in AR applications | Audio vs text chosen per artwork and at segment boundaries; content anchored next to the tracked painting (CSS3D) or pinned for tall artworks | `src/app.js`, iPhone run 11 Nov | Met | Adaptive panel placement for tall artworks |
| 3 | Software system that dynamically selects modality and information density from user behaviour and context | Recognition-time choice plus boundary switches; behaviour (skip, replay, request, override, dwell, leaving early) and context (noise, motion, tracking) both enter the decision | `src/policy-bayes.js`, scenarios S01–S26 | Met | — |
| 4 | Modelling user state | Beta beliefs over wanting detail and preferring audio, prior from the practice-artwork choice, familiarity, accessibility constraints, prior-knowledge checklist, evidence decay for fading interest | `src/policy-bayes.js`, `src/study-ui.js` (profile) | Met | Validate the belief update against pilot logs |
| 5 | Representing context as computational features | P(noisy) from the sound level with ±5 dB uncertainty, P(moving) from the accelerometer, tracking validity, dwell time | `src/noise.js`, `src/motion.js`, `pNoisy()` | Met | Calibrate the microphone against a sound level meter |
| 6 | Selecting actions under uncertainty | Posterior expected utility; automatic switches need P(improvement) ≥ 0.75 by Monte Carlo; missing channels enter as priors, not invented values | `src/policy-bayes.js`, S24–S25, `confidence` in logs | Met | — |
| 7 | Abstract reasoning beyond simple heuristics | Decision-theoretic model with explicit beliefs, costs and confidence, compared against a rule-based heuristic and a no-history ablation | `results/policy-comparison.md` | Met, with a finding: the heuristic is level in simulation | Hybrid policy decision with supervisor |
| 8 | Multi-layered CS system: AI-driven decision logic, data modelling, interactive software design | Three layers (sensing, model, interaction) with data contracts; layer rules checked automatically | `docs/architecture.md`, `results/modularity.md` | Met | — |
| 9 | Adaptive content selection engine through a formal software design process; objectives: comprehension up, overload down | Requirements FR1–FR6 / QR1–QR4 (proposal), design (architecture), implementation, verification (49 automated checks), validation planned (study) | proposal 3.1, this matrix, `npm test` | Met for process; objectives to be shown by the study | Run the study |
| 10 | Criteria: recall accuracy, interaction time, usability scores | In-app study mode records core and optional recall (scored, exposure-aware), interaction time per artwork, SUS per system, plus Raw NASA-TLX mental demand and Paas effort | `src/study-ui.js`, `src/study.js`, `tools/analyze-study.mjs`, `results/study-analysis-sample.md` (simulated run) | Met (instrumented) | Real participants after ethics approval |
| 11 | Analysis: computational efficiency, explainability, edge-case handling | Policy compute 0.8 ms median (1.8 ms max) in the browser, 21 ms recognition-to-screen on iPhone, ~0.4 ms per decision in Node; every decision carries utilities, reason and confidence; 26 edge-case scenarios | `results/study-analysis-sample.md`, `results/policy-comparison.md`, `results/bayes-scenarios.md` | Met | Full-session device logs |
| 12 | Working AR software prototype with adaptive logic | WebAR app on a commodity phone, live tracking of The Tortoise Trainer, live microphone and motion | https://mehmetsefaciftci.github.io/ens491-525b/ | Met | More artworks (8 planned) |
| 13 | Controlled experiments comparing adaptive and non-adaptive systems | Study mode: within-subject 2 × 2 (adaptive Bayesian vs participant-chosen fixed × quiet vs noise), four counterbalanced orders, artwork rotation, blind "Guide A/B" labels | `src/study.js`, `src/study-ui.js`, `test/study.test.mjs` | Met (ready to run) | Ethics approval, recruitment; power: n = 24 detects dz ≥ 0.60 |
| 14 | Evaluation: algorithmic effectiveness, software modularity, ethical considerations | Effectiveness: policy comparison + study measures; modularity: layer check and shared policy interface; ethics: consent screen, no stored images or audio, pseudonymous codes, ethics application draft | `results/policy-comparison.md`, `results/modularity.md`, `docs/ethics-application-draft.md` | Met (ethics approval pending) | Submit the ethics application |
| 15 | Economic and sustainability constraints: commodity devices, reusable software components | Runs in a phone browser, no app install or extra hardware; MIT libraries; swappable sensing, policy and content; new artwork = image + JSON entry | `docs/architecture.md` ("Swapping parts"), `README.md` | Met | — |

## Automated checks (`npm test`)

| Suite | What it checks | Result |
|---|---|---|
| `test/parity.test.mjs` | JS fixed-step policy = Python prototype on 20 scenarios (decisions with/without history, utilities) | 20/20 |
| `test/bayes.test.mjs` | Bayesian policy on the 20 scenarios (differences documented) + 6 new scenarios | 6/6 new pass |
| `test/study.test.mjs` | information filter, non-adaptive comparator, counterbalancing, artwork rotation, SUS and recall scoring | 13/13 |
| `tools/modularity.mjs` | layer rules | no violations |
