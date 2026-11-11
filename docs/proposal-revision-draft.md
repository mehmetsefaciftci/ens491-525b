# ENS491 Proposal: revision draft for the final submission (29 Nov 2026)

Team 525B · Mehmet Sefa Çiftci, Bahar Küçüközer · Supervisor: Selim Balcısoy
Draft of 11 Nov 2026. Items marked **(needs supervisor agreement)** are proposals; 01_Plan changes only after we agree, with a dated line in its revision history.

Evidence for every change is in the repository (`results/`, `test/`, `sim/`).

## Summary of changes

| # | Weakness in the draft proposal | Change | Evidence |
|---|---|---|---|
| R1 | "Selecting actions under uncertainty" rests on fixed ±0.15 counters; uncertainty appears only when the noise channel is missing | Bayesian user model and posterior expected utility; switches need P(improvement) ≥ 0.75 | `src/policy-bayes.js`, `results/bayes-scenarios.md` |
| R2 | One policy, no comparison of algorithmic alternatives | Five policies compared on 2,000 simulated visits | `results/policy-comparison.md` |
| R3 | The adaptive arm ignores the format the visitor chose; the cost multipliers favour audio for everyone in quiet rooms | The practice-artwork choice becomes the prior of the adaptive arm; modality gain raised so a stated preference outweighs the cost gap | same, row "Bayesian, stated choice as prior" |
| R4 | S18: audio-only visitors never adapt (accessibility gap) | Fixed by R1 (S21 passes) | `results/bayes-scenarios.md` |
| R5 | Motion (IMU) and dwell listed but unused | Motion raises the cost of text; long dwell and leaving early are weak evidence | `src/motion.js`, S22–S23 |
| R6 | Primary outcome is NASA-TLX; the project brief lists recall first | Core-fact recall co-primary with Raw NASA-TLX mental demand **(needs supervisor agreement)** | project brief #525 |
| R7 | n ≈ 24 without a power analysis | Power analysis; H2 reported as exploratory unless n ≥ 34–51 **(needs supervisor agreement)** | `results/power-analysis.md` |
| R8 | Scope: optional face/eye load model (T6) plus n-back calibration | T6 moved to future work; time goes to R2 and device logging **(needs supervisor agreement)** | schedule risk |
| R9 | Device undecided | Commodity smartphone with WebAR as the primary candidate, lab device as alternative **(needs supervisor agreement)** | iPhone run 11 Nov: 60 fps, 21 ms decision |

## Replacement text, ready to paste

### Section 3, item 4: Behaviour-aware expected-utility policy (replaces the current item 4)

The visitor state is a belief rather than a set of counters. θ_d ~ Beta(a_d, b_d) is the probability that the visitor wants optional detail and θ_a ~ Beta(a_a, b_a) the probability that they prefer audio. The format chosen on the practice artwork sets a moderate prior (two pseudo-counts on the stated side); implicit evidence (a detail skip, a completed detail segment, a replay) adds one pseudo-count, explicit evidence (a request for more, a manual override) two, and weak evidence (dwelling on the artwork, leaving before the content ends) half. Evidence decays towards the prior by a factor of 0.85 per artwork so the model can follow fading interest. Context is uncertain as well: the measured sound level carries a ±5 dB error, so P(noisy) is a probability rather than a threshold test, and a missing noise channel uses a prior P(noisy) = 0.3 instead of an ad-hoc penalty; walking, estimated from the accelerometer, raises the cost of text.

For each action a ∈ {brief text, detailed text, brief audio, detailed audio, keep current} the policy evaluates the posterior expected utility U(a) = I(a, θ_d, k) + M(a, θ_a) − D(a, x) − c_switch(a), with I(detailed) = θ_d·1.6 + (1 − θ_d)·0.4 − familiarity term and I(brief) = 0.5, so that the neutral prior reproduces the Appendix A values. The first format at recognition maximises expected utility. An automatic switch at a segment boundary additionally requires P(U_new > U_current) ≥ 0.75, estimated by Monte Carlo over the posterior; this probability is logged as the decision's confidence. Manual overrides, accessibility restrictions, the one-automatic-change limit and the keep-current rules for tracking loss and dropped channels are unchanged. All new constants are provisional and marked [N] in the code.

### New Section 3.x: Comparison of algorithmic alternatives

We compare five policies on simulated museum visits: (1) the visitor's stated format kept fixed, (2) a rule-based policy (text when noisy; brief after two detail skips), (3) the fixed-step utility of the draft proposal, (4) the Bayesian policy with a neutral prior and (5) with the stated format as prior, plus a no-history ablation. The simulator is written independently of the policies: visitors have a hidden interest in detail that may fade, a modality preference or constraint, and move through quiet, borderline and noisy rooms, sometimes walking; they react with skips, requests, replays, overrides and early exits. Every policy sees the same visitors, rooms and reactions. We report the share of content shown in a suitable format, visitor actions per visit, automatic switches and decision time.

First results (2,000 visits): the draft policy shows a suitable format 42.0% of the time, below the visitor's own fixed choice (52.9%); the Bayesian policy with the stated prior reaches 55.4%, level with the rule-based policy (55.3%), which needs fewer visitor actions (2.04 vs 2.56) and handles fading interest better. Behaviour history adds less than the 95% confidence interval under these assumptions. These are design results under stated assumptions, not evidence of user benefit; the controlled study tests that.

### Section 3, Measures and analysis (replace the first two sentences) **(needs supervisor agreement)**

Co-primary outcomes: end-of-session core-fact recall and Raw NASA-TLX mental demand after each cell. Adaptation counts as successful only if mental demand falls without a drop in core-fact recall beyond the review threshold; both are reported with participant-aware effect estimates and 95% confidence intervals.

### Sample size (new paragraph) **(needs supervisor agreement)**

With n = 24 and a paired comparison (two-sided α = 0.05), 80% power is reached only for dz ≥ 0.60. H1 is therefore powered for a medium-to-large effect; H2, an interaction, is reported as exploratory with its effect size and confidence interval unless recruitment reaches 34 (dz = 0.5) or 51 (dz = 0.4) participants.

### Scope (Table 2 and the Gantt chart) **(needs supervisor agreement)**

T6 (face/eye load model and n-back calibration) moves to future work. Its February–March slot is used for the policy comparison on device logs (R2) and a calibrated sound measurement. The ethics application starts in November because its duration is unknown.

## Open questions for the supervisor (12 Nov)

1. Is the commodity iPhone running WebAR acceptable as the study device?
2. Co-primary recall and NASA-TLX, or keep NASA-TLX primary?
3. T6 to future work?
4. Bayesian policy, or a hybrid that adds the rule's faster density switch?
5. Agree the provisional values marked [N] or leave them to the pilot.
