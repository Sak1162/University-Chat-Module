/**
 * ITALK (BVDU) - Chat Application Logic
 * Focusing on University Structure: Final Messaging Refinement
 */

const API_BASE = "http://localhost:5000";

// --- Socket Service ---
class SocketService {
    constructor() {
        this.socket = null;
        this.callbacks = [];
    }

    connect(user, chats) {
        if (typeof io === 'undefined') return;
        this.socket = io(API_BASE);

        this.socket.on("connect", () => {
            console.log("Connected to ITALK Socket Server");
            // Join personal room
            this.socket.emit("join-room", `user_${user.id}`);
            // Join all joined classrooms
            chats.filter(c => c.type === 'group').forEach(c => {
                this.socket.emit("join-room", `class_${c.id}`);
            });
            // Join global
            this.socket.emit("join-room", "class_null"); // 0/null for global
        });

        this.socket.on("receive-message", (msg) => {
            this.callbacks.forEach(cb => cb(msg));
        });
    }

    send(eventName, data) { if (this.socket) this.socket.emit(eventName, data); }
    onMessage(callback) { this.callbacks.push(callback); }
}

// --- App Controller ---
class ITALKApp {
    constructor() {
        this.user = JSON.parse(localStorage.getItem('italk_user')) || null;
        this.socket = new SocketService();
        this.activeChatId = null;
        this.chats = [];
        this.messages = {};

        if (document.querySelector('.app-body')) {
            if (!this.user) window.location.href = 'index.html';
            this.initHome();
        } else {
            this.initAuth();
        }

        // Special handling for Join Class page 
        if (window.location.href.includes('join_class.html')) this.initJoinClass();
    }

