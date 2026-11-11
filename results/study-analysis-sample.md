# Study analysis

1 session file(s): P03 (simulated input).

## Project criteria by condition (means)

| Measure | Adaptive, quiet | Adaptive, noise | Fixed, quiet | Fixed, noise |
|---|---|---|---|---|
| Interaction time per artwork (s) | 1.3 | 1.1 | 0.9 | 0.7 |
| Raw NASA-TLX mental demand (0–100) | 45.0 | 45.0 | 65.0 | 65.0 |
| Paas effort (1–9) | 4.0 | 4.0 | 6.0 | 6.0 |

| Measure | Adaptive | Fixed |
|---|---|---|
| SUS (0–100) | 75.0 | 50.0 |
| Core recall (share correct) | – | – |
| Optional recall, exposed facts only | – | – |
| Manual overrides per session | 0.0 | 0.0 |

## Algorithm measures per session

| Participant | System | Decisions | Auto switches | Overrides | Policy compute median / max (ms) | Shown on screen median / max (ms) | Explained decisions | Facts filtered |
|---|---|---|---|---|---|---|---|---|
| P03 | fixed | 12 | 0 | 0 | 0.00 / 0.20 | – / – | 100% | 4 |
| P03 | adaptive | 12 | 0 | 0 | 0.80 / 1.80 | – / – | 100% | 4 |

Policy compute = time inside the policy call; shown on screen = until the next painted frame (inflated when the browser renders in the background).
Recall items are scored automatically by keyword groups; check them by hand. Recall is attributed to a condition only when its artwork appeared in exactly one condition ("multiple" otherwise, e.g. while one artwork is reused in testing).
Inference (participant-aware effect estimates with 95% CIs) is run on the CSV, e.g. a mixed-effects model with participant and artwork as random effects.
