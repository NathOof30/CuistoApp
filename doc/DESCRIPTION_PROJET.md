# 🍽️ Documentation du Projet : Application de Gestion Culinaire

Ce document décrit en détail l'architecture, les fonctionnalités et la structure de données de votre application web de gestion culinaire. Il sert de cahier des charges et de référence technique globale.

---

## 1. 🎯 Présentation et Objectif de l'Application

L'Application de Gestion Culinaire est une solution professionnelle 100 % front-end (fonctionnant directement dans le navigateur) destinée aux restaurateurs, traiteurs ou pâtissiers. Elle leur permet de :
- Gérer intelligemment leurs achats (Mercuriale).
- Créer des fiches techniques de recettes optimisées.
- Estimer précisément la **rentabilité réelle** (intégrant la main d'œuvre et les frais généraux via la méthode **Prime Cost SAS**) de chaque plat.
- Suivre les 14 allergènes à déclaration obligatoire (règlement UE 1169/2011).
- Générer des bons d'économat (listes de courses) combinables avec devis commercial et exports multi-formats.

---

## 2. 🏛️ Architecture Technique

Il s'agit d'une application **Single-Page Application (SPA) / Multi-Pages asynchrone** statique mais riche, fonctionnant sans backend serveur. 

*   **Langages :** HTML5, CSS3 modulaire (orienté composants modernes : Grid/Flex, variables CSS, mode sombre/clair avec bascule dynamique dans le header).
*   **JavaScript :** Vanilla JS modulaire (ES6 modules).
*   **Persistance des données :** Le `localStorage` du navigateur est utilisé comme base de données locale (simulation d'une base de données NoSQL via du JSON).
*   **Structuration des dossiers :**
    *   `*.html` : Vues de l'application (`index.html`, `mercuriale.html`, `recettes.html`, `bon-economat.html`).
    *   `style.css` : Feuille de style globale (incluant thèmes clair/sombre, modales, tableaux et badges).
    *   `data.js` : Modèle de données (recettes, mercuriale, 14 allergènes UE), règles métier, constantes dynamiques de simulation et fonctions de calcul de rentabilité (Prime Cost SAS).
    *   `app.js` : Point d'entrée global (initialisation de la page, gestion du thème sombre, calcul dynamique du décalage du header sticky et raccourcis globaux des modales).
    *   `js/` : Modules métier organisés par responsabilité :
        *   `common.js` : Fonctions d'arrondi monétaire strict (`formatCurrency`, `formatCurrency3`), formatage des quantités selon l'unité (`formatQuantity`, `formatQuantityInput`), pourcentages et durées.
        *   `dashboard.js` : Contrôleur du Tableau de Bord (statistiques clés, santé de la mercuriale, panneau de notifications et formulaire des paramètres globaux de simulation).
        *   `mercuriale.js` : Gestion de la mercuriale (rendu du tableau, tri par colonne, recherche, filtre par famille, sélection dynamique avec option `[Autre...]`, modale d'inspection de denrée).
        *   `recettes.js` : Gestion des recettes (rendu du tableau, tri par colonne, calcul en temps réel des coûts et marges Prime Cost, duplication de recette, modales de détails et d'allergènes).
        *   `bon-economat.js` : Générateur de bon d'économat (agrégation des ingrédients, devis prévisionnel et exports multi-formats : CSV, TXT tabulé/TSV et TXT à colonnes fixes).
        *   `data-management.js` : Gestion de l'import/export JSON et modale de première visite.
        *   `ui-feedback.js` : Système de notifications toast et modales de confirmation.

---

## 3. 🚀 Les Différentes Fonctionnalités

L'application est divisée en 4 modules principaux (onglets).

### 📊 A. Tableau de bord (`index.html`)
- **Statistiques clés en temps réel :** Nombre total de recettes, nombre d'ingrédients en mercuriale, marge nette moyenne, recette top rentable, nombre d'ingrédients sans prix et indicateur de santé de la mercuriale.
- **Actions rapides :** Raccourcis pour ajouter rapidement une recette, ajouter une denrée ou générer un bon d'économat.
- **Paramètres de Simulation Globaux (Modifiables en direct) :**
    - Coût horaire chargé du gérant (€/h) (défaut : 22.00 €/h).
    - Frais généraux (%) (défaut : 10%).
    - Marge nette cible (%) (défaut : 25%).
    - Taux de TVA (%) (défaut : 10%).
    - *Ces réglages sont enregistrés dans le `localStorage` et recalculent instantanément l'ensemble des marges et prix suggérés de l'application.*
- **Gestion des Données (JSON) :** Importer et exporter l'intégralité de la base de données au format `.json` (`backup-cuisine-YYYY-MM-DD.json`) et outil de conversion rapide (kg → g).
- **Panneau de Notifications :** Détection automatique des ingrédients sans prix/unité/famille ou des recettes incomplètes.
- **Thème sombre / clair :** Bouton de bascule dans le menu de navigation header avec mémorisation des préférences.

### 🛒 B. Gestion de la Mercuriale (`mercuriale.html`)
Base de données des matières premières. Permet la gestion complète (CRUD) des ingrédients :
- **Ajout / Édition d'ingrédient :** Nom, unité d'achat (`g`, `L`, `pièce`, `boîte`, `lot`...), prix d'achat HT (avec gestion des prix N/A), famille et sous-famille.
- **Saisie dynamique des familles :** Menu déroulant auto-alimenté à partir des familles existantes, avec possibilité de saisir une nouvelle famille via l'option `[Autre...]`.
- **Tri interactif par colonnes :** Cliquez sur les en-têtes de tableau (Intitulé, Unité, Prix, Famille, Sous-famille) pour trier par ordre croissant ou décroissant.
- **Recherche & Filtrage :** Recherche textuelle multi-champs et filtre par famille de produit.
- **Gestion des allergènes :** Sélection d'un ou plusieurs allergènes parmi les 14 réglementaires (Gluten, Lait, Œufs, Soja, Mollusques, Sésame, etc.) avec icônes visuelles.
- **Modale de détails :** Consultation complète d'une denrée (KPIs, allergènes associés, options de modification et de suppression avec alerte d'impact sur les recettes).

### 🍳 C. Gestion des Recettes / Fiches Techniques (`recettes.html`)
Cœur du système permettant d'élaborer les plats et de calculer leur rentabilité complète selon le modèle **Prime Cost SAS**.
- **Données générales :** Nom, Nombre de portions, Etapes de préparation, Temps de production (minutes).
- **Assemblage (Nomenclature) :** Ajout dynamique de lignes d'ingrédients puisés dans la Mercuriale avec quantité et unité associée.
- **Calculs et KPIs en temps réel :**
    - Coût matière direct (Food Cost) total et par portion.
    - Coût main d'œuvre (Labor Cost) basé sur le temps de production × coût horaire chargé SAS (22.00 €/h).
    - Prime Cost (Coût matière + Main d'œuvre).
    - Frais généraux (Overhead, 10% du Prime Cost).
    - Coût complet par portion (Full Cost).
    - Coefficient Multiplicateur (CM) pour fixer le Prix HT et TTC réel.
    - **Marge brute (%)** et **Marge nette réelle (%)** (après déduction de toutes les charges).
    - **Rentabilité horaire (€/heure)** : Bénéfice net dégagé par l'entreprise par heure de cuisine travaillée.
    - **Prix de vente suggéré HT et TTC** pour atteindre la marge nette cible (25%).
- **Duplication de recette :** Dupliquez une recette existante en 1 clic pour créer facilement de nouvelles déclinaisons.
- **Tri interactif par colonnes :** Tri des recettes par Nom, Portions, Multiplicateur, Coût total, Coût/portion, PV HT, PV TTC, Marge brute, Marge nette, Rentabilité horaire.
- **Gestion dynamique des allergènes :** Avertissement visuel ⚠️ et modale d'affichage détaillé des allergènes réunis par les ingrédients de la recette.

### 📋 D. Bons d'économat (`bon-economat.html`)
Module logistique et de devis commercial.
- **Constitution de commandes :** Sélection de plusieurs recettes avec le nombre de portions souhaitées pour un événement.
- **Agrégation automatique :** Calcule les quantités exactes de chaque matière première requise, triées par ordre alphabétique.
- **Détail par recette & Synthèse globale :** Visualisation séparée du besoin par recette et du besoin cumulé total.
- **Génération de Devis Commercial :** Calcul et affichage du Chiffre d'Affaires prévisionnel (HT et TTC) de la prestation et de la marge brute globale dégagée.
- **Exports multi-formats :**
    - **Export CSV :** Téléchargement au format `.csv` pour tableurs (Excel, Calc).
    - **Export TXT tabulé (TSV) :** Fichier `.txt` avec séparateurs par tabulation.
    - **Export TXT colonnes fixes :** Fichier `.txt` lisible en texte brut avec alignement parfait sous forme de tableau.

---

## 4. 🗄️ Structure de la Base de Données (Schéma de Données JSON)

Les données sont stockées dans le `localStorage` du navigateur sous forme de tableaux d'objets JSON.

### 🍅 Table `mercuriale` (Table des ingrédients)
Contient l'ensemble des références d'achat.
```json
[
  {
    "id": 1,
    "name": "Farine T55",
    "price": 0.0012,
    "unit": "g",
    "family": "Épicerie",
    "subfamily": "Sec",
    "allergens": ["gluten"]
  }
]
```

### 🍲 Table `recipes` (Table des Recettes / Nomenclatures)
Structure arborescente intégrant une matrice d'ingrédients (Composition).
```json
[
  {
    "id": 1,
    "name": "Mousse au chocolat",
    "servings": 6,
    "multiplier": 3.5,
    "productionTime": 30,
    "steps": "Fondre le chocolat, battre les oeufs...",
    "ingredients": [
      { 
        "ingredientId": 5,
        "quantity": 200
      }
    ]
  }
]
```

### ⚙️ Variables de Configuration et Paramètres Globaux
L'application possède des paramètres par défaut modifiables en temps réel via l'interface du Tableau de bord (stockés dans `localStorage`) :
- `CHARGED_HOURLY_RATE = 22.00` : Coût horaire chargé de la main d'œuvre en cuisine (22.00 €/h par défaut).
- `OVERHEAD_RATE = 0.10` : Frais généraux évalués à 10% du Prime Cost (couvre l'énergie, l'eau, l'usure du matériel).
- `TARGET_NET_MARGIN = 0.25` : Marge nette cible par défaut de l'entreprise (25%).
- `VAT_RATE = 0.10` : Taux de TVA appliqué (10%).

### ⚠️ Table Statique : `EU_ALLERGENS`
Liste stricte des 14 allergènes majeurs du Règlement UE 1169/2011 comprenant leur `id`, `name`, `description` juridique et leur `icon` emoji (ex: `gluten`, `crustaceans`, `eggs`, `fish`, `peanuts`, `soybeans`, `milk`, `nuts`, `celery`, `mustard`, `sesame`, `sulphites`, `lupin`, `molluscs`).

---

## 5. 💡 Résumé : Pourquoi la structure de données est-elle conçue ainsi ?

1. **Relationnelle de fait :** Les recettes stockent uniquement `ingredientId`. Lorsqu'un prix d'ingrédient est modifié dans la mercuriale, les coûts, marges et devis de toutes les recettes associées sont automatiquement et instantanément mis à jour.
2. **Propagation Automatique des Allergènes :** Tout ingrédient étiqueté avec des allergènes dans la mercuriale transmet automatiquement ses avertissements allergènes à toutes les recettes qui l'utilisent.
3. **Arrondi financier garanti :** Pour l'affichage, les prix respectent une règle d'arrondi strict à la dizaine de centimes supérieure (ou centime supérieur pour les micro-prix < 0.10 €), évitant d'afficher des sous-centimes tout en protégeant les marges de l'artisan.
4. **Exécution 100% Locale & En Ligne :** Grâce aux modules ES (ESModules), l'application est extrêmement réactive, sans nécessiter aucun serveur backend, hébergée sur GitHub Pages ou exécutée en local.

---

## 6. 🌐 Déploiement et Accès

L'application est hébergée sur **GitHub Pages** :
- **Lien d'accès en ligne :** [https://nathoof30.github.io/CuistoApp/](https://nathoof30.github.io/CuistoApp/)

### Exécution locale (Optionnel)
Pour un usage hors-ligne, les fichiers statiques peuvent être servis localement via Python (`py -m http.server 5500`) ou Node.js (`npx http-server -p 5500 -c-1`).
