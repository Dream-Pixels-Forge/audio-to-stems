import gc
import shutil
import zipfile
from werkzeug.utils import secure_filename
from flask import Flask, render_template, request, jsonify, send_file, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import uuid
import threading
import time
import torch
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.audio import save_audio

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = 'audio_separator_pro_2024'
CORS(app, resources={r"/*": {"origins": "*"}})
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'outputs'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Configure SocketIO with proper settings
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',
    ping_timeout=60,
    ping_interval=25,
    logger=True,
    engineio_logger=True
)

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# Global variables for processing
processing_jobs = {}
models_cache = {}


class AudioProcessor:
    def __init__(self, job_id):
        self.job_id = job_id
        self.stop_flag = False

    def process_files(self, files, settings):
        try:
            total_files = len(files)

            # Ensure CUDA is available and properly configured
            if torch.cuda.is_available():
                device = 'cuda'
                torch.cuda.empty_cache()  # Clear GPU memory
                print(f"Using GPU: {torch.cuda.get_device_name(0)}")
            else:
                device = 'cpu'
                print("CUDA not available, using CPU")

            # Load model with proper device handling
            model_name = settings.get('model', 'htdemucs')
            if model_name not in models_cache:
                print(f"Loading model: {model_name}")
                models_cache[model_name] = get_model(model_name)

            model = models_cache[model_name]
            model = model.to(device)
            model.eval()

            # Emit device info with room specification
            socketio.emit('processing_update', {
                'job_id': self.job_id,
                'status': f'Using device: {device.upper()}',
                'device': device
            }, room=self.job_id)

            results = []
            start_time = time.time()

            for i, file_path in enumerate(files):
                if self.stop_flag:
                    break

                filename = os.path.basename(file_path)
                socketio.emit('processing_update', {
                    'job_id': self.job_id,
                    'overall_progress': (i / total_files) * 100,
                    'current_file': filename,
                    'file_progress': 0,
                    'status': f'Processing {i+1}/{total_files}: {filename}'
                }, room=self.job_id)

                # Process single file
                result = self._process_single_file(
                    file_path, model, settings, device)
                if result:
                    results.append(result)

                # Clear GPU memory after each file
                if device == 'cuda':
                    torch.cuda.empty_cache()
                    gc.collect()

                # Update progress
                socketio.emit('processing_update', {
                    'job_id': self.job_id,
                    'overall_progress': ((i + 1) / total_files) * 100,
                    'file_progress': 100
                }, room=self.job_id)

            # Create download package
            if results and not self.stop_flag:
                zip_path = self._create_download_package(results)
                total_time = time.time() - start_time

                socketio.emit('processing_complete', {
                    'job_id': self.job_id,
                    'download_url': f'/download/{os.path.basename(zip_path)}',
                    'results': results,
                    'total_time': f"{int(total_time//60):02d}:{int(total_time%60):02d}",
                    'total_files': len(results)
                }, room=self.job_id)

            # Final cleanup
            if device == 'cuda':
                torch.cuda.empty_cache()
            gc.collect()

        except Exception as e:
            print(f"Processing error: {str(e)}")
            socketio.emit('processing_error', {
                'job_id': self.job_id,
                'error': str(e)
            }, room=self.job_id)
        finally:
            # Cleanup
            if self.job_id in processing_jobs:
                del processing_jobs[self.job_id]

    def _process_single_file(self, file_path, model, settings, device):
        try:
            # Load audio
            waveform, sample_rate = torchaudio.load(file_path)

            # Preprocess
            if len(waveform.shape) == 1:
                waveform = waveform.unsqueeze(0)
            elif len(waveform.shape) == 2 and waveform.shape[0] > 2:
                waveform = waveform.T

            if waveform.shape[0] == 1:
                waveform = torch.cat([waveform, waveform], dim=0)

            # Resample if needed
            if sample_rate != model.samplerate:
                resampler = torchaudio.transforms.Resample(
                    orig_freq=sample_rate,
                    new_freq=model.samplerate
                )
                waveform = resampler(waveform)

            socketio.emit('processing_update', {
                'job_id': self.job_id,
                'file_progress': 30,
                'status': 'Separating stems...'
            }, room=self.job_id)

            # Separate stems with proper GPU handling
            with torch.no_grad():
                waveform = waveform.to(torch.float32).to(device)
                if len(waveform.shape) == 2:
                    waveform = waveform.unsqueeze(0)

                # Use GPU-optimized processing
                if device == 'cuda':
                    with torch.cuda.amp.autocast():
                        stems = apply_model(
                            model, waveform, device=device, progress=True)
                else:
                    stems = apply_model(
                        model, waveform, device=device, progress=True)

            socketio.emit('processing_update', {
                'job_id': self.job_id,
                'file_progress': 80,
                'status': 'Saving stems...'
            }, room=self.job_id)

            # Save stems
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            output_dir = os.path.join(
                app.config['OUTPUT_FOLDER'], self.job_id, base_name)
            os.makedirs(output_dir, exist_ok=True)

            stem_files = []
            for i, source in enumerate(model.sources):
                stem_path = os.path.join(
                    output_dir, f"{base_name}_{source}.wav")
                stem_audio = stems[0, i].cpu()

                # Apply volume boost if specified
                volume_boost = settings.get('volume_boost', 1.0)
                if volume_boost != 1.0:
                    stem_audio = stem_audio * volume_boost

                save_audio(stem_audio, stem_path, model.samplerate)
                stem_files.append({
                    'name': source,
                    'path': stem_path,
                    'size': os.path.getsize(stem_path)
                })

            return {
                'original_file': base_name,
                'stems': stem_files,
                'output_dir': output_dir
            }

        except Exception as e:
            print(f"Error processing {os.path.basename(file_path)}: {str(e)}")
            socketio.emit('processing_update', {
                'job_id': self.job_id,
                'status': f'Error processing {os.path.basename(file_path)}: {str(e)}'
            }, room=self.job_id)
            return None

    def _create_download_package(self, results):
        zip_path = os.path.join(
            app.config['OUTPUT_FOLDER'], f"{self.job_id}_stems.zip")

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for result in results:
                for stem in result['stems']:
                    arcname = f"{result['original_file']}/{os.path.basename(stem['path'])}"
                    zipf.write(stem['path'], arcname)

        return zip_path

    def stop(self):
        self.stop_flag = True


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/upload', methods=['POST'])
def upload_files():
    if 'files' not in request.files:
        return jsonify({'error': 'No files uploaded'}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({'error': 'No files selected'}), 400

    # Create job ID
    job_id = str(uuid.uuid4())
    session['job_id'] = job_id

    # Save uploaded files
    uploaded_files = []
    upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
    os.makedirs(upload_dir, exist_ok=True)

    for file in files:
        if file and file.filename:
            filename = secure_filename(file.filename)
            file_path = os.path.join(upload_dir, filename)
            file.save(file_path)
            uploaded_files.append(file_path)

    return jsonify({
        'job_id': job_id,
        'files_count': len(uploaded_files),
        'files': [os.path.basename(f) for f in uploaded_files]
    })


@app.route('/process', methods=['POST'])
def start_processing():
    data = request.get_json()
    job_id = data.get('job_id')
    settings = data.get('settings', {})

    if not job_id:
        return jsonify({'error': 'No job ID provided'}), 400

    # Get uploaded files
    upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
    if not os.path.exists(upload_dir):
        return jsonify({'error': 'Job not found'}), 404

    files = [os.path.join(upload_dir, f) for f in os.listdir(upload_dir)]

    # Start processing
    processor = AudioProcessor(job_id)
    processing_jobs[job_id] = processor

    thread = threading.Thread(
        target=processor.process_files, args=(files, settings))
    thread.daemon = True
    thread.start()

    return jsonify({'status': 'Processing started', 'job_id': job_id})


@app.route('/stop/<job_id>', methods=['POST'])
def stop_processing(job_id):
    if job_id in processing_jobs:
        processing_jobs[job_id].stop()
        return jsonify({'status': 'Processing stopped'})
    return jsonify({'error': 'Job not found'}), 404


@app.route('/download/<filename>')
def download_file(filename):
    file_path = os.path.join(app.config['OUTPUT_FOLDER'], filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return "File not found", 404


@app.route('/audio/<job_id>/<filename>')
def serve_audio(job_id, filename):
    """Serve audio files for playback"""
    # Try exact filename match first in output folder
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], job_id)
    for root, dirs, files in os.walk(output_path):
        for file in files:
            if file == filename and file.endswith(('.wav', '.mp3', '.flac')):
                file_path = os.path.join(root, file)
                return send_file(file_path, mimetype='audio/wav')

    # Try upload folder for original files
    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
    if os.path.exists(upload_path):
        for file in os.listdir(upload_path):
            if file == filename:
                file_path = os.path.join(upload_path, file)
                return send_file(file_path, mimetype='audio/wav')

    return "Audio file not found", 404


