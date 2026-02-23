# 🍽️ Documentation du Projet : Application de Gestion Culinaire

Ce document décrit en détail l'architecture, les fonctionnalités et la structure de données de votre application web de gestion culinaire. Il sert de cahier des charges et de référence technique globale.

---

## 1. 🎯 Présentation et Objectif de l'Application

L'Application de Gestion Culinaire est une solution professionnelle 100 % front-end (fonctionnant directement dans le navigateur) destinée aux restaurateurs, traiteurs ou pâtissiers. Elle leur permet de :
- Gérer intelligemment leurs achats (Mercuriale).
- Créer des fiches techniques de recettes optimisées.
- Estimer précisément la **rentabilité réelle** (intégrant la main d'œuvre et les frais généraux) de chaque plat.
- Suivre les 14 allergènes à déclaration obligatoire (règlement UE 1169/2011).
- Générer des bons d'économat (listes de courses) combinables.

---

## 2. 🏛️ Architecture Technique

Il s'agit d'une application **Single-Page Application (SPA) / Multi-Pages asynchrone** statique mais riche, fonctionnant sans backend serveur. 

*   **Langages :** HTML5, CSS3 modulaire (orienté composants modernes : Grid/Flex, variables CSS), JavaScript Vanilla (ES6 modules).
*   **Persistance des données :** Le `localStorage` du navigateur est utilisé comme base de données locale (simulation d'une base de données NoSQL via du JSON).
*   **Structuration des dossiers :**
    *   `*.html` : Les différentes vues de l'application (`index.html`, `mercuriale.html`, `recettes.html`, `bon-economat.html`).
    *   `style.css` : Feuille de style globale (incluant thèmes, modales, tableaux).
    *   `data.js` : Modèle de données, règles métier et fonctions de calculs mathématiques/rentabilité.
    *   `app.js` (ou dossier `js`) : Contrôleurs de la logique interface (gestion du DOM, événements et modales).

---

## 3. 🚀 Les Différentes Fonctionnalités

L'application est divisée en 4 modules principaux (onglets).

### 📊 A. Tableau de bord (`index.html`)
- **Vue d'ensemble :** Permet (ou permettra) de visualiser des métriques clés (nombre total de recettes, produits en mercuriale, alertes de rentabilité, etc.).

### 🛒 B. Gestion de la Mercuriale (`mercuriale.html`)
Base de données des matières premières. Permet la gestion complète (CRUD) des ingrédients :
- **Ajout/Édition d'ingrédient :** Définition du nom, unité d'achat (`g`, `L`, `pièce`, `boîte`), prix d'achat, famille de produit (Épicerie, Légumerie, etc.) et sous-famille.
- **Gestion fine des unités :** Affichage optimisé des nombres décimaux selon l'unité (ex: 3 décimales pour les L/Kg, nombre entier pour les pièces/boîtes).
- **Attribution d'allergènes :** Sélection d'un ou plusieurs allergènes parmi les 14 réglementaires (Gluten, Lait, Arachides, Crustacés...).

### 🍳 C. Gestion des Recettes / Fiches Techniques (`recettes.html`)
Cœur du système permettant d'élaborer les plats et calculer leur coût de revient.
- **Données générales :** Nom, Nombre de portions, Etapes de préparation, Temps de production (minutes).
- **Assemblage (Nomenclature) :** Ajout dynamique de lignes d'ingrédients puisés dans la Mercuriale, avec précision de la quantité (gr, cl, pièces etc.).
- **Calcul de rentabilité en temps réel :**
    - Coût matière direct.
    - Coût main d'œuvre (basé sur le temps × taux horaire × multiplicateur de charges patronales).
    - Frais généraux (ex: 15% du coût matière pour couvrir l'usure, l'énergie...).
    - Coefficient Multiplicateur (CM) applicable pour fixer le Prix HT.
    - **KPIs générés :** Marges brute et nette, Rentabilité par heure travaillée, Prix de vente suggéré selon la marge cible.
- **Détection des allergènes :** Avertissements visuels et liste automatique des allergènes réunis depuis les ingrédients intégrés dans la recette.

### 📋 D. Bons d'économat (`bon-economat.html`)
Module logistique et de devis.
- **Constitution de commandes :** Sélection de recettes avec nombre de portions souhaitées.
- **Agrégation :** Calcule les quantités exactes de matières premières à sortir du stock (ou à commander) pour l'ensemble des recettes sélectionnées, triées alphabétiquement.
- **Génération de Devis :** Calcul et affichage du Chiffre d'Affaires prévisionnel (HT et TTC) de l'événement et de la marge de ce panier.

---

## 4. 🗄️ Structure de la Base de Données (Schéma de Données JSON)

Les données ne sont pas stockées dans un SGBD (comme MySQL) mais via le `localStorage` sous le format de tableaux d'objets JavaScript.

### 🍅 Table `mercuriale` (Table des ingrédients)
Contient l'ensemble des références d'achat.
```json
[
  {
    "id": 1, // Identifiant unique
    "name": "Farine T55", // Nom complet du produit
    "price": 0.0012, // Prix ramené à l'unité la plus petite (ex: prix au gramme)
    "unit": "g", // Unité de base (g, L, pièce, boîte)
    "family": "Épicerie", // Catégorie principale
    "subfamily": "Sec", // Sous-catégorie
    "allergens": ["gluten"] // Tableau contenant les IDs des allergènes présents
  }
]
```

### 🍲 Table `recipes` (Table des Recettes / Nomenclatures)
Structure arborescente intégrant une matrice d'ingrédients (Composition).
```json
[
  {
    "id": 1, // ID unique de la recette
    "name": "Mousse au chocolat",
    "servings": 6, // Nombre de portions pour cette recette
    "multiplier": 3.5, // Coefficient multiplicateur commercial (pour marge)
    "productionTime": 30, // Temps de travail nécessaire (en minutes)
    "steps": "Fondre le chocolat, battre les oeufs...",
    "ingredients": [ // Composition (Table de lier/Pivot intégrée)
      { 
        "ingredientId": 5, // Fait référence à l'ID en mercuriale (ex: Chocolat)
        "quantity": 200 // Quantité consommée dans l'unité de l'ingrédient
      },
      ...
    ]
  }
]
```

### ⚙️ Variables de Configuration (Variables Paramétrables)
L'application possède des règles de gestion codées en constantes modifiables (dans `data.js`) :
- `VAT_RATE = 0.10` : TVA à 10%.
- `DEFAULT_HOURLY_RATE = 15.00` : Taux horaire de base (€/h).
- `LABOR_COST_MULTIPLIER = 1.45` : Charges patronales (intègre ~45% de cout supplémentaire sur le salaire).
- `OVERHEAD_PERCENTAGE = 0.15` : Frais généraux évalués à 15% du coût matière.
- `TARGET_NET_MARGIN = 0.25` : Marge nette cible par défaut (25%).

### ⚠️ Table Statique : `EU_ALLERGENS`
Liste stricte des 14 allergènes comprenant leur `id`, `name`, `description` juridique et un `icon` (emoji), utilisée pour le filtrage et l'affichage (ex: id: `gluten`, `crustaceans`, `eggs`...).

---

## 5. 💡 Résumé : Pourquoi la structure de données est-elle conçue ainsi ?

1. **Relationnelle de fait :** Bien qu'en JSON (NoSQL), l'architecture est pensée comme un modèle relationnel SQL. L'objet "ingrédient" dans une "recette" ne copie pas le prix et le nom de l'ingrédient, mais stocke l'ID (`ingredientId`). 
  > *Atout :* Lorsqu'un prix change dans la mercuriale, le coût de toutes les recettes est automatiquement et instantanément mis à jour, ce qui garantit une réalité comptable toujours exacte.
2. **Propagation Automatique des Allergènes :** La méthode en arborescence permet d'avertir automatiquement le Chef si un produit contenant des allergènes cachés est utilisé dans une recette. Si l'allergène est tagué dans la "sauce soja" (dans la mercuriale), tout plat utilisant cette sauce héritera immédiatement de l'alerte "Soja" et "Gluten". 
3. **Optimisée pour une exécution locale :** L'usage d'ESModules allège le code et accélère le chargement, conservant un outil ultra-réactif avec la fluidité typique des solutions locales sans temps de requête réseau.
