// Video Converter PWA using FFmpeg.wasm

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filesSection = document.getElementById('filesSection');
const filesList = document.getElementById('filesList');
const settingsSection = document.getElementById('settingsSection');
const convertBtn = document.getElementById('convertBtn');
const progressSection = document.getElementById('progressSection');
const progressList = document.getElementById('progressList');
const resultsSection = document.getElementById('resultsSection');
const resultsList = document.getElementById('resultsList');
const loadingOverlay = document.getElementById('loadingOverlay');

let ffmpeg = null;
let files = [];

// Initialize FFmpeg
async function loadFFmpeg() {
    if (ffmpeg) return;

    loadingOverlay.classList.remove('hidden');

    try {
        const { FFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
        const { toBlobURL } = await import('https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js');

        ffmpeg = new FFmpeg();

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        const workerURL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            workerURL: await toBlobURL(workerURL, 'text/javascript'),
        });

        console.log('FFmpeg loaded successfully');
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        alert('Failed to load FFmpeg. Please refresh the page and try again.');
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}

// Drag and drop handlers
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(newFiles) {
    const videoFiles = Array.from(newFiles).filter(file => file.type.startsWith('video/'));
    
    if (videoFiles.length === 0) {
        alert('Please select video files');
        return;
    }

    files = [...files, ...videoFiles];
    renderFiles();
    showSections();
}

function renderFiles() {
    filesList.innerHTML = '';
    
    files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            <div class="file-info">
                <div class="file-name"></div>
                <div class="file-size"></div>
            </div>
            <button class="remove-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        // Safely set text content
        item.querySelector('.file-name').textContent = file.name;
        item.querySelector('.file-size').textContent = formatFileSize(file.size);
        
        // Add event listener instead of inline onclick
        const removeBtn = item.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => removeFile(index));
        
        filesList.appendChild(item);
    });
}

window.removeFile = function(index) {
    files.splice(index, 1);
    renderFiles();
    
    if (files.length === 0) {
        filesSection.classList.add('hidden');
        settingsSection.classList.add('hidden');
    }
};

function showSections() {
    filesSection.classList.remove('hidden');
    settingsSection.classList.remove('hidden');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Convert button handler
convertBtn.addEventListener('click', async () => {
    if (files.length === 0) return;

    await loadFFmpeg();
    
    if (!ffmpeg) return;

    convertBtn.disabled = true;
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    progressList.innerHTML = '';
    resultsList.innerHTML = '';

    const settings = {
        format: document.getElementById('outputFormat').value,
        codec: document.getElementById('videoCodec').value,
        quality: document.getElementById('quality').value,
        resolution: document.getElementById('resolution').value
    };

    const results = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await convertVideo(file, settings, i);
        results.push(result);
    }

    showResults(results);
    convertBtn.disabled = false;
});

async function convertVideo(file, settings, index) {
    const progressItem = createProgressItem(file.name, index);
    progressList.appendChild(progressItem);

    try {
        // Write input file to FFmpeg's virtual file system
        const inputName = `input_${index}.${file.name.split('.').pop()}`;
        const outputName = `output_${index}.${settings.format}`;

        const fileData = await file.arrayBuffer();
        await ffmpeg.writeFile(inputName, new Uint8Array(fileData));

        // Build FFmpeg command
        const args = ['-i', inputName];

        // Video codec
        if (settings.codec !== 'copy') {
            args.push('-c:v', settings.codec);
            
            // Quality settings
            if (settings.codec === 'libx264' || settings.codec === 'libx265') {
                const crf = settings.quality === 'high' ? '18' : settings.quality === 'medium' ? '23' : '28';
                args.push('-crf', crf);
            } else if (settings.codec === 'libvpx-vp9') {
                const crf = settings.quality === 'high' ? '15' : settings.quality === 'medium' ? '31' : '45';
                args.push('-crf', crf, '-b:v', '0');
            }
        } else {
            args.push('-c:v', 'copy');
        }

        // Audio codec
        if (settings.codec === 'copy') {
            args.push('-c:a', 'copy');
        } else {
            args.push('-c:a', 'aac');
        }

        // Resolution
        if (settings.resolution) {
            args.push('-s', settings.resolution);
        }

        args.push(outputName);

        // Set up progress monitoring
        ffmpeg.on('progress', ({ progress }) => {
            updateProgress(index, Math.round(progress * 100));
        });

        // Execute conversion
        await ffmpeg.exec(args);

        // Read output file
        const data = await ffmpeg.readFile(outputName);
        const blob = new Blob([data.buffer], { type: `video/${settings.format}` });
        const url = URL.createObjectURL(blob);

        // Cleanup
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);

        updateProgress(index, 100);

        return {
            name: file.name.replace(/\.[^.]+$/, `.${settings.format}`),
            url: url,
            size: blob.size,
            success: true
        };
    } catch (error) {
        console.error('Conversion error:', error);
        updateProgress(index, 0, 'Failed');
        return {
            name: file.name,
            success: false,
            error: error.message
        };
    }
}

function createProgressItem(fileName, index) {
    const item = document.createElement('div');
    item.className = 'progress-item';
    item.id = `progress-${index}`;
    item.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        <div class="progress-info">
            <div class="progress-name">${fileName}</div>
            <div class="progress-status">Starting...</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
        </div>
    `;
    return item;
}

function updateProgress(index, percent, status = null) {
    const item = document.getElementById(`progress-${index}`);
    if (!item) return;

    const fill = item.querySelector('.progress-fill');
    const statusEl = item.querySelector('.progress-status');

    fill.style.width = `${percent}%`;
    statusEl.textContent = status || `${percent}%`;
}

function showResults(results) {
    progressSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'result-item';

        if (result.success) {
            item.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <div class="result-info">
                    <div class="result-name"></div>
                    <div class="result-status"></div>
                </div>
                <button class="download-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download
                </button>
            `;
            
            // Safely set text content
            item.querySelector('.result-name').textContent = result.name;
            item.querySelector('.result-status').textContent = formatFileSize(result.size);
            
            // Add event listener instead of inline onclick
            const downloadBtn = item.querySelector('.download-btn');
            downloadBtn.addEventListener('click', () => downloadFile(result.url, result.name));
        } else {
            item.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #f56565;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <div class="result-info">
                    <div class="result-name"></div>
                    <div class="result-status" style="color: #f56565;">Conversion failed</div>
                </div>
            `;
            
            // Safely set text content
            item.querySelector('.result-name').textContent = result.name;
        }

        resultsList.appendChild(item);
    });
}

window.downloadFile = function(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};
