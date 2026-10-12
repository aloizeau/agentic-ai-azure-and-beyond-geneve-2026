// =============================================================================
//  IA agentique : vers Azure et au-delà !  — REX plateforme cloud-agnostique (angle : agnosticité)
//  Chalet Azure Romandie · 29 octobre 2026 · Antoine LOIZEAU
// =============================================================================
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");

// ---------------------------------------------------------------- palette
// Relevée sur smartcloudarchitect.fr (thème sombre, base Tailwind)
const C = {
  bg: "030712",      // gray-950
  surf: "111827",    // gray-900
  surf2: "1F2937",   // gray-800
  code: "0B1220",
  border: "374151",  // gray-700
  accent: "60A5FA",  // blue-400 — accent de marque
  deep: "1D4ED8",    // blue-700
  yellow: "FACC15",  // pièges, alertes
  green: "4ADE80",   // validé, portable
  white: "FFFFFF",
  text: "E5E7EB",    // gray-200
  muted: "9CA3AF",   // gray-400
  dim: "6B7280",     // gray-500
};
const H = "Arial";        // titres
const B = "Calibri";      // corps
const M = "Courier New";  // code

const W = 13.333, HGT = 7.5, MX = 0.6;
const LOGO_PATH = "assets/logo.png";
const LOGO_RATIO = 908 / 603; // largeur / hauteur du logo recadré

// ---------------------------------------------------------------- icônes
const iconCache = {};
async function icon(name, color) {
  const key = name + color;
  if (iconCache[key]) return iconCache[key];
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(fa[name], { color: "#" + color, size: 256 })
  );
  const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  iconCache[key] = "image/png;base64," + buf.toString("base64");
  return iconCache[key];
}

// ---------------------------------------------------------------- helpers
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Antoine LOIZEAU — Smart Cloud Architect";
pres.title = "IA agentique : vers Azure et au-delà !";
pres.company = "Smart Cloud Architect";

let slideNo = 0;
// Minutage global (50 min + 10 min de Q&A), un créneau par slide dans l'ordre.
const TIMES = [null,
  "0:00 — 0:30", "0:30 — 1:00", "1:00 — 2:30", "2:30 — 3:30",                 // ouverture
  "3:30", "3:30 — 5:00", "5:00 — 6:15", "6:15 — 7:30",                         // 01
  "7:30", "7:30 — 9:00", "9:00 — 10:30", "10:30 — 11:30",                      // 02
  "11:30", "11:30 — 13:30", "13:30 — 14:30", "14:30 — 16:00", "16:00 — 16:45", // 03
  "16:45", "16:45 — 18:15", "18:15 — 19:30", "19:30 — 20:30", "20:30 — 21:45", "21:45 — 22:30", "22:30 — 23:00", "23:00 — 23:30", // 04
  "23:30", "23:30 — 25:00", "25:00 — 26:00", "26:00 — 26:45", "26:45 — 28:00", // 05
  "28:00", "28:00 — 29:30", "29:30 — 33:45", "33:45 — 37:45", "37:45 — 41:15", "41:15 — 44:15", "44:15 — 45:00", // 06
  "45:00", "45:00 — 46:45", "46:45 — 47:45", "47:45 — 48:30", "48:30 — 49:45", // 07
  "49:45 — 60:00", "ANNEXE — à montrer seulement si la question vient en Q&A",
];
function newSlide({ footer = true } = {}) {
  const s = pres.addSlide();
  slideNo++;
  const myNo = slideNo;
  const origNotes = s.addNotes.bind(s);
  s.addNotes = (n) => origNotes(`[${TIMES[myNo] ?? "?"}] ` + n.replace(/^\[[^\]]*\]\s*/, ""));
  s.background = { color: C.bg };
  if (footer) {
    s.addImage({ path: LOGO_PATH, x: MX, y: 6.99, w: 0.3 * LOGO_RATIO, h: 0.3, altText: "Smart Cloud Architect" });
    s.addText("IA agentique : vers Azure et au-delà !  ·  Antoine LOIZEAU", {
      x: MX + 0.3 * LOGO_RATIO + 0.15, y: 7.0, w: 6, h: 0.3, fontFace: B, fontSize: 9, color: C.dim, margin: 0, isTextBox: true,
    });
    s.addText(String(slideNo), {
      x: W - MX - 1, y: 7.0, w: 1, h: 0.3, fontFace: B, fontSize: 9, color: C.dim, align: "right", margin: 0, isTextBox: true,
    });
  }
  return s;
}

// Kicker : étiquette de section (contour arrondi, petites capitales)
function kicker(s, text, color = C.accent) {
  const w = Math.max(1.6, text.length * 0.118 + 0.55);
  s.addText(text, {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08,
    x: MX, y: 0.45, w, h: 0.34,
    line: { color, width: 1.25 }, fill: { color: C.bg },
    fontFace: H, fontSize: 10, bold: true, color, charSpacing: 2, align: "center", valign: "middle", margin: 0,
    isTextBox: true,
  });
}

function title(s, text, opts = {}) {
  s.addText(text, {
    x: MX, y: opts.y ?? 0.95, w: opts.w ?? W - 2 * MX, h: opts.h ?? 0.9,
    fontFace: H, fontSize: opts.size ?? 30, bold: true, color: C.white, margin: 0, valign: "top", isTextBox: true,
  });
}

// Motif : des labels façon Kubernetes (clé: valeur), plats, en monospace —
// le vocabulaire des CRD dont parle la session. Empilés, alignés à gauche.
function labels(s, pairs, { x, y, color = C.accent, size = 18, gap = 0.2 }) {
  const h = size / 72 * 1.9;                     // hauteur de pastille selon la taille du texte
  pairs.forEach(([k, v], i) => {
    const w = (k.length + v.length + 2) * size / 72 * 0.6 + 0.45;
    s.addText([
      { text: k + ": ", options: { color } },
      { text: v, options: { color: C.white, bold: true } },
    ], {
      shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08,
      x, y: y + i * (h + gap), w, h,
      line: { color, width: 1.5 }, fill: { color: C.surf },
      fontFace: M, fontSize: size, align: "left", valign: "middle", margin: 10, isTextBox: true,
    });
  });
}

function card(s, x, y, w, h, { fill = C.surf, line = C.surf2, lw = 1 } = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: line, width: lw },
  });
}

