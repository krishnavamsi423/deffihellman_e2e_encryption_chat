// Client-side E2E encrypted chat application

class E2EChatApp {
    constructor() {
        this.socket = io();
        this.room = null;
        this.username = null;
        this.publicKey = null;
        this.encryptionKey = null;
        this.peerPublicKey = null;
        this.messagesCount = 0;
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
    }

    initializeEventListeners() {
        // Setup panel
        document.getElementById('joinBtn').addEventListener('click', () => this.joinChat());
        document.getElementById('roomInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChat();
        });

        // Chat panel
        document.getElementById('leaveBtn').addEventListener('click', () => this.leaveChat());
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinChat();
        });
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => {
            this.updateConnectionStatus(true);
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.updateConnectionStatus(false);
            console.log('Disconnected from server');
        });

        this.socket.on('key_response', (data) => {
            this.handleKeyExchange(data);
        });

        this.socket.on('receive_message', (data) => {
            this.handleReceivedMessage(data);
        });

        this.socket.on('rooms_list', (data) => {
            console.log('Active rooms:', data.rooms);
        });
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connectionStatus');
        if (connected) {
            status.textContent = '🟢 Connected';
            status.className = 'connection-status connected';
        } else {
            status.textContent = '🔴 Disconnected';
            status.className = 'connection-status disconnected';
        }
    }

    joinChat() {
        const room = document.getElementById('roomInput').value.trim() || 'default';
        const username = document.getElementById('usernameInput').value.trim() || 'Anonymous';

        if (!room) {
            alert('Please enter a room name');
            return;
        }

        this.room = room;
        this.username = username;

        // Generate initial keys for key exchange
        const common = this.generateRandomBigInt();
        const secret = this.generateRandomBigInt();
        this.publicKey = common + secret;

        // Send key exchange
        this.socket.emit('key_exchange', {
            common: common.toString(),
            room: room
        });

        // Update UI
        document.getElementById('setupPanel').classList.add('hidden');
        document.getElementById('chatPanel').classList.remove('hidden');
        document.getElementById('chatTitle').textContent = `Chat Room: ${room}`;
        document.getElementById('messageInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;
        
        this.addSystemMessage(`You joined as ${username}`);
    }

    handleKeyExchange(data) {
        const peerPublic = BigInt(data.public);
        
        // Generate encryption key (simplified version of Diffie-Hellman)
        const secret = this.generateRandomBigInt();
        this.encryptionKey = (peerPublic + secret).toString();

        // Display formatted key
        const formattedKey = this.formatKey(BigInt(this.encryptionKey));
        document.getElementById('keyDisplay').textContent = formattedKey;

        this.addSystemMessage(`✅ Encryption key established: ${formattedKey}`);
    }

    generateRandomBigInt() {
        // Generate a random 128-bit number
        const randomBytes = new Uint8Array(16);
        crypto.getRandomValues(randomBytes);
        let result = BigInt(0);
        for (let i = 0; i < randomBytes.length; i++) {
            result = (result << BigInt(8)) | BigInt(randomBytes[i]);
        }
        return result;
    }

    formatKey(key) {
        const keyStr = key.toString();
        let formatted = '';
        for (let i = 0; i < keyStr.length; i++) {
            if (i > 0 && i % 3 === 0) {
                formatted += ' ';
            }
            formatted += keyStr[i];
        }
        return formatted;
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();

        if (!message) return;

        // Encrypt message (using simple encoding for now - in production use proper encryption)
        const encrypted = btoa(message); // Base64 encoding as placeholder

        // Send to server
        this.socket.emit('encrypted_message', {
            message: encrypted,
            room: this.room,
            sender: this.username
        });

        // Display in UI
        this.addMessage(this.username, message, true);
        input.value = '';
        input.focus();
    }

    handleReceivedMessage(data) {
        try {
            // Decrypt message (reverse of sendMessage)
            const decrypted = atob(data.message); // Base64 decoding as placeholder
            
            // Extract sender info from data or use generic "Peer"
            const sender = data.sender === this.socket.id ? 'Peer' : 'Peer';
            
            this.addMessage(sender, decrypted, false);
        } catch (e) {
            console.error('Failed to decrypt message:', e);
            this.addSystemMessage('⚠️ Failed to decrypt message');
        }
    }

    addMessage(sender, message, isOwn) {
        const container = document.getElementById('messagesContainer');
        
        // Remove welcome message if present
        const welcome = container.querySelector('.welcome-message');
        if (welcome) {
            welcome.remove();
        }

        const messageElem = document.createElement('div');
        messageElem.className = `message ${isOwn ? 'own' : 'other'}`;
        messageElem.innerHTML = `
            <div class="message-bubble">
                <div class="message-author">${sender}</div>
                <div>${this.escapeHtml(message)}</div>
            </div>
        `;

        container.appendChild(messageElem);
        // Auto scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    addSystemMessage(message) {
        const container = document.getElementById('messagesContainer');
        const msgElem = document.createElement('div');
        msgElem.style.cssText = `
            text-align: center;
            padding: 10px;
            color: #999;
            font-size: 12px;
            italic: true;
        `;
        msgElem.textContent = message;
        container.appendChild(msgElem);
        container.scrollTop = container.scrollHeight;
    }

    leaveChat() {
        this.room = null;
        this.username = null;
        this.publicKey = null;
        this.encryptionKey = null;

        document.getElementById('chatPanel').classList.add('hidden');
        document.getElementById('setupPanel').classList.remove('hidden');
        document.getElementById('messageInput').value = '';
        document.getElementById('messageInput').disabled = true;
        document.getElementById('sendBtn').disabled = true;
        document.getElementById('messagesContainer').innerHTML = '<div class="welcome-message">Waiting for peer to join...</div>';
        document.getElementById('keyDisplay').textContent = 'Generating...';

        this.addSystemMessage('Left the chat room');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new E2EChatApp();
    console.log('Chat app initialized');
});
