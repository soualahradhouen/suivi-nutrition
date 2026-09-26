import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, collection, addDoc, deleteDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Vos identifiants Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBrCNUCKgE11JjF5nzr4T48k6JLVNEMMoA",
    authDomain: "suivi-nutrition-dd3dd.firebaseapp.com",
    projectId: "suivi-nutrition-dd3dd",
    storageBucket: "suivi-nutrition-dd3dd.firebasestorage.app",
    messagingSenderId: "320771461536",
    appId: "1:320771461536:web:174d6fc08a7f99074c94c5",
    measurementId: "G-PMPM8F0943"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enregistrement du plugin ChartDatalabels s'il est disponible
if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let currentUser = null;
let profile = { height: 175, birthdate: "1988-01-01", targetCalories: 1800, targetProteinRatio: 30, activityLevel: "1.55", physiqueGoal: "recomp" };
let weightLogs = [];
let mealLogs = [];

let weightChartInstance = null;
let macroChartInstance = null;
let macroHistoryChartInstance = null;

// Gestion des onglets
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.add('active');
    if (event && event.target) event.target.classList.add('active');

    if (tabName === 'dashboard') updateDashboard();
};

// Authentification & Synchronisation
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'block';
        document.getElementById('auth-status').innerHTML = `<small>Connecté : ${user.email}</small>`;
        
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('weight-date').value = today;
        document.getElementById('meal-date').value = today;
        document.getElementById('dash-date-picker').value = today;

        document.getElementById('dash-date-picker').addEventListener('change', updateDashboard);

        syncUserData();
    } else {
        currentUser = null;
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('app-container').style.display = 'none';
        document.getElementById('auth-status').innerHTML = '';
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        alert("Erreur de connexion : " + err.message);
    }
});

document.getElementById('btn-signup').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Compte créé avec succès !");
    } catch (err) {
        alert("Erreur de création : " + err.message);
    }
});

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// Synchronisation Firestore
function syncUserData() {
    if (!currentUser) return;

    // Profil
    const profileRef = doc(db, "users", currentUser.uid);
    onSnapshot(profileRef, (docSnap) => {
        if (docSnap.exists()) {
            profile = { ...profile, ...docSnap.data() };
            loadProfileView();
        }
    });

    // Repas
    const mealsRef = collection(db, "users", currentUser.uid, "meals");
    onSnapshot(mealsRef, (snapshot) => {
        mealLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDailyLogs();
        updateDashboard();
    });

    // Poids
    const weightRef = collection(db, "users", currentUser.uid, "weights");
    onSnapshot(weightRef, (snapshot) => {
        weightLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        weightLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderWeightChart();
    });
}