async function iconCircle(s, name, x, y, d, color = C.accent, bgc = C.surf2) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bgc }, line: { color: bgc, width: 0 } });
  const pad = d * 0.25;
  s.addImage({ data: await icon(name, color), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
}

function txt(s, text, x, y, w, h, o = {}) {
  s.addText(text, {
    x, y, w, h, fontFace: o.face ?? B, fontSize: o.size ?? 14, color: o.color ?? C.text,
    bold: o.bold ?? false, italic: o.italic ?? false, align: o.align ?? "left", valign: o.valign ?? "top",
    margin: o.margin ?? 0, paraSpaceAfter: o.psa ?? 0, lineSpacingMultiple: o.lsm ?? 1.0, isTextBox: true,
    charSpacing: o.cs,
  });
}

function bullets(s, items, x, y, w, h, o = {}) {
  s.addText(
    items.map((t, i) => ({
      text: t,
      options: { bullet: { indent: 16 }, breakLine: i < items.length - 1 },
    })),
    {
      x, y, w, h, fontFace: B, fontSize: o.size ?? 15, color: o.color ?? C.text, valign: "top",
      paraSpaceAfter: o.psa ?? 8, margin: 0, isTextBox: true,
    }
  );
}

// Bloc de code avec coloration YAML/shell minimale
function code(s, lines, x, y, w, h, { size = 10.5, label } = {}) {
  card(s, x, y, w, h, { fill: C.code, line: C.surf2 });
  const runs = [];
  lines.forEach((ln, i) => {
    const last = i === lines.length - 1;
    const push = (t, color, extra = {}) => runs.push({ text: t, options: { color, ...extra } });
    const trimmed = ln.trim();
    if (trimmed.startsWith("#")) {
      push(ln || " ", C.dim, { italic: true });
    } else if (trimmed.startsWith("$")) {
      const idx = ln.indexOf("$");
      push(ln.slice(0, idx + 1), C.green);
      push(ln.slice(idx + 1), C.white, { bold: true });
    } else {
      const m = ln.match(/^(\s*-?\s*)([A-Za-z_][\w.\-]*)(:)(.*)$/);
      if (m) {
        let [, pre, key, colon, rest] = m;
        let comment = "";
        const ci = rest.indexOf(" #");
        if (ci >= 0) { comment = rest.slice(ci); rest = rest.slice(0, ci); }
        if (pre) push(pre, C.text);
        push(key, C.accent);
        push(colon + rest, C.text);
        if (comment) push(comment, C.dim, { italic: true });
      } else {
        push(ln || " ", C.text);
      }
    }
    runs[runs.length - 1].options.breakLine = !last;
  });
  s.addText(runs, {
    x: x + 0.2, y: y + (label ? 0.42 : 0.18), w: w - 0.4, h: h - (label ? 0.55 : 0.3),
    fontFace: M, fontSize: size, valign: "top", margin: 0, lineSpacingMultiple: 1.05, isTextBox: true,
  });
  if (label) {
    txt(s, label, x + 0.2, y + 0.12, w - 0.4, 0.25, { face: M, size: 9, color: C.muted });
  }
}

function arrow(s, x, y, w, h, color = C.muted) {
  s.addShape(pres.shapes.LINE, {
    x, y, w, h, line: { color, width: 1.75, endArrowType: "triangle" },
  });
}

function tag(s, text, color, x = W - MX - 1.2, y = 0.45) {
  s.addText(text, {
    shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y, w: 1.2, h: 0.34,
    fill: { color }, line: { color, width: 0 },
    fontFace: H, fontSize: 10, bold: true, color: C.bg, align: "center", valign: "middle", charSpacing: 2, margin: 0,
    isTextBox: true,
  });
}

async function divider(num, heading, sub, notes) {
  const s = newSlide({ footer: false });
  txt(s, num, MX, 1.6, 4, 2.0, { face: H, size: 140, bold: true, color: C.deep });
  const long = heading.length > 24;
  txt(s, heading, MX, 3.7, 8.6, long ? 1.6 : 1.0, { face: H, size: long ? 40 : 44, bold: true, color: C.white });
  txt(s, sub, MX, long ? 5.4 : 4.8, 8.6, 0.8, { size: 20, color: C.muted });
  labels(s, [["étape", num]], { x: 9.9, y: 3.0, size: 26 });
  s.addNotes(notes);
  return s;
}

// =============================================================================
(async () => {
  // ----------------------------------------------------------------- 1. Titre
  {
    const s = newSlide({ footer: false });
    kicker(s, "CHALET AZURE ROMANDIE · 29 OCTOBRE 2026");
    txt(s, "IA agentique :\nvers Azure et au-delà !", MX, 1.45, 8.4, 2.3, { face: H, size: 46, bold: true, color: C.white });
    txt(s, "Une plateforme cloud-agnostique, du REX à la démo", MX, 3.85, 8.0, 0.9, { size: 22, color: C.text });
    txt(s, "Entra ID  ·  AKS  ·  agentgateway  ·  kagent  ·  Microsoft Foundry", MX, 4.85, 8.0, 0.4, { size: 15, color: C.accent, bold: true });
    s.addImage({ path: LOGO_PATH, x: MX, y: 5.92, w: 0.78 * LOGO_RATIO, h: 0.78, altText: "Logo Smart Cloud Architect" });
    txt(s, "Antoine LOIZEAU", MX + 0.78 * LOGO_RATIO + 0.25, 5.95, 6, 0.4, { face: H, size: 18, bold: true, color: C.white });
    txt(s, "Senior Cloud Architect · Smart Cloud Architect", MX + 0.78 * LOGO_RATIO + 0.25, 6.35, 6, 0.35, { size: 13, color: C.muted });
    labels(s, [["cloud", "azure"], ["cloud", "au-delà"]], { x: 9.4, y: 2.2, size: 22 });
    s.addNotes(
      "[0:00 — 0:30] Laisser le clin d'œil faire sourire, sans le commenter longtemps : « On part d'Azure… et on garde la liberté d'aller au-delà. » " +
      "Aucune image du personnage ni du film dans le deck : la réplique seule suffit.\n" +
      "Transition : « Avant de parler de portabilité, je vais vous raconter un week-end. »"
    );
  }

  // ----------------------------------------------------------------- 2. Qui suis-je
  {
    const s = newSlide();
    kicker(s, "QUI SUIS-JE");

    // Colonne identité
    const lx = MX, lw = 4.15, ly = 1.0, lh = 5.75;
    card(s, lx, ly, lw, lh, { fill: C.surf, line: C.surf2 });
    const d = 1.85, px = lx + (lw - d) / 2, py = ly + 0.25;
    s.addShape(pres.shapes.OVAL, { x: px - 0.07, y: py - 0.07, w: d + 0.14, h: d + 0.14, fill: { color: C.surf }, line: { color: C.accent, width: 3 } });
    s.addImage({ path: "assets/antoine.jpg", x: px, y: py, w: d, h: d, rounding: true, altText: "Portrait d'Antoine LOIZEAU" });
    txt(s, "Antoine", lx, 3.22, lw, 0.45, { face: H, size: 24, color: C.white, align: "center" });
    txt(s, "LOIZEAU", lx, 3.6, lw, 0.55, { face: H, size: 30, bold: true, color: C.white, align: "center", cs: 2 });
    txt(s, "Senior Cloud Architect · Freelance", lx, 4.15, lw, 0.35, { size: 14, color: C.muted, align: "center" });

    // Entreprise
    s.addImage({ path: LOGO_PATH, x: lx + 0.45, y: 4.7, w: 0.55 * LOGO_RATIO, h: 0.55, altText: "Logo Smart Cloud Architect" });
    txt(s, "Smart Cloud Architect", lx + 0.45 + 0.55 * LOGO_RATIO + 0.2, 4.68, 2.5, 0.33, { face: H, size: 14, bold: true, color: C.white });
    txt(s, "smartcloudarchitect.fr", lx + 0.45 + 0.55 * LOGO_RATIO + 0.2, 4.98, 2.5, 0.3, { size: 12, color: C.accent });

    // Certifications, en pastilles
    const pills = [["MCT", "Microsoft Certified Trainer"], ["MVP 2024", "Azure Infrastructure as Code"]];
    pills.forEach((p, i) => {
      const y = 5.55 + i * 0.55;
      s.addText(p[0], {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x: lx + 0.45, y, w: 1.2, h: 0.38,
        fill: { color: C.bg }, line: { color: C.accent, width: 1.25 },
        fontFace: H, fontSize: 11, bold: true, color: C.accent, align: "center", valign: "middle", margin: 0, isTextBox: true,
      });
      txt(s, p[1], lx + 1.8, y, 2.25, 0.38, { size: 12, color: C.text, valign: "middle" });
    });

    // Colonne partage de connaissances
    const rx = 5.15, rw = W - MX - rx;
    txt(s, "Mon fil rouge : partager ce que j'apprends", rx, 1.0, rw, 0.55, { face: H, size: 24, bold: true, color: C.white });
    const rows = [
      ["FaPenNib", "Écrire", "blog.smartcloudarchitect.fr",
        "Retours d'expérience Azure : réseau, AKS, Terraform, identité multicloud.",
        "Dernier article : « Azure IPAM avec Azure Virtual Network Manager »"],
      ["FaMicrophone", "Transmettre en public", "conférences et meetups",
        "Confronter mes choix d'architecture à la communauté — comme aujourd'hui au Chalet Azure Romandie.",
        null],
      ["FaUsers", "Faire grandir les équipes", "formation et accompagnement",
        "Former, outiller et accompagner les équipes jusqu'à ce qu'elles n'aient plus besoin de moi.",
        null],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 1.75 + i * 1.62, h = 1.45;
      card(s, rx, y, rw, h);
      await iconCircle(s, rows[i][0], rx + 0.3, y + 0.3, 0.85, C.accent);
      txt(s, rows[i][1], rx + 1.4, y + 0.18, 3.6, 0.4, { face: H, size: 17, bold: true, color: C.white });
      txt(s, rows[i][2], rx + 4.6, y + 0.2, rw - 4.85, 0.35, { face: M, size: 11, color: C.accent, align: "right" });
      txt(s, rows[i][3], rx + 1.4, y + 0.6, rw - 1.65, 0.42, { size: 13.5, color: C.text });
      if (rows[i][4]) s.addText([{ text: rows[i][4], options: { hyperlink: { url: "https://blog.smartcloudarchitect.fr/azure-ipam-virtual-network-manager", tooltip: "Lire l'article" } } }], {
        x: rx + 1.4, y: y + 1.02, w: rw - 1.65, h: 0.35, fontFace: B, fontSize: 11.5, italic: true, color: C.muted, margin: 0, isTextBox: true,
      });
    }
    txt(s, "Le code, les manifestes et l'article de cette session sont publiés : même démarche.", rx, 6.52, rw, 0.35, { size: 13, italic: true, color: C.accent });
    s.addNotes(
      "Trente secondes. Le public retient une seule chose : je partage ce que je fais. " +
      "Blog, conférences, formation des équipes — et cette session en est l'illustration : tout est publié."
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
      "[1:00 — 3:00] L'histoire, sans nommer le client — jamais, même en Q&A.\n" +
      "Un groupe média français, environ 3 000 collaborateurs. L'IA est ouverte à tous, sans limite. Une clé fuit. " +
      "Lundi matin : plus de 60 000 € de consommation.\n" +
      "Laisser le chiffre respirer. Puis : « Ce n'est pas une histoire de hackers. C'est une histoire d'architecture. »"
    );
  }

  // ----------------------------------------------------------------- 4. Ce qui manquait
  {
    const s = newSlide();
    kicker(s, "LE DIAGNOSTIC");
    title(s, "Ce qui manquait à nos agents");
    const cards = [
      ["FaIdCard", "Identité", "Qui appelle ?", "Une clé partagée ne dit rien de la personne, de l'équipe ni de l'agent."],
      ["FaTachometerAlt", "Limite", "Combien ?", "Aucun plafond de tokens, aucun budget par équipe, aucun coupe-circuit."],
      ["FaEye", "Trace", "Quoi, où, pour qui ?", "Aucune métrique par modèle ni par consommateur : on découvre la facture."],
    ];
    for (let i = 0; i < 3; i++) {
      const x = MX + i * 4.1, y = 2.2, w = 3.8, h = 3.5;
      card(s, x, y, w, h);
      await iconCircle(s, cards[i][0], x + 0.35, y + 0.4, 0.9, C.yellow);
      txt(s, cards[i][1], x + 0.35, y + 1.5, w - 0.7, 0.5, { face: H, size: 24, bold: true, color: C.white });
      txt(s, cards[i][2], x + 0.35, y + 2.05, w - 0.7, 0.4, { size: 16, color: C.accent, italic: true });
      txt(s, cards[i][3], x + 0.35, y + 2.5, w - 0.7, 0.9, { size: 14, color: C.muted, lsm: 1.1 });
    }
    txt(s, "Un seul point de contrôle, quel que soit le cloud.", MX, 6.1, 12, 0.5, { face: H, size: 20, bold: true, color: C.accent });
    s.addNotes(
      "[3:00 — 4:00] Trois manques, un seul point de contrôle possible. " +
      "Identité, limite, trace : les trois questions auxquelles la passerelle répond. Tout le reste de la session en découle."
    );
  }

  // ----------------------------------------------------------------- 5. Divider 01
  await divider("01", "Le vrai problème", "Ce n'est pas le modèle. C'est tout ce qu'il y a autour.",
    "[4:00] Transition rapide. Le sujet n'est pas « quel LLM choisir ».");

  // ----------------------------------------------------------------- 6. Contexte REX
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

    // Avant
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
    // Après
    txt(s, "APRÈS", bx, 4.45, 2, 0.3, { face: H, size: 11, bold: true, color: C.green, cs: 2 });
    for (let i = 0; i < 3; i++) {
      const y = 4.85 + i * 0.62;
      card(s, bx, y, 1.6, 0.48, { fill: C.surf2, line: C.border });
      txt(s, `Projet ${String.fromCharCode(65 + i)}`, bx, y, 1.6, 0.48, { size: 12, align: "center", valign: "middle" });
      arrow(s, bx + 1.65, y + 0.24, 0.55, 0, C.green);
    }
    card(s, bx + 2.25, 4.85, 1.7, 1.72, { fill: C.surf, line: C.green, lw: 1.5 });
    txt(s, "Passerelle\ncommune", bx + 2.25, 4.85, 1.7, 1.72, { size: 13, bold: true, align: "center", valign: "middle", color: C.green });
    arrow(s, bx + 4.0, 5.71, 0.55, 0, C.green);
    card(s, bx + 4.6, 4.85, 1.35, 1.72, { fill: C.surf2, line: C.border });
    txt(s, "Modèles", bx + 4.6, 4.85, 1.35, 1.72, { size: 12, align: "center", valign: "middle" });
    s.addNotes(
      "[4:00 — 6:00] Le constat avant la plateforme. Chaque équipe réinventait l'authentification, la gestion des clés, " +
      "les connecteurs. Personne ne voyait la consommation globale. Le week-end à 60 000 € n'est que le symptôme le plus visible."
    );
  }

  // ----------------------------------------------------------------- 7. Trois risques
  {
    const s = newSlide();
    kicker(s, "TROIS RISQUES");
    title(s, "Une IA sans socle commun expose à trois risques");
    const items = [
      ["FaFileInvoiceDollar", "La facture", "Aucun plafond, aucune attribution. On découvre la dépense après coup.", C.yellow, false],
      ["FaUserSecret", "La fuite", "Des prompts et des outils sans filtre : les données sortent sans contrôle.", C.yellow, false],
      ["FaLink", "La dépendance", "Chaque projet codé contre le SDK d'un fournisseur : changer, c'est tout réécrire.", C.accent, true],
    ];
    for (let i = 0; i < 3; i++) {
      const x = MX + i * 4.1, y = 2.1, w = 3.8, h = 3.9;
      card(s, x, y, w, h, { line: items[i][4] ? C.accent : C.surf2, lw: items[i][4] ? 2 : 1 });
      txt(s, String(i + 1).padStart(2, "0"), x + 0.35, y + 0.3, 1.2, 0.8, { face: H, size: 40, bold: true, color: C.deep });
      await iconCircle(s, items[i][0], x + w - 1.25, y + 0.35, 0.9, items[i][3]);
      txt(s, items[i][1], x + 0.35, y + 1.55, w - 0.7, 0.5, { face: H, size: 24, bold: true, color: C.white });
      txt(s, items[i][2], x + 0.35, y + 2.2, w - 0.7, 1.4, { size: 15, color: C.muted, lsm: 1.1 });
    }
    txt(s, "Le troisième est celui dont personne ne parle — et le plus cher à corriger.", MX, 6.25, 12, 0.45, { size: 17, italic: true, color: C.accent });
    s.addNotes(
      "[6:00 — 7:30] Les deux premiers sont évidents après le week-end à 60 000 €. " +
      "Insister sur le troisième : c'est lui qui transforme une décision technique en décision irréversible. C'est le cœur du talk."
    );
  }

  // ----------------------------------------------------------------- 8. Plomberie
  {
    const s = newSlide();
    kicker(s, "OÙ SE CACHE LE VERROU");
    title(s, "Le verrou n'est pas le modèle. C'est la plomberie.");
    const lx = MX, lw = 5.8;
    card(s, lx + 1.9, 2.05, 2.0, 0.6, { fill: C.deep, line: C.deep });
    txt(s, "Le modèle", lx + 1.9, 2.05, 2.0, 0.6, { face: H, size: 14, bold: true, color: C.white, align: "center", valign: "middle" });
    s.addShape(pres.shapes.LINE, { x: lx, y: 2.85, w: lw, h: 0, line: { color: C.accent, width: 1.5, dashType: "dash" } });
    txt(s, "ce qu'on regarde", lx + 4.1, 2.25, 1.8, 0.3, { size: 11, italic: true, color: C.muted });
    txt(s, "ce qui vous enferme", lx + 4.1, 2.95, 1.8, 0.3, { size: 11, italic: true, color: C.yellow });
    const layers = ["SDK du fournisseur", "Format d'authentification", "Configuration propriétaire", "Observabilité propriétaire", "Catalogue d'outils et connecteurs"];
    layers.forEach((l, i) => {
      const w = 3.4 + i * 0.55, x = lx + (lw - w) / 2, y = 3.35 + i * 0.66;
      card(s, x, y, w, 0.52, { fill: C.surf2, line: C.border });
      txt(s, l, x, y, w, 0.52, { size: 13, align: "center", valign: "middle" });
    });
    txt(s, "Changer de modèle", 7.3, 2.3, 5.4, 0.4, { face: H, size: 18, bold: true, color: C.white });
    txt(s, "une ligne de configuration.", 7.3, 2.72, 5.4, 0.4, { size: 17, color: C.green });
    txt(s, "Changer de plomberie", 7.3, 3.5, 5.4, 0.4, { face: H, size: 18, bold: true, color: C.white });
    txt(s, "réécrire chaque projet.", 7.3, 3.92, 5.4, 0.4, { size: 17, color: C.yellow });
    card(s, 7.3, 4.85, 5.4, 1.55, { fill: C.surf, line: C.accent });
    txt(s, "L'objectif : une plomberie standard, où le fournisseur de cloud et de modèles devient une configuration.", 7.55, 5.02, 4.9, 1.25, { size: 16, color: C.text, lsm: 1.1, valign: "middle" });
    s.addNotes(
      "[7:30 — 9:00] Tout le monde débat du modèle. Le vrai coût de sortie est sous la ligne de flottaison : " +
      "les SDK, l'auth, la config, les dashboards, les connecteurs. C'est ça qu'on standardise."
    );
  }

  // ----------------------------------------------------------------- 9. Divider 02
  await divider("02", "Ce qui rend la plateforme portable", "Même stack, n'importe quel cloud.",
    "[9:00] Transition. On passe du problème au principe.");

  // ----------------------------------------------------------------- 10. Trois couches
  {
    const s = newSlide();
    kicker(s, "LE PRINCIPE");
    title(s, "Trois couches, une seule qui dépend du cloud");
    const bands = [
      ["Ce que vos équipes écrivent", "Agents  ·  Serveurs MCP  ·  Prompts et skills  ·  Politiques", "IDENTIQUE PARTOUT", C.green, "FaCode"],
      ["Les standards Kubernetes", "Gateway API  ·  CRD agentgateway et kagent  ·  Helm  ·  OpenTelemetry / Prometheus", "IDENTIQUE PARTOUT", C.green, "FaLayerGroup"],
      ["L'adaptateur cloud", "Cluster managé  ·  Identité des workloads  ·  Fournisseur de modèles  ·  IaC", "SPÉCIFIQUE AU CLOUD", C.yellow, "FaCloud"],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 2.05 + i * 1.5, h = 1.25;
      card(s, MX, y, 12.13, h, { fill: C.surf, line: bands[i][3], lw: 1.5 });
      await iconCircle(s, bands[i][4], MX + 0.3, y + 0.2, 0.85, bands[i][3]);
      txt(s, bands[i][0], MX + 1.4, y + 0.2, 6.5, 0.45, { face: H, size: 19, bold: true, color: C.white });
      txt(s, bands[i][1], MX + 1.4, y + 0.68, 8.2, 0.4, { size: 14, color: C.muted });
      txt(s, bands[i][2], MX + 9.4, y, 2.5, h, { face: H, size: 12, bold: true, color: bands[i][3], align: "right", valign: "middle", cs: 2 });
    }
    txt(s, "Le cloud se remplace par le bas. Tout ce qui est au-dessus du cluster ne bouge pas.", MX, 6.45, 12, 0.4, { size: 16, italic: true, color: C.accent });
    s.addNotes(
      "[9:00 — 11:00] LE slide du talk. Les deux couches du haut sont écrites une fois. " +
      "Seule la couche du bas est réécrite par cloud — et c'est la plus petite : cluster, identité, fournisseur de modèles."
    );
  }

  // ----------------------------------------------------------------- 11. Trois clouds
  {
    const s = newSlide();
    kicker(s, "MÊMES MANIFESTES, TROIS CLOUDS");
    title(s, "Seul l'adaptateur change");
    const hdr = { fill: { color: C.surf2 }, color: C.white, bold: true, fontFace: H, fontSize: 14, valign: "middle", align: "center" };
    const lab = { fill: { color: C.surf }, color: C.muted, bold: true, fontFace: H, fontSize: 13, valign: "middle" };
    const cell = { fill: { color: C.surf }, color: C.text, fontFace: B, fontSize: 14, valign: "middle", align: "center" };
    const rows = [
      [{ text: "", options: { ...hdr } }, { text: "Azure", options: hdr }, { text: "AWS", options: hdr }, { text: "OVHcloud", options: hdr }],
      [{ text: "Cluster", options: lab }, { text: "AKS", options: cell }, { text: "EKS", options: cell }, { text: "Managed Kubernetes", options: cell }],
      [{ text: "Identité des workloads", options: lab }, { text: "Entra Workload ID", options: cell }, { text: "EKS Pod Identity", options: cell }, { text: "Jeton API en Secret", options: cell }],
      [{ text: "Fournisseur de modèles", options: lab }, { text: "Microsoft Foundry", options: cell }, { text: "Amazon Bedrock", options: cell }, { text: "AI Endpoints", options: cell }],
      [{ text: "Provider Terraform", options: lab }, { text: "azurerm", options: { ...cell, fontFace: M, fontSize: 13 } }, { text: "aws", options: { ...cell, fontFace: M, fontSize: 13 } }, { text: "ovh", options: { ...cell, fontFace: M, fontSize: 13 } }],
      [{ text: "Identique sur les trois :  agentgateway  ·  kagent  ·  agents  ·  serveurs MCP  ·  politiques  ·  dashboards", options: { colspan: 4, fill: { color: "0F2A1A" }, color: C.green, bold: true, fontFace: H, fontSize: 14, align: "center", valign: "middle" } }],
    ];
    s.addTable(rows, {
      x: MX, y: 1.95, w: 12.13, colW: [3.13, 3.0, 3.0, 3.0], rowH: [0.55, 0.62, 0.62, 0.62, 0.62, 0.7],
      border: { type: "solid", color: C.bg, pt: 2 },
    });
    txt(s, "Implémentation de référence démontrée aujourd'hui : Azure. Sur AWS et OVHcloud, les manifestes sont les mêmes — l'adaptateur reste à écrire.", MX, 6.05, 12.1, 0.7, { size: 13, color: C.muted, italic: true });
    s.addNotes(
      "[11:00 — 13:00] Lire la ligne verte à voix haute : c'est la promesse. " +
      "Être honnête sur la dernière phrase : je démontre Azure, je n'ai pas déployé les deux autres. " +
      "agentgateway supporte nativement Bedrock et les endpoints compatibles OpenAI ; les identifiants AWS passent par la chaîne standard. " +
      "À valider sur chaque cloud avant de le promettre à un client."
    );
  }

  // ----------------------------------------------------------------- 12. Ce que agnostique ne veut pas dire
  {
    const s = newSlide();
    kicker(s, "HONNÊTETÉ", C.yellow);
    title(s, "Ce qu'« agnostique » ne veut pas dire");
    const items = [
      ["« Zéro effort »", "L'identité des workloads et l'infrastructure restent à écrire pour chaque cloud. C'est la couche du bas : petite, mais réelle."],
      ["« Modèles interchangeables »", "Prompts et appels d'outils varient d'un modèle à l'autre — Mistral accepte tool_choice: \"any\", OpenAI non. Un changement de modèle se teste."],
      ["« API stables »", "Les CRD agentgateway sont en v1alpha1. Épinglez chaque version de chart, et relisez les notes de version."],
    ];
    for (let i = 0; i < 3; i++) {
      const x = MX + i * 4.1, y = 2.05, w = 3.8, h = 3.6;
      card(s, x, y, w, h);
      await iconCircle(s, "FaExclamationTriangle", x + 0.35, y + 0.35, 0.8, C.yellow);
      txt(s, items[i][0], x + 0.35, y + 1.3, w - 0.7, 0.8, { face: H, size: 18, bold: true, color: C.white, valign: "top" });
      txt(s, items[i][1], x + 0.35, y + 2.1, w - 0.7, 1.4, { size: 14, color: C.muted, lsm: 1.1 });
    }
    txt(s, "La portabilité est une propriété de l'architecture, pas un bouton.", MX, 6.0, 12, 0.5, { face: H, size: 20, bold: true, color: C.accent });
    s.addNotes(
      "[13:00 — 14:00] Ce slide achète la crédibilité du reste. Un public d'architectes se méfie de « ça marche partout ». " +
      "Dire ce qui ne marche pas avant qu'on le demande."
    );
  }

  // ----------------------------------------------------------------- 14. Divider 03
  await divider("03", "Pourquoi agentgateway", "L'arbitrage : Azure API Management, LiteLLM, agentgateway.",
    "[15:30] Transition. La salle a APIM : ce passage doit être irréprochable.");

  // ----------------------------------------------------------------- 15. Comparatif
  {
    const s = newSlide();
    kicker(s, "LES TROIS CANDIDATS");
    title(s, "Chacun excelle sur un terrain différent");
    const hd = (t) => ({ text: t, options: { fill: { color: C.surf2 }, color: C.white, bold: true, fontFace: H, fontSize: 13, align: "center", valign: "middle" } });
    const lb = (t) => ({ text: t, options: { fill: { color: C.surf }, color: C.text, fontFace: B, fontSize: 12.5, valign: "middle" } });
    const v = (t) => {
      const color = /^Oui/.test(t) ? C.green : /^Non/.test(t) ? C.dim : C.text;
      return { text: t, options: { fill: { color: C.surf }, color, fontFace: B, fontSize: 12, align: "center", valign: "middle", bold: /^Oui|^Non/.test(t) } };
    };
    const rows = [
      [hd(""), hd("Azure API Management"), hd("LiteLLM"), hd("agentgateway")],
      [lb("Modèle de configuration"), v("Ressources Azure + policies XML"), v("config.yaml + état en base"), v("CRD Kubernetes (Gateway API)")],
      [lb("Créer un serveur MCP depuis une API REST"), v("Oui"), v("Non"), v("Non")],
      [lb("Fédérer N serveurs MCP derrière un endpoint"), v("Non"), v("Oui"), v("Oui")],
      [lb("Autorisation par outil MCP à l'exécution"), v("Non"), v("Oui — par clé, équipe"), v("Oui — CEL sur le JWT")],
      [lb("Cache sémantique"), v("Oui"), v("Oui"), v("Non documenté")],
      [lb("Portail développeur, produits, abonnements"), v("Oui"), v("Partiel"), v("Non")],
      [lb("Tourne hors Azure"), v("Self-hosted gateway"), v("Oui"), v("Oui")],
      [lb("Licence"), v("Propriétaire"), v("MIT + dossier enterprise"), v("Apache-2.0 · Linux Foundation")],
    ];
    s.addTable(rows, {
      x: MX, y: 1.85, w: 12.13, colW: [3.9, 2.75, 2.7, 2.78],
      rowH: [0.5, 0.52, 0.48, 0.48, 0.48, 0.48, 0.48, 0.48, 0.52],
      border: { type: "solid", color: C.bg, pt: 2 },
    });
    txt(s, "Documentation officielle de chaque projet, vérifiée le 18/09/2026. APIM : MCP et A2A disponibles sans mention preview ; self-hosted gateway sur les tiers classiques uniquement.", MX, 6.35, 12.1, 0.5, { size: 11, color: C.dim });
    s.addNotes(
      "[15:30 — 18:00] Lire ligne par ligne, sans commentaire militant. " +
      "Deux lignes font gagner APIM (REST→MCP, portail), deux font gagner les autres (fédération, autorisation par outil). " +
      "Attention : les policies APIM s'appellent maintenant llm-* (plus azure-openai-*). Un comparatif de 2025 est périmé."
    );
  }

  // ----------------------------------------------------------------- 16. Le cas honnête pour APIM
  {
    const s = newSlide();
    kicker(s, "LE CAS HONNÊTE POUR APIM");
    title(s, "Si c'est votre contexte, APIM est la bonne réponse");
    const g = [
      ["FaSitemap", "Un patrimoine d'API existant", "REST, SOAP, GraphQL, OData : une passerelle, un moteur de policies."],
      ["FaPlug", "REST → MCP en un clic", "Vos API existantes deviennent des outils d'agents, policies comprises."],
      ["FaStore", "Produits et portail", "Abonnements, approbations, quotas, refacturation par équipe."],
      ["FaNetworkWired", "Identité et réseau Azure", "Managed identity, Key Vault, VNet injection, multi-région."],
      ["FaDatabase", "Cache sémantique", "llm-semantic-cache-* : moins de tokens sur les requêtes répétées."],
      ["FaShieldAlt", "Content safety natif", "llm-content-safety : Prompt Shields sur LLM, MCP et A2A."],
    ];
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = MX + col * 4.1, y = 2.0 + row * 2.2, w = 3.8, h = 1.95;
      card(s, x, y, w, h);
      await iconCircle(s, g[i][0], x + 0.3, y + 0.3, 0.7, C.accent);
      txt(s, g[i][1], x + 1.15, y + 0.33, w - 1.35, 0.65, { face: H, size: 15, bold: true, color: C.white, valign: "middle" });
      txt(s, g[i][2], x + 0.3, y + 1.1, w - 0.6, 0.75, { size: 13, color: C.muted, lsm: 1.05 });
    }
    s.addNotes(
      "[18:00 — 19:30] Le passage qui fait la différence devant un public Azure. Ne pas minimiser : " +
      "une entreprise avec 400 API et zéro serveur MCP a intérêt à regarder APIM en premier."
    );
  }

  // ----------------------------------------------------------------- 17. Ce qui a fait basculer
  {
    const s = newSlide();
    kicker(s, "CE QUI A FAIT BASCULER");
    title(s, "Pour une plateforme Kubernetes, cinq raisons");
    const r = [
      ["L'écosystème", "kagent (CNCF Sandbox), kmcp, agentregistry : des stacks IA standardisées, déployées comme n'importe quelle ressource Kubernetes."],
      ["Un standard, pas un produit", "Gateway API : la compétence et les manifestes suivent d'un cloud à l'autre."],
      ["L'autorisation par outil", "CEL sur jwt.sub et mcp.tool.name — les outils non autorisés disparaissent du tools/list."],
      ["La fédération MCP", "Un seul endpoint pour Jira, Azure DevOps, SharePoint… au lieu d'une connexion par serveur."],
      ["Rust", "~22 Mo de mémoire par instance, contre plusieurs Go pour un proxy Python.*"],
    ];
    r.forEach((it, i) => {
      const y = 1.95 + i * 0.86;
      s.addShape(pres.shapes.OVAL, { x: MX, y: y + 0.05, w: 0.55, h: 0.55, fill: { color: C.deep }, line: { color: C.deep, width: 0 } });
      txt(s, String(i + 1), MX, y + 0.05, 0.55, 0.55, { face: H, size: 16, bold: true, color: C.white, align: "center", valign: "middle" });
      txt(s, it[0], MX + 0.8, y + 0.02, 3.2, 0.6, { face: H, size: 16, bold: true, color: C.white, valign: "middle" });
      txt(s, it[1], MX + 4.1, y + 0.02, 8.0, 0.66, { size: 14, color: C.muted, valign: "middle", lsm: 1.05 });
    });
    txt(s, "* Mesure publiée par Solo.io, sur un backend factice. À retenir : l'empreinte mémoire, pas le multiple de débit — l'écart s'efface quand l'inférence domine la latence.", MX, 6.35, 12.1, 0.5, { size: 11, color: C.dim });
    s.addNotes(
      "[19:30 — 21:30] Les raisons 1 et 5 sont celles de l'équipe à l'origine ; 2 à 4 sont venues en creusant. " +
      "Sur Rust : ne JAMAIS citer le 36 900 vs 3 200 QPS. Benchmark éditeur, backend factice. Quelqu'un le trouvera."
    );
  }

  // ----------------------------------------------------------------- 18. Deux couches
  {
    const s = newSlide();
    kicker(s, "LA NUANCE");
    title(s, "Deux couches, pas deux concurrents");
    const steps = [
      ["Vos API REST existantes", C.border, C.text],
      ["APIM\nfabrique des serveurs MCP", C.accent, C.white],
      ["agentgateway\nfédère, autorise, observe", C.green, C.white],
      ["Agents et utilisateurs", C.border, C.text],
    ];
    steps.forEach((st, i) => {
      const x = MX + i * 3.15, y = 2.5, w = 2.6, h = 1.6;
      card(s, x, y, w, h, { fill: C.surf, line: st[1], lw: 1.75 });
      txt(s, st[0], x + 0.15, y, w - 0.3, h, { face: H, size: 15, bold: true, color: st[2], align: "center", valign: "middle" });
      if (i < 3) arrow(s, x + w + 0.05, y + h / 2, 0.45, 0, C.muted);
    });
    txt(s, "APIM transforme un patrimoine d'API en outils d'agents. agentgateway gouverne ces outils à l'exécution, au plus près des agents, dans le cluster.", MX, 4.65, 12.1, 0.9, { size: 17, color: C.text, lsm: 1.1 });
    txt(s, "Architecture possible, pas celle du REX : à envisager si votre point de départ est un catalogue d'API.", MX, 5.75, 12.1, 0.4, { size: 13, italic: true, color: C.muted });
    s.addNotes(
      "[21:30 — 22:30] La phrase qu'on doit retenir de la section. On ne choisit pas un camp, on choisit une couche. " +
      "Préciser que ce n'est pas ce que le client a fait — c'est ce que je regarderais aujourd'hui."
    );
  }


  // ================================================================= NOUVELLE SECTION 04
  await divider("04", "Standardiser et protéger", "kagent pour les stacks IA, agentgateway pour les garde-fous.",
    "Transition. On passe du « pourquoi » au « comment » : ce que les équipes écrivent, et ce que la plateforme impose.");

  // ----------------------------------------------------------------- 04-A. Cinq ressources
  {
    const s = newSlide();
    kicker(s, "KAGENT · CNCF SANDBOX");
    title(s, "Une stack IA, ce sont quelques ressources Kubernetes");
    const g = [
      ["FaRobot", "Agent", "kagent.dev/v1alpha2", "Le rôle, le runtime, les outils autorisés. Un manifeste déclaratif."],
      ["FaFileAlt", "Prompt", "systemMessageFrom", "Le prompt vit dans une ConfigMap : relu en PR, versionné, partagé."],
      ["FaPuzzlePiece", "Skills", "spec.skills", "Des images OCI avec un SKILL.md : instructions et scripts, montés dans /skills."],
      ["FaPlug", "Outils MCP", "RemoteMCPServer · MCPServer", "Serveurs distants, ou déployés par kmcp dans le cluster."],
      ["FaMicrochip", "Modèle", "ModelConfig", "Pointe vers la passerelle, jamais directement vers un fournisseur."],
    ];
    for (let i = 0; i < 6; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const x = MX + col * 4.1, y = 1.95 + row * 2.3, w = 3.8, h = 2.05;
      if (i === 5) {
        card(s, x, y, w, h, { fill: "0F2A1A", line: C.green, lw: 1.5 });
        await iconCircle(s, "FaBook", x + 0.3, y + 0.3, 0.7, C.green);
        txt(s, "agentregistry", x + 1.15, y + 0.3, w - 1.35, 0.4, { face: H, size: 17, bold: true, color: C.white });
        txt(s, "le catalogue", x + 1.15, y + 0.7, w - 1.35, 0.3, { face: M, size: 10.5, color: C.green });
        txt(s, "Publier, découvrir et réutiliser agents, skills, prompts et serveurs MCP.", x + 0.3, y + 1.2, w - 0.6, 0.75, { size: 13, color: C.text, lsm: 1.05 });
        continue;
      }
      card(s, x, y, w, h);
      await iconCircle(s, g[i][0], x + 0.3, y + 0.3, 0.7, C.accent);
      txt(s, g[i][1], x + 1.15, y + 0.3, w - 1.35, 0.4, { face: H, size: 17, bold: true, color: C.white });
      txt(s, g[i][2], x + 1.15, y + 0.7, w - 1.35, 0.3, { face: M, size: 10.5, color: C.accent });
      txt(s, g[i][3], x + 0.3, y + 1.2, w - 0.6, 0.75, { size: 13, color: C.muted, lsm: 1.05 });
    }
    txt(s, "Standardiser une stack IA, c'est standardiser ces manifestes — comme on standardise déjà un Deployment.", MX, 6.55, 12.1, 0.4, { size: 15, italic: true, color: C.accent });
    s.addNotes(
      "Le cœur de l'argument « plateforme ». Une équipe projet ne livre plus « son intégration IA » : elle livre des ressources connues " +
      "de la plateforme, que la plateforme sait valider, déployer, observer et retirer. " +
      "Les built-in agents (k8s-agent, helm-agent, promql-agent…) montrent le format de référence."
    );
  }

  // ----------------------------------------------------------------- 04-B. Anatomie
  {
    const s = newSlide();
    kicker(s, "ANATOMIE D'UN AGENT STANDARDISÉ");
    title(s, "Tout ce qui fait l'agent tient dans un manifeste");
    code(s, [
      "apiVersion: kagent.dev/v1alpha2",
      "kind: Agent",
      "metadata:",
      "  name: assistant-tickets",
      "  namespace: equipe-produit",
      "spec:",
      "  type: Declarative",
      "  skills:                         # (1)",
      "    refs:",
      "    - registre.interne/skills/tri-jira:1.2.0",
      "  declarative:",
      "    runtime: go",
      "    modelConfig: passerelle-llm   # (2)",
      "    systemMessageFrom:            # (3)",
      "      type: ConfigMap",
      "      name: prompts-equipe-produit",
      "      key: assistant-tickets",
      "    tools:",
      "    - type: McpServer",
      "      mcpServer:                  # (4)",
      "        kind: MCPServer",
      "        name: jira-mcp",
      "        toolNames: [search_issues, get_issue, update_issue]",
      "        requireApproval: [update_issue]   # (5)",
    ], MX, 1.9, 7.4, 5.0, { size: 10, label: "agents/assistant-tickets.yaml" });
    const ex = [
      ["Skill versionnée", "Une image OCI, taguée et publiée comme un conteneur."],
      ["Modèle abstrait", "La passerelle choisit le fournisseur ; l'agent l'ignore."],
      ["Prompt externalisé", "Relu en pull request, partagé, modifiable sans rebuild."],
      ["Outils filtrés", "L'agent ne voit que les outils listés."],
      ["Validation humaine", "Les actions qui écrivent attendent un humain."],
    ];
    ex.forEach((e, i) => {
      const y = 1.95 + i * 0.98;
      s.addShape(pres.shapes.OVAL, { x: 8.35, y, w: 0.5, h: 0.5, fill: { color: C.deep }, line: { color: C.deep, width: 0 } });
      txt(s, String(i + 1), 8.35, y, 0.5, 0.5, { face: H, size: 14, bold: true, color: C.white, align: "center", valign: "middle" });
      txt(s, e[0], 9.05, y - 0.02, 3.75, 0.35, { face: H, size: 14.5, bold: true, color: C.white });
      txt(s, e[1], 9.05, y + 0.34, 3.75, 0.55, { size: 12.5, color: C.muted });
    });
    s.addNotes(
      "Parcourir les cinq numéros, dans l'ordre. Insister sur (2) — c'est le lien avec l'agnosticité — et sur (5) : " +
      "c'est la réponse à « et si l'agent fait une bêtise ? ». " +
      "Champs vérifiés dans la doc kagent 0.x : spec.skills.refs, systemMessageFrom (ConfigMap ou Secret, exclusif avec systemMessage), " +
      "toolNames et requireApproval sous mcpServer."
    );
  }

  // ----------------------------------------------------------------- 04-C. Cycle de vie
  {
    const s = newSlide();
    kicker(s, "CYCLE DE VIE");
    title(s, "Du dépôt au catalogue, le même chemin pour tous");
    const st = [
      ["FaCodeBranch", "Pull request", "Manifeste, prompt et skill dans le même dépôt"],
      ["FaCheckDouble", "Intégration continue", "Validation des CRD, scan de l'image de la skill"],
      ["FaSyncAlt", "GitOps", "Argo CD, Flux, ou kubectl apply"],
      ["FaRobot", "kagent réconcilie", "Déploie l'agent, monte les skills dans /skills"],
      ["FaStore", "Catalogue et usage", "agentregistry, carte A2A, LibreChat"],
    ];
    for (let i = 0; i < st.length; i++) {
      const x = MX + i * 2.47, y = 2.05, w = 2.2, h = 2.6;
      card(s, x, y, w, h, { line: i === 4 ? C.green : C.surf2, lw: i === 4 ? 1.5 : 1 });
      await iconCircle(s, st[i][0], x + (w - 0.75) / 2, y + 0.3, 0.75, i === 4 ? C.green : C.accent);
      txt(s, st[i][1], x + 0.12, y + 1.2, w - 0.24, 0.4, { face: H, size: 14.5, bold: true, color: C.white, align: "center" });
      txt(s, st[i][2], x + 0.15, y + 1.65, w - 0.3, 0.9, { size: 12, color: C.muted, align: "center", lsm: 1.05 });
      if (i < st.length - 1) arrow(s, x + w + 0.02, y + h / 2, 0.23, 0, C.muted);
    }
    const ben = [
      ["Un gabarit par type d'agent", "Les équipes partent d'un modèle validé, pas d'une page blanche."],
      ["Revue, historique, retour arrière", "Git fait le travail : chaque changement de prompt a un auteur."],
      ["Identique sur tous les clusters", "AKS, EKS ou Managed Kubernetes : le chemin ne change pas."],
    ];
    ben.forEach((b, i) => {
      const x = MX + i * 4.1;
      txt(s, b[0], x, 5.05, 3.8, 0.4, { face: H, size: 15, bold: true, color: C.accent });
      txt(s, b[1], x, 5.45, 3.8, 0.8, { size: 13, color: C.text, lsm: 1.05 });
    });
    s.addNotes(
      "C'est ce qui a permis au client de passer d'intégrations au cas par cas à des stacks standardisées. " +
      "Pas de console, pas de ticket : un dépôt, une revue, une réconciliation. " +
      "Les agents sont ensuite exposés en A2A (/api/a2a/{namespace}/{agent}) et comme outils MCP par le contrôleur kagent."
    );
  }

  // ----------------------------------------------------------------- 04-D. Pipeline des garde-fous
  {
    const s = newSlide();
    kicker(s, "GARDE-FOUS CENTRALISÉS");
    title(s, "Posés une fois à la passerelle, pour tous les modèles");
    const steps = [
      ["FaIdCard", "Identité", "jwtAuthentication\n(Entra ID)"],
      ["FaFilter", "Autorisation", "CEL sur jwt.*\net mcp.tool.name"],
      ["FaShieldAlt", "Prompt", "promptGuard.request\nPII · modération"],
      ["FaTachometerAlt", "Plafonds", "rateLimit\nen tokens"],
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
    // modèle
    const mx = MX + 4 * 2.2;
    card(s, mx, y, 1.6, h, { fill: C.surf2, line: C.yellow, lw: 1.5 });
    txt(s, "Modèle", mx, y + 0.55, 1.6, 0.4, { face: H, size: 15, bold: true, color: C.yellow, align: "center" });
    txt(s, "Foundry,\nBedrock,\nauto-hébergé…", mx, y + 1.0, 1.6, 1.0, { size: 11.5, color: C.muted, align: "center" });
    arrow(s, mx + 1.62, y + h / 2, 0.21, 0, C.muted);
    // réponse
    const rx = mx + 1.85;
    card(s, rx, y, W - MX - rx, h);
    await iconCircle(s, "FaEye", rx + (W - MX - rx - 0.7) / 2, y + 0.25, 0.7, C.green);
    txt(s, "Réponse", rx + 0.1, y + 1.05, W - MX - rx - 0.2, 0.4, { face: H, size: 15, bold: true, color: C.white, align: "center" });
    txt(s, "promptGuard\n.response", rx + 0.1, y + 1.5, W - MX - rx - 0.2, 0.7, { face: M, size: 9.5, color: C.accent, align: "center" });

    // actions
    const acts = [["Mask", "remplace la donnée sensible", C.accent], ["Reject", "bloque avant le modèle", C.yellow], ["Audit", "laisse passer, mais trace", C.muted]];
    acts.forEach((a, i) => {
      const x = MX + i * 2.75;
      s.addText(a[0], {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x, y: 4.85, w: 1.05, h: 0.38,
        line: { color: a[2], width: 1.25 }, fill: { color: C.bg },
        fontFace: M, fontSize: 12, bold: true, color: a[2], align: "center", valign: "middle", margin: 0, isTextBox: true,
      });
      txt(s, a[1], x + 1.18, 4.85, 1.5, 0.4, { size: 12.5, color: C.text, valign: "middle" });
    });
    txt(s, "Portée : prompt système, messages, entrée ou sortie d'outil.", 8.9, 4.85, 3.85, 0.4, { size: 12.5, color: C.muted, valign: "middle" });
    card(s, MX, 5.55, 12.13, 0.9, { fill: C.surf, line: C.accent });
    txt(s, "Aucune ligne dans les agents : changez de modèle ou de cloud, les garde-fous suivent.", MX + 0.3, 5.55, 11.5, 0.9, { size: 17, color: C.white, valign: "middle", bold: true });
    s.addNotes(
      "Suivre une requête de gauche à droite. Tout est une AgentgatewayPolicy attachée à une route ou à un backend. " +
      "C'est exactement ce qui manquait le vendredi soir : identité, autorisation, contrôle du contenu, plafond. " +
      "Chaque contrôle est compté par la métrique agentgateway_guardrail_checks_total."
    );
  }


  // ----------------------------------------------------------------- 04-D2. Un standard, pas trois
  {
    const s = newSlide();
    kicker(s, "UN STANDARD UNIQUE");
    title(s, "Les mêmes règles, quel que soit le fournisseur");
    // Sans passerelle
    txt(s, "SANS PASSERELLE", MX, 1.95, 5.8, 0.3, { face: H, size: 11, bold: true, color: C.yellow, cs: 2 });
    const prov = [
      ["Microsoft Foundry", "Filtres de contenu\npar déploiement"],
      ["Amazon Bedrock", "Bedrock\nGuardrails"],
      ["OVHcloud", "Selon l'offre\ndu fournisseur"],
    ];
    prov.forEach((p, i) => {
      const x = MX + i * 1.97, w = 1.8;
      card(s, x, 2.35, w, 1.25, { fill: C.surf, line: C.yellow });
      txt(s, p[1], x + 0.08, 2.35, w - 0.16, 1.25, { size: 12, color: C.yellow, align: "center", valign: "middle" });
      arrow(s, x + w / 2, 3.62, 0, 0.3, C.muted);
      card(s, x, 3.95, w, 0.75, { fill: C.surf2, line: C.border });
      txt(s, p[0], x + 0.05, 3.95, w - 0.1, 0.75, { face: H, size: 12, bold: true, color: C.white, align: "center", valign: "middle" });
    });
    txt(s, "3 configurations · 3 comportements · 3 journaux d'audit", MX, 4.95, 5.8, 0.4, { size: 14, bold: true, color: C.yellow });
    txt(s, "Un changement de fournisseur change silencieusement les règles.", MX, 5.35, 5.8, 0.4, { size: 13, color: C.muted });

    // séparateur vertical
    s.addShape(pres.shapes.LINE, { x: 6.67, y: 2.0, w: 0, h: 3.8, line: { color: C.border, width: 1, dashType: "dash" } });

    // Avec passerelle
    const x0 = 7.05, ww = 5.7;
    txt(s, "AVEC LA PASSERELLE", x0, 1.95, ww, 0.3, { face: H, size: 11, bold: true, color: C.green, cs: 2 });
    card(s, x0, 2.35, ww, 1.25, { fill: "0F2A1A", line: C.green, lw: 1.75 });
    txt(s, "Une AgentgatewayPolicy", x0, 2.45, ww, 0.45, { face: H, size: 16, bold: true, color: C.green, align: "center" });
    txt(s, "identité · autorisation · PII · modération · plafonds", x0, 2.95, ww, 0.4, { size: 12.5, color: C.text, align: "center" });
    ["Microsoft Foundry", "Amazon Bedrock", "OVHcloud"].forEach((n, i) => {
      const x = x0 + i * 1.95, w = 1.8;
      arrow(s, x + w / 2, 3.62, 0, 0.3, C.green);
      card(s, x, 3.95, w, 0.75, { fill: C.surf2, line: C.border });
      txt(s, n, x + 0.05, 3.95, w - 0.1, 0.75, { face: H, size: 12, bold: true, color: C.white, align: "center", valign: "middle" });
    });
    txt(s, "1 politique · 1 comportement · 1 journal d'audit", x0, 4.95, ww, 0.4, { size: 14, bold: true, color: C.green });
    txt(s, "Changer de fournisseur ne change pas les règles.", x0, 5.35, ww, 0.4, { size: 13, color: C.muted });

    card(s, MX, 6.0, 12.13, 0.72, { fill: C.surf, line: C.accent });
    txt(s, "Les garde-fous natifs restent utiles en défense en profondeur. Mais la règle de référence vit à la passerelle.", MX + 0.3, 6.0, 11.5, 0.72, { size: 15, color: C.white, valign: "middle" });
    s.addNotes(
      "Le message clé de la section. Chaque fournisseur a ses propres garde-fous, avec sa propre configuration et ses propres seuils : " +
      "les filtres de contenu Foundry par déploiement, Bedrock Guardrails côté AWS, et côté OVHcloud cela dépend de l'offre. " +
      "Si la règle vit chez le fournisseur, changer de fournisseur change la règle — sans que personne ne s'en rende compte. " +
      "En la déportant sur la passerelle, on consomme Foundry, Bedrock ou OVHcloud avec exactement le même standard. " +
      "Ne pas dire que les garde-fous natifs sont inutiles : ils restent une deuxième ligne."
    );
  }

  // ----------------------------------------------------------------- 04-E. Catalogue des garde-fous
  {
    const s = newSlide();
    kicker(s, "LE CATALOGUE");
    title(s, "Ce que la passerelle sait contrôler");
    const hd = (t) => ({ text: t, options: { fill: { color: C.surf2 }, color: C.white, bold: true, fontFace: H, fontSize: 13, valign: "middle" } });
    const k = (t) => ({ text: t, options: { fill: { color: C.surf }, color: C.accent, fontFace: M, fontSize: 11.5, bold: true, valign: "middle" } });
    const d = (t) => ({ text: t, options: { fill: { color: C.surf }, color: C.text, fontFace: B, fontSize: 13, valign: "middle" } });
    const rows = [
      [hd("Garde-fou"), hd("Ce qu'il fait")],
      [k("regex"), d("Détecte e-mails, téléphones, numéros de carte… ou vos propres motifs")],
      [k("openAIModeration"), d("Classe le contenu via l'API de modération d'OpenAI")],
      [k("webhook"), d("Appelle votre propre moteur — NeMo Guardrails (ma cible R&D) — avec l'identité de l'appelant")],
      [k("bedrockGuardrails · googleModelArmor"), d("Délègue aux garde-fous managés d'AWS ou de Google — possible, mais recrée une dépendance")],
      [k("mcp.authorization"), d("Qui peut appeler quel outil — les outils refusés disparaissent du tools/list")],
      [k("rateLimit"), d("Plafonds en requêtes ou en tokens, par route — par clé et par équipe avec un service de rate limit")],
    ];
    s.addTable(rows, {
      x: MX, y: 1.9, w: 8.2, colW: [3.1, 5.1], rowH: [0.45, 0.6, 0.6, 0.72, 0.6, 0.6, 0.72],
      border: { type: "solid", color: C.bg, pt: 2 },
    });
    card(s, 9.1, 1.9, 3.65, 2.35, { fill: C.surf, line: C.green });
    txt(s, "Agnostique", 9.35, 2.05, 3.2, 0.4, { face: H, size: 16, bold: true, color: C.green });
    txt(s, "Pour un standard unique, privilégiez regex et webhook : la règle reste la même, seul le service appelé par le webhook peut changer.", 9.35, 2.5, 3.2, 1.65, { size: 13, color: C.text, lsm: 1.05 });
    card(s, 9.1, 4.45, 3.65, 2.35, { fill: C.surf, line: C.yellow });
    txt(s, "À savoir", 9.35, 4.6, 3.2, 0.4, { face: H, size: 16, bold: true, color: C.yellow });
    txt(s, "En streaming, le masquage ne s'applique pas : utilisez Reject. Le webhook n'a pas de délai propre : fixez-en un par une politique de timeout.", 9.35, 5.05, 3.2, 1.7, { size: 12.5, color: C.text, lsm: 1.05 });
    s.addNotes(
      "Tous ces garde-fous sont dans l'édition open source (Apache-2.0), aucun n'est réservé à l'édition Enterprise. " +
      "Le webhook reçoit des en-têtes calculés en CEL (jwt.sub, llmRequest.model) : le service de modération sait qui demande quoi. " +
      "Les deux limites à droite sont documentées : les dire avant qu'on les découvre."
    );
  }


  // ----------------------------------------------------------------- 04-F. Aujourd'hui / demain (R&D NeMo)
  {
    const s = newSlide();
    kicker(s, "AUJOURD'HUI ET DEMAIN");
    tag(s, "R&D", C.yellow);
    title(s, "Garde-fous : ce qui tourne, ce que je prépare");
    const colW = 5.95;
    // Aujourd'hui
    card(s, MX, 1.95, colW, 3.55, { fill: C.surf, line: C.green, lw: 1.5 });
    txt(s, "AUJOURD'HUI · EN PRODUCTION", MX + 0.3, 2.12, colW - 0.6, 0.3, { face: H, size: 11, bold: true, color: C.green, cs: 2 });
    await iconCircle(s, "FaCheck", MX + 0.3, 2.6, 0.75, C.green);
    txt(s, "Garde-fous Microsoft Foundry", MX + 1.25, 2.62, colW - 1.5, 0.7, { face: H, size: 18, bold: true, color: C.white, valign: "middle" });
    bullets(s, [
      "Filtres de contenu intégrés aux déploiements de modèles",
      "Natifs : aucun composant supplémentaire à opérer",
      "Mais propres à Azure : ils ne suivent pas un changement de fournisseur",
    ], MX + 0.3, 3.55, colW - 0.6, 1.9, { size: 14, psa: 8 });
    // Demain
    const x2 = MX + 6.18;
    card(s, x2, 1.95, colW, 3.55, { fill: C.surf, line: C.yellow, lw: 1.5 });
    txt(s, "DEMAIN · R&D EN COURS", x2 + 0.3, 2.12, colW - 0.6, 0.3, { face: H, size: 11, bold: true, color: C.yellow, cs: 2 });
    await iconCircle(s, "FaFlask", x2 + 0.3, 2.6, 0.75, C.yellow);
    txt(s, "NVIDIA NeMo Guardrails derrière la passerelle", x2 + 1.25, 2.62, colW - 1.5, 0.7, { face: H, size: 18, bold: true, color: C.white, valign: "middle" });
    bullets(s, [
      "Open source (Apache-2.0), branché par le garde-fou webhook d'agentgateway",
      "Les mêmes règles pour Foundry, Bedrock ou OVHcloud",
      "Mode entreprise possible : CRD NemoGuardrail du NIM Operator (licence NVIDIA AI Enterprise)",
    ], x2 + 0.3, 3.55, colW - 0.6, 1.9, { size: 14, psa: 8 });
    // Preuve
    card(s, MX, 5.75, 12.13, 0.95, { fill: C.surf, line: C.accent });
    txt(s, "Déjà dans le dépôt : adaptateur webhook, profils de règles, 20 tests, manifestes validés contre les CRD Solo.io et NVIDIA — à essayer, pas encore en production.", MX + 0.3, 5.75, 11.5, 0.95, { size: 14.5, color: C.white, valign: "middle" });
    s.addNotes(
      "Être transparent : chez le client, ce sont les garde-fous Microsoft Foundry qui tournent aujourd'hui. " +
      "Ils font le travail, mais ils sont liés à Azure — ce qui contredit l'objectif d'une règle unique quel que soit le fournisseur. " +
      "NeMo Guardrails derrière la passerelle est ma cible : je le prototype en R&D, en parallèle de mes missions. " +
      "Le code est dans le dépôt et déployé par le Terraform de démonstration : chacun peut l'essayer. " +
      "Ne pas le présenter comme une solution éprouvée en production. " +
      "Note : les modèles Claude (Anthropic) du catalogue Foundry n'ont pas de filtrage de contenu Foundry (Microsoft Learn, « Claude models in Microsoft Foundry ») — seules les protections d'Anthropic ; ils doivent passer par la passerelle pour hériter des mêmes règles."
    );
  }

  // ----------------------------------------------------------------- 19. Divider 04
  await divider("05", "L'implémentation de référence", "Sur Azure, déployée par Terraform et GitHub Actions.",
    "[22:30] Transition vers le concret.");

  // ----------------------------------------------------------------- 20. Architecture
  {
    const s = newSlide();
    kicker(s, "ARCHITECTURE");
    title(s, "Tout ce qui est dans le cluster est portable", { size: 26 });
    // Entra + users
    card(s, MX, 2.0, 1.75, 0.95, { fill: C.surf2, line: C.border });
    txt(s, "Utilisateurs", MX, 2.0, 1.75, 0.95, { size: 13, bold: true, align: "center", valign: "middle" });
    card(s, MX, 3.35, 1.75, 0.95, { fill: C.surf, line: C.accent });
    txt(s, "Entra ID", MX, 3.35, 1.75, 0.95, { face: H, size: 14, bold: true, color: C.accent, align: "center", valign: "middle" });

    // AKS container
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 2.65, y: 1.85, w: 7.55, h: 4.75, rectRadius: 0.12, fill: { color: "07101F" }, line: { color: C.green, width: 1.5, dashType: "dash" } });
    txt(s, "AKS  ·  couches portables", 2.85, 1.95, 4, 0.3, { face: H, size: 11, bold: true, color: C.green, cs: 1 });

    const box = (t, sub, x, y, w, h, line = C.border, tc = C.white) => {
      card(s, x, y, w, h, { fill: C.surf, line });
      txt(s, t, x + 0.1, y + 0.12, w - 0.2, 0.35, { face: H, size: 14, bold: true, color: tc, align: "center" });
      if (sub) txt(s, sub, x + 0.1, y + 0.5, w - 0.2, h - 0.6, { size: 11, color: C.muted, align: "center" });
    };
    box("LibreChat", "front unique\nOIDC Entra", 2.9, 2.4, 1.9, 1.3);
    box("agentgateway", "JWT · garde-fous · plafonds\nrepli entre fournisseurs\nfédération MCP", 5.2, 2.35, 2.8, 1.75, C.accent, C.accent);
    box("Grafana", "tokens · coûts\npar modèle", 8.35, 2.4, 1.65, 1.3);
    box("agentregistry", "catalogue\nagents · skills\nMCP", 2.9, 4.6, 1.7, 1.5);
    box("kagent", "agents\ndéclaratifs\nSRE · métier", 4.8, 4.6, 1.55, 1.5);
    box("Serveurs MCP", "Jira · ADO\nSharePoint", 6.55, 4.6, 1.6, 1.5);
    // Modèle auto-hébergé : KAITO (add-on AKS) + vLLM sur un nœud GPU
    box("Modèles AKS", "KAITO · vLLM\nnœud GPU\nà la demande", 8.35, 4.6, 1.65, 1.5, C.green, C.green);

    // Foundry + others
    card(s, 10.55, 1.85, 2.2, 2.55, { fill: C.surf, line: C.yellow });
    txt(s, "Microsoft Foundry", 10.6, 1.92, 2.1, 0.35, { face: H, size: 13, bold: true, color: C.yellow, align: "center" });
    // Garde-fous Foundry : à l'entrée, devant les modèles
    card(s, 10.65, 2.32, 2.0, 0.78, { fill: "0B2A1F", line: C.green, lw: 1.5 });
    s.addImage({ data: await icon("FaShieldAlt", C.green), x: 10.75, y: 2.47, w: 0.42, h: 0.46 });
    txt(s, "Garde-fous", 11.22, 2.36, 1.4, 0.3, { face: H, size: 12, bold: true, color: C.green, valign: "middle" });
    txt(s, "filtres de contenu\nen production", 11.22, 2.66, 1.4, 0.42, { size: 9.5, color: C.text, valign: "top", lsm: 0.95 });
    txt(s, "Sol · frontier · Global\nTerra · daily · DataZone\nLuna · volume · DataZone", 10.6, 3.18, 2.1, 0.8, { face: M, size: 9, color: C.text, align: "center", valign: "middle", lsm: 1.15 });
    txt(s, "adaptateur Azure", 10.6, 4.02, 2.1, 0.3, { size: 10, italic: true, color: C.muted, align: "center" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.55, y: 4.7, w: 2.2, h: 1.4, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.border, width: 1.25, dashType: "dash" } });
    txt(s, "Bedrock, OVHcloud…\nun groupe de plus\ndans le même Backend", 10.6, 4.75, 2.1, 1.3, { size: 11, color: C.muted, align: "center", valign: "middle" });

    // arrows
    arrow(s, MX + 0.87, 2.97, 0, 0.36, C.muted);            // users -> entra
    arrow(s, MX + 1.78, 3.55, 0.5, -0.9, C.accent);         // entra -> librechat
    arrow(s, 4.83, 3.05, 0.35, 0, C.accent);                // librechat -> gw
    arrow(s, 8.03, 3.05, 0.3, 0, C.muted);                  // gw -> grafana (metrics)
    arrow(s, 5.57, 4.58, 0, -0.45, C.accent);               // kagent -> gw
    arrow(s, 7.75, 4.13, 0.85, 0.45, C.green);              // gw -> modèles AKS
    // gw -> garde-fous Foundry (coude sous Grafana, entre au niveau du bouclier)
    const lineY = (x, y, w, h) => s.addShape(pres.shapes.LINE, { x, y, w, h, line: { color: C.yellow, width: 1.75 } });
    lineY(8.02, 3.95, 2.35, 0);
    lineY(10.37, 2.71, 0, 1.24);
    arrow(s, 10.37, 2.71, 0.26, 0, C.yellow);
    s.addNotes(
      "[22:30 — 24:30] Montrer le périmètre en pointillés verts : tout ce qui est dedans est portable. " +
      "Deux choses sortent du cluster : Entra ID et Foundry. Ce sont précisément les deux adaptateurs Azure. " +
      "La flèche vers Foundry entre d'abord dans les garde-fous Foundry : ce sont les filtres de contenu qui tournent en production aujourd'hui, devant chaque déploiement. " +
      "La passerelle ajoute ses propres règles en amont (regex, plafonds, autorisation MCP) : c'est cette couche-là qui suit si on change de fournisseur. " +
      "En vert en bas à droite : le modèle peut aussi vivre DANS le cluster (KAITO). Là, pas de filtres Foundry : seules les règles de la passerelle s'appliquent."
    );
  }

  // ----------------------------------------------------------------- 21. Identité bout en bout
  {
    const s = newSlide();
    kicker(s, "IDENTITÉ DE BOUT EN BOUT");
    title(s, "Aucune clé API, nulle part");
    const st = [
      ["Connexion", "L'utilisateur se connecte à LibreChat via Entra ID (authorization code)."],
      ["Jeton d'accès", "LibreChat obtient un access token pour le scope agents.invoke de la passerelle."],
      ["Validation", "agentgateway vérifie iss, aud et scp. Jamais l'id_token."],
      ["Workload ID", "Le pod échange son jeton de service account contre un jeton Entra."],
      ["Sans clé", "Foundry reçoit un jeton Entra. local_auth est désactivé."],
    ];
    st.forEach((it, i) => {
      const x = MX + i * 2.47, y = 2.2;
      s.addShape(pres.shapes.OVAL, { x: x + 0.75, y, w: 0.75, h: 0.75, fill: { color: i === 3 ? C.yellow : C.deep }, line: { color: C.bg, width: 0 } });
      txt(s, String(i + 1), x + 0.75, y, 0.75, 0.75, { face: H, size: 20, bold: true, color: i === 3 ? C.bg : C.white, align: "center", valign: "middle" });
      if (i < 4) s.addShape(pres.shapes.LINE, { x: x + 1.55, y: y + 0.375, w: 1.62, h: 0, line: { color: C.border, width: 1.5 } });
      txt(s, it[0], x, y + 0.95, 2.25, 0.4, { face: H, size: 15, bold: true, color: C.white, align: "center" });
      txt(s, it[1], x + 0.05, y + 1.4, 2.15, 1.6, { size: 13, color: C.muted, align: "center", lsm: 1.1 });
    });
    card(s, MX, 5.35, 12.13, 0.95, { fill: C.surf, line: C.yellow });
    txt(s, "Sur AWS, l'étape 4 devient EKS Pod Identity. Les étapes 1 à 3 ne changent pas : c'est la même passerelle.", MX + 0.3, 5.35, 11.5, 0.95, { size: 16, color: C.text, valign: "middle" });
    s.addNotes(
      "[24:30 — 26:00] L'étape en jaune est la seule spécifique au cloud. " +
      "Point technique : requested_access_token_version = 2 côté app Entra, sinon l'aud n'est pas le GUID attendu. " +
      "Scope Foundry : https://ai.azure.com/.default depuis 2026."
    );
  }

  // ----------------------------------------------------------------- 22. Les pièges
  {
    const s = newSlide();
    kicker(s, "REX TECHNIQUE", C.yellow);
    title(s, "Six pièges que la documentation ne met pas en avant");
    const p = [
      ["« Azure AI Foundry » → Microsoft Foundry", "Rôles renommés, GUID inchangés : assignez les rôles par GUID."],
      ["/models est retiré depuis le 26/08/2026", "Utilisez /openai/v1/ — sans paramètre api-version."],
      ["Le scope a changé", "https://ai.azure.com/.default, plus cognitiveservices.azure.com."],
      ["requested_access_token_version = 2", "Sinon l'aud devient api://<id> : un 401 garanti."],
      ["capacity = 1 dans l'exemple officiel", "1 000 tokens par minute : un seul chat suffit à saturer."],
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
      "[26:00 — 27:00] Aller vite, c'est une slide « photo ». Les gens la prendront en photo : c'est bon signe. " +
      "Tous ces points sont vérifiés sur Microsoft Learn et la doc agentgateway au 18/09/2026 — revérifier la veille."
    );
  }

  // ----------------------------------------------------------------- 22-B. Modèles hébergés dans AKS (KAITO)
  {
    const s = newSlide();
    kicker(s, "AUTO-HÉBERGER", C.green);
    title(s, "Le modèle aussi peut vivre dans le cluster");
    code(s, [
      "apiVersion: kaito.sh/v1beta1",
      "kind: Workspace",
      "metadata:",
      "  name: workspace-phi-4-mini",
      "  namespace: models",
      "resource:",
      "  instanceType: Standard_NV36ads_A10_v5",
      "  labelSelector:",
      "    matchLabels: { apps: phi-4-mini }",
      "inference:",
      "  preset:",
      "    name: microsoft/Phi-4-mini-instruct",
      "  config: phi-4-mini-inference-params  # tool calling",
    ], MX, 1.95, 6.7, 3.5, { size: 11.5, label: "models/deploy/workspace-phi-4-mini.yaml" });
    txt(s, "Add-on AKS « AI toolchain operator » (KAITO, projet CNCF Sandbox) : il provisionne le nœud GPU, lance vLLM et expose une API compatible OpenAI.",
      MX, 5.65, 6.5, 0.95, { size: 13, color: C.muted, lsm: 1.05 });
    const pts = [
      ["FaRoute", "Même passerelle, une route de plus", "Un AgentgatewayBackend « custom » vers le service du modèle. Les agents ne changent pas.", C.accent],
      ["FaShieldAlt", "Pas de filtres Foundry ici", "Seules les règles de la passerelle protègent ce modèle : JWT, regex, plafonds, webhook.", C.green],
      ["FaSearchDollar", "Le coût change de nature", "≈ 4,16 $/h le GPU A10 (Sweden Central), plus rien au token. Rentable au volume, pas pour trois chats.", C.yellow],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.95 + i * 1.62;
      card(s, 7.35, y, 5.4, 1.45, { fill: C.surf, line: pts[i][3] });
      await iconCircle(s, pts[i][0], 7.55, y + 0.35, 0.72, pts[i][3]);
      txt(s, pts[i][1], 8.45, y + 0.15, 4.15, 0.4, { face: H, size: 15, bold: true, color: C.white });
      txt(s, pts[i][2], 8.45, y + 0.56, 4.15, 0.85, { size: 12.5, color: C.muted, lsm: 1.05 });
    }
    s.addNotes(
      "Réponse à la question « et si on ne veut pas dépendre d'un fournisseur de modèles du tout ? ». " +
      "KAITO est un add-on managé AKS, documenté sur Microsoft Learn ; il sert des modèles ouverts (Phi, Mistral, Llama, gpt-oss) avec vLLM. " +
      "Un A10 suffit pour Phi-4-mini (3,8 milliards de paramètres) ; l'exemple officiel utilise un A100, plus cher. " +
      "Le message clé : sur un modèle auto-hébergé, il n'y a plus de filtres de contenu Foundry — la passerelle est le seul endroit où vivent les garde-fous. " +
      "Honnêteté coût : ≈ 3 000 $/mois allumé en continu, contre ≈ 18 $/mois d'inférence Foundry pour ce PoC. On l'allume pour la démo, on l'éteint après. " +
      "Limites documentées : GPU Ampere minimum, cluster Standard (pas Automatic), le pool GPU se supprime à la main."
    );
  }

  // ----------------------------------------------------------------- 23. Divider 05
  await divider("06", "Démonstrations", "Une vidéo, quatre démos live.",
    "[27:00] Vérifier que le terminal et LibreChat sont prêts AVANT de cliquer. Vidéos de secours ouvertes dans un onglet.");

  // ----------------------------------------------------------------- 24. Démo A
  {
    const s = newSlide();
    kicker(s, "DÉMO A");
    tag(s, "VIDÉO", C.muted);
    title(s, "La plateforme en un apply");
    code(s, [
      "$ make up",
      "",
      "# phase 1 — infrastructure",
      "module.foundation   AKS · OIDC · Workload ID · KAITO",
      "module.ai           Foundry · 3 déploiements",
      "module.identity     identités managées · apps Entra",
      "",
      "# phase 2 — plateforme",
      "module.platform     agentgateway · kagent",
      "                    LibreChat · Grafana",
    ], MX, 2.0, 6.9, 3.9, { size: 12.5, label: "terraform/" });
    const f = [
      ["FaLayerGroup", "Deux phases", "Les providers Helm et Kubernetes ont besoin d'un cluster qui existe."],
      ["FaLock", "Aucun secret dans le dépôt", "GitHub Actions s'authentifie à Azure par OIDC fédéré."],
      ["FaSearchDollar", "make down", "0,41 $ de l'heure : on détruit après chaque session."],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 2.05 + i * 1.3;
      await iconCircle(s, f[i][0], 7.9, y, 0.75);
      txt(s, f[i][1], 8.9, y, 3.8, 0.4, { face: H, size: 16, bold: true, color: C.white });
      txt(s, f[i][2], 8.9, y + 0.42, 3.8, 0.7, { size: 13, color: C.muted });
    }
    s.addNotes(
      "[27:00 — 30:00] Vidéo accélérée (le apply réel prend 15-20 min). Commenter par-dessus : " +
      "le module qui change par cloud, ce sont foundation, ai et identity. platform est le même partout. " +
      "Respiration possible : descendre à 1 minute si retard."
    );
  }

  // ----------------------------------------------------------------- 25. Démo B
  {
    const s = newSlide();
    kicker(s, "DÉMO B");
    tag(s, "LIVE", C.green);
    title(s, "Une équipe ajoute son agent — sans ticket");
    code(s, [
      "apiVersion: kagent.dev/v1alpha2",
      "kind: Agent",
      "metadata:",
      "  name: assistant-tickets",
      "  namespace: equipe-produit",
      "spec:",
      "  description: Trie les tickets Jira de l'équipe",
      "  type: Declarative",
      "  declarative:",
      "    modelConfig: passerelle-llm   # jamais un fournisseur",
      "    systemMessage: |",
      "      Tu aides l'équipe produit à trier ses tickets.",
      "    tools:",
      "      - type: McpServer",
      "        mcpServer:",
      "          apiGroup: kagent.dev",
      "          kind: MCPServer",
      "          name: jira-mcp",
      "          toolNames: [jira_search, jira_get_issue]",
    ], MX, 1.95, 7.3, 4.85, { size: 10.5, label: "demos/chalet/B-self-service/agent.yaml" });
    const steps = ["Une pull request, ou kubectl apply", "L'agent apparaît dans le catalogue", "Il est disponible dans LibreChat"];
    steps.forEach((t, i) => {
      const y = 2.05 + i * 0.85;
      s.addShape(pres.shapes.OVAL, { x: 8.3, y, w: 0.55, h: 0.55, fill: { color: C.deep }, line: { color: C.deep, width: 0 } });
      txt(s, String(i + 1), 8.3, y, 0.55, 0.55, { face: H, size: 15, bold: true, color: C.white, align: "center", valign: "middle" });
      txt(s, t, 9.05, y, 3.7, 0.55, { size: 15, color: C.text, valign: "middle" });
    });
    card(s, 8.3, 4.75, 4.45, 2.05, { fill: C.surf, line: C.green });
    txt(s, "L'agent pointe vers la passerelle, jamais vers un fournisseur.", 8.55, 4.9, 4.0, 0.8, { face: H, size: 15, bold: true, color: C.white });
    txt(s, "Ce manifeste est identique sur AKS, EKS ou Managed Kubernetes.", 8.55, 5.75, 4.0, 0.9, { size: 14, color: C.green });
    s.addNotes(
      "[30:00 — 36:00] LA démo : c'est le geste self-service. Pointer la ligne modelConfig : l'agent ne connaît pas le fournisseur. " +
      "Si la démo live échoue : basculer sur la vidéo B sans commenter l'échec plus de 5 secondes."
    );
  }

  // ----------------------------------------------------------------- 26. Démo C
  {
    const s = newSlide();
    kicker(s, "DÉMO C");
    tag(s, "LIVE", C.green);
    title(s, "L'antidote au week-end à 60 000 €");
    code(s, [
      "apiVersion: agentgateway.dev/v1alpha1",
      "kind: AgentgatewayPolicy",
      "metadata:",
      "  name: garde-fous-llm",
      "spec:",
      "  targetRefs:",
      "  - kind: HTTPRoute",
      "    name: llm",
      "  traffic:",
      "    jwtAuthentication:",
      "      mode: Strict            # pas de jeton Entra, pas d'accès",
      "    rateLimit:",
      "      local:",
      "      - tokens: 50000         # plafond de consommation",
      "        unit: Minutes",
      "  backend:",
      "    ai:",
      "      promptGuard:",
      "        request:",
      "        - regex:",
      "            action: Reject",
      "            builtins: [CreditCard]",
    ], MX, 1.95, 7.3, 4.9, { size: 10.5, label: "gateway/deploy/policies.yaml (simplifié)" });
    const eff = [
      ["FaIdCard", "Sans jeton Entra valide", "401 — l'appel n'atteint jamais le modèle."],
      ["FaShieldAlt", "Numéro de carte dans le prompt", "Rejeté avant le modèle, quel que soit le fournisseur."],
      ["FaTachometerAlt", "Plafond atteint", "429 — la dépense s'arrête d'elle-même."],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 2.0 + i * 1.2;
      await iconCircle(s, eff[i][0], 8.3, y, 0.7, C.green);
      txt(s, eff[i][1], 9.2, y, 3.6, 0.4, { face: H, size: 15, bold: true, color: C.white });
      txt(s, eff[i][2], 9.2, y + 0.4, 3.6, 0.6, { size: 13, color: C.muted });
    }
    txt(s, "En production : un budget par équipe via les virtual keys, adossées à un service de rate limit.", 8.3, 5.75, 4.45, 0.9, { size: 13, italic: true, color: C.accent });
    s.addNotes(
      "[36:00 — 41:00] Boucler avec le cold open : « Vendredi soir, avec ça, la clé fuit… et le lundi matin, on a une alerte, pas une facture. » " +
      "Honnêteté : le plafond local est par route ; le budget par équipe demande les virtual keys et un service de rate limit Redis."
    );
  }

  // ----------------------------------------------------------------- 27. Démo D
  {
    const s = newSlide();
    kicker(s, "DÉMO D");
    tag(s, "LIVE", C.green);
    title(s, "Changer de modèle sans toucher aux agents");
    code(s, [
      "apiVersion: agentgateway.dev/v1alpha1",
      "kind: AgentgatewayBackend",
      "metadata:",
      "  name: llm",
      "spec:",
      "  ai:",
      "    groups:",
      "    - providers:              # 1er choix",
      "      - name: foundry-gpt",
      "        azure:",
      "          resourceType: Foundry",
      "          projectName: proj-agentic",
      "          model: gpt-56-terra-eu",
      "    - providers:              # repli",
      "      - name: foundry-gpt5",
      "        azure:",
      "          resourceType: Foundry",
      "          projectName: proj-agentic",
      "          model: gpt-56-luna-eu",
      "    # - providers:            # hors Azure :",
      "    #   - name: bedrock       # un groupe de plus",
    ], MX, 1.95, 7.3, 4.9, { size: 10, label: "gateway/deploy/backend-llm.yaml" });
    const pts = [
      ["LIVE", "Terra → Luna, les deux en DataZone UE.", C.green],
      ["PARLÉ", "Bedrock ou OVHcloud : un groupe de plus dans le même manifeste.", C.muted],
      ["EFFET", "Les agents appellent toujours la même route. Ils ne savent pas qui répond.", C.accent],
    ];
    pts.forEach((p, i) => {
      const y = 2.05 + i * 1.45;
      s.addText(p[0], {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x: 8.3, y, w: 1.05, h: 0.34,
        line: { color: p[2], width: 1.25 }, fill: { color: C.bg },
        fontFace: H, fontSize: 9.5, bold: true, color: p[2], align: "center", valign: "middle", charSpacing: 2, margin: 0, isTextBox: true,
      });
      txt(s, p[1], 8.3, y + 0.45, 4.45, 0.85, { size: 15, color: C.text, lsm: 1.05 });
    });
    s.addNotes(
      "[41:00 — 46:00] Couper Terra (ou le saturer), montrer que LibreChat répond toujours — c'est Luna. " +
      "Puis dans Grafana : les tokens changent de ligne. Le cran hors Azure est montré, pas exécuté. " +
      "Champs azure (resourceName, resourceType: Foundry, projectName, model) validés contre le schéma et les règles CEL du CRD agentgateway v1.5.0 — projectName est obligatoire avec Foundry. " +
      "En live : ./demos/chalet/D-bascule/run.sh (coupe, montre x-served-model, rétablit)."
    );
  }

  // ----------------------------------------------------------------- 27-B. Démo E
  {
    const s = newSlide();
    kicker(s, "DÉMO E");
    tag(s, "LIVE", C.green);
    title(s, "Un modèle dans le cluster, les mêmes règles");
    code(s, [
      "apiVersion: agentgateway.dev/v1alpha1",
      "kind: AgentgatewayBackend",
      "metadata:",
      "  name: llm-aks",
      "spec:",
      "  ai:",
      "    provider:",
      "      host: workspace-phi-4-mini.models.svc.cluster.local",
      "      port: 80",
      "      custom:                  # auto-hébergé, compatible OpenAI",
      "        model: phi-4-mini-instruct",
      "        providerOverride: kaito # label dans Grafana",
      "        formats:",
      "        - type: Completions",
      "          path: /v1/chat/completions",
      "# + HTTPRoute /aks/v1 et les mêmes règles :",
      "#   JWT Entra · regex · plafond de tokens",
    ], MX, 1.95, 7.3, 4.6, { size: 11, label: "models/deploy/gateway.yaml" });
    const steps = [
      ["AVANT", "Workspace appliqué avant la session : le nœud GPU met jusqu'à 20 min.", C.muted],
      ["LIVE", "kubectl apply du Backend, puis « Hébergé dans AKS » dans LibreChat.", C.green],
      ["LIVE", "Même numéro de carte, même refus : la règle a suivi le trafic.", C.green],
      ["EFFET", "Dans Grafana, une ligne kaito à côté de Foundry. Au token : 0 $.", C.accent],
    ];
    steps.forEach((p, i) => {
      const y = 2.0 + i * 1.18;
      s.addText(p[0], {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x: 8.3, y, w: 1.05, h: 0.34,
        line: { color: p[2], width: 1.25 }, fill: { color: C.bg },
        fontFace: H, fontSize: 9.5, bold: true, color: p[2], align: "center", valign: "middle", charSpacing: 2, margin: 0, isTextBox: true,
      });
      txt(s, p[1], 8.3, y + 0.4, 4.45, 0.75, { size: 13.5, color: C.text, lsm: 1.05 });
    });
    s.addNotes(
      "Préparation : Workspace appliqué 30 min avant (kubectl get workspace -n models : ResourceReady et InferenceReady à True). " +
      "En live : 1) montrer le Backend — le fournisseur « custom » pointe vers le service du modèle, rien d'Azure dedans ; kubectl apply -k models/deploy. " +
      "2) LibreChat, endpoint « Hébergé dans AKS » : une question simple, la réponse vient du GPU du cluster. " +
      "3) Le même prompt avec un numéro de carte : même message de refus que sur Foundry — il n'y a pas de filtres Foundry ici, c'est la passerelle. " +
      "4) Grafana : gen_ai_system=\"kaito\" apparaît ; le panneau coût au token reste à 0 — le coût, c'est le GPU à l'heure. " +
      "Secours : vidéo E. Après la session : kubectl delete workspace et supprimer le pool GPU."
    );
  }

  // ----------------------------------------------------------------- 28. Grafana
  {
    const s = newSlide();
    kicker(s, "OBSERVABILITÉ");
    title(s, "Le même dashboard, quel que soit le cloud");
    const panels = [
      ["Tokens par seconde, par modèle", "sum by (gen_ai_response_model)\n  (rate(..._token_usage_sum[5m]))"],
      ["Coût par fournisseur", "sum by (gen_ai_system)\n  (llm:cost_eur:rate5m)"],
      ["Tokens par équipe", "sum by (team)\n  (increase(..._token_usage_sum[24h]))"],
      ["Erreurs par fournisseur", "rate(agentgateway_requests_total\n  {status=~\"5..\"}[5m])"],
    ];
    panels.forEach((p, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = MX + col * 4.25, y = 1.95 + row * 2.2, w = 4.05, h = 2.0;
      card(s, x, y, w, h);
      txt(s, p[0], x + 0.25, y + 0.2, w - 0.5, 0.4, { face: H, size: 14, bold: true, color: C.white });
      card(s, x + 0.25, y + 0.72, w - 0.5, 1.05, { fill: C.code, line: C.code });
      txt(s, p[1], x + 0.4, y + 0.82, w - 0.8, 0.9, { face: M, size: 10, color: C.accent });
    });
    txt(s, "Métriques OpenTelemetry GenAI natives", 9.2, 2.05, 3.55, 0.8, { face: H, size: 17, bold: true, color: C.white });
    txt(s, "agentgateway_gen_ai_client_token_usage porte gen_ai_response_model et gen_ai_system.", 9.2, 2.95, 3.55, 1.1, { size: 13, color: C.muted, lsm: 1.1 });
    txt(s, "Le label team est ajouté par une expression CEL. Les prix vivent dans une règle Prometheus versionnée.", 9.2, 4.15, 3.55, 1.3, { size: 13, color: C.muted, lsm: 1.1 });
    txt(s, "Utiliser le modèle servi, pas le modèle demandé : c'est lui qui est facturé après un repli.", 9.2, 5.5, 3.55, 1.0, { size: 13, italic: true, color: C.yellow });
    s.addNotes(
      "[46:00 — 47:00] Point FinOps. Le label gen_ai_response_model est celui qu'on facture : après une bascule, " +
      "le modèle demandé et le modèle servi diffèrent. Label team : attention à la cardinalité Prometheus à grande échelle. " +
      "Le modèle auto-hébergé apparaît avec gen_ai_system=\"kaito\" : ses métriques GPU (vLLM) sont à côté, via un PodMonitor."
    );
  }

  // ----------------------------------------------------------------- 29. Divider 06
  await divider("07", "Retour d'expérience", "Ce que je referais. Ce que je ne referais pas.",
    "[47:00] Dernière ligne droite : trois minutes.");

  // ----------------------------------------------------------------- 30. Marché / fait mal
  {
    const s = newSlide();
    kicker(s, "LE BILAN");
    title(s, "Ce qui a marché, ce qui a fait mal");
    const colW = 5.95;
    card(s, MX, 1.95, colW, 3.9, { fill: C.surf, line: C.green });
    await iconCircle(s, "FaCheck", MX + 0.3, 2.2, 0.65, C.green);
    txt(s, "Ce qui a marché", MX + 1.1, 2.25, 4.5, 0.55, { face: H, size: 19, bold: true, color: C.white, valign: "middle" });
    bullets(s, [
      "Un point d'entrée unique pour ~3 000 collaborateurs",
      "Des connecteurs SI réutilisables d'un projet à l'autre",
      "Des stacks IA standardisées, déployées par kagent",
      "Une gouvernance transverse, avec sa politique",
    ], MX + 0.35, 3.15, colW - 0.7, 3.2, { size: 15, psa: 12 });
    const x2 = MX + 6.18;
    card(s, x2, 1.95, colW, 3.9, { fill: C.surf, line: C.yellow });
    await iconCircle(s, "FaTools", x2 + 0.3, 2.2, 0.65, C.yellow);
    txt(s, "Ce qui a fait mal", x2 + 1.1, 2.25, 4.5, 0.55, { face: H, size: 19, bold: true, color: C.white, valign: "middle" });
    bullets(s, [
      "Une documentation qui bouge plus vite que les projets",
      "Des API en v1alpha1 : épingler chaque version",
      "L'attribution par équipe : aucun exemple officiel en mode Kubernetes",
      "Le transfert du jeton utilisateur par LibreChat : pas encore stable",
    ], x2 + 0.35, 3.15, colW - 0.7, 3.2, { size: 15, psa: 12 });
    s.addNotes(
      "[47:00 — 48:30] À COMPLÉTER : ajouter 1 ou 2 douleurs vécues chez le client (adoption, quotas, validation sécurité…). " +
      "Les points actuels à droite sont les douleurs techniques vérifiées sur le PoC."
    );
  }

  // ----------------------------------------------------------------- 31. Gouvernance
  {
    const s = newSlide();
    kicker(s, "GOUVERNANCE");
    title(s, "L'outil applique une politique. Il ne la remplace pas.");
    const q = [
      ["FaKey", "Qui a droit à quel modèle ?"],
      ["FaFileInvoiceDollar", "Quel budget pour quelle équipe ?"],
      ["FaUserSecret", "Quelles données vers quel outil ?"],
      ["FaUsers", "Qui crée, valide et retire un agent ?"],
    ];
    for (let i = 0; i < 4; i++) {
      const x = MX + i * 3.08, y = 2.2, w = 2.85, h = 2.8;
      card(s, x, y, w, h);
      await iconCircle(s, q[i][0], x + (w - 0.9) / 2, y + 0.35, 0.9, C.accent);
      txt(s, q[i][1], x + 0.2, y + 1.45, w - 0.4, 1.1, { face: H, size: 16, bold: true, color: C.white, align: "center" });
    }
    txt(s, "Chaque réponse est d'abord une décision de gouvernance — puis une ressource Kubernetes.", MX, 5.55, 12.1, 0.6, { face: H, size: 19, bold: true, color: C.accent });
    s.addNotes(
      "[48:30 — 49:15] Le client a mis en place une gouvernance transverse et une politique associée. " +
      "Message : sans elle, la plus belle passerelle applique des règles que personne n'a décidées."
    );
  }

  // ----------------------------------------------------------------- 32. Coût
  {
    const s = newSlide();
    kicker(s, "CE QUE ÇA COÛTE");
    title(s, "Le socle coûte peu. Ce qui coûte, c'est l'inférence sans limite.", { size: 28 });
    s.addChart(pres.charts.BAR, [{
      name: "USD / mois",
      labels: ["2 nœuds D4s_v5", "Plan de contrôle AKS (Free)"],
      values: [298, 0],
    }], {
      x: MX, y: 2.0, w: 6.9, h: 3.9, barDir: "bar",
      chartColors: [C.accent],
      showValue: true, dataLabelPosition: "outEnd", dataLabelColor: C.white, dataLabelFontSize: 13, dataLabelFormatCode: "0 \"$\"",
      catAxisLabelColor: C.text, catAxisLabelFontSize: 13, catAxisLabelFontFace: B,
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      catAxisLineShow: false, showLegend: false,
      valAxisMaxVal: 360,
    });
    txt(s, "La plateforme de ce PoC, en continu", MX, 1.72, 6.9, 0.35, { size: 13, color: C.muted, italic: true });

    // Les deux chiffres qui se répondent
    card(s, 7.9, 1.95, 4.85, 1.75, { fill: C.surf, line: C.green, lw: 1.5 });
    txt(s, "≈ 298 $", 8.15, 2.05, 4.4, 0.95, { face: H, size: 46, bold: true, color: C.green });
    txt(s, "par mois pour le compute du socle, plus l'inférence réellement consommée", 8.15, 3.0, 4.45, 0.65, { size: 13, color: C.text, lsm: 1.05 });

    card(s, 7.9, 3.9, 4.85, 1.75, { fill: C.surf, line: C.yellow, lw: 1.5 });
    txt(s, "60 000 €", 8.15, 4.0, 4.4, 0.95, { face: H, size: 46, bold: true, color: C.yellow });
    txt(s, "un seul week-end, une clé qui fuit, aucun plafond", 8.15, 4.95, 4.45, 0.65, { size: 13, color: C.text, lsm: 1.05 });

    txt(s, "Soit environ 200 mois de plateforme. La passerelle est l'assurance la moins chère du projet.", 7.9, 5.85, 4.85, 0.8, { face: H, size: 15, bold: true, color: C.white, lsm: 1.05 });
    txt(s, "Prix compute retail Azure, Sweden Central, 18/09/2026, hors disques, load balancer, logs et inférence. Vérifier le tarif des modèles dans Foundry.", MX, 6.4, 7.0, 0.5, { size: 10.5, color: C.dim });
    s.addNotes(
      "Le retour du cold open. À l'échelle d'un PoC, le compute du socle représente environ 298 $ par mois, avant inférence. " +
      "Mais à l'échelle de 3 000 personnes sans plafond, c'est l'inférence qui explose — le week-end à 60 000 € en est la preuve. " +
      "Donc : le compute du socle qui aurait évité l'incident coûte environ 300 $ par mois. Un seul week-end en a coûté l'équivalent de 200 mois. " +
      "Ordre de grandeur, pas un calcul au centime : 60 000 € ≈ 68 000 à 70 000 $ selon le taux de change. " +
      "Si on te demande : 0,41 $ de l'heure pour les deux nœuds, on détruit le cluster après chaque session ; le pool Spot (≈ -82 %) sert à construire, jamais en démo live."
    );
  }

  // ----------------------------------------------------------------- 33. À retenir
  {
    const s = newSlide();
    kicker(s, "À RETENIR");
    title(s, "Trois choses à emporter lundi matin");
    const t = [
      ["Un seul point de contrôle pour tous vos agents", "Identité, limites et traces à la passerelle — pas dans chaque projet."],
      ["Standardisez la plomberie, pas le fournisseur", "Gateway API et CRD : le cloud devient un adaptateur, le modèle une configuration."],
      ["Choisissez selon votre point de départ", "Un patrimoine d'API : regardez APIM. Une plateforme Kubernetes : regardez agentgateway."],
    ];
    t.forEach((it, i) => {
      const y = 2.0 + i * 1.45;
      txt(s, String(i + 1), MX, y, 0.9, 1.1, { face: H, size: 54, bold: true, color: C.deep });
      txt(s, it[0], MX + 1.1, y + 0.1, 11, 0.5, { face: H, size: 22, bold: true, color: C.white });
      txt(s, it[1], MX + 1.1, y + 0.62, 11, 0.5, { size: 16, color: C.muted });
    });
    s.addNotes("[49:45 — 50:00] Lire les trois titres, pas les sous-titres. Puis : « Merci. »");
  }

  // ----------------------------------------------------------------- 34. Merci
  {
    const s = newSlide({ footer: false });
    txt(s, "Merci !", MX, 1.5, 8, 1.4, { face: H, size: 72, bold: true, color: C.white });
    txt(s, "Questions ?", MX, 2.95, 8, 0.8, { face: H, size: 32, color: C.accent });
    card(s, MX, 4.2, 7.6, 1.6, { fill: C.surf, line: C.border });
    txt(s, "Le dépôt complet — Terraform, manifestes, dashboards, runbook de démo — est publié aujourd'hui.", MX + 0.3, 4.35, 7.0, 0.8, { size: 16, color: C.text, lsm: 1.1 });
    txt(s, "smartcloudarchitect.fr  ·  blog.smartcloudarchitect.fr", MX + 0.3, 5.2, 7.0, 0.45, { size: 16, bold: true, color: C.accent });
    s.addImage({ path: LOGO_PATH, x: MX, y: 6.15, w: 0.6 * LOGO_RATIO, h: 0.6, altText: "Logo Smart Cloud Architect" });
    txt(s, "Antoine LOIZEAU · Smart Cloud Architect", MX + 0.6 * LOGO_RATIO + 0.2, 6.25, 8, 0.4, { size: 14, color: C.muted });
    labels(s, [["portable", "true"], ["cloud", "any"]], { x: 9.4, y: 2.4, size: 24 });
    s.addNotes(
      "[50:00 — 60:00] Q&A. Questions probables : APIM (renvoyer au slide 16), coûts, maturité v1alpha1, " +
      "Entra Agent ID (GA avril 2026, sécurité étendue aux agents sous licence Agent 365 — ne pas démontrer), identité du client (jamais)."
    );
  }

  // ----------------------------------------------------------------- 13. Souveraineté = config
  {
    const s = newSlide();
    kicker(s, "ANNEXE · SOUVERAINETÉ");
    title(s, "La souveraineté devient une ligne de configuration");
    const cols = [
      ["GlobalStandard", "Traitement possible dans n'importe quelle région Azure du monde", C.yellow, "Le défaut"],
      ["DataZoneStandard", "Traitement uniquement dans la zone de données UE", C.green, "+10 %"],
      ["Standard", "Traitement dans la géographie Azure choisie", C.green, "+21 %"],
    ];
    for (let i = 0; i < 3; i++) {
      const x = MX + i * 2.85, y = 2.1, w = 2.65, h = 3.35;
      card(s, x, y, w, h, { line: cols[i][2], lw: 1.5 });
      txt(s, cols[i][0], x + 0.2, y + 0.3, w - 0.4, 0.4, { face: M, size: 13, bold: true, color: cols[i][2] });
      txt(s, cols[i][1], x + 0.2, y + 0.85, w - 0.4, 1.5, { size: 14, color: C.text, lsm: 1.1 });
      txt(s, cols[i][3], x + 0.2, y + 2.55, w - 0.4, 0.55, { face: H, size: 22, bold: true, color: cols[i][2] });
    }
    txt(s, "UE", 9.3, 2.1, 3.4, 1.3, { face: H, size: 72, bold: true, color: C.green });
    txt(s, "DataZone borne le traitement à la zone UE. Le prix dépend du modèle et doit être vérifié dans Foundry.", 9.3, 3.45, 3.45, 1.1, { size: 13, color: C.muted, lsm: 1.1 });
    txt(s, "« Global types: May be processed in any Azure region. »", 9.3, 4.65, 3.45, 0.8, { size: 13, italic: true, color: C.text });
    txt(s, "Sources : learn.microsoft.com — Foundry deployment types ; Azure Retail Prices API, Sweden Central, 18/09/2026. Surcoûts relatifs au prix Global.", MX, 5.8, 12.1, 0.5, { size: 11, color: C.dim });
    s.addNotes(
      "[14:00 — 15:30] Une minute trente, pas plus : c'est une conséquence du principe, pas le sujet. " +
      "Le défaut recommandé par Microsoft traite potentiellement hors UE. La case qui change ça coûte 10 %. " +
      "Et c'est une ligne de config dans le même manifeste."
    );
  }

  await pres.writeFile({ fileName: "plateforme-agentique-portable.pptx" });
  console.log("écrit :", slideNo, "slides");
})();
