# Arch Ablations: five epochs of hybrid language-model research

**Project synthesis · 9 November 2026 · Research closed 13 October 2026**

## Abstract

This project investigated language-model blocks that combine fixed-state recurrent memory, compressed global attention and mixture-of-experts feed-forward layers. Five epochs moved from a 26-configuration small-model search through long-context training, numerical repairs, optimizer studies and sparse-attention experiments to a fresh, matched comparison at approximately 1.27B total parameters and 30B processed tokens per model.

The retained reference is the A1 family: three KDA recurrent layers per output-gated dense MLA layer, with four experts and top-two routing. This is a practical continuation of the tested baseline, not a universally winning architecture. Earlier experiments trained models through 64K context and evaluated selected retrieval probes at 256K. The final experiment instead trained both models only at 4K and evaluated extrapolation through 32K; those capabilities must not be combined.

In the final comparison, the HySparse2-style challenger improved some extrapolation and passkey results, while A1 performed better on several language-model, downstream and copying measurements. HySparse2 took 2.27 times the recorded training elapsed time. Both trained cached-decoding implementations failed numerical equivalence checks, leaving serving unvalidated. The project therefore closes without promoting a replacement architecture. Its durable contributions are the completed comparisons, corrected interpretations, implementation fixes and increasingly explicit evaluation controls.

## 1. Scope, architectures and experimental method

Full attention retains token-specific keys and values, allowing direct access to earlier text at a growing memory cost. KDA uses content-dependent, channel-wise decay and delta-rule updates to maintain a fixed-size recurrent state. MLA compresses the information retained per token. Combining three KDA layers with one global MLA layer offered a useful compromise in the tested settings. “Dense A1” refers to its global attention; A1 still contains recurrent layers and sparsely routed MoE feed-forward layers.

Two attention gates must be distinguished. The historical **forget gate** modifies attention scores. The later **output gate** scales the attention output. Their effects depended on scale and the surrounding block. Likewise, mixture-of-experts routing changes feed-forward computation; it is separate from sparse token selection in attention.

Early searches held the model skeleton approximately fixed and aimed to match non-embedding parameter budgets within 0.5%, reallocating remaining parameters to feed-forward width. That compares complete budgeted designs, not a mixer in isolation. Historical “1.2B” labels generally describe non-embedding parameters. Epoch5 explicitly matches **total** parameters. Equal parameter counts do not imply equal activated work or FLOPs.

Experiments used seeded token-window orders, architecture-specific learning-rate searches and recorded parent checkpoints. Matching also requires the corpus, mask, budget, batch, optimizer, precision and curriculum. The standard early large-model curriculum used 30B tokens at 4K, followed by 1.5B at 32K and 1.5B at 64K; extension mixed PG19 and FineWeb-Edu 70/30. Pilot-optimal learning rates sometimes changed at the full budget or next scale.

Evaluation separated next-token loss, synthetic copying, planted-key retrieval, downstream tasks and execution cost. Historical dense recall is `1 - second-copy loss / first-copy loss`, not accuracy. Passkey success measures recovery of one distinctive item, not general long-document reasoning. Historical MoE validation included an auxiliary routing loss; later raw-CE evaluations exclude it. Dense and MoE objective values cannot silently be compared as isolated language-model CE.

Most large challenger endpoints have one training seed. Repeated evaluation draws are not independent model replications. Registered numerical thresholds and saved identities improve auditability, but do not establish causal mechanisms, population significance or unseen-source generalization.

## 2. Campaign trajectory and corrected decisions

| Epoch | Main question | Decision carried forward |
|---|---|---|
| 1 | Which mixer and hybrid pattern merit scaling? | Carry the KDA/MLA hybrid and staged context extension forward; small-model rankings remain provisional |
| 2 | Why did Comba fail, and can recurrent memory be improved? | Repair the kernel; retain KDA as the baseline while documenting retrieval trade-offs |
| 3 | Does the block transfer to MoE? | Replace the global forget gate with an output gate for subsequent MoE work |
| 4 | Can optimization or learned sparse global attention improve A1? | Retain original dense MLA, use the tuned optimizer recipe, stop the tested sparse branch |
| 5 | Does a fresh HySparse2-style recipe replace A1 at matched total size and budget? | Preserve both endpoints; retain A1 as reference without declaring an overall quality winner |

### Epoch 1: a useful hybrid, with scale-dependent rankings

The search began with 26 mixer configurations at 85M, then promoted candidates to 300M and 1.2B. At 85M, forget-gated MLA improved reported loss from 2.8320 to 2.7889 at the same analytic cache size. One global layer per three recurrent layers preserved more retrieval than more aggressive attention dilution in the tested models.

