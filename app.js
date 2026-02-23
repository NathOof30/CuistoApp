import { initDashboard } from './js/dashboard.js';
import { initRecettesPage } from './js/recettes.js';
import { initMercurialePage } from './js/mercuriale.js';
import { initBonEconomatPage } from './js/bon-economat.js';
import { isDataLoaded } from './data.js';
import { initDataManagement, showFirstVisitModal } from './js/data-management.js';

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.split("/").pop();

    if (!isDataLoaded() && (path === 'index.html' || path === '')) {
        showFirstVisitModal();
    }

    if (path === 'index.html' || path === '') {
        initDashboard();
        initDataManagement();
    } else if (path === 'recettes.html') {
        initRecettesPage();
    } else if (path === 'mercuriale.html') {
        initMercurialePage();
    } else if (path === 'bon-economat.html') {
        initBonEconomatPage();
    }
});