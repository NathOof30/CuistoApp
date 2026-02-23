import { recipes, mercuriale, setData, saveData } from '../data.js';

let fileInput;

export function initDataManagement() {
    const importBtn = document.getElementById('import-data-btn');
    const exportBtn = document.getElementById('export-data-btn');

    // Create a single file input and reuse it
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', handleFileImport);

    if (importBtn) {
        importBtn.addEventListener('click', () => fileInput.click());
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', handleFileExport);
    }
}

export function showFirstVisitModal() {
    const modal = document.getElementById('first-visit-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    document.getElementById('start-fresh-btn').addEventListener('click', () => {
        modal.style.display = 'none';
        // The default data is already in memory, we just need to save it to start.
        saveData();
        window.location.reload();
    });

    document.getElementById('import-first-time-btn').addEventListener('click', () => {
         if (!fileInput) { // Ensure file input is created
            initDataManagement();
        }
        fileInput.click();
        modal.style.display = 'none';
    });
}

function handleFileExport() {
    const dataToExport = {
        mercuriale: mercuriale,
        recipes: recipes
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
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && data.mercuriale && data.recipes) {
                if (setData(data)) {
                    alert('Données importées avec succès ! La page va maintenant se recharger.');
                    window.location.reload();
                } else {
                    alert('Erreur lors de la mise à jour des données.');
                }
            } else {
                alert('Fichier JSON invalide. Il doit contenir les clés "mercuriale" et "recipes".');
            }
        } catch (error) {
            console.error('Erreur de parsing JSON:', error);
            alert('Erreur lors de la lecture du fichier. Assurez-vous que le fichier est un JSON valide.');
        } finally {
            // Reset file input value to allow importing the same file again
            event.target.value = null;
        }
    };
    reader.onerror = function() {
        alert('Erreur lors de la lecture du fichier.');
        event.target.value = null;
    };
    reader.readAsText(file);
}