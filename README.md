# Adaptive Market-Making Research & Simulation Terminal

[![C++20](https://img.shields.io/badge/C%2B%2B-20-00599C?style=flat&logo=c%2B%2B)](https://en.cppreference.com/w/cpp/20)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)](#installation--démarrage-rapide)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Plateforme de recherche quantitative et de simulation haute performance pour l'étude, l'évaluation et le stress-testing de stratégies de tenue de marché (Market-Making) adaptatives en micro-structure de marché.**

---

## Sommaire
1. [Aperçu & Vision Quantitative](#aperçu--vision-quantitative)
2. [Architecture Technique du Système](#architecture-technique-du-système)
3. [Stratégies de Market-Making Implémentées](#stratégies-de-market-making-implémentées)
4. [Moteur de Risque & Modèle Comptable](#moteur-de-risque--modèle-comptable)
5. [Fonctionnalités du Terminal](#fonctionnalités-du-terminal)
6. [Installation & Démarrage Rapide](#installation--démarrage-rapide)
7. [Reproductibilité & Research Lab (Déterminisme)](#reproductibilité--research-lab-déterminisme)
8. [Hypothèses & Limites du Modèle (Quantitative Disclaimer)](#hypothèses--limites-du-modèle-quantitative-disclaimer)
9. [Défis Techniques & Solutions d'Ingénierie](#défis-techniques--solutions-dingénierie)
10. [Feuille de Route & Évolutions Futures (Roadmap)](#feuille-de-route--évolutions-futures-roadmap)

---

## Aperçu & Vision Quantitative

Dans les marchés électroniques contemporains, les market-makers sont exposés à deux risques majeurs :
1. **Le risque de sélection adverse (*Adverse Selection*) :** se faire exécuter par des intervenants informés lorsque le prix s'apprête à décaler.
2. **Le risque d'inventaire (*Inventory Risk*) :** accumuler une position nette directionnelle non désirée lors de déséquilibres d'ordres prolongés.

Ce projet fournit un environnement de laboratoire quantitatif complet simulant un carnet d'ordres à cours limité (Limit Order Book - L2) à haute fréquence. Il permet d'étudier la réponse dynamique de différentes stratégies de cotation face à un flux d'ordres stochastique, en observant en direct l'impact sur le carnet d'ordres, l'exposition nette, le P&L mark-to-market et le drawdown.

```
                    BOUCLE DE SIMULATION QUANTITATIVE
 ┌────────────────────────────────────────────────────────────────────────┐
 │                                                                        │
 │  Flux Stochastique      Limit Order Book        Stratégies Adaptatives │
 │  (Noise / Informed) ──► (L2 Matching Engine) ──► (Skew & Spread)       │
 │                               ▲                         │              │
 │                               │                         ▼              │
 │                          Comptabilité P&L          Risk Engine         │
 │                        (MtM, Realized, DD)  ◄── (Position & Exposure)  │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘
```

> **Note de positionnement :** Ce projet a vocation de **terminal de recherche et de démonstration technique** (portfolio quantitatif). Il n'est pas conçu pour être déployé sur des flux de production d'exchange sans adaptation aux contraintes matérielles spécifiques (DMA, FPGA, kernel-bypass).

---

## Architecture Technique du Système

Le système repose sur un découplage strict en trois couches : performance de calcul native, pont IPC/WebSocket multi-plateforme, et interface de visualisation temps réel.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            C++20 CORE ENGINE                                │
│  - Limit Order Book (LOB) L2 structuré (std::map + FIFO buckets)            │
│  - Matching Engine (ordres Limit / Market, annulations)                     │
│  - PRNG Déterministe (std::mt19937_64) pour le générateur de flux           │
│  - 4 Algorithmes de Quoting Adaptatifs                                      │
│  - Feature Engine : Mid-price, Spread, OBI (Order Book Imbalance), Micro-Vol│
│  - Risk Engine : Position Tracking, Exposure Limits & Kill-Switch           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ STDOUT JSON (Line-buffered IPC)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NODE.JS BRIDGING SERVER                            │
│  - Multi-platform Process Supervisor (Windows .exe / Unix binary)           │
│  - Gestion du cycle de vie des sous-processus et des signaux système        │
│  - Serveur WebSocket haute fréquence (latence de transmission < 20ms)       │
│  - Routage bidirectionnel des ordres et paramètres d'expériences            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ WebSocket (ws://)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REACT 19 QUANT TERMINAL                            │
│  - Market View : Carnet d'ordres temps réel avec jauges de profondeur       │
│  - Live Charts : Séries temporelles Recharts bi-axes (P&L & Inventaire)     │
│  - Research Lab : Backtesting déterministe avec tableau comparatif          │
│  - Chiffres tabulaires (tabular-nums) et typographie monospace stricte      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stratégies de Market-Making Implémentées

Le moteur intègre 4 modèles de cotation aux propriétés mathématiques distinctes :

### 1. `FixedSpreadMM` (Baseline)
- **Principe :** Stratégie de référence plaçant des ordres limites d'achat et de vente symétriques autour du mid-price :
  $$P_{bid} = P_{mid} - \frac{\delta}{2}, \quad P_{ask} = P_{mid} + \frac{\delta}{2}$$
- **Propriété :** Idéal en marché stationnaire à faible volatilité, mais vulnérable au drift directionnel et à l'accumulation toxique d'inventaire.

### 2. `InventoryAwareMM` (Contrôle d'Inventaire)
- **Principe :** Inspiré du modèle d'Avellaneda-Stoikov, il applique un décentrage (*skew*) asymétrique au prix de réserve en fonction de la position courante $q$ :
  $$P_{skewed} = P_{mid} - (\gamma \cdot q)$$
  $$P_{bid} = P_{skewed} - \frac{\delta}{2}, \quad P_{ask} = P_{skewed} + \frac{\delta}{2}$$
- **Objectif :** Lorsqu'il est long ($q > 0$), il abaisse ses prix pour favoriser la vente et décourager les achats, ramenant dynamiquement son inventaire vers 0.

### 3. `VolatilityAdaptiveMM` (Protection contre la Volatilité)
- **Principe :** Ajuste continuellement le demi-spread et la taille des ordres en fonction de la volatilité réalisée sur les 50 derniers ticks ($\sigma_t$) :
  $$\delta_t = \delta_0 \cdot (1 + 10 \cdot \sigma_t), \quad Q_t = \max\left(1, \left\lfloor \frac{Q_0}{1 + 5 \cdot \sigma_t} \right\rfloor\right)$$
- **Objectif :** Élargit les cotations lors des régimes agités pour compenser le risque de liquidité et réduit la taille exposée.

### 4. `RegimeAdaptiveMM` (Changement de Régime)
- **Principe :** Machine à états microstructurelle détectant les transitions de régime selon un seuil de volatilité critique :
  $$\text{Régime} = \begin{cases} \text{HIGH\_VOL (VolatilityAdaptiveMM)}, & \text{si } \sigma_t > \theta \\ \text{CALM (FixedSpreadMM)}, & \text{sinon} \end{cases}$$
- **Objectif :** Maximise le taux de capture de spread en régime calme tout en activant automatiquement le bouclier protecteur dès l'apparition de turbulences.

---

## Moteur de Risque & Modèle Comptable

### Gestion du Risque (Risk Engine)
- **Contrôle d'exposition maximale :** Chaque ordre proposé par la stratégie est soumis à un test pré-trade d'allocation (`is_order_allowed`) :
  $$|q_{\text{current}} + \Delta q_{\text{order}}| \le Q_{\max}$$
- **Kill-Switch :** Verrouillage immédiat de la cotation si une limite statutaire ou une anomalie est détectée.

### Comptabilité P&L en Temps Réel
- **P&L Réalisé :** Flux de trésorerie net issu des exécutions achat/vente :
  $$\text{Cash}_t = \sum_{\text{ventes}} (P \times Q) - \sum_{\text{achats}} (P \times Q)$$
- **P&L Non-Réalisé (Mark-to-Market) :** Évaluation de la position résiduelle au cours moyen du marché :
  $$\text{Unrealized}_t = q_t \times P_{mid, t}$$
- **P&L Total & Max Drawdown :**
  $$\text{Total P\&L}_t = \text{Cash}_t + \text{Unrealized}_t$$
  $$\text{Drawdown}_t = \max_{s \le t}(\text{Total P\&L}_s) - \text{Total P\&L}_t$$

---

## Fonctionnalités du Terminal

- **Visualisation du Carnet d'Ordres L2 avec Jauges de Profondeur :**
  - Affichage des 5 meilleurs Bids et Asks avec barres horizontales proportionnelles au volume relatif.
  - Calcul en temps réel de l'**Order Book Imbalance (OBI)** :
    $$OBI = \frac{V_{bid} - V_{ask}}{V_{bid} + V_{ask}} \in [-1, 1]$$
- **Streaming Haute Fréquence :** Rafraîchissement cadencé à 20 ms via WebSocket sans surcharge mémoire navigateur.
- **Micro-Interactions & Monitoring :**
  - Badges d'état du moteur (`ENGINE ONLINE`, `RUNNING SIMULATION...`, `DISCONNECTED`).
  - Indicateur d'exposition au risque et d'inventaire avec code couleur dynamique (Vert/Rouge/Gris).
- **Research Lab Intégré :**
  - Backtesting configurable (Stratégie, Seed, Nombre de pas de simulation).
  - Présélections de benchmarks prêtes à l'emploi (Calibration standard, Stress-test forte volatilité).
  - Tableau d'historique comparatif des simulations passées.

---

## Installation & Démarrage Rapide

### Prérequis Système
- **Node.js :** Version 18.0.0 ou supérieure ([Télécharger](https://nodejs.org/)).
- **Compilateur C++20 :** 
  - **Linux / macOS :** GCC 10+ (`g++`), Clang 11+ (`clang++`), ou CMake 3.16+.
  - **Windows :** MinGW-w64 (via MSYS2 / WinLibs), Clang, ou Visual Studio Build Tools (`cl.exe`).

### 1. Cloner le Dépôt
```bash
git clone https://github.com/votre-compte/adaptive-market-making-engine.git
cd adaptive-market-making-engine
```

### 2. Installer les Dépendances Node.js
```bash
npm install
```

### 3. Compiler le Moteur C++ (Multi-Plateforme)
Le script de build automatique détecte votre système d'exploitation et le compilateur disponible (CMake, g++, clang++, cl.exe) :
```bash
npm run build:cpp
```
*Le binaire exécutable sera généré directement dans `cpp/mm_engine` (ou `cpp/mm_engine.exe` sous Windows).*

### 4. Lancer le Terminal
```bash
npm run dev
```
Ouvrez votre navigateur à l'adresse indiquée : **`http://localhost:3000`**.

---

## Reproductibilité & Research Lab (Déterminisme)

La validation d'une stratégie quantitative exige une **reproductibilité expérimentale parfaite**.

Toutes les variables stochastiques du moteur (génération des ordres de bruit, taille des ordres, sens d'exécution) sont initialisées par un générateur **Mersenne Twister 64 bits (`std::mt19937_64`)** recevant le paramètre `--seed`.

### Exemple de Vérification en Ligne de Commande :
```bash
# Expérience 1
./cpp/mm_engine --strategy InventoryAware --seed 42 --duration 500

# Expérience 2 (strictement identique)
./cpp/mm_engine --strategy InventoryAware --seed 42 --duration 500
```
*Résultat attendu : P&L final, drawdown maximal, nombre de trades et volume exécuté strictement identiques au centième près.*

---

## Hypothèses & Limites du Modèle (Quantitative Disclaimer)

Dans un souci de rigueur méthodologique, les simplifications suivantes sont documentées :
1. **Priorité de File d'Attente (Queue Position) :** Le matching engine actuel exécute les ordres limites au carnet selon un matching agrégé par niveau de prix. Il ne simule pas la position exacte d'annulation/insertion dans la file FIFO microstructurelle.
2. **Latence Réseau & Colocation :** La latence d'envoi d'ordres vers le carnet est considérée comme nulle (pas de latence de transit ni de modèle de slippage réseau).
3. **Structure de Frais :** Le modèle n'applique pas de grille asymétrique *maker rebates / taker fees*, les flux de trésorerie sont bruts de commissions d'exchange.
4. **Flux Taker Simulé :** Les ordres de marché adverses proviennent d'un modèle stochastique gaussien de type bruit blanc (*Noise Trader*), non couplé à un feed externe de données de marché réelles (L3 PCAP/ITCH).

---

## Défis Techniques & Solutions d'Ingénierie

Au cours du développement et du déploiement en production de cet **Engine de Market Making Quantitatif** (C++20, Node.js & React), plusieurs défis système et d'architecture ont été résolus :

### 1. Résilience du Moteur de Simulation (C++20 Fallback)
* **Problème :** Dans certains conteneurs Cloud légers, les outils de compilation natifs (`g++`, `cmake`) ne sont pas installés par défaut, empêchant la compilation du binaire haute fréquence C++ (`mm_engine`) au démarrage (`Binary not found`).
* **Solution :** 
  * Installation dynamique des paquets essentiels (`build-essential`, `cmake`) si nécessaire.
  * Mise en place d'un système de **fallback automatique** : si le binaire C++ est indisponible, le serveur Node.js bascule de manière transparente sur un moteur de simulation quantitatif de secours haute fidélité écrit en TypeScript (`engine_simulator.ts`), garantissant zéro interruption de service.

### 2. Déploiement Cloud Run & Bundling ESM/CJS
* **Problème :** Lors de l'exécution en production sur Google Cloud Run avec Node.js en mode ESM natif, des erreurs d'importation de modules locaux (`ERR_MODULE_NOT_FOUND`) survenaient sur les chemins sans extension.
* **Solution :** Mise en place d'un pipeline de build unifié avec **`esbuild`**. Il compile et empaquète l'ensemble du serveur TypeScript en un bundle CommonJS autonome unique (`dist/server.cjs`), garantissant un démarrage instantané sans erreur de résolution de modules.

### 3. Stabilité des WebSockets & Reconnexion Intelligente
* **Problème :** Des erreurs transitoires de type `[WS] WebSocket error` apparaissaient lors des rafraîchissements de page (HMR) ou des micro-reboots du serveur de développement.
* **Solution :** Implémentation d'un mécanisme de **reconnexion exponentielle** côté client et d'un nettoyage propre des flux côté serveur pour absorber les déconnexions de proxy sans impacter l'expérience utilisateur.

### 4. Intégrité de l'UI & Re-rendering React
* **Problème :** Des avertissements de clés dupliquées (`Encountered two children with the same key`) survenaient lors d'expériences rapprochées en raison d'une troncature des horodatages (`Date.now().toString().slice(-4)`).
* **Solution :** Création d'un identifiant unique persistant et incrémenté (`RUN-${Date.now()}-${runNum}`) couplé à un mécanisme de déduplication des exécutions dans le state React.

---

## Feuille de Route & Évolutions Futures (Roadmap)

### Version 2.0 (Court Terme - Améliorations Fonctionnelles & Infra)
- **Backtesting Historique & Replay :** Chargement de données réelles (CSV/Parquet) et replay milliseconde par milliseconde du carnet d'ordres (*Order Book Replay*).
- **Visualisation Avancée :** Ajout d'une Heatmap de liquidité et d'un graphique de profondeur de marché (*Market Depth Chart*) en temps réel dans le dashboard React.
- **Optimisation DevOps :** Image Docker multi-stage avec pré-compilation du binaire natif C++20 pour un déploiement Cloud Run 100% natif.
- **Gestionnaire de Profils :** Export/Import des configurations de stratégie et profils de risque au format JSON.

### Version 3.0 (Moyen Terme - Quant & Intelligence Artificielle)
- **Market Making par RL (Reinforcement Learning) :** Entraînement d'un agent d'apprentissage par renforcement (Q-Learning / PPO) pour l'ajustement dynamique des spreads.
- **Modèles Quantitatifs Avancés :** Implémentation de la stratégie d'Avellaneda-Stoikov et détection du flux toxique (*Toxic Flow / Adverse Selection*).
- **Gestion des Risques & VaR :** Calcul de la *Value at Risk* (VaR) en temps réel avec mécanisme de coupure automatique (*Kill Switch*) en cas de dépassement de drawdown.
- **Simulation de Latence Réseau :** Module d'injection de délai (5ms - 50ms) et de rejet d'ordres pour tester la résilience en conditions réelles.

### Version 4.0 (Long Terme - Connectivité Institutionnelle & Multi-Utilisateurs)
- **Connecteurs Réels (FIX Protocol) :** Intégration du protocole FIX et de WebSockets binaires (Protobuf) pour la connexion à des exchanges réels (Binance, Coinbase Prime).
- **Support Multi-Comptes & Multi-Actifs :** Gestion parallèle de plusieurs paires d'actifs (BTC/USDT, ETH/USDT) et de sous-comptes d'exécution.
- **Architecture Multi-Rôles (RBAC) :** Séparation des accès dans l'interface React (Rôles : *Quant*, *Risk Manager*, *Observer*).
- **Export Data Science :** Exportation directe des sessions de simulation au format Parquet/HDF5 pour analyse approfondie sous Python (Pandas/Polars/Jupyter).

---

## Licence
Ce projet est distribué sous licence MIT. Libre d'utilisation pour toute fin de recherche, d'apprentissage et de présentation en portfolio.