@app.route('/stems/<job_id>/<filename>')
def get_stems_list(job_id, filename):
    """Get list of available stems for a file"""
    try:
        base_filename = os.path.splitext(filename)[0]
        output_dir = os.path.join(
            app.config['OUTPUT_FOLDER'], job_id, base_filename)
        stems = []

        # Check if output directory exists
        if os.path.exists(output_dir):
            for file in os.listdir(output_dir):
                if file.endswith(('.wav', '.mp3', '.flac')):
                    stem_name = file.split('_')[-1].split('.')[0]
                    file_path = os.path.join(output_dir, file)
                    file_size = os.path.getsize(file_path)

                    stems.append({
                        'name': stem_name,
                        'filename': file,
                        'url': f'/audio/{job_id}/{file}',
                        'size': file_size
                    })

        # Also check for original file
        upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
        if os.path.exists(upload_dir):
            for file in os.listdir(upload_dir):
                if base_filename.lower() in file.lower():
                    file_path = os.path.join(upload_dir, file)
                    file_size = os.path.getsize(file_path)

                    stems.insert(0, {
                        'name': 'original',
                        'filename': file,
                        'url': f'/audio/{job_id}/{file}',
                        'size': file_size
                    })
                    break

        return jsonify({'stems': stems})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/device-status')