// Calcul de l'âge
function calculateAge(birthdateStr) {
    if (!birthdateStr) return 38;
    const birthDate = new Date(birthdateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// SIMULATEUR MÉTABOLIQUE
document.getElementById('btn-calc-sim').addEventListener('click', () => {
    const height = Number(document.getElementById('height').value);
    const birthdate = document.getElementById('birthdate').value;
    const age = calculateAge(birthdate);
    const actFactor = Number(document.getElementById('activity-level').value);
    const goal = document.getElementById('physique-goal').value;

    const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : 78;

    // Formule Mifflin-St Jeor (Homme)
    const bmr = (10 * latestWeight) + (6.25 * height) - (5 * age) + 5;
    const tdee = bmr * actFactor;

    let targetKcal = tdee;
    if (goal === 'hypertrophy') targetKcal += 250;
    if (goal === 'cut') targetKcal -= 300;

    const targetProtGrams = (latestWeight * 2.0).toFixed(1);
    const protKcal = targetProtGrams * 4;
    const suggestedProtPct = ((protKcal / targetKcal) * 100).toFixed(0);

    const simBox = document.getElementById('sim-results');
    simBox.style.display = 'block';
    simBox.innerHTML = `
        🎯 <strong>Recommandation Stratégique ("Super Daddy Fit") :</strong><br>
        • <strong>Âge calculé :</strong> ${age} ans | <strong>Poids pris en compte :</strong> ${latestWeight} kg<br>
        • <strong>Métabolisme de Base (MB) :</strong> ${Math.round(bmr)} kcal<br>
        • <strong>Maintien Énergétique (TDEE) :</strong> ${Math.round(tdee)} kcal/jour<br>
        • <strong>Objectif Calories conseillé :</strong> <mark>${Math.round(targetKcal)} kcal/jour</mark><br>
        • <strong>Cible Protéines optimale (2g/kg) :</strong> <mark>${targetProtGrams} g/jour</mark> (soit env. <strong>${suggestedProtPct}%</strong> des calories)
    `;

    document.getElementById('target-calories').value = Math.round(targetKcal);
    document.getElementById('target-protein-ratio').value = suggestedProtPct;
});

// Profil
function loadProfileView() {
    document.getElementById('height').value = profile.height || 175;
    document.getElementById('birthdate').value = profile.birthdate || "1988-01-01";
    document.getElementById('target-calories').value = profile.targetCalories || 1800;
    document.getElementById('target-protein-ratio').value = profile.targetProteinRatio || 30;
    document.getElementById('activity-level').value = profile.activityLevel || "1.55";
    document.getElementById('physique-goal').value = profile.physiqueGoal || "recomp";

    const age = calculateAge(profile.birthdate);
    const targetProtGrams = (profile.targetCalories * (profile.targetProteinRatio / 100)) / 4;
    document.getElementById('profile-summary').innerHTML = `
        <strong>Configuration Actuelle :</strong> ${age} ans | ${profile.targetCalories} kcal/jour | 
        <strong>Cible Protéines (${profile.targetProteinRatio}%) :</strong> ${targetProtGrams.toFixed(1)} g/jour
    `;
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    profile = {
        height: Number(document.getElementById('height').value),
        birthdate: document.getElementById('birthdate').value,
        targetCalories: Number(document.getElementById('target-calories').value),
        targetProteinRatio: Number(document.getElementById('target-protein-ratio').value),
        activityLevel: document.getElementById('activity-level').value,
        physiqueGoal: document.getElementById('physique-goal').value
    };
    await setDoc(doc(db, "users", currentUser.uid), profile);
    alert('Profil sauvegardé dans le Cloud !');
});

// Repas
document.getElementById('meal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const meal = {
        date: document.getElementById('meal-date').value,
        type: document.getElementById('meal-type').value,
        desc: document.getElementById('meal-desc').value,
        kcal: Number(document.getElementById('meal-kcal').value),
        prot: Number(document.getElementById('meal-prot').value),
        fat: Number(document.getElementById('meal-fat').value),
        carb: Number(document.getElementById('meal-carb').value)
    };

    await addDoc(collection(db, "users", currentUser.uid, "meals"), meal);

    document.getElementById('meal-desc').value = '';
    document.getElementById('meal-kcal').value = '';
    document.getElementById('meal-prot').value = '';
    document.getElementById('meal-fat').value = '';
    document.getElementById('meal-carb').value = '';
});

window.deleteMeal = async function(id) {
    await deleteDoc(doc(db, "users", currentUser.uid, "meals", id));
};

