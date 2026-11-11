# CA Guide — WebAR feasibility spike (ENS491-492 · 525B)

Context-aware multimodal content selection for cultural-heritage AR, running in a phone browser.
This is a **feasibility spike on a commodity smartphone**, not the final platform; the final AR
device is still chosen with the supervisor after the lab inventory.

What is real here:
- **Artwork tracking**: the phone camera recognises a printed artwork (MindAR image tracking) and
  the content panel is anchored next to it (CSS3D).
- **Ambient sound**: the microphone gives a 6 s energy-averaged level, updated every second.
  It is **uncalibrated** (dBFS + offset), not dBA. Set the offset in Settings.
- **Two policies** (chosen on the start screen): the Bayesian expected-utility revision
  (`src/policy-bayes.js`, default) and the fixed-step policy of the draft proposal.
- **Policy**: `src/policy.js` is a line-by-line port of the Python prototype
  (`U = I + B − D − C_opt − c_switch − R_unc`, one automatic change per artwork at a segment
  boundary, manual override wins). `npm test` checks it against the Python output on all
  20 scenarios (decisions with and without history, and every utility value).
- **Four formats**: brief/detailed × text/audio (audio = browser text-to-speech with a caption).
- **Log**: every decision with all utilities, reason, flags and latency, plus FPS and noise per
  second. *Export log* downloads it as JSON.

What is not real yet: calibrated sound level, recorded human narration, verified artwork
content, any participant data. Simulated inputs are flagged in the log
(`noise_simulated`, `tracking_simulated`).

## Run

```bash
npm test                      # JS policy vs. Python (20 scenarios) + Bayesian scenarios S01-S26
node sim/compare.mjs 2000 --md results/policy-comparison.md   # policy comparison on simulated visits
node sim/power.mjs --md results/power-analysis.md             # power of the planned study
node tools/analyze-study.mjs <study files or folder> --md report.md --csv long.csv
node tools/fit-load.mjs <study files or folder>               # fit load weights, leave-one-subject-out accuracy
python -m http.server 8525    # then open http://localhost:8525/?nocam=1 on a desktop
```

On a phone the page must be served over **HTTPS** (camera and microphone). Any static host
works, e.g. GitHub Pages.

URL options: `?calib=1` (study, pilot only: 0-back/2-back load calibration) · `?prior=stated` (study: adaptive arm uses the participant's pick instead of practice behaviour) · `?content=content/<file>.json` other content file · `?study=1` controlled-study mode (consent, blocks, questionnaires, recall, results file) · `?nocam=1` desktop test without camera · `?debug=1` adds *Simulate target* ·
`?pin=1` content panel pinned to the screen instead of next to the artwork.

## Using your own artwork

Put the image at `targets/artwork.jpg` (until then `targets/placeholder.jpg` is used — print it
or show it on a second screen). Then precompile it, otherwise every phone compiles it on first
start (30 s or more):

```bash
node tools/dev-server.mjs 8526                                  # in one terminal
node tools/compile-targets.mjs --from content/artworks.json     # all paintings -> one .mind (headless Chrome)
```

For several paintings set `"targets_mind": "targets/targets.mind"` in `content/artworks.json`; the
target order is the order of the `artworks` list. Each painting needs `core` and `detail` segments
(detail with `tag` and `priority`) and `recall` items with `keywords`.

Content lives in `content/artworks.json`: core segments (shown in every format) and optional
detail segments (detailed formats only). The current text is a **draft and must be verified**.

Current target: Osman Hamdi Bey, *The Tortoise Trainer* (1906), public domain, image from
Wikimedia Commons ("Osman Hamdi Bey - The Tortoise Trainer - Google Art Project.jpg"),
resized to 900 px wide.

## Files

```
index.html            UI shell, import map
src/policy.js         expected-utility policy + session timing rules (port of Python)
src/policy-bayes.js   Bayesian expected-utility policy (proposed revision)
src/noise.js          microphone level meter
src/motion.js         walking detection from the accelerometer
src/filter.js         context-aware information filtering of optional facts
src/load.js           behavioural cognitive-load estimate
src/fit.js            load model fitting and leave-one-subject-out evaluation
src/placement.js      panel placement optimisation
src/calibration-ui.js pilot load calibration screens
src/policy-fixed.js   non-adaptive comparator for the study
src/study.js          counterbalancing, SUS and recall scoring
src/study-ui.js       study mode screens
src/app.js            tracking, content player, HUD, logging
content/artworks.json artwork content (draft)
targets/              target images (+ compiled .mind)
test/                 Python reference export + parity test
tools/                local dev server + target precompiler
sim/                  policy comparison simulator, power analysis
results/              scenario results, policy comparison, power analysis
docs/                 architecture, requirements traceability, proposal revision and ethics drafts
vendor/               MindAR 1.2.5 (MIT), three.js r160 (MIT)
```
