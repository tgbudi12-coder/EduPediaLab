// Konfigurasi API Backend Ubuntu 22.04 LTS (Ganti URL Cloudflare Tunnel kamu di sini)
const API_URL = "https://situations-tears-weighted-brake.trycloudflare.com/api.php";
const STORAGE_KEY = 'edupedia_offline_data';

const seedArticles = [
    {
        id: 1,
        judul: 'Pengenalan Ekosistem Linux Ubuntu',
        kategori: 'Teknologi',
        penulis: 'Tim EduPedia',
        tanggal: '2026-06-01',
        ringkasan: 'Panduan dasar mengelola server dan lingkungan sistem operasi berbasis Ubuntu untuk kebutuhan web.',
        gambar: ''
    }
];

let articles = [];
let searchQuery = '';
let currentCompressedImage = '';

const $ = id => document.getElementById(id);

// Inisialisasi Aplikasi
async function initApp() {
    await fetchArticles();
    setupEventListeners();
}

// Ambil Data dari MySQL Server Ubuntu dengan Fallback Lokal
async function fetchArticles() {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                updateServerStatus(true);
                articles = data.length ? data : seedArticles;
                renderArticles();
                return;
            }
        }
    } catch (err) {
        console.warn("Server backend offline, beralih ke penyimpanan lokal.");
    }

    updateServerStatus(false);
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        articles = Array.isArray(saved) && saved.length ? saved : seedArticles;
    } catch (e) {
        articles = seedArticles;
    }
    renderArticles();
}

// Indikator Status Navbar
function updateServerStatus(isOnline) {
    const badge = $('serverStatusBadge');
    if (!badge) return;
    badge.textContent = isOnline ? "🟢 MySQL Aktif" : "🟠 Mode Offline";
    badge.style.background = isOnline ? "#d1fae5" : "#fef3c7";
    badge.style.color = isOnline ? "#065f46" : "#b45309";
}

// Kompresi Gambar Otomatis agar Ringan
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = e => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Render Tampilan Daftar Artikel
function renderArticles() {
    const q = searchQuery.trim().toLowerCase();
    const filtered = articles.filter(item => 
        !q || [item.judul, item.kategori, item.penulis, item.ringkasan].some(val => (val || '').toLowerCase().includes(q))
    );

    $('resultCount').textContent = filtered.length ? `${filtered.length} artikel` : '';
    const container = $('articlesContainer');
    const emptyState = $('emptyState');
    
    container.innerHTML = '';
    emptyState.classList.toggle('hidden', filtered.length > 0);

    if (!filtered.length) {
        $('emptyText').textContent = 'Tidak ada artikel yang cocok dengan pencarian.';
        return;
    }

    container.innerHTML = filtered.map(item => `
        <article class="article-card">
            <div class="article-meta">
                <span class="tag">${escapeHTML(item.kategori)}</span>
                <span>Oleh ${escapeHTML(item.penulis)}</span>
                <span>• ${escapeHTML(item.tanggal)}</span>
            </div>
            <h3>${escapeHTML(item.judul)}</h3>
            <p>${escapeHTML(item.ringkasan)}</p>
            ${item.gambar ? `<div class="article-thumb"><img src="${item.gambar}" alt="Gambar Referensi" loading="lazy"></div>` : ''}
        </article>
    `).join('');
}

function escapeHTML(str = '') {
    return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function showToast(text) {
    const toast = $('toast');
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function setFormMessage(text, type = '') {
    const msg = $('formMessage');
    msg.textContent = text;
    msg.className = 'message ' + type;
}

// Event Listeners Utama
function setupEventListeners() {
    // Pencarian Real-Time
    $('searchInput').addEventListener('input', e => {
        searchQuery = e.target.value;
        renderArticles();
    });

    // Logika Kategori "DLL"
    $('kategoriSelect').addEventListener('change', e => {
        const isCustom = e.target.value === 'DLL';
        $('customCategoryContainer').classList.toggle('hidden', !isCustom);
        if (isCustom) $('customCategory').focus();
    });

    // Unggah & Pratinjau Gambar
    $('fileGambar').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            currentCompressedImage = await compressImage(file);
            $('imagePreview').src = currentCompressedImage;
            $('imagePreviewContainer').classList.remove('hidden');
        } catch (err) {
            currentCompressedImage = '';
            $('imagePreviewContainer').classList.add('hidden');
            showToast('Gagal memproses gambar.');
        }
    });

    $('removeImageBtn').addEventListener('click', () => {
        $('fileGambar').value = '';
        currentCompressedImage = '';
        $('imagePreviewContainer').classList.add('hidden');
    });

    // Penanganan Submit Form
    $('articleForm').addEventListener('submit', async e => {
        e.preventDefault();
        
        const val = id => $(id).value.trim();
        const kategoriVal = val('kategoriSelect') === 'DLL' ? val('customCategory') : val('kategoriSelect');
        
        const required = [val('judul'), kategoriVal, val('penulis'), val('ringkasan')];
        if (required.some(r => !r)) {
            setFormMessage('Mohon lengkapi semua kolom wajib.', 'error');
            return;
        }

        const newArticle = {
            judul: val('judul'),
            kategori: kategoriVal,
            penulis: val('penulis'),
            ringkasan: val('ringkasan'),
            gambar: currentCompressedImage,
            tanggal: new Date().toISOString().slice(0, 10)
        };

        // Kirim ke Backend MySQL Server Ubuntu
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newArticle)
            });
            if (res.ok) {
                $('articleForm').reset();
                $('customCategoryContainer').classList.add('hidden');
                $('imagePreviewContainer').classList.add('hidden');
                currentCompressedImage = '';
                setFormMessage('Artikel berhasil dikirim ke server MySQL!', 'ok');
                await fetchArticles();
                return;
            }
        } catch (err) {
            console.warn("Gagal mengirim ke server, menyimpan secara lokal.");
        }

        // Fallback Penyimpanan Lokal
        newArticle.id = Date.now();
        articles.unshift(newArticle);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
            $('articleForm').reset();
            $('customCategoryContainer').classList.add('hidden');
            $('imagePreviewContainer').classList.add('hidden');
            currentCompressedImage = '';
            setFormMessage('Artikel tersimpan (Mode Offline).', 'ok');
            renderArticles();
        } catch (e) {
            setFormMessage('Penyimpanan lokal penuh.', 'error');
        }
    });
}

// Jalankan aplikasi saat dokumen siap
document.addEventListener('DOMContentLoaded', initApp);
