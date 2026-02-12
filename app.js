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
const advancedToggle = document.getElementById('advancedToggle');
const advancedSection = document.getElementById('advancedSection');
const outputFormat = document.getElementById('outputFormat');
const videoCodec = document.getElementById('videoCodec');
const audioCodec = document.getElementById('audioCodec');

let ffmpeg = null;
let files = [];

// Format-to-codec mapping for "auto" mode
const FORMAT_DEFAULTS = {
    mp4:  { video: 'libx264',     audio: 'aac' },
    webm: { video: 'libvpx-vp9',  audio: 'libopus' },
    avi:  { video: 'mpeg4',        audio: 'libmp3lame' },
    mov:  { video: 'libx264',     audio: 'aac' },
    mkv:  { video: 'libx264',     audio: 'aac' },
    flv:  { video: 'libx264',     audio: 'aac' },
    ts:   { video: 'mpeg2video',  audio: 'aac' },
    mpg:  { video: 'mpeg2video',  audio: 'libmp3lame' },
    gif:  { video: 'gif',         audio: null },
    mp3:  { video: null,          audio: 'libmp3lame' },
    wav:  { video: null,          audio: 'pcm_s16le' },
    ogg:  { video: null,          audio: 'libvorbis' },
    aac:  { video: null,          audio: 'aac' },
    flac: { video: null,          audio: 'flac' },
};

const AUDIO_ONLY_FORMATS = ['mp3', 'wav', 'ogg', 'aac', 'flac'];

// Toggle advanced section
advancedToggle.addEventListener('click', () => {
    advancedSection.classList.toggle('hidden');
    advancedToggle.classList.toggle('open');
});

// Smart format/codec linking
outputFormat.addEventListener('change', () => {
    updateCodecDefaults();
});

function updateCodecDefaults() {
    const format = outputFormat.value;
    const isAudioOnly = AUDIO_ONLY_FORMATS.includes(format);

    // Disable/enable video-related controls for audio-only formats
    const videoOnlyIds = ['videoCodec', 'quality', 'resolution', 'framerate', 'videoBitrate', 'rotation', 'aspectRatio', 'preset', 'speed'];
    videoOnlyIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = isAudioOnly;
            el.closest('.setting-group').classList.toggle('disabled', isAudioOnly);
        }
    });

    // If codec selects are on "auto", no need to change them — they resolve at convert time
    // But update placeholder text if helpful
    if (videoCodec.value === 'auto') {
        const defaults = FORMAT_DEFAULTS[format];
        const autoOption = videoCodec.querySelector('option[value="auto"]');
        if (defaults && defaults.video) {
            autoOption.textContent = `Auto (${defaults.video})`;
        } else {
            autoOption.textContent = 'Auto (none)';
        }
    }

    if (audioCodec.value === 'auto') {
        const defaults = FORMAT_DEFAULTS[format];
        const autoOption = audioCodec.querySelector('option[value="auto"]');
        if (defaults && defaults.audio) {
            autoOption.textContent = `Auto (${defaults.audio})`;
        } else {
            autoOption.textContent = 'Auto (none)';
        }
    }

    // For GIF, suggest lower framerate
    if (format === 'gif') {
        const framerate = document.getElementById('framerate');
        if (!framerate.value) {
            framerate.value = '10';
        }
    }
}

// Initialize codec hints
updateCodecDefaults();

