const API_BASE = 'http://localhost:4000/api';
import { saveToken, getToken, clearToken, me, login, register } from './auth.js';

const state = {
	page: 1,
	pageSize: 12,
	q: '',
	category_id: '',
		stock_status: '',
		currency: 'USD'
};

const els = {
	year: document.getElementById('year'),
	heroCategories: document.getElementById('heroCategories'),
	categoryList: document.getElementById('categoryList'),
	productGrid: document.getElementById('productGrid'),
	loadMoreBtn: document.getElementById('loadMoreBtn'),
	searchForm: document.getElementById('searchForm'),
	searchInput: document.getElementById('searchInput'),
		stockFilter: document.getElementById('stockFilter'),
			currencySelect: document.getElementById('currencySelect'),
			signinModal: document.getElementById('signinModal'),
			signinForm: document.getElementById('signinForm'),
			signinEmail: document.getElementById('signinEmail'),
				signinPassword: document.getElementById('signinPassword'),
				signinCaptchaCanvas: document.getElementById('signinCaptchaCanvas'),
				signinCaptchaAnswer: document.getElementById('signinCaptchaAnswer'),
				refreshSigninCaptcha: document.getElementById('refreshSigninCaptcha'),
			signupModal: document.getElementById('signupModal'),
			signupForm: document.getElementById('signupForm'),
			signupName: document.getElementById('signupName'),
			signupEmail: document.getElementById('signupEmail'),
			signupPassword: document.getElementById('signupPassword'),
			signupPhone: document.getElementById('signupPhone'),
			signupAddress: document.getElementById('signupAddress'),
			navSignedOut: document.getElementById('navSignedOut'),
			navSignedIn: document.getElementById('navSignedIn'),
			navCreateAccount: document.getElementById('navCreateAccount'),
				navCreateLink: document.getElementById('navCreateLink'),
				navSignInLink: document.getElementById('navSignInLink'),
			navUserName: document.getElementById('navUserName'),
			signOutLink: document.getElementById('signOutLink')
};

function setYear() {
	if (els.year) els.year.textContent = new Date().getFullYear();
}

function categoryPill(c) {
	const a = document.createElement('a');
	a.href = '#products';
	a.className = 'badge text-bg-light text-wrap';
	a.textContent = c.name;
	a.onclick = () => { state.category_id = c.id; state.page = 1; hydrateProducts(true); };
	return a;
}

function categoryItem(c) {
	const a = document.createElement('a');
	a.href = '#products';
	a.className = 'list-group-item list-group-item-action';
	a.textContent = c.name;
	a.onclick = () => { state.category_id = c.id; state.page = 1; hydrateProducts(true); };
	return a;
}

function productCard(p) {
	const col = document.createElement('div');
	col.className = 'col-6 col-md-4 col-lg-3';
	const imgSrc = (Array.isArray(p.images) ? p.images[0] : undefined) || '/placeholder.png';
	const card = document.createElement('div');
	card.className = 'card h-100';
	card.innerHTML = `
		<img src="${imgSrc}" class="card-img-top" alt="${p.title}" onerror="this.src='https://via.placeholder.com/400x300?text=Product'">
		<div class="card-body d-flex flex-column">
			<h5 class="card-title">${p.title}</h5>
			<p class="card-text small text-muted mb-2">MOQ: ${p.moq ?? 1}</p>
			<p class="card-text fw-semibold">$${Number(p.price_per_unit).toFixed(2)}</p>
			<div class="mt-auto d-grid gap-2">
				<button class="btn btn-outline-primary btn-sm">Add to Cart</button>
				<button class="btn btn-primary btn-sm">Request Quote</button>
			</div>
		</div>
	`;
	col.appendChild(card);
	return col;
}

