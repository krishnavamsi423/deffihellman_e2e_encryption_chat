import os
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from cryptography.fernet import Fernet
from base64 import urlsafe_b64encode
from util import generate_key, format_key

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active sessions with their encryption keys
sessions = {}


@app.route('/')
def index():
    return render_template('index.html')


@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {id.__name__}')
    emit('connection_response', {'data': 'Connected to server'})


@socketio.on('disconnect')
def handle_disconnect():
    room = None
    for r, clients in sessions.items():
        if request.sid in clients:
            room = r
            break
    
    if room:
        leave_room(room)
        del sessions[room]
    print(f'Client disconnected')


@socketio.on('key_exchange')
def handle_key_exchange(data):
    """Handle initial key exchange for E2E encryption"""
    common = int(data['common'])
    secret = generate_key()
    public = common + secret
    
    room = data.get('room', 'chat')
    
    if room not in sessions:
        sessions[room] = {}
    
    sessions[room][request.sid] = {'secret': secret, 'public': public}
    
    join_room(room)
    
    # Broadcast to other clients in the room
    emit('key_response', {
        'public': str(public),
        'format_key': format_key(public)
    }, room=room)


@socketio.on('encrypted_message')
def handle_message(data):
    """Relay encrypted messages between clients"""
    room = data.get('room', 'chat')
    message = data['message']
    
    # Broadcast to all clients in the room
    emit('receive_message', {
        'message': message,
        'sender': request.sid
    }, room=room, include_self=False)


@socketio.on('get_rooms')
def handle_get_rooms():
    """Get list of active chat rooms"""
    emit('rooms_list', {'rooms': list(sessions.keys())})


if __name__ == '__main__':
    print('Starting WebSocket server on http://0.0.0.0:8080')
    print('Access from: http://localhost:8080 or http://<your-ip>:8080')
    socketio.run(app, host='0.0.0.0', port=8080, debug=False, allow_unsafe_werkzeug=True)
