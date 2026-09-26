// Initialisation des données locales
let profile = JSON.parse(localStorage.getItem('user_profile')) || {
    height: 175,
    age: 38,
    targetCalories: 1800,
    targetProteinRatio: 30
};

let weightLogs = JSON.parse(localStorage.getItem('weight_logs')) || [];
let mealLogs = JSON.parse(localStorage.getItem('meal_logs')) || [];

let weightChartInstance = null;
let macroChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // Dates par défaut
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('weight-date').value = today;
    document.getElementById('meal-date').value = today;

    loadProfile();
    renderDailyLogs();
    renderCharts();
});

// Navigation Onglets
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');

    if (tabName === 'dashboard') {
        updateDashboard();
    }
}

// Profil
function loadProfile() {
    document.getElementById('height').value = profile.height;
    document.getElementById('age').value = profile.age;
    document.getElementById('target-calories').value = profile.targetCalories;
    document.getElementById('target-protein-ratio').value = profile.targetProteinRatio;

    const targetProtGrams = (profile.targetCalories * (profile.targetProteinRatio / 100)) / 4;
    document.getElementById('profile-summary').innerHTML = `
        <strong>Cible Quotidienne :</strong> ${profile.targetCalories} kcal | 
        <strong>${profile.targetProteinRatio}% Protéines :</strong> ${targetProtGrams.toFixed(1)} g/jour
    `;
}

document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    profile = {
        height: Number(document.getElementById('height').value),
        age: Number(document.getElementById('age').value),
        targetCalories: Number(document.getElementById('target-calories').value),
        targetProteinRatio: Number(document.getElementById('target-protein-ratio').value)
    };
    localStorage.setItem('user_profile', JSON.stringify(profile));
    loadProfile();
    alert('Profil mis à jour !');
});

// Poids
document.getElementById('weight-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('weight-date').value;
    const weight = parseFloat(document.getElementById('weight-val').value);

    weightLogs.push({ date, weight });
    weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
    localStorage.setItem('weight_logs', JSON.stringify(weightLogs));

    document.getElementById('weight-val').value = '';
    renderCharts();
});

// Repas
document.getElementById('meal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const meal = {
        id: Date.now(),
        date: document.getElementById('meal-date').value,
        type: document.getElementById('meal-type').value,
        desc: document.getElementById('meal-desc').value,
        kcal: Number(document.getElementById('meal-kcal').value),
        prot: Number(document.getElementById('meal-prot').value),
        fat: Number(document.getElementById('meal-fat').value),
        carb: Number(document.getElementById('meal-carb').value)
    };

    mealLogs.push(meal);
    localStorage.setItem('meal_logs', JSON.stringify(mealLogs));

    document.getElementById('meal-desc').value = '';
    document.getElementById('meal-kcal').value = '';
    document.getElementById('meal-prot').value = '';
    document.getElementById('meal-fat').value = '';
    document.getElementById('meal-carb').value = '';

    renderDailyLogs();
});

function renderDailyLogs() {
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = mealLogs.filter(m => m.date === today);
    const container = document.getElementById('daily-log');

    if (todayMeals.length === 0) {
        container.innerHTML = '<p>Aucun repas enregistré aujourd\'hui.</p>';
        return;
    }

    let html = '';
    let totalKcal = 0, totalProt = 0;

    todayMeals.forEach(m => {
        totalKcal += m.kcal;
        totalProt += m.prot;
        html += `
            <div class="log-item">
                <div>
                    <strong>${m.type} :</strong> ${m.desc}<br>
                    <small>${m.kcal} kcal | P: ${m.prot}g | L: ${m.fat}g | G: ${m.carb}g</small>
                </div>
                <button onclick="deleteMeal(${m.id})" style="width:auto; padding:0.3rem 0.6rem;" class="btn-danger">X</button>
            </div>
        `;
    });

    const targetProtGrams = (profile.targetCalories * (profile.targetProteinRatio / 100)) / 4;
    html = `
        <div class="summary-box">
            <strong>Total Journée :</strong> ${totalKcal} / ${profile.targetCalories} kcal | 
            <strong>Protéines :</strong> ${totalProt.toFixed(1)} / ${targetProtGrams.toFixed(1)} g
        </div>
    ` + html;

    container.innerHTML = html;
}

function deleteMeal(id) {
    mealLogs = mealLogs.filter(m => m.id !== id);
    localStorage.setItem('meal_logs', JSON.stringify(mealLogs));
    renderDailyLogs();
}

// Graphiques & Dashboard
function renderCharts() {
    const ctxWeight = document.getElementById('weightChart').getContext('2d');
    
    if (weightChartInstance) weightChartInstance.destroy();

    weightChartInstance = new Chart(ctxWeight, {
        type: 'line',
        data: {
            labels: weightLogs.map(w => w.date),
            datasets: [{
                label: 'Poids (kg)',
                data: weightLogs.map(w => w.weight),
                borderColor: '#27ae60',
                fill: false,
                tension: 0.1
            }]
        }
    });
}

function updateDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const todayMeals = mealLogs.filter(m => m.date === today);

    let totKcal = 0, totProt = 0, totFat = 0, totCarb = 0;
    todayMeals.forEach(m => {
        totKcal += m.kcal;
        totProt += m.prot;
        totFat += m.fat;
        totCarb += m.carb;
    });

    const protKcal = totProt * 4;
    const fatKcal = totFat * 9;
    const carbKcal = totCarb * 4;
    const realTotalKcal = protKcal + fatKcal + carbKcal || 1;

    const protPct = ((protKcal / realTotalKcal) * 100).toFixed(1);

    document.getElementById('dash-summary').innerHTML = `
        <h3>Aujourd'hui</h3>
        <p><strong>Total Calories :</strong> ${totKcal} kcal</p>
        <p><strong>Part de Protéines :</strong> ${protPct}% (Cible: ${profile.targetProteinRatio}%)</p>
    `;

    const ctxMacro = document.getElementById('macroChart').getContext('2d');
    if (macroChartInstance) macroChartInstance.destroy();

    macroChartInstance = new Chart(ctxMacro, {
        type: 'doughnut',
        data: {
            labels: ['Protéines (g)', 'Lipides (g)', 'Glucides (g)'],
            datasets: [{
                data: [totProt, totFat, totCarb],
                backgroundColor: ['#27ae60', '#e67e22', '#3498db']
            }]
        }
    });
}

// Export CSV
function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,Type,Date,Description,Calories,Proteines,Lipides,Glucides\n";
    
    mealLogs.forEach(m => {
        csvContent += `Repas,${m.date},"${m.desc}",${m.kcal},${m.prot},${m.fat},${m.carb}\n`;
    });

    weightLogs.forEach(w => {
        csvContent += `Poids,${w.date},,${w.weight},,,,\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `suivi_dietetique_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function clearAllData() {
    if (confirm("Voulez-vous vraiment réinitialiser toutes vos données enregistrées ?")) {
        localStorage.clear();
        location.reload();
    }
}