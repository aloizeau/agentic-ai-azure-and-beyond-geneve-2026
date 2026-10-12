"""Tiny draw.io (mxGraph) writer with explicit geometry.

Every shape is placed with absolute coordinates; children of a container are
converted to relative coordinates at export time, so containers stay movable in
draw.io. Edges are straight segments through explicit waypoints
(edgeStyle=none) between fixed ports: the drawn path is exactly the one
designed, which is what lets render_check.py prove that no arrow crosses text.
"""
import base64
import html
import os
from xml.sax.saxutils import quoteattr

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = "Segoe UI"
TEXT = "#323130"

# --- Azure colour code (containers) ------------------------------------------
KINDS = {
    #            fill       stroke     dashed width  font colour
    "tenant":   ("#F5F5F5", "#737373", 1, 1.5, "#323130"),
    "sub":      ("#FFF9E1", "#E8B400", 0, 2.0, "#6B5200"),
    "rg":       ("#EEF6FD", "#0078D4", 0, 1.5, "#004E8C"),
    "vnet":     ("#F4FAF1", "#3C8527", 1, 1.5, "#2B5E1C"),
    "subnet":   ("#FFFFFF", "#3C8527", 1, 1.0, "#2B5E1C"),
    "aks":      ("#F5F0FD", "#773ADC", 0, 2.0, "#4B1FA0"),
    "ns":       ("#FFFFFF", "#773ADC", 1, 1.0, "#4B1FA0"),
    "ns-opt":   ("#FAFAFA", "#A98AE8", 1, 1.0, "#6E55A8"),
    "group":    ("#FFFFFF", "#8A8886", 0, 1.0, "#323130"),
    "external": ("#FFFFFF", "#8A8886", 1, 1.2, "#605E5C"),
    "lane":     ("#FAFAFA", "#C8C6C4", 0, 1.0, "#323130"),
    "github":   ("#F6F8FA", "#24292F", 0, 1.5, "#24292F"),
}

# --- flow styles ---------------------------------------------------------------
FLOWS = {
    #            colour     dashed   width  label (legend)
    "user":     ("#0078D4", "",      2.0, "Requête d'un collaborateur (jeton Entra ID)"),
    "agent":    ("#773ADC", "",      2.0, "Requête d'un agent (clé virtuelle d'équipe)"),
    "model":    ("#107C10", "",      2.0, "Appel modèle (Workload Identity, sans clé)"),
    "identity": ("#D83B01", "6 4",   1.5, "Identité : authentification, jetons, fédération"),
    "telemetry":("#8A8886", "2 3",   1.5, "Télémétrie : métriques, journaux"),
    "control":  ("#605E5C", "",      1.2, "Réconciliation / relation"),
    "deploy":   ("#24292F", "",      2.0, "Déploiement"),
    "optional": ("#8A8886", "8 4",   1.5, "Optionnel"),
    "reject":   ("#C50F1F", "",      1.5, "Rejet : la requête n'atteint jamais le modèle"),
    "lifeline": ("#A19F9D", "4 4",   1.0, "Ligne de vie"),
    "secret":   ("#8764B8", "",      2.0, "Clé virtuelle (secret Kubernetes)"),
    "response": ("#0078D4", "4 2",   1.5, "Réponse"),
}


def az(path):
    return f"img/lib/azure2/{path}"


