# Audit quant/dev — projet Trade

**Dépôt audité :** `lialianeyouan-rgb/Trade`  
**Branche de travail :** `main` clonée localement, sans modification du dépôt distant  
**Périmètre :** moteur C++20, simulation de carnet L2, file de latence, bridge Node/WebSocket, tests et reproductibilité.

## Résumé exécutif

Le projet est un laboratoire de simulation de market making cohérent pour la recherche, mais ses métriques de latence étaient principalement déclaratives : `mean_latency_ms = 5.0` et `jitter_stddev_ms = 2.0` étaient renvoyés tels quels, sans statistique d’exécution observée. Le fallback TypeScript renvoyait même une profondeur de file aléatoire.

Une instrumentation native a été ajoutée dans `LatencyBuffer` :

- mesure de la durée virtuelle entre soumission gateway et exécution au matching engine ;
- nombre d’échantillons, moyenne, minimum, maximum ;
- percentiles p50/p95/p99 via histogramme fixe ;
- profondeur maximale de la file ;
- exposition des mêmes données dans les messages live et `experiment_complete`.

## Mesure reproductible obtenue

Commande exécutée :

```bash
g++ -std=c++20 -O2 -Wall -Wextra -Wpedantic \
  -Icpp/orderbook -Icpp/matching -Icpp/simulator \
  cpp/main.cpp cpp/orderbook/order_book.cpp cpp/matching/matching_engine.cpp \
  cpp/simulator/*.cpp -o /tmp/mm_engine_latency

/tmp/mm_engine_latency --strategy InventoryAware --seed 42 --duration 1000
```

Résultat natif observé :

| Indicateur | Valeur |
|---|---:|
| Actions mesurées | 3 832 |
| Latence moyenne observée | 10,0365 ms |
| p50 | 10 ms |
| p95 | 10 ms |
| p99 | 10 ms |
| Minimum | 10 ms |
| Maximum | 20 ms |
| Profondeur maximale de file | 12 actions |

### Interprétation importante

La simulation avance par pas virtuels de **10 ms** (`current_time_ms = step * 10`). La latence observée est donc quantifiée par ce pas : une latence nominale de 5 ms peut être exécutée au tick suivant et apparaître à 10 ms ; une action qui attend un tick supplémentaire apparaît à 20 ms. Ces statistiques mesurent donc la latence **effective dans le modèle discret**, pas une latence réseau physique nanoseconde/microseconde.

## Constats principaux

### Points positifs

- Séparation claire entre moteur natif, bridge Node et interface React.
- Seed déterministe pour les expériences.
- Contrôles déjà présents sur les quantités nulles, les doublons d’identifiant et l’ownership des annulations.
- Risk engine avec limite d’exposition, pending orders et kill switch.
- Rejeu CSV L2 prévu dans le moteur C++.
- Tests ASan/UBSan existants et passants.

### Risques et limites prioritaires

1. **Latence auparavant non observée.** Les valeurs exposées ne permettaient pas de distinguer latence configurée, latence de file et latence d’exécution.
2. **Résolution temporelle trop grossière.** Le pas de 10 ms ne permet pas une analyse sérieuse du p99 sub-ms ou de la microstructure intratick.
3. **Book coûteux sur les chemins d’annulation/insertion.** Les niveaux sont des `vector` triés ; les insertions de niveaux et suppressions peuvent déplacer beaucoup d’éléments. Les annulations recherchent puis effacent dans un vector de niveau.
4. **Gestion FIFO incomplète pour une étude de queue position.** `queue_ahead` est calculé, mais il n’est pas réellement utilisé pour modéliser les fills partiels, les annulations devant l’ordre ou la perte de priorité.
5. **Décalage entre moteur natif et fallback TypeScript.** Les deux modèles ne sont pas équivalents : le fallback synthétise une profondeur L2 et des métriques, alors que le C++ exécute un carnet et une file de latence.
6. **Benchmarks README non suffisamment auditables.** Les chiffres p50/p99 et “0 allocation dynamique” sont documentés, mais aucune suite de benchmark versionnée ne les reproduit automatiquement dans le dépôt.
7. **Validation statistique limitée.** Un seul seed et une seule trajectoire ne suffisent pas pour conclure sur Sharpe, fill rate ou adverse selection.
8. **CI et benchmark désormais ajoutés.** La branche d’implémentation ajoute une CI GitHub avec build, lint, sanitizers et benchmark multi-seeds.

## Axes d’amélioration recommandés

