# Policy comparison on simulated visits (skewed population)

2000 simulated visitors × 8 artworks; same visitors, rooms and reactions for every policy (common random numbers). Population: most visitors prefer brief content and audio.
"Suitable" = share of content segments shown in a format that fits the visitor's hidden interest, constraint, room noise and walking state.

| Policy | Suitable (95% CI) | Artworks 5–8 | Audio-only visitors | Fading interest | Visitor actions / visit | Questions / visit | Auto switches / visit | µs per decision (p50 / p99) |
|---|---|---|---|---|---|---|---|---|
| Fixed (visitor's stated choice) | 54.6% ± 1.2 | 54.0% | 70.7% | 55.8% | 2.83 | 0.00 | 0.00 | 0 / 1 |
| Rule-based (starts from stated choice) | 57.9% ± 1.1 | 59.7% | 69.2% | 62.4% | 1.92 | 0.00 | 0.57 | 0 / 1 |
| Fixed-step utility (current) | 40.3% ± 1.0 | 45.9% | 51.0% | 38.3% | 3.35 | 0.00 | 0.44 | 4 / 18 |
| Bayesian, neutral prior | 42.2% ± 1.0 | 43.4% | 52.3% | 38.9% | 3.22 | 0.00 | 0.01 | 484 / 1342 |
| Bayesian, practice behaviour as prior (no question) | 44.7% ± 1.1 | 45.6% | 53.0% | 42.2% | 2.83 | 0.00 | 0.01 | 484 / 1344 |
| Bayesian, practice prior + value-of-information question | 50.3% ± 1.1 | 51.2% | 62.3% | 51.1% | 4.20 | 1.58 | 0.01 | 445 / 1286 |
| Bayesian, population + practice prior | 52.7% ± 1.1 | 54.0% | 67.3% | 54.7% | 2.13 | 0.00 | 0.01 | 444 / 1318 |
| Bayesian, population + practice prior + VOI question | 55.6% ± 1.1 | 57.7% | 67.9% | 57.3% | 3.84 | 1.63 | 0.01 | 447 / 1327 |
| Bayesian, stated choice as prior | 55.3% ± 1.1 | 53.9% | 67.5% | 56.0% | 2.59 | 0.00 | 0.01 | 443 / 1259 |
| Bayesian, stated prior, no history (ablation) | 56.3% ± 1.2 | 55.3% | 70.2% | 57.4% | 2.59 | 0.00 | 0.01 | 460 / 1314 |

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
 "skew": {
  "detailPow": 1.8,
  "audioPow": 0.6
 }
}
```
Limits: the simulator encodes our assumptions about visitor behaviour; it compares policies under those assumptions and does not show that visitors learn more or feel less loaded. Timing is Node.js on a laptop, not the phone.
