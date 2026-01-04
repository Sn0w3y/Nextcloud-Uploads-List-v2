(function() {
    'use strict';

    const uploads = new Map();
    let panel = null;
    let listContainer = null;
    let isMinimized = false;

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatSpeed(bytesPerSecond) {
        return formatBytes(bytesPerSecond) + '/s';
    }

    function formatTime(seconds) {
        if (!seconds || seconds === Infinity) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + secs.toString().padStart(2, '0');
    }

    function createPanel() {
        if (panel) return;

        panel = document.createElement('div');
        panel.id = 'uploads-list-panel';
        panel.innerHTML = `
            <div class="uploads-list-header">
                <span class="uploads-list-title">Uploads</span>
                <span class="uploads-list-count">(0)</span>
                <button class="uploads-list-toggle" title="Minimize">−</button>
            </div>
            <div class="uploads-list-content"></div>
        `;
        document.body.appendChild(panel);

        listContainer = panel.querySelector('.uploads-list-content');

        panel.querySelector('.uploads-list-toggle').addEventListener('click', () => {
            isMinimized = !isMinimized;
            panel.classList.toggle('minimized', isMinimized);
            panel.querySelector('.uploads-list-toggle').textContent = isMinimized ? '+' : '−';
        });

        panel.querySelector('.uploads-list-header').addEventListener('click', (e) => {
            if (e.target.classList.contains('uploads-list-toggle')) return;
            isMinimized = !isMinimized;
            panel.classList.toggle('minimized', isMinimized);
            panel.querySelector('.uploads-list-toggle').textContent = isMinimized ? '+' : '−';
        });
    }

    function updatePanel() {
        if (!panel) createPanel();

        const count = uploads.size;
        panel.querySelector('.uploads-list-count').textContent = `(${count})`;

        if (count === 0) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'block';
        listContainer.innerHTML = '';

        uploads.forEach((upload, id) => {
            const item = document.createElement('div');
            item.className = 'upload-item';

            const percent = upload.total > 0 ? Math.round((upload.loaded / upload.total) * 100) : 0;
            const speed = upload.speed || 0;
            const remaining = speed > 0 ? (upload.total - upload.loaded) / speed : 0;

            item.innerHTML = `
                <div class="upload-item-name" title="${upload.name}">${upload.name}</div>
                <div class="upload-item-progress">
                    <div class="upload-item-bar" style="width: ${percent}%"></div>
                </div>
                <div class="upload-item-stats">
                    <span class="upload-item-percent">${percent}%</span>
                    <span class="upload-item-size">${formatBytes(upload.loaded)} / ${formatBytes(upload.total)}</span>
                    <span class="upload-item-speed">${formatSpeed(speed)}</span>
                    <span class="upload-item-time">${formatTime(remaining)}</span>
                </div>
            `;
            listContainer.appendChild(item);
        });
    }

    function trackUpload(xhr, file) {
        const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        uploads.set(id, {
            name: file.name || 'Unknown',
            total: file.size || 0,
            loaded: 0,
            speed: 0,
            startTime: Date.now(),
            lastLoaded: 0,
            lastTime: Date.now()
        });

        updatePanel();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const upload = uploads.get(id);
                if (upload) {
                    const now = Date.now();
                    const timeDiff = (now - upload.lastTime) / 1000;
                    const loadedDiff = e.loaded - upload.lastLoaded;

                    if (timeDiff > 0.5) {
                        upload.speed = loadedDiff / timeDiff;
                        upload.lastTime = now;
                        upload.lastLoaded = e.loaded;
                    }

                    upload.loaded = e.loaded;
                    upload.total = e.total;
                    updatePanel();
                }
            }
        });

        xhr.addEventListener('loadend', () => {
            uploads.delete(id);
            updatePanel();
        });

        xhr.addEventListener('error', () => {
            uploads.delete(id);
            updatePanel();
        });

        xhr.addEventListener('abort', () => {
            uploads.delete(id);
            updatePanel();
        });
    }

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._uploadMethod = method;
        this._uploadUrl = url;
        return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(data) {
        if (this._uploadMethod === 'PUT' || this._uploadMethod === 'POST') {
            // Check if this looks like a file upload to Nextcloud
            const url = this._uploadUrl || '';
            if (url.includes('/remote.php/dav/') ||
                url.includes('/remote.php/webdav/') ||
                url.includes('/uploads/')) {

                let fileName = 'Unknown file';
                let fileSize = 0;

                // Try to get filename from URL
                const urlParts = url.split('/');
                const lastPart = urlParts[urlParts.length - 1];
                if (lastPart && !lastPart.match(/^\d+$/)) {
                    fileName = decodeURIComponent(lastPart);
                }

                // Try to get file info from data
                if (data instanceof File) {
                    fileName = data.name;
                    fileSize = data.size;
                } else if (data instanceof Blob) {
                    fileSize = data.size;
                } else if (data && data.size) {
                    fileSize = data.size;
                }

                // Get content-length if set
                const contentLength = this.getResponseHeader ? null : null;

                if (fileSize > 0 || (data && data.size > 0)) {
                    trackUpload(this, { name: fileName, size: fileSize || (data && data.size) || 0 });
                }
            }
        }
        return originalXHRSend.call(this, data);
    };

    // Also intercept fetch for modern uploads
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const urlStr = url.toString();

        if ((method === 'PUT' || method === 'POST') &&
            (urlStr.includes('/remote.php/dav/') ||
             urlStr.includes('/remote.php/webdav/') ||
             urlStr.includes('/uploads/'))) {

            let fileName = 'Unknown file';
            let fileSize = 0;

            // Get filename from URL
            const urlParts = urlStr.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            if (lastPart && !lastPart.match(/^\d+$/)) {
                fileName = decodeURIComponent(lastPart);
            }

            // Get size from body
            if (options.body) {
                if (options.body instanceof File) {
                    fileName = options.body.name;
                    fileSize = options.body.size;
                } else if (options.body instanceof Blob) {
                    fileSize = options.body.size;
                }
            }

            if (fileSize > 0) {
                // For fetch, we need to use a different tracking method
                const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                uploads.set(id, {
                    name: fileName,
                    total: fileSize,
                    loaded: 0,
                    speed: 0,
                    startTime: Date.now(),
                    lastLoaded: 0,
                    lastTime: Date.now()
                });
                updatePanel();

                return originalFetch.call(this, url, options).finally(() => {
                    uploads.delete(id);
                    updatePanel();
                });
            }
        }

        return originalFetch.call(this, url, options);
    };

    console.log('[UploadsList] Initialized - monitoring uploads');
})();