def logo(name):
    with open(os.path.join(HERE, "logos", f"{name}.svg"), "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:image/svg+xml,{b64}"


class Diagram:
    def __init__(self, name, width, height, title=None, subtitle=None):
        self.name, self.width, self.height = name, width, height
        self.cells = []          # dicts, in z-order
        self.index = {}
        self.n = 0
        if title:
            self.text("title", 40, 22, 1400, 30,
                      f"<b>{html.escape(title)}</b>", size=22, color="#201F1E")
        if subtitle:
            self.text("subtitle", 40, 54, 1400, 20, html.escape(subtitle),
                      size=13, color="#605E5C")

    # ---------------------------------------------------------------- helpers
    def _id(self, prefix):
        self.n += 1
        return f"{prefix}{self.n}"

    def _add(self, cell):
        self.cells.append(cell)
        self.index[cell["id"]] = cell
        return cell["id"]

    # ------------------------------------------------------------- containers
    def box(self, cid, x, y, w, h, label, kind, parent=None, icon=None, sub=None):
        fill, stroke, dashed, sw, fc = KINDS[kind]
        style = (f"rounded=0;html=1;fillColor={fill};strokeColor={stroke};strokeWidth={sw};"
                 f"dashed={dashed};dashPattern=6 3;verticalAlign=top;align=left;"
                 f"spacingLeft={30 if icon else 8};spacingTop=3;fontFamily={FONT};fontSize=12;"
                 f"fontStyle=1;fontColor={fc};container=1;collapsible=0;recursiveResize=0;"
                 f"pointerEvents=0;")
        value = html.escape(label)
        if sub:
            value += f"<br><span style=\"font-weight:normal;font-size:10px;\">{html.escape(sub)}</span>"
        self._add(dict(id=cid, vertex=True, x=x, y=y, w=w, h=h, style=style,
                       value=value, parent=parent, container=True))
        if icon:
            self.image(f"{cid}_ico", x + 6, y + 5, 20, icon, "", parent=cid)
        return cid

    # ------------------------------------------------------------------ nodes
    def image(self, cid, x, y, size, src, label, parent=None, pos="bottom",
              size_h=None, opacity=100, font=11, bold_first=True):
        """An icon. `src` is an image URL/data URI, or ('k8s', prIcon)."""
        h = size_h or size
        if pos == "bottom":
            lp = "verticalLabelPosition=bottom;verticalAlign=top;labelPosition=center;align=center;"
        elif pos == "right":
            lp = "verticalLabelPosition=middle;verticalAlign=middle;labelPosition=right;align=left;spacingLeft=4;"
        elif pos == "left":
            lp = "verticalLabelPosition=middle;verticalAlign=middle;labelPosition=left;align=right;spacingRight=4;"
        else:  # top
            lp = "verticalLabelPosition=top;verticalAlign=bottom;labelPosition=center;align=center;"
        if isinstance(src, tuple) and src[0] == "k8s":
            style = (f"aspect=fixed;sketch=0;html=1;dashed=0;fillColor=#326CE5;strokeColor=#ffffff;"
                     f"points=[];shape=mxgraph.kubernetes.icon2;prIcon={src[1]};labelBackgroundColor=none;")
        elif isinstance(src, tuple) and src[0] == "shape":
            style = f"aspect=fixed;html=1;points=[];shape={src[1]};fillColor={src[2]};strokeColor=none;"
        else:
            style = f"image;aspect=fixed;html=1;points=[];image={src};imageBackground=none;labelBackgroundColor=none;"
        style += lp + f"fontFamily={FONT};fontSize={font};fontColor={TEXT};opacity={opacity};textOpacity=100;"
        value = ""
        if label:
            lines = label.split("\n")
            parts = []
            for i, ln in enumerate(lines):
                e = html.escape(ln)
                if i == 0 and bold_first:
                    parts.append(f"<b>{e}</b>")
                else:
                    parts.append(f"<span style=\"color:#605E5C;font-size:{font - 1}px;\">{e}</span>")
            value = "<br>".join(parts)
        return self._add(dict(id=cid, vertex=True, x=x, y=y, w=size, h=h,
                              style=style, value=value, parent=parent))

    def text(self, cid, x, y, w, h, value_html, size=11, color=TEXT, align="left",
             parent=None, valign="top", bold=False, fill=None, stroke=None, rounded=0,
             wrap=False):
        style = (f"text;html=1;{'whiteSpace=wrap;' if wrap else ''}align={align};verticalAlign={valign};fontFamily={FONT};"
                 f"fontSize={size};fontColor={color};spacing=2;")
        if bold:
            style += "fontStyle=1;"
        if fill or stroke:
            style = style.replace("text;", "")
            style += (f"rounded={rounded};arcSize=12;fillColor={fill or 'none'};"
                      f"strokeColor={stroke or 'none'};whiteSpace=wrap;spacing=8;")
        return self._add(dict(id=cid or self._id("t"), vertex=True, x=x, y=y, w=w, h=h,
                              style=style, value=value_html, parent=parent))

    def chip(self, cid, x, y, w, h, value_html, fill="#FFFFFF", stroke="#8A8886",
             color=TEXT, size=11, dashed=0, parent=None, bold=False, align="center"):
        style = (f"rounded=1;arcSize=18;html=1;whiteSpace=wrap;fillColor={fill};strokeColor={stroke};"
                 f"dashed={dashed};fontFamily={FONT};fontSize={size};fontColor={color};"
                 f"align={align};verticalAlign=middle;spacing=4;")
        if bold:
            style += "fontStyle=1;"
        return self._add(dict(id=cid or self._id("c"), vertex=True, x=x, y=y, w=w, h=h,
                              style=style, value=value_html, parent=parent, chip=True))

    def card(self, cid, x, y, w, h, icon, title, desc="", stroke="#8A8886", fill="#FFFFFF",
             dashed=0, parent=None, icon_size=32, opacity=100):
        """A capability card: icon on the left, bold title and description inside."""
        value = f"<b>{html.escape(title)}</b>"
        if desc:
            value += f"<br><span style=\"color:#605E5C;font-size:10px;\">{desc}</span>"
        style = (f"rounded=1;arcSize=10;absoluteArcSize=1;html=1;whiteSpace=wrap;fillColor={fill};"
                 f"strokeColor={stroke};strokeWidth=1.5;dashed={dashed};dashPattern=6 3;"
                 f"fontFamily={FONT};fontSize=11;fontColor={TEXT};align=left;verticalAlign=middle;"
                 f"spacingLeft={icon_size + 18 if icon else 10};spacingRight=6;opacity={opacity};")
        self._add(dict(id=cid, vertex=True, x=x, y=y, w=w, h=h, style=style, value=value,
                       parent=parent))
        if icon:
            self.image(f"{cid}_ico", x + 10, y + (h - icon_size) / 2, icon_size, icon, "",
                       parent=cid, opacity=opacity)
        return cid

    def badge(self, n, x, y, parent=None, color="#243A5E"):
        style = (f"ellipse;html=1;aspect=fixed;fillColor={color};strokeColor=#FFFFFF;strokeWidth=1.5;"
                 f"fontColor=#FFFFFF;fontStyle=1;fontSize=12;fontFamily={FONT};"
                 f"align=center;verticalAlign=middle;spacing=0;")
        return self._add(dict(id=self._id(f"badge{n}_"), vertex=True, x=x, y=y, w=24, h=24,
                              style=style, value=str(n), parent=parent))

    # ------------------------------------------------------------------ edges
    def edge(self, src, tgt, kind, points=(), exit=(1, 0.5), entry=(0, 0.5),
             start_arrow=False, end_arrow=True, cid=None):
        colour, dash, width, _ = FLOWS[kind]
        style = (f"edgeStyle=none;rounded=0;html=1;strokeColor={colour};strokeWidth={width};"
                 f"endArrow={'block' if end_arrow else 'none'};endFill=1;endSize=6;"
                 f"startArrow={'block' if start_arrow else 'none'};startFill=1;startSize=6;"
                 f"exitX={exit[0]};exitY={exit[1]};exitDx=0;exitDy=0;exitPerimeter=0;"
                 f"entryX={entry[0]};entryY={entry[1]};entryDx=0;entryDy=0;entryPerimeter=0;"
                 f"jumpStyle=none;")
        if dash:
            style += f"dashed=1;dashPattern={dash};"
        return self._add(dict(id=cid or self._id("e"), edge=True, source=src, target=tgt,
                              style=style, points=list(points)))

    def legend(self, x, y, kinds, cols=1, col_w=330, title="Légende"):
        self.text("legend_title", x, y, 200, 20, f"<b>{title}</b>", size=12)
        for i, k in enumerate(kinds):
            cx = x + (i % cols) * col_w
            cy = y + 28 + (i // cols) * 22
            colour, dash, width, label = FLOWS[k]
            a = self.text(None, cx, cy, 1, 1, "")
            b = self.text(None, cx + 44, cy, 1, 1, "")
            self.edge(a, b, k, exit=(0.5, 0.5), entry=(0.5, 0.5))
            self.text(None, cx + 54, cy - 9, col_w - 60, 18, html.escape(label), size=11)

    def steps(self, x, y, w, items, cols=1, col_w=None, title="Étapes"):
        col_w = col_w or w
        self.text("steps_title", x, y, 200, 20, f"<b>{title}</b>", size=12)
        per_col = -(-len(items) // cols)
        for i, (n, txt) in enumerate(items):
            c, r = divmod(i, per_col)
            bx = x + c * col_w
            by = y + 28 + r * 34
            self.badge(n, bx, by)
            self.text(None, bx + 32, by - 3, col_w - 44, 32, txt, size=11, wrap=True)

    # ------------------------------------------------------------------ export
    def _abs(self, cid):
        c = self.index[cid]
        return c["x"], c["y"]

    def xml(self):
        out = []
        for c in self.cells:
            pid = c.get("parent") or "1"
            if c.get("vertex"):
                x, y = c["x"], c["y"]
                if pid != "1":
                    px, py = self._abs(pid)
                    x, y = x - px, y - py
                out.append(
                    f'<mxCell id="{c["id"]}" value={quoteattr(c["value"])} style={quoteattr(c["style"])} '
                    f'vertex="1" parent="{pid}"><mxGeometry x="{x}" y="{y}" width="{c["w"]}" '
                    f'height="{c["h"]}" as="geometry"/></mxCell>')
            else:
                pts = "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in c["points"])
                pts = f'<Array as="points">{pts}</Array>' if pts else ""
                out.append(
                    f'<mxCell id="{c["id"]}" value="" style={quoteattr(c["style"])} edge="1" '
                    f'parent="1" source="{c["source"]}" target="{c["target"]}">'
                    f'<mxGeometry relative="1" as="geometry">{pts}</mxGeometry></mxCell>')
        body = "".join(out)
        return (f'<mxfile host="drawio" agent="docs/architecture/src/generate.py">'
                f'<diagram id="{self.name}" name="{html.escape(self.name)}">'
                f'<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" '
                f'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{self.width}" '
                f'pageHeight="{self.height}" background="#FFFFFF" math="0" shadow="0">'
                f'<root><mxCell id="0"/><mxCell id="1" parent="0"/>{body}</root>'
                f'</mxGraphModel></diagram></mxfile>')

    def save(self, folder):
        path = os.path.join(folder, f"{self.name}.drawio")
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.xml())
        return path
