// =============================================================================
//  IA agentique : vers Azure et au-delà !
//  REX — architectures IA d'entreprise : AKS · écosystème Solo.io · Microsoft Foundry
//  Talk de ~45 min · jeudi 29 octobre 2026, 18:00–21:00 · Tesla Store Genève
//  Antoine LOIZEAU · Smart Cloud Architect
//
//  NODE_PATH=<modules globaux> node build-rex.js   → rex-architectures-ia-entreprise.pptx
//  Programme annoncé : (1) Microsoft Foundry et les architectures IA d'entreprise,
//  (2) déploiement et orchestration sur AKS, (3) Solo.io Agent Gateway et Agent
//  Registry, (4) kagent et la gestion du cycle de vie des agents, (5) REX,
//  gouvernance et bonnes pratiques.
//  Démos à l'écran = dossiers du dépôt (PowerShell) :
//  A → demos/A-ratelimit-entra (section 03), B → demos/B-agent-equipe (section 04),
//  C → demos/C-nemo-guardrails (section 05).
// =============================================================================
const { C, H, B, M, W, MX, LOGO_PATH, LOGO_RATIO, createDeck } = require("./theme");

const EVENT = { kicker: "JEUDI 29 OCTOBRE 2026 · GENÈVE", place: "Tesla Store Genève · Rue de la Confédération 8 · 18:00–21:00" };

// Minutage : 40 min de talk + 5 min de questions. Un créneau par slide, dans l'ordre.
const TIMES = [null,
  "0:00 — 0:20", "0:20 — 0:50", "0:50 — 2:20", "2:20 — 3:00", "3:00 — 3:30",       // ouverture
  "3:30", "3:30 — 4:30", "4:30 — 5:45", "5:45 — 7:00", "7:00 — 8:15",                // 01 Foundry
  "8:15", "8:15 — 9:15", "9:15 — 10:15",                                              // 02 AKS
  "10:15", "10:15 — 11:15", "11:15 — 12:00", "12:00 — 15:30", "15:30 — 16:30",       // 03 Solo.io (démo A)
  "16:30 — 17:30", "17:30 — 18:15", "18:15 — 19:15",
  "19:15", "19:15 — 20:00", "20:00 — 20:45", "20:45 — 22:00", "22:00 — 22:45",       // 04 kagent (démo B)
  "22:45 — 23:30", "23:30 — 29:30", "29:30 — 30:15",
  "30:15", "30:15 — 31:30", "31:30 — 32:30", "32:30 — 33:15", "33:15 — 33:45",       // 05 REX (démo C)
  "33:45 — 34:30", "34:30 — 37:30", "37:30 — 38:15", "38:15 — 38:45", "38:45 — 40:00",
  "40:00 — 45:00",                                                                    // questions
  "ANNEXE", "ANNEXE", "ANNEXE", "ANNEXE", "ANNEXE", "ANNEXE",
];

const D = createDeck({
  title: "IA agentique : vers Azure et au-delà !",
  footer: "IA agentique : vers Azure et au-delà !  ·  Antoine LOIZEAU",
  times: TIMES,
});
const { pres, icon, newSlide, kicker, title, labels, card, iconCircle, txt, bullets, code, arrow, line, tag, pill, num, divider } = D;

// Table helpers
const hd = (t, o = {}) => ({ text: t, options: { fill: { color: C.surf2 }, color: C.white, bold: true, fontFace: H, fontSize: 12.5, align: "center", valign: "middle", ...o } });
const lb = (t, o = {}) => ({ text: t, options: { fill: { color: C.surf }, color: C.text, fontFace: B, fontSize: 12, valign: "middle", bold: true, ...o } });
const cl = (t, o = {}) => ({ text: t, options: { fill: { color: C.surf }, color: C.text, fontFace: B, fontSize: 11.5, valign: "middle", align: "center", ...o } });
const TB = { border: { type: "solid", color: C.bg, pt: 2 } };

