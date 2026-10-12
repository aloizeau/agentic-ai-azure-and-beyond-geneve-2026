// =============================================================================
//  Charte et briques communes des decks (palette smartcloudarchitect.fr).
//  Utilisé par build-rex.js. build.js (deck Chalet Azure, 50 min) garde sa
//  copie historique des mêmes helpers.
// =============================================================================
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");

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
  red: "F87171",     // rejet, fuite
  violet: "A78BFA",  // agents
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

function createDeck({ title: deckTitle, footer: footerText, times = [] }) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Antoine LOIZEAU — Smart Cloud Architect";
  pres.title = deckTitle;
  pres.company = "Smart Cloud Architect";

  const iconCache = {};
  async function icon(name, color) {
    const key = name + color;
    if (iconCache[key]) return iconCache[key];
    if (!fa[name]) throw new Error(`icône inconnue : ${name}`);
    const svg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(fa[name], { color: "#" + color, size: 256 })
    );
    const buf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    iconCache[key] = "image/png;base64," + buf.toString("base64");
    return iconCache[key];
  }

  let slideNo = 0;
  function newSlide({ footer = true } = {}) {
    const s = pres.addSlide();
    slideNo++;
    const myNo = slideNo;
    const origNotes = s.addNotes.bind(s);
    s.addNotes = (n) => origNotes(`[${times[myNo] ?? "?"}] ` + n.replace(/^\[[^\]]*\]\s*/, ""));
    s.background = { color: C.bg };
    if (footer) {
      s.addImage({ path: LOGO_PATH, x: MX, y: 6.99, w: 0.3 * LOGO_RATIO, h: 0.3, altText: "Smart Cloud Architect" });
      s.addText(footerText, {
        x: MX + 0.3 * LOGO_RATIO + 0.15, y: 7.0, w: 8, h: 0.3, fontFace: B, fontSize: 9, color: C.dim, margin: 0, isTextBox: true,
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

  // Labels façon Kubernetes (clé: valeur), en monospace — le vocabulaire des CRD.
  function labels(s, pairs, { x, y, color = C.accent, size = 18, gap = 0.2 }) {
    const h = size / 72 * 1.9;
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

  function card(s, x, y, w, h, { fill = C.surf, line = C.surf2, lw = 1, dash } = {}) {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: line, width: lw, ...(dash ? { dashType: dash } : {}) },
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

  function arrow(s, x, y, w, h, color = C.muted, width = 1.75) {
    s.addShape(pres.shapes.LINE, {
      x, y, w, h, line: { color, width, endArrowType: "triangle" },
    });
  }

  function line(s, x, y, w, h, color = C.muted, width = 1.75, dash) {
    s.addShape(pres.shapes.LINE, { x, y, w, h, line: { color, width, ...(dash ? { dashType: dash } : {}) } });
  }

  function tag(s, text, color, x = W - MX - 1.2, y = 0.45) {
    s.addText(text, {
      shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, x, y, w: 1.2, h: 0.34,
      fill: { color }, line: { color, width: 0 },
      fontFace: H, fontSize: 10, bold: true, color: C.bg, align: "center", valign: "middle", charSpacing: 2, margin: 0,
      isTextBox: true,
    });
  }

  // Pastille de statut (contour, petites capitales)
  function pill(s, text, color, x, y, w = 1.05, h = 0.34) {
    s.addText(text, {
      shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, x, y, w, h,
      line: { color, width: 1.25 }, fill: { color: C.bg },
      fontFace: H, fontSize: 9.5, bold: true, color, align: "center", valign: "middle", charSpacing: 2, margin: 0, isTextBox: true,
    });
  }

  // Rond numéroté
  function num(s, n, x, y, d = 0.5, color = C.deep, size = 14) {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color }, line: { color, width: 0 } });
    txt(s, String(n), x, y, d, d, { face: H, size, bold: true, color: C.white, align: "center", valign: "middle" });
  }

  async function divider(n, heading, sub, notes, programme) {
    const s = newSlide({ footer: false });
    txt(s, n, MX, 1.6, 4, 2.0, { face: H, size: 140, bold: true, color: C.deep });
    const long = heading.length > 24;
    txt(s, heading, MX, 3.7, 8.6, long ? 1.6 : 1.0, { face: H, size: long ? 38 : 44, bold: true, color: C.white });
    txt(s, sub, MX, long ? 5.4 : 4.8, 8.6, 0.8, { size: 20, color: C.muted });
    labels(s, [["étape", n]], { x: 9.9, y: 3.0, size: 26 });
    if (programme) txt(s, "AU PROGRAMME · " + programme, 9.9, 4.1, 2.85, 1.2, { face: H, size: 11, bold: true, color: C.accent, cs: 1, lsm: 1.2 });
    s.addNotes(notes);
    return s;
  }

  return {
    pres, icon, newSlide, kicker, title, labels, card, iconCircle, txt, bullets, code, arrow, line, tag, pill, num, divider,
    count: () => slideNo,
  };
}

module.exports = { C, H, B, M, W, HGT, MX, LOGO_PATH, LOGO_RATIO, createDeck };
