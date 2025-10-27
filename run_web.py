#!/usr/bin/env python3
"""
Audio Separator Pro - Web Edition
Launch script for the web application
"""

import os
import sys
import webbrowser
import time
import threading
import torch
from web_app import app, socketio

# Set environment variables for better performance
os.environ['CUDA_LAUNCH_BLOCKING'] = '0'
os.environ['TORCH_USE_CUDA_DSA'] = '1' if 'cuda' in str(
    torch.cuda.is_available()).lower() else '0'

try:
    import torch
    if torch.cuda.is_available():
        print(f"🚀 GPU Detected: {torch.cuda.get_device_name(0)}")
        print(
            f"💾 GPU Memory: {torch.cuda.get_device_properties(0).total_memory // 1024**3}GB")
    else:
        print("💻 Using CPU processing")
except ImportError:
    print("⚠️ PyTorch not found")


def open_browser():
    """Open browser after a short delay"""
    time.sleep(2)
    webbrowser.open('http://localhost:5000')


def main():
    """Main function to run the web application"""
    print("🎵 Audio Separator Pro - Web Edition")
    print("=" * 50)
    print("🚀 Starting web server...")

    # Check if running in production
    is_production = os.environ.get('FLASK_ENV') == 'production'
    port = int(os.environ.get('PORT', 5000))
    host = '0.0.0.0' if is_production else '127.0.0.1'

    if not is_production:
        print("📱 Web interface will open automatically")
        print(f"🌐 Access at: http://localhost:{port}")
        # Open browser in a separate thread for local development
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()
    else:
        print(f"🌐 Production server running on port {port}")

    print("⏹️  Press Ctrl+C to stop")
    print("=" * 50)

    try:
        # Run the Flask-SocketIO app
        socketio.run(
            app,
            debug=not is_production,
            host=host,
            port=port,
            use_reloader=False,
            log_output=True
        )
    except KeyboardInterrupt:
        print("\n👋 Shutting down Audio Separator Pro...")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
