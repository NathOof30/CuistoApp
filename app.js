import { initDashboard } from './js/dashboard.js';
import { initRecettesPage } from './js/recettes.js';
import { initMercurialePage } from './js/mercuriale.js';
import { initBonEconomatPage } from './js/bon-economat.js';
import { isDataLoaded } from './data.js';
import { initDataManagement, showFirstVisitModal } from './js/data-management.js';
import { showToast } from './js/ui-feedback.js';

const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="sun-icon"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="moon-icon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function updateStickyHeaderOffset() {
    const header = document.querySelector('header');
    if (!header) return;
    const headerHeight = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--sticky-header-offset', `${headerHeight}px`);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialise Theme
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && systemPrefersDark);
    if (isDark) {
        document.body.classList.add('dark-mode');
    }

    updateStickyHeaderOffset();
    window.addEventListener('load', updateStickyHeaderOffset);
    window.addEventListener('resize', updateStickyHeaderOffset);

    // Dynamic Theme Toggler Insertion
    const nav = document.querySelector('header nav');
    if (nav) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'theme-toggle-btn';
        toggleBtn.className = 'theme-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'Changer le thème');
        toggleBtn.innerHTML = isDark ? sunIcon : moonIcon;
        
        toggleBtn.addEventListener('click', () => {
            const currentlyDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', currentlyDark ? 'dark' : 'light');
            toggleBtn.innerHTML = currentlyDark ? sunIcon : moonIcon;
            showToast(`Thème ${currentlyDark ? 'sombre' : 'clair'} activé`, 'info', 1500);
        });
        nav.appendChild(toggleBtn);
    }

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

    // Global Modal Handling (Escape and backdrop clicks)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
});