# Bayesian policy: scenario results

Original 20 scenarios: 15/20 identical to the fixed-step policy. New scenarios: 6/6 pass.

| ID | Scenario | Same as fixed-step | Fixed-step | Bayesian |
|---|---|---|---|---|
| S01 | Quiet room, no constraints | yes |  |  |
| S02 | Noisy room, no constraints | yes |  |  |
| S03 | Text-only user, quiet (Appendix A example) | yes |  |  |
| S04 | Two detail skips -> brief on next artwork (Appendix A) | yes |  |  |
| S05 | Single detail skip is not enough | yes |  |  |
| S06 | Skips then 'request more' restores detail | yes |  |  |
| S07 | Familiar user replays brief text -> detailed next | yes |  |  |
| S08 | Noise rises mid-artwork -> switch audio to text | yes |  |  |
| S09 | Noise rises then falls: only one auto change | yes |  |  |
| S10 | Noise sensor missing at recognition | **no** | detailed_audio/initial | detailed_text/initial |
| S11 | Noise sensor drops mid-artwork -> keep | yes |  |  |
| S12 | Tracking lost at boundary -> keep | yes |  |  |
| S13 | No recognition -> no content decision | yes |  |  |
| S14 | Manual override is never auto-reversed | yes |  |  |
| S15 | Repeated audio->text overrides penalise audio | **no** | detailed_audio/initial → detailed_text/override → detailed_audio/initial → detailed_text/override → detailed_text/initial | detailed_audio/initial → detailed_text/override → detailed_text/initial → detailed_text/override → detailed_text/initial |
| S16 | One audio->text override is not 'repeated' | **no** | detailed_audio/initial → detailed_text/override → detailed_audio/initial | detailed_audio/initial → detailed_text/override → detailed_text/initial |
| S17 | Audio-only user in noise -> brief audio, never text | yes |  |  |
| S18 | Audio-only user, two skips: penalty too small to change | **no** | detailed_audio/initial → detailed_audio/initial | detailed_audio/initial → brief_audio/initial |
| S19 | Reproduce Appendix Table A2 decision map | yes |  |  |
| S20 | Small demand rise kept (gain < switch cost), large rise switches | **no** | detailed_audio/initial → detailed_audio/keep → brief_audio/switch | detailed_audio/initial → detailed_audio/keep → detailed_audio/keep |

| ID | New scenario | Result | Decisions (confidence) |
|---|---|---|---|
| S21 | Audio-only visitor skips detail twice -> brief audio next (fixes S18) | pass | detailed_audio/initial (p=0.73) → brief_audio/initial (p=0.55) |
| S22 | Walking in a noisy room: text costs more, brief text wins | pass | brief_text/initial (p=0.33) |
| S23 | Leaving early twice plus one skip -> brief next | pass | detailed_text/initial (p=0.61) → brief_text/initial (p=0.69) |
| S24 | Noise just above threshold: expected gain, but too uncertain to switch | pass | detailed_audio/initial (p=0.52) → detailed_audio/keep (p=0.60) |
| S25 | Clearly noisy after an uncertain reading -> switch with high confidence | pass | detailed_audio/initial (p=0.52) → detailed_audio/keep (p=0.60) → detailed_text/switch (p=0.88) |
| S26 | Interest fades: old skips decay, explicit request restores detail | pass | detailed_text/initial (p=0.61) → brief_text/initial (p=0.69) → detailed_text/initial (p=0.68) |
