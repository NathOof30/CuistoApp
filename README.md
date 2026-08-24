# Application de Gestion Culinaire

Application web front-end (100% navigateur) de gestion de cuisine pour restaurateurs, traiteurs et pâtissiers.
L'application permet de gérer une **Mercuriale** (achats d'ingrédients), de construire des **Fiches Techniques (Recettes)** et de calculer le **coût de revient réel (Prime Cost SAS)**, la **marge nette** et la **rentabilité horaire (€/h)**, de suivre les **14 allergènes UE**, et de générer un **Bon d'Économat** avec devis et exports multi-formats.

---

## Accès en ligne (GitHub Pages)

- **URL de déploiement :** [https://nathoof30.github.io/CuistoApp/](https://nathoof30.github.io/CuistoApp/)

---

## ⚡ Exécution locale rapide

En raison de l'utilisation des **ES Modules JavaScript (`import` / `export`)**, l'ouverture directe d'un fichier `.html` via le protocole `file://` (ex: double-clic sur `index.html`) provoque un blocage de sécurité du navigateur (CORS).

Pour exécuter l'application localement, vous devez la servir avec un serveur HTTP local simple.

### Option A : Avec Python 3 (préinstallé sur la plupart des systèmes)
1. Ouvrez un terminal dans le dossier du projet : `c:\Users\natha\OneDrive\Documents\H\HTML\app_gest - modif`
2. Lancez le serveur :
   ```bash
   py -m http.server 5500
   ```
3. Ouvrez votre navigateur sur : [http://localhost:5500/index.html](http://localhost:5500/index.html)

### Option B : Avec Node.js (`http-server`)
1. Lancez directement la commande :
   ```bash
   npx http-server -p 5500 -c-1
   ```
2. Ouvrez votre navigateur sur : [http://localhost:5500/index.html](http://localhost:5500/index.html)

---

## 📂 Gestion des données et première visite

- Si aucune donnée n'est enregistrée dans votre navigateur (`localStorage`), l'application charge automatiquement la démo (`sample-data.json`) et affiche une modale d'accueil vous proposant de conserver ces exemples ou de repartir d'une base vierge.
- Vous pouvez à tout moment **Exporter** (`backup-cuisine-YYYY-MM-DD.json`) ou **Importer** vos données au format JSON depuis le Tableau de bord.

---

## 🚀 Utilisation rapide

- **Tableau de bord :** Vue d'ensemble (KPIs), santé de la mercuriale, panneau de notifications, modification des **Paramètres Globaux de Simulation** (Coût horaire chargé SAS, Frais généraux, Marge nette cible, TVA) et bascule de **thème sombre/clair**.
- **Mercuriale :** Ajoutez/éditez vos denrées, triez le tableau par en-tête de colonne, filtrez par recherche ou famille, sélectionnez les allergènes UE et saisissez des familles personnalisées avec `[Autre...]`.
- **Recettes :** Créez vos fiches techniques, triez le tableau par colonne, dupliquez des recettes en 1 clic, observez les marges et rentabilités horaires recalculées en temps réel et consultez la modale d'allergènes et de détails KPIs.
- **Bon d'économat :** Sélectionnez vos recettes et le nombre de portions, obtenez la synthèse des ingrédients et le devis commercial, puis exportez la commande au format **CSV**, **TXT tabulé (TSV)** ou **TXT à colonnes fixes**.

---

## 🛠️ Structure du projet

- `index.html` : Tableau de bord principal (stats, notifications, paramètres globaux).
- `mercuriale.html` : Gestion de la mercuriale d'ingrédients.
- `recettes.html` : Gestion des fiches techniques et calculs financiers.
- `bon-economat.html` : Générateur de bon de commande et devis.
- `style.css` : Styles globaux, thèmes clair/sombre et responsive UI.
- `data.js` : Modèle de données central, constantes par défaut et fonctions de calculs financiers Prime Cost SAS.
- `app.js` : Point d'entrée principal (initialisation, gestionnaire de thème sombre, ajustements d'affichage).
- `js/` : Modules JavaScript ES6 :
  - `common.js` : Fonctions utilitaires de formatage monétaire (arrondis réglementaires), quantités, pourcentages et durées.
  - `dashboard.js` : Gestion des KPIs du tableau de bord, alertes mercuriale et sauvegarde des paramètres globaux.
  - `mercuriale.js` : Gestion du tableau de la mercuriale, filtres, tri par colonne et modales d'ingrédient.
  - `recettes.js` : Gestion du tableau des recettes, calcul des marges en direct, tri, duplication et modales de détails/allergènes.
  - `bon-economat.js` : Calcul de la liste de courses agrégée, devis commercial et exports multi-formats (CSV/TXT).
  - `data-management.js` : Import/export de fichiers JSON et modale d'initialisation.
  - `ui-feedback.js` : Notifications toast dynamiques et modales de confirmation.
- `sample-data.json` : Jeu de données de démonstration initial.
- `DESCRIPTION_PROJET.md` : Cahier des charges et documentation technique complète.
- `CALCULS_APPLICATION.txt` : Guide détaillé des formules de calculs financiers (Prime Cost SAS v3.0).

---

## 📄 Licence & Crédits

Projet d'application de gestion culinaire autonome. Développé pour la gestion des coûts en restauration artisanale et traiteur.
