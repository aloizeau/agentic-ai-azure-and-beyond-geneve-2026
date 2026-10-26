"""Generate the Grafana dashboard "Garde-fous — déclenchements par équipe, règle, profil".

    python3 monitoring/src/guardrails_dashboard.py     # writes monitoring/dashboards/garde-fous.json

Goal: when a guardrail fires, see at once WHO triggers WHICH rule, on WHICH profile, so you can
decide whether to adapt the rails for one application or agent (new profile, tuned regex, dedicated
route) or whether the rule is doing its job.

Sources (Prometheus):
  guardrail_adapter_decisions_total{direction,action,rail,profile,team,model,source}   NeMo adapter, layer 2
  guardrail_adapter_errors_total{direction,profile}                             rail engine failures
  guardrail_adapter_check_duration_seconds_bucket{direction,backend}            engine latency
  agentgateway_guardrail_checks_total{phase,action}                             gateway, layer 1 + webhook
  agentgateway_requests_total{status,route,user,team}                           gateway, 403 / 5xx per route
`team` on the adapter metrics comes from the `x-team` header set by guardrails/deploy/gateway/guardrail-policies.yaml
(same expression as gateway/deploy/metrics.yaml). Per-person detail is in the adapter logs, not in labels.
"""
import json
import pathlib

from usage_dashboard import DS, bargauge, panel, pie, row, stat, table, target, text, timeseries

OUT = pathlib.Path(__file__).resolve().parents[1] / "dashboards" / "garde-fous.json"

# Source des messages bloqués : journaux de l'adaptateur dans Log Analytics (ContainerLogV2),
# lus par la source Azure Monitor que Terraform déclare dans Grafana (uid ci-dessous).
# Terraform remplace __LOG_ANALYTICS_WORKSPACE_ID__ par l'identifiant du workspace.
AZ = {"type": "grafana-azure-monitor-datasource", "uid": "azure-loganalytics"}
WORKSPACE = "__LOG_ANALYTICS_WORKSPACE_ID__"
# Colonnes accentuées : KQL les veut entre ['…'] (un identifiant nu accentué est une erreur de syntaxe).
BLOCKED_KQL = "\n".join([
    "ContainerLogV2",
    '| where PodNamespace == "agentgateway-system" and PodName startswith "guardrail-adapter"',
    "| where $__timeFilter(TimeGenerated)",
    "| extend m = parse_json(tostring(LogMessage))",
    '| where tostring(m.event) == "guardrail_block"',
    '| where tostring(m.team) matches regex "^${equipe:regex}$" and tostring(m.profile) matches regex "^${profil:regex}$"',
    '    and tostring(m.source) matches regex "^${source:regex}$" and tostring(m.direction) matches regex "^${direction:regex}$"',
    '    and tostring(m.rail) matches regex "^${regle:regex}$"',
    "| project Heure = TimeGenerated, ['Décision'] = tostring(m.decision), Sens = tostring(m.direction),",
    "    ['Mécanisme'] = tostring(m.source), ['Règle'] = tostring(m.rail), ['Équipe'] = tostring(m.team),",
    "    Utilisateur = tostring(m.user), Profil = tostring(m.profile), ['Modèle'] = tostring(m.model),",
    "    ['Concerné'] = iff(isempty(tostring(m.where)), \"message utilisateur\", tostring(m.where)),",
    "    Message = tostring(m.preview)",
    "| order by Heure desc",
    "| take 200",
])

DEC = "guardrail_adapter_decisions_total"
ERR = "guardrail_adapter_errors_total"
DUR = "guardrail_adapter_check_duration_seconds"
GCHK = "agentgateway_guardrail_checks_total"
REQ = "agentgateway_requests_total"
LLM = 'route=~".*llm.*"'

F = 'team=~"$equipe", profile=~"$profil", direction=~"$direction", source=~"$source", rail=~"$regle"'
FE = 'profile=~"$profil", direction=~"$direction"'          # errors carry no team / rail
BLOCK = 'action=~"reject|mask"'