Context extension mattered: the 300M KDA block's recall across an 8,192-token gap rose from 0.213 at the bulk endpoint to 0.531 after 32K extension and 0.678 after 64K extension. Nevertheless, better short-context loss did not reliably select a better extension parent. Removing positional information or reducing latent rank could preserve one measurement while damaging another.

The original interpretation of five failed Comba 64K attempts was subsequently withdrawn. The failure was an implementation defect, not evidence that the architecture could not train. Likewise, an old “12.4σ” characterization divided a loss difference by a registered decision threshold; it was not conventional statistical significance. The [corrected epoch1 report](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/tech_report/report.md) preserves the historical tables while revising those conclusions.

### Epoch 2: numerical repair exposed a real trade-off

Comba failed on a PG19 region containing 360,448 repeated tokens. BF16 rounding let a normalized inner product exceed its mathematical bound: a measured value around 1.0026 compounded across chunks until overflow. Clamping the intermediate to its bound allowed the formerly failing run to complete all 5,722 steps. The patch reused the stock backward, so its gradient outside the bound is not the exact derivative of the clamped expression.

| 1.2B endpoint trained through 64K | Validation loss | Recall, gap 32,768 | 256K passkey, five evaluation draws |
|---|---:|---:|---:|
| Original unmasked KDA | 2.5025 | 0.333 | 0.600 ± 0.000 |
| Later masked KDA control | 2.5024 | 0.348 | 0.560 ± 0.037 |
| Repaired Comba, seed 2345 | 2.5446 | 0.199 | 1.000 ± 0.000 |

The mask changed extension window order; these rows are distinct recipes, not interchangeable baseline columns. KDA retained better text loss and dense recall, while Comba retrieved a single key better.

Fixed or content-independent decay, preconditioned memory, hierarchical memory and mixed decay granularity did not establish an overall replacement under their tested budgets. A preconditioning improvement at 32K did not become a resolved 64K advantage and came with worse passkey retrieval. These are bounded negative results, not impossibility claims.

Later audits also invalidated the original Comba redundancy explanation: the intervention had skipped most generation forwards. Repaired early-layer interventions still change convolution boundaries and kernel shapes, so they do not isolate recurrent memory alone. The [epoch2 report](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch2/tech_report/report.md) records both the experiments and these corrections.

### Epoch 3: the global gate interacted with MoE

Four-expert, top-two routing changed the preferred block. The forget-gate MoE arm lost passkey retrieval during 32K extension, including lengths it had previously handled. The output-gate arm retained substantially more retrieval.

| MoE endpoint trained through 64K | Validation LM + auxiliary | Recall, gap 32,768 | 256K passkey |
|---|---:|---:|---:|
| Forget-gated MLA | 2.5509 | 0.361 | 0.000 |
| Output-gated MLA | 2.5378 | 0.5475 | 0.800 |

Each arm had one training seed, and parameter allocation was slightly different. Output-gate passkey was also non-monotonic: 1.00 at 64K, 0.40 at 128K and 0.80 at 256K. Low measured attention mass on the key was consistent with an addressing problem, but did not establish its sole cause or rule out routing and readout interactions. The useful decision was to carry `kda,kda,kda,mla_og` forward. The [epoch3 report](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch3/tech_report/report.md) contains the matched recipes and unresolved mechanisms.

## 3. Epoch 4: optimizer gains, implementation limits and the A1 decision

At approximately 300M non-embedding parameters, the one-seed 1.5B-token bulk bracket favored HybridMuon: the best reported AdamW objective was 2.7739 at LR 0.0015, versus 2.7281 for Muon at 0.003; a clipped canonical rerun reached 2.7265. HybridMuon applies Muon to eligible hidden matrices and AdamW to embeddings, routers and other parameters. Its implementation and learning-rate tuning are part of the recipe.

Selecting extension LR solely by loss failed. LR 0.0024 reached objective 2.6023 but zero on the historical 32K and 128K needle probes. LR 0.0012 reached 2.6835 while retaining 1.00 on those probes, and was selected. These limited draws support that endpoint decision, not a retrieval guarantee.

Precision instrumentation found that small updates to BF16-stored parameters could round away, particularly norm gains and KDA `A_log`. FP32 storage enabled updates but did not demonstrate a quality gain in the matched 381-update continuation: final objectives were 2.6972 and 2.6969, comparable to the initial precision-dependent offset. Peak memory increased from 25.33 to 41.97 GB and throughput fell approximately 5%. The historical BF16 reference remained explicit.

Engineering fixes were consequential. MoE auxiliary gradients needed to survive checkpointing, and empty experts needed to remain in the distributed graph. A later checkpointing retention bug had inflated memory: changing the implementation reduced the measured 1.2B/64K peak from roughly 110 to 33.3 GB. Those are implementation gains, not architecture-quality improvements.

