#!/usr/bin/env node
// Construit le site statique dans dist/ :
//  - récupère la base TCGdex (dépôt GitHub tcgdex/cards-database, noms et textes FR + EN)
//  - lit chaque série, extension et carte, puis écrit data/*.json
//  - demande à TCGdex la liste des images disponibles (assets.tcgdex.net/datas.json)
//  - récupère la base pokemontcg.io (dépôt GitHub PokemonTCG/pokemon-tcg-data) pour les images de secours
//  - copie site/ dans dist/
//
// Variables d'environnement :
//   TCGDEX_DIR=chemin    utilise une copie locale de la base au lieu de la cloner dans .cache/
//   PTCG_DIR=chemin      utilise une copie locale de la base pokemontcg.io au lieu de la cloner dans .cache/
//   SKIP_IMAGES_LIST=1   ne télécharge pas la liste des images (le site essaie FR puis EN)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');
const REPO_URL = 'https://github.com/tcgdex/cards-database.git';
const REPO_DIR = process.env.TCGDEX_DIR ? path.resolve(process.env.TCGDEX_DIR) : path.join(ROOT, '.cache', 'tcgdex');
const PTCG_URL = 'https://github.com/PokemonTCG/pokemon-tcg-data.git';
const PTCG_DIR = process.env.PTCG_DIR ? path.resolve(process.env.PTCG_DIR) : path.join(ROOT, '.cache', 'ptcg');
const PTCG_IMG = 'https://images.pokemontcg.io/';
const IMAGES_LIST = 'https://assets.tcgdex.net/datas.json';
const SKIP_IMAGES_LIST = process.env.SKIP_IMAGES_LIST === '1';
const EXCLUDED_SERIES = new Set(['tcgp']); // Pokémon TCG Pocket : jeu mobile, pas de cartes physiques
const UA = 'pokemon-classeur/1.0 (site de fan statique)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt >= tries) throw new Error(`${url} : ${err.message}`);
      await sleep(1000 * 2 ** attempt);
    }
  }
}

const git = (...args) => execFileSync('git', args, { stdio: ['ignore', 'inherit', 'inherit'] });
const validDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

