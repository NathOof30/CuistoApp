# Gestion Culinaire – Guide d’utilisation (offline)

## Prérequis
- Windows, macOS ou Linux
- Une des options suivantes pour servir les fichiers localement (pas d’Internet requis) :
  - Python (recommandé) – version 3.x
  - OU Node.js + npx

## Lancer l’application en local
### Méthode la plus simple (Windows, double-clic)
- Double-cliquez sur `start-server.bat` à la racine du projet. Le serveur démarre et votre navigateur s’ouvre sur l’application.

### Méthode manuelle (tous OS)
1. Ouvrez PowerShell (Windows) ou Terminal (macOS/Linux).
2. Placez-vous dans le dossier du projet:
```powershell
cd "C:\Users\natha\OneDrive\Documents\H\HTML\tableau_de_bord___gestion_culinaire_by_Nath"
```
3. Démarrez un petit serveur local (choisissez UNE option) :
   - Option Python:
```powershell
py -m http.server 5500
```
   - Option Node.js (si Node est installé):
```powershell
npx http-server -p 5500 -c-1
```
4. Ouvrez votre navigateur sur:
```
http://localhost:5500/index.html
```

Important: Ouvrir directement les fichiers en `file://` désactive les modules ES et l’app ne fonctionne pas. Le petit serveur local est nécessaire même hors-ligne.

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
- L’application fonctionne entièrement hors-ligne une fois servie localement.
- L’export CSV du bon d’économat est accessible après génération du bon.
