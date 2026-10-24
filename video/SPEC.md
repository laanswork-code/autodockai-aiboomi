# SPEC: AutoDock × Jev, the pitch film

GOAL:    the viewer understands that parking and charging is a Kerala and India wide problem, sees one real site
         (KSUM) solved in a live digital twin, and leaves knowing why Jev decides and asks a person when unsure.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    ~119 s x 30 = ~3570 frames. Narration is the clock (assets/voice/timing.json); every title lands on
         the word that says it. build.mjs derives all timing from the words, so a retake re-times the film.
LOOK:    ground #f3efe6 paper (the app's own), ink #16181b, sign blue #1747a6 rationed to Jev and the payoff,
         road-marking stripe (yellow #f0b91c on ink, 46/28 px dashes) as the film's one motif, top edge only.
         Inter 800 for titles at 84-150 px (8-14% of height), -2% tracking; Inter 500 body 34-40 px.
         Medium: the real product UI, captured at 2x (assets/shots), shown at 1.6-2x its real size.
         Cards: 18 px radius, 1 px #d4ccbb border, shadow 0 30 60 -30 rgba(22,24,27,.45).
OBJECTS: the twin (real 3D site), the towers, real decision card, real operator review, real pipeline
         diagram, real dashboard and problems page. Nothing invented to look like the product.
MOTION:  arrivals expo.out 0.7 s; camera moves power2.inOut 1.2-1.6 s; exits power3.in 0.35 s.
         Titles: per word blur 8 px -> 0 and opacity 0 -> 1, 0.14 s, 0.07 s apart, no translate; dead still
         once landed. Cards: scale 0.92 -> 1 with blur 10 -> 0, 0.6 s expo.out. Numbers: count up 0.9 s.
SHOTS:   hook 0-12 (complaint cards scroll, three lines) | problem 12-31 (474 lands, cities and causes on
         their words, the /problems page) | reveal 31-49 (twin today, push in, "digital twin", cut through to
         the towers, 4 bays 40 cars) | why 49-69 (control room, the four questions, "That's why: Jev", real
         decision card, 1 request 5 answers, 0.5 s, $0.00008) | how 69-89 (pipeline diagram, confidence,
         the camera misread in the review queue, rules fallback, event log) | proof 89-104 (simulated table:
         -29% grid peak, -24% energy, 0 missed; live dashboard) | claim + end card 104-119.
BANNED:  dark void, glow, particles, purple gradients, glass cards, three cards in a row, KPI grids as
         decoration, titles that drift after landing, everything fading in together, logo docked in a
         corner, invented UI, numbers not in the repo.
QA:      frames at 2, 14, 20, 28, 38, 46, 54, 62, 80, 93, 102, 116 s: each shows one readable idea, real UI,
         text inside title-safe, nothing clipped.
