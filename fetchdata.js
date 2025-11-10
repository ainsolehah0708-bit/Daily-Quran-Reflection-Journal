const API_BASE = 'https://api.alquran.cloud/v1';
let surahData = [];
const pageContainer = document.getElementById('page-container');

// ----- INIT -----
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-daily-surah').addEventListener('click', showDailySurahPage);
  document.getElementById('btn-all-surah').addEventListener('click', showAllSurahPage);
  document.getElementById('btn-history').addEventListener('click', showHistoryPage);
});

// ----- FETCH SURAH LIST -----
async function loadSurahList() {
  if (surahData.length > 0) return surahData;
  try {
    const res = await fetch(`${API_BASE}/surah`);
    const json = await res.json();
    if (json.code !== 200 || !json.data) throw new Error('Failed to load surah list');
    surahData = json.data;
    return surahData;
  } catch (err) {
    alert('Error loading surah list: ' + err.message);
    return [];
  }
}

// ----- DAILY SURAH -----
function getDailySurahNumber() {
  const start = new Date('2020-01-01');
  const today = new Date();
  const daysSince = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return (daysSince % 114) + 1;
}

async function showDailySurahPage() {
  const surahList = await loadSurahList();
  const surahNumber = getDailySurahNumber();
  const surahMeta = surahList.find(s => s.number === surahNumber);

  pageContainer.innerHTML = '<div class="loading">Loading Daily Surah...</div>';

  try {
    const resArabic = await fetch(`${API_BASE}/surah/${surahNumber}`);
    const jsonArabic = await resArabic.json();
    if (jsonArabic.code !== 200 || !jsonArabic.data) throw new Error('Failed to load Arabic text');
    const surah = jsonArabic.data;

    const resTrans = await fetch(`${API_BASE}/surah/${surahNumber}/en.asad`);
    const jsonTrans = await resTrans.json();
    const translationAyahs = jsonTrans.data.ayahs;

    const savedData = JSON.parse(localStorage.getItem('daily_reflection_' + surahNumber) || '{}');
    const ayahCompleted = savedData.ayahCompleted || '';
    const reflection = savedData.reflection || '';

    let html = `<h2>Daily Surah: ${surahMeta.number}. ${surahMeta.englishName} 
                  <span class="arabic">${surahMeta.name}</span></h2>
      <div class="surah-meta">Ayahs: ${surahMeta.numberOfAyahs} • Revelation: ${surahMeta.revelationType}</div>
      <div class="ayahs">`;

    surah.ayahs.forEach((a, i) => {
      const transText = translationAyahs[i] ? translationAyahs[i].text : '';
      html += `
        <div class="ayah">
          <div class="ayah-number">(${a.numberInSurah})</div>
          <div class="ayah-text arabic">${escapeHtml(a.text)}</div>
          <div class="ayah-translation"><em>${escapeHtml(transText)}</em></div>
        </div>`;
    });

    html += `</div>
      <div class="reflection-box">
        <label>Number of Ayah Completed:</label>
        <input type="number" id="input-ayah-completed" value="${ayahCompleted}" 
          min="0" max="${surahMeta.numberOfAyahs}">
        <label>Your Reflection:</label>
        <textarea id="input-reflection" rows="5">${escapeHtml(reflection)}</textarea>
        <button id="btn-save-reflection" class="btn">Save Reflection</button>
      </div>`;

    pageContainer.innerHTML = html;

    document.getElementById('btn-save-reflection').addEventListener('click', () => {
      const ayahCompletedVal = document.getElementById('input-ayah-completed').value;
      const reflectionVal = document.getElementById('input-reflection').value;
      localStorage.setItem('daily_reflection_' + surahNumber, JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        ayahCompleted: ayahCompletedVal,
        reflection: reflectionVal,
        surahNumber
      }));
      alert('Reflection saved!');
    });

  } catch (err) {
    pageContainer.innerHTML = `<div class="error">Error loading daily surah: ${escapeHtml(err.message)}</div>`;
  }
}

