# Architecture

Context-aware multimodal content selection for cultural-heritage AR · team 525B · 11 Nov 2026

## Layers

```
 ┌──────────────────────────── 3  Interaction (browser) ─────────────────────────────┐
 │ app.js        camera tracking (MindAR), AR panel (CSS3D), content player (text/TTS),│
 │               manual controls, decision HUD, session log export                     │
 │ study-ui.js   consent → profile → practice choice → 4 blocks → TLX/Paas → SUS →     │
 │               recall → results file                                                 │
 └───────────────▲───────────────────────────────▲─────────────────────────────────────┘
                 │ Observation                    │ Decision (+ filtered facts)
 ┌───────────────┴──────────── 2  Model (pure JS, runs in Node) ───────────────────────┐
 │ policy-bayes.js  user state = Beta beliefs; context = P(noisy), P(moving);          │
 │                  posterior expected utility; Monte Carlo P(improvement) gate        │
 │ policy.js        fixed-step utility of the draft proposal (parity with Python)      │
 │ policy-fixed.js  non-adaptive comparator (participant's chosen format)              │
 │ filter.js        information filtering of optional facts (prior knowledge, walking, │
 │                  noisy audio); core facts never filtered                            │
 │ study.js         counterbalancing, artwork rotation, SUS and recall scoring         │
 └───────────────▲─────────────────────────────────────────────────────────────────────┘
                 │ measurements
 ┌───────────────┴──────────── 1  Sensing ────────────────────────────────────────────┐
 │ noise.js   6 s energy-averaged microphone level (uncalibrated dBFS + offset)        │
 │ motion.js  accelerometer RMS → P(moving)                                            │
 │ (MindAR)   artwork recognition and tracking validity                                │
 └─────────────────────────────────────────────────────────────────────────────────────┘
 Data: content/artworks.json (segments with sources, tags, priorities; recall items),
       targets/*.jpg + *.mind, exported session and study logs (JSON).
```

`tools/modularity.mjs` checks the layer rules automatically (no upward imports; the model layer uses no browser APIs) and reports module sizes (`results/modularity.md`).

## Data contracts (as in proposal Section 3)

| Contract | Fields |
|---|---|
| Observation | timestamp, artwork_id, tracking_valid, noise_or_missing, optional_sensor_features {p_moving, p_high}, quality_flags |
| User state (Bayesian) | familiarity, accessibility, format_preference, known facts, Beta(a_d, b_d) detail belief, Beta(a_a, b_a) audio belief |
| Decision | timestamp, artwork_id, action, keep_or_switch, utility_by_action, reason, confidence, belief, p_noisy, filtered facts, compute_ms, latency_ms, quality_flags |
| Exposure | timestamp, artwork_id, segment id, format |
| Study session | consent, participant, schedule, blocks (interaction times, TLX, Paas), SUS per system, recall answers, decision logs, exposure, metrics |

## Decision cycle

1. The camera recognises an artwork → the app builds an Observation (noise, motion, tracking).
2. The policy scores the four formats under the current belief and context and returns a Decision with its reason and confidence.
3. The filter selects which facts the chosen format shows and logs every dropped fact with its reason.
4. The player shows or speaks segment by segment; each shown segment is logged as exposure.
5. Visitor actions (skip, replay, request more, override, dwell, leaving early) update the belief for the next artwork.
6. At each segment boundary the policy may make one automatic change per artwork, only if the expected gain beats the switch cost and P(improvement) ≥ 0.75; manual override always wins.

## Swapping parts

- **Policy:** all three policies expose `recognize / boundary / event`; the study uses the Bayesian policy for the adaptive arm and `policy-fixed.js` for the non-adaptive arm without UI changes.
- **Device:** sensing is behind `noise.js`, `motion.js` and the MindAR anchor; another device needs new sensing modules, not a new policy.
- **Content:** a new artwork is an image in `targets/`, a compiled `.mind` (`tools/compile-target.html`) and an entry in `content/artworks.json`.
