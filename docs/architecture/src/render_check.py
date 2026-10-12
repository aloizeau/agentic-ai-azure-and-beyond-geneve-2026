"""Render .drawio files to PNG and check that no arrow crosses text or icons.

Needs a checkout of https://github.com/jgraph/drawio (for the static viewer,
the stencils and the Azure icon library) and Playwright with Chromium:

    git clone --depth 1 https://github.com/jgraph/drawio /tmp/drawio
    python render_check.py --drawio /tmp/drawio ../*.drawio --png ../png

Exit code 1 if any edge segment crosses a label, an icon or a badge that is
not its own source or target shape.
"""
import argparse
import functools
import http.server
import json
import os
import shutil
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

PAGE = r"""<!doctype html><html><head><meta charset="utf-8">
<style>body{margin:0;background:#fff;font-family:'Segoe UI',Helvetica,Arial,sans-serif}</style>
<script>window.STENCIL_PATH='stencils';window.GRAPH_IMAGE_PATH='img';window.IMAGE_PATH='images';
window.DRAWIO_BASE_URL='.';window.DRAWIO_VIEWER_URL='.';</script>
<script src="js/viewer-static.min.js"></script></head>
<body><div id="c"></div></body></html>"""

CHECK_JS = r"""
(xml) => new Promise((resolve) => {
  const doc = mxUtils.parseXml(xml);
  const node = doc.documentElement;
  const container = document.getElementById('c');
  const viewer = new GraphViewer(container, node, {highlight:'none', nav:false, lightbox:false,
      toolbar:null, border:20, zoom:1, 'auto-fit':false, resize:false, center:false});
  const graph = viewer.graph;
  setTimeout(() => {
    const model = graph.model, view = graph.view;
    const obst = [];
    for (const id in model.cells) {
      const c = model.cells[id];
      const st = view.getState(c);
      if (!st || !c.vertex) continue;
      const s = st.style || {};
      const isCont = s.container == 1 || s.container == '1';
      const isText = (c.style||'').startsWith('text;');
      const hasValue = c.value && String(c.value).replace(/<[^>]*>/g,'').trim() !== '';
      if (!isCont && !isText)
        obst.push({id, kind:'shape', r:[st.x, st.y, st.width, st.height]});
      if (hasValue && st.text && st.text.boundingBox) {
        const b = st.text.boundingBox;
        obst.push({id, kind:'label', r:[b.x, b.y, b.width, b.height]});
      }
    }
    const hits = [];
    const edges = [];
    function segHits(p, q, r) {
      // Liang-Barsky, rectangle shrunk by 1px
      let [x, y, w, h] = r; x += 1; y += 1; w -= 2; h -= 2;
      if (w <= 0 || h <= 0) return false;
      let t0 = 0, t1 = 1; const dx = q.x - p.x, dy = q.y - p.y;
      const P = [-dx, dx, -dy, dy], Q = [p.x - x, x + w - p.x, p.y - y, y + h - p.y];
      for (let i = 0; i < 4; i++) {
        if (P[i] === 0) { if (Q[i] < 0) return false; }
        else { const t = Q[i] / P[i];
          if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
          else { if (t < t0) return false; if (t < t1) t1 = t; } }
      }
      return t0 <= t1;
    }
    for (const id in model.cells) {
      const c = model.cells[id];
      if (!c.edge) continue;
      const st = view.getState(c);
      if (!st || !st.absolutePoints) continue;
      const pts = st.absolutePoints.filter(Boolean);
      edges.push({id, pts: pts.map(p => [p.x, p.y])});
      const own = new Set([c.source && c.source.id, c.target && c.target.id]);
      for (let i = 0; i < pts.length - 1; i++) {
        for (const o of obst) {
          if (o.kind === 'shape' && own.has(o.id)) continue;
          if (segHits(pts[i], pts[i+1], o.r)) hits.push({edge:id, source:c.source&&c.source.id,
              target:c.target&&c.target.id, obstacle:o.id, kind:o.kind, seg:i});
        }
      }
    }
    const b = graph.getGraphBounds();
    resolve({hits, obst, edges, bounds:[b.x, b.y, b.width, b.height]});
  }, 1500);
})
"""

DEBUG_JS = r"""
(data) => { const svg = document.querySelector('#c svg').querySelector('g');
  const ns = 'http://www.w3.org/2000/svg';
  for (const o of data.obst) { const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', o.r[0]); r.setAttribute('y', o.r[1]); r.setAttribute('width', o.r[2]);
    r.setAttribute('height', o.r[3]); r.setAttribute('fill', 'none');
    r.setAttribute('stroke', o.kind === 'label' ? 'red' : 'orange'); r.setAttribute('stroke-width', '0.7');
    svg.appendChild(r); } }
"""


def serve(root):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=root)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--drawio", default="/tmp/drawio")
    ap.add_argument("--png", default=None, help="folder for PNG exports")
    ap.add_argument("--debug", action="store_true", help="draw obstacle boxes on the PNG")
    ap.add_argument("--scale", type=float, default=2.0)
    args = ap.parse_args()

    webapp = os.path.join(args.drawio, "src", "main", "webapp")
    with open(os.path.join(webapp, "_render.html"), "w") as f:
        f.write(PAGE)
    httpd = serve(webapp)
    port = httpd.server_address[1]
    failed = False
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for path in args.files:
            xml = open(path, encoding="utf-8").read()
            page = browser.new_page(viewport={"width": 2400, "height": 1800},
                                    device_scale_factor=args.scale)
            page.goto(f"http://127.0.0.1:{port}/_render.html")
            page.wait_for_function("typeof GraphViewer !== 'undefined'")
            data = page.evaluate(CHECK_JS, xml)
            name = os.path.splitext(os.path.basename(path))[0]
            hits = data["hits"]
            status = "OK" if not hits else f"{len(hits)} collision(s)"
            print(f"{name}: {status}")
            for h in hits:
                print("   ", json.dumps(h))
            failed |= bool(hits)
            if args.png:
                os.makedirs(args.png, exist_ok=True)
                if args.debug:
                    page.evaluate(DEBUG_JS, data)
                box = page.locator("#c svg").bounding_box()
                page.screenshot(path=os.path.join(args.png, f"{name}.png"),
                                clip={"x": box["x"], "y": box["y"],
                                      "width": box["width"] + 20, "height": box["height"] + 20})
            page.close()
        browser.close()
    httpd.shutdown()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
