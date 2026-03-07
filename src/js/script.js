let device_id = '---';

/* Simple API wrapper */
const ApiService = {
	async get(path) {
		const resp = await fetch(path);
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const contentType = resp.headers.get('content-type');
		if (contentType && contentType.includes('text/plain')) {
			const text = await resp.text();
			console.log(`GET ${path} → ${resp.status}`, text);
			return text;
		}
		const data = await resp.json();
		console.log(`GET ${path} → ${resp.status}`, data);
		return data;
	},
	async post(path, data) {
		const resp = await fetch(path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
		});
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const ct = resp.headers.get('content-type') || '';
		const result = ct.includes('application/json')
			? await resp.json()
			: await resp.text();
		console.log(`POST ${path} → ${resp.status}`, result);
		return result;
	},
	uploadFile(path, file, onProgress, onComplete, onError) {
		const xhr = new XMLHttpRequest();
		const fd = new FormData();
		fd.append('firmware', file);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable)
				onProgress(Math.round((e.loaded / e.total) * 100));
		};
		xhr.onreadystatechange = () => {
			if (xhr.readyState === 4) {
				if (xhr.status === 200) onComplete(xhr.responseText);
				else onError(`Server Error: ${xhr.status}`);
			}
		};
		xhr.onerror = () => onError('Network Error');
		xhr.timeout = 60000;
		xhr.open('POST', path);
		xhr.send(fd);
	},
};

const navLinks = [
	{ href: '/', label: 'Home' },
	{ href: 'device-details.html', label: 'Device Details' },
	{ href: 'ota.html', label: 'OTA' },
	{ href: 'file-system.html', label: 'File Viewer' },
	{ href: 'config.html', label: 'Configuration' },
];

const footerText = `&copy; ${new Date().getFullYear()} sensors.AFRICA`;

// header/footer templates used for dynamic insertion
const layoutTemplates = {
	header() {
		return `
		<!-- header/navigation -->
		<header class="site-header">
			<div class="container">
				<div class="branding">
					<img src="images/sensor_logo.png" alt="Sensors logo" class="logo" />
					<span class="device-id" id="device-id">${device_id}</span>
				</div>
				<nav class="main-nav">
					<button class="btn nav-toggle" aria-label="Toggle navigation" aria-expanded="false">
						<div></div>
					</button>
					<div class="nav-backdrop"></div>
					<ul class="nav-list" id="navList">
						${navLinks.map((link) => `<li><a href="${link.href}" class="nav-link">${link.label}</a></li>`).join('')}
					</ul>
				</nav>
			</div>
		</header>`;
	},
	footer() {
		return `
		<footer class="site-footer">
			<small>${footerText}</small>
		</footer>`;
	},
};

const UI = {
	updateText: (id, text) => {
		const el = document.getElementById(id);
		if (el) el.textContent = text;
	},
	renderFileTree: (node, indent = 0, currentPath = '') => {
		return Object.keys(node)
			.map((key) => {
				const val = node[key];
				const fullPath = `${currentPath}/${key}`.replace(/\/+/g, '/');
				const indentStyle =
					indent > 0 ? ` style="margin-left:${indent * 20}px;"` : '';
				if (typeof val === 'object' && val !== null) {
					return `<div class="file-tree-folder"${indentStyle}><strong>📁 ${key}</strong></div>${UI.renderFileTree(val, indent + 1, fullPath)}`;
				}
				return `<div class="sensor-data__row file-tree-file"${indentStyle}>
					<span class="sensor-data__label">📄 ${key}</span>
					<a href="/download?file=${encodeURIComponent(fullPath)}" download="${key}" class="btn--primary file-download-link">⏬</a>
				</div>`;
			})
			.join('');
	},
};

/* Navigation (burger + drawer) */
const Navigation = {
	init() {
		const navToggle = document.querySelector('.nav-toggle');
		const navList = document.querySelector('.nav-list');
		const links = document.querySelectorAll('.nav-link');

		let backdrop = document.querySelector('.nav-backdrop');
		if (!backdrop) {
			backdrop = document.createElement('div');
			backdrop.className = 'nav-backdrop';
			document.body.appendChild(backdrop);
		}

		const toggleMenu = () => {
			if (!navToggle || !navList) return;
			navToggle.classList.toggle('open');
			navList.classList.toggle('open');
			backdrop.classList.toggle('open');
			document.body.classList.toggle('nav-open');
		};

		navToggle?.addEventListener('click', toggleMenu);
		backdrop?.addEventListener('click', toggleMenu);

		links.forEach((a) => {
			try {
				if (a.pathname === window.location.pathname)
					a.classList.add('active');
			} catch (e) { }
			a.addEventListener('click', () => {
				if (navList.classList.contains('open')) toggleMenu();
			});
		});
	},
};

// Get device id
const fetchDeviceId = async () => {
	try {
		const data = await ApiService.get('/device-id');
		device_id = data || 'Unknown Device';
	} catch (e) {
		device_id = 'Unknown Device';
	}
};

