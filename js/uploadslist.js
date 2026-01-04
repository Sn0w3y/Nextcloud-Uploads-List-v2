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
        try {
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
        } catch (e) {
            console.error('[UploadsList] Panel update error:', e);
        }
    }

    function isUploadUrl(url) {
        if (!url) return false;
        return url.includes('/remote.php/dav/') ||
               url.includes('/remote.php/webdav/') ||
               url.includes('/public.php/dav/');
    }

    function getFileInfoFromUrl(url) {
        try {
            const urlParts = url.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            if (lastPart && !lastPart.match(/^\d+$/) && lastPart !== '.file') {
                return decodeURIComponent(lastPart);
            }
        } catch (e) {}
        return null;
    }

    // Safe XHR monitoring - only adds listeners, doesn't modify behavior
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._ulMethod = method;
        this._ulUrl = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
        try {
            if ((this._ulMethod === 'PUT' || this._ulMethod === 'POST') && isUploadUrl(this._ulUrl)) {
                let fileName = getFileInfoFromUrl(this._ulUrl) || 'Uploading...';
                let fileSize = 0;

                if (data instanceof File) {
                    fileName = data.name;
                    fileSize = data.size;
                } else if (data instanceof Blob) {
                    fileSize = data.size;
                } else if (data && typeof data.size === 'number') {
                    fileSize = data.size;
                }

                console.log('[UploadsList] Detected upload:', fileName, fileSize, 'bytes');
                if (fileSize > 0) { // Track all files
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

                    // Use passive event listeners
                    this.upload.addEventListener('progress', function(e) {
                        try {
                            if (e.lengthComputable) {
                                const upload = uploads.get(id);
                                if (upload) {
                                    const now = Date.now();
                                    const timeDiff = (now - upload.lastTime) / 1000;

                                    if (timeDiff > 0.3) {
                                        const loadedDiff = e.loaded - upload.lastLoaded;
                                        upload.speed = loadedDiff / timeDiff;
                                        upload.lastTime = now;
                                        upload.lastLoaded = e.loaded;
                                    }

                                    upload.loaded = e.loaded;
                                    upload.total = e.total;
                                    updatePanel();
                                }
                            }
                        } catch (err) {
                            console.error('[UploadsList] Progress error:', err);
                        }
                    }, { passive: true });

                    const cleanup = function() {
                        uploads.delete(id);
                        updatePanel();
                    };

                    this.addEventListener('load', cleanup, { passive: true });
                    this.addEventListener('error', cleanup, { passive: true });
                    this.addEventListener('abort', cleanup, { passive: true });
                    this.addEventListener('timeout', cleanup, { passive: true });
                }
            }
        } catch (e) {
            console.error('[UploadsList] XHR intercept error:', e);
        }

        // Always call original - never block the upload!
        return originalXHRSend.apply(this, arguments);
    };

    console.log('[UploadsList] v2.0.2 Initialized');
})();