async function fetchJSON(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

async function hydrateCategories() {
	try {
		const { data } = await fetchJSON(`${API_BASE}/categories`);
		els.heroCategories.innerHTML = '';
		els.categoryList.innerHTML = '';
		data.forEach(c => {
			els.heroCategories.appendChild(categoryPill(c));
			els.categoryList.appendChild(categoryItem(c));
		});
	} catch (e) {
		console.error('Failed to load categories', e);
	}
}

function normalizeImages(p) {
	try {
		if (typeof p.images === 'string') p.images = JSON.parse(p.images);
	} catch (_) { p.images = []; }
	return p;
}

async function hydrateProducts(reset = false) {
	try {
		// show a simple loading skeleton
		if (reset) {
			els.productGrid.innerHTML = '';
			for (let i = 0; i < 8; i++) {
				const div = document.createElement('div');
				div.className = 'col-6 col-md-4 col-lg-3';
				div.innerHTML = '<div class="card placeholder-glow"><div class="card-img-top placeholder" style="height:180px"></div><div class="card-body"><div class="placeholder col-8"></div><div class="placeholder col-6"></div><div class="placeholder col-4"></div></div></div>';
				els.productGrid.appendChild(div);
			}
		}
		const params = new URLSearchParams();
		if (state.q) params.set('q', state.q);
		if (state.category_id) params.set('category_id', state.category_id);
		if (state.stock_status) params.set('stock_status', state.stock_status);
		params.set('page', String(state.page));
		params.set('pageSize', String(state.pageSize));

		const { data } = await fetchJSON(`${API_BASE}/products?${params.toString()}`);
		if (reset) els.productGrid.innerHTML = '';
		data.map(normalizeImages).forEach(p => els.productGrid.appendChild(productCard(p)));
	} catch (e) {
		console.error('Failed to load products', e);
	}
}

function wireEvents() {
	els.searchForm?.addEventListener('submit', (ev) => {
		ev.preventDefault();
		state.q = els.searchInput.value.trim();
		state.page = 1;
		hydrateProducts(true);
	});
	els.loadMoreBtn?.addEventListener('click', () => {
		state.page += 1;
		hydrateProducts(false);
	});
	els.stockFilter?.addEventListener('change', () => {
		state.stock_status = els.stockFilter.value;
		state.page = 1;
		hydrateProducts(true);
	});
		els.currencySelect?.addEventListener('change', () => {
			state.currency = els.currencySelect.value;
			// TODO: call backend currency API when implemented; for now, no-op
		});

			// Open modals from nav and preload captcha
				// Create Account now navigates to /register (no modal)
			els.navSignInLink?.addEventListener('click', async (e) => {
				e.preventDefault();
				await preloadCaptcha('signin');
				new bootstrap.Modal(els.signinModal).show();
			});

			els.signinForm?.addEventListener('submit', async (e) => {
				e.preventDefault();
				try {
						if (!window.__signinCaptchaToken) { await preloadCaptcha('signin'); }
						const captchaToken = window.__signinCaptchaToken;
						const captchaAnswer = els.signinCaptchaAnswer?.value.trim();
						if (!/^[a-zA-Z0-9]{6}$/.test(captchaAnswer || '')) {
							const el = document.getElementById('signinCaptchaError');
							if (el) el.textContent = 'Enter a 6-character code (letters/numbers).';
							els.signinCaptchaAnswer?.classList.add('is-invalid');
							return;
						}
						const user = await loginWithCaptcha(els.signinEmail.value.trim(), els.signinPassword.value, captchaToken, captchaAnswer);
					// If the logged-in user is an admin, redirect straight to the admin dashboard
					if (user && user.role === 'ADMIN') {
						try { bootstrap.Modal.getInstance(els.signinModal).hide(); } catch(_){}
						window.location.href = '/admin';
						return;
					}
					try { bootstrap.Modal.getInstance(els.signinModal).hide(); } catch(_){}
					await refreshAuthState();
				} catch (err) {
					const msg = err.message || 'Sign-in failed';
					if (/captcha|expired|invalid/i.test(msg)) {
						const el = document.getElementById('signinCaptchaError');
						if (el) el.textContent = msg;
						els.signinCaptchaAnswer?.classList.add('is-invalid');
						await preloadCaptcha('signin');
					} else {
						alert(msg);
					}
				}
			});

			els.signupForm?.addEventListener('submit', async (e) => {
				e.preventDefault();
				try {
						const { token, question } = await fetchJSON(`${API_BASE}/auth/captcha`);
						const captchaToken = window.__signupCaptchaToken || token;
						const captchaAnswer = prompt(window.__signupCaptchaQuestion || question || 'Solve captcha: What is 1+1?');
						await register({
						name: els.signupName.value.trim(),
						email: els.signupEmail.value.trim(),
						password: els.signupPassword.value,
						phone: els.signupPhone.value.trim(),
							address: els.signupAddress.value.trim(),
							captchaToken, captchaAnswer
					});
					bootstrap.Modal.getInstance(els.signupModal).hide();
					alert('Account created. Please check your email to verify your address.');
				} catch (err) {
					alert(err.message);
				}
			});

			els.signOutLink?.addEventListener('click', (e) => {
				e.preventDefault();
				clearToken();
				refreshAuthState();
			});
}

async function preloadCaptcha(kind) {
	try {
		const { token, question } = await fetchJSON(`${API_BASE}/auth/captcha`);
		if (kind === 'signup') { window.__signupCaptchaToken = token; window.__signupCaptchaQuestion = question; }
		if (kind === 'signin') {
			window.__signinCaptchaToken = token;
			const code = (question || '').replace('Enter code: ', '').trim().toUpperCase();
			drawCaptchaOn(els.signinCaptchaCanvas, code);
		}
	} catch (_) {}
}

async function loginWithCaptcha(email, password, captchaToken, captchaAnswer) {
	const res = await fetch(`${API_BASE}/auth/login`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password, captchaToken, captchaAnswer })
	});
	if (!res.ok) throw new Error('Invalid credentials or captcha');
	const data = await res.json();
	saveToken(data.token);
	return data.user;
}

		async function refreshAuthState() {
			try {
				const profile = await me();
				if (profile) {
					els.navSignedOut?.classList.add('d-none');
					els.navCreateAccount?.classList.add('d-none');
					els.navSignedIn?.classList.remove('d-none');
					els.navUserName.textContent = profile.name || 'Account';
				} else {
					els.navSignedOut?.classList.remove('d-none');
					els.navCreateAccount?.classList.remove('d-none');
					els.navSignedIn?.classList.add('d-none');
				}
			} catch (_) {
				els.navSignedOut?.classList.remove('d-none');
				els.navCreateAccount?.classList.remove('d-none');
				els.navSignedIn?.classList.add('d-none');
			}
		}

