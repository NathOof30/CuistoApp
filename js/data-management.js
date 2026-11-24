import { recipes, mercuriale, setData, saveData, getGlobalSettings } from '../data.js';
import { showToast } from './ui-feedback.js';

let fileInput = null;
let initialized = false;

function ensureFileInput() {
    if (!fileInput || !document.body.contains(fileInput)) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', handleFileImport);
        document.body.appendChild(fileInput);
    }
    return fileInput;
}

export function initDataManagement() {
    if (initialized) return;
    initialized = true;

    const importBtn = document.getElementById('import-data-btn');
    const exportBtn = document.getElementById('export-data-btn');

    ensureFileInput();

    if (importBtn) {
        importBtn.addEventListener('click', () => ensureFileInput().click());
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', handleFileExport);
    }
}

export function showFirstVisitModal() {
    const modal = document.getElementById('first-visit-modal');
    if (!modal) return;

    modal.style.display = 'flex';

    const startFreshBtn = document.getElementById('start-fresh-btn');
    const importFirstTimeBtn = document.getElementById('import-first-time-btn');

    if (startFreshBtn) {
        startFreshBtn.onclick = () => {
            modal.style.display = 'none';
            // The default data is already in memory, we just need to save it to start.
            saveData();
            window.location.reload();
        };
    }

    if (importFirstTimeBtn) {
        importFirstTimeBtn.onclick = () => {
            ensureFileInput().click();
            modal.style.display = 'none';
        };
    }
}

function handleFileExport() {
    const dataToExport = {
        mercuriale: mercuriale,
        recipes: recipes,
        settings: getGlobalSettings()
    };

    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `backup-cuisine-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && Array.isArray(data.mercuriale) && Array.isArray(data.recipes)) {
                if (setData(data)) {
                    showToast('Données importées avec succès. Rechargement en cours...', 'success', 2000);
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showToast('Erreur lors de la mise à jour des données (stockage local saturé).', 'error');
                }
            } else {
                showToast('Fichier JSON invalide. Il doit contenir les clés "mercuriale" et "recipes".', 'error');
            }
        } catch (error) {
            console.error('Erreur de parsing JSON:', error);
            showToast('Erreur lors de la lecture du fichier. Vérifiez que le fichier est un JSON valide.', 'error');
        } finally {
            // Reset file input value to allow importing the same file again
            event.target.value = null;
        }
    };
    reader.onerror = function () {
        showToast('Erreur lors de la lecture du fichier.', 'error');
        event.target.value = null;
    };
    reader.readAsText(file);
}
