# Gabon Bijoux Style — Site web

## Structure du projet
```
gabon-bijoux-style/
├── index.html        → Accueil
├── boutique.html      → Catalogue des produits
├── commander.html     → Formulaire de commande (envoie sur WhatsApp)
├── apropos.html       → Histoire de la marque
├── contact.html       → Horaires, WhatsApp, Instagram
├── css/style.css      → Tous les styles (couleurs, polices, mise en page)
├── js/main.js         → Menu mobile + animations au scroll
├── js/commande.js     → Construit le message WhatsApp depuis le formulaire
└── images/            → Tes photos de produits
```

## Ouvrir le projet dans VS Code
1. Décompresse le dossier `gabon-bijoux-style`.
2. Dans VS Code : `Fichier > Ouvrir le dossier` → sélectionne `gabon-bijoux-style`.
3. Installe l'extension **Live Server** (par Ritwick Dey) pour prévisualiser le site avec les liens et le formulaire qui fonctionnent (clic droit sur `index.html` → "Open with Live Server").

⚠️ Ouvrir juste le fichier HTML en double-clic (`file://...`) fonctionne pour regarder, mais certaines fonctions JS (comme le pré-remplissage du produit) marchent mieux via Live Server ou une fois en ligne.

## Ajouter tes vraies photos
1. Dépose tes photos dans le dossier `images/` avec ces noms : `produit-1.jpg`, `produit-2.jpg`, etc.
2. Tant qu'une photo n'existe pas, un visuel provisoire (diamant doré) s'affiche automatiquement à la place — pas de page cassée.
3. Pour ajouter un 7ᵉ produit, copie un bloc `<div class="card">...</div>` dans `boutique.html` et adapte le nom, le prix et le lien de commande.

## Vérifier le numéro WhatsApp
Le numéro utilisé pour recevoir les commandes est dans `js/commande.js`, ligne 2 :
```js
const WHATSAPP_NUMBER = "24107049872";
```
Fais un test de commande une fois le site en ligne pour vérifier que le message WhatsApp arrive bien sur ton téléphone. Si ce n'est pas le cas, ajuste ce numéro (garder le format international, sans le `+`).

## Mettre le site en ligne (Netlify — gratuit)
1. Va sur [netlify.com](https://www.netlify.com) et crée un compte gratuit.
2. Une fois connectée, glisse-dépose tout le dossier `gabon-bijoux-style` sur la page d'accueil de ton tableau de bord ("Drag and drop your site folder here").
3. Netlify te donne une adresse en quelques secondes (ex : `gabon-bijoux-style.netlify.app`).
4. Tu pourras ensuite connecter un vrai nom de domaine (ex : `gabonbijouxstyle.com`) depuis les réglages du site sur Netlify.

## Couleurs et polices
Tout se change en un seul endroit : en haut de `css/style.css`, dans `:root { ... }` — les variables `--noir`, `--or`, `--creme` etc. contrôlent toute la palette du site.
