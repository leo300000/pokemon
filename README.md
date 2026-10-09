# Classeur Pokémon

**👉 Accéder au site : https://leo300000.github.io/pokemon/**

Un classeur en ligne qui range **toutes les cartes Pokémon (JCC)** par extension, comme dans un vrai classeur de collection :
une pochette par carte, son numéro et sa rareté, une recherche dans tout le catalogue, les noms et les textes en français
ou en anglais, et un effet d'inclinaison holographique au survol.

C'est le même principe que le [classeur Yu-Gi-Oh!](https://github.com/leo300000/yugioh). Le site est **100 % statique** :
pas de serveur ni de base de données, et aucune dépendance npm. Un script Node prépare les données une fois par semaine,
puis GitHub Pages les sert telles quelles.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Comment ça marche, vue d'ensemble](#comment-ça-marche-vue-densemble)
3. [Différences avec le classeur Yu-Gi-Oh!](#différences-avec-le-classeur-yu-gi-oh)
4. [Arborescence du dépôt](#arborescence-du-dépôt)
5. [Le pipeline de données : `scripts/build.mjs`](#le-pipeline-de-données--scriptsbuildmjs)
6. [Le pipeline de déploiement : GitHub Actions](#le-pipeline-de-déploiement--github-actions)
7. [Le site : `site/index.html`](#le-site--siteindexhtml)
8. [Format des données générées](#format-des-données-générées)
9. [Travailler en local](#travailler-en-local)
10. [Réglages](#réglages)
11. [Dépannage](#dépannage)
12. [Crédits et mentions légales](#crédits-et-mentions-légales)

---

## Fonctionnalités

- **Liste de toutes les extensions** dans la colonne de gauche, **groupées par série** (Écarlate et Violet,
  Épée et Bouclier, Soleil et Lune…). On peut les trier (plus récentes, plus anciennes, par nom) et les filtrer par nom
  français, nom anglais ou code (ex. `SCR`, `sv07`, `base1`).
- **Page d'extension** : toutes les cartes rangées par numéro (`001/142`, puis les secrètes), avec un filtre
  Pokémon / Dresseurs / Énergies et une recherche à l'intérieur de l'extension.
- **Recherche globale** dans les ~21 000 cartes, sur le nom français et le nom anglais, sans tenir compte des accents
  ni des majuscules. Les noms qui commencent par le texte cherché passent en premier, et l'affichage est limité aux
  150 premiers résultats.
- **Fiche détaillée** au clic sur une carte : catégorie et stade, PV, type, faiblesse, résistance, coût de retraite
  (avec les pastilles d'énergie), talents et attaques avec leur coût et leurs dégâts, texte des Dresseurs et des
  Énergies, description du Pokédex, rareté, versions (Normale, Reverse, Holo, 1re édition), marque de régulation,
  illustrateur, et la liste de **toutes les cartes du même nom** dans les autres extensions, avec un lien vers chacune.
- **Bouton FR / EN** pour choisir la langue des noms, des textes **et des images** (scans français ou anglais).
  Le choix est mémorisé dans le navigateur.
- **Inclinaison 3D au survol** avec reflet lumineux. Les cartes holographiques (Holo, Double rare, Ultra rare,
  Illustration rare…) et les plus rares (Rare secrète, Illustration spéciale rare, Hyper rare, Chromatique…) reçoivent
  en plus un reflet arc-en-ciel plus ou moins fort.
- **Adapté au mobile** : la liste des extensions devient un tiroir ouvert par le bouton « Extensions ».
- **Accessible** : navigation au clavier, focus visible, et l'animation est coupée si le système demande
  de réduire les animations.
- **Mise à jour automatique** chaque lundi pour récupérer les nouvelles extensions.

---

## Comment ça marche, vue d'ensemble

```
        ┌──────────────────────────────────┐        ┌──────────────────────────────┐
        │  github.com/tcgdex/cards-database│        │   assets.tcgdex.net          │
        │  une fiche .ts par carte,        │        │   datas.json (images dispo)  │
        │  noms et textes multilingues     │        │   /fr|en/<série>/<ext>/<n°>  │
        └────────────────┬─────────────────┘        └──────┬───────────────▲───────┘
                         │ git clone --depth 1             │ 1 appel        │ images
                         ▼                                 ▼                │ (chargées par
┌──────────────────── GitHub Actions (job « build ») ─────────────────┐     │  le navigateur)
│                                                                     │     │
│   node scripts/build.mjs  ──►  dist/                                │     │
│     1. base TCGdex             index.html                           │     │
│     2. liste des images        data/cards.json   data/sets.json     │     │
│     3. séries, extensions,     data/texts.json   data/meta.json     │     │
│        cartes, textes          .nojekyll                            │     │
│     4. écriture de dist/                                            │     │
│                                                                     │     │
│   upload-pages-artifact (dist/)                                     │     │
└───────────────────────────────┬─────────────────────────────────────┘     │
                                ▼                                           │
              job « deploy » → deploy-pages → GitHub Pages                  │
                                ▼                                           │
                 https://leo300000.github.io/pokemon/  ─────────────────────┘
```

Les données (noms, textes, extensions) sont servies par GitHub Pages. Les **images** sont chargées directement depuis le
CDN de TCGdex, qui est fait pour ça : c'est l'adresse que leur API donne elle-même pour chaque carte.

---

## Différences avec le classeur Yu-Gi-Oh!

| Point                    | Yu-Gi-Oh!                                       | Pokémon                                                    |
|--------------------------|-------------------------------------------------|------------------------------------------------------------|
| Source des données       | API YGOPRODeck (3 appels HTTP)                  | Base TCGdex clonée depuis GitHub (aucun appel d'API)        |
| Français                 | Deuxième appel `language=fr`                    | Inclus dans chaque fiche (noms, attaques, talents, textes) |
| Images                   | Téléchargées et hébergées sur GitHub Pages (YGOPRODeck interdit le lien direct) | Servies par le CDN de TCGdex, en FR ou en EN |
| Durée du build           | 25 à 40 min la 1re fois, puis 1 à 3 min         | Environ 1 minute à chaque fois                             |
| Cache GitHub Actions     | Oui (images)                                    | Inutile                                                    |
| Réimpressions            | Une carte, plusieurs impressions                | Chaque carte appartient à une seule extension ; la fiche liste les autres cartes du même nom |
| Liste des extensions     | Groupée par année                               | Groupée par série                                          |

---

## Arborescence du dépôt

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml     # pipeline CI/CD : build + déploiement GitHub Pages
├── scripts/
│   └── build.mjs          # pipeline de données : base TCGdex → dist/
├── site/
│   └── index.html         # tout le site : HTML, CSS et JavaScript dans un seul fichier
├── .gitignore             # ignore dist/, .cache/, node_modules/
└── README.md
```

Dossiers générés, jamais versionnés :

| Dossier         | Contenu                                                  |
|-----------------|----------------------------------------------------------|
| `.cache/tcgdex/`| La copie locale de la base TCGdex (≈ 190 Mo)             |
| `.cache/ptcg/`  | La copie locale de la base pokemontcg.io (≈ 30 Mo)       |
| `dist/`         | Le site prêt à publier : copie de `site/` + `data/`      |

---

## Le pipeline de données : `scripts/build.mjs`

Un seul script Node (20 ou plus), sans dépendance : il n'utilise que `fetch`, `node:fs` et `git`.
Il s'exécute de haut en bas en quatre étapes.

### 1. Récupération de la base TCGdex

- Premier lancement : `git clone --depth 1` de [tcgdex/cards-database](https://github.com/tcgdex/cards-database)
  dans `.cache/tcgdex/` (une dizaine de secondes).
- Lancements suivants : `git fetch --depth 1` puis `git reset --hard`, pour ne récupérer que les changements.
- La variable `TCGDEX_DIR` permet d'utiliser une copie déjà présente ailleurs sur le disque.

### 2. Liste des images

Un seul appel à `https://assets.tcgdex.net/datas.json`, qui indique pour chaque langue, série, extension et numéro si
une image existe. Le script note pour chaque carte si elle a une image française, anglaise, ou les deux.

- Appel réessayé jusqu'à 4 fois (2 s, 4 s, 8 s).
- S'il échoue, ou si la liste semble anormale (moins d'une carte sur deux avec une image), le build continue :
  le site essaiera simplement l'image française puis l'anglaise pour chaque carte.

### 3. Séries, extensions et cartes

La base TCGdex range ses fichiers ainsi :

```
data/<Série>.ts                       ex. data/Scarlet & Violet.ts
data/<Série>/<Extension>.ts           ex. data/Scarlet & Violet/Stellar Crown.ts
data/<Série>/<Extension>/<numéro>.ts  ex. data/Scarlet & Violet/Stellar Crown/001.ts
```

Chaque fichier est du TypeScript très simple : un objet littéral exporté. Le script retire les lignes `import`,
les annotations de type et l'`export default`, puis évalue l'objet comme du JavaScript. Un fichier illisible est
signalé et ignoré, sans bloquer le build.

- **Exclus** : la série *Pokémon TCG Pocket* (jeu mobile, pas de cartes physiques), les cartes sans nom français ni
  anglais (sorties uniquement en Asie) et les extensions vides.
- Pour chaque carte, le script ne garde que les champs utiles, sous des noms courts (voir
  [Format des données](#format-des-données-générées)). Le nom français n'est stocké que s'il diffère du nom anglais.
- Les textes (talents, attaques, effets, descriptions), qui pèsent le plus lourd, partent dans `texts.json`, que le site
  ne charge qu'à l'ouverture de la première fiche.
- Les cartes d'une extension sont triées par numéro dans l'ordre naturel (`2` avant `10`, puis `TG01`…).
  Les extensions sont triées de la plus récente à la plus ancienne.
- Garde-fou : si la base contient moins de 5 000 cartes ou 50 extensions, le build s'arrête, pour ne jamais publier
  un site vide.

### 4. Images de secours (pokemontcg.io)

Le script clone aussi [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data) dans `.cache/ptcg/`.
Les deux bases n'utilisent pas les mêmes identifiants d'extension (`sv07` / `sv7`, `swsh3.5` / `swsh35`…) : chaque
extension TCGdex est associée à l'extension pokemontcg.io dont le plus de cartes ont le même numéro et le même nom
anglais (au moins la moitié). Chaque carte reçoit alors l'adresse de son image pokemontcg.io (`pi`), utilisée en
dernier recours. Environ 20 500 cartes sur 21 400 en ont une ; les kits du dresseur et quelques promos n'existent pas
chez pokemontcg.io. Si ce dépôt est injoignable, le build continue sans images de secours.

### 5. Écriture de `dist/`

`dist/` est vidé, puis le script y copie `site/`. Il écrit ensuite les quatre fichiers JSON et un fichier `.nojekyll`,
qui empêche GitHub Pages de passer le site dans Jekyll.

### Durée

Environ **une minute** au total, à chaque build : il n'y a aucune image à télécharger.

---

## Le pipeline de déploiement : GitHub Actions

Fichier : [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), nommé « Construire et déployer le classeur ».

### Déclencheurs

| Déclencheur          | Quand                                          | Pourquoi                                    |
|----------------------|------------------------------------------------|---------------------------------------------|
| `push` sur `main`    | À chaque modification fusionnée dans `main`    | Publier les changements du site             |
| `schedule`           | Chaque lundi à 4 h UTC (`0 4 * * 1`)           | Récupérer les nouvelles cartes et extensions |
| `workflow_dispatch`  | À la main : onglet **Actions** → **Run workflow** | Forcer une mise à jour                   |

### Permissions et concurrence

- `contents: read` : lire le dépôt.
- `pages: write` et `id-token: write` : obligatoires pour publier sur GitHub Pages.
- `concurrency: pages` avec `cancel-in-progress: false` : un seul déploiement à la fois.

### Job `build` (limite de 30 minutes)

1. **`actions/checkout@v4`** récupère le code.
2. **`actions/setup-node@v4`** installe Node 22.
3. **`node scripts/build.mjs`** clone la base TCGdex et construit `dist/` (voir plus haut).
4. **`actions/configure-pages@v5`** prépare la publication.
5. **`actions/upload-pages-artifact@v3`** envoie `dist/` comme artefact Pages.

### Job `deploy`

Il attend la fin du job `build`, puis **`actions/deploy-pages@v4`** publie l'artefact dans l'environnement
`github-pages`. L'URL du site s'affiche dans le résumé du run.

### Prérequis côté dépôt (à faire une fois)

**Settings → Pages → Build and deployment → Source : GitHub Actions.**

**Settings → General → Default branch : `main`.** Les tâches planifiées partent de la branche par défaut, et seule
celle-ci a le droit de publier sur GitHub Pages.

### Bon à savoir

Sur un dépôt public, GitHub désactive les tâches planifiées après 60 jours sans activité. Si la mise à jour du
lundi s'arrête, réactive-la depuis l'onglet **Actions**.

---

## Le site : `site/index.html`

Tout tient dans un seul fichier : HTML, CSS et JavaScript, sans framework ni étape de compilation.
Seules les polices (Fredoka et Nunito) viennent de Google Fonts, et les images de TCGdex.

### Chargement

Au démarrage, le site charge en parallèle `sets.json`, `cards.json` et `meta.json`, puis construit en mémoire :

- un index de recherche (noms FR + EN sans accents) ;
- pour chaque nom anglais, la liste des cartes qui le portent, de la plus ancienne à la plus récente.

`texts.json` n'est chargé qu'à l'ouverture de la première fiche.

### Navigation

La navigation passe par l'ancre de l'URL : chaque page a sa propre adresse, que l'on peut partager ou mettre en favori.

| URL                          | Vue                                         |
|------------------------------|---------------------------------------------|
| `#/`                         | Accueil : chiffres clés et 12 dernières sorties |
| `#/set/<identifiant>`        | Une extension (ex. `#/set/sv07`, `#/set/base1`) |
| texte dans la barre de recherche (2 caractères ou plus) | Résultats de recherche |

### Images

Adresse : `https://assets.tcgdex.net/<langue>/<série>/<extension>/<numéro>/low.webp` (≈ 245 × 342 px).
Le site prend d'abord l'image dans la langue choisie, puis l'autre langue si elle manque. Si TCGdex n'a la carte dans
aucune langue, il prend l'image anglaise de [pokemontcg.io](https://pokemontcg.io) (images.pokemontcg.io, ou
images.scrydex.com pour les extensions récentes). Si rien ne se charge, la pochette affiche le nom de la carte à la place.

### Énergies

Les types, coûts d'attaque, faiblesses, résistances et coûts de retraite sont affichés avec des pastilles de couleur.
Les symboles écrits dans les textes (`{R}`, `{W}`, `{C}`…) sont remplacés par les mêmes pastilles.

### Inclinaison

- Un seul écouteur `pointermove` sur toute la page, avec une mise à jour par image affichée (`requestAnimationFrame`).
- La position du curseur pilote des variables CSS (`--rx`, `--ry`, `--mx`, `--my`…) qui règlent la rotation 3D,
  la position du reflet et l'ombre.
- Pas d'effet au doigt sur écran tactile, ni quand l'utilisateur demande de réduire les animations.

### Préférences mémorisées

Le site enregistre deux préférences dans le navigateur (`localStorage`) : la langue (`pkm-lang`) et le tri des
extensions (`pkm-sort`). Si le navigateur bloque le stockage, le site fonctionne quand même avec les valeurs par défaut.

---

## Format des données générées

Tous les fichiers sont dans `dist/data/`.

### `cards.json` : objet indexé par identifiant de carte (`<extension>-<numéro>`, ex. `base1-4`)

| Clé   | Sens                                         | Exemple                         |
|-------|----------------------------------------------|---------------------------------|
| `n`   | Nom anglais                                  | `"Charizard"`                   |
| `nf`  | Nom français (si différent)                  | `"Dracaufeu"`                   |
| `s`   | Identifiant de l'extension                   | `"base1"`                       |
| `l`   | Numéro dans l'extension                      | `"4"`                           |
| `c`   | Catégorie : `P` Pokémon, `T` Dresseur, `E` Énergie | `"P"`                     |
| `r`   | Rareté (en anglais, traduite par le site)    | `"Rare Holo"`                   |
| `hp`  | Points de vie                                | `120`                           |
| `ty`  | Types                                        | `["Fire"]`                      |
| `st`  | Stade                                        | `"Stage2"`                      |
| `ev`  | Évolue de `[anglais, français]`              | `["Charmeleon", "Reptincel"]`   |
| `tt`  | Type de Dresseur                             | `"Supporter"`                   |
| `et`  | Type d'Énergie                               | `"Special"`                     |
| `w`, `re` | Faiblesses, résistances `[[type, valeur]]` | `[["Water", "×2"]]`           |
| `rt`  | Coût de retraite                             | `3`                             |
| `dx`  | Numéros du Pokédex national                  | `[6]`                           |
| `rm`  | Marque de régulation                         | `"G"`                           |
| `il`  | Illustrateur                                 | `"Mitsuhiro Arita"`             |
| `v`   | Versions imprimées                           | `["holo", "firstEdition"]`      |
| `im`  | Images TCGdex disponibles : 1 = FR, 2 = EN, 3 = les deux | `3`                 |
| `pi`  | Image de secours pokemontcg.io (chemin après `images.pokemontcg.io/`, ou adresse complète) | `"base1/4.png"` |

### `sets.json`

```json
{ "series": [{ "id": "sv", "n": "Scarlet & Violet", "nf": "Écarlate et Violet" }, ...],
  "sets": [{ "id": "sv07", "c": "SCR", "n": "Stellar Crown", "nf": "Couronne Stellaire", "d": "2024-09-13",
             "s": "sv", "o": 142, "k": ["sv07-001", "sv07-002", ...] }, ...] }
```

`c` est le code officiel imprimé sur les cartes, `o` le nombre de cartes numérotées (le « 142 » de `001/142`),
`k` la liste des cartes dans l'ordre. `d` vaut `null` si la date est inconnue.

### `texts.json`

```json
{ "<id>": { "a": [[genre, type de talent, coût, nom EN, nom FR, dégâts, effet EN, effet FR], ...],
            "e": ["effet EN", "effet FR"], "d": ["description EN", "description FR"] } }
```

`genre` vaut `0` pour une attaque, `1` pour un talent, `2` pour un objet tenu (anciennes cartes). Une valeur française
absente ou vide signifie qu'elle n'existe pas ou qu'elle est identique à l'anglaise.

### `meta.json`

`{ "builtAt": "2026-10-09T08:12:00.000Z", "cards": 21393, "sets": 204, "commit": "abc1234", "images": true }` :
date du build, totaux, version de la base TCGdex utilisée, et si la liste des images a pu être lue.

---

## Travailler en local

Prérequis : **Node 20 ou plus** et **git**. Il n'y a rien à installer.

```bash
# Build : clone la base TCGdex dans .cache/tcgdex la première fois, puis la met à jour
node scripts/build.mjs

# Servir le site
npx serve dist        # ou : python3 -m http.server -d dist
```

Il faut passer par un serveur : ouvrir `dist/index.html` directement (`file://`) ne marche pas, car le navigateur
bloque le chargement des fichiers JSON.

Pour modifier le site, édite `site/index.html`, puis relance `node scripts/build.mjs`, ou copie simplement le fichier
dans `dist/`.

---

## Réglages

| Réglage            | Où                                   | Défaut | Effet                                                 |
|--------------------|--------------------------------------|--------|-------------------------------------------------------|
| `TILT_MAX`         | haut du script de `site/index.html`  | `14`   | Angle maximal d'inclinaison, en degrés                |
| `TILT_DIR`         | haut du script de `site/index.html`  | `1`    | `1` : le coin sous le curseur s'enfonce ; `-1` : il se soulève |
| `SEARCH_LIMIT`     | haut du script de `site/index.html`  | `150`  | Nombre maximal de résultats de recherche affichés     |
| `EXCLUDED_SERIES`  | haut de `scripts/build.mjs`          | `tcgp` | Séries à ne pas afficher                              |
| `TCGDEX_DIR`       | variable d'environnement             | —      | Chemin d'une copie locale de la base TCGdex           |
| `PTCG_DIR`         | variable d'environnement             | —      | Chemin d'une copie locale de la base pokemontcg.io    |
| `SKIP_IMAGES_LIST` | variable d'environnement             | —      | `1` : ne lit pas `datas.json` (le site essaie FR puis EN) |
| Planification      | `cron` dans `deploy.yml`             | lundi 4 h UTC | Fréquence de mise à jour automatique           |

---

## Dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| Page 404 sur l'URL du site | Pages pas configuré, ou premier déploiement pas encore fini | Vérifier **Settings → Pages** (source « GitHub Actions ») et l'onglet **Actions** |
| « Les données du classeur sont introuvables » | `data/*.json` absents (site servi sans build) | Lancer `node scripts/build.mjs` et servir `dist/` |
| Le run échoue sur `Base TCGdex inattendue` | Clonage incomplet ou base réorganisée | Relancer avec **Run workflow** ; l'ancien site reste en ligne |
| Le run signale des fichiers illisibles | Nouvelle syntaxe dans quelques fiches TCGdex | Ces cartes manquent jusqu'à la correction du lecteur dans `loadTs` |
| Certaines cartes sans image | Ni TCGdex ni pokemontcg.io n'ont de scan (kits du dresseur, certaines promos) | Elles apparaîtront quand l'une des deux bases les ajoutera |
| Image anglaise alors que FR est choisi | Pas de scan français pour cette carte | Normal, le site prend l'autre langue en secours |
| Nom anglais alors que FR est choisi | Carte pas encore traduite dans TCGdex | Normal, le site prend l'anglais en secours |
| Plus de mise à jour le lundi | Tâche planifiée désactivée après 60 jours sans activité | La réactiver depuis l'onglet **Actions** |

---

## Crédits et mentions légales

- Données et images : [TCGdex](https://tcgdex.dev) ([tcgdex/cards-database](https://github.com/tcgdex/cards-database),
  licence MIT).
- Pokémon et les visuels des cartes appartiennent à **Nintendo**, **Creatures Inc.** et **GAME FREAK inc.**
  (The Pokémon Company).
- Projet de fan **non officiel**, sans but commercial, sans lien avec Nintendo ni The Pokémon Company.
