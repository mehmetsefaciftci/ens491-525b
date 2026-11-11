# Study analysis

1 session file(s): P05 (simulated input).

## Project criteria by condition (means)

| Measure | Adaptive, quiet | Adaptive, noise | Fixed, quiet | Fixed, noise |
|---|---|---|---|---|
| Interaction time per artwork (s) | 0.1 | 0.1 | 0.1 | 0.1 |
| Raw NASA-TLX mental demand (0–100) | 25.0 | 80.0 | 35.0 | 70.0 |
| Paas effort (1–9) | 3.0 | 7.0 | 3.0 | 7.0 |

| Measure | Adaptive | Fixed |
|---|---|---|
| SUS (0–100) | 75.0 | 75.0 |
| Core recall (share correct) | – | – |
| Optional recall, exposed facts only | – | – |
| Manual overrides per session | 1.0 | 2.0 |

## Algorithm measures per session

| Participant | System | Decisions | Auto switches | Overrides | Policy compute median / max (ms) | Shown on screen median / max (ms) | Explained decisions | Facts filtered |
|---|---|---|---|---|---|---|---|---|
| P05 | adaptive | 5 | 0 | 1 | 2.20 / 2.80 | – / – | 100% | 0 |
| P05 | fixed | 6 | 0 | 2 | 0.10 / 0.20 | – / – | 100% | 0 |

## Validity of the behavioural load estimate

Blocks with a load estimate: 4. Spearman correlation of the block's mean behavioural P(high load) with Raw NASA-TLX mental demand: 0.80; with Paas effort: 0.89. Load is taken at the end of each artwork in both arms. A clear positive correlation across participants supports using the estimate; otherwise its weights are re-fitted on the pilot data or the estimate is reported as not validated.

Policy compute = time inside the policy call; shown on screen = until the next painted frame (inflated when the browser renders in the background).
Recall items are scored automatically by keyword groups; check them by hand. Recall is attributed to a condition only when its artwork appeared in exactly one condition ("multiple" otherwise, e.g. while one artwork is reused in testing).
Inference (participant-aware effect estimates with 95% CIs) is run on the CSV, e.g. a mixed-effects model with participant and artwork as random effects.