def build():
    p = []
    y = 0

    # ----------------------------------------------------------------- overview
    p.append(row("Vue d'ensemble — adaptateur NeMo (couche 2), sur la période sélectionnée", y)); y += 1
    p += [
        stat("Contrôles", 0, y, 4, f"sum(increase({DEC}{{{F}}}[$__range]))", "short", 0,
             "Décisions rendues à la passerelle par l'adaptateur (une par requête et par sens : entrée / sortie).", "#0078D4"),
        stat("Refus", 4, y, 4, f'sum(increase({DEC}{{action="reject", {F}}}[$__range]))', "short", 0,
             "Requêtes rejetées avant le modèle (HTTP 403), ou 503 si le moteur est en panne (règle « engine-error »).", "#D13438"),
        stat("Masquages", 8, y, 4, f'sum(increase({DEC}{{action="mask", {F}}}[$__range]))', "short", 0,
             "Contenu réécrit (entrée) ou réponse remplacée par le texte de refus (sortie : le contrat n'a pas de Reject).", "#FF8C00"),
        stat("Taux de blocage", 12, y, 4,
             f"100 * sum(increase({DEC}{{{BLOCK}, {F}}}[$__range])) / sum(increase({DEC}{{{F}}}[$__range]))",
             "percent", 1, "Refus + masquages / contrôles. Un taux qui monte pour UNE équipe : regarder sa règle dominante ci-dessous.", "#5C2D91"),
        stat("Erreurs du moteur", 16, y, 4, f"sum(increase({ERR}{{{FE}}}[$__range]))", "short", 0,
             "Le moteur NeMo a échoué (exception, délai). FAIL_MODE=closed : ces requêtes sont refusées. Doit rester à 0.", "#D13438"),
        stat("Latence p95 du moteur", 20, y, 4,
             f"histogram_quantile(0.95, sum by (le) (increase({DUR}_bucket{{direction=~\"$direction\"}}[$__range])))",
             "s", 3, "Temps passé dans le moteur de règles. Le webhook coupe à 3 s (FailClosed).", "#107C10"),
    ]
    y += 4

    # --------------------------------------------------------- who stopped the request
    p.append(row("Qui a arrêté la requête ? — mécanisme, puis règle", y)); y += 1
    p += [
        pie("Refus + masquages par mécanisme", 0, y, 6, 9, f"sum by (source) (increase({DEC}{{{BLOCK}, {F}}}[$__range]))",
            "{{source}}", unit="short",
            description="Qui a décidé : adapter = contrôles Python de l'adaptateur (carte Luhn, secrets dans un message d'outil) ; "
                        "nemo-regex = règles regex du profil (clés, IBAN, NIR) ; nemo-injection = YARA ; nemo-llm = auto-contrôle par un modèle ; "
                        "moteur = panne du moteur (pas un contenu)."),
        table("Mécanisme × règle", 6, y, 10, 9,
              [("Refus", f'sum by (source, rail) (increase({DEC}{{action="reject", {F}}}[$__range]))', "short", 0),
               ("Masquages", f'sum by (source, rail) (increase({DEC}{{action="mask", {F}}}[$__range]))', "short", 0)],
              {"source": "Mécanisme", "rail": "Règle"}, "Refus",
              "Le nom de la règle est celui rapporté par NeMo (flow) ou par l'adaptateur. NeMo ne dit pas QUEL motif d'un regex_detection a "
              "correspondu : pour le savoir, rejouer le cas (journaux de l'adaptateur : équipe, utilisateur, règle)."),
        bargauge("Couche 1 — regex native de la passerelle", 16, y, 8, 9,
                 f"sum by (phase, action) (increase({GCHK}[$__range]))", "{{phase}} · {{action}}",
                 description="Contrôles faits par la passerelle elle-même avant le webhook (carte bancaire) et appels au webhook. "
                             "Un refus ici n'apparaît PAS dans les métriques de l'adaptateur. Sans libellé équipe."),
    ]
    y += 9
    p.append(timeseries("Refus + masquages par minute, par mécanisme", 0, y, 24, 7,
                        [target(f"sum by (source) (rate({DEC}{{{BLOCK}, {F}}}[$__rate_interval])) * 60", "{{source}}")], "short", stack=True,
                        description="Un changement de mécanisme (ex. nemo-regex qui monte alors que adapter reste stable) oriente l'analyse : "
                                    "règle YAML du profil ou contrôle Python de l'adaptateur."))
    y += 7

    # --------------------------------------------------------------- blocked messages
    p.append(row("Messages bloqués — ce que l'utilisateur a demandé (texte masqué)", y)); y += 1
    blocked = panel(
        "table", "Derniers messages bloqués ou masqués", 0, y, 24, 12,
        [{"datasource": AZ, "refId": "A", "queryType": "Azure Log Analytics",
          "azureLogAnalytics": {"query": BLOCKED_KQL, "resources": [WORKSPACE], "resultFormat": "table"}}],
        "Une ligne par refus ou masquage, avec le mécanisme et la règle qui ont décidé, l'équipe, l'utilisateur et le début du message. "
        "Le texte est MASQUÉ avant d'être écrit (secrets → [SECRET], suites de 6 chiffres ou plus → [NUM], jetons opaques → [JETON]) "
        "et tronqué à 300 caractères : la donnée qui a déclenché la règle n'est jamais recopiée. "
        "Source : journaux de l'adaptateur dans Log Analytics (quelques minutes de délai d'ingestion), actif si LOG_BLOCKED_CONTENT=true.",
        defaults={"custom": {"align": "auto", "filterable": True, "cellOptions": {"type": "auto", "wrapText": True}}},
        overrides=[{"matcher": {"id": "byName", "options": "Message"}, "properties": [{"id": "custom.width", "value": 520}]},
                   {"matcher": {"id": "byName", "options": "Heure"}, "properties": [{"id": "unit", "value": "dateTimeAsLocal"}, {"id": "custom.width", "value": 170}]}],
        options={"showHeader": True, "cellHeight": "md", "sortBy": [{"displayName": "Heure", "desc": True}]},
    )
    blocked["datasource"] = AZ          # panneau lu dans Log Analytics, pas dans Prometheus
    p.append(blocked)
    y += 12

    # ----------------------------------------------------------- who triggers what
    p.append(row("Qui déclenche quoi — où faut-il adapter ?", y)); y += 1
    by = "sum by (team, source, rail, profile, direction)"
    p.append(table(
        "Déclenchements par équipe × mécanisme × règle × profil", 0, y, 16, 11,
        [
            ("Refus", f'{by} (increase({DEC}{{action="reject", {F}}}[$__range]))', "short", 0),
            ("Masquages", f'{by} (increase({DEC}{{action="mask", {F}}}[$__range]))', "short", 0),
        ],
        {"team": "Équipe", "source": "Mécanisme", "rail": "Règle", "profile": "Profil", "direction": "Sens"},
        "Refus",
        "Une ligne = une règle qui s'est déclenchée pour une équipe. « collaborateurs » = personnes (LibreChat) ; "
        "« <équipe> » = agents (clé virtuelle) ; « - » = la passerelle n'a pas transmis l'en-tête x-team.",
    ))
    p.append(bargauge("Top règles déclenchées", 16, y, 8, 11,
                      f"topk(10, sum by (rail) (increase({DEC}{{{BLOCK}, {F}}}[$__range])))", "{{rail}}",
                      description="Règle de l'adaptateur ou de NeMo qui a refusé / masqué. « engine-error » = panne du moteur, pas une règle de contenu."))
    y += 11

    ratio = table(
        "Taux de blocage par équipe", 0, y, 12, 8,
        [
            ("Contrôles", f"sum by (team) (increase({DEC}{{{F}}}[$__range]))", "short", 0),
            ("Refus + masquages", f"sum by (team) (increase({DEC}{{{BLOCK}, {F}}}[$__range]))", "short", 0),
            ("Taux de blocage", f"100 * sum by (team) (increase({DEC}{{{BLOCK}, {F}}}[$__range])) / sum by (team) (increase({DEC}{{{F}}}[$__range]))",
             "percent", 1),
        ],
        {"team": "Équipe"}, "Taux de blocage",
        "Un taux élevé n'est pas forcément un défaut : c'est un point de départ. Comparer avec la règle dominante "
        "(tableau du dessus) avant de toucher aux rails.",
    )
    ratio["options"]["footer"]["show"] = False          # une somme de pourcentages n'a pas de sens
    p.append(ratio)
    p.append(bargauge("Refus + masquages par modèle", 12, y, 6, 8,
                      f"sum by (model) (increase({DEC}{{{BLOCK}, {F}}}[$__range]))", "{{model}}",
                      description="Modèle demandé par le client (en-tête x-model). Utile pour repérer un déploiement ou un agent qui change de comportement."))
    p.append(pie("Décisions par action", 18, y, 6, 8, f"sum by (action) (increase({DEC}{{{F}}}[$__range]))", "{{action}}",
                 unit="short", description="pass = laissé passer, reject = refusé, mask = réécrit."))
    y += 8

    p += [
        timeseries("Refus + masquages par minute, par règle", 0, y, 12, 8,
                   [target(f"sum by (rail) (rate({DEC}{{{BLOCK}, {F}}}[$__rate_interval])) * 60", "{{rail}}")], "short", stack=True,
                   description="Un pic sur UNE règle = une nouvelle source de données sensibles (ou un faux positif après un changement de prompt)."),
        timeseries("Refus + masquages par minute, par équipe", 12, y, 12, 8,
                   [target(f"sum by (team) (rate({DEC}{{{BLOCK}, {F}}}[$__rate_interval])) * 60", "{{team}}")], "short", stack=True,
                   description="Un pic sur UNE équipe = un agent ou une application à regarder."),
    ]
    y += 8

    # ------------------------------------------------------------- gateway view
    p.append(row("Vue passerelle — qui, sur quelle route (indépendant de l'adaptateur)", y)); y += 1
    by_gw = "sum by (route, team, user)"
    p.append(table(
        "Refus 403 sur les routes LLM, par route × équipe × utilisateur", 0, y, 24, 9,
        [
            ("403", f'{by_gw} (increase({REQ}{{status="403", {LLM}}}[$__range]))', "short", 0),
            ("5xx", f'{by_gw} (increase({REQ}{{status=~"5..", {LLM}}}[$__range]))', "short", 0),
        ],
        {"route": "Route", "team": "Équipe", "user": "Utilisateur"}, "403",
        "Code 403 = refus d'un garde-fou (couche 1 ou 2, REJECT_STATUS) mais aussi tout refus d'autorisation de la passerelle : "
        "croiser avec le tableau des règles. 5xx = moteur ou adaptateur indisponible (FailClosed). "
        "L'utilisateur n'apparaît pas si usage_metrics_per_user = false.",
    ))
    y += 9

    # ---------------------------------------------------------------- engine health
    p.append(row("Santé du moteur de règles", y)); y += 1
    p += [
        timeseries("Erreurs du moteur par minute", 0, y, 8, 8,
                   [target(f"sum by (direction, profile) (rate({ERR}{{{FE}}}[$__rate_interval])) * 60", "{{direction}} · {{profile}}")],
                   "short", stack=True,
                   description="Toute valeur > 0 est une requête refusée en 503 (fail-closed). Alerte GuardrailEngineFailing."),
        timeseries("Latence du moteur (p50 / p95 / p99)", 8, y, 10, 8,
                   [target(f'histogram_quantile({q}, sum by (le) (rate({DUR}_bucket{{direction=~"$direction"}}[$__rate_interval])))', f"p{int(q * 100)}", ref)
                    for q, ref in ((0.5, "A"), (0.95, "B"), (0.99, "C"))], "s",
                   description="Profil default : quelques ms. Profil strict (auto-contrôles LLM) : proche du délai de 3 s ? Alerte GuardrailLatencyHigh."),
        stat("Réplicas qui exposent des métriques", 18, y, 6, f"count(count by (pod) ({DUR}_count))", "short", 0,
             "Attendu : 2 (Deployment guardrail-adapter). 0 = adaptateur absent : le webhook FailClosed refuse tout le trafic LLM.", "#0078D4"),
    ]
    y += 8

    # --------------------------------------------------------------------- guide
    p.append(row("Comment s'en servir", y)); y += 1
    p.append(text("Un garde-fou gêne une application ou un agent : que faire ?", 0, y, 24, 11, (
        "**1. Qui ?** Tableau *Déclenchements par équipe × règle × profil* : repérer la ligne. « collaborateurs » = personnes (LibreChat) ; "
        "un nom d'équipe = les agents de cette équipe (clé virtuelle).\n\n"
        "**2. Quel mécanisme, quelle règle ?** Colonne *Mécanisme* : `adapter` (carte bancaire Luhn, secrets dans un message d'outil — code Python "
        "de l'adaptateur, `app/dlp.py`), `nemo-regex` (motifs du profil : clé `sk-…`, IBAN, NIR — `rails/<profil>/config.yml`), `nemo-injection` (YARA), "
        "`nemo-llm` (auto-contrôle par un modèle, profil strict), `moteur` (panne, pas un contenu). Refus de la **couche 1** (regex native "
        "de la passerelle) : panneau dédié, il n'est pas compté par l'adaptateur. La colonne *Règle* donne le nom précis.\n\n"
        "**3. Vrai positif ou faux positif ?** Le détail par personne n'est pas dans les métriques (cardinalité) mais dans les journaux "
        "de l'adaptateur, jamais le contenu du prompt :\n\n"
        "`kubectl -n agentgateway-system logs -l app.kubernetes.io/name=guardrail-adapter --prefix --since=1h | grep \"decision=reject\" | grep \"team=<équipe>\"`\n\n"
        "**4. Adapter pour une seule application / un seul agent, sans toucher aux autres :**\n"
        "- *un profil dédié* : copier `guardrails/deploy/rails/default` vers un nouveau profil, ajuster `config.yml`, "
        "le monter dans le Deployment, puis l'attribuer à la route de l'application (`x-guardrail-profile` dans `guardrail-policies.yaml`) ;\n"
        "- *une route dédiée* à l'application, ciblée par sa propre `AgentgatewayPolicy` (ne pas la cibler aussi depuis `garde-fous-llm`) ;\n"
        "- *messages d'outils* (agents MCP) : `TOOL_RAILS=secrets` (défaut) ou `profile` ;\n"
        "- ne jamais assouplir `default` pour une seule équipe : cela l'assouplit pour toutes.\n\n"
        "**5. Vérifier** : le taux de blocage de l'équipe baisse, les autres équipes ne bougent pas, les erreurs du moteur restent à 0.\n\n"
        "*Colonne Équipe à « - » :* la passerelle n'a pas transmis l'en-tête `x-team` (expression CEL `apiKey.team` à valider dans les "
        "en-têtes du webhook, cf. guardrails/README.md)."
    )))
    return p