// Les fichiers de la base sont du TypeScript très simple (un objet littéral exporté) :
// on retire les imports et les annotations de type, puis on l'évalue comme du JavaScript.
function loadTs(file) {
  let src = readFileSync(file, 'utf8');
  const params = [];
  src = src.replace(/^\s*import\s+(?:type\s+)?([^;\n]*?)\s+from\s+(['"])(?:\\.|(?!\2).)*\2;?[ \t]*$/gm, (_, what) => {
    const def = what.match(/^([A-Za-z_$][\w$]*)/);
    if (def) params.push(def[1]);
    return '';
  });
  src = src.replace(/\b(const|let)\s+([\w$]+)\s*:\s*[\w$.<>[\]|\s]+?=/g, '$1 $2 =');
  src = src.replace(/^\s*export\s+default\s+([\w$]+)\s*;?\s*$/m, 'return $1;');
  return new Function(...params, src)();
}

const tsFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.ts') && statSync(path.join(dir, f)).isFile());
const txt = (o) => (o && typeof o === 'object' ? [o.en || '', o.fr && o.fr !== o.en ? o.fr : ''] : ['', '']);
const trim = (a) => { while (a.length && (a[a.length - 1] === '' || a[a.length - 1] == null)) a.pop(); return a; };

// Clone un dépôt dans .cache/ la première fois, puis ne récupère que les changements
async function syncRepo(label, url, dir, local) {
  if (local) {
    console.log(`→ ${label} locale : ${dir}`);
  } else if (existsSync(path.join(dir, '.git'))) {
    console.log(`→ Mise à jour de ${label}…`);
    git('-C', dir, 'fetch', '--depth', '1', '-q', 'origin', 'HEAD');
    git('-C', dir, 'reset', '--hard', '-q', 'FETCH_HEAD');
  } else {
    console.log(`→ Clonage de ${label}…`);
    await mkdir(path.dirname(dir), { recursive: true });
    git('clone', '--depth', '1', '-q', url, dir);
  }
}

// ---------- 1. Base de données ----------
await syncRepo('la base TCGdex', REPO_URL, REPO_DIR, process.env.TCGDEX_DIR);
const DATA = path.join(REPO_DIR, 'data');
const commit = (() => {
  try { return execFileSync('git', ['-C', REPO_DIR, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch { return null; }
})();

let images = null;
if (!SKIP_IMAGES_LIST) {
  console.log('→ Liste des images…');
  try {
    images = await get(IMAGES_LIST);
  } catch (err) {
    console.warn(`  Liste des images indisponible, le site essaiera FR puis EN (${err.message})`);
  }
}
const hasImage = (lang, serie, set, local) => Boolean(images?.[lang]?.[serie]?.[set]?.[local]);

// ---------- 2. Séries, extensions et cartes ----------
const cards = {};
const texts = {};
const sets = [];
const series = [];
let failed = 0;
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function variantsOf(v) {
  const out = new Set();
  if (Array.isArray(v)) {
    for (const x of v) {
      if (x?.size === 'jumbo') continue;
      if (x?.type) out.add(x.type);
      if (x?.stamp?.includes?.('1st-edition') || x?.subtype === '1st-edition') out.add('firstEdition');
    }
  } else if (v && typeof v === 'object') {
    for (const [k, on] of Object.entries(v)) if (on === true) out.add(k);
  }
  return [...out];
}

for (const serieFile of tsFiles(DATA)) {
  const serieDir = path.join(DATA, serieFile.slice(0, -3));
  if (!existsSync(serieDir)) continue;
  const serie = loadTs(path.join(DATA, serieFile));
  if (!serie?.id || EXCLUDED_SERIES.has(serie.id)) continue;
  const [sn, snf] = txt(serie.name);
  const serieSets = [];

  for (const setFile of tsFiles(serieDir)) {
    const setDir = path.join(serieDir, setFile.slice(0, -3));
    if (!existsSync(setDir)) continue;
    let set;
    try { set = loadTs(path.join(serieDir, setFile)); } catch (err) { console.warn(`  ${setFile} : ${err.message}`); failed++; continue; }
    if (!set?.id) continue;
    const [n, nf] = txt(set.name);
    if (!n && !nf) continue;
    const official = set.cardCount?.official;
    const s = {
      id: set.id,
      c: set.abbreviations?.official || set.tcgOnline || '',
      n: n || nf,
      ...(nf ? { nf } : {}),
      d: validDate(set.releaseDate),
      s: serie.id,
      ...(official ? { o: official } : {}),
      k: [],
    };

    for (const cardFile of tsFiles(setDir)) {
      const local = cardFile.slice(0, -3);
      let c;
      try { c = loadTs(path.join(setDir, cardFile)); } catch (err) { console.warn(`  ${set.id}/${cardFile} : ${err.message}`); failed++; continue; }
      const [cn, cnf] = txt(c?.name);
      if (!cn && !cnf) continue; // carte sans nom FR ni EN (ex. sortie uniquement en Asie)
      const id = `${set.id}-${local}`;
      const o = { n: cn || cnf, s: set.id, l: local, c: (c.category || 'Pokemon')[0] };
      if (cnf) o.nf = cnf;
      if (c.rarity && c.rarity !== 'None') o.r = c.rarity;
      if (c.hp != null) o.hp = c.hp;
      if (c.types?.length) o.ty = c.types;
      if (c.stage) o.st = c.stage;
      if (c.evolveFrom) { const [e, ef] = txt(c.evolveFrom); if (e || ef) o.ev = trim([e || ef, ef]); }
      if (c.trainerType) o.tt = c.trainerType;
      if (c.energyType) o.et = c.energyType;
      if (c.illustrator) o.il = c.illustrator;
      if (c.dexId?.length) o.dx = c.dexId;
      if (c.regulationMark && c.regulationMark !== 'None') o.rm = c.regulationMark.toUpperCase();
      if (c.weaknesses?.length) o.w = c.weaknesses.map((x) => [x.type, x.value || '']);
      if (c.resistances?.length) o.re = c.resistances.map((x) => [x.type, x.value || '']);
      if (c.retreat != null) o.rt = c.retreat;
      const v = variantsOf(c.variants);
      if (v.length) o.v = v;
      if (images) {
        const im = (hasImage('fr', serie.id, set.id, local) ? 1 : 0) | (hasImage('en', serie.id, set.id, local) ? 2 : 0);
        if (im) o.im = im;
      } else o.im = 3;
      cards[id] = o;
      s.k.push(id);

      // Textes : talents et attaques, effet (Dresseur / Énergie), description du Pokédex
      const t = {};
      const moves = [];
      for (const a of c.abilities ?? []) moves.push(trim([1, a.type || '', [], ...txt(a.name), '', ...txt(a.effect)]));
      if (c.item) moves.push(trim([2, '', [], ...txt(c.item.name), '', ...txt(c.item.effect)]));
      for (const a of c.attacks ?? []) moves.push(trim([0, '', a.cost ?? [], ...txt(a.name), a.damage != null ? String(a.damage) : '', ...txt(a.effect)]));
      if (moves.length) t.a = moves;
      if (c.effect) t.e = trim(txt(c.effect));
      if (c.description) t.d = trim(txt(c.description));
      if (Object.keys(t).length) texts[id] = t;
    }

    if (!s.k.length) continue;
    s.k.sort((a, b) => collator.compare(cards[a].l, cards[b].l));
    sets.push(s);
    serieSets.push(s);
  }

  if (serieSets.length) series.push({ id: serie.id, n: sn || snf, ...(snf ? { nf: snf } : {}) });
}

sets.sort((a, b) => (b.d || '').localeCompare(a.d || '') || collator.compare(a.n, b.n));
const nCards = Object.keys(cards).length;
if (nCards < 5000 || sets.length < 50) throw new Error(`Base TCGdex inattendue : ${nCards} cartes, ${sets.length} extensions`);
let withImage = Object.values(cards).filter((c) => c.im).length;
if (images && withImage < nCards / 2) {
  // La liste a sans doute changé de format : on laisse le site essayer FR puis EN pour chaque carte
  console.warn(`  Liste des images suspecte (${withImage} images pour ${nCards} cartes), elle est ignorée`);
  for (const c of Object.values(cards)) c.im = 3;
  images = null;
  withImage = nCards;
}
console.log(`  ${nCards} cartes, ${sets.length} extensions, ${series.length} séries, ${Object.values(cards).filter((c) => c.nf).length} noms français, ${withImage} images TCGdex`);
if (failed) console.warn(`  ${failed} fichier(s) illisible(s), ignoré(s)`);

// ---------- 3. Images de secours (pokemontcg.io) ----------
// Les identifiants d'extension diffèrent entre les deux bases (sv07 / sv7, swsh3.5 / swsh35…) :
// chaque extension TCGdex est associée à l'extension pokemontcg.io dont le plus de cartes ont
// le même numéro et le même nom anglais (au moins la moitié).
let backups = 0;
try {
  await syncRepo('la base pokemontcg.io', PTCG_URL, PTCG_DIR, process.env.PTCG_DIR);
  const num = (n) => String(n).toUpperCase().replace(/^([A-Z]*)0+(?=\d)/, '$1');
  const simple = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  const ptcg = [];
  const dir = path.join(PTCG_DIR, 'cards', 'en');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const byNum = new Map();
    for (const c of JSON.parse(readFileSync(path.join(dir, f), 'utf8'))) {
      const img = c.images?.small;
      // Chemin court pour images.pokemontcg.io, adresse complète pour les autres hébergeurs (ex. images.scrydex.com)
      if (/^https:\/\//.test(img || '')) byNum.set(num(c.number), [simple(c.name), img.startsWith(PTCG_IMG) ? img.slice(PTCG_IMG.length) : img]);
    }
    ptcg.push(byNum);
  }
  for (const s of sets) {
    let best = null;
    let score = 0;
    for (const byNum of ptcg) {
      let n = 0;
      for (const id of s.k) if (byNum.get(num(cards[id].l))?.[0] === simple(cards[id].n)) n++;
      if (n > score) { score = n; best = byNum; }
    }
    if (!best || score < s.k.length / 2) continue;
    for (const id of s.k) {
      const p = best.get(num(cards[id].l));
      if (p) { cards[id].pi = p[1]; backups++; }
    }
  }
} catch (err) {
  console.warn(`  Base pokemontcg.io indisponible, pas d'images de secours (${err.message})`);
}
const noImage = Object.values(cards).filter((c) => !c.im && !c.pi).length;
console.log(`  ${backups} images de secours, ${noImage} carte(s) sans aucune image`);
// ---------- 4. dist/ ----------
console.log('→ Écriture de dist/');
await rm(DIST, { recursive: true, force: true });
await cp(SITE, DIST, { recursive: true });
await mkdir(path.join(DIST, 'data'), { recursive: true });
await writeFile(path.join(DIST, 'data', 'cards.json'), JSON.stringify(cards));
await writeFile(path.join(DIST, 'data', 'sets.json'), JSON.stringify({ series, sets }));
await writeFile(path.join(DIST, 'data', 'texts.json'), JSON.stringify(texts));
await writeFile(path.join(DIST, 'data', 'meta.json'), JSON.stringify({ builtAt: new Date().toISOString(), cards: nCards, sets: sets.length, commit, images: Boolean(images) }));
await writeFile(path.join(DIST, '.nojekyll'), '');
console.log('✓ Terminé');