function renderDailyLogs() {
    const selectedDate = document.getElementById('meal-date').value;
    const todayMeals = mealLogs.filter(m => m.date === selectedDate);
    const container = document.getElementById('daily-log');

    if (todayMeals.length === 0) {
        container.innerHTML = '<p>Aucun repas enregistré pour cette date.</p>';
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
                <button onclick="deleteMeal('${m.id}')" style="width:auto; padding:0.3rem 0.6rem;" class="btn-danger">X</button>
            </div>
        `;
    });

    const targetProtGrams = (profile.targetCalories * (profile.targetProteinRatio / 100)) / 4;
    html = `
        <div class="summary-box">
            <strong>Total Journée (${selectedDate}) :</strong> ${totalKcal} / ${profile.targetCalories} kcal | 
            <strong>Protéines :</strong> ${totalProt.toFixed(1)} / ${targetProtGrams.toFixed(1)} g
        </div>
    ` + html;

    container.innerHTML = html;
}

// Poids
document.getElementById('weight-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('weight-date').value;
    const weight = parseFloat(document.getElementById('weight-val').value);

    await addDoc(collection(db, "users", currentUser.uid, "weights"), { date, weight });
    document.getElementById('weight-val').value = '';
});

function renderWeightChart() {
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
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                fill: true,
                tension: 0.2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// Tableau de bord
function updateDashboard() {
    const selectedDate = document.getElementById('dash-date-picker').value || new Date().toISOString().split('T')[0];
    const selectedMeals = mealLogs.filter(m => m.date === selectedDate);

    let totKcal = 0, totProt = 0, totFat = 0, totCarb = 0;
    selectedMeals.forEach(m => {
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
    const fatPct = ((fatKcal / realTotalKcal) * 100).toFixed(1);
    const carbPct = ((carbKcal / realTotalKcal) * 100).toFixed(1);

    document.getElementById('dash-summary').innerHTML = `
        <h3>Journée du ${selectedDate}</h3>
        <p><strong>Calories Consommées :</strong> ${totKcal} / ${profile.targetCalories} kcal</p>
        <p><strong>Poids Protéique :</strong> ${totProt.toFixed(1)} g (soit <strong>${protPct}%</strong> de l'énergie | Cible: ${profile.targetProteinRatio}%)</p>
    `;

    const ctxMacro = document.getElementById('macroChart').getContext('2d');
    if (macroChartInstance) macroChartInstance.destroy();

    macroChartInstance = new Chart(ctxMacro, {
        type: 'doughnut',
        data: {
            labels: ['Protéines', 'Lipides', 'Glucides'],
            datasets: [{
                data: [totProt, totFat, totCarb],
                backgroundColor: ['#27ae60', '#e67e22', '#3498db']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const p = context.dataIndex === 0 ? protPct : (context.dataIndex === 1 ? fatPct : carbPct);
                            return ` ${context.label}: ${val} g (${p}%)`;
                        }
                    }
                },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value, ctx) => {
                        if (value === 0) return '';
                        const p = ctx.dataIndex === 0 ? protPct : (ctx.dataIndex === 1 ? fatPct : carbPct);
                        const label = ctx.chart.data.labels[ctx.dataIndex];
                        return `${label}\n${value}g (${p}%)`;
                    }
                }
            }
        }
    });

    renderMacroHistoryChart();
}

function renderMacroHistoryChart() {
    const dailyMap = {};
    mealLogs.forEach(m => {
        if (!dailyMap[m.date]) {
            dailyMap[m.date] = { prot: 0, fat: 0, carb: 0 };
        }
        dailyMap[m.date].prot += m.prot;
        dailyMap[m.date].fat += m.fat;
        dailyMap[m.date].carb += m.carb;
    });

    const sortedDates = Object.keys(dailyMap).sort((a, b) => new Date(a) - new Date(b));

    const protSeries = [];
    const fatSeries = [];
    const carbSeries = [];

    sortedDates.forEach(date => {
        const d = dailyMap[date];
        const pKcal = d.prot * 4;
        const fKcal = d.fat * 9;
        const cKcal = d.carb * 4;
        const totalKcal = pKcal + fKcal + cKcal || 1;

        protSeries.push(((pKcal / totalKcal) * 100).toFixed(1));
        fatSeries.push(((fKcal / totalKcal) * 100).toFixed(1));
        carbSeries.push(((cKcal / totalKcal) * 100).toFixed(1));
    });

    const ctxHistory = document.getElementById('macroHistoryChart').getContext('2d');
    if (macroHistoryChartInstance) macroHistoryChartInstance.destroy();

    macroHistoryChartInstance = new Chart(ctxHistory, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [
                { label: '% Protéines', data: protSeries, borderColor: '#27ae60', tension: 0.2, fill: false },
                { label: '% Lipides', data: fatSeries, borderColor: '#e67e22', tension: 0.2, fill: false },
                { label: '% Glucides', data: carbSeries, borderColor: '#3498db', tension: 0.2, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                datalabels: { display: false }
            },
            scales: {
                y: {
                    title: { display: true, text: '% de l\'énergie totale' },
                    min: 0,
                    max: 100
                }
            }
        }
    });
}
