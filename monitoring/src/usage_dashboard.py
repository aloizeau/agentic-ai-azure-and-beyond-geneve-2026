"""Generate the Grafana dashboard "Usage IA — utilisateurs, coûts, outils".

    python3 monitoring/src/usage_dashboard.py     # writes monitoring/dashboards/usage-ia.json

Every figure comes from agentgateway v1.5.0 Prometheus metrics, scraped from
both Gateways (internal and public) by kube-prometheus-stack:
  agentgateway_gen_ai_client_token_usage     histogram, tokens per request
  agentgateway_gen_ai_client_cost_usd_total  counter, USD (model price list)
  agentgateway_mcp_requests_total            counter, MCP calls (method, server, resource = tool)
  agentgateway_requests_total                counter, HTTP (status, route)
  agentgateway_guardrail_checks_total        counter, guardrails (phase, action)
  agentgateway_cost_catalog_lookups_total    counter, price lookups (status)
The labels user / team / agent are added by gateway/deploy/metrics.yaml.
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parents[1] / "dashboards" / "usage-ia.json"

DS = {"type": "prometheus", "uid": "${datasource}"}

# Filters shared by every query (dashboard variables, see VARIABLES below).
F = 'gateway=~"$porte", team=~"$equipe", user=~"$utilisateur"'
M = 'gen_ai_request_model=~"$deploiement"'
TOK = "agentgateway_gen_ai_client_token_usage"
COST = "agentgateway_gen_ai_client_cost_usd_total"
MCP = "agentgateway_mcp_requests_total"
REQ = "agentgateway_requests_total"
LLM_MCP_ROUTES = 'route=~".*(llm|mcp).*"'

_next_id = iter(range(1, 1000))


def target(expr, legend="", ref="A", instant=False, table=False):
    t = {"datasource": DS, "expr": expr, "refId": ref, "legendFormat": legend or "__auto"}
    if instant or table:
        t.update(instant=True, range=False)
    if table:
        t["format"] = "table"
    return t


def panel(kind, title, x, y, w, h, targets, description="", unit=None, decimals=None, **extra):
    p = {
        "id": next(_next_id),
        "type": kind,
        "title": title,
        "datasource": DS,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "targets": targets,
        "fieldConfig": {"defaults": {}, "overrides": []},
        "options": {},
    }
    if description:
        p["description"] = description
    if unit:
        p["fieldConfig"]["defaults"]["unit"] = unit
    if decimals is not None:
        p["fieldConfig"]["defaults"]["decimals"] = decimals
    for k, v in extra.items():
        if k == "defaults":
            p["fieldConfig"]["defaults"].update(v)
        elif k == "overrides":
            p["fieldConfig"]["overrides"] = v
        else:
            p[k] = v
    return p


def row(title, y):
    return {"id": next(_next_id), "type": "row", "title": title, "collapsed": False,
            "gridPos": {"x": 0, "y": y, "w": 24, "h": 1}, "panels": []}


def stat(title, x, y, w, expr, unit="short", decimals=0, description="", color="blue"):
    return panel(
        "stat", title, x, y, w, 4, [target(f"({expr}) or vector(0)", instant=True)], description, unit, decimals,
        defaults={"color": {"mode": "fixed", "fixedColor": color}},
        options={"reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                 "colorMode": "background", "graphMode": "none", "textMode": "value",
                 "justifyMode": "center", "orientation": "auto"},
    )


def timeseries(title, x, y, w, h, targets, unit, description="", stack=False):
    custom = {"drawStyle": "line", "lineWidth": 2, "fillOpacity": 18 if stack else 8,
              "showPoints": "never", "spanNulls": True,
              "stacking": {"mode": "normal" if stack else "none", "group": "A"}}
    return panel("timeseries", title, x, y, w, h, targets, description, unit,
                 defaults={"custom": custom, "color": {"mode": "palette-classic"}},
                 options={"legend": {"displayMode": "table", "placement": "right",
                                     "calcs": ["sum"] if unit == "currencyUSD" else ["mean", "max"]},
                          "tooltip": {"mode": "multi", "sort": "desc"}})


def bargauge(title, x, y, w, h, expr, legend, unit="short", decimals=0, description=""):
    return panel("bargauge", title, x, y, w, h, [target(expr, legend, instant=True)], description,
                 unit, decimals,
                 defaults={"color": {"mode": "continuous-BlPu"}, "min": 0},
                 options={"orientation": "horizontal", "displayMode": "gradient",
                          "valueMode": "color", "showUnfilled": True, "namePlacement": "left",
                          "sizing": "auto", "minVizHeight": 16, "maxVizHeight": 28,
                          "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False}})


def pie(title, x, y, w, h, expr, legend, unit="currencyUSD", description=""):
    return panel("piechart", title, x, y, w, h, [target(expr, legend, instant=True)], description,
                 unit, 2, defaults={"color": {"mode": "palette-classic"}},
                 options={"pieType": "donut", "displayLabels": ["percent"],
                          "legend": {"displayMode": "table", "placement": "right", "values": ["value", "percent"]},
                          "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
                          "tooltip": {"mode": "single"}})


def table(title, x, y, w, h, columns, keys, sort_by, description=""):
    """columns: [(header, expr, unit, decimals)], merged on the label columns `keys`."""
    refs = "ABCDEFGH"
    targets = [target(expr, ref=refs[i], table=True) for i, (_, expr, _, _) in enumerate(columns)]
    rename = {f"Value #{refs[i]}": header for i, (header, _, _, _) in enumerate(columns)}
    rename.update(keys)
    overrides = [
        {"matcher": {"id": "byName", "options": header},
         "properties": [{"id": "unit", "value": unit}, {"id": "decimals", "value": dec},
                        {"id": "custom.cellOptions", "value": {"type": "color-text"} if unit == "currencyUSD" else {"type": "auto"}}]}
        for header, _, unit, dec in columns
    ]
    return panel(
        "table", title, x, y, w, h, targets, description,
        defaults={"custom": {"align": "auto", "filterable": True},
                  "color": {"mode": "fixed", "fixedColor": "#0078D4"}},
        overrides=overrides,
        transformations=[
            {"id": "merge", "options": {}},
            {"id": "organize", "options": {"excludeByName": {"Time": True}, "renameByName": rename,
                                           "indexByName": {v: i for i, v in enumerate(list(keys.values()) + [c[0] for c in columns])}}},
        ],
        options={"showHeader": True, "cellHeight": "sm", "footer": {"show": True, "reducer": ["sum"], "countRows": False, "fields": ""},
                 "sortBy": [{"displayName": sort_by, "desc": True}]},
    )


def text(title, x, y, w, h, content):
    return panel("text", title, x, y, w, h, [], options={"mode": "markdown", "content": content})


def build():
    p = []
    y = 0

    # ----------------------------------------------------------------- overview
    p.append(row("Vue d'ensemble — sur la période sélectionnée", y)); y += 1
    p += [
        stat("Coût LLM", 0, y, 4, f"sum(increase({COST}{{{F}, {M}}}[$__range]))", "currencyUSD", 2,
             "Coût calculé par la passerelle à chaque réponse, avec la grille de prix gateway/deploy/model-costs.json (prix catalogue Global, USD par million de jetons).", "#0078D4"),
        stat("Projection 30 jours", 4, y, 4, f"sum(rate({COST}{{{F}, {M}}}[$__range])) * 2592000", "currencyUSD", 0,
             "Au rythme moyen de la période sélectionnée. Indicatif : une démo n'est pas une charge de production.", "#5C2D91"),
        stat("Jetons en entrée", 8, y, 3, f'sum(increase({TOK}_sum{{gen_ai_token_type="input", {F}, {M}}}[$__range]))', "short", 0, color="#50E6FF"),
        stat("Jetons en sortie", 11, y, 3, f'sum(increase({TOK}_sum{{gen_ai_token_type="output", {F}, {M}}}[$__range]))', "short", 0, color="#50E6FF"),
        stat("Utilisateurs actifs", 14, y, 4,
             f'count(sum by (user) (increase({TOK}_count{{gen_ai_token_type="input", user!~"anonyme|agent:.*|unknown", {F}, {M}}}[$__range])) > 0)',
             "short", 0, "Personnes (jeton Entra ID) ayant au moins une réponse LLM sur la période. Les agents (clé d'équipe) ne sont pas comptés.", "#107C10"),
        stat("Appels d'outils MCP", 18, y, 3, f'sum(increase({MCP}{{method="tools/call", {F}}}[$__range]))', "short", 0,
             "Appels tools/call passés par la passerelle (agents kagent + recherche web).", "#773ADC"),
        stat("Recherches web", 21, y, 3,
             f'sum(increase({MCP}{{method="tools/call", server="web-search", resource="search", {F}}}[$__range]))',
             "short", 0, "Recherches DuckDuckGo (outil search) via /mcp-web.", "#773ADC"),
    ]
    y += 4

    # ----------------------------------------------------------------- per user
    p.append(row("Par utilisateur", y)); y += 1
    by_user = "sum by (user, team)"
    p.append(table(
        "Consommation par utilisateur", 0, y, 14, 11,
        [
            ("Coût (USD)", f"{by_user} (increase({COST}{{{F}, {M}}}[$__range]))", "currencyUSD", 2),
            ("Requêtes LLM", f'{by_user} (increase({TOK}_count{{gen_ai_token_type="input", {F}, {M}}}[$__range]))', "short", 0),
            ("Jetons entrée", f'{by_user} (increase({TOK}_sum{{gen_ai_token_type="input", {F}, {M}}}[$__range]))', "short", 0),
            ("Jetons sortie", f'{by_user} (increase({TOK}_sum{{gen_ai_token_type="output", {F}, {M}}}[$__range]))', "short", 0),
            ("Appels d'outils", f'{by_user} (increase({MCP}{{method="tools/call", {F}}}[$__range]))', "short", 0),
        ],
        {"user": "Utilisateur", "team": "Équipe"},
        "Coût (USD)",
        "Une ligne par identité vue par la passerelle : personne (preferred_username Entra ID) ou agent d'équipe (« agent:<équipe> », clé virtuelle). « anonyme » = requêtes refusées avant authentification.",
    ))
    p.append(bargauge("Top 10 — jetons consommés", 14, y, 10, 11,
                      f"topk(10, sum by (user) (increase({TOK}_sum{{{F}, {M}}}[$__range])))", "{{user}}"))
    y += 11
    p.append(timeseries("Coût par utilisateur (USD / heure, top 10)", 0, y, 24, 8,
                        [target(f"topk(10, sum by (user) (rate({COST}{{{F}, {M}}}[$__rate_interval])) * 3600)", "{{user}}")],
                        "currencyUSD", stack=True))
    y += 8

    # --------------------------------------------------------- per team / model
    p.append(row("Par équipe et par modèle", y)); y += 1
    p += [
        pie("Coût par équipe", 0, y, 8, 9, f"sum by (team) (increase({COST}{{{F}, {M}}}[$__range]))", "{{team}}",
            description="« collaborateurs » = personnes via LibreChat ; les autres valeurs sont les équipes (clé virtuelle de leurs agents)."),
        pie("Coût par déploiement", 8, y, 8, 9, f"sum by (gen_ai_request_model) (increase({COST}{{{F}, {M}}}[$__range]))",
            "{{gen_ai_request_model}}",
            description="Déploiement Foundry réellement appelé : pendant une bascule (démo bascule) la part de gpt-56-luna-eu augmente."),
        table("Équipe × déploiement", 16, y, 8, 9,
              [("Coût (USD)", f"sum by (team, gen_ai_request_model) (increase({COST}{{{F}, {M}}}[$__range]))", "currencyUSD", 2),
               ("Jetons", f"sum by (team, gen_ai_request_model) (increase({TOK}_sum{{{F}, {M}}}[$__range]))", "short", 0)],
              {"team": "Équipe", "gen_ai_request_model": "Déploiement"}, "Coût (USD)"),
    ]
    y += 9
    p += [
        timeseries("Jetons par minute, par déploiement", 0, y, 12, 8,
                   [target(f"sum by (gen_ai_request_model, gen_ai_token_type) (rate({TOK}_sum{{{F}, {M}}}[$__rate_interval])) * 60",
                           "{{gen_ai_request_model}} · {{gen_ai_token_type}}")], "short", stack=True),
        timeseries("Latence LLM (p50 / p95) et premier jeton (p95)", 12, y, 12, 8,
                   [target(f"histogram_quantile(0.5, sum by (le) (rate(agentgateway_gen_ai_server_request_duration_bucket{{{F}, {M}}}[$__rate_interval])))", "durée p50", "A"),
                    target(f"histogram_quantile(0.95, sum by (le) (rate(agentgateway_gen_ai_server_request_duration_bucket{{{F}, {M}}}[$__rate_interval])))", "durée p95", "B"),
                    target(f"histogram_quantile(0.95, sum by (le) (rate(agentgateway_gen_ai_server_time_to_first_token_bucket{{{F}, {M}}}[$__rate_interval])))", "premier jeton p95", "C")],
                   "s"),
    ]
    y += 8

    # ------------------------------------------------------------------ tools
    p.append(row("Outils MCP", y)); y += 1
    calls = f'{MCP}{{method="tools/call", {F}}}'
    p += [
        bargauge("Outils appelés", 0, y, 8, 9, f"sum by (server, resource) (increase({calls}[$__range]))",
                 "{{server}} · {{resource}}",
                 description="Serveur MCP (cible du backend `mcp` de la passerelle) · outil."),
        bargauge("Agents sollicités (invoke_agent)", 8, y, 8, 9,
                 f'sum by (agent) (increase({MCP}{{method="tools/call", resource=~".*invoke_agent", agent!="-", {F}}}[$__range]))',
                 "{{agent}}",
                 description="Agent kagent demandé par l'outil invoke_agent (« <namespace>/<nom> »), lu dans les arguments de l'appel par la passerelle."),
        timeseries("Requêtes MCP par méthode (par minute)", 16, y, 8, 9,
                   [target(f"sum by (method) (rate({MCP}{{{F}}}[$__rate_interval])) * 60", "{{method}}")], "short", stack=True),
    ]
    y += 9
    p.append(table(
        "Qui utilise quels outils", 0, y, 24, 8,
        [("Appels", f"sum by (user, team, server, resource, agent) (increase({calls}[$__range]))", "short", 0)],
        {"user": "Utilisateur", "team": "Équipe", "server": "Serveur MCP", "resource": "Outil", "agent": "Agent"},
        "Appels",
    ))
    y += 8

    # ------------------------------------------------------------ web search
    # DuckDuckGo publié par la plateforme (gateway/deploy/web-search.yaml),
    # atteint par la passerelle sur /mcp-web : server="web-search", outils
    # search / fetch_content / expand_link.
    p.append(row("Recherche web (DuckDuckGo)", y)); y += 1
    web = f'{MCP}{{method="tools/call", server="web-search", {F}}}'
    p += [
        stat("Recherches", 0, y, 4,
             f'sum(increase({MCP}{{method="tools/call", server="web-search", resource="search", {F}}}[$__range]))',
             color="#773ADC",
             description="Appels de l'outil search (DuckDuckGo) via /mcp-web, jeton Entra ID."),
        stat("Pages récupérées", 4, y, 4,
             f'sum(increase({MCP}{{method="tools/call", server="web-search", resource="fetch_content", {F}}}[$__range]))',
             color="#773ADC",
             description="Appels fetch_content : récupération et extraction du contenu d'une page web."),
        stat("Utilisateurs de la recherche", 8, y, 4,
             f'count(sum by (user) (increase({MCP}{{method="tools/call", server="web-search", user!~"anonyme|unknown", {F}}}[$__range])) > 0)',
             color="#107C10",
             description="Personnes ayant lancé au moins une recherche web sur la période."),
        bargauge("Top 10 — recherche web par utilisateur", 12, y, 12, 4,
                 f"topk(10, sum by (user) (increase({web}[$__range])))", "{{user}}",
                 description="Appels d'outils DuckDuckGo (search, fetch_content, expand_link) par personne."),
    ]
    y += 4
    p += [
        timeseries("Recherche web par outil (par minute)", 0, y, 12, 7,
                   [target(f"sum by (resource) (rate({web}[$__rate_interval])) * 60", "{{resource}}")], "short", stack=True),
        timeseries("Recherche web par utilisateur (appels / minute, top 10)", 12, y, 12, 7,
                   [target(f"topk(10, sum by (user) (rate({web}[$__rate_interval])) * 60)", "{{user}}")], "short", stack=True),
    ]
    y += 7

    # ------------------------------------------------------- access and guardrails
    p.append(row("Accès et garde-fous", y)); y += 1
    g = 'gateway=~"$porte"'
    p += [
        stat("Refus d'authentification (401)", 0, y, 4,
             f'sum(increase({REQ}{{status="401", {LLM_MCP_ROUTES}, {g}}}[$__range]))', color="#D13438",
             description="Requêtes LLM ou MCP sans jeton Entra ID valide ni clé virtuelle (démo A)."),
        stat("Plafonds atteints (429)", 4, y, 4,
             f'sum(increase({REQ}{{status="429", {LLM_MCP_ROUTES}, {F}}}[$__range]))', color="#FF8C00",
             description="Limite de débit de la passerelle, ou quota Foundry renvoyé par le fournisseur."),
        stat("Réponses sans prix", 8, y, 4,
             f'sum(increase(agentgateway_cost_catalog_lookups_total{{status!="Exact", {F}}}[$__range]))', color="#8A8886",
             description="Réponses dont le modèle est absent de la grille de prix (model-costs.json) : leur coût n'est pas compté. À garder à 0."),
        bargauge("Garde-fous : contrôles par action", 12, y, 12, 4,
                 "sum by (phase, action) (increase(agentgateway_guardrail_checks_total[$__range]))", "{{phase}} · {{action}}",
                 description="Contrôles de contenu de la passerelle (regex carte bancaire, webhook NeMo si activé). Métrique sans libellé utilisateur."),
    ]
    y += 4
    p.append(timeseries("Réponses LLM et MCP par code HTTP (par minute)", 0, y, 24, 7,
                        [target(f"sum by (status) (rate({REQ}{{{LLM_MCP_ROUTES}, {F}}}[$__rate_interval])) * 60", "{{status}}")],
                        "short", stack=True))
    y += 7

    # ------------------------------------------------------------------ skills
    p.append(row("Skills", y)); y += 1
    p.append(text("Et les skills ?", 0, y, 24, 6, (
        "Les **skills** kagent (`Agent.spec.skills`) sont des dossiers d'instructions et de scripts chargés **dans l'agent** "
        "(image OCI ou dépôt Git, montés sous `/skills`). Leur exécution ne traverse pas le réseau : **la passerelle ne peut pas "
        "les voir**, et aucune métrique de ce tableau de bord ne les compte.\n\n"
        "Ce qui est mesuré à la place : le coût et les jetons des agents (libellé `team`, clé virtuelle), les agents appelés "
        "(`invoke_agent`) et les outils MCP qui passent par la passerelle. Pour suivre l'usage des skills, il faut instrumenter "
        "l'agent : traces OpenTelemetry de kagent (valeurs `otel.tracing` du chart) vers Azure Monitor / Application Insights, puis "
        "un tableau de bord sur les spans d'exécution."
    )))
    return p


VARIABLES = [
    {"name": "datasource", "label": "Source", "type": "datasource", "query": "prometheus",
     "current": {"text": "Prometheus", "value": "prometheus"}, "hide": 0},
    {"name": "porte", "label": "Porte", "type": "custom", "multi": True, "includeAll": True, "allValue": ".*",
     "query": "Interne : .*agentgateway-proxy,Publique : .*agentgateway-public",
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
    {"name": "equipe", "label": "Équipe", "type": "query", "datasource": DS, "multi": True, "includeAll": True,
     "allValue": ".*", "refresh": 2, "sort": 1,
     "definition": f"label_values({REQ}, team)", "query": {"query": f"label_values({REQ}, team)", "refId": "equipe"},
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
    {"name": "utilisateur", "label": "Utilisateur", "type": "query", "datasource": DS, "multi": True, "includeAll": True,
     "allValue": ".*", "refresh": 2, "sort": 1,
     "definition": f'label_values({REQ}{{team=~"$equipe"}}, user)',
     "query": {"query": f'label_values({REQ}{{team=~"$equipe"}}, user)', "refId": "utilisateur"},
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
    {"name": "deploiement", "label": "Déploiement", "type": "query", "datasource": DS, "multi": True, "includeAll": True,
     "allValue": ".*", "refresh": 2, "sort": 1,
     "definition": f"label_values({TOK}_count, gen_ai_request_model)",
     "query": {"query": f"label_values({TOK}_count, gen_ai_request_model)", "refId": "deploiement"},
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
]


def dashboard():
    return {
        "uid": "usage-ia",
        "title": "Usage IA — utilisateurs, coûts, outils",
        "description": "Consommation LLM, coût et outils MCP par utilisateur et par équipe, vus par agentgateway (les deux portes).",
        "tags": ["agentgateway", "llm", "finops", "mcp"],
        "timezone": "browser",
        "editable": True,
        "graphTooltip": 1,
        "refresh": "1m",
        "time": {"from": "now-24h", "to": "now"},
        "schemaVersion": 39,
        "version": 1,
        "links": [],
        "annotations": {"list": []},
        "templating": {"list": VARIABLES},
        "panels": build(),
    }


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dashboard(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(OUT.parents[2])}")