(async () => {
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
      "Accueil. Laisser le clin d'œil faire sourire, sans le commenter longtemps : « On part d'Azure… et on garde la liberté d'aller au-delà. » " +
      "Aucune image du personnage ni du film dans le deck : la réplique seule suffit. " +
      "Le sous-titre reprend le descriptif de l'annonce. Le produit s'appelle aujourd'hui Microsoft Foundry " +
      "(l'annonce dit encore « Microsoft AI Foundry », c'est le même service, renommé). " +
      "Transition : « Avant l'architecture, je vais vous raconter un week-end. »"
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
    s.addImage({ path: "assets/antoine.jpg", x: px, y: py, w: d, h: d, rounding: true, altText: "Portrait d'Antoine LOIZEAU" });
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
      txt(s, rows[i][2], rx + 4.2, y + 0.2, rw - 4.45, 0.35, { face: M, size: 11, color: C.accent, align: "right" });
      txt(s, rows[i][3], rx + 1.4, y + 0.62, rw - 1.65, 0.7, { size: 13.5, color: C.text, lsm: 1.05 });
    }
    txt(s, "Le Terraform, les manifestes, les démos et les tableaux de bord de ce soir sont publiés.", rx, 6.52, rw, 0.35, { size: 13, italic: true, color: C.accent });
    s.addNotes("Trente secondes. Une seule idée : tout ce que vous allez voir est publié et rejouable.");
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
      "L'histoire, sans nommer le client — jamais, même en Q&A : « un groupe média français, environ 3 000 collaborateurs ». " +
      "L'IA ouverte à tous, sans limite. Une clé fuit. Lundi matin : plus de 60 000 € de consommation. " +
      "Laisser le chiffre respirer. « Ce n'est pas une histoire de hackers. C'est une histoire d'architecture. »"
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
    s.addNotes("Identité, limite, trace : les trois questions qui structurent la suite. Chaque brique du programme répond à l'une d'elles.");
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
    s.addNotes("Trente secondes. Le programme annoncé, dans l'ordre. Les démos sont réparties dans les étapes, pas reléguées à la fin.");
  }

  // =================================================================== 01 FOUNDRY
  await divider("01", "Microsoft Foundry et les architectures IA d'entreprise", "Où Foundry s'arrête, où la plateforme commence.",
    "Transition. On part du besoin du client, puis on place Foundry dans l'architecture.", "Foundry · architecture de référence");

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
      "Le constat avant la plateforme : chaque équipe réinventait l'authentification, la gestion des clés, les connecteurs. " +
      "Personne ne voyait la consommation globale. Le week-end à 60 000 € n'est que le symptôme le plus visible."
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
    card(s, tx, 1.95, tw, 4.26, { fill: "0B1A33", line: C.accent, lw: 1.5 });
    txt(s, "TRANSVERSE", tx + 0.2, 2.1, tw - 0.4, 0.3, { face: H, size: 11, bold: true, color: C.accent, cs: 2 });
    const tr = [["Identité", "Entra ID · Workload ID"], ["Observabilité", "Prometheus · Grafana"], ["Gouvernance", "politiques · catalogue"], ["Livraison", "Terraform · GitHub OIDC"]];
    tr.forEach((t, i) => {
      txt(s, t[0], tx + 0.2, 2.55 + i * 0.9, tw - 0.4, 0.35, { face: H, size: 15, bold: true, color: C.white });
      txt(s, t[1], tx + 0.2, 2.9 + i * 0.9, tw - 0.4, 0.35, { size: 12, color: C.muted });
    });
    txt(s, "La règle du REX : aucune couche ne parle directement à un fournisseur de modèles. Tout passe par la passerelle.", MX, 6.4, 12.1, 0.45, { size: 15, italic: true, color: C.accent });
    s.addNotes(
      "La carte mentale du talk. Cinq couches, chacune avec sa brique open source, et quatre préoccupations transverses. " +
      "Foundry est la couche du bas. Toutes les autres tournent dans AKS. " +
      "La phrase en bas est la décision d'architecture qui a tout changé : aucun agent, aucun front ne détient de clé fournisseur."
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
      "Foundry, c'est notre fournisseur de modèles et notre première ligne de garde-fous. " +
      "Les trois profils GPT-5.6 sont déployés : Sol en GlobalStandard pour les travaux complexes, Terra et Luna en DataZoneStandard pour rester en UE. " +
      "Pièges vécus : le renommage des rôles (Azure AI User → Foundry User, GUID inchangé), le retrait de /models le 26/08/2026, le nouveau scope."
    );
  }

  // ----------------------------------------------------------------- 10. Agent Service ou AKS
  {
    const s = newSlide();
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
      "La question qu'on me pose toujours. Le client avait besoin d'agents proches de ses outils, multi-fournisseurs, et d'un modèle self-service Kubernetes : AKS. " +
      "Honnêteté : Foundry Agent Service apporte nativement ce qu'on a dû construire — identité d'agent (Entra Agent ID, GA), garde-fous sur les appels d'outils. " +
      "Source : Microsoft Learn, « Guardrails and controls overview » et « Register and manage custom agents » (Foundry Control Plane, via AI gateway / API Management). " +
      "L'inscription de nos agents dans Foundry Control Plane n'a pas été testée : c'est une piste, pas une démo."
    );
  }

  // =================================================================== 02 AKS
  await divider("02", "Déploiement et orchestration sur AKS", "Une plateforme qui sort de terre en un apply.",
    "Transition vers le concret : ce qui tourne dans le cluster, et comment ça arrive.", "AKS · Terraform · Workload ID");

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

    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.65, y: 1.85, w: 7.55, h: 4.75, rectRadius: 0.12, fill: { color: "07101F" }, line: { color: C.green, width: 1.5, dashType: "dash" } });
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
    card(s, 10.65, 2.32, 2.0, 0.78, { fill: "0B2A1F", line: C.green, lw: 1.5 });
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
      "Le périmètre en pointillés verts est portable. Deux choses sortent du cluster : Entra ID et Foundry — les deux adaptateurs Azure. " +
      "Les flèches : LibreChat appelle la passerelle avec le jeton de l'utilisateur ; les agents kagent l'appellent avec la clé de leur équipe ; " +
      "la passerelle relaie aussi les outils MCP. Grafana lit les métriques de la passerelle : coût, jetons et outils par personne."
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
      ["FaLayerGroup", "Deux phases Terraform", "Azure d'abord (AKS, Foundry, identités), puis Helm : agentgateway, kagent, agentregistry…"],
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
      "Ce que l'on gagne à mettre la plateforme sur AKS plutôt que dans des services séparés : identité des workloads, isolation réseau, GPU à la demande. " +
      "Le label azure.workload.identity/use sur les pods est obligatoire — piège classique. " +
      "Une identité managée par porte : id-agentgateway et id-agentgateway-public."
    );
  }

  // =================================================================== 03 SOLO.IO
  await divider("03", "Solo.io Agent Gateway et Agent Registry", "Un point de contrôle et un catalogue.",
    "Transition. La salle a souvent Azure API Management : ce passage doit être irréprochable.", "agentgateway · démo A · garde-fous · agentregistry");

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
      [lb("Autorisation par outil MCP à l'exécution", { bold: false }), v("Non"), v("Oui — par clé, équipe"), v("Oui — CEL sur le JWT")],
      [lb("Consommation par utilisateur", { bold: false }), v("Oui — métriques de jetons"), v("Oui — dépenses en base"), v("Oui — jetons et coût")],
      [lb("Portail développeur, produits, abonnements", { bold: false }), v("Oui"), v("Partiel"), v("Non")],
      [lb("Tourne hors Azure", { bold: false }), v("Self-hosted gateway"), v("Oui"), v("Oui")],
      [lb("Licence", { bold: false }), v("Propriétaire"), v("MIT + dossier enterprise"), v("Apache-2.0 · Linux Foundation")],
    ];
    s.addTable(rows, { x: MX, y: 1.85, w: 12.13, colW: [3.9, 2.75, 2.7, 2.78], rowH: [0.45, 0.5, 0.46, 0.46, 0.46, 0.46, 0.46, 0.46, 0.5], ...TB });
    txt(s, "Documentation officielle de chaque projet. Si votre point de départ est un patrimoine d'API REST, regardez APIM en premier ; pour une plateforme Kubernetes multi-fournisseurs, agentgateway.", MX, 6.3, 12.1, 0.55, { size: 11.5, color: C.dim });
    s.addNotes(
      "Lire sans militantisme : deux lignes pour APIM (REST→MCP, portail), deux pour les autres (fédération, autorisation par outil). " +
      "Ce qui a fait basculer le client : l'écosystème Kubernetes (kagent, kmcp, agentregistry), Gateway API, l'autorisation par outil, la fédération MCP, l'empreinte Rust. " +
      "Détail en annexe. Ne jamais citer le multiple de débit publié par l'éditeur : backend factice."
    );
  }

  // ----------------------------------------------------------------- 17. Pipeline
  {
    const s = newSlide();
    kicker(s, "UN POINT DE CONTRÔLE");
    title(s, "Chaque requête traverse la même chaîne — LLM et outils");
    const steps = [
      ["FaIdCard", "Identité", "JWT Entra ID\nou clé d'équipe"],
      ["FaFilter", "Autorisation", "CEL sur jwt.*\net mcp.tool.name"],
      ["FaShieldAlt", "Contenu", "regex · webhook\nNeMo (trafic LLM)"],
      ["FaTachometerAlt", "Plafonds", "rateLimit\nen jetons"],
    ];
    const y = 2.15, w = 1.95, h = 2.3;
    for (let i = 0; i < steps.length; i++) {
      const x = MX + i * 2.2;
      card(s, x, y, w, h);
      await iconCircle(s, steps[i][0], x + (w - 0.7) / 2, y + 0.25, 0.7, C.green);
      txt(s, steps[i][1], x + 0.1, y + 1.05, w - 0.2, 0.4, { face: H, size: 15, bold: true, color: C.white, align: "center" });
      txt(s, steps[i][2], x + 0.1, y + 1.5, w - 0.2, 0.7, { face: M, size: 9.5, color: C.accent, align: "center" });
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
    txt(s, "jetons · coût\nuser · team", rx + 0.1, y + 1.5, W - MX - rx - 0.2, 0.7, { face: M, size: 9.5, color: C.accent, align: "center" });
    const acts = [["Mask", "remplace la donnée sensible", C.accent], ["Reject", "bloque avant le modèle", C.yellow], ["Audit", "laisse passer, mais trace", C.muted]];
    acts.forEach((a, i) => {
      const x = MX + i * 2.75;
      pill(s, a[0], a[2], x, 4.85, 1.05, 0.38);
      txt(s, a[1], x + 1.18, 4.85, 1.5, 0.4, { size: 12.5, color: C.text, valign: "middle" });
    });
    txt(s, "Portée : prompt et réponse — y compris les résultats d'outils renvoyés au modèle.", 8.9, 4.85, 3.85, 0.4, { size: 12.5, color: C.muted, valign: "middle" });
    card(s, MX, 5.55, 12.13, 0.9, { fill: C.surf, line: C.accent });
    txt(s, "Aucune ligne dans les agents : changez de modèle ou de cloud, la chaîne suit.", MX + 0.3, 5.55, 11.5, 0.9, { size: 17, color: C.white, valign: "middle", bold: true });
    s.addNotes(
      "Une requête de gauche à droite. Chaque étape est une AgentgatewayPolicy attachée à une route. " +
      "Nouveauté du PoC : les appels d'outils MCP passent eux aussi par la passerelle (/mcp), avec le jeton de l'utilisateur. " +
      "C'est ce qui permet de compter qui a appelé quel outil — et de lui appliquer les mêmes garde-fous."
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
      "./demos/A-ratelimit-entra/run.ps1 (PowerShell, az, kubectl). Deux objets Kubernetes appliqués en direct : une HTTPRoute ouverte, puis une AgentgatewayPolicy. " +
      "Étape 1 : trois appels anonymes, tous 200 — « vendredi soir, la clé fuit ». Étape 2 : jeton Entra ID obligatoire (émetteur et audience recopiés de la politique acces-llm) : 401, puis 200 avec mon jeton — " +
      "la passerelle sait qui je suis. Étape 3 : plafond de 400 jetons/min, 429 au bout de quelques appels — « lundi matin, une alerte, pas une facture ». " +
      "Étape 4 : Grafana, dossier Plateforme IA, filtre Utilisateur. Honnêteté : le plafond local est par route et par réplica ; un budget par équipe ou par personne demande le rate limit global. " +
      "Secours : vidéo démo A. Après : reset.ps1."
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
    card(s, 7.2, 5.7, W - MX - 7.2, 1.1, { fill: "2A0F14", line: C.red, lw: 1.5 });
    txt(s, "ET CLAUDE ?", 7.4, 5.78, 2.5, 0.28, { face: H, size: 10.5, bold: true, color: C.red, cs: 2 });
    txt(s, "Les modèles Anthropic du catalogue Foundry n'ont aucun filtre de contenu Foundry : seules les protections d'Anthropic s'appliquent.", 7.4, 6.05, W - MX - 7.6, 0.7, { size: 12, color: C.white, lsm: 1.05 });
    s.addNotes(
      "Ce qui tourne en production chez le client aujourd'hui. Un guardrail Foundry est un ensemble de contrôles : un risque, un point d'intervention, une action (annoter ou bloquer). " +
      "Pour un modèle : entrée et sortie. Les points « appel d'outil » et « réponse d'outil » existent, mais pour les agents du Foundry Agent Service, en préversion. " +
      "Compter 50 à 100 ms par point d'intervention activé (Microsoft Learn). " +
      "Limite pour nous : nos agents tournent dans AKS ; leurs appels d'outils MCP ne passent pas par Foundry. Et un modèle Bedrock ou KAITO n'a pas ces filtres.\n" +
      "ET CLAUDE ? Vérifié sur Microsoft Learn (« Claude models in Microsoft Foundry », section Responsible AI) : « Foundry doesn't provide built-in content filtering for Claude models at deployment time » — " +
      "Microsoft demande de configurer soi-même la sécurité du contenu à l'inférence. Les modèles Claude sont des offres Marketplace de partenaire : Anthropic en est le vendeur, l'opérateur et le sous-traitant des données, " +
      "et seuls les systèmes de sécurité d'Anthropic s'appliquent (le système de guardrails Foundry couvre les « Foundry Models sold by Azure »). " +
      "Deux autres points pour un public européen : hébergé chez Anthropic, le traitement peut sortir d'Azure ; hébergé sur Azure, il n'existe que Global Standard et Data Zone Standard US — pas de Data Zone UE. " +
      "Conclusion pour la plateforme : un Claude consommé via Foundry doit passer par la passerelle pour hériter des mêmes règles (agentgateway sait appeler l'endpoint Anthropic de Foundry, /anthropic/v1/messages — à valider sur notre backend)."
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
    txt(s, "webhook", fx + 2.2, fy + 0.15, 0.6, 0.3, { face: M, size: 9, color: C.muted, align: "center" });
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
      "La cible : une seule règle pour Foundry, Bedrock, KAITO ou un autre cloud. Le garde-fou webhook d'agentgateway appelle un adaptateur qui pilote NeMo Guardrails (nemoguardrails 0.24.1). " +
      "Branché sur le trafic LLM, NeMo voit aussi ce que les outils renvoient au modèle (les résultats d'outils font partie des messages suivants) : c'est ce qui manque côté Foundry pour nos agents kagent. " +
      "Honnêteté : R&D, prototypé en parallèle des missions, pas en production. Le code est dans le dépôt (guardrails/) et activable par Terraform (enable_nemo_guardrails). " +
      "Limites documentées : en streaming, le masquage ne s'applique pas — utiliser Reject ; le webhook n'a pas de délai propre, d'où une politique de timeout de 3 s."
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
      "Le slide de synthèse sécurité. Ne pas opposer Foundry et NeMo : on empile. " +
      "La ligne importante est la troisième : les appels d'outils de nos agents. Foundry ne les voit pas. La passerelle voit les résultats d'outils quand l'agent les renvoie au modèle, et compte chaque appel quand l'outil est publié derrière elle (/mcp). " +
      "D'où une règle de plateforme : pas d'outil d'entreprise branché en direct dans un agent. " +
      "Ligne Claude : les modèles Anthropic de Foundry n'ont pas de filtrage de contenu Foundry (Microsoft Learn) ; derrière la passerelle, ils récupèrent nos règles — sinon, seules les protections d'Anthropic."
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
      num(s, i + 1, rx, y + 0.05, 0.45, "5B21B6", 13);
      txt(s, f[0], rx + 0.65, y, 2.0, 0.4, { face: H, size: 15, bold: true, color: C.white });
      txt(s, f[1], rx + 0.65, y + 0.36, rw - 0.65, 0.45, { size: 12, color: C.muted });
    });
    card(s, MX, 6.05, 12.13, 0.72, { fill: C.surf, line: C.yellow });
    txt(s, "v0.4.0 (août 2026), Apache-2.0. L'édition open source n'a pas d'authentification : jamais exposée, ClusterIP et droits limités aux namespaces d'équipe.", MX + 0.3, 6.05, 11.5, 0.72, { size: 13.5, color: C.white, valign: "middle" });
    s.addNotes(
      "agentregistry répond à « qu'est-ce qui existe, qui l'a publié, quelle version tourne où ». Déployé par Terraform (modules/platform/registry.tf, chart 0.4.0). " +
      "Son runtime Kubernetes traduit un « Deployment » du registre en MCPServer kmcp, RemoteMCPServer ou Agent BYO kagent. " +
      "Limite à dire : en open source, le fournisseur d'autorisation laisse tout passer ; l'édition Solo Enterprise ajoute l'authentification. " +
      "D'où : ClusterIP, port-forward, et rbac.watchedNamespaces = les namespaces d'équipe. Démo complète dans le dépôt (demos/extras/cycle-de-vie-registre), pas sur scène ce soir."
    );
  }

  // =================================================================== 04 KAGENT
  await divider("04", "kagent et le cycle de vie des agents", "De la v0 à la v1 · une équipe « Agent Ready » en deux pipelines.",
    "Transition. On passe de la plateforme à ce que les équipes livrent dessus.", "kagent · cycle de vie · démo B");

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
        card(s, x, y, w, h, { fill: "1B1236", line: C.violet, lw: 1.5 });
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
      "Le cœur de l'argument « plateforme ». Le vocabulaire est celui de kagent 0.10 (API kagent.dev/v1alpha2), la version stable déployée par le PoC. " +
      "kagent tourne sur Google ADK (plus AutoGen) ; les CRD Team, Memory, Session, ToolServer de 2025 n'existent plus."
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
      "Le manifeste que la démo B déploie (modèle de dépôt d'équipe « Agent Ready »). Insister sur (1) : l'agent ne connaît pas le fournisseur, il parle à la passerelle avec la clé de son équipe. " +
      "Et (4) : réponse à « et si l'agent fait une bêtise ? ». Champs vérifiés contre le CRD kagent v1alpha2."
    );
  }

  // ----------------------------------------------------------------- 26. kagent v0 → v1
  {
    const s = newSlide();
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
      "kagent 1.0.0-alpha1 le 18/09/2026, alpha8 le 05/10/2026 ; la branche stable est 0.10.x (0.10.3 le 28/09/2026). Sources : dépôt kagent-dev/kagent, docs/architecture. " +
      "Le changement de fond : le type Declarative disparaît. Ce qu'il contenait se répartit en deux objets réutilisables : AgentTemplate décrit le comportement (modèle, prompt, outils, skills, sous-agents), Harness décrit l'exécution (image, env, Substrate). " +
      "Focus BYO : en 0.10, BYO = « apportez n'importe quel serveur A2A » avec un pod très configurable. En 1.0, BYO est une variante de Harness : image figée par digest, " +
      "commande explicite, et l'image doit implémenter le contrat runtime privé de kagent (A2A gRPC, /readyz, TaskStore à KAGENT_API_URL) — " +
      "un serveur A2A amont avec un stockage en mémoire ne suffit pas. ModelConfig devient optionnel pour BYO ; la config ADK est fournie si l'image la lit. " +
      "Les clés ne sont plus dans l'environnement : un placeholder, et la passerelle d'egress Substrate remplace l'en-tête — les clients BYO doivent honorer le bundle de confiance. " +
      "Conséquences pour nous : réécrire les manifestes (template + harness), et agentregistry v0.4.0 génère encore des Agents BYO kagent.dev/v1alpha2 — à suivre."
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
      "kind: Agent                    # le couple",
      "spec: { templateRef: { name: assistant-tickets },",
      "        harnessRef:  { name: adk-go } }",
    ], 6.35, 1.85, W - MX - 6.35, 5.0, { size: 10, label: "demos/extras/cycle-de-vie-registre/kagent-v1/…" });
    s.addNotes(
      "Le même agent, écrit pour les deux versions — le fichier v1 est dans le dépôt, validé contre les CRD kagent v1.0.0-alpha8, mais non appliqué (la plateforme tourne en 0.10.x). " +
      "À gauche, tout est dans un objet et le runtime est implicite. À droite : le comportement (AgentTemplate) se partage entre agents, " +
      "le runtime (Harness) devient explicite et figé par digest — kagent ADK, Codex, Claude ou votre propre image (byo, avec une commande obligatoire). " +
      "Deux pièges de migration : systemMessageFrom devient systemPromptFrom, et les outils ne référencent plus un MCPServer kmcp mais un RemoteMCPServer. " +
      "Le déclaratif ne disparaît pas — c'est toujours du YAML GitOps ; c'est le type Declarative, monolithique, qui disparaît."
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
      "Ce qui a permis au client de passer d'intégrations au cas par cas à des stacks standardisées. " +
      "Le bas de l'écran indique qui porte chaque étape : l'équipe publie et fait évoluer, la plateforme observe et retire. " +
      "La démo B montre le début du cycle — préparer une équipe, construire, déployer, faire évoluer ; versions et retrait avec agentregistry : demos/extras/cycle-de-vie-registre."
    );
  }

  // ----------------------------------------------------------------- 28. Démo B (demos/B-agent-equipe)
  {
    const s = newSlide();
    kicker(s, "DÉMO B");
    tag(s, "LIVE", C.green);
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
      card(s, c.x, 1.95, c.w, 3.8, { line: c.color, lw: 1.5 });
      await iconCircle(s, c.icon, c.x + 0.25, 2.12, 0.6, c.color);
      txt(s, c.head, c.x + 1.0, 2.12, c.w - 1.1, 0.6, { face: H, size: 12.5, bold: true, color: c.color, valign: "middle", cs: 1 });
      bullets(s, c.lines, c.x + 0.25, 2.9, c.w - 0.45, 2.75, { size: 13, psa: 7 });
    }
    arrow(s, MX + 4.32, 3.85, 0.21, 0, C.muted, 2);
    arrow(s, MX + 8.17, 3.85, 0.21, 0, C.muted, 2);
    card(s, MX, 5.98, 12.13, 0.82, { fill: C.surf, line: C.yellow });
    txt(s, "Les pipelines de dev tiennent en dix lignes : ils appellent ceux de l'équipe IA. La plateforme fait évoluer la CI de toutes les équipes sans toucher à leurs dépôts.", MX + 0.3, 5.98, 11.5, 0.82, { size: 13.5, color: C.white, valign: "middle" });
    s.addNotes(
      "./demos/B-agent-equipe/run.ps1 (prérequis, une fois : ai_team_github_repository dans terraform.tfvars, deploy.ps1, prepare.ps1). " +
      "1 · Équipe IA : gh workflow run agent-ready.yml -f equipe=equipe-docs ; dans GitHub, « Review deployments » → ai-team → Approve ; Terraform crée tout pour CETTE équipe, état teams/equipe-docs.tfstate. " +
      "2 · Preuve : identités et fédérations (GitHub main, ServiceAccount docs-mcp), stockage, namespace, RoleBinding, variables du dépôt. " +
      "3 · Équipe de dev : « 1 · Image » puis « 2 · Déploiement » s'enchaîne (workflow_run). Montrer les dix lignes de 1-image.yml : uses: <plateforme>/agent-image.yml@main. " +
      "4 · tools/list sur /mcp-equipes : outils docs-equipe-docs_*, découverts par label ; 401 sans jeton. " +
      "5 · LibreChat : « Qui répond aux alertes d'astreinte ? » → astreinte.md. " +
      "6 · L'équipe pousse un document : seul « 2 · Déploiement » repart, l'agent connaît la soirée de ce soir. " +
      "Avant : un ticket, trois semaines, cinq équipes à relancer. Secours : vidéo démo B. Après : reset.ps1."
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
      "Condition ABAC sur Role Based Access Control Administrator : modèle Microsoft Learn « Delegate Azure role assignment management to others with conditions », exemple « Constrain roles and principal types ». " +
      "Avec un workflow réutilisable, le sujet du jeton OIDC reste celui du dépôt appelant (repo:<owner>/agent-<équipe>:ref:refs/heads/main) : la fédération de l'équipe s'applique. " +
      "Fichiers : terraform/modules/agent-ready (Azure), terraform/modules/platform/teams.tf (ClusterRoles, politique d'admission), terraform/teams (une équipe). " +
      "À valider en répétition : le sujet Kubernetes d'une identité managée (object ID) — les pipelines affichent kubectl auth whoami."
    );
  }

  // =================================================================== 05 REX
  await divider("05", "REX, gouvernance et bonnes pratiques", "Ce qui a fait mal, ce que je referais.",
    "Dernière ligne droite : identité, coûts, gouvernance. Huit minutes.", "Entra ID · coûts · audit · démo C");

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
      "Le slide le plus « vécu ». Les quatre premières lignes sont des bugs rencontrés sur ce PoC, corrigés dans le dépôt (commits de septembre 2026) : " +
      "aud v1/v2, l'audience du jeton réutilisé par LibreChat (OPENID_REUSE_TOKENS n'existe qu'à partir des RC v0.8.8), " +
      "le Basic auth d'oauth2-proxy vers Grafana, le scope groups refusé par Entra dans le sous-chart oauth2-proxy de kagent. " +
      "Les trois dernières sont structurelles : Graph et Azure MCP tournent avec un principal de service (permissions d'application, consentement admin) — " +
      "ils voient ce que voit l'application, pas ce que voit l'utilisateur ; GitHub passe en OAuth par utilisateur mais directement depuis LibreChat, hors passerelle."
    );
  }

  // ----------------------------------------------------------------- 32. Où l'identité se perd
  {
    const s = newSlide();
    kicker(s, "REX · IDENTITÉ DE BOUT EN BOUT", C.yellow);
    title(s, "Où l'identité de l'utilisateur se perd");
    const nodes = [
      ["Collaborateur", "compte Entra ID", C.accent],
      ["LibreChat", "jeton d'accès\nréutilisé", C.accent],
      ["agentgateway", "JWT validé\nuser = preferred_username", C.green],
      ["Agent kagent", "clé de l'équipe\nuser = agent:<équipe>", C.yellow],
      ["Outil MCP", "identité\nd'application", C.red],
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
    txt(s, "✗ rupture", MX + 3 * (w + gap) - 0.2, 3.75, 2.6, 0.35, { size: 12.5, bold: true, color: C.yellow });
    txt(s, "✗ rupture", MX + 4 * (w + gap) - 0.2, 3.75, 2.6, 0.35, { size: 12.5, bold: true, color: C.red });
    const pistes = [
      ["FaExchangeAlt", "Délégation à la passerelle", "agentgateway v1.5 sait échanger un jeton (RFC 8693 / jwt-bearer RFC 7523) vers un backend MCP : le chemin d'un on-behalf-of Entra vers Graph. À valider."],
      ["FaUserShield", "Entra Agent ID", "Une identité par agent, GA, avec accès délégué ou autonome ; l'extension des contrôles de sécurité passe par la licence Agent 365."],
      ["FaKey", "Workload Identity partout", "Les outils Azure en identité managée fédérée plutôt qu'en secret de principal de service."],
    ];
    for (let i = 0; i < pistes.length; i++) {
      const x = MX + i * 4.1, yy = 4.3, ww = 3.8, hh = 2.45;
      card(s, x, yy, ww, hh);
      await iconCircle(s, pistes[i][0], x + 0.25, yy + 0.25, 0.62, C.accent);
      txt(s, pistes[i][1], x + 1.0, yy + 0.25, ww - 1.15, 0.62, { face: H, size: 14, bold: true, color: C.white, valign: "middle" });
      txt(s, pistes[i][2], x + 0.25, yy + 1.0, ww - 0.5, 1.4, { size: 11.5, color: C.muted, lsm: 1.05 });
    }
    s.addNotes(
      "La chaîne réelle du PoC. Jusqu'à la passerelle, on sait qui est la personne. L'agent, lui, s'authentifie avec la clé de son équipe : " +
      "quand un utilisateur appelle invoke_agent, la passerelle compte l'appel d'outil pour lui, mais les appels LLM de l'agent partent sous la clé de l'équipe. " +
      "Et l'outil final agit avec l'identité de l'application. Pistes, sans les survendre : " +
      "oauthTokenExchange existe dans le CRD AgentgatewayBackend v1.5.0 (backend MCP) — non testé avec Entra ; " +
      "Entra Agent ID est GA (Microsoft Learn), les contrôles de sécurité étendus aux agents demandent Microsoft Agent 365."
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
      "Le vrai sujet FinOps n'est pas « combien coûte un jeton », c'est « à qui je l'impute ». " +
      "Les libellés user / team / agent sont ajoutés par une AgentgatewayPolicy (frontend.metrics, expressions CEL) sur les deux portes. " +
      "Le coût est calculé par la passerelle à chaque réponse depuis une grille de prix (model-costs.json, catalogue de modèles agentgateway). " +
      "Honnêtetés : Microsoft ne publie pas de prix Data Zone pour Terra et Luna ; la promotion Sol de l'automne n'est pas appliquée ; " +
      "les skills et les outils branchés en direct ne sont pas mesurables à la passerelle."
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
      "Montré en direct à la fin de la démo A. Toutes les métriques sont natives agentgateway v1.5.0 : jetons (histogramme), coût en USD, requêtes MCP avec l'outil appelé. " +
      "Le panneau « Réponses sans prix » doit rester à 0 : sinon un modèle manque dans la grille."
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
      "Le client a mis en place une gouvernance transverse et une politique associée. " +
      "Message : sans elle, la plus belle passerelle applique des règles que personne n'a décidées."
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
      "./demos/C-nemo-guardrails/run.ps1 (prepare.ps1 la veille : image de l'adaptateur dans le registre). " +
      "1 · Le socle : rails/default/config.yml (regex secrets et données personnelles, YARA injections en sortie), politique webhook FailClosed, délai 3 s ; profil strict pour les routes grand public. " +
      "2 · Avant : la clé et le NIR atteignent le modèle ; seule la carte est arrêtée par la couche native. " +
      "3 · kubectl apply de guardrails/deploy rendu pour le cluster. 4 · Après : 403 sur les mêmes prompts, un prompt normal passe. " +
      "5 · Journaux et métriques de l'adaptateur. 6 (option -AvecPanne) : adaptateur à zéro réplica, tout est refusé. " +
      "Les prompts de la démo font partie des tests de l'adaptateur : la démo ne peut pas dériver des règles. Bibliothèque Apache-2.0 ; le microservice NVIDIA demande NVIDIA AI Enterprise. " +
      "Secours : vidéo démo C. Après : reset.ps1."
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
      ["Attribuer par équipe d'abord", "Le détail par personne là où la cardinalité ne coûte rien."],
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
    s.addNotes("Une minute. Ne pas tout lire : citer 1, 5 et 7, ce sont les trois qui auraient évité les douleurs du slide identité.");
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
      "Le retour du cold open, chiffré. Calcul : D4as_v5 0,184 $/h, D8as_v5 0,368 $/h, AKS Standard 0,10 $/h, 730 h par mois (API Azure Retail Prices, Sweden Central, Linux). " +
      "PoC : 2 × D4as_v5 en tier Free = 269 $/mois ; on le détruit après chaque session. " +
      "Prod 3 nœuds : 3 × D8as_v5 (un par zone de disponibilité) + plan de contrôle Standard = 879 $/mois, 391 $ en réservation 3 ans. " +
      "Prod 6 nœuds : 6 × D8as_v5 + Standard = 1 685 $/mois, 710 $ réservé 3 ans. Réservation 1 an : −38 % environ. " +
      "Ordre de grandeur, pas un devis : ajouter disques OS managés (les Dasv5 n'ont pas de disque local), Log Analytics — souvent le poste surprise — et la sortie réseau. " +
      "60 000 € ≈ 69 000 $ : 41 mois du cluster 6 nœuds au prix public."
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
    s.addNotes("Lire les trois titres, pas les sous-titres. Puis : « Merci. »");
  }

  // ----------------------------------------------------------------- 39. Merci
  {
    const s = newSlide({ footer: false });
    txt(s, "Merci !", MX, 1.5, 8, 1.4, { face: H, size: 72, bold: true, color: C.white });
    txt(s, "Questions ?", MX, 2.95, 8, 0.8, { face: H, size: 32, color: C.accent });
    card(s, MX, 4.2, 7.6, 1.6, { line: C.border });
    txt(s, "Le dépôt complet — Terraform, manifestes, démos, tableau de bord, schémas d'architecture — est publié.", MX + 0.3, 4.35, 7.0, 0.8, { size: 16, color: C.text, lsm: 1.1 });
    txt(s, "smartcloudarchitect.fr  ·  blog.smartcloudarchitect.fr", MX + 0.3, 5.2, 7.0, 0.45, { size: 16, bold: true, color: C.accent });
    s.addImage({ path: LOGO_PATH, x: MX, y: 6.15, w: 0.6 * LOGO_RATIO, h: 0.6, altText: "Logo Smart Cloud Architect" });
    txt(s, "Antoine LOIZEAU · Smart Cloud Architect", MX + 0.6 * LOGO_RATIO + 0.2, 6.25, 8, 0.4, { size: 14, color: C.muted });
    labels(s, [["governed", "true"], ["identity", "end-to-end"]], { x: 9.0, y: 2.4, size: 22 });
    s.addNotes(
      "Questions probables : APIM (annexe « deux couches »), Foundry Agent Service (slide 10), kagent 1.0 (slide 26), " +
      "coûts (grille de prix, Data Zone), maturité alpha, identité du client (jamais)."
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
      ["L'autorisation par outil", "CEL sur jwt.* et mcp.tool.name — les outils non autorisés disparaissent du tools/list."],
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
    s.addNotes("Les raisons 1 et 5 sont celles de l'équipe à l'origine ; 2 à 4 sont venues en creusant.");
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
    s.addNotes("Slide « photo ». Points vérifiés sur Microsoft Learn et la doc agentgateway ; revérifier la veille.");
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
    s.addNotes("À montrer si la question vient : le type de déploiement est une ligne du Terraform (sku_name).");
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
    s.addNotes("On ne choisit pas un camp, on choisit une couche.");
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
    s.addNotes("Réponse à « et sans fournisseur de modèles ? ». Script dans le dépôt (demos/chalet/E-auto-heberge/run.sh, deck Chalet) ; pas de démo ce soir.");
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
    s.addNotes("À COMPLÉTER : une ou deux douleurs vécues chez le client (adoption, quotas, validation sécurité…).");
  }

  await pres.writeFile({ fileName: "rex-architectures-ia-entreprise.pptx" });
  console.log("écrit :", D.count(), "slides");
})();