The final A1 checkpoint has 333,939,600 total parameters, 24 layers, width 1,024, 18 KDA layers and six output-gated original MLA layers, with four experts and top-two routing. A2 replaced global attention with learned sparse selection. A3 separately adapted an indexer under another objective and budget. Selector leakage, initialization and recovery problems required corrections; A2's recovered history does not certify equal actual processed work with A1.

The final shared synthetic-copy evaluation froze three evaluation seeds, two context lengths and present/absent-reference conditions. Each endpoint scored 1,524 targets. A1 beat A2 on every seed at both lengths:

| Context | A1 present-reference CE / target hits | A2 present-reference CE / target hits |
|---|---:|---:|
| 4,096 | 1.308914 / 87.40% | 4.097597 / 54.07% |
| 16,384 | 1.918298 / 79.53% | 6.649621 / 31.76% |

These are teacher-forced target predictions, not free-running copying accuracy. Independent saved-array scoring reproduced normalization and hits. A2 was also approximately 11.5 times slower at 4K and 32.6 times slower at 16K in the retained native timing samples; fixed order and implementation overhead limit interpretation. This justified retaining the A1 endpoint, without isolating sparsity as the cause.

The [epoch4 report](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch4/tech_report/report.md), [final recipe](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch4/tech_report/final_recipe.json) and [validation evidence](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch4/gates/a1_a2_minimal_validation/summary.json) define that result. Configured 256K length, experimental 1M paths and a proposed 1.9B scale-up are not validated deployment capabilities.

## 4. Evaluation discoveries that changed the standard of evidence

Several findings changed how later experiments were conducted. Trained outputs could depend on forward tensor shape, making old variable-shape prefix curves insufficient to isolate context benefit. Epoch5 therefore held both scored targets and tensor shape fixed. Present/absent-reference controls and positive controls helped detect insensitive or broken instruments. Selected-row future-token checks remained scoped checks, not proofs about every position or arbitrary padding.

Data provenance was also narrower than convenient dataset labels implied. Epoch4 reproduced token correspondence for selected FineWeb records, but a full-cohort native acquisition stopped on a writer-identity error; there is no completed healthy-versus-collapsed FineWeb NLL result from that branch. Five dependent PG19 records were descriptive observations. Book-QA source and exposure questions remained unresolved. Saved hashes establish file identity, not population representativeness or independent source separation.

The repository consequently distinguishes execution completion, numerical correctness, measured quality and interpretation. An evaluator can finish successfully while recording a failed task. A source audit or CPU test cannot substitute for trained-model behavior. The [evaluation guide](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/tech_report/EVALUATION.md) and per-epoch reports preserve the instruments and their limits.

## 5. Epoch 5: fresh matched training and mixed final results

The final experiment compared a fresh A1-family model with a HySparse2-style challenger; it did not resume the historical 300M checkpoint.

| Property | Fresh A1 | HySparse2-style |
|---|---:|---:|
| Total parameters | 1,269,005,856 | 1,264,754,368 |
| Layers / width | 24 / 2,048 | 49 / 1,024 |
| Feed-forward experts | Four, top two | Four, top two |
| Selected peak LR | 0.003 | 0.0015 |
| Completed updates | 114,440 | 114,440 |
| Processed tokens | 29,999,759,360 | 29,999,759,360 |

HySparse2 uses a 25-layer self decoder and 24-layer cross decoder, bridging independent group KV from the self full-attention layer's input and sharing KV and selected indices within groups. Local windows contain 128 tokens; global selection uses a 1,024-token budget. Mean head probabilities determine selection. The implementation omits mHC, MTP, the full large-model expert recipe and optimized sparse kernels; it is not a reproduction of the published 80B model.

Both arms used seed 1234, the same FineWeb-Edu token/window order, 4,096-token training context, 262,144 tokens per update, eight B200 GPUs, FP32 parameter/state storage with BF16 autocast and HybridMuon. Neither used QK weight clipping. The corpus repeats, so 30B processed tokens are not 30B unique tokens. Physical batching differed while preserving 64 logical windows and the per-sequence auxiliary objective. Depth, activated work and floating-point trajectories were not matched.

Each arm received the same three-point LR grid and 256 updates per pilot; the fixed terminal raw-CE rule selected the rates above. Main runs started fresh. This provides equal bounded tuning opportunity, not globally optimal hyperparameters.

Final training-validation raw CE was 2.252709 for A1 and 2.254674 for HySparse2, with auxiliary losses reported separately. There is no training-seed uncertainty estimate for that small difference. Subsequent fixed evaluation used its own matched windows:

| Fixed 4K measurement | A1 | HySparse2 |
|---|---:|---:|
| FineWeb raw CE, 262,144 targets | 2.188247 | 2.181562 |
| PG19 raw CE, 262,144 targets | 2.739904 | 2.789053 |
| Book-QA raw CE, 262,144 targets | 2.060498 | 2.136116 |
| LAMBADA greedy exact, first 1,000 cases | 470 / 1,000 | 447 / 1,000 |
| HellaSwag length-normalized, first 1,000 cases | 450 / 1,000 | 439 / 1,000 |
| Passkey, three prompt lengths and depths | 40 / 45 | 45 / 45 |

LAMBADA generation used the gold continuation's token count. These finite subsets and scoring conventions should not be equated with differently configured benchmark reports.

Both models improved with additional visible context in the matched-target 4K curves; A1's reduction was larger on all three corpora. After staged 8K, 16K and 32K full-forward checks, a separate eight-window-per-corpus cohort evaluated the same final 256 targets at varying prefixes. At the longest prefix, HySparse2 had lower CE by 0.211813 on FineWeb, 0.131455 on PG19 and 0.321870 on Book-QA. However, both models were worse there than at a 4,096-token prefix. The challenger mainly degraded less during extrapolation; this was not monotonic benefit from more context.

Copying remained mixed. A1 had lower natural-copy loss at all four 4K gaps; HySparse2 won random copying at the longest 4K gap. Across a 32,512-token gap, natural-copy loss favored HySparse2, 1.975261 versus 2.533112, while random-copy loss favored A1, 9.626509 versus 10.310154. At the 32,763-token passkey prompt, hits were 10/15 and 15/15 respectively. Small depth-dependent substring-scored cohorts do not establish general retrieval superiority.

All seven requested 4K quality categories and all four shared 32K quality categories completed. **Both cache/decode checks failed.** A1 matched prefill but failed all 32 decode comparisons; HySparse2 failed prefill and all 32 decode comparisons, at frozen absolute/relative tolerances of 0.01. Maximum logit differences were 0.687500 and 1.402344. Smaller observed HySparse2 retained cache storage is therefore not a validated memory-quality trade-off, and instrumented timings establish no serving advantage. Full-forward quality remains a separate measurement.

Recorded training attempts took 98.52 hours for A1 and 223.89 hours for HySparse2, a 2.27-fold ratio under these implementations. Scheduler accounting gives 788.280000 and 1,791.228889 allocated GPU-hours for the main jobs. Including the three final GPU evaluation jobs yields **2,582.175833 GPU-hours**. This excludes tuning, earlier diagnostics and failed setup work; it is not an all-project cost total.

The [epoch5 final report](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch5/FINAL_REPORT.md) provides every category, complete curves and limitations. The [final comparison](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch5/results/20261013/artifacts/matched-final-report-v1/output/comparison.json), [A1 training summary](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch5/results/20261013/artifacts/a1-main-30b-lr0003/output/train/summary-0-cc5b385a91ba.json), [HySparse2 training summary](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch5/results/20261013/artifacts/hysparse-main-30b-selected-v1/output/train/summary-0-a114f444c14d.json) and [scheduler record](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch5/results/20261013/scheduler-observation.json) retain the underlying measurements.

## 6. Final recommendation, reproducibility and closure

Retain the A1 family as the existing research reference: three KDA layers per output-gated original dense MLA layer, four experts with top-two routing, and separately tuned HybridMuon. Preserve the distinction between the historical BF16/QK-clipped epoch4 recipe and the fresh FP32-stored, unclipped epoch5 comparison. Do not adopt HySparse2 on this run: quality is mixed, observed training time is higher, and trained serving remains unvalidated for both arms.

This recommendation does not imply uniform task superiority or a population ranking. The project does not establish transfer to 100B/1T models, production 128K/1M serving, unseen-source generalization, optimized sparse-kernel performance or a single causal explanation for the observed differences. Earlier corrected reports take precedence over superseded interpretations in chronological logs.

Implementation entry points are [model architectures](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/code/arch.py), [training](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/code/train.py), [HybridMuon](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/code/muon.py), [epoch5 campaign](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch5/campaign.py) and [epoch5 evaluation](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch5/evaluate.py). The five linked epoch reports supply detailed recipes, findings and evidence. The [final evidence archive](https://github.com/rahul-sarvam/autoresearch/blob/epoch5/epoch5/results/20261013/README.md) preserves training curves, per-case results, failures, source snapshots and binding verification. Checkpoints, large arrays and corpora remain external with recorded identities; the archive is not an independent GPU rerun.

Training, final evaluation and reporting finished by 3 October. The owner closed the project on 13 October, with no active recorded campaign jobs and no queued follow-up work. Historical plans remain provenance, not an execution queue. This synthesis completes the project-wide report while leaving the historical reports intact.