VARIABLES = [
    {"name": "datasource", "label": "Source", "type": "datasource", "query": "prometheus",
     "current": {"text": "Prometheus", "value": "prometheus"}, "hide": 0},
    {"name": "equipe", "label": "Équipe", "type": "query", "datasource": DS, "multi": True, "includeAll": True,
     "allValue": ".*", "refresh": 2, "sort": 1,
     "definition": f"label_values({DEC}, team)", "query": {"query": f"label_values({DEC}, team)", "refId": "equipe"},
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
    {"name": "profil", "label": "Profil", "type": "query", "datasource": DS, "multi": True, "includeAll": True,
     "allValue": ".*", "refresh": 2, "sort": 1,
     "definition": f"label_values({DEC}, profile)", "query": {"query": f"label_values({DEC}, profile)", "refId": "profil"},
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
    {"name": "direction", "label": "Sens", "type": "query", "datasource": DS, "multi": True, "includeAll": True,
     "allValue": ".*", "refresh": 2, "sort": 1,
     "definition": f"label_values({DEC}, direction)", "query": {"query": f"label_values({DEC}, direction)", "refId": "direction"},
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
    {"name": "source", "label": "Mécanisme", "type": "query", "datasource": DS, "multi": True, "includeAll": True,
     "allValue": ".*", "refresh": 2, "sort": 1,
     "definition": f"label_values({DEC}, source)", "query": {"query": f"label_values({DEC}, source)", "refId": "source"},
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
    {"name": "regle", "label": "Règle", "type": "query", "datasource": DS, "multi": True, "includeAll": True,
     "allValue": ".*", "refresh": 2, "sort": 1,
     "definition": f"label_values({DEC}, rail)", "query": {"query": f"label_values({DEC}, rail)", "refId": "regle"},
     "current": {"text": ["All"], "value": ["$__all"]}, "hide": 0},
]


def _thresholds(panels, title, steps):
    """Colore un compteur selon sa valeur (vert / orange / rouge) au lieu d'une couleur fixe."""
    for pn in panels:
        if pn["title"] == title:
            pn["fieldConfig"]["defaults"]["color"] = {"mode": "thresholds"}
            pn["fieldConfig"]["defaults"]["thresholds"] = {
                "mode": "absolute", "steps": [{"color": c, "value": v} for c, v in steps]}
            return
    raise KeyError(title)


def _tuned_panels():
    panels = build()
    green, orange, red = "#107C10", "#FF8C00", "#D13438"
    _thresholds(panels, "Erreurs du moteur", [(green, None), (red, 1)])
    _thresholds(panels, "Taux de blocage", [(green, None), (orange, 5), (red, 20)])
    # Le webhook coupe à 3 s : orange à 1 s (alerte GuardrailLatencyHigh), rouge près du délai.
    _thresholds(panels, "Latence p95 du moteur", [(green, None), (orange, 1), (red, 2.5)])
    _thresholds(panels, "Réplicas qui exposent des métriques", [(red, None), (orange, 1), (green, 2)])
    for pn in panels:
        if pn["title"] == "Réplicas qui exposent des métriques":
            pn["gridPos"]["h"] = 8          # même hauteur que les graphiques voisins
    return panels


def dashboard():
    return {
        "uid": "garde-fous",
        "title": "Garde-fous — déclenchements par équipe, règle, profil",
        "description": "Qui déclenche quel garde-fou (NeMo Guardrails + regex native), sur quel profil, et la santé du moteur de règles.",
        "tags": ["agentgateway", "guardrails", "nemo", "securite"],
        "timezone": "browser",
        "editable": True,
        "graphTooltip": 1,
        "refresh": "1m",
        "time": {"from": "now-24h", "to": "now"},
        "schemaVersion": 39,
        "version": 1,
        "links": [{"type": "dashboards", "title": "Autres tableaux de bord", "tags": ["agentgateway"],
                   "asDropdown": True, "includeVars": False, "keepTime": True}],
        "annotations": {"list": []},
        "templating": {"list": VARIABLES},
        "panels": _tuned_panels(),
    }


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dashboard(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(OUT.parents[2])}")