    async initAuth() {
        // ... (Login/Signup handlers same as before, simplified below for space)
        const loginEl = document.getElementById('login-form-element');
        if (loginEl) {
            loginEl.onsubmit = async (e) => {
                e.preventDefault();
                const res = await fetch(`${API_BASE}/login`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prn: document.getElementById('login-prn').value, password: document.getElementById('login-password').value })
                });
                const data = await res.json();
                if (res.ok) { localStorage.setItem('italk_user', JSON.stringify(data.user)); window.location.href = 'home.html'; }
                else alert(data.message);
            };
        }
        const signupEl = document.getElementById('signup-form-element');
        if (signupEl) {
            signupEl.onsubmit = async (e) => {
                e.preventDefault();
                const res = await fetch(`${API_BASE}/signup`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        full_name: document.getElementById('signup-name').value,
                        prn: document.getElementById('signup-prn').value,
                        role: document.querySelector('input[name="role"]:checked').value,
                        password: document.getElementById('signup-password').value
                    })
                });
                if (res.ok) { alert("Success! Please login."); document.getElementById('to-login').click(); }
                else alert("Signup failed");
            };
        }

        // Toggling
        const toSignup = document.getElementById('to-signup');
        if (toSignup) toSignup.onclick = () => { document.getElementById('login-form').classList.remove('active'); document.getElementById('signup-form').classList.add('active'); };
        const toLogin = document.getElementById('to-login');
        if (toLogin) toLogin.onclick = () => { document.getElementById('signup-form').classList.remove('active'); document.getElementById('login-form').classList.add('active'); };
    }

    async initHome() {
        await this.loadChats();
        this.socket.connect(this.user, this.chats);
        this.socket.onMessage((msg) => this.handleIncomingMessage(msg));
        this.renderChatList();
        this.setupEventListeners();
        this.applyRoleUI();
    }

    async initJoinClass() {
        const joinBtn = document.getElementById('join-btn');
        if (!joinBtn) return;
        joinBtn.onclick = async () => {
            const code = document.getElementById('class-code').value.trim();
            const res = await fetch(`${API_BASE}/join-class`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: this.user.id, classCode: code })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                this.user.class_code = code;
                localStorage.setItem('italk_user', JSON.stringify(this.user));
                window.location.href = 'home.html';
            } else alert(data.message);
        };
    }

    async loadChats() {
        try {
            const res = await fetch(`${API_BASE}/chats/${this.user.id}`);
            this.chats = await res.json();
        } catch (e) { this.chats = []; }
    }

    handleIncomingMessage(msg) {
        const id = msg.classroom_id || msg.sender_id;
        if (!this.messages[id]) this.messages[id] = [];
        this.messages[id].push({
            id: msg.id, text: msg.message_text,
            type: msg.sender_id == this.user.id ? 'sent' : 'received',
            broadcast: msg.message_type === 'broadcast'
        });
        if (this.activeChatId == id) this.renderMessages();
        else {
            const chat = this.chats.find(c => (msg.classroom_id && c.id == msg.classroom_id) || (!msg.classroom_id && c.id == msg.sender_id));
            if (chat) { chat.unread = (chat.unread || 0) + 1; chat.lastMsg = msg.message_text; this.renderChatList(); }
        }
    }

    renderChatList(filter = '') {
        const listContainer = document.getElementById('chat-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        this.chats.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())).forEach(chat => {
            const item = document.createElement('div');
            item.className = `chat-item ${this.activeChatId === chat.id ? 'active' : ''}`;
            item.innerHTML = `
                <div class="chat-avatar ${this.activeChatId === chat.id ? 'avatar-highlight' : ''}"><div class="chat-avatar-placeholder"><i class="fas fa-${chat.icon || (chat.type === 'group' ? 'users' : 'user')}"></i></div></div>
                <div class="chat-meta"><h4>${chat.name}</h4><p>${chat.lastMsg || 'No messages yet'}</p></div>
                ${chat.unread > 0 ? `<span class="notification-badge" style="position:static; margin-left: 5px;">${chat.unread}</span>` : ''}
            `;
            item.onclick = () => this.selectChat(chat);
            listContainer.appendChild(item);
        });
    }

    async selectChat(chat) {
        this.activeChatId = chat.id;
        chat.unread = 0;
        document.querySelector('.empty-state').style.display = 'none';
        document.querySelector('.active-chat').style.display = 'flex';
        document.getElementById('active-chat-name').innerText = chat.name;

        if (!this.messages[chat.id]) {
            const res = await fetch(`${API_BASE}/messages/${chat.id}?userId=${this.user.id}&type=${chat.type}`);
            const data = await res.json();
            this.messages[chat.id] = data.map(m => ({
                id: m.id, text: m.message_text,
                type: m.sender_id == this.user.id ? 'sent' : 'received',
                broadcast: m.message_type === 'broadcast'
            }));
        }
        this.renderMessages();
        this.renderChatList();
    }

    renderMessages() {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        (this.messages[this.activeChatId] || []).forEach(m => {
            const div = document.createElement('div');
            div.className = `message ${m.type === 'sent' ? 'msg-sent' : 'msg-received'} ${m.broadcast ? 'msg-broadcast' : ''}`;
            div.innerText = m.text;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    }

    sendMessage(isBroadcast = false) {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if (!text) return;
        const chat = this.chats.find(c => c.id === this.activeChatId);
        const msgData = {
            sender_id: this.user.id,
            message_text: text,
            message_type: isBroadcast ? 'broadcast' : (chat.type === 'group' || chat.type === 'global' ? 'broadcast' : 'private'),
            classroom_id: (chat.type === 'group' || chat.type === 'global') ? (chat.id === 0 ? null : chat.id) : null,
            receiver_id: chat.type === 'group' || chat.type === 'global' ? null : chat.id
        };
        this.socket.send(isBroadcast ? "broadcast" : "send-message", msgData);
        input.value = '';
    }

    setupEventListeners() {
        const search = document.getElementById('chat-search');
        if (search) search.oninput = (e) => this.renderChatList(e.target.value);
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) sendBtn.onclick = () => this.sendMessage(false);
        const broadBtn = document.getElementById('broadcast-btn');
        if (broadBtn) broadBtn.onclick = () => this.sendMessage(true);
        const input = document.getElementById('msg-input');
        if (input) input.onkeypress = (e) => { if (e.key === 'Enter') this.sendMessage(false); };

        document.getElementById('join-class-btn').onclick = () => window.location.href = 'join_class.html';
        document.getElementById('univ-chat-btn').onclick = () => window.location.href = 'global_chat.html';
        document.getElementById('status-btn').onclick = () => window.location.href = 'status.html';

        const profileTrigger = document.getElementById('profile-trigger');
        if (profileTrigger) profileTrigger.onclick = () => document.getElementById('profile-modal').style.display = 'flex';
        const closeModal = document.querySelector('.close-modal');
        if (closeModal) closeModal.onclick = () => document.getElementById('profile-modal').style.display = 'none';

        const menuTrigger = document.getElementById('menu-trigger');
        if (menuTrigger) menuTrigger.onclick = () => document.getElementById('side-drawer').classList.add('open');
        const closeDrawer = document.getElementById('close-drawer');
        if (closeDrawer) closeDrawer.onclick = () => document.getElementById('side-drawer').classList.remove('open');
    }

    applyRoleUI() {
        if (this.user && this.user.role === 'professor') {
            document.body.classList.add('professor-mode');
            const input = document.getElementById('msg-input');
            if (input) input.placeholder = "Broadcast or type a message...";
        }
    }
}

const app = new ITALKApp();
