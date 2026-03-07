/**
 * API SERVICE (Data Fetching)
 */
const ApiService = {
	async get(path) {
		const resp = await fetch(path);
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		const contentType = resp.headers.get('content-type');
		// If the server sends text/plain, use .text() instead of .json()
		if (contentType && contentType.includes('text/plain')) {
			return resp.text();
		}
		return resp.json();
	},

	async post(path, data) {
		const resp = await fetch(path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
		});
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		return resp.json();
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

const UI = {
	updateText: (id, text) => {
		const el = document.getElementById(id);
		if (el) el.textContent = text;
	},

	log: (msg, type = 'info') => {
		const form = document.querySelector('#ota_form');
		if (!form) return;
		const p = document.createElement('p');
		p.textContent = msg;
		p.style.color = type === 'error' ? 'red' : 'var(--primary)';
		p.className = 'info-text';
		form.appendChild(p);
	},

	renderFileTree: (node, indent = 0, currentPath = '') => {
		return Object.keys(node)
			.map((key) => {
				const val = node[key];
				const fullPath = `${currentPath}/${key}`.replace(/\/+/g, '/');
				const margin = indent * 20;

				if (typeof val === 'object' && val !== null) {
					return `
                    <div style="margin-left: ${margin}px; margin-top: 0.5rem;">
                        <strong>📁 ${key}</strong>
                    </div>
                    ${UI.renderFileTree(val, indent + 1, fullPath)}`;
				}

				return `
                <div class="sensor-data__row" style="margin-left: ${margin}px; border-bottom: 1px dashed var(--border-color);">
                    <span class="sensor-data__label">📄 ${key}</span>
                    <a href="/download?file=${encodeURIComponent(fullPath)}"
                       download="${key}"
                       class="btn--primary"
                       style="padding: 2px 8px; border-radius: 4px; text-decoration: none;">⏬</a>
                </div>`;
			})
			.join('');
	},
};

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
			navToggle?.classList.toggle('open');
			navList?.classList.toggle('open');
			backdrop?.classList.toggle('open');
		};

		navToggle?.addEventListener('click', toggleMenu);
		backdrop?.addEventListener('click', toggleMenu);

		links.forEach((a) => {
			if (a.pathname === window.location.pathname) {
				a.classList.add('active');
			}
			a.addEventListener('click', () => {
				if (navList?.classList.contains('open')) toggleMenu();
			});
		});
	},
};

const DeviceModule = {
	async loadDetails() {
		const container = document.getElementById('device_details');
		if (!container) return;

		try {
			const data = await ApiService.get('/device-details');
			let html = '';
			for (const [section, sectionData] of Object.entries(data)) {
				if (!sectionData || Object.keys(sectionData).length === 0)
					continue;
				html += `<h2 class="sensor-group__title" style="margin-top:2rem;">${section.toUpperCase()}</h2>`;
				html += `<div class="sensor-group__data" style="width:100%">`;
				for (const [k, v] of Object.entries(sectionData)) {
					html += `
						<div class="sensor-data__row">
							<span class="sensor-data__label">${k}</span>
							<span class="sensor-data__value">${v}</span>
						</div>`;
				}
				html += '</div>';
			}
			container.innerHTML = html;
		} catch (e) {
			container.innerHTML =
				'<p class="text-red-500">Failed to load device details.</p>';
		}
	},
};

const SensorModule = {
	async refresh() {
		if (!document.getElementById('PM1_DATA')) return;
		try {
			const data = await ApiService.get('/sensor-data');
			if (data.PM) {
				UI.updateText('PM1_DATA', `${data.PM.PM1} µg/m³`);
				UI.updateText('PM25_DATA', `${data.PM['PM2.5']} µg/m³`);
				UI.updateText('PM10_DATA', `${data.PM.PM10} µg/m³`);
			}
			if (data.DHT) {
				UI.updateText('temperature', `${data.DHT.temperature} °C`);
				UI.updateText('humidity', `${data.DHT.humidity} %`);
			}
		} catch (e) {
			console.error('Sensor error', e);
		}
	},
};

const App = {
	async init() {
		// Crucial: Wait for header to exist in DOM before calling initial data
		await this.injectLayout();

		Navigation.init();
		this.loadInitialData(); // Now finds #device-id safely

		if (document.getElementById('ota_form')) this.setupOTA();
		if (document.getElementById('device_details'))
			DeviceModule.loadDetails();

		this.startPolling();
	},

	async injectLayout() {
		const slots = {
			'layout-header': 'partials/header.html',
			'layout-footer': 'partials/footer.html',
		};
		for (const [id, path] of Object.entries(slots)) {
			const el = document.getElementById(id);
			if (el) {
				const resp = await fetch(path).catch(() => null);
				if (resp && resp.ok) el.innerHTML = await resp.text();
			}
		}
	},

	setupOTA() {
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
			form.querySelector('button').disabled = true;
			UI.updateText('upload_status', 'Uploading...');

			ApiService.uploadFile(
				'/ota_upload',
				file,
				(pct) => {
					// pct added back here
					UI.updateText('upload_progress', `${pct}%`);
				},
				() => {
					UI.updateText('upload_status', 'Success! Rebooting...');
					UI.log('Firmware updated successfully.', 'info');
					setTimeout(() => (window.location.href = '/'), 5000);
				},
				(err) => {
					UI.updateText('upload_status', 'Failed');
					alert(err);
					form.querySelector('button').disabled = false;
				},
			);
		});
	},

	async loadInitialData() {
		ApiService.get('/device-id')
			.then((id) => {
				// Handle both raw string or {id: "..."} responses
				const val = typeof id === 'object' ? id.id : id;
				UI.updateText('device-id', val || '--');
			})
			.catch(() => UI.updateText('device-id', '--'));

		const fsEl = document.getElementById('file-system');
		if (fsEl) {
			try {
				const files = await ApiService.get('/list-files');
				fsEl.innerHTML = UI.renderFileTree(files);
			} catch (e) {
				fsEl.innerHTML =
					'<p class="text-red-500">Could not list files.</p>';
			}
		}
	},

	startPolling() {
		SensorModule.refresh();
		setInterval(() => SensorModule.refresh(), 300000);
	},
};

document.addEventListener('DOMContentLoaded', () => App.init());