### Priorité P0 — fiabiliser les mesures

- Conserver les champs `observed_latency_*` ajoutés dans cette branche.
- Ajouter un `sequence_id` monotone aux actions pour rendre le traitement des égalités de timestamp totalement déterministe.
- Distinguer dans les sorties :
  - `gateway_delay_sampled_ms` ;
  - `queue_wait_ms` ;
  - `matching_service_time_us` ;
  - `end_to_end_simulated_ms`.
- Produire un fichier JSONL de benchmark plutôt que seulement une ligne finale JSON.

### Priorité P1 — améliorer le modèle quantitatif

- Passer à un temps virtuel en microsecondes ou nanosecondes, tout en gardant un rythme de rendu UI séparé.
- Implémenter la queue position et les fills partiels avec événements d’arrivée, cancel et trade.
- Ajouter des scénarios de latence paramétrables : constant, normal tronquée, lognormal, bimodale, burst/jitter corrélé.
- Mesurer l’impact de la latence sur fill rate, adverse selection, PnL, inventory drawdown et quote age.
- Exécuter les résultats sur plusieurs seeds et fournir intervalles de confiance/bootstrap.

### Priorité P1 — réduire les coûts système

- Remplacer la structure de prix triée par `std::map`/`flat_map` benchmarkée ou une grille de ticks si l’univers de prix le permet.
- Éviter les allocations répétées de `std::vector<Trade>` dans le hot path avec un buffer réutilisable ou une capacité réservée.
- Remplacer `std::endl`/flush systématique en mode live par un buffer configurable, et séparer cadence de calcul et cadence WebSocket.
- Ajouter backpressure et coalescence des ticks côté WebSocket afin de ne jamais laisser un client lent bloquer le flux.

### Priorité P2 — qualité et exploitation

- Ajouter CI : build Release, tests unitaires, ASan/UBSan, lint TypeScript et benchmark de non-régression.
- Versionner les paramètres de simulation et les résultats avec seed, commit SHA et configuration complète.
- Ajouter des tests de propriétés : conservation des quantités, absence d’ordres fantômes, monotonicité des timestamps, annulation autorisée uniquement au propriétaire.
- Unifier les schémas de sortie C++/TypeScript et supprimer les métriques synthétiques du fallback ou les marquer explicitement `estimated`.

## Implémentation livrée dans la branche

Les améliorations directement implémentées sont :

- séquencement déterministe des actions de latence à timestamp égal ;
- séparation latence demandée, latence effective et attente de file ;
- métadonnées `strategy`, `seed` et `duration` dans les résultats ;
- source explicite `observed` (C++) ou `estimated` (fallback TypeScript) ;
- tests de propriétés de l’histogramme et des percentiles ;
- scripts `test_cpp.sh` et `benchmark_latency.sh` ;
- workflow `.github/workflows/ci.yml` ;
- réservation initiale de la table des identifiants du carnet pour limiter les réallocations prévisibles ;
- schémas TypeScript alignés avec les métriques natives ;
- documentation de reproduction mise à jour.

Le passage à une horloge virtuelle sub-millisecondes et la modélisation complète de la queue position restent des évolutions de modèle plus profondes : elles sont documentées comme prochaines étapes plutôt que simulées artificiellement.

## Validation exécutée

- **Tests C++ ASan/UBSan : PASS** — CTA-03, CTA-01, CTA-07 et CTA-20.
- **Compilation native g++ avec warnings : PASS.**
- **TypeScript `tsc --noEmit` : PASS.**
- **`git diff --check` : PASS.**
- CMake n’était pas installé dans le sandbox ; la compilation g++ directe a donc été utilisée pour la validation native.

## Fichiers modifiés

- `cpp/simulator/latency_buffer.hpp` — instrumentation, histogramme fixe, statistiques observées et profondeur maximale.
- `cpp/main.cpp` — export des métriques dans les flux live et les résultats d’expérience.
- `cpp/orderbook/order_book.hpp` — réservation initiale de la table des ordres.
- `cpp/tests/unit_test_main.cpp` — propriétés de télémétrie et percentiles.
- `engine_simulator.ts`, `src/types.ts` — schéma et source de métriques alignés.
- `scripts/test_cpp.sh`, `scripts/benchmark_latency.sh`, `.github/workflows/ci.yml` — validation automatisée.
- `README.md`, `package.json` — documentation et commandes de validation.

Aucun changement n’est appliqué directement à `main` ; la branche dédiée est prête à être publiée et relue avant fusion.