/* Device details and sensor refreshers (unchanged logic) */
const DeviceModule = {
	async loadDetails() {
		const container = document.getElementById('device_details');
		if (!container) return;
		try {
			const data = await ApiService.get('/device-details');
			let html = '';
			for (const [section, sectionData] of Object.entries(data || {})) {
				if (!sectionData || Object.keys(sectionData).length === 0)
					continue;
				html += `<h2 class="sensor-group__title sensor-group__title--section">${section.toUpperCase()}</h2>`;
				html += `<div class="sensor-group__data">`;
				for (const [k, v] of Object.entries(sectionData)) {
					html += `<div class="sensor-data__row"><span class="sensor-data__label">${k}</span><span class="sensor-data__value">${v}</span></div>`;
				}
				html += '</div>';
			}
			container.innerHTML = html;
		} catch (e) {
			container.innerHTML =
				'<p class="info-text error-text">Failed to load device details.</p>';
		}
	},
};

const SensorModule = {
	async refresh() {
		// early exit when no sensors on page
		if (!document.getElementById('PM1_DATA')) return;
		try {
			const data = await ApiService.get('/sensor-data');
			if (data?.PM) {
				UI.updateText('PM1_DATA', `${data.PM.PM1} µg/m³`);
				UI.updateText('PM25_DATA', `${data.PM['PM2.5']} µg/m³`);
				UI.updateText('PM10_DATA', `${data.PM.PM10} µg/m³`);
			}
			if (data?.DHT) {
				UI.updateText('temperature', `${data.DHT.temperature} °C`);
				UI.updateText('humidity', `${data.DHT.humidity} %`);
			}
		} catch (e) {
			console.error('Sensor error', e);
		}
	},
};

const FileSystemModule = {
	async loadFileSystem() {
		const container = document.getElementById('file-system');
		if (!container) return;
		try {
			const files = await ApiService.get('/list-files');
			container.innerHTML = UI.renderFileTree(files);
		} catch (e) {
			container.innerHTML =
				'<p class="info-text error-text">Could not load file system.</p>';
		}
	},
};

/* Single, consolidated configuration module */
const ConfigModule = {
	currentStep: 0,
	forms: [],
	init() {
		this.forms = Array.from(document.querySelectorAll('.config-form'));
		if (this.forms.length === 0) return;

		// stepper indicators
		const indicators = Array.from(
			document.querySelectorAll('.stepper__indicator'),
		);

		// show step by index (makes sure data-step matches)
		const showStep = (idx) => {
			this.forms.forEach((f) => {
				const i = Number(f.dataset.step);
				const active = i === idx;
				f.classList.toggle('hidden', !active);
				f.classList.toggle('step--active', active);
				f.setAttribute('aria-hidden', (!active).toString());
			});
			indicators.forEach((ind) => {
				const i = Number(ind.dataset.step);
				ind.classList.toggle('stepper__indicator--active', i === idx);
				ind.setAttribute('aria-selected', (i === idx).toString());
			});
			this.currentStep = idx;
			// focus first input in current form (accessibility)
			const cur = this.forms.find((f) => Number(f.dataset.step) === idx);
			if (cur) {
				const first = cur.querySelector(
					'input, select, textarea, button',
				);
				first?.focus();
			}
		};

		// wire indicators
		indicators.forEach((ind) =>
			ind.addEventListener('click', () =>
				showStep(Number(ind.dataset.step)),
			),
		);

		// next / prev
		document.querySelectorAll('.next-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const next = Number(btn.dataset.next ?? this.currentStep + 1);
				if (next <= this.forms.length - 1) showStep(next);
			});
		});
		document.querySelectorAll('.prev-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const prev = Number(btn.dataset.prev ?? this.currentStep - 1);
				if (prev >= 0) showStep(prev);
			});
		});

		// hotspot selection (delegated)
		const hotspotList = document.getElementById('hotspots-list');
		hotspotList?.addEventListener('click', (e) => {
			const item = e.target.closest('.hotspot');
			if (!item) return;
			hotspotList
				.querySelectorAll('.hotspot')
				.forEach((h) => h.classList.remove('selected'));
			item.classList.add('selected');
			const ssid = item.dataset.ssid;
			if (ssid) document.getElementById('ssid').value = ssid;
		});

		// toggle password(s)
		document.querySelectorAll('.toggle-password').forEach((chk) => {
			chk.addEventListener('change', (e) => {
				const wrapper = e.target.closest('.password-wrapper');
				if (!wrapper) return;
				const input = wrapper.querySelector(
					'input:not(.toggle-password)',
				);
				if (!input) return;
				input.type = e.target.checked ? 'text' : 'password';
			});
		});

		// SIM PIN: numeric only, max 4 digits (typing + paste)
		const simPinInput = document.getElementById('simPin');
		simPinInput?.addEventListener('input', () => {
			simPinInput.value = simPinInput.value
				.replace(/\D/g, '')
				.slice(0, 4);
		});

		// final submit (collect all config-form fields)
		const saveHandler = async (e) => {
			e.preventDefault();
			if (!confirm('Save configuration and reboot device?')) return;

			// combine all forms
			const allData = {};
			this.forms.forEach((form) => {
				const fd = new FormData(form);
				for (const [key, val] of fd.entries()) {
					// handle checkboxes: browser returns 'on' when checked and no value attribute
					if (val === 'on') {
						allData[key] = true;
					} else {
						// last-wins for same name across forms
						allData[key] = val;
					}
				}
			});

			if (allData.simPin) {
				const simPin = String(allData.simPin).replace(/\D/g, '');
				if (simPin.length > 4) {
					alert('SIM PIN must be at most 4 digits.');
					return;
				}
				allData.simPin = simPin;
			}

			try {
				await ApiService.post('/save-config', allData);
				alert('Success! Device is restarting...');
				window.location.href = '/';
			} catch (err) {
				alert('Failed to save: ' + (err.message || err));
			}
		};
		// attach to powerForm submit (final step form)
		document
			.getElementById('powerForm')
			?.addEventListener('submit', saveHandler);

		// skip button
		document
			.getElementById('skip-btn')
			?.addEventListener('click', () => (window.location.href = '/'));

		// load hotspots initially
		this.refreshHotspots();
		// set initial step (0)
		showStep(0);
	},
	async refreshHotspots() {
		const list = document.getElementById('hotspots-list');
		if (!list) return;
		list.innerHTML = '<li class="info-text">Scanning...</li>';
		try {
			const data = await ApiService.get('/available-hotspots'); // expected { "ssid": { rssi: -60, encType: 1 }, ... }
			const html = Object.entries(data || {})
				.map(([ssid, info]) => {
					const safeId = `hotspot-${ssid.replace(/[^a-z0-9-_]/gi, '_')}`;
					let lockHtml = '';
					if (info) {
						if (typeof info.encType === 'string') {
							if (info.encType.toLowerCase() !== 'open') {
								lockHtml =
									'<img src="icons/lock.svg" alt="locked" class="hotspot-icon hotspot-lock" />';
							}
						} else if (info.encType && info.encType > 0) {
							lockHtml =
								'<img src="icons/lock.svg" alt="locked" class="hotspot-icon hotspot-lock" />';
						}
					}
					return `<li id="${safeId}" class="hotspot" data-ssid="${ssid}" tabindex="0" role="button">
							<span class="hotspot-ssid"><img src="icons/wifi.svg" alt="wifi" class="hotspot-icon" /> ${ssid}</span>
							<span class="hotspot-rssi">${info?.rssi ?? ''} dBm</span>
							<span class="hotspot-sec">${lockHtml}</span>
					</li>`;
				})
				.join('');
			list.innerHTML =
				html || '<li class="info-text">No hotspots found</li>';
			// auto-select first
			const first = list.querySelector('.hotspot');
			if (first) {
				first.classList.add('selected');
				document.getElementById('ssid').value =
					first.dataset.ssid || '';
			}
		} catch (e) {
			list.innerHTML = '<li class="info-text">Scan failed.</li>';
		}
	},
};