// Initialize FFmpeg
async function loadFFmpeg() {
    if (ffmpeg) return;

    loadingOverlay.classList.remove('hidden');

    try {
        const { FFmpeg } = await import('https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/index.js');
        const { toBlobURL } = await import('https://unpkg.com/@ffmpeg/util@0.12.2/dist/esm/index.js');

        ffmpeg = new FFmpeg();

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
        const workerURL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/esm/worker.js';
        const workerBlob = new Blob(
            [`import "${workerURL}";`],
            { type: 'text/javascript' }
        );
        const classWorkerURL = URL.createObjectURL(workerBlob);
        await ffmpeg.load({
            classWorkerURL,
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
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
            .then((reg) => console.log('Service Worker registered'))
            .catch((err) => console.error('Service Worker registration failed:', err));
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
    const videoFiles = Array.from(newFiles).filter((file) => file.type.startsWith('video/') || file.type.startsWith('audio/'));
    
    if (videoFiles.length === 0) {
        alert('Please select video or audio files');
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

// Resolve "auto" codec to actual codec based on format
function resolveVideoCodec(codec, format) {
    if (codec === 'auto') {
        const defaults = FORMAT_DEFAULTS[format];
        return defaults ? defaults.video : 'libx264';
    }
    return codec;
}

function resolveAudioCodec(codec, format) {
    if (codec === 'auto') {
        const defaults = FORMAT_DEFAULTS[format];
        return defaults ? defaults.audio : 'aac';
    }
    return codec;
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

    const format = outputFormat.value;
    const isAudioOnly = AUDIO_ONLY_FORMATS.includes(format);

    const settings = {
        format: format,
        codec: resolveVideoCodec(document.getElementById('videoCodec').value, format),
        audioCodec: resolveAudioCodec(document.getElementById('audioCodec').value, format),
        quality: document.getElementById('quality').value,
        resolution: document.getElementById('resolution').value,
        framerate: document.getElementById('framerate').value,
        isAudioOnly: isAudioOnly,
        // Advanced settings
        videoBitrate: document.getElementById('videoBitrate').value,
        audioBitrate: document.getElementById('audioBitrate').value,
        sampleRate: document.getElementById('sampleRate').value,
        audioChannels: document.getElementById('audioChannels').value,
        speed: document.getElementById('speed').value,
        rotation: document.getElementById('rotation').value,
        aspectRatio: document.getElementById('aspectRatio').value,
        preset: document.getElementById('preset').value,
        trimStart: document.getElementById('trimStart').value.trim(),
        trimEnd: document.getElementById('trimEnd').value.trim(),
        customArgs: document.getElementById('customArgs').value.trim(),
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
        const args = buildFFmpegArgs(inputName, outputName, settings);

        // Set up progress monitoring
        ffmpeg.on('progress', ({ progress }) => {
            updateProgress(index, Math.round(progress * 100));
        });

        // Execute conversion
        await ffmpeg.exec(args);

        // Read output file
        const data = await ffmpeg.readFile(outputName);
        const mimeType = settings.isAudioOnly ? `audio/${settings.format}` : `video/${settings.format}`;
        const blob = new Blob([data.buffer], { type: mimeType });
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

function buildFFmpegArgs(inputName, outputName, settings) {
    const args = [];

    // Trim start (must come before -i for input seeking)
    if (settings.trimStart && settings.trimStart !== '00:00:00') {
        args.push('-ss', settings.trimStart);
    }

    args.push('-i', inputName);

    // Trim end (duration/to — after input)
    if (settings.trimEnd && settings.trimEnd !== '00:00:00') {
        args.push('-to', settings.trimEnd);
    }

    // Build video filter chain
    const videoFilters = [];

    if (!settings.isAudioOnly) {
        // --- Video codec ---
        if (settings.codec === 'copy') {
            args.push('-c:v', 'copy');
        } else if (settings.format === 'gif') {
            // GIF-specific pipeline: generate palette for quality
            // Simple approach: just use default gif encoder
            // For better quality, we'd need two-pass with palettegen, but that's complex in wasm
        } else if (settings.codec) {
            args.push('-c:v', settings.codec);

            // Quality (CRF) — only when not using explicit video bitrate
            if (!settings.videoBitrate) {
                if (settings.codec === 'libx264' || settings.codec === 'libx265') {
                    const crfMap = { highest: '15', high: '18', medium: '23', low: '28', lowest: '35' };
                    args.push('-crf', crfMap[settings.quality] || '23');
                } else if (settings.codec === 'libvpx-vp9') {
                    const crfMap = { highest: '10', high: '15', medium: '31', low: '40', lowest: '50' };
                    args.push('-crf', crfMap[settings.quality] || '31', '-b:v', '0');
                } else if (settings.codec === 'mpeg4') {
                    const qMap = { highest: '2', high: '3', medium: '5', low: '8', lowest: '12' };
                    args.push('-q:v', qMap[settings.quality] || '5');
                } else if (settings.codec === 'mpeg2video') {
                    const qMap = { highest: '2', high: '3', medium: '5', low: '8', lowest: '12' };
                    args.push('-q:v', qMap[settings.quality] || '5');
                }
            }

            // Encoding preset (H.264 / H.265)
            if (settings.preset && (settings.codec === 'libx264' || settings.codec === 'libx265')) {
                args.push('-preset', settings.preset);
            }
        }

        // Video bitrate (overrides CRF when set)
        if (settings.videoBitrate) {
            args.push('-b:v', settings.videoBitrate);
        }

        // Resolution
        if (settings.resolution) {
            args.push('-s', settings.resolution);
        }

        // Frame rate
        if (settings.framerate) {
            args.push('-r', settings.framerate);
        }

        // Aspect ratio
        if (settings.aspectRatio) {
            args.push('-aspect', settings.aspectRatio);
        }

        // Rotation / flip filters
        if (settings.rotation) {
            if (settings.rotation === '90') {
                videoFilters.push('transpose=1');
            } else if (settings.rotation === '180') {
                videoFilters.push('transpose=1,transpose=1');
            } else if (settings.rotation === '270') {
                videoFilters.push('transpose=2');
            } else if (settings.rotation === 'hflip') {
                videoFilters.push('hflip');
            } else if (settings.rotation === 'vflip') {
                videoFilters.push('vflip');
            }
        }

        // Speed adjustment (video)
        if (settings.speed) {
            const pts = 1 / parseFloat(settings.speed);
            videoFilters.push(`setpts=${pts.toFixed(4)}*PTS`);
        }
    } else {
        // Audio-only: no video stream
        args.push('-vn');
    }

    // Apply video filter chain
    if (videoFilters.length > 0) {
        args.push('-vf', videoFilters.join(','));
    }

    // --- Audio codec ---
    if (settings.audioCodec === 'none') {
        args.push('-an');
    } else if (settings.audioCodec === 'copy') {
        args.push('-c:a', 'copy');
    } else if (settings.codec === 'copy' && !settings.isAudioOnly) {
        // When video is copy, default audio to copy too unless user specified
        args.push('-c:a', 'copy');
    } else if (settings.audioCodec) {
        args.push('-c:a', settings.audioCodec);
    }

    // Audio bitrate
    if (settings.audioBitrate && settings.audioCodec !== 'none' && settings.audioCodec !== 'copy') {
        args.push('-b:a', settings.audioBitrate);
    }

    // Sample rate
    if (settings.sampleRate && settings.audioCodec !== 'none' && settings.audioCodec !== 'copy') {
        args.push('-ar', settings.sampleRate);
    }

    // Audio channels
    if (settings.audioChannels && settings.audioCodec !== 'none' && settings.audioCodec !== 'copy') {
        args.push('-ac', settings.audioChannels);
    }

    // Speed adjustment (audio) — must match video speed
    if (settings.speed && settings.audioCodec !== 'none' && settings.audioCodec !== 'copy') {
        const atempo = parseFloat(settings.speed);
        // atempo filter only supports 0.5-100, chain for extreme values
        const atempoFilters = buildAtempoChain(atempo);
        if (atempoFilters) {
            args.push('-af', atempoFilters);
        }
    }

    // Custom FFmpeg arguments
    if (settings.customArgs) {
        const customParts = settings.customArgs.split(/\s+/).filter((s) => s.length > 0);
        args.push(...customParts);
    }

    args.push(outputName);

    return args;
}

// atempo filter supports 0.5 to 100.0; chain multiple for values outside range
function buildAtempoChain(speed) {
    if (speed === 1) return null;
    const filters = [];
    let remaining = speed;
    if (remaining < 0.5) {
        while (remaining < 0.5) {
            filters.push('atempo=0.5');
            remaining /= 0.5;
        }
        filters.push(`atempo=${remaining.toFixed(4)}`);
    } else if (remaining > 100) {
        while (remaining > 100) {
            filters.push('atempo=100.0');
            remaining /= 100;
        }
        filters.push(`atempo=${remaining.toFixed(4)}`);
    } else {
        filters.push(`atempo=${remaining.toFixed(4)}`);
    }
    return filters.join(',');
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

    results.forEach((result) => {
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
