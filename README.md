# Gestion Culinaire – Guide d’utilisation

L'application est hébergée en ligne et accessible directement :
👉 **[Accéder à l'application sur GitHub Pages](https://nathoof30.github.io/CuistoApp/)**

---

## Lancer l’application en local (Optionnel)

Si vous préférez utiliser l'application hors-ligne ou localement, suivez les instructions ci-dessous.

### Prérequis (pour l'usage local uniquement)
- Windows, macOS ou Linux
- Une des options suivantes pour servir les fichiers :
  - Python (recommandé) – version 3.x
  - OU Node.js + npx

### Lancement local
1. Ouvrez un terminal (PowerShell ou Terminal).
2. Placez-vous dans le dossier du projet.
3. Démarrez un serveur local (choisissez UNE option) :
   - **Option Python :**
     ```powershell
     py -m http.server 5500
     ```
   - **Option Node.js :**
     ```powershell
     npx http-server -p 5500 -c-1
     ```
4. Ouvrez votre navigateur sur `http://localhost:5500/index.html`.

> [!NOTE]
> Ouvrir directement les fichiers HTML en double-cliquant dessus (`file://`) désactive les modules ES et l’application ne fonctionnera pas. Un serveur local est donc indispensable pour l'usage local.
> Le script `start-server.bat` n'est plus activement recommandé et l'usage en ligne ou via les commandes ci-dessus est préférable.

## Données d’exemple
- Un fichier `sample-data.json` est inclus à la racine du projet.
- Au premier démarrage, une modale s’affiche:
  - Cliquez « Charger un fichier de sauvegarde (.json) » et sélectionnez `sample-data.json`.
  - Ou « Commencer avec les données d’exemple » pour enregistrer les données par défaut intégrées.

## Utilisation rapide
- Tableau de bord (index):
  - Importer/Exporter les données (JSON)
  - Accès rapide aux Recettes, Mercuriale, Bon d’économat
- Recettes:
  - « Ajouter une recette » → renseignez nom, portions, multiplicateur et ingrédients (choisir les denrées de la mercuriale)
  - Les coûts et prix de vente s’actualisent en temps réel
- Mercuriale:
  - « Ajouter une denrée » → nom, unité (kg, L, pièce…), prix HT (facultatif), famille/sous-famille
- Bon d’économat:
  - Ajoutez une ou plusieurs recettes, indiquez le nombre de portions à produire
  - Cliquez « Générer le bon d’économat »
  - Export possible en CSV (PDF supprimé)

## Import / Export JSON
- Export: depuis le tableau de bord, bouton « Exporter les données (.json) » → un fichier `backup-cuisine-YYYY-MM-DD.json` est téléchargé
- Import: bouton « Importer les données (.json) » → sélectionnez votre fichier de sauvegarde (doit contenir les clefs `mercuriale` et `recipes`)

## Dépannage
- Rien ne marche en double-cliquant sur `index.html`:
  - Utilisez l’une des commandes « Lancer l’application en local » ci-dessus et ouvrez `http://localhost:5500/index.html`
- Les données ne s’affichent pas ou semblent corrompues:
  - Videz le stockage local du navigateur, puis rechargez la page
    - Ouvrez la console (F12), onglet Console, tapez:
```js
localStorage.clear();
location.reload();
```
  - Réimportez `sample-data.json` si besoin
- L’export PDF n’existe pas:
  - C’est normal: la fonction PDF a été retirée. Utilisez l’export CSV.

## Structure du projet (résumé)
- `index.html`, `recettes.html`, `mercuriale.html`, `bon-economat.html`: pages principales
- `app.js`: point d’entrée – initialise la page courante
- `data.js`: données (recettes, mercuriale), persistance locale et utilitaires
- `js/*.js`: logique par page et utilitaires (formatage, gestion des données)
- `style.css`: styles
- `sample-data.json`: jeu de données d’exemple à importer

## Notes
- L’application fonctionne entièrement dans le navigateur, soit directement en ligne via GitHub Pages, soit hors-ligne en local.
- L’export CSV du bon d’économat est accessible après génération du bon.
