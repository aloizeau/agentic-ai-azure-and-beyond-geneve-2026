// =============================================================================
//  IA agentique : vers Azure et au-delà !
//  REX — architectures IA d'entreprise : AKS · écosystème Solo.io · Microsoft Foundry
//  Talk de ~45 min · jeudi 29 octobre 2026, 18:00–21:00 · Tesla Store Genève
//  Antoine LOIZEAU · Smart Cloud Architect
//
//  NODE_PATH=<modules globaux> node build-rex.js               → rex-architectures-ia-entreprise.pptx
//  THEME=clair NODE_PATH=<modules globaux> node build-rex.js   → rex-architectures-ia-entreprise-clair.pptx
//  Programme annoncé : (1) Microsoft Foundry et les architectures IA d'entreprise,
//  (2) déploiement et orchestration sur AKS, (3) Solo.io Agent Gateway et Agent
//  Registry, (4) kagent et la gestion du cycle de vie des agents, (5) REX,
//  gouvernance et bonnes pratiques.
//  Démos à l'écran = dossiers du dépôt (PowerShell) :
//  A → demos/A-ratelimit-entra (section 03), B → demos/B-agent-equipe (section 04),
//  C → demos/C-nemo-guardrails (section 05).
// =============================================================================
const { C, H, B, M, W, MX, LOGO_PATH, LOGO_RATIO, PHOTO_PATH, prepareAssets, createDeck, SUFFIX, pt } = require("./theme");

const EVENT = { kicker: "CHALET AZURE ROMANDIE · JEUDI 29 OCTOBRE 2026 · GENÈVE", place: "Tesla Store Genève · Rue de la Confédération 8 · 18:00–21:00" };

// Minutage : 40 min de talk + 5 min de questions. Un créneau par slide, dans l'ordre.
const TIMES = [null,
  "0:00 — 0:20", "0:20 — 0:50", "0:50 — 2:20", "2:20 — 3:00", "3:00 — 3:30",       // ouverture
  "3:30", "3:30 — 4:30", "4:30 — 5:45", "5:45 — 7:00", "7:00 — 8:15",                // 01 Foundry
  "8:15", "8:15 — 9:15", "9:15 — 10:15",                                              // 02 AKS
  "10:15", "10:15 — 11:15", "11:15 — 12:00", "12:00 — 15:30", "15:30 — 16:30",       // 03 Solo.io (démo A)
  "16:30 — 17:30", "17:30 — 18:15", "18:15 — 19:15",
  "19:15", "19:15 — 20:00", "20:00 — 20:45", "20:45 — 22:00", "22:00 — 22:45",       // 04 kagent (démo B, vidéo)
  "22:45 — 23:30", "23:30 — 27:30", "27:30 — 28:30", "28:30 — 29:15",
  "29:15", "29:15 — 30:30", "30:30 — 31:30", "31:30 — 32:15", "32:15 — 32:45",       // 05 REX (garde-fous, démo C)
  "32:45 — 33:30", "33:30 — 34:00", "34:00 — 34:30", "34:30 — 37:30",
  "37:30 — 38:15", "38:15 — 38:45", "38:45 — 40:00",
  "40:00 — 45:00",                                                                    // questions
  "ANNEXE", "ANNEXE", "ANNEXE", "ANNEXE", "ANNEXE", "ANNEXE",
];

const D = createDeck({
  title: "IA agentique : vers Azure et au-delà !",
  footer: "IA agentique : vers Azure et au-delà !  ·  Antoine LOIZEAU",
  times: TIMES,
});
const N = {};   // numéros de slides utiles aux notes, relevés pendant la construction
const { pres, icon, newSlide, kicker, title, labels, card, iconCircle, txt, bullets, code, arrow, line, tag, pill, num, divider } = D;

// Table helpers
// Cellules de tableau : la taille passe par pt() (lisibilité en projection)
const cell = (t, base, o) => { const opt = { ...base, ...o }; opt.fontSize = pt(opt.fontSize); return { text: t, options: opt }; };
const hd = (t, o = {}) => cell(t, { fill: { color: C.surf2 }, color: C.white, bold: true, fontFace: H, fontSize: 12.5, align: "center", valign: "middle" }, o);
const lb = (t, o = {}) => cell(t, { fill: { color: C.surf }, color: C.text, fontFace: B, fontSize: 12, valign: "middle", bold: true }, o);
const cl = (t, o = {}) => cell(t, { fill: { color: C.surf }, color: C.text, fontFace: B, fontSize: 11.5, valign: "middle", align: "center" }, o);
const TB = { border: { type: "solid", color: C.bg, pt: 2 } };

