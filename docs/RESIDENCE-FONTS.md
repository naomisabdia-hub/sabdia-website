# Residence name fonts (14 Sep 2026)

Each residence's name is set in the face its brochure uses. The faces were
read from the brochure PDFs (`pdffonts`) and the name glyphs extracted from
the embedded subsets, so the site draws exactly what the brochure draws.

| Residence | Face in the brochure | Case | File |
|---|---|---|---|
| AETHER | Sephir | capitals | media/fonts/aether-name.ttf |
| SOLACE | Century Expanded (Bitstream) | capitals | media/fonts/solace-name.ttf |
| QASR | Hello Paris Serif | capitals | media/fonts/qasr-name.ttf |
| SIERRA | AdU Script | "Sierra" | media/fonts/sierra-name.ttf |
| CASPIAN | Papyrus | "Caspian" | media/fonts/caspian-name.ttf |
| CAPRI | Garamond | "Capri" | media/fonts/capri-name.ttf |

Files live in the Supabase `media` bucket under `fonts/`. Each product
carries the four metafields the theme reads (Products › the residence ›
Residence name font / font file / weight / capitals), so the face follows
the name onto every card, the residence page, the flagship band and the
rail. Capitals off prints the name as the brochure writes it (Sierra, not
SIERRA).

The font sheet `~/Downloads/CASPIAN.pdf` shows SOLACE and AETHER in Egizio;
the brochures themselves use Century Expanded and Sephir, and the brochures
won. Swap by changing the metafield.

**Licensing.** The subsets contain only the letters of each name, taken from
brochures Sabdia already publishes, but web embedding is a separate licence
from print for commercial faces (Sephir, Hello Paris, DIN Next, Century).
Confirm the brochure designer's licence covers the site, or buy web licences
for the six faces.

**A new residence:** upload its name font (a .ttf/.otf/.woff2) to
`media/fonts/`, then fill the four metafields on the product.
