# CA Guide — WebAR feasibility spike (ENS491-492 · 525B)

Context-aware multimodal content selection for cultural-heritage AR, running in a phone browser.
This is a **feasibility spike on a commodity smartphone**, not the final platform; the final AR
device is still chosen with the supervisor after the lab inventory.

What is real here:
- **Artwork tracking**: the phone camera recognises a printed artwork (MindAR image tracking) and
  the content panel is anchored next to it (CSS3D).
- **Ambient sound**: the microphone gives a 6 s energy-averaged level, updated every second.
  It is **uncalibrated** (dBFS + offset), not dBA. Set the offset in Settings.
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
npm test                      # JS policy vs. Python reference (20 scenarios)
python -m http.server 8525    # then open http://localhost:8525/?nocam=1 on a desktop
```

On a phone the page must be served over **HTTPS** (camera and microphone). Any static host
works, e.g. GitHub Pages.

URL options: `?nocam=1` desktop test without camera · `?debug=1` adds *Simulate target* ·
`?pin=1` content panel pinned to the screen instead of next to the artwork.

## Using your own artwork

Put the image at `targets/artwork.jpg` (until then `targets/placeholder.jpg` is used — print it
or show it on a second screen). Then precompile it, otherwise every phone compiles it on first
start (30 s or more):

```bash
node tools/dev-server.mjs 8526
# open http://localhost:8526/tools/compile-target.html?img=artwork.jpg&save=1
# -> writes targets/artwork.mind; commit it next to the image
```

Content lives in `content/artworks.json`: core segments (shown in every format) and optional
detail segments (detailed formats only). The current text is a **draft and must be verified**.

Current target: Osman Hamdi Bey, *The Tortoise Trainer* (1906), public domain, image from
Wikimedia Commons ("Osman Hamdi Bey - The Tortoise Trainer - Google Art Project.jpg"),
resized to 900 px wide.

## Files

```
index.html            UI shell, import map
src/policy.js         expected-utility policy + session timing rules (port of Python)
src/noise.js          microphone level meter
src/app.js            tracking, content player, HUD, logging
content/artworks.json artwork content (draft)
targets/              target images (+ compiled .mind)
test/                 Python reference export + parity test
tools/                local dev server + target precompiler
vendor/               MindAR 1.2.5 (MIT), three.js r160 (MIT)
```
