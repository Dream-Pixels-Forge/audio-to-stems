// Audio Separator Pro - JavaScript Application
class AudioSeparatorApp {
    constructor() {
        this.socket = io();
        this.currentJobId = null;
        this.uploadedFiles = [];
        this.isProcessing = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.detectDevice();
        this.updateModelInfo();
    }
    
    initializeElements() {
        // File upload elements
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.filesContainer = document.getElementById('filesContainer');
        this.clearFilesBtn = document.getElementById('clearFiles');
        
        // Settings elements
        this.modelSelect = document.getElementById('modelSelect');
        this.formatSelect = document.getElementById('formatSelect');
        this.qualitySelect = document.getElementById('qualitySelect');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.noiseReduction = document.getElementById('noiseReduction');
        
        // Control elements
        this.processBtn = document.getElementById('processBtn');
        this.stopBtn = document.getElementById('stopBtn');
        
        // Progress elements
        this.progressSection = document.getElementById('progressSection');
        this.statusText = document.getElementById('statusText');
        this.overallProgress = document.getElementById('overallProgress');
        this.overallText = document.getElementById('overallText');
        this.fileProgress = document.getElementById('fileProgress');
        this.fileText = document.getElementById('fileText');
        this.timeEstimate = document.getElementById('timeEstimate');
        
        // Results elements
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsInfo = document.getElementById('resultsInfo');
        this.downloadBtn = document.getElementById('downloadBtn');
        
        // Modal elements
        this.modelModal = document.getElementById('modelModal');
        this.closeModal = document.getElementById('closeModal');
        this.audioPlayerModal = document.getElementById('audioPlayerModal');
        this.closeAudioModal = document.getElementById('closeAudioModal');
        
        // Audio player elements
        this.audioElement = document.getElementById('audioElement');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.progressSlider = document.getElementById('progressSlider');
        this.volumeControl = document.getElementById('volumeControl');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        this.trackTitle = document.getElementById('trackTitle');
        this.trackArtist = document.getElementById('trackArtist');
        
        // Audio state
        this.currentPlaylist = [];
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        
        // Device status
        this.deviceStatus = document.getElementById('device-status');
        this.stopServerBtn = document.getElementById('stopServerBtn');
    }
    