/* OTA Module (unchanged) */
const OtaModule = {
	init() {
		const form = document.getElementById('ota_form');
		const fileInput = document.getElementById('firmware_input');
		const progressWrapper = document.getElementById('progress_wrapper');
		if (!form || !fileInput) return;

		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const file = fileInput.files[0];
			if (!file) return alert('Please select a file.');
			if (!file.name.endsWith('.bin'))
				return alert('Only .bin files allowed.');
			if (file.size > 2 * 1024 * 1024)
				return alert('File too large (Max 2MB).');
			if (!confirm('Are you sure you want to flash this firmware?'))
				return;

			progressWrapper?.classList.remove('hidden');
			form.querySelector('button')?.setAttribute('disabled', 'disabled');

			ApiService.uploadFile(
				'/ota_upload',
				file,
				(pct) => UI.updateText('upload_progress', `${pct}%`),
				() => {
					UI.updateText('upload_status', 'Success! Rebooting...');
					setTimeout(() => (window.location.href = '/'), 5000);
				},
				(err) => {
					UI.updateText('upload_status', 'Failed');
					alert(err);
					form.querySelector('button')?.removeAttribute('disabled');
				},
			);
		});
	},
};

const App = {
	async init() {
		await fetchDeviceId();
		await this.injectLayout();
		Navigation.init();
		// init modules if relevant DOM is present
		if (document.getElementById('config_page')) ConfigModule.init();
		if (document.getElementById('ota_form')) OtaModule.init();
		if (document.getElementById('device_details'))
			DeviceModule.loadDetails();
		if (document.getElementById('file-system'))
			FileSystemModule.loadFileSystem();
		// start sensor polling if needed
		SensorModule.refresh();
		setInterval(() => SensorModule.refresh(), 300_000);
	},
	async injectLayout() {
		// simply set innerHTML from in-memory templates; removes the need for
		// partial files to be copied at build time or even fetched over network
		const map = {
			'layout-header': 'header',
			'layout-footer': 'footer',
		};
		for (const [id, key] of Object.entries(map)) {
			const el = document.getElementById(id);
			if (el && typeof layoutTemplates[key] === 'function') {
				el.innerHTML = layoutTemplates[key]();
			}
		}
	},
};

document.addEventListener('DOMContentLoaded', () => {
	App.init();
});
