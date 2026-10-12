# Runbook incidents — équipe __EQUIPE__

## Sévérité

- **critique** : un service client est arrêté, ou un cluster AKS de production n'est plus joignable.
- **haute** : un service est dégradé (pool de nœuds en échec, mise à jour bloquée, version de Kubernetes hors support).
- **moyenne** : un risque connu sans impact immédiat (version bientôt hors support, quota proche de la limite).
- **basse** : une recommandation d'amélioration (Advisor, bonne pratique).

## Contenu d'un ticket

Un ticket d'incident contient toujours :

1. l'identifiant complet de la ressource Azure concernée ;
2. le constat, tel que lu dans Azure (état, version, message d'erreur) — rien d'estimé ;
3. la remédiation proposée, avec au moins une source Microsoft Learn ;
4. la sévérité ci-dessus.

L'agent ne corrige rien lui-même : il ouvre ou complète le ticket, un humain de l'équipe le prend.

## Astreinte

- Critique et haute : l'astreinte de l'équipe prend le ticket dans les 30 minutes.
- Moyenne et basse : revue au point d'équipe du lundi.

## Versions de Kubernetes

Une version de Kubernetes à moins de 60 jours de sa fin de support sur AKS est une sévérité **moyenne** ;
hors support, **haute**. Le calendrier de référence est celui de Microsoft Learn (versions prises en charge d'AKS).