    setupEventListeners() {
        // File upload events
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        
        // Add waveform animation on hover
        this.uploadArea.addEventListener('mouseenter', this.animateWaveform.bind(this));
        this.uploadArea.addEventListener('mouseleave', this.stopWaveformAnimation.bind(this));
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.clearFilesBtn.addEventListener('click', this.clearFiles.bind(this));
        
        // Settings events
        this.modelSelect.addEventListener('change', () => this.updateModelInfo());
        this.volumeSlider.addEventListener('input', this.updateVolumeValue.bind(this));
        
        // Control events
        this.processBtn.addEventListener('click', this.startProcessing.bind(this));
        this.stopBtn.addEventListener('click', this.stopProcessing.bind(this));
        
        // Results events
        this.downloadBtn.addEventListener('click', this.downloadResults.bind(this));
        document.getElementById('newProcessBtn').addEventListener('click', () => {
            this.resultsSection.style.display = 'none';
            this.clearFiles();
        });
        
        // Server control
        this.stopServerBtn.addEventListener('click', this.stopServer.bind(this));
        
        // Modal events
        this.closeModal.addEventListener('click', () => this.modelModal.style.display = 'none');
        this.closeAudioModal.addEventListener('click', () => this.closeAudioPlayer());
        
        // Audio player events
        this.playPauseBtn.addEventListener('click', this.togglePlayPause.bind(this));
        this.prevBtn.addEventListener('click', this.previousTrack.bind(this));
        this.nextBtn.addEventListener('click', this.nextTrack.bind(this));
        document.getElementById('stopPlayerBtn').addEventListener('click', this.stopAudio.bind(this));
        document.getElementById('closePlayerBtn').addEventListener('click', this.closeAudioPlayer.bind(this));
        this.progressSlider.addEventListener('input', this.seekAudio.bind(this));
        this.volumeControl.addEventListener('input', this.updateVolume.bind(this));
        
        this.audioElement.addEventListener('loadedmetadata', this.updateAudioInfo.bind(this));
        this.audioElement.addEventListener('timeupdate', this.updateAudioProgress.bind(this));
        this.audioElement.addEventListener('ended', this.nextTrack.bind(this));
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.modelModal) this.modelModal.style.display = 'none';
            if (e.target === this.audioPlayerModal) this.closeAudioPlayer();
        });
    }
    
    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.showNotification('Connected to server', 'success');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.showNotification('Connection lost. Reconnecting...', 'warning');
        });
        
        this.socket.on('connected', (data) => {
            console.log('Server confirmed connection:', data);
        });
        
        this.socket.on('joined_job', (data) => {
            console.log('Joined job room:', data.job_id);
        });
        
        this.socket.on('processing_update', (data) => {
            if (data.job_id === this.currentJobId) {
                this.updateProgress(data);
            }
        });
        
        this.socket.on('processing_complete', (data) => {
            if (data.job_id === this.currentJobId) {
                this.handleProcessingComplete(data);
            }
        });
        
        this.socket.on('processing_error', (data) => {
            if (data.job_id === this.currentJobId) {
                this.handleProcessingError(data);
            }
        });
        
        this.socket.on('reconnect', () => {
            console.log('Reconnected to server');
            this.showNotification('Reconnected to server', 'success');
            if (this.currentJobId) {
                this.socket.emit('join_job', { job_id: this.currentJobId });
            }
        });
    }
    
    async detectDevice() {
        try {
            // Check device status from backend
            const response = await fetch('/device-status');
            if (response.ok) {
                const data = await response.json();
                const deviceIcon = data.cuda_available ? '🚀' : '🖥️';
                const deviceName = data.cuda_available ? 'GPU Ready' : 'CPU Ready';
                this.deviceStatus.innerHTML = `${deviceIcon} ${deviceName}`;
                this.deviceStatus.style.color = 'var(--success-color)';
            } else {
                throw new Error('Failed to detect device');
            }
        } catch (error) {
            this.deviceStatus.innerHTML = '⚠️ Device Error';
            this.deviceStatus.style.color = 'var(--danger-color)';
        }
    }
    
    animateWaveform() {
        const waveformBars = document.querySelectorAll('.waveform-bar');
        waveformBars.forEach((bar, index) => {
            bar.style.animationDelay = `${index * 0.1}s`;
            bar.classList.add('waveform-animation');
        });
    }
    
    stopWaveformAnimation() {
        const waveformBars = document.querySelectorAll('.waveform-bar');
        waveformBars.forEach(bar => {
            bar.classList.remove('waveform-animation');
        });
    }
    
    updateModelInfo() {
        const modelInfo = this.getModelInfo(this.modelSelect.value);
        const infoElement = document.getElementById('modelInfo');
        
        if (infoElement) {
            infoElement.innerHTML = `
                <span class="quality">Quality: ${modelInfo.quality}</span>
                <span class="speed">Speed: ${modelInfo.speed}</span>
            `;
        }
    }
    
    getModelInfo(modelName) {
        const models = {
            'htdemucs': {
                name: 'Hybrid Transformer Demucs',
                quality: '⭐⭐⭐⭐⭐',
                speed: '⭐⭐⭐⭐⭐',
                description: 'Best overall quality with balanced performance.',
                stems: ['vocals', 'drums', 'bass', 'other']
            },
            'htdemucs_ft': {
                name: 'Hybrid Transformer Demucs Fine-Tuned',
                quality: '⭐⭐⭐⭐⭐',
                speed: '⭐⭐⭐⭐⭐',
                description: 'Fine-tuned for modern music with enhanced vocal separation.',
                stems: ['vocals', 'drums', 'bass', 'other']
            },
            'htdemucs_6s': {
                name: 'Hybrid Transformer Demucs 6-Source',
                quality: '⭐⭐⭐⭐⭐',
                speed: '⭐⭐⭐⭐⭐',
                description: 'Separates into 6 stems including piano and guitar.',
                stems: ['vocals', 'drums', 'bass', 'piano', 'guitar', 'other']
            },
            'hdemucs_mmi': {
                name: 'Hybrid Demucs MMI',
                quality: '⭐⭐⭐⭐⭐',
                speed: '⭐⭐⭐⭐⭐',
                description: 'Faster processing with good quality.',
                stems: ['vocals', 'drums', 'bass', 'other']
            }
        };
        
        return models[modelName] || models['htdemucs'];
    }
    
    updateVolumeValue() {
        this.volumeValue.textContent = `${parseFloat(this.volumeSlider.value).toFixed(1)}x`;
    }
    
    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
        this.animateWaveform();
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        this.stopWaveformAnimation();
    }
    
    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        this.stopWaveformAnimation();
        const files = Array.from(e.dataTransfer.files);
        this.addFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
    }
    
    addFiles(files) {
        const audioFiles = files.filter(file => {
            const validTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/flac', 'audio/ogg', 'audio/m4a', 'audio/aac'];
            return validTypes.some(type => file.type.includes(type.split('/')[1])) || 
                   ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac'].some(ext => file.name.toLowerCase().endsWith(ext));
        });
        
        if (audioFiles.length === 0) {
            this.showNotification('Please select valid audio files', 'error');
            return;
        }
        
        audioFiles.forEach(file => {
            if (!this.uploadedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.uploadedFiles.push(file);
            }
        });
        
        this.updateFileList();
        this.updateProcessButton();
    }
    
    updateFileList() {
        if (this.uploadedFiles.length === 0) {
            this.fileList.style.display = 'none';
            return;
        }
        
        this.fileList.style.display = 'block';
        this.filesContainer.innerHTML = '';
        
        this.uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-info">
                    <i class="fas fa-music file-icon"></i>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="remove-file" onclick="app.removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            this.filesContainer.appendChild(fileItem);
        });
    }
    
    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        this.updateFileList();
        this.updateProcessButton();
    }
    
    clearFiles() {
        this.uploadedFiles = [];
        this.updateFileList();
        this.updateProcessButton();
    }
    
    updateProcessButton() {
        this.processBtn.disabled = this.uploadedFiles.length === 0 || this.isProcessing;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async startProcessing() {
        if (this.uploadedFiles.length === 0) {
            this.showNotification('Please select audio files first', 'error');
            return;
        }
        
        try {
            // Upload files
            const formData = new FormData();
            this.uploadedFiles.forEach(file => {
                formData.append('files', file);
            });
            
            this.showNotification('Uploading files...', 'info');
            
            const uploadResponse = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Upload failed');
            }
            
            const uploadData = await uploadResponse.json();
            this.currentJobId = uploadData.job_id;
            
            // Join the job room for real-time updates
            this.socket.emit('join_job', { job_id: this.currentJobId });
            
            // Start processing
            const settings = {
                model: this.modelSelect.value,
                format: this.formatSelect.value,
                quality: this.qualitySelect.value,
                volume_boost: parseFloat(this.volumeSlider.value),
                noise_reduction: this.noiseReduction.checked
            };
            
            const processResponse = await fetch('/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    job_id: this.currentJobId,
                    settings: settings
                })
            });
            
            if (!processResponse.ok) {
                throw new Error('Processing failed to start');
            }
            
            this.isProcessing = true;
            this.processBtn.style.display = 'none';
            this.stopBtn.style.display = 'inline-flex';
            this.progressSection.style.display = 'block';
            this.resultsSection.style.display = 'none';
            
            this.showNotification('Processing started...', 'success');
            
            // Keep connection alive during processing
            this.keepAliveInterval = setInterval(() => {
                if (this.socket.connected) {
                    this.socket.emit('ping');
                }
            }, 30000); // Ping every 30 seconds
            
        } catch (error) {
            this.showNotification(`Error: ${error.message}`, 'error');
        }
    }
    
    async stopProcessing() {
        if (!this.currentJobId) return;
        
        try {
            await fetch(`/stop/${this.currentJobId}`, { method: 'POST' });
            this.handleProcessingStop();
        } catch (error) {
            this.showNotification(`Error stopping: ${error.message}`, 'error');
        }
    }
    
    updateProgress(data) {
        // Handle processing progress updates
        if (typeof data === 'object' && data.job_id) {
            if (data.status) {
                this.statusText.textContent = data.status;
            }
            
            if (data.device) {
                const deviceIcon = data.device === 'cuda' ? '🚀' : '🖥️';
                const deviceName = data.device === 'cuda' ? 'GPU' : 'CPU';
                this.deviceStatus.innerHTML = `${deviceIcon} ${deviceName} Active`;
                this.deviceStatus.style.color = 'var(--success-color)';
            }
            
            if (data.overall_progress !== undefined) {
                this.overallProgress.style.width = `${data.overall_progress}%`;
                this.overallText.textContent = `${Math.round(data.overall_progress)}%`;
            }
            
            if (data.file_progress !== undefined) {
                this.fileProgress.style.width = `${data.file_progress}%`;
                this.fileText.textContent = `${Math.round(data.file_progress)}%`;
            }
            
            if (data.current_file) {
                this.statusText.textContent = `Processing: ${data.current_file}`;
            }
        }
    }
    
    updateAudioProgress() {
        // Handle audio player progress updates
        if (this.audioElement.duration) {
            const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
            this.progressSlider.value = progress;
            this.currentTime.textContent = this.formatTime(this.audioElement.currentTime);
            
            // Update stem progress
            this.updateStemProgress(this.currentTrackIndex, progress);
        }
    }
    
    handleProcessingComplete(data) {
        this.isProcessing = false;
        this.processBtn.style.display = 'inline-flex';
        this.stopBtn.style.display = 'none';
        this.progressSection.style.display = 'none';
        this.resultsSection.style.display = 'block';
        
        // Clear keep-alive interval
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
        
        this.resultsInfo.innerHTML = `
            <div style="text-align: center; padding: 20px; background: var(--bg-tertiary); border-radius: var(--border-radius); border: 1px solid var(--success-color);">
                <i class="fas fa-check-circle" style="font-size: 48px; color: var(--success-color); margin-bottom: 16px;"></i>
                <h4 style="color: var(--text-primary); margin-bottom: 8px;">Processing Complete!</h4>
                <p style="color: var(--text-muted); margin-bottom: 4px;">Processed ${data.total_files} files in ${data.total_time}</p>
                <p style="color: var(--text-muted);">Your separated stems are ready for download.</p>
            </div>
        `;
        
        this.downloadBtn.onclick = () => {
            window.open(data.download_url, '_blank');
        };
        
        this.updateProcessButton();
        this.showNotification('Processing completed successfully!', 'success');
        
        // Load stems for playback with delay to ensure DOM is ready
        setTimeout(() => {
            this.loadStemsForPlayback();
        }, 500);
    }
    
    handleProcessingError(data) {
        this.handleProcessingStop();
        this.showNotification(`Processing error: ${data.error}`, 'error');
    }
    
    handleProcessingStop() {
        this.isProcessing = false;
        this.processBtn.style.display = 'inline-flex';
        this.stopBtn.style.display = 'none';
        this.updateProcessButton();
        
        // Clear keep-alive interval
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }
    
    downloadResults() {
        // This will be handled by the onclick event set in handleProcessingComplete
    }
    
    showVisualizations() {
        this.visualizationModal.style.display = 'block';
        this.loadVisualization('waveforms');
    }
    
    async loadVisualization(type) {
        if (!this.currentJobId) {
            this.showVisualizationError('No processing job available');
            return;
        }
        
        const content = document.getElementById('visualizationContent');
        if (!content) {
            console.error('Visualization content element not found');
            return;
        }
        
        content.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Generating ${type} visualization...</p>
                <div class="loading-dots">
                    <span>.</span><span>.</span><span>.</span>
                </div>
            </div>
        `;
        
        try {
            // Get the first processed file name for visualization
            const firstFile = this.uploadedFiles.length > 0 ? 
                this.uploadedFiles[0].name : 'audio';
            
            console.log(`Requesting visualization: /visualize/${this.currentJobId}/${firstFile}/${type}`);
            const response = await fetch(`/visualize/${this.currentJobId}/${firstFile}/${type}`);
            
            if (!response.ok) {
                throw new Error(`Failed to generate ${type} visualization (${response.status})`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Display the visualization
            content.innerHTML = `
                <div class="visualization-display">
                    <img src="${data.image}" alt="${type} visualization" 
                         style="max-width: 100%; height: auto; border-radius: var(--border-radius); 
                                box-shadow: var(--box-shadow); background: var(--bg-secondary);" />
                    <div class="visualization-info" style="margin-top: 16px; text-align: center; color: var(--text-muted); font-size: 12px;">
                        <i class="fas fa-info-circle"></i> 
                        ${this.getVisualizationDescription(type)}
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Visualization error:', error);
            this.showVisualizationError(error.message);
        }
    }
    
    showVisualizationError(message) {
        const content = document.getElementById('visualizationContent');
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                <h3>Visualization Error</h3>
                <p>${message}</p>
                <button class="btn btn-secondary" onclick="app.loadVisualization('waveforms')" style="margin-top: 16px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
    
    getVisualizationDescription(type) {
        const descriptions = {
            'waveforms': 'Shows amplitude over time for each separated stem',
            'spectrograms': 'Displays frequency content over time using color intensity',
            'analysis': 'Compares frequency, energy, brightness, and percussiveness metrics'
        };
        return descriptions[type] || 'Audio visualization';
    }
    
    async loadStemsForPlayback() {
        if (!this.currentJobId || this.uploadedFiles.length === 0) return;
        
        try {
            const firstFile = this.uploadedFiles[0].name.split('.')[0];
            const response = await fetch(`/stems/${this.currentJobId}/${firstFile}`);
            
            if (!response.ok) {
                console.error('Failed to load stems:', response.status);
                return;
            }
            
            const data = await response.json();
            if (data.stems && data.stems.length > 0) {
                this.displayStemsPlayer(data.stems);
                this.currentPlaylist = data.stems;
                
                // Show playback section
                const playbackSection = document.getElementById('playbackSection');
                if (playbackSection) {
                    playbackSection.style.display = 'block';
                }
            }
            
        } catch (error) {
            console.error('Error loading stems:', error);
        }
    }
    
    displayStemsPlayer(stems) {
        const stemsPlayer = document.getElementById('stemsPlayer');
        stemsPlayer.innerHTML = '';
        
        stems.forEach((stem, index) => {
            const stemPlayer = document.createElement('div');
            stemPlayer.className = 'stem-player';
            stemPlayer.innerHTML = `
                <div class="stem-header">
                    <div class="stem-name">${stem.name}</div>
                    <div class="stem-size">${this.formatFileSize(stem.size)}</div>
                </div>
                <div class="stem-controls">
                    <button class="play-btn" onclick="app.playStem(${index})">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="stem-progress">
                        <div class="stem-progress-fill" id="progress-${index}"></div>
                    </div>
                    <div class="time-display" id="time-${index}">0:00</div>
                </div>
            `;
            stemsPlayer.appendChild(stemPlayer);
        });
    }
    
    playStem(index) {
        this.currentTrackIndex = index;
        this.loadTrack(index);
        this.audioPlayerModal.style.display = 'block';
        this.playAudio();
    }
    
    loadTrack(index) {
        if (index < 0 || index >= this.currentPlaylist.length) return;
        
        const track = this.currentPlaylist[index];
        this.audioElement.src = track.url;
        this.trackTitle.textContent = track.name.charAt(0).toUpperCase() + track.name.slice(1);
        this.trackArtist.textContent = `${track.filename} • ${this.formatFileSize(track.size)}`;
        this.currentTrackIndex = index;
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.pauseAudio();
        } else {
            this.playAudio();
        }
    }
    
    playAudio() {
        this.audioElement.play();
        this.isPlaying = true;
        this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        this.updateStemPlayButton(this.currentTrackIndex, true);
    }
    
    pauseAudio() {
        this.audioElement.pause();
        this.isPlaying = false;
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.updateStemPlayButton(this.currentTrackIndex, false);
    }
    
    stopAudio() {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.isPlaying = false;
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.progressSlider.value = 0;
        this.currentTime.textContent = '0:00';
        this.updateStemPlayButton(this.currentTrackIndex, false);
        this.updateStemProgress(this.currentTrackIndex, 0);
    }
    
    previousTrack() {
        const newIndex = this.currentTrackIndex > 0 ? this.currentTrackIndex - 1 : this.currentPlaylist.length - 1;
        this.loadTrack(newIndex);
        if (this.isPlaying) {
            this.playAudio();
        }
    }
    
    nextTrack() {
        const newIndex = this.currentTrackIndex < this.currentPlaylist.length - 1 ? this.currentTrackIndex + 1 : 0;
        this.loadTrack(newIndex);
        if (this.isPlaying) {
            this.playAudio();
        }
    }
    
    seekAudio() {
        const seekTime = (this.progressSlider.value / 100) * this.audioElement.duration;
        this.audioElement.currentTime = seekTime;
    }
    
    updateVolume() {
        this.audioElement.volume = this.volumeControl.value / 100;
    }
    
    updateAudioInfo() {
        this.totalTime.textContent = this.formatTime(this.audioElement.duration);
        this.progressSlider.max = 100;
    }
    
    updateProgress() {
        if (this.audioElement.duration) {
            const progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
            this.progressSlider.value = progress;
            this.currentTime.textContent = this.formatTime(this.audioElement.currentTime);
            
            // Update stem progress
            this.updateStemProgress(this.currentTrackIndex, progress);
        }
    }
    
    updateStemPlayButton(index, isPlaying) {
        const playBtns = document.querySelectorAll('.stem-player .play-btn');
        playBtns.forEach((btn, i) => {
            if (i === index) {
                btn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
                btn.classList.toggle('playing', isPlaying);
            } else {
                btn.innerHTML = '<i class="fas fa-play"></i>';
                btn.classList.remove('playing');
            }
        });
    }
    
    updateStemProgress(index, progress) {
        const progressFill = document.getElementById(`progress-${index}`);
        const timeDisplay = document.getElementById(`time-${index}`);
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (timeDisplay && this.audioElement.currentTime) {
            timeDisplay.textContent = this.formatTime(this.audioElement.currentTime);
        }
    }
    
    closeAudioPlayer() {
        this.pauseAudio();
        this.audioPlayerModal.style.display = 'none';
        this.updateStemPlayButton(this.currentTrackIndex, false);
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    showNotification(message, type = 'info') {
        // Create SoundCloud-style notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button onclick="this.parentNode.remove()" style="background: none; border: none; color: inherit; margin-left: 12px; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: this.getNotificationColor(type),
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            maxWidth: '400px',
            animation: 'slideInRight 0.3s ease',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            fontWeight: '500'
        });
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    getNotificationColor(type) {
        const colors = {
            success: '#4ecdc4',
            error: '#ff6b6b',
            warning: '#feca57',
            info: '#45b7d1'
        };
        return colors[type] || '#45b7d1';
    }
    
    async stopServer() {
        if (confirm('Are you sure you want to stop the server? This will close the application.')) {
            try {
                this.showNotification('Stopping server...', 'warning');
                await fetch('/shutdown', { method: 'POST' });
            } catch (error) {
                // Server stopped, so fetch will fail - this is expected
                this.showNotification('Server stopped successfully', 'success');
                setTimeout(() => {
                    window.close();
                }, 2000);
            }
        }
    }
}

// Add notification animations to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the application with better error handling
let app;
document.addEventListener('DOMContentLoaded', () => {
    try {
        app = new AudioSeparatorApp();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; color: #ff6b6b;">
                <h2>Application Error</h2>
                <p>Failed to initialize the application. Please refresh the page.</p>
                <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px;">Refresh Page</button>
            </div>
        `;
    }
});