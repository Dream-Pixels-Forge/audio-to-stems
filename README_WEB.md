# 🎵 Audio Separator Pro - Web Edition

A professional web-based AI-powered audio stem separation application built with Flask, HTML5, CSS3, and JavaScript.

## ✨ Features

### 🎯 **Core Functionality**
- **AI-Powered Separation**: Multiple Demucs models (HTDemucs, HTDemucs-FT, HTDemucs-6S, HDemucs-MMI)
- **Batch Processing**: Upload and process multiple files simultaneously
- **Real-time Progress**: Live updates via WebSocket connections
- **Multiple Formats**: Support for WAV, MP3, FLAC, OGG, M4A, AAC
- **Quality Control**: Adjustable bitrate and volume boost settings

### 🎨 **Modern Web Interface**
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Drag & Drop**: Intuitive file upload with drag and drop support
- **Dark Theme**: Professional dark UI with smooth animations
- **Real-time Updates**: Live progress bars and status updates
- **Interactive Controls**: Modern sliders, checkboxes, and buttons

### 🚀 **Advanced Features**
- **CUDA Acceleration**: Automatic GPU detection and utilization
- **Noise Reduction**: Optional noise reduction preprocessing
- **Visualizations**: Audio waveform and analysis charts
- **Download Management**: Automatic ZIP packaging of results
- **Model Information**: Detailed model comparison and recommendations

### 🔧 **Technical Features**
- **WebSocket Communication**: Real-time bidirectional communication
- **Background Processing**: Non-blocking audio processing
- **Memory Management**: Efficient handling of large audio files
- **Error Handling**: Comprehensive error reporting and recovery
- **Session Management**: Job tracking and result persistence

## 🛠️ Installation

### Prerequisites
- Python 3.8 or higher
- CUDA-compatible GPU (optional, for acceleration)

### Quick Setup
```bash
# Clone or download the project
cd AudioSeparator

# Install dependencies
pip install -r requirements_web.txt

# Run the application
python run_web.py
```

### Manual Installation
```bash
# Install core dependencies
pip install flask flask-socketio torch torchaudio demucs librosa matplotlib soundfile noisereduce

# For CUDA support (optional)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
```

## 🚀 Usage

### Starting the Application
```bash
python run_web.py
```

The web interface will automatically open at `http://localhost:5000`

### Using the Web Interface

1. **Upload Files**
   - Drag and drop audio files onto the upload area
   - Or click to browse and select files
   - Supports: WAV, MP3, FLAC, OGG, M4A, AAC

2. **Configure Settings**
   - Choose AI model (HTDemucs recommended)
   - Select output format and quality
   - Adjust volume boost if needed
   - Enable noise reduction (optional)

3. **Start Processing**
   - Click "Start Processing"
   - Monitor real-time progress
   - Stop anytime if needed

4. **Download Results**
   - Download ZIP file with all separated stems
   - View audio visualizations
   - Each file separated into individual stems

### Model Selection Guide

| Model | Quality | Speed | Best For |
|-------|---------|-------|----------|
| **HTDemucs** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | General use, high quality |
| **HTDemucs-FT** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Modern music, vocals |
| **HTDemucs-6S** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Complex music, 6 stems |
| **HDemucs-MMI** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Fast processing |

## 📁 Project Structure

```
AudioSeparator/
├── web_app.py              # Flask backend application
├── run_web.py              # Launch script
├── requirements_web.txt    # Python dependencies
├── templates/
│   └── index.html         # Main web interface
├── static/
│   ├── css/
│   │   └── style.css      # Modern CSS styling
│   └── js/
│       └── app.js         # JavaScript application
├── uploads/               # Temporary upload storage
└── outputs/               # Processed audio output
```

## 🎛️ API Endpoints

### File Upload
```
POST /upload
- Uploads audio files for processing
- Returns job ID for tracking
```

### Start Processing
```
POST /process
- Starts audio separation process
- Accepts job ID and settings
```

### Stop Processing
```
POST /stop/<job_id>
- Stops ongoing processing
```

### Download Results
```
GET /download/<filename>
- Downloads processed audio ZIP
```

### Visualizations
```
GET /visualize/<job_id>/<filename>
- Returns audio visualization data
```

## 🔌 WebSocket Events

### Client → Server
- `connect`: Establish connection
- `disconnect`: Close connection

### Server → Client
- `processing_update`: Progress updates
- `processing_complete`: Job finished
- `processing_error`: Error occurred

## 🎨 Customization

### Styling
Edit `static/css/style.css` to customize:
- Color scheme (CSS variables)
- Layout and spacing
- Animations and transitions
- Responsive breakpoints

### Functionality
Modify `static/js/app.js` to add:
- New features
- Custom visualizations
- Additional file formats
- Enhanced UI interactions

### Backend
Extend `web_app.py` for:
- New processing options
- Additional AI models
- Custom audio effects
- Database integration

## 🔧 Configuration

### Environment Variables
```bash
export FLASK_ENV=production          # Production mode
export CUDA_VISIBLE_DEVICES=0       # GPU selection
export MAX_UPLOAD_SIZE=500MB         # File size limit
```

### Model Cache
Models are automatically downloaded and cached on first use:
- Location: `~/.cache/torch/hub/checkpoints/`
- Size: ~319MB per model
- Automatic updates available

## 🚀 Deployment

### Local Network Access
```bash
# Allow access from other devices on network
python -c "
from web_app import app, socketio
socketio.run(app, host='0.0.0.0', port=5000)
"
```

### Production Deployment
```bash
# Using Gunicorn + eventlet
pip install gunicorn eventlet
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 web_app:app
```

### Docker Deployment
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements_web.txt .
RUN pip install -r requirements_web.txt
COPY . .
EXPOSE 5000
CMD ["python", "run_web.py"]
```

## 🔍 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process using port 5000
lsof -ti:5000 | xargs kill -9
```

**CUDA Out of Memory**
- Reduce batch size
- Use CPU processing
- Close other GPU applications

**Upload Fails**
- Check file format support
- Verify file size limits
- Ensure stable internet connection

**Processing Stuck**
- Refresh browser page
- Restart application
- Check system resources

### Performance Tips

1. **GPU Acceleration**: Ensure CUDA is properly installed
2. **Memory Management**: Close unnecessary applications
3. **File Size**: Smaller files process faster
4. **Model Selection**: Use HDemucs-MMI for speed
5. **Batch Size**: Process fewer files simultaneously

## 📊 Performance Benchmarks

| File Size | Model | GPU | Processing Time |
|-----------|-------|-----|----------------|
| 3 min song | HTDemucs | RTX 3080 | ~30 seconds |
| 3 min song | HTDemucs | CPU only | ~3 minutes |
| 5 min song | HTDemucs-6S | RTX 3080 | ~50 seconds |
| 10 files | HDemucs-MMI | RTX 3080 | ~2 minutes |

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Demucs**: Facebook Research for the AI models
- **Flask**: Web framework
- **Socket.IO**: Real-time communication
- **Font Awesome**: Icons
- **Modern CSS**: Responsive design patterns

## 📞 Support

- 🐛 **Bug Reports**: Open an issue on GitHub
- 💡 **Feature Requests**: Create a feature request
- 📧 **Email Support**: Available for enterprise users
- 📚 **Documentation**: Check the wiki for detailed guides

---

**🎵 Audio Separator Pro - Professional AI-powered audio separation in your browser!**