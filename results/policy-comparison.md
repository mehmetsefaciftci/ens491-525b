# Policy comparison on simulated visits

2000 simulated visitors × 8 artworks; same visitors, rooms and reactions for every policy (common random numbers).
"Suitable" = share of content segments shown in a format that fits the visitor's hidden interest, constraint, room noise and walking state.

| Policy | Suitable (95% CI) | Artworks 5–8 | Audio-only visitors | Fading interest | Visitor actions / visit | Questions / visit | Auto switches / visit | µs per decision (p50 / p99) |
|---|---|---|---|---|---|---|---|---|
| Fixed (visitor's stated choice) | 52.9% ± 1.1 | 51.1% | 67.9% | 52.7% | 2.79 | 0.00 | 0.00 | 0 / 2 |
| Rule-based (starts from stated choice) | 55.3% ± 1.1 | 55.1% | 67.3% | 57.6% | 2.04 | 0.00 | 0.43 | 0 / 2 |
| Fixed-step utility (current) | 42.0% ± 1.0 | 43.9% | 55.2% | 38.6% | 3.16 | 0.00 | 0.48 | 4 / 19 |
| Bayesian, neutral prior | 43.6% ± 1.0 | 42.9% | 55.6% | 39.2% | 3.08 | 0.00 | 0.01 | 471 / 1409 |
| Bayesian, practice behaviour as prior (no question) | 45.9% ± 1.1 | 45.4% | 54.2% | 40.9% | 2.84 | 0.00 | 0.01 | 473 / 1434 |
| Bayesian, practice prior + value-of-information question | 51.4% ± 1.1 | 52.5% | 59.9% | 48.0% | 4.14 | 1.51 | 0.01 | 457 / 1445 |
| Bayesian, population + practice prior | 49.0% ± 1.1 | 50.5% | 59.8% | 48.3% | 2.16 | 0.00 | 0.01 | 460 / 1393 |
| Bayesian, population + practice prior + VOI question | 53.5% ± 1.0 | 55.2% | 62.4% | 51.6% | 3.78 | 1.61 | 0.01 | 457 / 1392 |
| Bayesian, stated choice as prior | 55.4% ± 1.1 | 52.9% | 65.1% | 52.4% | 2.56 | 0.00 | 0.01 | 445 / 1255 |
| Bayesian, stated prior, no history (ablation) | 55.0% ± 1.1 | 52.8% | 66.2% | 54.5% | 2.55 | 0.00 | 0.01 | 444 / 1250 |

Simulator assumptions:
```json
{
 "fatigueShare": 0.4,
 "fatigueStep": 0.08,
 "audioOnly": 0.1,
 "textOnly": 0.1,
 "room": {
  "quiet": 0.5,
  "borderline": 0.15,
  "noisy": 0.35
 },
 "walking": 0.2,
 "pSkipUnwanted": 0.8,
 "pLeaveEarly": 0.5,
 "pRequestMore": 0.4,
 "pReplay": 0.2,
 "pDwell": 0.5,
 "pOverrideNoisyAudio": 0.6,
 "pOverrideStrongPref": 0.3,
 "micSd": 3,
 "pStatedWrong": 0.15,
 "pAnswerWrong": 0.15,
 "skew": null
}
```
Limits: the simulator encodes our assumptions about visitor behaviour; it compares policies under those assumptions and does not show that visitors learn more or feel less loaded. Timing is Node.js on a laptop, not the phone.