(function init() {
	setYear();
	wireEvents();
		refreshAuthState();
	hydrateCategories();
	hydrateProducts(true);
	if (location.hash === '#signin' && els.navSignInLink) {
		history.replaceState('', document.title, window.location.pathname + window.location.search);
		setTimeout(async () => { await preloadCaptcha('signin'); new bootstrap.Modal(els.signinModal).show(); }, 100);
	}
})();

function drawCaptchaOn(canvas, code) {
	if (!canvas || !canvas.getContext) return;
	const ctx = canvas.getContext('2d');
	const W = canvas.width, H = canvas.height;
	const bgGradient = ctx.createLinearGradient(0, 0, W, H);
	bgGradient.addColorStop(0, '#f8fbff');
	bgGradient.addColorStop(1, '#e9f0ff');
	ctx.fillStyle = bgGradient;
	ctx.fillRect(0, 0, W, H);
	for (let i = 0; i < 5; i++) {
		ctx.strokeStyle = `rgba(${rand(50,150)},${rand(50,150)},${rand(50,150)},0.6)`;
		ctx.lineWidth = rand(1, 2);
		ctx.beginPath();
		ctx.moveTo(rand(0, W/2), rand(0, H));
		ctx.bezierCurveTo(rand(0, W), rand(0, H), rand(0, W), rand(0, H), rand(W/2, W), rand(0, H));
		ctx.stroke();
	}
	for (let i = 0; i < 60; i++) {
		ctx.fillStyle = `rgba(${rand(100,200)},${rand(100,200)},${rand(100,200)},0.5)`;
		ctx.fillRect(rand(0, W), rand(0, H), 1, 1);
	}
	const chars = (code || '').split('');
	const baseX = 16; const stepX = Math.floor((W - 32) / (chars.length || 6));
	chars.forEach((ch, idx) => {
		const x = baseX + idx * stepX + rand(-2, 2);
		const y = rand(Math.floor(H*0.55), Math.floor(H*0.7));
		const angle = (rand(-20, 20) * Math.PI) / 180;
		const fontSize = rand(22, 30);
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(angle);
		ctx.font = `${fontSize}px Verdana, Tahoma, Arial`;
		ctx.fillStyle = `rgb(${rand(20,80)},${rand(20,80)},${rand(20,80)})`;
		ctx.shadowColor = 'rgba(0,0,0,0.2)';
		ctx.shadowBlur = 2;
		ctx.fillText(ch, 0, 0);
		ctx.restore();
	});
	ctx.strokeStyle = '#cfe2ff';
	ctx.strokeRect(0.5, 0.5, W-1, H-1);
	function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
}

els.refreshSigninCaptcha?.addEventListener('click', async () => { await preloadCaptcha('signin'); });
els.signinCaptchaCanvas?.addEventListener('click', async () => { await preloadCaptcha('signin'); });
