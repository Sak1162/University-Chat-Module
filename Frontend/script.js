/**
 * ITALK (BVDU) - Chat Application Logic
 * Academic & Placement Integration Phase
 */

const API_BASE = "https://university-chat-module.onrender.com";

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
            this.socket.emit("join-room", `user_${user.id}`);
            chats.forEach(c => {
                const room = c.type === 'group' || c.type === 'global' ? `class_${c.id === 0 ? 'null' : c.id}` : null;
                if (room) this.socket.emit("join-room", room);
            });
        });
        this.socket.on("receive-message", (msg) => this.callbacks.forEach(cb => cb(msg)));
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
        this.subjects = [];

        if (document.querySelector('.app-body')) {
            if (!this.user) window.location.href = 'index.html';
            this.initHome();
        } else {
            this.initAuth();
        }

        if (window.location.href.includes('join_class.html')) this.initJoinClass();
    }

    initAuth() {
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
        const toSignup = document.getElementById('to-signup');
        if (toSignup) toSignup.onclick = () => { document.getElementById('login-form').classList.remove('active'); document.getElementById('signup-form').classList.add('active'); };
        const toLogin = document.getElementById('to-login');
        if (toLogin) toLogin.onclick = () => { document.getElementById('signup-form').classList.remove('active'); document.getElementById('login-form').classList.add('active'); };
    }

    async initHome() {
        await this.loadChats();
        await this.loadAcademics();
        this.socket.connect(this.user, this.chats);
        this.socket.onMessage((msg) => this.handleIncomingMessage(msg));
        this.renderChatList();
        this.renderAcademicUI();
        this.setupEventListeners();
        this.applyRoleUI();
    }

    initJoinClass() {
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
            if (!this.chats || this.chats.length === 0) {
                this.chats = [{ id: 0, name: "Global Hub", type: "global", icon: "globe" }];
            }
        } catch (e) {
            console.error("Failed to load chats:", e);
            this.chats = [{ id: 0, name: "Global Hub", type: "global", icon: "globe" }];
        }
    }

    async loadAcademics() {
        try {
            const endpoint = this.user.role === 'professor' ? `/professor/classes/${this.user.id}` : `/subjects/${this.user.id}`;
            const res = await fetch(`${API_BASE}${endpoint}`);
            const data = await res.json();
            if (this.user.role === 'professor') this.managedClasses = data;
            else this.subjects = data;
        } catch (e) { console.error("Academic load error", e); }
    }

    renderAcademicUI() {
        const container = document.getElementById('drawer-class-list');
        if (!container) return;
        container.innerHTML = '';

        if (this.user.role === 'professor') {
            const title = document.createElement('h3');
            title.innerText = "Managed Classes & Subjects";
            title.style.margin = "1rem 0";
            container.appendChild(title);
            (this.managedClasses || []).forEach(cls => {
                const item = document.createElement('div');
                item.className = 'drawer-class-item';
                item.innerHTML = `<h4>${cls.name}</h4><p>Code: ${cls.code}</p>`;
                container.appendChild(item);
            });
            
            // Hardcoded subjects for common platform access
            const subjectsList = [
                { id: 1, name: 'Data Structures' },
                { id: 2, name: 'Operating Systems' },
                { id: 3, name: 'Computer Networks' },
                { id: 4, name: 'Software Engineering' },
                { id: 5, name: 'Database Systems' }
            ];
            subjectsList.forEach(s => {
                const item = document.createElement('div');
                item.className = 'drawer-class-item';
                item.style.cursor = 'pointer';
                item.innerHTML = `<h4><i class="fas fa-book"></i> ${s.name}</h4>`;
                item.onclick = () => this.openMaterials(s.id, s.name);
                container.appendChild(item);
            });

        } else {
            const subjectsList = [
                { id: 1, name: 'Data Structures' },
                { id: 2, name: 'Operating Systems' },
                { id: 3, name: 'Computer Networks' },
                { id: 4, name: 'Software Engineering' },
                { id: 5, name: 'Database Systems' }
            ];
            
            const title = document.createElement('h3');
            title.innerText = "Current Academic Subjects";
            title.style.margin = "1rem 0";
            container.appendChild(title);
            subjectsList.forEach(s => {
                const item = document.createElement('div');
                item.className = 'drawer-class-item';
                item.style.cursor = 'pointer';
                item.innerHTML = `<h4><i class="fas fa-book"></i> ${s.name}</h4>`;
                item.onclick = () => this.openMaterials(s.id, s.name);
                container.appendChild(item);
            });

            const historyBtn = document.createElement('button');
            historyBtn.className = 'btn-placement';
            historyBtn.style.marginTop = '2rem';
            historyBtn.innerHTML = '<i class="fas fa-history"></i> Last Semester Subjects';
            historyBtn.onclick = () => {
                const lastSubjs = [
                    { id: 6, name: 'Microprocessors', grade: 'A' },
                    { id: 7, name: 'Mathematics III', grade: 'B+' }
                ];
                
                // Keep the drawer open, just clear and show past subjects
                container.innerHTML = '<h3 style="margin: 1rem 0;">Previous Semester</h3>';
                lastSubjs.forEach(s => {
                    const item = document.createElement('div');
                    item.className = 'drawer-class-item';
                    item.style.cursor = 'pointer';
                    item.innerHTML = `<h4><i class="fas fa-book"></i> ${s.name}</h4><p style="color:#aaa; font-size:0.9rem; margin-top:5px;">Grade: ${s.grade || 'N/A'}</p>`;
                    item.onclick = () => this.openMaterials(s.id, s.name);
                    container.appendChild(item);
                });
            };
            container.appendChild(historyBtn);
        }
    }

    async openMaterials(subjectId, subjectName) {
        document.getElementById('materials-title').innerText = subjectName + " Materials";
        document.getElementById('materials-modal').style.display = 'flex';
        this.currentSubjectId = subjectId;

        const uploadSection = document.getElementById('professor-upload-section');
        uploadSection.style.display = this.user.role === 'professor' ? 'flex' : 'none';

        this.loadMaterials(subjectId);
    }

    async loadMaterials(subjectId) {
        const list = document.getElementById('materials-list');
        list.innerHTML = 'Loading...';
        try {
            const res = await fetch(`${API_BASE}/materials/${subjectId}`);
            const materials = await res.json();
            list.innerHTML = '';
            if (materials.length === 0) {
                list.innerHTML = '<p style="color: #aaa;">No materials posted yet.</p>';
            } else {
                materials.forEach(m => {
                    const item = document.createElement('div');
                    item.style.padding = '10px';
                    item.style.background = 'rgba(255,255,255,0.05)';
                    item.style.border = '1px solid #333';
                    item.style.borderRadius = '5px';
                    item.style.display = 'flex';
                    item.style.justifyContent = 'space-between';
                    item.style.alignItems = 'center';
                    
                    let html = `<div><strong style="display:block; margin-bottom: 5px;">${m.title}</strong><a href="${m.file_url}" target="_blank" style="color: #4da6ff; text-decoration: none;"><i class="fas fa-external-link-alt"></i> View Material</a></div>`;
                    if (this.user.role === 'professor') {
                        html += `<button class="btn-primary" style="background: #e74c3c; padding: 5px 10px; width: auto;" onclick="app.deleteMaterial(${m.id}, ${subjectId})"><i class="fas fa-trash"></i></button>`;
                    }
                    item.innerHTML = html;
                    list.appendChild(item);
                });
            }
        } catch (e) {
            list.innerHTML = '<p style="color: red;">Error loading materials.</p>';
        }
    }

    async deleteMaterial(id, subjectId) {
        if (!confirm("Delete this material?")) return;
        await fetch(`${API_BASE}/materials/${id}`, { method: 'DELETE' });
        this.loadMaterials(subjectId);
    }

    async openPlacementsView() {
        document.getElementById('placements-view-modal').style.display = 'flex';
        const tbody = document.getElementById('placements-tbody');
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 10px;">Loading...</td></tr>';
        try {
            const res = await fetch(`${API_BASE}/placements`);
            const data = await res.json();
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="padding: 10px; text-align: center;">No applications found.</td></tr>';
                return;
            }
            data.forEach(p => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';
                tr.innerHTML = `
                    <td style="padding: 12px;">${p.name || 'Unknown'}</td>
                    <td style="padding: 12px;">${p.prn || '-'}</td>
                    <td style="padding: 12px;">${p.class_code || '-'}</td>
                    <td style="padding: 12px;">
                        <a href="${p.resume_link}" target="_blank" style="color:#4da6ff; margin-right: 15px; text-decoration: none;"><i class="fas fa-file-alt"></i> Resume</a>
                        <a href="${p.linkedin_link}" target="_blank" style="color:#4da6ff; text-decoration: none;"><i class="fab fa-linkedin"></i> LinkedIn</a>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 10px; color: red;">Error loading data.</td></tr>';
        }
    }

    handleIncomingMessage(msg) {
        let id;
        if (msg.message_type === 'broadcast' || (msg.classroom_id === null && msg.receiver_id === null)) {
            id = msg.classroom_id || 0; // Global Hub
        } else if (msg.classroom_id) {
            id = msg.classroom_id;
        } else {
            id = (msg.sender_id == this.user.id) ? msg.receiver_id : msg.sender_id;
        }

        if (!this.messages[id]) this.messages[id] = [];
        this.messages[id].push({ 
            id: msg.id, 
            text: msg.message_text, 
            type: msg.sender_id == this.user.id ? 'sent' : 'received', 
            broadcast: msg.message_type === 'broadcast' 
        });

        if (this.activeChatId == id) {
            this.renderMessages();
        }

        const chatIndex = this.chats.findIndex(c => c.id == id);
        if (chatIndex > -1) {
            const chat = this.chats[chatIndex];
            chat.lastMsg = msg.message_text;
            if (this.activeChatId != id) {
                chat.unread = (chat.unread || 0) + 1;
            }
            // Move to top of queue (WhatsApp style)
            this.chats.splice(chatIndex, 1);
            
            // If it's the global hub, we might want it to stay at index 0, or just let everything flow naturally. Let's just put the most recent chat immediately after index 0 if index 0 is global hub, or just unshift if global hub isn't strictly pinned.
            // Let's just unshift it naturally so the most recent is at the absolute top.
            this.chats.unshift(chat);
            
            this.renderChatList();
        }
    }

    renderChatList(filter = '') {
        const listContainer = document.getElementById('chat-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        this.chats.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())).forEach(chat => {
            const item = document.createElement('div');
            item.className = `chat-item ${this.activeChatId === chat.id ? 'active' : ''}`;
            const icon = chat.icon || (chat.type === 'group' ? 'users' : 'user-graduate');
            item.innerHTML = `
                <div class="chat-avatar ${this.activeChatId === chat.id ? 'avatar-highlight' : ''}"><div class="chat-avatar-placeholder"><i class="fas fa-${icon}"></i></div></div>
                <div class="chat-meta"><h4>${chat.name}</h4><p>${chat.lastMsg || 'Tap to chat'}</p></div>
                ${chat.unread > 0 ? `<span class="notification-badge">${chat.unread}</span>` : ''}
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
            this.messages[chat.id] = data.map(m => ({ id: m.id, text: m.message_text, type: m.sender_id == this.user.id ? 'sent' : 'received', broadcast: m.message_type === 'broadcast' }));
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
        if (document.getElementById('chat-search')) document.getElementById('chat-search').oninput = (e) => this.renderChatList(e.target.value);
        if (document.getElementById('send-btn')) document.getElementById('send-btn').onclick = () => this.sendMessage(false);
        if (document.getElementById('broadcast-btn')) document.getElementById('broadcast-btn').onclick = () => this.sendMessage(true);
        if (document.getElementById('msg-input')) document.getElementById('msg-input').onkeypress = (e) => { if (e.key === 'Enter') this.sendMessage(false); };

        document.getElementById('join-class-btn').onclick = () => window.location.href = 'join_class.html';
        document.getElementById('univ-chat-btn').onclick = () => window.location.href = 'global_chat.html';
        document.getElementById('status-btn').onclick = () => window.location.href = 'status.html';

        if (document.getElementById('profile-trigger')) document.getElementById('profile-trigger').onclick = () => document.getElementById('profile-modal').style.display = 'flex';
        document.querySelectorAll('.close-modal').forEach(c => c.onclick = () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); });

        if (document.getElementById('menu-trigger')) document.getElementById('menu-trigger').onclick = () => document.getElementById('side-drawer').classList.add('open');
        if (document.getElementById('close-drawer')) document.getElementById('close-drawer').onclick = () => document.getElementById('side-drawer').classList.remove('open');

        const openPlacementBtn = document.getElementById('open-placement-btn');
        if (openPlacementBtn) {
            if (this.user && this.user.role === 'professor') {
                document.getElementById('placement-btn-text').innerText = 'View Placements';
                openPlacementBtn.onclick = () => this.openPlacementsView();
            } else {
                openPlacementBtn.onclick = () => document.getElementById('placement-modal').style.display = 'flex';
            }
        }

        if (document.getElementById('upload-material-btn')) {
            document.getElementById('upload-material-btn').onclick = async () => {
                const title = document.getElementById('material-title').value.trim();
                const url = document.getElementById('material-url').value.trim();
                if (!title || !url) return alert('Please provide both title and link');
                await fetch(`${API_BASE}/materials`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subjectId: this.currentSubjectId, title, fileUrl: url, uploadedBy: this.user.id })
                });
                document.getElementById('material-title').value = '';
                document.getElementById('material-url').value = '';
                this.loadMaterials(this.currentSubjectId);
            };
        }

        // Placement Form Handler
        const placeForm = document.getElementById('placement-form-element');
        if (placeForm) {
            placeForm.onsubmit = async (e) => {
                e.preventDefault();
                const formData = {
                    userId: this.user.id,
                    domain: document.getElementById('placement-domain').value,
                    cgpa: document.getElementById('placement-cgpa').value,
                    skills: document.getElementById('placement-skills').value,
                    resumeLink: document.getElementById('placement-resume').value,
                    linkedinLink: document.getElementById('placement-linkedin').value
                };
                const res = await fetch(`${API_BASE}/placement-apply`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData)
                });
                const data = await res.json();
                alert(data.message);
                if (res.ok) document.getElementById('placement-modal').style.display = 'none';
            };
        }
    }

    applyRoleUI() {
        if (this.user && this.user.role === 'professor') {
            document.body.classList.add('professor-mode');
            if (document.getElementById('msg-input')) document.getElementById('msg-input').placeholder = "Broadcast or type a message...";
        }
    }
}

const app = new ITALKApp();