(async () => {
  await prepareAssets();
  // =================================================================== OUVERTURE
  // ----------------------------------------------------------------- 1. Titre
  {
    const s = newSlide({ footer: false });
    kicker(s, EVENT.kicker);
    txt(s, "IA agentique :\nvers Azure et au-delà !", MX, 1.3, 8.6, 2.2, { face: H, size: 46, bold: true, color: C.white });
    txt(s, "REX — architectures IA d'entreprise", MX, 3.55, 8.6, 0.5, { size: 22, color: C.text });
    txt(s, "AKS  ·  écosystème Solo.io  ·  Microsoft Foundry", MX, 4.1, 8.6, 0.5, { size: 20, color: C.accent, bold: true });
    txt(s, "Une plateforme d'agents robuste, gouvernée et prête pour l'entreprise : ce qui a marché, ce qui a fait mal.", MX, 4.65, 8.2, 0.8, { size: 15, color: C.muted, lsm: 1.1 });
    s.addImage({ path: LOGO_PATH, x: MX, y: 5.75, w: 0.78 * LOGO_RATIO, h: 0.78, altText: "Logo Smart Cloud Architect" });
    txt(s, "Antoine LOIZEAU", MX + 0.78 * LOGO_RATIO + 0.25, 5.78, 6, 0.4, { face: H, size: 18, bold: true, color: C.white });
    txt(s, "Senior Cloud Architect · Smart Cloud Architect", MX + 0.78 * LOGO_RATIO + 0.25, 6.18, 6, 0.35, { size: 13, color: C.muted });
    txt(s, EVENT.place, MX, 6.85, 9, 0.3, { size: 11, color: C.dim });
    labels(s, [["cloud", "azure"], ["cloud", "au-delà"]], { x: 9.4, y: 2.2, size: 22 });
    s.addNotes(
      "MESSAGE · On part d'Azure… et on garde la liberté d'aller au-delà.\n• Remercier le Chalet Azure Romandie, qui organise, et le Tesla Store Genève, qui nous accueille.\n• Laisser le clin d'œil du titre faire sourire, sans le commenter.\n• « Microsoft AI Foundry » dans l'annonce = Microsoft Foundry aujourd'hui : même service, renommé.\n→ « Avant l'architecture, je vais vous raconter un week-end. »"
    );
  }

  // ----------------------------------------------------------------- 2. Qui suis-je
  {
    const s = newSlide();
    kicker(s, "QUI SUIS-JE");
    const lx = MX, lw = 4.15, ly = 1.0, lh = 5.75;
    card(s, lx, ly, lw, lh);
    const d = 1.85, px = lx + (lw - d) / 2, py = ly + 0.25;
    s.addShape(pres.shapes.OVAL, { x: px - 0.07, y: py - 0.07, w: d + 0.14, h: d + 0.14, fill: { color: C.surf }, line: { color: C.accent, width: 3 } });
    s.addImage({ path: PHOTO_PATH, x: px, y: py, w: d, h: d, rounding: true, altText: "Portrait d'Antoine LOIZEAU" });
    txt(s, "Antoine", lx, 3.22, lw, 0.45, { face: H, size: 24, color: C.white, align: "center" });
    txt(s, "LOIZEAU", lx, 3.6, lw, 0.55, { face: H, size: 30, bold: true, color: C.white, align: "center", cs: 2 });
    txt(s, "Senior Cloud Architect · Freelance", lx, 4.15, lw, 0.35, { size: 14, color: C.muted, align: "center" });
    s.addImage({ path: LOGO_PATH, x: lx + 0.45, y: 4.7, w: 0.55 * LOGO_RATIO, h: 0.55, altText: "Logo Smart Cloud Architect" });
    txt(s, "Smart Cloud Architect", lx + 0.45 + 0.55 * LOGO_RATIO + 0.2, 4.68, 2.5, 0.33, { face: H, size: 14, bold: true, color: C.white });
    txt(s, "smartcloudarchitect.fr", lx + 0.45 + 0.55 * LOGO_RATIO + 0.2, 4.98, 2.5, 0.3, { size: 12, color: C.accent });
    [["MCT", "Microsoft Certified Trainer"], ["MVP 2024", "Azure Infrastructure as Code"]].forEach((p, i) => {
      const y = 5.55 + i * 0.55;
      s.addText(p[0], {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: lx + 0.45, y, w: 1.2, h: 0.38,
        fill: { color: C.bg }, line: { color: C.accent, width: 1.25 },
        fontFace: H, fontSize: 11, bold: true, color: C.accent, align: "center", valign: "middle", margin: 0, isTextBox: true,
      });
      txt(s, p[1], lx + 1.8, y, 2.25, 0.38, { size: 12, color: C.text, valign: "middle" });
    });
    const rx = 5.15, rw = W - MX - rx;
    txt(s, "Ce que je fais", rx, 1.0, rw, 0.55, { face: H, size: 24, bold: true, color: C.white });
    const rows = [
      ["FaProjectDiagram", "Concevoir", "plateformes cloud sur Azure", "Réseau, AKS, identité, Infrastructure as Code — et depuis deux ans, des plateformes d'agents IA."],
      ["FaPenNib", "Partager", "blog.smartcloudarchitect.fr", "Retours d'expérience écrits, conférences, meetups — comme ce soir."],
      ["FaUsers", "Transmettre", "formation et accompagnement", "Former les équipes jusqu'à ce qu'elles n'aient plus besoin de moi."],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 1.75 + i * 1.62, h = 1.45;
      card(s, rx, y, rw, h);
      await iconCircle(s, rows[i][0], rx + 0.3, y + 0.3, 0.85, C.accent);
      txt(s, rows[i][1], rx + 1.4, y + 0.18, 3.6, 0.4, { face: H, size: 17, bold: true, color: C.white });
      const qr = i === 1;   // « Partager » : QR code du blog, sur fond blanc pour rester lisible en thème sombre
      const tagRight = qr ? rx + rw - 1.55 : rx + rw - 0.25;
      txt(s, rows[i][2], tagRight - 3.6, y + 0.2, 3.6, 0.35, { face: M, size: 11, color: C.accent, align: "right" });
      txt(s, rows[i][3], rx + 1.4, y + 0.62, rw - 1.65 - (qr ? 1.3 : 0), 0.7, { size: 13.5, color: C.text, lsm: 1.05 });
      if (qr) {
        const qd = 1.21, qx = rx + rw - qd - 0.12, qy = y + 0.12;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: qx - 0.04, y: qy - 0.04, w: qd + 0.08, h: qd + 0.08, rectRadius: 0.06, fill: { color: "FFFFFF" }, line: { color: C.accent, width: 1.25 } });
        s.addImage({ path: "assets/qr-blog.png", x: qx, y: qy, w: qd, h: qd, altText: "QR code : blog.smartcloudarchitect.fr" });
      }
    }
    txt(s, "Le Terraform, les manifestes, les démos et les tableaux de bord de ce soir sont publiés.", rx, 6.52, rw, 0.35, { size: 13, italic: true, color: C.accent });
    s.addNotes(
      "MESSAGE · Tout ce que vous allez voir est publié et rejouable.\n• 30 secondes : architecte cloud freelance, MCT, MVP 2024 Azure Infrastructure as Code.\n• Le QR code de la carte « Partager » mène au blog ; celui du dépôt est sur la slide « Merci ».\n→ L'histoire."
    );
  }

  // ----------------------------------------------------------------- 3. Cold open
  {
    const s = newSlide();
    kicker(s, "UN VENDREDI SOIR", C.yellow);
    txt(s, "60 000 €", MX, 1.35, 9, 2.0, { face: H, size: 130, bold: true, color: C.yellow });
    txt(s, "consommés en un week-end", MX, 3.45, 9, 0.7, { face: H, size: 32, bold: true, color: C.white });
    txt(s, "Une clé API qui fuite. Aucune limite de consommation.\nPersonne pour regarder avant le lundi matin.", MX, 4.6, 8.5, 1.2, { size: 20, color: C.muted, lsm: 1.15 });
    labels(s, [["identité", "partagée"], ["limite", "aucune"], ["trace", "aucune"]], { x: 9.0, y: 1.95, color: C.yellow, size: 18 });
    s.addNotes(
      "MESSAGE · Ce n'est pas une histoire de hackers, c'est une histoire d'architecture.\n• Un groupe média français, ~3 000 collaborateurs. Ne jamais nommer le client, même en questions.\n• L'IA ouverte à tous, sans limite. Vendredi soir, une clé fuit. Lundi matin : plus de 60 000 €.\n• Marquer un silence après le chiffre.\n→ « Qu'est-ce qui manquait ? Trois choses. »"
    );
  }

  // ----------------------------------------------------------------- 4. Ce qui manquait
  {
    const s = newSlide();
    kicker(s, "LE DIAGNOSTIC");
    title(s, "Ce qui manquait à nos agents");
    const cards = [
      ["FaIdCard", "Identité", "Qui appelle ?", "Une clé partagée ne dit rien de la personne, de l'équipe ni de l'agent."],
      ["FaTachometerAlt", "Limite", "Combien ?", "Aucun plafond, aucun budget par équipe, aucun coupe-circuit."],
      ["FaEye", "Trace", "Quoi, avec quel outil ?", "Aucune métrique par modèle, par consommateur ni par outil : on découvre la facture."],
    ];
    for (let i = 0; i < 3; i++) {
      const x = MX + i * 4.1, y = 2.2, w = 3.8, h = 3.5;
      card(s, x, y, w, h);
      await iconCircle(s, cards[i][0], x + 0.35, y + 0.4, 0.9, C.yellow);
      txt(s, cards[i][1], x + 0.35, y + 1.5, w - 0.7, 0.5, { face: H, size: 24, bold: true, color: C.white });
      txt(s, cards[i][2], x + 0.35, y + 2.05, w - 0.7, 0.4, { size: 16, color: C.accent, italic: true });
      txt(s, cards[i][3], x + 0.35, y + 2.5, w - 0.7, 0.9, { size: 14, color: C.muted, lsm: 1.1 });
    }
    txt(s, "Une plateforme d'agents « prête pour l'entreprise », c'est d'abord ces trois réponses.", MX, 6.1, 12, 0.5, { face: H, size: 19, bold: true, color: C.accent });
    s.addNotes(
      "MESSAGE · Identité, limite, trace : les trois questions du talk.\n• Qui appelle ? Combien ? Quoi, avec quel outil ?\n• Chaque brique du programme répond à l'une d'elles.\n→ Le programme."
    );
  }

  // ----------------------------------------------------------------- 5. Programme
  {
    const s = newSlide();
    kicker(s, "AU PROGRAMME");
    title(s, "Cinq étapes, trois démos");
    const p = [
      ["01", "Microsoft Foundry et les architectures IA d'entreprise", "Où Foundry s'arrête, où la plateforme commence", ""],
      ["02", "Déploiement et orchestration sur AKS", "Terraform, Workload Identity, deux portes", ""],
      ["03", "Solo.io Agent Gateway et Agent Registry", "Jeton Entra, plafonds · garde-fous Foundry → NVIDIA NeMo · catalogue", "DÉMO A"],
      ["04", "kagent et le cycle de vie des agents", "De la v0 à la v1 · une équipe « Agent Ready » en deux pipelines", "DÉMO B"],
      ["05", "REX, gouvernance et bonnes pratiques", "Identité Entra ID, coûts et audit · socle de garde-fous", "DÉMO C"],
    ];
    p.forEach((it, i) => {
      const y = 1.95 + i * 0.95;
      card(s, MX, y, 12.13, 0.8, { line: i % 2 ? C.surf2 : C.surf2 });
      txt(s, it[0], MX + 0.25, y, 1.0, 0.8, { face: H, size: 28, bold: true, color: C.deep, valign: "middle" });
      txt(s, it[1], MX + 1.3, y + 0.08, 7.3, 0.4, { face: H, size: 17, bold: true, color: C.white });
      txt(s, it[2], MX + 1.3, y + 0.44, 7.3, 0.3, { size: 12.5, color: C.muted });
      if (it[3]) pill(s, it[3], C.green, MX + 10.4, y + 0.23, 1.5);
    });
    s.addNotes(
      "MESSAGE · Cinq étapes, trois démos réparties dans le talk.\n• Démo A en direct, démo B en vidéo, démo C en direct.\n• 30 secondes, ne pas détailler.\n→ Étape 1 : Foundry."
    );
  }

  // =================================================================== 01 FOUNDRY
  await divider("01", "Microsoft Foundry et les architectures IA d'entreprise", "Où Foundry s'arrête, où la plateforme commence.",
      "→ On part du besoin du client, puis on place Foundry dans l'architecture."
    , "Foundry · architecture de référence");

  // ----------------------------------------------------------------- 7. Contexte REX
  {
    const s = newSlide();
    kicker(s, "LE CONTEXTE");
    title(s, "Chaque projet branchait son SDK et sa clé");
    card(s, MX, 2.0, 5.6, 4.6);
    txt(s, "Groupe média français", MX + 0.35, 2.25, 5, 0.45, { face: H, size: 20, bold: true, color: C.white });
    txt(s, "~3 000 collaborateurs", MX + 0.35, 2.7, 5, 0.4, { size: 16, color: C.accent });
    bullets(s, [
      "Objectif : une plateforme agentique centralisée",
      "Un front unique au niveau du groupe",
      "Des connecteurs vers le SI : Jira, Azure DevOps, SharePoint…",
      "Point de départ : une intégration IA par projet, sans socle commun",
    ], MX + 0.35, 3.3, 4.9, 3.1, { size: 15, psa: 10 });
    const bx = 6.8;
    txt(s, "AVANT", bx, 2.0, 2, 0.3, { face: H, size: 11, bold: true, color: C.yellow, cs: 2 });
    for (let i = 0; i < 3; i++) {
      const y = 2.4 + i * 0.62;
      card(s, bx, y, 1.6, 0.48, { fill: C.surf2, line: C.border });
      txt(s, `Projet ${String.fromCharCode(65 + i)}`, bx, y, 1.6, 0.48, { size: 12, align: "center", valign: "middle" });
      arrow(s, bx + 1.65, y + 0.24, 0.55, 0, C.yellow);
      card(s, bx + 2.25, y, 1.7, 0.48, { fill: C.surf, line: C.yellow });
      txt(s, "SDK + clé", bx + 2.25, y, 1.7, 0.48, { size: 12, align: "center", valign: "middle", color: C.yellow });
      arrow(s, bx + 4.0, y + 0.24, 0.55, 0, C.yellow);
      card(s, bx + 4.6, y, 1.35, 0.48, { fill: C.surf2, line: C.border });
      txt(s, "Modèle", bx + 4.6, y, 1.35, 0.48, { size: 12, align: "center", valign: "middle" });
    }
    txt(s, "APRÈS", bx, 4.45, 2, 0.3, { face: H, size: 11, bold: true, color: C.green, cs: 2 });
    for (let i = 0; i < 3; i++) {
      const y = 4.85 + i * 0.62;
      card(s, bx, y, 1.6, 0.48, { fill: C.surf2, line: C.border });
      txt(s, `Projet ${String.fromCharCode(65 + i)}`, bx, y, 1.6, 0.48, { size: 12, align: "center", valign: "middle" });
      arrow(s, bx + 1.65, y + 0.24, 0.55, 0, C.green);
    }
    card(s, bx + 2.25, 4.85, 1.7, 1.72, { fill: C.surf, line: C.green, lw: 1.5 });
    txt(s, "Plateforme\ncommune", bx + 2.25, 4.85, 1.7, 1.72, { size: 13, bold: true, align: "center", valign: "middle", color: C.green });
    arrow(s, bx + 4.0, 5.71, 0.55, 0, C.green);
    card(s, bx + 4.6, 4.85, 1.35, 1.72, { fill: C.surf2, line: C.border });
    txt(s, "Modèles\nFoundry", bx + 4.6, 4.85, 1.35, 1.72, { size: 12, align: "center", valign: "middle" });
    s.addNotes(
      "MESSAGE · Sans socle commun, chacun réinvente tout et personne ne voit la facture.\n• Chaque projet : son SDK, sa clé, ses connecteurs, son authentification.\n• Le week-end à 60 000 € n'est que le symptôme le plus visible.\n→ « Voici le socle qu'on a construit. »"
    );
  }

  // ----------------------------------------------------------------- 8. Cinq couches
  {
    const s = newSlide();
    kicker(s, "ARCHITECTURE DE RÉFÉRENCE");
    title(s, "Une architecture IA d'entreprise, ce sont cinq couches");
    const layers = [
      ["FaComments", "Front", "Où les gens travaillent", "LibreChat · Entra ID", C.accent],
      ["FaRobot", "Agents", "Ce que les équipes construisent", "kagent (CNCF Sandbox)", C.violet],
      ["FaPlug", "Outils", "Ce que les agents ont le droit de faire", "serveurs MCP · kmcp · catalogue agentregistry", C.violet],
      ["FaShieldAlt", "Passerelle", "Qui, combien, quoi — pour tout le trafic", "agentgateway (Linux Foundation)", C.green],
      ["FaMicrochip", "Modèles", "L'intelligence, interchangeable", "Microsoft Foundry · modèles dans AKS (KAITO)", C.yellow],
    ];
    layers.forEach((l, i) => {
      const y = 1.95 + i * 0.88, h = 0.74;
      card(s, MX, y, 9.0, h, { line: l[4], lw: 1.25 });
      txt(s, l[1], MX + 0.95, y, 1.7, h, { face: H, size: 17, bold: true, color: C.white, valign: "middle" });
      txt(s, l[2], MX + 2.7, y + 0.08, 3.2, h - 0.16, { size: 12.5, color: C.muted, valign: "middle" });
      txt(s, l[3], MX + 5.85, y + 0.08, 3.05, h - 0.16, { face: M, size: 10.5, color: l[4], valign: "middle" });
    });
    for (let i = 0; i < layers.length; i++) await iconCircle(s, layers[i][0], MX + 0.2, 1.95 + i * 0.88 + 0.1, 0.54, layers[i][4]);
    // Transverse
    const tx = MX + 9.3, tw = W - MX - tx;
    card(s, tx, 1.95, tw, 4.26, { fill: C.tintBlue, line: C.accent, lw: 1.5 });
    txt(s, "TRANSVERSE", tx + 0.2, 2.1, tw - 0.4, 0.3, { face: H, size: 11, bold: true, color: C.accent, cs: 2 });
    const tr = [["Identité", "Entra ID · Workload ID"], ["Observabilité", "Prometheus · Grafana"], ["Gouvernance", "politiques · catalogue"], ["Livraison", "Terraform · GitHub OIDC"]];
    tr.forEach((t, i) => {
      txt(s, t[0], tx + 0.2, 2.55 + i * 0.9, tw - 0.4, 0.35, { face: H, size: 15, bold: true, color: C.white });
      txt(s, t[1], tx + 0.2, 2.9 + i * 0.9, tw - 0.4, 0.35, { size: 12, color: C.muted });
    });
    txt(s, "La règle du REX : aucune couche ne parle directement à un fournisseur de modèles. Tout passe par la passerelle.", MX, 6.4, 12.1, 0.45, { size: 15, italic: true, color: C.accent });
    s.addNotes(
      "MESSAGE · Aucune couche ne parle directement à un fournisseur de modèles.\n• La carte du talk : cinq couches, une brique open source par couche, quatre sujets transverses.\n• Foundry est la couche du bas ; tout le reste tourne dans AKS.\n• Décision clé : aucun agent, aucun front ne détient de clé fournisseur.\n→ Ce qu'on prend à Foundry."
    );
  }

  // ----------------------------------------------------------------- 9. Foundry dans l'architecture
  {
    const s = newSlide();
    kicker(s, "MICROSOFT FOUNDRY");
    title(s, "Ce que nous prenons à Foundry");
    const left = [
      ["FaCubes", "Un compte, un projet", "Ressource AI Services + projet Foundry, déployés par Terraform azurerm."],
      ["FaMicrochip", "Trois profils de modèle", "gpt-5.6-sol (frontier, Global) · terra (quotidien, DataZone UE) · luna (volume, DataZone UE)."],
      ["FaKey", "Sans clé", "local_auth désactivé. La passerelle s'authentifie par Workload Identity, scope ai.azure.com."],
      ["FaShieldAlt", "Les garde-fous", "Filtres de contenu et Prompt Shields sur chaque déploiement : ce qui tourne en production."],
    ];
    for (let i = 0; i < left.length; i++) {
      const y = 1.95 + i * 1.12;
      card(s, MX, y, 6.95, 0.98);
      await iconCircle(s, left[i][0], MX + 0.2, y + 0.17, 0.64, C.green);
      txt(s, left[i][1], MX + 1.05, y + 0.1, 5.7, 0.35, { face: H, size: 15, bold: true, color: C.white });
      txt(s, left[i][2], MX + 1.05, y + 0.46, 5.75, 0.5, { size: 12, color: C.muted, lsm: 1.0 });
    }
    const rx = 7.85, rw = W - MX - rx;
    card(s, rx, 1.95, rw, 4.34, { line: C.yellow, lw: 1.25 });
    txt(s, "CE QUE NOUS N'EN ATTENDONS PAS", rx + 0.25, 2.1, rw - 0.5, 0.3, { face: H, size: 11, bold: true, color: C.yellow, cs: 1 });
    bullets(s, [
      "L'exécution des agents : ils tournent dans AKS, à côté des données et des outils du SI",
      "Le contrôle d'accès des utilisateurs et des équipes : il vit à la passerelle, pour tous les modèles",
      "Le catalogue des outils : agentregistry, dans le cluster",
    ], rx + 0.25, 2.55, rw - 0.5, 2.6, { size: 13.5, psa: 10 });
    txt(s, "Endpoint OpenAI v1, sans api-version. Le scope cognitiveservices.azure.com est remplacé par ai.azure.com.", rx + 0.25, 5.25, rw - 0.5, 0.9, { size: 11.5, italic: true, color: C.muted });
    s.addNotes(
      "MESSAGE · Foundry, ce sont nos modèles et notre première ligne de garde-fous.\n• Trois profils GPT-5.6 : Sol en Global (travaux complexes), Terra et Luna en Data Zone UE.\n• Sans clé : la passerelle s'authentifie en Workload Identity.\n• Pièges vécus (annexe) : rôles renommés, GUID inchangés · /models retiré le 26/08/2026 · nouveau scope ai.azure.com.\n→ « Pourquoi pas Foundry Agent Service ? »"
    );
  }

  // ----------------------------------------------------------------- 10. Agent Service ou AKS
  {
    const s = newSlide();
    N.agentService = D.count();
    kicker(s, "LE CHOIX D'ARCHITECTURE");
    title(s, "Foundry Agent Service ou plateforme AKS ?");
    const rows = [
      [hd(""), hd("Foundry Agent Service"), hd("Plateforme sur AKS (ce REX)")],
      [lb("Où tournent les agents"), cl("Service managé Azure (agents hébergés)"), cl("Votre cluster, à côté des outils du SI")],
      [lb("Identité des agents"), cl("Entra Agent ID, natif"), cl("À construire : clés d'équipe, Workload ID")],
      [lb("Garde-fous"), cl("Foundry, y compris appels et réponses d'outils (préversion)"), cl("À la passerelle, quel que soit le modèle")],
      [lb("Modèles"), cl("Catalogue Foundry, passerelle IA APIM pour d'autres"), cl("Foundry, Bedrock, modèles dans AKS…")],
      [lb("Exploitation"), cl("Microsoft l'opère", { color: C.green, bold: true }), cl("Vous l'opérez", { color: C.yellow, bold: true })],
      [lb("Portabilité"), cl("Azure"), cl("Tout Kubernetes", { color: C.green, bold: true })],
    ];
    s.addTable(rows, { x: MX, y: 1.9, w: 12.13, colW: [3.0, 4.565, 4.565], rowH: [0.45, 0.55, 0.55, 0.62, 0.55, 0.5, 0.5], ...TB });
    card(s, MX, 5.95, 12.13, 0.82, { fill: C.surf, line: C.accent });
    txt(s, "Pas un camp à choisir : Foundry Control Plane sait inscrire des agents externes (A2A, via sa passerelle IA). Une piste pour faire voir nos agents kagent dans Foundry.", MX + 0.3, 5.95, 11.5, 0.82, { size: 13.5, color: C.white, valign: "middle" });
    s.addNotes(
      "MESSAGE · Pas un camp à choisir : AKS répondait à nos contraintes.\n• Notre besoin : des agents près des outils du SI, plusieurs fournisseurs, du self-service Kubernetes.\n• Honnêteté : Agent Service apporte nativement ce qu'on a construit — Entra Agent ID (GA), garde-fous sur les appels d'outils.\n• Foundry Control Plane sait inscrire des agents externes : une piste, non testée.\n→ Étape 2 : AKS."
    );
  }

  // =================================================================== 02 AKS
  await divider("02", "Déploiement et orchestration sur AKS", "Une plateforme qui sort de terre en un apply.",
      "→ Du concept au concret : ce qui tourne dans le cluster, et comment ça arrive."
    , "AKS · Terraform · Workload ID");

  // ----------------------------------------------------------------- 12. Architecture
  {
    const s = newSlide();
    kicker(s, "ARCHITECTURE");
    title(s, "Tout ce qui est dans le cluster est portable", { size: 26 });
    card(s, MX, 2.0, 1.75, 0.95, { fill: C.surf2, line: C.border });
    txt(s, "Utilisateurs", MX, 2.0, 1.75, 0.95, { size: 13, bold: true, align: "center", valign: "middle" });
    card(s, MX, 3.35, 1.75, 0.95, { fill: C.surf, line: C.accent });
    txt(s, "Entra ID", MX, 3.35, 1.75, 0.95, { face: H, size: 14, bold: true, color: C.accent, align: "center", valign: "middle" });
    card(s, MX, 4.7, 1.75, 1.4, { fill: C.surf, line: C.border });
    txt(s, "GitHub Actions\nTerraform", MX, 4.7, 1.75, 1.4, { size: 12, bold: true, align: "center", valign: "middle", color: C.muted });

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.65, y: 1.85, w: 7.55, h: 4.75, rectRadius: 0.12, fill: { color: C.zone }, line: { color: C.green, width: 1.5, dashType: "dash" } });
    txt(s, "AKS  ·  couches portables", 2.85, 1.95, 4, 0.3, { face: H, size: 11, bold: true, color: C.green, cs: 1 });
    const box = (t, sub, x, y, w, h, ln = C.border, tc = C.white) => {
      card(s, x, y, w, h, { fill: C.surf, line: ln });
      txt(s, t, x + 0.1, y + 0.12, w - 0.2, 0.35, { face: H, size: 14, bold: true, color: tc, align: "center" });
      if (sub) txt(s, sub, x + 0.1, y + 0.5, w - 0.2, h - 0.6, { size: 11, color: C.muted, align: "center" });
    };
    box("LibreChat", "front unique\nOIDC Entra", 2.9, 2.4, 1.9, 1.3);
    box("agentgateway", "JWT · clés d'équipe\ngarde-fous · plafonds\nLLM + MCP · coûts", 5.2, 2.35, 2.8, 1.75, C.accent, C.accent);
    box("Grafana", "Usage IA :\ncoût · outils\npar personne", 8.35, 2.4, 1.65, 1.3);
    box("agentregistry", "catalogue\nMCP · prompts\nskills", 2.9, 4.6, 1.7, 1.5, C.violet, C.violet);
    box("kagent", "agents\ndéclaratifs\nSRE · métier", 4.8, 4.6, 1.55, 1.5, C.violet, C.violet);
    box("Serveurs MCP", "Jira · web\nGrafana · Azure", 6.55, 4.6, 1.6, 1.5);
    box("Modèles AKS", "KAITO · vLLM\nGPU à la\ndemande", 8.35, 4.6, 1.65, 1.5, C.green, C.green);

    card(s, 10.55, 1.85, 2.2, 2.55, { fill: C.surf, line: C.yellow });
    txt(s, "Microsoft Foundry", 10.6, 1.92, 2.1, 0.35, { face: H, size: 13, bold: true, color: C.yellow, align: "center" });
    card(s, 10.65, 2.32, 2.0, 0.78, { fill: C.tintGreen, line: C.green, lw: 1.5 });
    s.addImage({ data: await icon("FaShieldAlt", C.green), x: 10.75, y: 2.47, w: 0.42, h: 0.46 });
    txt(s, "Garde-fous", 11.22, 2.36, 1.4, 0.3, { face: H, size: 12, bold: true, color: C.green, valign: "middle" });
    txt(s, "filtres · Prompt\nShields", 11.22, 2.66, 1.4, 0.42, { size: 9.5, color: C.text, valign: "top", lsm: 0.95 });
    txt(s, "Sol · frontier · Global\nTerra · daily · DataZone\nLuna · volume · DataZone", 10.6, 3.18, 2.1, 0.8, { face: M, size: 9, color: C.text, align: "center", valign: "middle", lsm: 1.15 });
    txt(s, "adaptateur Azure", 10.6, 4.02, 2.1, 0.3, { size: 10, italic: true, color: C.muted, align: "center" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.55, y: 4.7, w: 2.2, h: 1.4, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.border, width: 1.25, dashType: "dash" } });
    txt(s, "Bedrock, OVHcloud…\nun groupe de plus\ndans le même Backend", 10.6, 4.75, 2.1, 1.3, { size: 11, color: C.muted, align: "center", valign: "middle" });

    arrow(s, MX + 0.87, 2.97, 0, 0.36, C.muted);
    arrow(s, MX + 1.78, 3.55, 0.5, -0.9, C.accent);
    arrow(s, 4.83, 3.05, 0.35, 0, C.accent);
    arrow(s, 8.03, 3.05, 0.3, 0, C.muted);
    arrow(s, 5.57, 4.58, 0, -0.45, C.violet);
    arrow(s, 7.0, 4.13, 0, 0.45, C.accent);
    arrow(s, 7.75, 4.13, 0.85, 0.45, C.green);
    line(s, 8.02, 3.95, 2.35, 0, C.yellow);
    line(s, 10.37, 2.71, 0, 1.24, C.yellow);
    arrow(s, 10.37, 2.71, 0.26, 0, C.yellow);
    arrow(s, MX + 1.78, 5.4, 0.46, 0, C.muted);
    s.addNotes(
      "MESSAGE · Tout ce qui est dans le cadre vert est portable.\n• Deux adaptateurs Azure seulement : Entra ID et Foundry.\n• LibreChat appelle la passerelle avec le jeton de l'utilisateur ; les agents avec la clé de leur équipe.\n• La passerelle relaie aussi les outils MCP ; Grafana lit ses métriques : coût, jetons, outils par personne.\n→ Ce qu'AKS apporte."
    );
  }

  // ----------------------------------------------------------------- 13. Ce que AKS apporte
  {
    const s = newSlide();
    kicker(s, "AKS");
    title(s, "Ce que le cluster apporte à une plateforme d'agents");
    const g = [
      ["FaIdBadge", "Workload Identity", "Émetteur OIDC + identités managées fédérées : la passerelle appelle Foundry sans clé."],
      ["FaDoorOpen", "Deux portes", "Gateway interne (ClusterIP) et publique (IP statique, Let's Encrypt, Entra ID devant chaque UI)."],
      ["FaMicrochip", "GPU à la demande", "Add-on KAITO : un modèle ouvert dans le cluster, derrière la même passerelle."],
      ["FaNetworkWired", "Isolation", "Cilium et NetworkPolicy : seuls les proxys atteignent garde-fous et modèles."],
      ["FaCodeBranch", "Tout part de Git", "Terraform en deux phases (Azure, puis Helm), manifestes d'équipe en Kustomize. Prêt pour Argo CD ou Flux."],
      ["FaLock", "Zéro secret dans Git", "GitHub Actions s'authentifie par OIDC fédéré ; l'état Terraform par Entra ID."],
    ];
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = MX + col * 4.1, y = 1.95 + row * 2.2, w = 3.8, h = 1.98;
      card(s, x, y, w, h);
      await iconCircle(s, g[i][0], x + 0.3, y + 0.3, 0.7, C.accent);
      txt(s, g[i][1], x + 1.15, y + 0.33, w - 1.35, 0.65, { face: H, size: 15.5, bold: true, color: C.white, valign: "middle" });
      txt(s, g[i][2], x + 0.3, y + 1.1, w - 0.6, 0.8, { size: 12.5, color: C.muted, lsm: 1.05 });
    }
    txt(s, "2 × D4as_v5, plan de contrôle Free : le socle du PoC ≈ 0,41 $ de l'heure, détruit après chaque session.", MX, 6.45, 12.1, 0.4, { size: 13, italic: true, color: C.accent });
    s.addNotes(
      "MESSAGE · AKS apporte l'identité des workloads, l'isolation réseau et le GPU à la demande.\n• Piège : le label azure.workload.identity/use est obligatoire sur les pods.\n• Tout part de Git : Terraform (Azure, puis Helm), manifestes d'équipe en Kustomize.\n• Si on demande GitOps : pas d'Argo CD ni de Flux, par simplicité ; les manifestes sont prêts pour un contrôleur en pull.\n→ Étape 3 : la passerelle."
    );
  }

  // =================================================================== 03 SOLO.IO
  await divider("03", "Solo.io Agent Gateway et Agent Registry", "Un point de contrôle et un catalogue.",
      "→ La salle connaît souvent Azure API Management : le comparatif qui suit reste factuel."
    , "agentgateway · démo A · garde-fous · agentregistry");

  // ----------------------------------------------------------------- 16. Comparatif
  {
    const s = newSlide();
    kicker(s, "POURQUOI AGENTGATEWAY");
    title(s, "Trois candidats, trois terrains de prédilection");
    const v = (t) => {
      const color = /^Oui/.test(t) ? C.green : /^Non/.test(t) ? C.dim : C.text;
      return cl(t, { color, bold: /^Oui|^Non/.test(t), fontSize: 11.5 });
    };
    const rows = [
      [hd(""), hd("Azure API Management"), hd("LiteLLM"), hd("agentgateway")],
      [lb("Modèle de configuration", { bold: false }), v("Ressources Azure + policies XML"), v("config.yaml + état en base"), v("CRD Kubernetes (Gateway API)")],
      [lb("Créer un serveur MCP depuis une API REST", { bold: false }), v("Oui"), v("Non"), v("Non")],
      [lb("Fédérer N serveurs MCP derrière un endpoint", { bold: false }), v("Non"), v("Oui"), v("Oui")],
      [lb("Autorisation par outil MCP à l'exécution", { bold: false }), v("Non"), v("Oui — par clé, équipe"), v("Oui — CEL (Common Expression Language) sur le JWT")],
      [lb("Consommation par utilisateur", { bold: false }), v("Oui — métriques de jetons"), v("Oui — dépenses en base"), v("Oui — jetons et coût")],
      [lb("Portail développeur, produits, abonnements", { bold: false }), v("Oui"), v("Partiel"), v("Non")],
      [lb("Tourne hors Azure", { bold: false }), v("Self-hosted gateway"), v("Oui"), v("Oui")],
      [lb("Licence", { bold: false }), v("Propriétaire"), v("MIT + dossier enterprise"), v("Apache-2.0 · Linux Foundation")],
    ];
    s.addTable(rows, { x: MX, y: 1.85, w: 12.13, colW: [3.9, 2.75, 2.7, 2.78], rowH: [0.45, 0.5, 0.46, 0.46, 0.46, 0.46, 0.46, 0.46, 0.5], ...TB });
    txt(s, "Documentation officielle de chaque projet. Si votre point de départ est un patrimoine d'API REST, regardez APIM en premier ; pour une plateforme Kubernetes multi-fournisseurs, agentgateway.", MX, 6.3, 12.1, 0.55, { size: 11.5, color: C.dim });
    s.addNotes(
      "MESSAGE · Trois bons outils, trois terrains : notre terrain, une plateforme Kubernetes multi-fournisseurs.\n• APIM gagne sur REST → MCP et le portail ; LiteLLM et agentgateway sur la fédération MCP et l'autorisation par outil.\n• Ce qui a fait basculer : écosystème Kubernetes, Gateway API, autorisation par outil, empreinte Rust (annexe).\n• Ne jamais citer le multiple de débit de l'éditeur : mesuré sur un backend factice.\n• Si on parle de la sécurité de LiteLLM : CVE-2026-42271 (exécution de commande, corrigée en 1.83.7), chaînée à CVE-2026-48710 dans Starlette (corrigée en 1.0.1), ajoutée au catalogue KEV de la CISA début juin 2026. Message : une passerelle IA concentre toutes les clés, elle se patche comme un composant critique — agentgateway compris.\n→ Ce qui se passe dans la passerelle."
    );
  }

  // ----------------------------------------------------------------- 17. Pipeline
  {
    const s = newSlide();
    kicker(s, "UN POINT DE CONTRÔLE");
    title(s, "Chaque requête traverse la même chaîne — LLM et outils");
    const steps = [
      ["FaIdCard", "Identité", "JWT Entra ID\nou clé d'équipe"],
      ["FaFilter", "Autorisation", "CEL (Common Expression Language) sur jwt.* et mcp.tool.name"],
      ["FaShieldAlt", "Contenu", "regex · webhook\nNeMo (trafic LLM)"],
      ["FaTachometerAlt", "Plafonds", "rateLimit\nen jetons"],
    ];
    const y = 2.15, w = 1.95, h = 2.3;
    for (let i = 0; i < steps.length; i++) {
      const x = MX + i * 2.2;
      card(s, x, y, w, h);
      await iconCircle(s, steps[i][0], x + (w - 0.7) / 2, y + 0.25, 0.7, C.green);
      txt(s, steps[i][1], x + 0.1, y + 1.05, w - 0.2, 0.4, { face: H, size: 15, bold: true, color: C.white, align: "center" });
      txt(s, steps[i][2], x + 0.08, y + 1.45, w - 0.16, 0.8, { size: 10.5, color: C.accent, align: "center", lsm: 0.95 });
      arrow(s, x + w + 0.02, y + h / 2, 0.21, 0, C.muted);
    }
    const mx = MX + 4 * 2.2;
    card(s, mx, y, 1.6, h, { fill: C.surf2, line: C.yellow, lw: 1.5 });
    txt(s, "Modèle\nou outil", mx, y + 0.45, 1.6, 0.7, { face: H, size: 14, bold: true, color: C.yellow, align: "center" });
    txt(s, "Foundry,\nKAITO,\nserveur MCP", mx, y + 1.2, 1.6, 0.9, { size: 11, color: C.muted, align: "center" });
    arrow(s, mx + 1.62, y + h / 2, 0.21, 0, C.muted);
    const rx = mx + 1.85;
    card(s, rx, y, W - MX - rx, h);
    await iconCircle(s, "FaEye", rx + (W - MX - rx - 0.7) / 2, y + 0.25, 0.7, C.green);
    txt(s, "Trace", rx + 0.1, y + 1.05, W - MX - rx - 0.2, 0.4, { face: H, size: 15, bold: true, color: C.white, align: "center" });
    txt(s, "jetons · coût\nuser · team", rx + 0.1, y + 1.45, W - MX - rx - 0.2, 0.8, { size: 10.5, color: C.accent, align: "center", lsm: 0.95 });
    // Le contrôle de contenu, déplié : ce qu'il fait quand il détecte quelque chose
    const cx = MX + 2 * 2.2 + 1.95 / 2;
    line(s, cx, y + h, 0, 0.3, C.green, 1.5, "dash");
    card(s, MX, 4.75, 12.13, 0.62, { fill: C.bg, line: C.green, dash: "dash" });
    txt(s, "Si le contrôle de contenu détecte une donnée sensible :", MX + 0.25, 4.75, 4.0, 0.62, { size: 12.5, bold: true, color: C.green, valign: "middle" });
    const acts = [["MASQUER", "la remplace, puis continue", C.accent], ["REJETER", "bloque avant le modèle", C.yellow], ["AUDITER", "laisse passer, mais trace", C.muted]];
    acts.forEach((a, i) => {
      const x = MX + 4.3 + i * 2.6;
      pill(s, a[0], a[2], x, 4.89, 1.05, 0.34);
      txt(s, a[1], x + 1.15, 4.75, 1.45, 0.62, { size: 11, color: C.text, valign: "middle" });
    });
    card(s, MX, 5.55, 12.13, 0.9, { fill: C.surf, line: C.accent });
    txt(s, "Aucune ligne dans les agents : changez de modèle ou de cloud, la chaîne suit.", MX + 0.3, 5.55, 11.5, 0.9, { size: 17, color: C.white, valign: "middle", bold: true });
    s.addNotes(
      "MESSAGE · Une seule chaîne de contrôle pour les LLM et les outils, sans une ligne dans les agents.\n• Chaque étape est une AgentgatewayPolicy attachée à une route.\n• Les appels d'outils MCP passent aussi par la passerelle, avec le jeton de l'utilisateur : on sait qui appelle quoi.\n• Le bandeau vert : la réaction du contrôle de contenu — masquer, rejeter ou auditer.\n→ « Je vous le montre. »"
    );
  }

  // ----------------------------------------------------------------- 17. Démo A (demos/A-ratelimit-entra)
  {
    const s = newSlide();
    kicker(s, "DÉMO A");
    tag(s, "LIVE", C.green);
    title(s, "Stopper l'usage illimité d'un LLM");
    code(s, [
      "# 1 · une route ouverte « pour aller vite »",
      "kind: HTTPRoute",
      "spec:",
      "  rules:",
      "  - matches: [{ path: { value: /demo/v1 } }]",
      "    backendRefs: [{ kind: AgentgatewayBackend, name: llm }]",
      "---",
      "# 2 et 3 · une politique, attachée à la route",
      "kind: AgentgatewayPolicy",
      "spec:",
      "  targetRefs: [{ kind: HTTPRoute, name: llm-demo-ouverte }]",
      "  traffic:",
      "    jwtAuthentication:",
      "      mode: Strict               # pas de jeton Entra : 401",
      "      providers: [{ issuer: login.microsoftonline.com/… }]",
      "    rateLimit:",
      "      local:",
      "      - tokens: 400              # jetons LLM par minute : 429",
      "        unit: Minutes",
    ], MX, 1.95, 7.3, 4.9, { size: 10.5, label: "demos/A-ratelimit-entra/*.yaml (simplifié)" });
    const steps = [
      ["FaDoorOpen", "Route ouverte", "200, 200, 200 — n'importe qui consomme, personne ne sait qui.", C.red],
      ["FaIdCard", "+ jeton Entra ID", "401 sans jeton ; avec, la passerelle sait QUI consomme.", C.accent],
      ["FaTachometerAlt", "+ plafond", "429 au-delà de 400 jetons/min — la dépense s'arrête.", C.yellow],
      ["FaChartBar", "Qui a consommé quoi", "Grafana « Usage IA » : coût, 401 et 429, par personne.", C.green],
    ];
    for (let i = 0; i < 4; i++) {
      const y = 2.0 + i * 1.12;
      await iconCircle(s, steps[i][0], 8.3, y, 0.7, steps[i][3]);
      txt(s, steps[i][1], 9.2, y, 3.6, 0.4, { face: H, size: 15, bold: true, color: C.white });
      txt(s, steps[i][2], 9.2, y + 0.4, 3.6, 0.6, { size: 12.5, color: C.muted });
    }
    s.addNotes(
      "DÉMO A · EN DIRECT · ./demos/A-ratelimit-entra/run.ps1\n1 · Route ouverte : trois appels anonymes, 200 — « vendredi soir, la clé fuit ».\n2 · Jeton Entra ID obligatoire : 401 sans, 200 avec — la passerelle sait qui je suis.\n3 · Plafond de 400 jetons/min : 429 — « lundi matin, une alerte, pas une facture ».\n4 · Grafana, dossier Plateforme IA, filtre Utilisateur.\n• Honnêteté : plafond par route et par réplica ; un budget par équipe demande le rate limit global.\n• Secours : vidéo A. Après : reset.ps1.\n→ « Limiter, c'est fait. Filtrer le contenu, c'est l'étape suivante. »"
    );
  }

  // ----------------------------------------------------------------- 18. Garde-fous Foundry
  {
    const s = newSlide();
    kicker(s, "SÉCURISER LES LLM · ÉTAPE 1", C.green);
    tag(s, "EN PROD", C.green);
    title(s, "Les garde-fous de Microsoft Foundry");
    const ctl = [
      ["Contenus nuisibles", "haine, sexuel, violence, auto-mutilation — seuil par catégorie"],
      ["Prompt Shields", "attaques par le prompt (jailbreak) et attaques indirectes cachées dans les documents"],
      ["Données sensibles", "détection de PII, listes de blocage personnalisées"],
      ["Matériel protégé, ancrage", "texte et code sous droits · réponses non fondées (groundedness)"],
    ];
    ctl.forEach((c, i) => {
      const y = 1.95 + i * 0.92;
      card(s, MX, y, 6.3, 0.8);
      txt(s, c[0], MX + 0.25, y + 0.08, 5.8, 0.33, { face: H, size: 14.5, bold: true, color: C.white });
      txt(s, c[1], MX + 0.25, y + 0.42, 5.9, 0.33, { size: 12, color: C.muted });
    });
    // Points d'intervention
    const ix = 7.2, iw = W - MX - ix;
    txt(s, "POINTS D'INTERVENTION", ix, 1.95, iw, 0.3, { face: H, size: 11, bold: true, color: C.accent, cs: 2 });
    const pts = [["Entrée utilisateur", "modèles et agents", C.green], ["Appel d'outil", "agents Foundry seulement · préversion", C.yellow], ["Réponse d'outil", "agents Foundry seulement · préversion", C.yellow], ["Sortie", "modèles et agents", C.green]];
    pts.forEach((p, i) => {
      const y = 2.35 + i * 0.78;
      card(s, ix, y, iw, 0.66, { line: p[2] });
      txt(s, p[0], ix + 0.2, y, 2.4, 0.66, { face: H, size: 13.5, bold: true, color: C.white, valign: "middle" });
      txt(s, p[1], ix + 2.55, y, iw - 2.7, 0.66, { size: 11.5, color: p[2], valign: "middle" });
    });
    card(s, MX, 5.7, 6.3, 1.1, { fill: C.surf, line: C.yellow });
    txt(s, "Efficaces et natifs, mais attachés à chaque déploiement Azure : ils ne voient pas les appels d'outils de nos agents kagent et ne suivent pas un changement de fournisseur.", MX + 0.25, 5.7, 5.85, 1.1, { size: 12.5, color: C.white, valign: "middle", lsm: 1.05 });
    card(s, 7.2, 5.7, W - MX - 7.2, 1.1, { fill: C.tintRed, line: C.red, lw: 1.5 });
    txt(s, "ET CLAUDE ?", 7.4, 5.78, 2.5, 0.28, { face: H, size: 10.5, bold: true, color: C.red, cs: 2 });
    txt(s, "Les modèles Anthropic du catalogue Foundry n'ont aucun filtre de contenu Foundry : seules les protections d'Anthropic s'appliquent.", 7.4, 6.05, W - MX - 7.6, 0.7, { size: 12, color: C.white, lsm: 1.05 });
    s.addNotes(
      "MESSAGE · Les garde-fous Foundry tournent en production : efficaces, mais attachés aux déploiements Azure.\n• Un garde-fou = un risque, un point d'intervention, une action (annoter ou bloquer). Compter 50 à 100 ms par point activé.\n• Appel et réponse d'outil : agents Foundry seulement, en préversion. Nos agents kagent n'en profitent pas.\n• Claude dans Foundry : aucun filtre de contenu Foundry (Microsoft Learn), seules les protections d'Anthropic ; pas de Data Zone UE.\n→ « D'où une règle à la passerelle, pour tous les modèles. »"
    );
  }

  // ----------------------------------------------------------------- 19. NeMo
  {
    const s = newSlide();
    kicker(s, "SÉCURISER LES LLM · ÉTAPE 2", C.yellow);
    tag(s, "R&D", C.yellow);
    title(s, "NVIDIA NeMo Guardrails, derrière la passerelle");
    // flux
    const fx = MX, fy = 2.0;
    const fb = (t, sub, x, w, ln, tc = C.white) => { card(s, x, fy, w, 1.15, { line: ln, lw: 1.5 }); txt(s, t, x, fy + 0.14, w, 0.4, { face: H, size: 14, bold: true, color: tc, align: "center" }); txt(s, sub, x + 0.05, fy + 0.55, w - 0.1, 0.55, { size: 10.5, color: C.muted, align: "center" }); };
    fb("agentgateway", "regex natif (µs)", fx, 2.2, C.accent, C.accent);
    arrow(s, fx + 2.22, fy + 0.57, 0.5, 0, C.muted);
    txt(s, "webhook", fx + 2.12, fy + 0.15, 0.76, 0.3, { size: 9, color: C.muted, align: "center" });
    fb("Adaptateur", "contrat webhook\nagentgateway", fx + 2.8, 2.0, C.border);
    arrow(s, fx + 4.82, fy + 0.57, 0.5, 0, C.muted);
    fb("NeMo Guardrails", "rails Colang\nmode bibliothèque", fx + 5.4, 2.3, C.green, C.green);
    arrow(s, fx + 7.72, fy + 0.57, 0.5, 0, C.muted, 1.5);
    fb("LLM d'auto-contrôle", "profil strict, via une\nporte interne mesurée", fx + 8.3, 3.83, C.border);
    // rails
    const rails = [["Entrée", "rejeter ou réécrire le prompt (masquer)"], ["Dialogue", "cadrer ce que l'assistant a le droit de faire"], ["Récupération", "filtrer les extraits d'un RAG"], ["Exécution", "contrôler l'entrée et la sortie des outils"], ["Sortie", "rejeter ou corriger la réponse"]];
    txt(s, "CINQ FAMILLES DE RAILS", MX, 3.45, 6, 0.3, { face: H, size: 11, bold: true, color: C.green, cs: 2 });
    rails.forEach((r, i) => {
      const y = 3.82 + i * 0.44;
      txt(s, r[0], MX, y, 1.6, 0.4, { face: H, size: 13, bold: true, color: C.white, valign: "middle" });
      txt(s, r[1], MX + 1.6, y, 4.6, 0.4, { size: 12.5, color: C.muted, valign: "middle" });
    });
    const px = 7.0, pw = W - MX - px;
    card(s, px, 3.45, pw, 2.35);
    txt(s, "Ce que contient le dépôt", px + 0.25, 3.58, pw - 0.5, 0.35, { face: H, size: 14.5, bold: true, color: C.white });
    bullets(s, [
      "Profil default : secrets, IBAN, NIR, injection (YARA) — < 10 ms, aucun appel LLM",
      "Profil strict : + self check input/output par un LLM",
      "Fail-closed : sans adaptateur, aucun trafic LLM",
      "20 tests, contrat webhook validé",
    ], px + 0.25, 4.0, pw - 0.5, 1.75, { size: 12, psa: 5 });
    card(s, MX, 6.0, 12.13, 0.75, { fill: C.surf, line: C.accent });
    txt(s, "Open source (Apache-2.0) en mode bibliothèque. Le mode microservice (NIM Operator) relève de la licence NVIDIA AI Enterprise.", MX + 0.3, 6.0, 11.5, 0.75, { size: 13.5, color: C.white, valign: "middle" });
    s.addNotes(
      "MESSAGE · Une seule règle pour tous les modèles : NeMo Guardrails derrière la passerelle.\n• agentgateway appelle un adaptateur en webhook, qui pilote NeMo (bibliothèque 0.24.1).\n• Sur le trafic LLM, NeMo voit aussi les résultats d'outils renvoyés au modèle.\n• Honnêteté : R&D, pas en production. Code dans guardrails/, activable par Terraform.\n• Limites : pas de masquage en streaming (utiliser Reject) ; délai de 3 s côté passerelle.\n→ Qui protège quoi."
    );
  }

  // ----------------------------------------------------------------- 20. Qui protège quoi
  {
    const s = newSlide();
    kicker(s, "DÉFENSE EN PROFONDEUR");
    title(s, "Qui protège quoi ?");
    const Y = (t = "Oui") => cl(t, { color: C.green, bold: true });
    const N = (t = "Non") => cl(t, { color: C.dim, bold: true });
    const P = (t) => cl(t, { color: C.yellow });
    const rows = [
      [hd(""), hd("Garde-fous Foundry"), hd("Passerelle : regex natif"), hd("Passerelle : webhook NeMo")],
      [lb("Prompt et réponse vers Foundry"), Y(), Y(), Y()],
      [lb("Prompt vers un modèle KAITO ou Bedrock"), N(), Y(), Y()],
      [lb("Prompt vers Claude (Foundry, offre Anthropic)"), N("Non — protections Anthropic seules"), Y("Oui, s'il passe par la passerelle"), Y("Oui, s'il passe par la passerelle")],
      [lb("Appels d'outils de nos agents kagent"), N("Non — agents hors Foundry"), P("Indirect : résultats renvoyés au modèle"), P("Indirect, avec des profils dédiés")],
      [lb("Jailbreak, injection indirecte"), Y("Oui — Prompt Shields"), N("Motifs connus seulement"), Y("Oui — YARA, self-check")],
      [lb("Données métier (IBAN, NIR, secrets)"), P("PII générique"), Y("Motifs simples"), Y("Profils de règles")],
      [lb("Statut chez le client"), Y("En production"), Y("En production"), P("R&D")],
    ];
    s.addTable(rows, { x: MX, y: 1.9, w: 12.13, colW: [3.55, 2.86, 2.86, 2.86], rowH: [0.45, 0.48, 0.48, 0.55, 0.6, 0.5, 0.5, 0.46], ...TB });
    txt(s, "La règle de référence vit à la passerelle ; les filtres natifs restent la deuxième ligne. Un modèle ou un outil appelé en direct échappe aux deux.", MX, 6.15, 12.1, 0.7, { face: H, size: 15, bold: true, color: C.accent });
    s.addNotes(
      "MESSAGE · On empile, on n'oppose pas : la règle de référence à la passerelle, Foundry en deuxième ligne.\n• Ligne clé : les appels d'outils de nos agents — Foundry ne les voit pas, la passerelle oui s'ils passent par /mcp.\n• Règle de plateforme : aucun outil d'entreprise branché en direct dans un agent.\n• Claude récupère nos règles s'il passe par la passerelle.\n• Le catalogue NeMo et le comparatif détaillé viennent juste avant la démo C.\n→ Le catalogue des briques : Agent Registry."
    );
  }

  // ----------------------------------------------------------------- 22. Agent Registry
  {
    const s = newSlide();
    kicker(s, "AGENT REGISTRY", C.violet);
    title(s, "Le catalogue des briques IA de l'entreprise");
    const kinds = [["FaPlug", "Serveurs MCP", "npm, PyPI, image OCI ou endpoint distant"], ["FaRobot", "Agents", "images construites avec arctl"], ["FaPuzzlePiece", "Skills", "SKILL.md et scripts, depuis Git"], ["FaFileAlt", "Prompts", "versionnés, partagés"], ["FaMicrochip", "Modèles", "fournisseur, endpoint, authentification"]];
    for (let i = 0; i < kinds.length; i++) {
      const y = 1.95 + i * 0.8;
      card(s, MX, y, 5.7, 0.68, { line: C.surf2 });
      await iconCircle(s, kinds[i][0], MX + 0.15, y + 0.09, 0.5, C.violet);
      txt(s, kinds[i][1], MX + 0.8, y, 1.75, 0.68, { face: H, size: 14, bold: true, color: C.white, valign: "middle" });
      txt(s, kinds[i][2], MX + 2.55, y, 3.05, 0.68, { size: 11.5, color: C.muted, valign: "middle" });
    }
    const rx = 6.6, rw = W - MX - rx;
    const feats = [
      ["Versionner", "chaque entrée a ses tags : 1.0.0, v2, stable…"],
      ["Déployer", "runtime Kubernetes → ressources kagent / kmcp dans le namespace de l'équipe"],
      ["Découvrir", "CLI arctl, interface web, et un serveur MCP pour les agents eux-mêmes"],
      ["Gouverner", "l'équipe plateforme déclare où chaque équipe peut déployer"],
    ];
    feats.forEach((f, i) => {
      const y = 1.95 + i * 0.85;
      num(s, i + 1, rx, y + 0.05, 0.45, C.violetDeep, 13);
      txt(s, f[0], rx + 0.65, y, 2.0, 0.4, { face: H, size: 15, bold: true, color: C.white });
      txt(s, f[1], rx + 0.65, y + 0.36, rw - 0.65, 0.45, { size: 12, color: C.muted });
    });
    card(s, MX, 6.05, 12.13, 0.72, { fill: C.surf, line: C.yellow });
    txt(s, "v0.4.0 (août 2026), Apache-2.0. L'édition open source n'a pas d'authentification : jamais exposée, ClusterIP et droits limités aux namespaces d'équipe.", MX + 0.3, 6.05, 11.5, 0.72, { size: 13.5, color: C.white, valign: "middle" });
    s.addNotes(
      "MESSAGE · Qu'est-ce qui existe, qui l'a publié, quelle version tourne où ?\n• Serveurs MCP, agents, skills, prompts et modèles, versionnés ; déployé par Terraform (chart 0.4.0).\n• Le registre déploie en ressources kagent ou kmcp, dans le namespace de l'équipe.\n• Limite : l'édition open source n'a pas d'authentification → ClusterIP, port-forward, droits limités aux namespaces d'équipe.\n• Démo complète dans le dépôt (demos/extras/cycle-de-vie-registre), pas ce soir.\n→ Étape 4 : ce que les équipes livrent."
    );
  }

  // =================================================================== 04 KAGENT
  await divider("04", "kagent et le cycle de vie des agents", "De la v0 à la v1 · une équipe « Agent Ready » en deux pipelines.",
      "→ De la plateforme à ce que les équipes livrent dessus."
    , "kagent · cycle de vie · démo B");

  // ----------------------------------------------------------------- 24. Stack IA
  {
    const s = newSlide();
    kicker(s, "KAGENT · CNCF SANDBOX");
    title(s, "Un agent, ce sont quelques ressources Kubernetes");
    const g = [
      ["FaRobot", "Agent", "kagent.dev/v1alpha2", "Le rôle, le runtime, les outils autorisés. Un manifeste déclaratif."],
      ["FaFileAlt", "Prompt", "systemMessageFrom", "Dans une ConfigMap : relu en PR, versionné, alimenté par le catalogue."],
      ["FaPuzzlePiece", "Skills", "spec.skills", "Images OCI ou dépôts Git avec un SKILL.md, montés dans /skills."],
      ["FaPlug", "Outils MCP", "RemoteMCPServer · MCPServer", "Serveurs distants, ou déployés par kmcp dans le cluster."],
      ["FaMicrochip", "Modèle", "ModelConfig", "Pointe vers la passerelle, jamais directement vers un fournisseur."],
    ];
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = MX + col * 4.1, y = 1.95 + row * 2.3, w = 3.8, h = 2.05;
      if (i === 5) {
        card(s, x, y, w, h, { fill: C.tintViolet, line: C.violet, lw: 1.5 });
        await iconCircle(s, "FaBook", x + 0.3, y + 0.3, 0.7, C.violet);
        txt(s, "agentregistry", x + 1.15, y + 0.3, w - 1.35, 0.4, { face: H, size: 17, bold: true, color: C.white });
        txt(s, "le catalogue", x + 1.15, y + 0.7, w - 1.35, 0.3, { face: M, size: 10.5, color: C.violet });
        txt(s, "Publie, versionne et déploie serveurs MCP, prompts et skills.", x + 0.3, y + 1.2, w - 0.6, 0.75, { size: 13, color: C.text, lsm: 1.05 });
        continue;
      }
      card(s, x, y, w, h);
      await iconCircle(s, g[i][0], x + 0.3, y + 0.3, 0.7, C.accent);
      txt(s, g[i][1], x + 1.15, y + 0.3, w - 1.35, 0.4, { face: H, size: 17, bold: true, color: C.white });
      txt(s, g[i][2], x + 1.15, y + 0.7, w - 1.35, 0.3, { face: M, size: 10.5, color: C.accent });
      txt(s, g[i][3], x + 0.3, y + 1.2, w - 0.6, 0.75, { size: 13, color: C.muted, lsm: 1.05 });
    }
    txt(s, "Une équipe ne livre plus « son intégration IA » : elle livre des ressources que la plateforme sait valider, déployer, observer et retirer.", MX, 6.5, 12.1, 0.45, { size: 14, italic: true, color: C.accent });
    s.addNotes(
      "MESSAGE · Une équipe ne livre plus une intégration IA : elle livre des ressources Kubernetes.\n• Vocabulaire de kagent 0.10 (kagent.dev/v1alpha2), la version stable du PoC.\n• kagent tourne sur Google ADK ; les CRD Team, Memory et Session de 2025 n'existent plus.\n→ Un manifeste complet."
    );
  }

  // ----------------------------------------------------------------- 25. Anatomie
  {
    const s = newSlide();
    kicker(s, "ANATOMIE D'UN AGENT");
    title(s, "Tout ce qui fait l'agent tient dans un manifeste");
    code(s, [
      "apiVersion: kagent.dev/v1alpha2",
      "kind: Agent",
      "metadata:",
      "  name: assistant-docs",
      "  namespace: equipe-docs",
      "spec:",
      "  type: Declarative",
      "  declarative:",
      "    modelConfig: passerelle-llm   # (1)",
      "    systemMessage: |              # (2)",
      "      Tu es l'assistant documentaire de l'équipe.",
      "      Réponds uniquement à partir de ses documents,",
      "      cite toujours le document source.",
      "    tools:",
      "    - type: McpServer",
      "      mcpServer:                  # (3)",
      "        kind: RemoteMCPServer",
      "        name: docs-mcp",
      "        toolNames: [lister_documents, lire_document, rechercher]",
      "        # requireApproval: [<outil qui écrit>]   (4)",
    ], MX, 1.9, 7.4, 4.95, { size: 10.5, label: "terraform/teams/template/agent/agent.yaml (simplifié)" });
    const ex = [
      ["Modèle abstrait", "La passerelle choisit le fournisseur ; l'agent l'ignore et n'a pas de clé fournisseur."],
      ["Prompt versionné", "Dans le dépôt de l'équipe, relu en pull request, sans rebuild."],
      ["Outils filtrés", "Le serveur MCP de l'équipe ; l'agent ne voit que les outils listés."],
      ["Validation humaine", "Les outils qui écrivent attendent un humain avant de s'exécuter."],
    ];
    ex.forEach((e, i) => {
      const y = 2.0 + i * 1.2;
      num(s, i + 1, 8.35, y, 0.5);
      txt(s, e[0], 9.05, y - 0.02, 3.75, 0.35, { face: H, size: 14.5, bold: true, color: C.white });
      txt(s, e[1], 9.05, y + 0.36, 3.75, 0.75, { size: 12.5, color: C.muted, lsm: 1.05 });
    });
    s.addNotes(
      "MESSAGE · Tout l'agent tient dans un manifeste relu en pull request.\n• (1) L'agent ne connaît pas le fournisseur : il parle à la passerelle avec la clé de son équipe.\n• (4) Réponse à « et si l'agent fait une bêtise ? » : les outils qui écrivent attendent un humain.\n• C'est le manifeste que déploie la démo B.\n→ « Attention, kagent 1.0 change ce modèle. »"
    );
  }

  // ----------------------------------------------------------------- 26. kagent v0 → v1
  {
    const s = newSlide();
    N.kagentV1 = D.count();
    kicker(s, "KAGENT · DE LA V0 À LA V1");
    tag(s, "ALPHA", C.yellow);
    title(s, "kagent 1.0 : fin du type Declarative, place au Harness");
    const rows = [
      [hd(""), hd("kagent 0.10 (stable, utilisé ici)"), hd("kagent 1.0 (alpha)")],
      [lb("API"), cl("kagent.dev/v1alpha2"), cl("api.kagent.dev/v1alpha3 — nouveau groupe, installation neuve")],
      [lb("Modèle"), cl("Agent type Declarative (tout dans un objet) ou BYO"), cl("Plus de Declarative : Agent = AgentTemplate (quoi) + Harness (comment)", { color: C.yellow })],
      [lb("Runtimes"), cl("ADK Python ou Go"), cl("Harness kagent (ADK), Codex, Claude ou BYO")],
      [lb("BYO", { color: C.yellow }), cl("N'importe quelle image servant A2A sur :8080, spec façon Deployment (replicas, volumes, env, service account)"), cl("Image épinglée par digest sha256 + command obligatoire ; contrat A2A gRPC privé, /readyz et TaskStore kagent", { color: C.yellow })],
      [lb("Exécution"), cl("Un Deployment par agent"), cl("Substrate : sessions durables, suspension, reprise, checkpoint et fork")],
      [lb("Secrets"), cl("Secrets montés dans le pod"), cl("Injectés à la sortie par la passerelle d'egress Substrate : jamais dans l'agent")],
      [lb("Outils"), cl("MCPServer ou RemoteMCPServer, requireApproval par outil"), cl("RemoteMCPServer seulement ; requireApproval par liaison")],
    ];
    s.addTable(rows, { x: MX, y: 1.85, w: 12.13, colW: [1.75, 4.6, 5.78], rowH: [0.42, 0.45, 0.45, 0.45, 0.78, 0.5, 0.55, 0.5], ...TB });
    card(s, MX, 6.05, 12.13, 0.75, { fill: C.surf, line: C.accent });
    txt(s, "Pour ce talk : 0.10.x en production, 1.0 en essai. Un agent BYO d'aujourd'hui (une image A2A quelconque) ne tourne pas tel quel en 1.0.", MX + 0.3, 6.05, 11.5, 0.75, { size: 13.5, color: C.white, valign: "middle" });
    s.addNotes(
      "MESSAGE · kagent 1.0 remplace le type Declarative par Template + Harness : à suivre, pas encore à déployer.\n• 0.10.x en production ; 1.0 en alpha (alpha8 le 05/10/2026) : nouveau groupe d'API, installation neuve.\n• AgentTemplate = le comportement ; Harness = l'exécution (image figée par digest, Substrate).\n• Piège BYO : une image A2A quelconque ne tourne plus telle quelle (contrat runtime kagent).\n• Les secrets sortent de l'agent : injectés par la passerelle d'egress.\n→ Le même agent dans les deux versions."
    );
  }

  // ----------------------------------------------------------------- 26-B. Même agent, v0.10 et v1.0
  {
    const s = newSlide();
    kicker(s, "KAGENT · LE MÊME AGENT, DEUX VERSIONS");
    tag(s, "ALPHA", C.yellow);
    title(s, "Du manifeste Declarative au trio Template · Harness · Agent", { size: 26 });
    code(s, [
      "# kagent 0.10 — un seul objet",
      "apiVersion: kagent.dev/v1alpha2",
      "kind: Agent",
      "metadata:",
      "  name: assistant-tickets",
      "spec:",
      "  type: Declarative",
      "  declarative:",
      "    modelConfig: passerelle-llm",
      "    systemMessageFrom:",
      "      type: ConfigMap",
      "      name: prompt-assistant-tickets",
      "      key: prompt",
      "    tools:",
      "    - type: McpServer",
      "      mcpServer:",
      "        kind: MCPServer",
      "        name: jira-mcp-tickets",
      "        toolNames: [jira_search, jira_get_issue]",
      "# le runtime ? implicite (image ADK du chart)",
    ], MX, 1.85, 5.55, 5.0, { size: 10, label: "demos/extras/cycle-de-vie-registre/agent.yaml" });
    code(s, [
      "# kagent 1.0 — QUOI : réutilisable entre agents",
      "kind: AgentTemplate            # api.kagent.dev/v1alpha3",
      "spec:",
      "  modelConfig: { name: passerelle-llm }",
      "  systemPromptFrom: { name: prompt-assistant-tickets, key: prompt }",
      "  tools:",
      "  - mcp:",
      "      server: { kind: RemoteMCPServer, name: jira-mcp }",
      "      tools: [jira_search, jira_get_issue]",
      "---",
      "# COMMENT : un runtime par classe d'agents",
      "kind: Harness",
      "spec:",
      "  kagent: {}                   # ou codex, claude, byo",
      "  workload:",
      "    image: …/golang-adk@sha256:…   # digest obligatoire",
      "  substrate: { workerPoolRef: …, snapshotPolicy: … }",
      "---",
      "# LE LIEN : ce comportement, avec ce runtime",
      "kind: Agent",
      "spec: { templateRef: { name: assistant-tickets },",
      "        harnessRef:  { name: adk-go } }",
      "# même template + autre harness = même agent, autre runtime",
    ], 6.35, 1.85, W - MX - 6.35, 5.0, { size: 10, label: "demos/extras/cycle-de-vie-registre/kagent-v1/…" });
    s.addNotes(
      "MESSAGE · Le kind Agent ne décrit plus rien : il relie un comportement et un runtime.\n• Gauche : un seul objet, runtime implicite. Droite : AgentTemplate (quoi) + Harness (comment) + Agent (le lien).\n• Un template pour N agents, un harness pour une classe d'agents : on change de runtime sans réécrire le comportement.\n• Pièges de migration : systemMessageFrom devient systemPromptFrom ; outils en RemoteMCPServer seulement.\n• Fichier v1 validé contre les CRD alpha8, non appliqué.\n→ Le cycle de vie."
    );
  }

  // ----------------------------------------------------------------- 27. Cycle de vie
  {
    const s = newSlide();
    kicker(s, "CYCLE DE VIE");
    title(s, "Publier, découvrir, déployer, faire évoluer, retirer");
    const st = [
      ["FaUpload", "Publier", "arctl apply : serveur MCP, prompt, skill — versionnés", "équipe"],
      ["FaSearch", "Découvrir", "catalogue : qui, quoi, quelle version", "toutes"],
      ["FaRocket", "Déployer", "registre → kmcp, kagent → agent", "équipe"],
      ["FaChartLine", "Observer", "coût, jetons, outils par agent et par équipe", "plateforme"],
      ["FaCodeBranch", "Faire évoluer", "prompt v2 à côté de v1, retour arrière", "équipe"],
      ["FaTrashAlt", "Retirer", "le registre supprime ce qu'il a créé ; la version reste", "plateforme"],
    ];
    for (let i = 0; i < st.length; i++) {
      const x = MX + i * 2.05, y = 2.0, w = 1.85, h = 3.0;
      card(s, x, y, w, h, { line: i === 3 ? C.green : C.surf2, lw: i === 3 ? 1.5 : 1 });
      await iconCircle(s, st[i][0], x + (w - 0.7) / 2, y + 0.25, 0.7, i === 3 ? C.green : C.violet);
      txt(s, st[i][1], x + 0.08, y + 1.1, w - 0.16, 0.4, { face: H, size: 14, bold: true, color: C.white, align: "center" });
      txt(s, st[i][2], x + 0.12, y + 1.55, w - 0.24, 1.0, { size: 11.5, color: C.muted, align: "center", lsm: 1.05 });
      txt(s, st[i][3], x, y + 2.6, w, 0.3, { face: M, size: 9.5, color: C.accent, align: "center" });
      if (i < st.length - 1) arrow(s, x + w + 0.01, y + h / 2, 0.18, 0, C.muted);
    }
    const ben = [
      ["Un gabarit par type d'agent", "Les équipes partent d'un modèle validé, pas d'une page blanche."],
      ["Chaque version reste traçable", "Qui a publié quel prompt, quel outil tourne où."],
      ["Identique sur tous les clusters", "AKS, EKS ou Managed Kubernetes : le chemin ne change pas."],
    ];
    ben.forEach((b, i) => {
      const x = MX + i * 4.1;
      txt(s, b[0], x, 5.35, 3.8, 0.4, { face: H, size: 15, bold: true, color: C.accent });
      txt(s, b[1], x, 5.75, 3.8, 0.8, { size: 13, color: C.text, lsm: 1.05 });
    });
    s.addNotes(
      "MESSAGE · Un agent vit comme un Deployment : publié, versionné, déployé, observé, retiré.\n• En bas, qui porte chaque étape : l'équipe publie et fait évoluer, la plateforme observe et retire.\n• C'est ce qui a fait passer le client d'intégrations au cas par cas à des stacks standardisées.\n→ « Concrètement, comment une équipe démarre ? En vidéo. »"
    );
  }

  // ----------------------------------------------------------------- 28. Démo B (demos/B-agent-equipe)
  {
    const s = newSlide();
    kicker(s, "DÉMO B");
    tag(s, "VIDÉO", C.accent);
    title(s, "« Agent Ready » : l'équipe IA prépare, l'équipe de dev déploie", { size: 27 });
    const cols = [
      { x: MX, w: 4.3, color: C.violet, head: "ÉQUIPE IA · AGENT READY", icon: "FaUserShield",
        lines: ["pipeline GitHub à la demande, approbation « ai-team »", "Terraform, un état par équipe :", "2 identités fédérées (pipeline · serveur MCP)", "stockage Entra ID seulement · 4 rôles", "namespace, quota, clé virtuelle, RoleBinding", "dépôt agent-<équipe> + ses variables"] },
      { x: MX + 4.55, w: 3.6, color: C.accent, head: "DEV · 1 · IMAGE", icon: "FaDocker",
        lines: ["push sur mcp/ (ou à la main)", "uses: …/agent-image.yml", "docker build → registre de la plateforme", "rôle AcrPush, rien d'autre"] },
      { x: MX + 8.4, w: 3.73, color: C.green, head: "DEV · 2 · DÉPLOIEMENT", icon: "FaRocket",
        lines: ["après l'image, ou push agent/ docs/", "uses: …/agent-deploy.yml", "docs → stockage · kubectl apply dans SON namespace", "passerelle : serveur MCP découvert ; LibreChat répond"] },
    ];
    for (const c of cols) {
      card(s, c.x, 1.85, c.w, 3.3, { line: c.color, lw: 1.5 });
      await iconCircle(s, c.icon, c.x + 0.25, 2.0, 0.55, c.color);
      txt(s, c.head, c.x + 0.95, 2.0, c.w - 1.05, 0.55, { face: H, size: 12.5, bold: true, color: c.color, valign: "middle", cs: 1 });
      bullets(s, c.lines, c.x + 0.25, 2.7, c.w - 0.45, 2.4, { size: 12.5, psa: 5 });
    }
    arrow(s, MX + 4.32, 3.5, 0.21, 0, C.muted, 2);
    arrow(s, MX + 8.17, 3.5, 0.21, 0, C.muted, 2);
    // Le gabarit : ce que contient le dépôt agent-<équipe>
    card(s, MX, 5.3, 12.13, 1.5, { fill: C.tintBlue, line: C.accent, lw: 1.5 });
    txt(s, "LE GABARIT · dépôt agent-<équipe>", MX + 0.25, 5.38, 6, 0.3, { face: H, size: 11, bold: true, color: C.accent, cs: 1 });
    txt(s, "Kustomize, pas de chart Helm — Helm reste côté plateforme", MX + 6.3, 5.38, 5.6, 0.3, { size: 11, italic: true, color: C.muted, align: "right" });
    const tpl = [
      ["mcp/", "serveur MCP : code + Dockerfile"],
      ["deploy/", "ServiceAccount fédéré, MCP, NetworkPolicy, RemoteMCPServer"],
      ["agent/", "Agent + ModelConfig vers la passerelle"],
      ["docs/", "le contenu métier de l'équipe"],
    ];
    tpl.forEach((t, i) => {
      const x = MX + 0.25 + i * 2.97;
      txt(s, t[0], x, 5.78, 2.8, 0.3, { face: M, size: 13, bold: true, color: C.white });
      txt(s, t[1], x, 6.1, 2.8, 0.62, { size: 11, color: C.muted, lsm: 1.0 });
    });
    s.addNotes(
      "DÉMO B · VIDÉO (≈ 4 min), enregistrée avec ./demos/B-agent-equipe/run.ps1 — la commenter en direct.\n1 · Équipe IA : agent-ready.yml, approbation « ai-team », Terraform crée tout pour l'équipe.\n2 · Preuve : identités fédérées, stockage, namespace, variables du dépôt.\n3 · Équipe de dev : « 1 · Image » puis « 2 · Déploiement », dix lignes qui appellent les workflows de l'équipe IA.\n4 · La passerelle découvre le serveur MCP ; 401 sans jeton.\n5 · LibreChat répond depuis les documents de l'équipe.\n6 · Un document poussé : seul le déploiement repart.\n• Gabarit en Kustomize, pas de chart Helm : Helm installe la plateforme, pas les agents.\n• Avant : un ticket, trois semaines, cinq équipes à relancer.\n• Si la vidéo ne part pas : passer au schéma de la slide suivante.\n→ Ce qui a été créé."
    );
  }

  // ----------------------------------------------------------------- 28-B. Démo B : ce qui est déployé
  {
    const s = newSlide();
    kicker(s, "DÉMO B · ARCHITECTURE");
    title(s, "Ce qu'« Agent Ready » crée pour une équipe", { size: 24, w: 8.0 });
    // Légende : la couleur du contour dit QUI crée la ressource
    const leg = [["existant (plateforme)", C.dim], ["créé par Agent Ready", C.violet], ["déployé par l'équipe", C.accent]];
    leg.forEach((l, i) => {
      const x = 8.75, y = 0.95 + i * 0.3;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y + 0.05, w: 0.32, h: 0.17, rectRadius: 0.04, fill: { color: C.surf }, line: { color: l[1], width: 1.75 } });
      txt(s, l[0], x + 0.42, y, 3.5, 0.27, { size: 11, color: C.text, valign: "middle" });
    });

    // Une ressource : contour = créateur, titre + détail
    const res = (x, y, w, h, t, sub, color, o = {}) => {
      card(s, x, y, w, h, { line: color, lw: 1.5, fill: o.fill ?? C.surf });
      txt(s, t, x + 0.15, y + 0.08, w - 0.3, 0.32, { face: o.mono ? M : H, size: o.ts ?? 12.5, bold: true, color: C.white });
      if (sub) txt(s, sub, x + 0.15, y + 0.42, w - 0.3, h - 0.48, { size: o.ss ?? 10.5, color: C.muted, lsm: 1.0 });
    };
    const zone = (x, y, w, h, label, color, dash) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: C.zone }, line: { color, width: 1.25, ...(dash ? { dashType: "dash" } : {}) } });
      txt(s, label, x + 0.18, y + 0.08, w - 0.36, 0.28, { face: H, size: 11, bold: true, color, cs: 1 });
    };

    const Y0 = 1.9, ZH = 4.95;
    // ---------------- GitHub
    zone(MX, Y0, 3.35, ZH, "GITHUB", C.text);
    res(MX + 0.18, Y0 + 0.45, 2.99, 1.95, "Dépôt plateforme · équipe IA",
      "environnement « ai-team » : approbation\nagent-ready.yml → Terraform\nun état par équipe (teams/<équipe>.tfstate)\nworkflows réutilisables : agent-image.yml · agent-deploy.yml", C.dim, { ss: 10.5 });
    res(MX + 0.18, Y0 + 2.75, 2.99, 2.02, "agent-<équipe> · privé",
      "créé depuis le gabarit\nmcp/ · deploy/ · agent/ · docs/\n8 variables Actions (identité, ACR, AKS, stockage)\n1-image.yml · 2-deploiement.yml : 10 lignes, uses: …", C.violet, { ss: 10.5 });
    arrow(s, MX + 1.68, Y0 + 2.41, 0, 0.32, C.violet, 1.75);
    txt(s, "crée", MX + 1.78, Y0 + 2.43, 0.8, 0.28, { size: 10, italic: true, color: C.violet });

    // ---------------- Azure
    const AX = 4.35, AW = W - MX - AX;
    zone(AX, Y0, AW, ZH, "AZURE · ABONNEMENT DE LA PLATEFORME", C.accent);
    // rg-…-equipes
    const RX = AX + 0.18, RW = 3.75;
    zone(RX, Y0 + 0.45, RW, ZH - 0.62, "rg-<base>-equipes", C.violet, true);
    res(RX + 0.15, Y0 + 0.85, RW - 0.3, 1.25, "id-<équipe>-pipeline",
      "fédérée : agent-<équipe>, branche main\nBlob Data Contributor · AcrPush · AKS Cluster User", C.violet, { mono: true, ts: 12 });
    res(RX + 0.15, Y0 + 2.22, RW - 0.3, 1.0, "id-<équipe>-mcp",
      "fédérée : ServiceAccount <équipe>/docs-mcp\nStorage Blob Data Reader", C.violet, { mono: true, ts: 12 });
    res(RX + 0.15, Y0 + 3.34, RW - 0.3, 1.32, "Compte de stockage",
      "Entra ID seulement : aucune clé de compte\nconteneur « documents »\n← docs/ poussés par « 2 · Déploiement »", C.violet);

    // Socle existant + namespace AKS
    const KX = RX + RW + 0.22, KW = AX + AW - 0.18 - KX;
    res(KX, Y0 + 0.45, KW, 1.25, "Socle plateforme",
      "id-<base>-ai-team : Contributeur sur rg-…-equipes, RBAC Admin sous condition ABAC (4 rôles)\nACR · AKS (émetteur OIDC) · agentgateway", C.dim, { ss: 10 });
    zone(KX, Y0 + 1.85, KW, ZH - 2.02, "AKS · NAMESPACE <équipe>", C.green);
    const nw = (KW - 0.45) / 2, nh = 0.72;
    const ns = [
      ["ServiceAccount", "docs-mcp · Workload Identity", C.accent],
      ["Serveur MCP", "docs-mcp · NetworkPolicy", C.accent],
      ["Agent kagent", "RemoteMCPServer · ModelConfig", C.accent],
      ["quota · LimitRange", "2 CPU · 8 Gi · 20 pods", C.violet],
      ["clé virtuelle", "Secret lu par la passerelle", C.violet],
      ["RoleBinding", "agentic-team-deployer", C.violet],
    ];
    ns.forEach((n, i) => {
      const col = i < 3 ? 0 : 1, row = i % 3;
      const x = KX + 0.15 + col * (nw + 0.15), y = Y0 + 2.27 + row * (nh + 0.1);
      card(s, x, y, nw, nh, { line: n[2], lw: 1.5 });
      txt(s, n[0], x + 0.12, y + 0.05, nw - 0.2, 0.28, { face: H, size: 11, bold: true, color: C.white });
      txt(s, n[1], x + 0.12, y + 0.33, nw - 0.2, 0.36, { size: 9.5, color: C.muted, lsm: 0.95 });
    });

    // Flux principaux (les étiquettes chevauchent la frontière GitHub → Azure qu'elles franchissent)
    const GX = MX + 0.18 + 2.99, MID = (MX + 3.35 + AX) / 2;
    arrow(s, GX, Y0 + 0.62, RX - GX, 0, C.violet, 2);                       // Terraform → rg équipes
    pill(s, "apply", C.violet, MID - 0.3, Y0 + 0.5, 0.6, 0.24);
    line(s, GX, Y0 + 3.55, MID - GX, 0, C.accent, 1.75, "dash");            // OIDC : dépôt d'équipe → id pipeline
    line(s, MID, Y0 + 1.55, 0, 2.0, C.accent, 1.75, "dash");
    arrow(s, MID, Y0 + 1.55, RX + 0.15 - MID, 0, C.accent, 1.75);
    pill(s, "OIDC", C.accent, MID - 0.27, Y0 + 2.45, 0.54, 0.24);
    arrow(s, RX + RW - 0.15, Y0 + 1.5, KX + 0.15 - (RX + RW - 0.15), 0.75, C.accent, 1.75);   // pipeline → namespace
    line(s, RX + RW - 0.15, Y0 + 2.63, KX + 0.15 - (RX + RW - 0.15), 0, C.green, 1.75, "dash"); // SA ↔ id mcp

    s.addNotes(
      "MESSAGE · En un apply, une équipe reçoit tout ce qu'il lui faut, sans aucun secret.\n• Couleurs : gris = socle existant, violet = créé par Agent Ready, bleu = déployé par l'équipe.\n• GitHub : dépôt agent-<équipe> depuis le gabarit, 8 variables, deux pipelines de dix lignes.\n• Azure : deux identités fédérées (OIDC GitHub, branche main · Workload Identity du serveur MCP), stockage Entra ID seulement, quatre rôles.\n• AKS : namespace, quota, clé virtuelle, RoleBinding ; l'équipe y déploie son serveur MCP et son agent.\n→ Qui a le droit de quoi."
    );
  }

  // ----------------------------------------------------------------- 29. Qui a le droit de quoi
  {
    const s = newSlide();
    kicker(s, "TROIS IDENTITÉS, TROIS PÉRIMÈTRES");
    title(s, "Aucun secret, et des droits taillés pour chaque geste");
    const rows = [
      [hd("Identité"), hd("Fédérée avec"), hd("Azure"), hd("Kubernetes")],
      [lb("Pipeline Agent Ready", { color: C.violet }), cl("environnement « ai-team » du dépôt plateforme — approbation"), cl("Contributeur sur rg-…-equipes ; RBAC Admin sous condition ABAC : 4 rôles, identités de service", { color: C.yellow }), cl("agentic-team-provisioner, borné aux namespaces d'équipe par une politique d'admission")],
      [lb("Pipelines de l'équipe", { color: C.accent }), cl("branche main de agent-<équipe> (même via les workflows réutilisables)"), cl("écrire SON stockage, AcrPush, AKS Cluster User"), cl("agentic-team-deployer dans SON namespace : ni Secrets, ni RBAC")],
      [lb("Serveur MCP de l'équipe", { color: C.green }), cl("ServiceAccount <équipe>/docs-mcp"), cl("lire SON stockage"), cl("—")],
    ];
    s.addTable(rows, { x: MX, y: 1.9, w: 12.13, colW: [2.25, 3.1, 3.5, 3.28], rowH: [0.42, 0.95, 0.85, 0.6], ...TB });
    card(s, MX, 5.3, 12.13, 0.65, { fill: C.surf, line: C.surf2 });
    txt(s, "Limite assumée : Terraform relit les Secrets qu'il gère — l'identité Agent Ready lit les Secrets du cluster ; l'admission borne les écritures, pas les lectures.", MX + 0.3, 5.3, 11.5, 0.65, { size: 12.5, color: C.muted, valign: "middle" });
    card(s, MX, 6.08, 12.13, 0.72, { fill: C.surf, line: C.accent });
    txt(s, "Même mal configuré, un pipeline d'équipe ne peut toucher ni une autre équipe, ni la plateforme — Azure et Kubernetes refusent.", MX + 0.3, 6.08, 11.5, 0.72, { size: 14, color: C.white, valign: "middle" });
    s.addNotes(
      "MESSAGE · Même mal configuré, un pipeline d'équipe ne peut toucher ni une autre équipe, ni la plateforme.\n• Condition ABAC : l'équipe IA ne peut donner que quatre rôles, à des identités de service.\n• Workflows réutilisables : le jeton OIDC garde le sujet du dépôt appelant, la fédération de l'équipe s'applique.\n• Limite assumée : l'identité Agent Ready lit les Secrets du cluster (Terraform les relit).\n→ Étape 5 : le retour d'expérience."
    );
  }

  // =================================================================== 05 REX
  await divider("05", "REX, gouvernance et bonnes pratiques", "Ce qui a fait mal, ce que je referais.",
      "→ Dernière ligne droite, dix minutes : identité, coûts, gouvernance, puis le socle de garde-fous en démo."
    , "Entra ID · coûts · garde-fous · démo C");

  // ----------------------------------------------------------------- 31. Identité : ce qui a fait mal
  {
    const s = newSlide();
    kicker(s, "REX · IDENTITÉ ENTRA ID", C.yellow);
    title(s, "Chaque outil a sa propre idée de l'identité");
    const sym = (t) => cl(t, { color: C.yellow, align: "left", fontSize: 11 });
    const why = (t) => cl(t, { align: "left", fontSize: 11 });
    const fix = (t) => cl(t, { color: C.green, align: "left", fontSize: 11 });
    const rows = [
      [hd("Outil"), hd("Symptôme"), hd("Cause"), hd("Correction")],
      [lb("Passerelle"), sym("401 avec un jeton valide"), why("jeton v1 : aud = api://<id> au lieu du GUID"), fix("requested_access_token_version = 2")],
      [lb("LibreChat"), sym("« Échec de l'authentification »"), why("le jeton réutilisé n'avait pas l'audience de l'API passerelle"), fix("OPENID_AUDIENCE + scope API · v0.8.8 (RC)")],
      [lb("Grafana"), sym("« Unauthorized » après connexion"), why("oauth2-proxy envoie un en-tête Basic que Grafana prend pour un login"), fix("pass-basic-auth = false")],
      [lb("UI kagent"), sym("piège évité : scope invalide"), why("le sous-chart oauth2-proxy demande « groups », refusé par Entra ID"), fix("scope openid profile email")],
      [lb("Outils MCP"), sym("tout le monde voit tout"), why("Graph et Azure en identité d'application, GitHub en OAuth direct"), fix("à traiter : délégation (OBO)")],
      [lb("Agents"), sym("« qui a demandé ? »"), why("clé d'équipe : l'utilisateur derrière invoke_agent est perdu"), fix("piste : Entra Agent ID")],
      [lb("agentregistry"), sym("aucune authentification"), why("édition open source"), fix("ClusterIP, port-forward")],
    ];
    s.addTable(rows, { x: MX, y: 1.85, w: 12.13, colW: [1.7, 2.95, 4.08, 3.4], rowH: [0.4, 0.52, 0.58, 0.58, 0.5, 0.58, 0.58, 0.48], ...TB });
    txt(s, "Le login fonctionne partout. C'est la propagation de l'identité d'un outil à l'autre qui coûte des jours.", MX, 6.3, 12.1, 0.5, { face: H, size: 15, bold: true, color: C.accent });
    s.addNotes(
      "MESSAGE · Le login marche partout ; c'est la propagation de l'identité qui coûte des jours.\n• Quatre premières lignes : bugs vécus, corrigés dans le dépôt (aud v1/v2, audience LibreChat, Basic auth vers Grafana, scope groups refusé).\n• Trois dernières : structurelles. Les outils Graph et Azure voient ce que voit l'application, pas l'utilisateur.\n→ Où, exactement, l'identité se perd."
    );
  }

  // ----------------------------------------------------------------- 32. Où l'identité se perd
  {
    const s = newSlide();
    kicker(s, "REX · IDENTITÉ DE BOUT EN BOUT", C.yellow);
    tag(s, "À VALIDER", C.yellow);
    title(s, "L'identité peut aller jusqu'à l'outil — pas toute seule");
    const nodes = [
      ["Collaborateur", "compte Entra ID", C.accent],
      ["LibreChat", "jeton d'accès\nréutilisé", C.accent],
      ["agentgateway", "JWT validé\nuser = preferred_username", C.green],
      ["Agent kagent", "par défaut : clé\nde l'équipe", C.yellow],
      ["Outil MCP", "par défaut : identité\nd'application", C.red],
    ];
    const y = 2.1, w = 2.15, h = 1.5, gap = 0.345;
    nodes.forEach((n, i) => {
      const x = MX + i * (w + gap);
      card(s, x, y, w, h, { line: n[2], lw: 1.75 });
      txt(s, n[0], x, y + 0.15, w, 0.4, { face: H, size: 14.5, bold: true, color: C.white, align: "center" });
      txt(s, n[1], x + 0.08, y + 0.6, w - 0.16, 0.8, { size: 11, color: n[2], align: "center", lsm: 1.05 });
      if (i < nodes.length - 1) arrow(s, x + w + 0.02, y + h / 2, gap - 0.04, 0, C.muted);
    });
    // marqueurs de rupture
    txt(s, "✓ identité intacte", MX, 3.75, 7.0, 0.35, { size: 12.5, bold: true, color: C.green });
    txt(s, "✗ rupture, dans la configuration par défaut", MX + 3 * (w + gap) - 0.2, 3.75, 4.9, 0.35, { size: 12.5, bold: true, color: C.yellow });
    const pistes = [
      ["FaExchangeAlt", "① Passerelle → agent", "Après validation, la passerelle retire le JWT. backendAuth « passthrough » le transmet à l'agent."],
      ["FaRobot", "② Agent → outil", "kagent 0.10 relaie le jeton de l'appelant : allowedHeaders [Authorization] sur le RemoteMCPServer."],
      ["FaKey", "③ Outil → Graph, Azure…", "Le JWT vise la passerelle, pas Graph : il faut un échange de jeton (on-behalf-of)."],
    ];
    for (let i = 0; i < pistes.length; i++) {
      const x = MX + i * 4.1, yy = 4.2, ww = 3.8, hh = 2.1;
      card(s, x, yy, ww, hh);
      await iconCircle(s, pistes[i][0], x + 0.25, yy + 0.25, 0.62, C.accent);
      txt(s, pistes[i][1], x + 1.0, yy + 0.25, ww - 1.15, 0.62, { face: H, size: 14, bold: true, color: C.white, valign: "middle" });
      txt(s, pistes[i][2], x + 0.25, yy + 1.0, ww - 0.5, 1.1, { size: 12, color: C.muted, lsm: 1.05 });
    }
    txt(s, "Même bout en bout, les appels LLM de l'agent restent facturés à la clé de l'équipe.", MX, 6.42, 12.1, 0.35, { size: 12.5, italic: true, color: C.accent });
    s.addNotes(
      "MESSAGE · L'identité peut aller jusqu'à l'outil, mais pas avec la configuration par défaut.\n① La passerelle retire le JWT après validation : backendAuth passthrough le transmet.\n② kagent 0.10 relaie le jeton de l'appelant : allowedHeaders sur le RemoteMCPServer.\n③ Pour Graph ou Azure, il faut un échange on-behalf-of.\n• Honnêteté : jamais testé de bout en bout, d'où « À VALIDER ».\n• Même réussi, les appels LLM de l'agent restent facturés à l'équipe.\n• Si on demande : Entra Agent ID (GA) donne une identité propre à chaque agent.\n→ Et la facture ?"
    );
  }

  // ----------------------------------------------------------------- 33. Coûts et audit
  {
    const s = newSlide();
    kicker(s, "REX · COÛTS ET AUDIT", C.yellow);
    title(s, "Personne, équipe ou application : qui consomme ?");
    const rows = [
      [hd("Appelant"), hd("Identité vue par la passerelle"), hd("Libellés sur chaque métrique"), hd("Ce qu'on peut refacturer")],
      [lb("Collaborateur via LibreChat"), cl("JWT Entra ID"), cl("user = preferred_username · team = collaborateurs", { fontFace: M, fontSize: 10 }), cl("à la personne, au département", { color: C.green })],
      [lb("Agent d'équipe"), cl("clé virtuelle de l'équipe"), cl("user = agent:<équipe> · team = <équipe>", { fontFace: M, fontSize: 10 }), cl("à l'équipe", { color: C.green })],
      [lb("Agent appelé par un utilisateur"), cl("outil : JWT · LLM de l'agent : clé"), cl("agent = <ns>/<nom> sur l'appel d'outil", { fontFace: M, fontSize: 10 }), cl("partiel : la chaîne se coupe", { color: C.yellow })],
      [lb("Outil appelé en direct"), cl("—"), cl("—"), cl("invisible", { color: C.red })],
    ];
    s.addTable(rows, { x: MX, y: 1.85, w: 12.13, colW: [2.8, 2.85, 3.68, 2.8], rowH: [0.42, 0.55, 0.55, 0.6, 0.45], ...TB });
    const pts = [
      ["Le prix est une donnée à maintenir", "Grille par modèle, déploiement et modèle servi ; prix DataZone non publiés → estimation au prix Global."],
      ["La cardinalité a un coût", "Un libellé par personne : parfait pour un pilote ; à 3 000 personnes, l'équipe en Prometheus, le détail en journaux."],
      ["Plafond ≠ budget", "Le plafond local est par route ; un budget par équipe demande le rate limit global et un service externe."],
    ];
    pts.forEach((p, i) => {
      const x = MX + i * 4.1;
      card(s, x, 4.75, 3.8, 1.95, { line: C.yellow });
      txt(s, p[0], x + 0.2, 4.88, 3.4, 0.6, { face: H, size: 14, bold: true, color: C.white });
      txt(s, p[1], x + 0.2, 5.48, 3.4, 1.15, { size: 11.5, color: C.muted, lsm: 1.05 });
    });
    s.addNotes(
      "MESSAGE · Le sujet FinOps, ce n'est pas le prix du jeton : c'est à qui l'imputer.\n• Libellés user, team et agent posés par la passerelle (expressions CEL) ; coût calculé depuis une grille de prix.\n• Honnêtetés : pas de prix Data Zone publiés pour Terra et Luna ; skills et outils branchés en direct non mesurables.\n• Un libellé par personne coûte cher en Prometheus à 3 000 personnes : l'équipe d'abord.\n→ Le tableau de bord."
    );
  }

  // ----------------------------------------------------------------- 34. Tableau de bord
  {
    const s = newSlide();
    kicker(s, "OBSERVABILITÉ");
    title(s, "Le tableau de bord « Usage IA »");
    const panels = [
      ["Vue d'ensemble", "coût · projection 30 j · jetons · utilisateurs actifs · appels d'outils", C.accent],
      ["Par utilisateur", "coût, requêtes, jetons et outils par personne et par équipe · top 10", C.accent],
      ["Par équipe et par modèle", "coût par équipe, par déploiement · latence · premier jeton", C.accent],
      ["Outils MCP", "outils appelés · agents sollicités · qui utilise quoi", C.violet],
      ["Accès et garde-fous", "401 · 429 · contrôles par action · réponses sans prix", C.green],
      ["Skills", "invisibles à la passerelle : traces OpenTelemetry de kagent", C.yellow],
    ];
    panels.forEach((p, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = MX + col * 4.25, y = 1.95 + row * 1.42, w = 4.05, h = 1.25;
      card(s, x, y, w, h, { line: p[2] });
      txt(s, p[0], x + 0.25, y + 0.15, w - 0.5, 0.4, { face: H, size: 15, bold: true, color: C.white });
      txt(s, p[1], x + 0.25, y + 0.55, w - 0.5, 0.65, { size: 12, color: C.muted, lsm: 1.05 });
    });
    code(s, [
      "# coût par personne sur la période",
      "sum by (user, team) (",
      "  increase(",
      "   agentgateway_gen_ai_client_cost_usd_total",
      "   [$__range]))",
      "",
      "# outils appelés par personne",
      "sum by (user, resource) (",
      "  increase(",
      "   agentgateway_mcp_requests_total",
      "   {method=\"tools/call\"}[$__range]))",
    ], 9.15, 1.95, 3.6, 4.1, { size: 8.5, label: "PromQL" });
    txt(s, "Provisionné par Terraform (dossier Plateforme IA), généré par monitoring/src/usage_dashboard.py.", MX, 6.35, 12.1, 0.4, { size: 12.5, italic: true, color: C.muted });
    s.addNotes(
      "MESSAGE · Coût, jetons et outils, par personne et par équipe, sans rien coder.\n• Déjà vu en fin de démo A ; métriques natives d'agentgateway 1.5.\n• Le panneau « Réponses sans prix » doit rester à 0 : sinon, un modèle manque dans la grille.\n→ Les outils ne suffisent pas."
    );
  }

  // ----------------------------------------------------------------- 35. Gouvernance
  {
    const s = newSlide();
    kicker(s, "GOUVERNANCE");
    title(s, "L'outil applique une politique. Il ne la remplace pas.");
    const q = [
      ["FaKey", "Qui a droit à quel modèle ?", "Groupes Entra ID → politiques de la passerelle"],
      ["FaFileInvoiceDollar", "Quel budget pour quelle équipe ?", "Clés virtuelles, plafonds, tableau de bord"],
      ["FaUserSecret", "Quelles données vers quel outil ?", "Garde-fous, outils publiés derrière la passerelle"],
      ["FaUsers", "Qui crée, valide et retire un agent ?", "Catalogue, revue, runtime par équipe"],
    ];
    for (let i = 0; i < 4; i++) {
      const x = MX + i * 3.08, y = 2.0, w = 2.85, h = 3.25;
      card(s, x, y, w, h);
      await iconCircle(s, q[i][0], x + (w - 0.9) / 2, y + 0.3, 0.9, C.accent);
      txt(s, q[i][1], x + 0.2, y + 1.35, w - 0.4, 0.95, { face: H, size: 15.5, bold: true, color: C.white, align: "center" });
      txt(s, q[i][2], x + 0.2, y + 2.35, w - 0.4, 0.8, { size: 12, color: C.muted, align: "center", lsm: 1.05 });
    }
    txt(s, "Chaque réponse est d'abord une décision de gouvernance — puis une ressource Kubernetes.", MX, 5.6, 12.1, 0.6, { face: H, size: 19, bold: true, color: C.accent });
    s.addNotes(
      "MESSAGE · Sans politique, la plus belle passerelle applique des règles que personne n'a décidées.\n• Le client a posé une gouvernance transverse avant de configurer quoi que ce soit.\n→ « Troisième question, quelles données vers quel outil : c'est le socle de garde-fous. »"
    );
  }

  // ----------------------------------------------------------------- 35-B. Catalogue natif NeMo Guardrails
  {
    const s = newSlide();
    kicker(s, "SÉCURISER LES LLM · LE CATALOGUE", C.yellow);
    tag(s, "R&D", C.yellow);
    title(s, "Le catalogue natif de NeMo Guardrails, et ce qu'il bloque", { size: 26 });
    const ref = (t) => cl(t, { color: C.red, bold: true, align: "left", fontSize: 10.5 });
    const soft = (t, color) => cl(t, { color, bold: true, align: "left", fontSize: 10.5 });
    const flow = (t) => cl(t, { fontFace: M, fontSize: 8.5, align: "left", color: C.accent });
    const st = (t) => cl(t, { fontSize: 10.5 });
    const cost = (t, color) => cl(t, { fontSize: 9.5, color, bold: true });
    const repo = (t) => cl(t, { fontSize: 10.5, color: t === "—" ? C.dim : C.green, bold: t !== "—" });
    const CD = C.green, CM = C.violet, CL = C.yellow;   // déterministe · modèle dédié · LLM
    const rows = [
      [hd("Famille"), hd("Rails natifs (flows)"), hd("Étape"), hd("Réaction si détecté"), hd("Coût"), hd("Dépôt")],
      [lb("Motifs regex", { fontSize: 10.5 }), flow("regex check input · output · retrieval"), st("E · S · R"), ref("Refuser · R : extrait retiré"), cost("déterministe", CD), repo("default · strict")],
      [lb("Injection (YARA)", { fontSize: 10.5 }), flow("injection detection"), st("S"), ref("Refuser ou retirer (omit)"), cost("déterministe", CD), repo("default · strict")],
      [lb("Taille du contexte", { fontSize: 10.5 }), flow("context bloat detection on input · on retrieval"), st("E · R"), soft("Refuser, tronquer, avertir", C.yellow), cost("déterministe", CD), repo("—")],
      [lb("Appels d'outils", { fontSize: 10.5 }), flow("tool call validation · tool result validation"), st("Outils"), ref("Refuser (nom, schéma JSON)"), cost("déterministe", CD), repo("—")],
      [lb("Jailbreak", { fontSize: 10.5 }), flow("jailbreak detection heuristics · model"), st("E"), ref("Refuser"), cost("modèle dédié", CM), repo("—")],
      [lb("Données personnelles", { fontSize: 10.5 }), flow("mask sensitive data on input · output · retrieval"), st("E · S · R"), soft("Masquer (Presidio)", C.accent), cost("modèle dédié", CM), repo("—")],
      [lb("Contenu nuisible", { fontSize: 10.5 }), flow("content safety check input · output $model=…"), st("E · S"), ref("Refuser"), cost("modèle dédié", CM), repo("—")],
      [lb("Hors sujet", { fontSize: 10.5 }), flow("topic safety check input $model=topic_control"), st("E"), ref("Refuser"), cost("modèle dédié", CM), repo("—")],
      [lb("Auto-contrôle", { fontSize: 10.5 }), flow("self check input · self check output"), st("E · S"), ref("Refuser"), cost("appel LLM", CL), repo("strict")],
      [lb("Hallucination", { fontSize: 10.5 }), flow("self check facts · self check hallucination"), st("S"), soft("Refuser ou avertir", C.yellow), cost("appel LLM", CL), repo("—")],
    ];
    s.addTable(rows, { x: MX, y: 1.78, w: 12.13, colW: [1.85, 4.55, 0.75, 2.5, 1.2, 1.28], rowH: [0.36, 0.39, 0.39, 0.39, 0.39, 0.39, 0.39, 0.39, 0.39, 0.39, 0.39], ...TB });
    // Légende : niveaux de réaction, du plus dur au plus souple
    const lv = [["REFUSER", "le tour s'arrête : 403 à la passerelle", C.red], ["MASQUER", "la donnée est anonymisée", C.accent], ["RETIRER", "contenu fautif retiré ou tronqué", C.violet], ["AVERTIR", "passe, avec un avertissement", C.yellow]];
    lv.forEach((l, i) => {
      const x = MX + i * 3.08;
      pill(s, l[0], l[2], x, 6.27, 1.1, 0.3);
      txt(s, l[1], x + 1.18, 6.22, 1.85, 0.4, { size: 10, color: C.text, valign: "middle", lsm: 0.95 });
    });
    txt(s, "E entrée · S sortie · R extraits récupérés (RAG) · Outils : appels et résultats d'outils. Bibliothèque Apache-2.0 ; rails tiers (Llama Guard, Presidio, Cisco AI Defense…) par configuration.", MX, 6.68, 12.1, 0.28, { size: 9.5, color: C.dim });
    s.addNotes(
      "MESSAGE · Le catalogue est large, mais chaque rail a un coût — et les lignes du haut ne coûtent rien.\n• 30 secondes, ne pas lire le tableau.\n• Trois paliers : déterministe (regex, YARA, taille, outils), modèle dédié (jailbreak, PII, contenu), appel LLM (auto-contrôle, hallucination).\n• La plupart des rails refusent (le 403 de la démo C) ; Presidio masque, YARA peut retirer, d'autres avertissent.\n• Dans le dépôt : profil default (regex + YARA, < 10 ms) ; profil strict (+ auto-contrôle).\n→ « Et par rapport à Foundry ? »"
    );
  }

  // ----------------------------------------------------------------- 35-C. Foundry face à NeMo : règles et extension
  {
    const s = newSlide();
    kicker(s, "SÉCURISER LES LLM · FOUNDRY OU NEMO");
    title(s, "Règles fournies et extension : Foundry face à NeMo", { size: 26 });
    const c = (t, o = {}) => cl(t, { align: "left", fontSize: 10, ...o });
    const lim = (t) => c(t, { color: C.yellow });
    const rows = [
      [hd(""), hd("Microsoft Foundry · garde-fous"), hd("NVIDIA NeMo Guardrails")],
      [lb("Règles fournies"), c("4 catégories (haine, sexuel, violence, auto-mutilation), Prompt Shields direct et indirect, matériel protégé texte et code, grossièretés · préversion : PII, ancrage, adhérence à la tâche"), c("10 familles natives (slide précédente) et plus de 20 intégrations tierces : Llama Guard, Presidio, Cisco AI Defense…")],
      [lb("Niveaux de blocage"), c("4 niveaux par catégorie : Off · Low · Medium · High — Medium par défaut, bloque « moyen » et « élevé »"), c("Par rail : refuser, masquer, retirer ou tronquer, avertir · seuils réglables (perplexité, taille, score)")],
      [lb("Actions"), lim("Annoter, ou annoter et bloquer · annoter seulement, ou couper un filtre en sortie : sur approbation Microsoft"), c("Choisies dans config.yml, sans approbation")],
      [lb("Regex"), lim("Listes de blocage : terme exact ou regex, 10 000 termes par liste · modèles Azure OpenAI seulement"), c("regex check input · output · retrieval : les motifs dans config.yml")],
      [lb("Règles métier propres"), lim("Aucun code dans le garde-fou · une classification sur mesure passe par une API à part (Content Safety)"), c("Rails Colang et actions Python : n'importe quelle règle, n'importe quel modèle de contrôle")],
      [lb("Points d'intervention"), c("Entrée et sortie · appel et réponse d'outil pour les agents Foundry (préversion)"), c("Entrée, sortie, extraits RAG, dialogue, appels et résultats d'outils")],
      [lb("Modèles couverts"), lim("Modèles vendus par Azure, agents Foundry Agent Service · ni Claude, ni nos agents kagent"), c("Tout modèle derrière la passerelle : Foundry, Claude, Bedrock, KAITO")],
      [lb("Exploitation"), c("Managé et inclus · 50 à 100 ms par point d'intervention activé", { color: C.green }), lim("À héberger : adaptateur et modèles de contrôle · < 10 ms en profil default")],
    ];
    s.addTable(rows, { x: MX, y: 1.78, w: 12.13, colW: [2.2, 5.0, 4.93], rowH: [0.38, 0.62, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], ...TB });
    txt(s, "Foundry : on règle sans coder, sur ses propres modèles. NeMo : on code ses règles, pour tous les modèles. On empile les deux.", MX, 6.52, 12.1, 0.4, { face: H, size: 13.5, bold: true, color: C.accent });
    s.addNotes(
      "MESSAGE · Foundry : régler sans coder, sur ses modèles. NeMo : coder ses règles, pour tous les modèles. On empile.\n• 30 secondes : lire la dernière ligne. Les cellules colorées sont les limites.\n• Foundry : 4 niveaux (Off à High, Medium par défaut), annoter ou bloquer ; assouplir en sortie demande l'accord de Microsoft.\n• Extension Foundry : listes de blocage (terme exact ou regex, 10 000 termes, modèles Azure OpenAI) ; pas de logique métier.\n• NeMo : une règle métier = un flow Colang et une action Python, testés comme du code ; à héberger.\n→ « Le socle, c'est la passerelle plus NeMo. Je vous le montre. »"
    );
  }

  // ----------------------------------------------------------------- 36. Démo C (demos/C-nemo-guardrails)
  {
    const s = newSlide();
    kicker(s, "DÉMO C");
    tag(s, "LIVE", C.green);
    title(s, "Le socle standard de garde-fous : NeMo derrière la passerelle", { size: 27 });
    // Chaîne : route → couche 1 → couche 2 → modèle
    const chain = [
      ["Route LLM", "/v1, /agents/v1…", C.accent],
      ["Couche 1 · regex native", "cartes bancaires · µs", C.green],
      ["Couche 2 · webhook NeMo", "secrets, IBAN, NIR, injections · FailClosed · 3 s", C.violet],
      ["Modèle", "Foundry, Bedrock, KAITO…", C.muted],
    ];
    chain.forEach((c, i) => {
      const y = 1.95 + i * 1.0;
      card(s, MX, y, 5.2, 0.78, { line: c[2], lw: 1.5 });
      txt(s, c[0], MX + 0.25, y + 0.04, 4.8, 0.38, { face: H, size: 15, bold: true, color: C.white });
      txt(s, c[1], MX + 0.25, y + 0.42, 4.8, 0.32, { size: 12, color: C.muted });
      if (i < chain.length - 1) arrow(s, MX + 2.6, y + 0.79, 0, 0.2, C.muted, 2);
    });
    const rows = [
      [hd("Prompt"), hd("Avant"), hd("Après")],
      [lb("Clé d'API collée"), cl("200 — jusqu'au modèle", { color: C.red }), cl("403 — NeMo", { color: C.green })],
      [lb("Numéro de sécurité sociale"), cl("200 — jusqu'au modèle", { color: C.red }), cl("403 — NeMo", { color: C.green })],
      [lb("Numéro de carte"), cl("rejeté — couche 1"), cl("rejeté — couche 1")],
      [lb("Prompt normal"), cl("200"), cl("200 — < 10 ms de garde-fous")],
    ];
    s.addTable(rows, { x: 6.2, y: 1.95, w: W - MX - 6.2, colW: [2.35, 2.0, W - MX - 6.2 - 4.35], rowH: [0.42, 0.62, 0.62, 0.55, 0.62], ...TB });
    txt(s, "Une règle à la passerelle, quel que soit le fournisseur — y compris Claude dans Foundry, sans filtre Foundry.", 6.2, 5.05, W - MX - 6.2, 0.7, { size: 13.5, color: C.accent, bold: true, lsm: 1.05 });
    card(s, MX, 6.05, 12.13, 0.75, { fill: C.surf, line: C.yellow });
    txt(s, "Adaptateur arrêté : la passerelle refuse tout. Pas de garde-fou, pas de trafic LLM.", MX + 0.3, 6.05, 11.5, 0.75, { size: 14, color: C.white, valign: "middle" });
    s.addNotes(
      "DÉMO C · EN DIRECT · ./demos/C-nemo-guardrails/run.ps1 (prepare.ps1 la veille)\n1 · Le socle : profil default, webhook FailClosed, délai 3 s.\n2 · Avant : la clé d'API et le numéro de sécurité sociale atteignent le modèle ; la carte est arrêtée par la regex native.\n3 · kubectl apply de guardrails/deploy.\n4 · Après : 403 sur les mêmes prompts ; un prompt normal passe, moins de 10 ms de garde-fous.\n5 · Journaux et métriques de l'adaptateur.\n6 · Option -AvecPanne : adaptateur arrêté, tout est refusé.\n• Les prompts de la démo sont dans les tests : la démo ne peut pas dériver des règles.\n• Secours : vidéo C. Après : reset.ps1.\n→ Ce que je referais."
    );
  }

  // ----------------------------------------------------------------- 36. Bonnes pratiques
  {
    const s = newSlide();
    kicker(s, "BONNES PRATIQUES");
    title(s, "Ce que je referais dès le premier jour");
    const bp = [
      ["Aucune clé fournisseur hors de la passerelle", "Agents et fronts parlent à une route, jamais à un modèle."],
      ["Des jetons d'accès v2, des rôles par GUID", "requested_access_token_version = 2 ; rôles Foundry assignés par identifiant."],
      ["Sans secret de bout en bout", "Workload Identity pour Foundry et les outils Azure ; OIDC pour la CI."],
      ["Les règles à la passerelle, les filtres natifs en plus", "Une règle, tous les modèles ; Foundry en deuxième ligne."],
      ["Tout outil d'entreprise derrière la passerelle", "Sinon il échappe aux garde-fous, au comptage et à l'audit."],
      ["Imputer les coûts à l'équipe d'abord", "Un libellé par personne multiplie les séries Prometheus : la personne va dans les journaux."],
      ["Le catalogue avant le self-service", "Ce qui n'est pas publié et versionné ne se déploie pas."],
      ["Épingler chaque version", "API en alpha partout : charts, images, et CRD relus à chaque montée."],
    ];
    bp.forEach((b, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = MX + col * 6.15, y = 1.95 + row * 1.1;
      num(s, i + 1, x, y + 0.08, 0.48);
      txt(s, b[0], x + 0.65, y, 5.3, 0.4, { face: H, size: 14.5, bold: true, color: C.white });
      txt(s, b[1], x + 0.65, y + 0.4, 5.3, 0.55, { size: 12, color: C.muted });
    });
    s.addNotes(
      "MESSAGE · Huit règles, trois à retenir.\n• Ne pas tout lire : citer 1, 5 et 7 — elles auraient évité les douleurs de l'identité et du self-service.\n→ « Et combien ça coûte ? »"
    );
  }

  // ----------------------------------------------------------------- 37. Coût (slide 38)
  // Prix publics Azure (API Retail Prices), Sweden Central, USD, relevés le 11/10/2026, Linux, 730 h/mois :
  //   D4as_v5 0,184 $/h (réservé 1 an 995 $, 3 ans 1 910 $) · D8as_v5 0,368 $/h (1 an 1 989 $, 3 ans 3 820 $)
  //   AKS Standard (SLA) 0,10 $/h = 73 $/mois · AKS Free 0 $
  //   PoC : 2 × 134,32 = 269 (réservé 3 ans : 2 × 53,06 = 106)
  //   Prod 3 nœuds : 3 × 268,64 + 73 = 879 (réservé 3 ans : 3 × 106,11 + 73 = 391)
  //   Prod 6 nœuds : 6 × 268,64 + 73 = 1 685 (réservé 3 ans : 6 × 106,11 + 73 = 710)
  {
    const s = newSlide();
    kicker(s, "CE QUE ÇA COÛTE");
    title(s, "Le socle coûte peu. Ce qui coûte, c'est l'inférence sans limite.", { size: 28 });
    txt(s, "Compute AKS par mois — prix public et réservation 3 ans", MX, 1.72, 7.6, 0.35, { size: 13, color: C.muted, italic: true });
    s.addChart(pres.charts.BAR, [
      { name: "Prix public", labels: ["PoC de ce soir\n2 × D4as_v5 · Free", "Prod 3 nœuds\n3 × D8as_v5 · SLA", "Prod 6 nœuds\n6 × D8as_v5 · SLA"], values: [269, 879, 1685] },
      { name: "Réservé 3 ans", labels: ["PoC de ce soir\n2 × D4as_v5 · Free", "Prod 3 nœuds\n3 × D8as_v5 · SLA", "Prod 6 nœuds\n6 × D8as_v5 · SLA"], values: [106, 391, 710] },
    ], {
      x: MX, y: 2.05, w: 7.6, h: 4.1, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
      chartColors: [C.accent, C.green],
      showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.white, dataLabelFontSize: 12, dataLabelFormatCode: "# ##0 \"$\"",
      catAxisLabelColor: C.text, catAxisLabelFontSize: 11.5, catAxisLabelFontFace: B,
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, valAxisMaxVal: 1950,
      showLegend: true, legendPos: "t", legendColor: C.text, legendFontSize: 11.5, legendFontFace: B,
    });
    card(s, 8.5, 1.95, 4.25, 1.55, { line: C.accent, lw: 1.5 });
    txt(s, "Ce qui change en prod", 8.75, 2.05, 3.9, 0.35, { face: H, size: 14, bold: true, color: C.accent });
    bullets(s, ["plan de contrôle Standard : SLA, 73 $/mois", "nœuds 8 vCPU · 32 Go, un par zone", "réservé 3 ans : −60 % sur les nœuds"], 8.75, 2.45, 3.95, 1.0, { size: 12, psa: 3 });
    card(s, 8.5, 3.7, 4.25, 1.75, { line: C.yellow, lw: 1.5 });
    txt(s, "60 000 €", 8.75, 3.78, 3.9, 0.85, { face: H, size: 42, bold: true, color: C.yellow });
    txt(s, "un week-end, une clé qui fuit, aucun plafond : ≈ 41 mois du cluster de prod à 6 nœuds, au prix public", 8.75, 4.6, 3.9, 0.8, { size: 12.5, color: C.text, lsm: 1.05 });
    txt(s, "La passerelle est l'assurance la moins chère du projet.", 8.5, 5.6, 4.25, 0.6, { face: H, size: 15, bold: true, color: C.white, lsm: 1.05 });
    txt(s, "Prix publics Azure (API Retail Prices), Sweden Central, USD, relevés en octobre 2026, Linux, 730 h/mois. Hors disques, load balancer, IP, logs, sortie réseau et inférence.", MX, 6.35, 7.7, 0.5, { size: 10, color: C.dim });
    s.addNotes(
      "MESSAGE · Le socle coûte peu ; ce qui coûte, c'est l'inférence sans limite.\n• PoC : 269 $/mois, détruit après chaque session · prod 3 nœuds : 879 $ (391 $ réservé 3 ans) · prod 6 nœuds : 1 685 $ (710 $).\n• 60 000 € ≈ 69 000 $ ≈ 41 mois du cluster 6 nœuds au prix public.\n• Ordre de grandeur : hors disques, Log Analytics (souvent la surprise) et sortie réseau. Prix Azure Retail, Sweden Central, octobre 2026.\n→ Trois choses à emporter."
    );
  }

  // ----------------------------------------------------------------- 38. À retenir
  {
    const s = newSlide();
    kicker(s, "À RETENIR");
    title(s, "Trois choses à emporter");
    const t = [
      ["Foundry pour les modèles, la passerelle pour le contrôle", "Identité, plafonds, garde-fous et coûts en un point — pour tous les modèles et tous les outils."],
      ["Un agent est une ressource avec un cycle de vie", "Publié, versionné, déployé, observé, retiré : kagent et agentregistry, comme un Deployment."],
      ["L'identité est le vrai chantier", "Le login est facile ; propager l'utilisateur jusqu'à l'outil et à la facture, c'est là que se joue l'entreprise."],
    ];
    t.forEach((it, i) => {
      const y = 2.0 + i * 1.45;
      txt(s, String(i + 1), MX, y, 0.9, 1.1, { face: H, size: 54, bold: true, color: C.deep });
      txt(s, it[0], MX + 1.1, y + 0.1, 11, 0.5, { face: H, size: 21, bold: true, color: C.white });
      txt(s, it[1], MX + 1.1, y + 0.62, 11, 0.6, { size: 15.5, color: C.muted });
    });
    s.addNotes(
      "• Lire les trois titres, pas les sous-titres.\n→ « Merci. »"
    );
  }

  // ----------------------------------------------------------------- 39. Merci
  {
    const s = newSlide({ footer: false });
    txt(s, "Merci !", MX, 1.5, 8, 1.4, { face: H, size: 72, bold: true, color: C.white });
    txt(s, "Questions ?", MX, 2.95, 8, 0.8, { face: H, size: 32, color: C.accent });
    card(s, MX, 4.2, 7.6, 1.6, { line: C.border });
    txt(s, "Le dépôt complet — Terraform, manifestes, démos, tableau de bord, schémas d'architecture — est publié : scannez le QR code.", MX + 0.3, 4.35, 7.0, 0.8, { size: 16, color: C.text, lsm: 1.1 });
    txt(s, "smartcloudarchitect.fr  ·  blog.smartcloudarchitect.fr", MX + 0.3, 5.2, 7.0, 0.45, { size: 16, bold: true, color: C.accent });
    s.addImage({ path: LOGO_PATH, x: MX, y: 6.15, w: 0.6 * LOGO_RATIO, h: 0.6, altText: "Logo Smart Cloud Architect" });
    txt(s, "Antoine LOIZEAU · Smart Cloud Architect", MX + 0.6 * LOGO_RATIO + 0.2, 6.25, 8, 0.4, { size: 14, color: C.muted });
    // QR code du dépôt : toujours sur fond blanc (contraste et zone de silence, même en thème sombre)
    const qx = 9.45, qy = 0.85, qd = 3.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: qx - 0.12, y: qy - 0.12, w: qd + 0.24, h: qd + 0.24, rectRadius: 0.12, fill: { color: "FFFFFF" }, line: { color: C.accent, width: 2 } });
    s.addImage({ path: "assets/qr-depot.png", x: qx, y: qy, w: qd, h: qd, altText: "QR code : github.com/aloizeau/agentic-ai-azure-and-beyond-geneve-2026" });
    txt(s, "Code source et démos", qx - 0.12, qy + qd + 0.25, qd + 0.24, 0.35, { face: H, size: 15, bold: true, color: C.white, align: "center" });
    txt(s, "github.com/aloizeau/\nagentic-ai-azure-and-beyond-geneve-2026", qx - 0.4, qy + qd + 0.62, qd + 0.8, 0.6, { face: M, size: 10.5, color: C.accent, align: "center", lsm: 1.05 });
    labels(s, [["governed", "true"], ["identity", "end-to-end"]], { x: qx - 0.12, y: 5.65, size: 15, gap: 0.15 });
    s.addNotes(
      `MESSAGE · Laisser cette slide à l'écran pendant toutes les questions.\n• Le QR code mène au dépôt : github.com/aloizeau/agentic-ai-azure-and-beyond-geneve-2026. Vérifier la veille qu'il est public.\n• Questions probables : APIM (annexe « deux couches »), Foundry Agent Service (slide ${N.agentService}), kagent 1.0 (slide ${N.kagentV1}), coûts et Data Zone, maturité alpha.\n• Le client : ne jamais le nommer.`
    );
  }

  // =================================================================== ANNEXES
  // ----------------------------------------------------------------- 40. Ce qui a fait basculer
  {
    const s = newSlide();
    kicker(s, "ANNEXE · CE QUI A FAIT BASCULER");
    title(s, "Pour une plateforme Kubernetes, cinq raisons");
    const r = [
      ["L'écosystème", "kagent (CNCF Sandbox), kmcp, agentregistry : des stacks IA standardisées, déployées comme n'importe quelle ressource Kubernetes."],
      ["Un standard, pas un produit", "Gateway API : la compétence et les manifestes suivent d'un cloud à l'autre."],
      ["L'autorisation par outil", "CEL (Common Expression Language) sur jwt.* et mcp.tool.name — les outils non autorisés disparaissent du tools/list."],
      ["La fédération MCP", "Un seul endpoint pour Jira, Azure DevOps, SharePoint… au lieu d'une connexion par serveur."],
      ["Rust", "~22 Mo de mémoire par instance, contre plusieurs Go pour un proxy Python.*"],
    ];
    r.forEach((it, i) => {
      const y = 1.95 + i * 0.86;
      num(s, i + 1, MX, y + 0.05, 0.55, C.deep, 16);
      txt(s, it[0], MX + 0.8, y + 0.02, 3.2, 0.6, { face: H, size: 16, bold: true, color: C.white, valign: "middle" });
      txt(s, it[1], MX + 4.1, y + 0.02, 8.0, 0.66, { size: 14, color: C.muted, valign: "middle", lsm: 1.05 });
    });
    txt(s, "* Mesure publiée par Solo.io, sur un backend factice. À retenir : l'empreinte mémoire, pas le multiple de débit.", MX, 6.35, 12.1, 0.5, { size: 11, color: C.dim });
    s.addNotes(
      "• Raisons 1 et 5 : celles de l'équipe au départ. Raisons 2 à 4 : venues en creusant."
    );
  }

  // ----------------------------------------------------------------- 41. Pièges
  {
    const s = newSlide();
    kicker(s, "ANNEXE · REX TECHNIQUE", C.yellow);
    title(s, "Six pièges que la documentation ne met pas en avant");
    const p = [
      ["« Azure AI Foundry » → Microsoft Foundry", "Rôles renommés, GUID inchangés : assignez les rôles par GUID."],
      ["/models est retiré depuis le 26/08/2026", "Utilisez /openai/v1/ — sans paramètre api-version."],
      ["Le scope a changé", "https://ai.azure.com/.default, plus cognitiveservices.azure.com."],
      ["requested_access_token_version = 2", "Sinon l'aud devient api://<id> : un 401 garanti."],
      ["capacity = 1 dans l'exemple officiel", "1 000 jetons par minute : un seul chat suffit à saturer."],
      ["agentgateway n'est plus kgateway", "AgentgatewayBackend et AgentgatewayPolicy, plus Backend ni TrafficPolicy."],
    ];
    for (let i = 0; i < 6; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = MX + col * 6.15, y = 1.95 + row * 1.5, w = 5.95, h = 1.3;
      card(s, x, y, w, h);
      await iconCircle(s, "FaExclamationTriangle", x + 0.25, y + 0.3, 0.7, C.yellow);
      txt(s, p[i][0], x + 1.15, y + 0.2, w - 1.35, 0.45, { face: H, size: 15, bold: true, color: C.white });
      txt(s, p[i][1], x + 1.15, y + 0.68, w - 1.35, 0.5, { size: 13, color: C.muted });
    }
    s.addNotes(
      "• Slide « photo ». Revérifier la veille sur Microsoft Learn et dans la doc agentgateway."
    );
  }

  // ----------------------------------------------------------------- 42. Souveraineté
  {
    const s = newSlide();
    kicker(s, "ANNEXE · SOUVERAINETÉ");
    title(s, "La souveraineté devient une ligne de configuration");
    const cols = [
      ["GlobalStandard", "Traitement possible dans n'importe quelle région Azure du monde", C.yellow, "gpt-5.6-sol"],
      ["DataZoneStandard", "Traitement uniquement dans la zone de données UE", C.green, "terra · luna"],
      ["Standard", "Traitement dans la géographie Azure choisie", C.green, "selon le modèle"],
    ];
    for (let i = 0; i < 3; i++) {
      const x = MX + i * 2.85, y = 2.1, w = 2.65, h = 3.35;
      card(s, x, y, w, h, { line: cols[i][2], lw: 1.5 });
      txt(s, cols[i][0], x + 0.2, y + 0.3, w - 0.4, 0.4, { face: M, size: 13, bold: true, color: cols[i][2] });
      txt(s, cols[i][1], x + 0.2, y + 0.85, w - 0.4, 1.5, { size: 14, color: C.text, lsm: 1.1 });
      txt(s, cols[i][3], x + 0.2, y + 2.55, w - 0.4, 0.55, { face: M, size: 13, bold: true, color: cols[i][2] });
    }
    txt(s, "UE", 9.3, 2.1, 3.4, 1.3, { face: H, size: 72, bold: true, color: C.green });
    txt(s, "DataZone borne le traitement à la zone UE. Le prix dépend du modèle et doit être vérifié dans Foundry.", 9.3, 3.45, 3.45, 1.1, { size: 13, color: C.muted, lsm: 1.1 });
    txt(s, "« Global types: May be processed in any Azure region. »", 9.3, 4.65, 3.45, 0.8, { size: 13, italic: true, color: C.text });
    txt(s, "Source : learn.microsoft.com — Foundry deployment types.", MX, 5.8, 12.1, 0.5, { size: 11, color: C.dim });
    s.addNotes(
      "• Si la question vient : le type de déploiement est une ligne du Terraform (sku_name)."
    );
  }

  // ----------------------------------------------------------------- 43. Deux couches
  {
    const s = newSlide();
    kicker(s, "ANNEXE · APIM ET AGENTGATEWAY");
    title(s, "Deux couches, pas deux concurrents");
    const steps = [["Vos API REST existantes", C.border, C.text], ["APIM\nfabrique des serveurs MCP", C.accent, C.white], ["agentgateway\nfédère, autorise, observe", C.green, C.white], ["Agents et utilisateurs", C.border, C.text]];
    steps.forEach((st, i) => {
      const x = MX + i * 3.15, y = 2.5, w = 2.6, h = 1.6;
      card(s, x, y, w, h, { line: st[1], lw: 1.75 });
      txt(s, st[0], x + 0.15, y, w - 0.3, h, { face: H, size: 15, bold: true, color: st[2], align: "center", valign: "middle" });
      if (i < 3) arrow(s, x + w + 0.05, y + h / 2, 0.45, 0, C.muted);
    });
    txt(s, "APIM transforme un patrimoine d'API en outils d'agents. agentgateway gouverne ces outils à l'exécution, au plus près des agents, dans le cluster.", MX, 4.65, 12.1, 0.9, { size: 17, color: C.text, lsm: 1.1 });
    txt(s, "Architecture possible, pas celle du REX : à envisager si votre point de départ est un catalogue d'API.", MX, 5.75, 12.1, 0.4, { size: 13, italic: true, color: C.muted });
    s.addNotes(
      "• On ne choisit pas un camp, on choisit une couche."
    );
  }

  // ----------------------------------------------------------------- 45. KAITO (annexe)
  {
    const s = newSlide();
    kicker(s, "ANNEXE · MODÈLE DANS LE CLUSTER", C.green);
    title(s, "Un modèle dans le cluster, les mêmes règles");
    code(s, [
      "apiVersion: kaito.sh/v1beta1",
      "kind: Workspace",
      "metadata:",
      "  name: workspace-phi-4-mini",
      "  namespace: models",
      "resource:",
      "  instanceType: Standard_NV36ads_A10_v5",
      "inference:",
      "  preset:",
      "    name: microsoft/Phi-4-mini-instruct",
      "# + AgentgatewayBackend « custom » (providerOverride: kaito)",
      "# + route /aks/v1 et les mêmes règles",
    ], MX, 1.95, 6.7, 3.9, { size: 11.5, label: "models/deploy/" });
    const pts = [
      ["FaRoute", "Même passerelle, une route de plus", "Les agents ne changent pas.", C.accent],
      ["FaShieldAlt", "Pas de filtres Foundry ici", "Seules les règles de la passerelle protègent ce modèle.", C.green],
      ["FaSearchDollar", "Le coût change de nature", "≈ 4,16 $/h le GPU A10, 0 $ au jeton dans « Usage IA ».", C.yellow],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.95 + i * 1.32;
      card(s, 7.35, y, 5.4, 1.15, { line: pts[i][3] });
      await iconCircle(s, pts[i][0], 7.55, y + 0.22, 0.7, pts[i][3]);
      txt(s, pts[i][1], 8.45, y + 0.12, 4.15, 0.4, { face: H, size: 15, bold: true, color: C.white });
      txt(s, pts[i][2], 8.45, y + 0.55, 4.15, 0.55, { size: 12.5, color: C.muted });
    }
    s.addNotes(
      "• Réponse à « et sans fournisseur de modèles ? ». Script dans le dépôt (demos/chalet/E-auto-heberge), pas de démo ce soir."
    );
  }

  // ----------------------------------------------------------------- 45. Le bilan
  {
    const s = newSlide();
    kicker(s, "ANNEXE · LE BILAN");
    title(s, "Ce qui a marché, ce qui a fait mal");
    const colW = 5.95;
    card(s, MX, 1.95, colW, 3.9, { line: C.green });
    await iconCircle(s, "FaCheck", MX + 0.3, 2.2, 0.65, C.green);
    txt(s, "Ce qui a marché", MX + 1.1, 2.25, 4.5, 0.55, { face: H, size: 19, bold: true, color: C.white, valign: "middle" });
    bullets(s, ["Un point d'entrée unique pour ~3 000 collaborateurs", "Des connecteurs SI réutilisables d'un projet à l'autre", "Des stacks IA standardisées, déployées par kagent", "Une gouvernance transverse, avec sa politique"], MX + 0.35, 3.15, colW - 0.7, 3.2, { size: 15, psa: 12 });
    const x2 = MX + 6.18;
    card(s, x2, 1.95, colW, 3.9, { line: C.yellow });
    await iconCircle(s, "FaTools", x2 + 0.3, 2.2, 0.65, C.yellow);
    txt(s, "Ce qui a fait mal", x2 + 1.1, 2.25, 4.5, 0.55, { face: H, size: 19, bold: true, color: C.white, valign: "middle" });
    bullets(s, ["Une documentation qui bouge plus vite que les projets", "Des API en alpha partout : épingler chaque version", "La propagation de l'identité Entra ID d'outil en outil", "L'imputation des coûts quand un agent agit pour quelqu'un"], x2 + 0.35, 3.15, colW - 0.7, 3.2, { size: 15, psa: 12 });
    s.addNotes(
      "• À compléter avant jeudi : une ou deux douleurs vécues chez le client (adoption, quotas, validation sécurité)."
    );
  }

  await pres.writeFile({ fileName: `rex-architectures-ia-entreprise${SUFFIX}.pptx` });
  console.log("écrit :", D.count(), "slides");
})();