// ----- ALL SURAH -----
async function showAllSurahPage() {
  const surahList = await loadSurahList();

  let html = `
    <div class="filter-area">
      <input id="search-all" type="search" placeholder="Search surah by name or number">
      <select id="mood-select">
        <option value="">— Filter by Mood —</option>
        <option value="calm">Calm / Reflection</option>
        <option value="study">Study / Long Surahs</option>
        <option value="comfort">Comfort / Protection</option>
        <option value="short">Quick Read</option>
      </select>
    </div>
    <div id="all-surah-list" class="list"></div>`;

  pageContainer.innerHTML = html;

  const container = document.getElementById('all-surah-list');
  const searchInput = document.getElementById('search-all');
  const moodSelect = document.getElementById('mood-select');

  function renderList(list) {
    container.innerHTML = '';
    list.forEach(s => {
      const item = document.createElement('div');
      item.className = 'surah-item';
      item.innerHTML = `<strong>${s.number}. ${escapeHtml(s.englishName)}</strong> 
                        <span class="arabic">${escapeHtml(s.name)}</span>
                        <div class="surah-meta">Ayahs: ${s.numberOfAyahs} • Revelation: ${s.revelationType}</div>`;
      item.addEventListener('click', async () => {
        container.innerHTML = '<div class="loading">Loading ayahs...</div>';
        try {
          const res = await fetch(`${API_BASE}/surah/${s.number}`);
          const json = await res.json();
          const surah = json.data;
          let ayahHtml = `<h2>${s.number}. ${escapeHtml(s.englishName)} 
                          <span class="arabic">${escapeHtml(s.name)}</span></h2>
                          <div class="ayahs">`;
          surah.ayahs.forEach(a => {
            ayahHtml += `<div class="ayah">
                           <div class="ayah-number">(${a.numberInSurah})</div>
                           <div class="ayah-text arabic">${escapeHtml(a.text)}</div>
                         </div>`;
          });
          ayahHtml += '</div><button id="btn-back-list" class="btn">Back to List</button>';
          container.innerHTML = ayahHtml;
          document.getElementById('btn-back-list').addEventListener('click', () => renderList(surahList));
        } catch (err) {
          container.innerHTML = `<div class="error">Failed to load ayahs</div>`;
        }
      });
      container.appendChild(item);
    });
  }

  renderList(surahList);

  // search
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    const filtered = surahList.filter(s =>
      s.englishName.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      String(s.number).includes(q)
    );
    renderList(filtered);
  });

  // mood filter
  moodSelect.addEventListener('change', () => {
    const val = moodSelect.value;
    let filtered = surahList;
    if (val === 'calm') filtered = surahList.filter(s => s.numberOfAyahs <= 6);
    else if (val === 'study') filtered = surahList.filter(s => s.numberOfAyahs >= 50);
    else if (val === 'comfort') filtered = surahList.filter(s => s.revelationType.toLowerCase() === 'meccan' && s.numberOfAyahs <= 20);
    else if (val === 'short') filtered = surahList.filter(s => s.numberOfAyahs <= 3);
    renderList(filtered);
  });
}

// ----- HISTORY PAGE -----
function showHistoryPage() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('daily_reflection_'));
  if (keys.length === 0) {
    pageContainer.innerHTML = '<div>No reflections saved yet.</div>';
    return;
  }

  let html = '<h2>Daily Reflection History</h2><div class="history-list">';
  keys.forEach(k => {
    const data = JSON.parse(localStorage.getItem(k));
    html += `<div class="history-item" data-key="${k}">
               <div><strong>Date:</strong> ${data.date}</div>
               <div><strong>Surah Number:</strong> <span class="span-surah">${data.surahNumber}</span></div>
               <div><strong>Ayah Completed:</strong> <span class="span-ayah">${data.ayahCompleted}</span></div>
               <div><strong>Reflection:</strong> <span class="span-reflection">${escapeHtml(data.reflection)}</span></div>
               <button class="btn btn-edit" data-key="${k}">Edit</button>
               <button class="btn btn-delete" data-key="${k}">Delete</button>
             </div>`;
  });
  html += '</div>';
  pageContainer.innerHTML = html;

  // Delete
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      const key = e.target.getAttribute('data-key');
      if (confirm('Delete this reflection?')) {
        localStorage.removeItem(key);
        showHistoryPage();
      }
    });
  });

  // Edit
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      const key = e.target.getAttribute('data-key');
      const itemDiv = e.target.closest('.history-item');
      const data = JSON.parse(localStorage.getItem(key));

      itemDiv.querySelector('.span-ayah').innerHTML = `<input type="number" value="${data.ayahCompleted}" min="0">`;
      itemDiv.querySelector('.span-reflection').innerHTML = `<textarea rows="3">${escapeHtml(data.reflection)}</textarea>`;

      e.target.textContent = 'Save';
      e.target.classList.remove('btn-edit');
      e.target.classList.add('btn-save');

      e.target.replaceWith(e.target.cloneNode(true));
      const saveBtn = itemDiv.querySelector('.btn-save');

      saveBtn.addEventListener('click', () => {
        const ayahVal = itemDiv.querySelector('input').value;
        const reflVal = itemDiv.querySelector('textarea').value;
        data.ayahCompleted = ayahVal;
        data.reflection = reflVal;
        localStorage.setItem(key, JSON.stringify(data));
        showHistoryPage();
      });
    });
  });
}

// ----- UTIL -----
const escapeHtml = (str) => {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
