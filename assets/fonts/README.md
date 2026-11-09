# Sarvam web fonts

Source: user-provided `sarvam-slide-design.zip`, prepared 2026-11-09T14:26:20.493810+00:00.

Archive SHA256: `25db56468a3fe3ab0612df0a39223bd47c46fa1be9c63dcbdee45e411b5260b9`.

Converted without subsetting using fontTools 4.68.0 and Brotli 1.2.1. Original OTF/TTF files remain outside the published site.

| CSS family | CSS weight | Source entry | Published file | Bytes |
|---|---:|---|---|---:|
| Season Mix | 400 | `fonts/SeasonMix-Regular.otf` | `sarvam-season-mix-regular.woff2` | 50104 |
| Matter | 400 | `fonts/MatterRegular.otf` | `sarvam-matter-regular.woff2` | 84300 |
| Matter | 500 | `fonts/MatterMedium.otf` | `sarvam-matter-medium.woff2` | 85504 |
| Matter | 600 | `fonts/MatterSemiBold.ttf` | `sarvam-matter-semibold.woff2` | 95644 |
| Matter SemiMono | 400 | `fonts/MatterSemiMonoRegular.otf` | `sarvam-matter-semimono-regular.woff2` | 79240 |

Each WOFF2 was decoded and compared with its original: full glyph order, character mapping, horizontal metrics, units per em, internal weight, and every glyph outline matched. Source/output hashes are recorded in [provenance.json](provenance.json).

CSS weights follow the supplied design kit: Regular 400, Medium 500, SemiBold 600. The source files use internal OS/2 weights 420/430/570/670; these values are preserved, not rewritten.

Load [sarvam-fonts.css](sarvam-fonts.css) for font faces; it does not apply page styles. All faces use `font-display: swap`.