def get_device_status():
    """Get current device status"""
    cuda_available = torch.cuda.is_available()
    device_info = {
        'cuda_available': cuda_available,
        'device_count': torch.cuda.device_count() if cuda_available else 0,
        'current_device': torch.cuda.current_device() if cuda_available else None,
        'device_name': torch.cuda.get_device_name(0) if cuda_available else 'CPU'
    }
    return jsonify(device_info)


@socketio.on('ping')
def handle_ping():
    """Handle ping from client to keep connection alive"""
    emit('pong')




@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    emit('connected', {'status': 'Connected to server'})


@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')


@socketio.on('join_job')
def handle_join_job(data):
    job_id = data.get('job_id')
    if job_id:
        join_room(job_id)
        print(f'Client {request.sid} joined job room: {job_id}')
        emit('joined_job', {'job_id': job_id})


@app.route('/shutdown', methods=['POST'])
def shutdown_server():
    """Shutdown the server"""
    print("\n👋 Shutting down Audio Separator Pro...")
    os._exit(0)

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Run Audio Separator Web App')
    parser.add_argument('--production', action='store_true', help='Run in production mode')
    args = parser.parse_args()
    
    if args.production:
        # Production mode - use a production WSGI server
        from waitress import serve
        print("Starting production server with Waitress...")
        serve(socketio, host='0.0.0.0', port=5000)
    else:
        # Development mode - use Flask's development server
        print("Starting development server...")
        socketio.run(app, 
                   debug=True, 
                   host='0.0.0.0', 
                   port=5000,
                   allow_unsafe_werkzeug=True)
