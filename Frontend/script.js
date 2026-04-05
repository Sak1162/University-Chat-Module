/**
 * ITALK (BVDU) - Chat Application Logic
 * Academic & Placement Integration Phase
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
    ? "http://localhost:5000"
    : "https://university-chat-module.onrender.com";

console.log("ITALK App Initializing. API_BASE:", API_BASE);


// --- Socket Service ---
class SocketService {
    constructor() {
        this.socket = null;
        this.callbacks = [];
    }

    connect(user, chats, app) {
        if (typeof io === 'undefined') return;
        this.socket = io(API_BASE);
        this.socket.on("connect", () => {
            this.socket.emit("user-online", user.id);
            this.socket.emit("join-room", `user_${user.id}`);
            chats.forEach(c => {
                const room = (c.type === 'group' || c.type === 'global') ? `class_${c.id === 0 ? 'null' : c.id}` : (c.classroom_id ? `class_${c.classroom_id}` : null);
                if (room) this.socket.emit("join-room", room);
            });
        });
        this.socket.on("receive-message", (msg) => this.callbacks.forEach(cb => cb(msg)));
        this.socket.on("update-online-users", (userIds) => {
            app.onlineUsers = new Set(userIds.map(String));
            app.renderChatList();
            app.updateActiveChatStatus();
        });
        this.socket.on("user-typing", (data) => {
            app.typingUsers.add(String(data.sender_id));
            app.updateActiveChatStatus();
        });
        this.socket.on("user-stop-typing", (data) => {
            app.typingUsers.delete(String(data.sender_id));
            app.updateActiveChatStatus();
        });
    }

    send(eventName, data) { if (this.socket) this.socket.emit(eventName, data); }
    onMessage(callback) { this.callbacks.push(callback); }
}

// --- App Controller ---
class ITALKApp {
    constructor() {
        try {
            this.user = JSON.parse(localStorage.getItem('italk_user')) || null;
        } catch (e) {
            console.error("Local storage error:", e);
            this.user = null;
        }
        this.socket = new SocketService();
        this.activeChatId = null;
        this.chats = [];
        this.messages = {};
        this.subjects = [];
        this.managedClasses = [];
        this.activeRecipientId = null;
        this.activeRecipientName = null;
        this.searchResults = []; // Added for global user search
        this.onlineUsers = new Set();
        this.typingUsers = new Set();
        this.typingTimeout = null;

        if (document.querySelector('.app-body')) {
            if (!this.user) window.location.href = 'index.html';
            this.initHome();
        } else {
            this.initAuth();
        }

        if (window.location.href.includes('join_class.html')) this.initJoinClass();
    }

    initAuth() {
        console.log("Entering Auth Init");
        const loginEl = document.getElementById('login-form-element');
        if (loginEl) {
            loginEl.onsubmit = async (e) => {
                e.preventDefault();
                try {
                    const res = await fetch(`${API_BASE}/login`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prn: document.getElementById('login-prn').value, password: document.getElementById('login-password').value })
                    });
                    const data = await res.json();
                    if (res.ok) { localStorage.setItem('italk_user', JSON.stringify(data.user)); window.location.href = 'home.html'; }
                    else alert(data.message || "Login failed");
                } catch (err) {
                    console.error("Login Error:", err);
                    alert("Could not connect to the server. Please ensure the backend is running at " + API_BASE);
                }
            };
        }
        const signupEl = document.getElementById('signup-form-element');
        if (signupEl) {
            signupEl.onsubmit = async (e) => {
                e.preventDefault();
                try {
                    const res = await fetch(`${API_BASE}/signup`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            full_name: document.getElementById('signup-name').value,
                            prn: document.getElementById('signup-prn').value,
                            role: document.querySelector('input[name="role"]:checked').value,
                            password: document.getElementById('signup-password').value
                        })
                    });
                    const data = await res.json();
                    if (res.ok) { alert("Success! Please login."); document.getElementById('to-login').click(); }
                    else alert(data.message || "Signup failed");
                } catch (err) {
                    console.error("Signup Error:", err);
                    alert("Could not connect to the server. Please ensure the backend is running.");
                }
            };
        }
        const toSignup = document.getElementById('to-signup');
        if (toSignup) toSignup.onclick = () => { document.getElementById('login-form').classList.remove('active'); document.getElementById('signup-form').classList.add('active'); };
        const toLogin = document.getElementById('to-login');
        if (toLogin) toLogin.onclick = () => { document.getElementById('signup-form').classList.remove('active'); document.getElementById('login-form').classList.add('active'); };
    }

    async initHome() {
        this.applyRoleUI();
        this.syncUserProfile();
        await this.loadChats();
        await this.loadAcademics();
        this.socket.connect(this.user, this.chats, this);
        this.socket.onMessage((msg) => this.handleIncomingMessage(msg));
        this.renderChatList();
        this.renderAcademicUI();
        this.setupEventListeners();
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
                alert(`Successfully joined class: ${data.classroom ? data.classroom.name : code}`);
                this.user.class_code = data.classroom ? data.classroom.code : code;
                localStorage.setItem('italk_user', JSON.stringify(this.user));
                window.location.href = 'home.html';
            } else alert(data.message);
        };
    }

    async loadChats() {
        if (!this.user || !this.user.id) return;
        try {
            console.log("Loading chats for user:", this.user.id);
            const res = await fetch(`${API_BASE}/chats/${this.user.id}`);
            this.chats = await res.json();
            console.log("Chats received:", this.chats);
            if (!this.chats || this.chats.length === 0) {
                this.chats = [{ id: 0, name: "Global Hub", type: "global", icon: "globe" }];
            }
        } catch (e) {
            console.error("Failed to load chats:", e);
            this.chats = [{ id: 0, name: "Global Hub", type: "global", icon: "globe" }];
        }
    }

    async loadAcademics() {
        if (!this.user || !this.user.id) return;
        try {
            // Professors need managedClasses for classroom list and subjects for academic materials
            if (this.user.role === 'professor') {
                const resClasses = await fetch(`${API_BASE}/professor/classes/${this.user.id}`);
                this.managedClasses = await resClasses.json();
            }
            
            // All users fetch subjects - Students get classroom-linked ones, Profs get their own
            const resSubjects = await fetch(`${API_BASE}/subjects/${this.user.id}`);
            this.subjects = await resSubjects.json();
            
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
            
            // Show dynamic subjects (includes auto-synced ones)
            (this.subjects || []).forEach(s => {
                const item = document.createElement('div');
                item.className = 'drawer-class-item';
                item.style.cursor = 'pointer';
                item.innerHTML = `<h4><i class="fas fa-book"></i> ${s.name} ${s.class_code ? `<span style="color:#4da6ff; font-size:0.8rem; margin-left:8px;">(${s.class_code})</span>` : ''}</h4>`;
                item.onclick = () => this.openMaterials(s.id, s.name);
                container.appendChild(item);
            });

        } else {
            const title = document.createElement('h3');
            title.innerText = "Current Academic Subjects";
            title.style.margin = "1rem 0";
            container.appendChild(title);
            
            // Show dynamic subjects (includes auto-synced ones)
            (this.subjects || []).forEach(s => {
                const item = document.createElement('div');
                item.className = 'drawer-class-item';
                item.style.cursor = 'pointer';
                item.innerHTML = `<h4><i class="fas fa-book"></i> ${s.name} ${s.class_code ? `<span style="color:#4da6ff; font-size:0.8rem; margin-left:8px;">(${s.class_code})</span>` : ''}</h4>`;
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
        document.getElementById('materials-title').innerText = (subjectName || "Class") + " Materials";
        document.getElementById('materials-modal').style.display = 'flex';
        this.currentSubjectId = subjectId;

        const uploadSection = document.getElementById('professor-upload-section');
        if (uploadSection) uploadSection.style.display = this.user.role === 'professor' ? 'flex' : 'none';

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
        if (msg.message_type === 'broadcast' && !msg.classroom_id) {
            id = 0; // Global Hub (pure broadcast)
        } else if (msg.classroom_id) {
            // Priority: Find the existing chat in this.chats that handles this classroom context.
            // For Students: The teacher chat will have classroom_id set.
            // For Professors: The classroom hub chat's id will equal msg.classroom_id.
            const matchingChat = this.chats.find(c => 
                (c.classroom_id == msg.classroom_id) || 
                (c.type === 'group' && c.id == msg.classroom_id)
            );
            
            if (matchingChat) {
                id = matchingChat.id;
            } else if (msg.message_type === 'broadcast') {
                id = msg.classroom_id; 
            } else {
                // If it's a private message that doesn't match a loaded classroom chat,
                // fall back to mapping by sender/receiver.
                id = (msg.sender_id == this.user.id) ? msg.receiver_id : msg.sender_id;
            }
        } else {
            id = (msg.sender_id == this.user.id) ? msg.receiver_id : msg.sender_id;
        }

        if (!this.messages[id]) this.messages[id] = [];
        this.messages[id].push({
            id: msg.id,
            text: msg.message_text,
            type: msg.sender_id == this.user.id ? 'sent' : 'received',
            broadcast: msg.message_type === 'broadcast',
            time: msg.sent_at,
            sender_id: msg.sender_id,
            sender_name: msg.sender_name
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

        // Hide skeleton if present
        const skeleton = document.getElementById('chat-skeleton');
        if (skeleton) skeleton.style.display = 'none';

        listContainer.innerHTML = '';
        const filtered = this.chats.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
        
        if (filtered.length === 0 && !filter) {
            listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No conversations yet.</div>';
            return;
        }

        filtered.forEach(chat => {
            const item = document.createElement('div');
            item.className = `chat-item ${this.activeChatId === chat.id ? 'active' : ''}`;
            const icon = chat.icon || (chat.type === 'group' ? 'users' : 'user-tie');
            
            // Render Avatar: Image or Placeholder
            let avatarHtml = `<div class="chat-avatar-placeholder"><i class="fas fa-${icon}"></i></div>`;
            if (chat.profile_pic) {
                avatarHtml = `<img src="${chat.profile_pic}" class="chat-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                              <div class="chat-avatar-placeholder" style="display:none;"><i class="fas fa-${icon}"></i></div>`;
            }

            const isOnline = this.onlineUsers.has(String(chat.id));
            
            item.innerHTML = `
                <div class="chat-avatar ${this.activeChatId === chat.id ? 'avatar-highlight' : ''}">
                    ${avatarHtml}
                </div>
                <div class="chat-meta">
                    <h4>${chat.name}</h4>
                    <p>${chat.lastMsg || (chat.type === 'group' ? 'Classroom Hub' : (chat.type === 'global' ? 'System Broadcasts' : 'Faculty Chat'))}</p>
                    ${chat.type === 'private' ? `<span class="status-dot ${isOnline ? 'status-online' : 'status-offline'}"></span>` : ''}
                </div>
                ${chat.unread > 0 ? `<span class="notification-badge">${chat.unread}</span>` : ''}
            `;
            item.onclick = () => this.selectChat(chat);
            listContainer.appendChild(item);
        });

        // Add Global Search Results Header
        if (filter.length > 2 && this.searchResults.length > 0) {
            const header = document.createElement('div');
            header.className = 'search-results-header';
            header.innerHTML = `<span>Global Users Found (${this.searchResults.length})</span>`;
            listContainer.appendChild(header);

            this.searchResults.forEach(user => {
                // Skip if already in chat list
                if (this.chats.some(c => c.id == user.id)) return;

                const item = document.createElement('div');
                item.className = 'chat-item global-search-item';
                let avatarHtml = `<div class="chat-avatar-placeholder"><i class="fas fa-user-plus" style="color:#4da6ff;"></i></div>`;
                if (user.profile_pic) {
                    avatarHtml = `<img src="${user.profile_pic}" class="chat-avatar-img">`;
                }

                item.innerHTML = `
                    <div class="chat-avatar">${avatarHtml}</div>
                    <div class="chat-meta">
                        <h4>${user.name}</h4>
                        <p style="color:#4da6ff;">Global Search Result</p>
                    </div>
                `;
                item.onclick = () => {
                   // When clicked, add to chats and select
                   this.chats.unshift(user);
                   this.searchResults = [];
                   document.getElementById('chat-search').value = '';
                   this.selectChat(user);
                   this.renderChatList();
                };
                listContainer.appendChild(item);
            });
        }
    }

    async selectChat(chat) {
        this.activeChatId = chat.id;
        this.currentChat = chat;
        this.activeRecipientId = null;
        this.activeRecipientName = null;
        chat.unread = 0;
        
        // Mobile UI handle
        document.querySelector('.sidebar').classList.remove('open');

        document.querySelector('.empty-state').style.display = 'none';
        document.querySelector('.active-chat').style.display = 'flex';
        document.getElementById('active-chat-name').innerText = chat.name;
        
        // Asymmetric view logic:
        const url = new URL(`${API_BASE}/messages/${chat.id}`);
        url.searchParams.append('userId', this.user.id);
        url.searchParams.append('type', chat.type);
        if (chat.classroom_id) url.searchParams.append('classroomId', chat.classroom_id);

        if (!this.messages[chat.id]) {
            const res = await fetch(url);
            const data = await res.json();
            this.messages[chat.id] = data.map(m => ({ 
                id: m.id, 
                text: m.message_text, 
                type: m.sender_id == this.user.id ? 'sent' : 'received', 
                time: m.sent_at,
                sender_id: m.sender_id,
                sender_name: m.sender_name,
                sender_pic: m.sender_pic,
                broadcast: m.message_type === 'broadcast'
            }));
        }
        this.updateInputPlaceholder();
        this.renderMessages();
        this.renderChatList();
        this.updateActiveChatStatus();
    }

    updateActiveChatStatus() {
        if (!this.currentChat) return;
        const chat = this.currentChat;
        const statusEl = document.getElementById('active-chat-status');
        const broadcastBtn = document.getElementById('broadcast-btn');
        const viewStudentsBtn = document.getElementById('view-students-btn');
        const chatMaterialsBtn = document.getElementById('chat-materials-btn');
        
        if (viewStudentsBtn) viewStudentsBtn.style.display = 'none'; // Default hidden
        if (chatMaterialsBtn) chatMaterialsBtn.style.display = 'none';

        if (chat.type === 'group' || chat.type === 'professor_classroom') {
            // Classroom View
            if (this.user.role === 'professor') {
                statusEl.innerHTML = `Code: <span style="color:#4da6ff; cursor:pointer;" onclick="app.showClassQR('${chat.code}')">${chat.code}</span>`;
                if (broadcastBtn) broadcastBtn.style.display = 'flex';
                if (viewStudentsBtn) {
                    viewStudentsBtn.style.display = 'flex';
                    viewStudentsBtn.onclick = () => this.fetchClassroomStudents(chat.code, chat.name);
                }
            } else {
                statusEl.innerText = 'Classroom Active';
                statusEl.style.color = '#10b981';
            }

            // Both Students and Professors can see Materials in a classroom
            if (chatMaterialsBtn) {
                chatMaterialsBtn.style.display = 'flex';
                chatMaterialsBtn.onclick = () => this.openClassroomMaterials(chat.id, chat.name);
            }
            
        } else if (chat.type === 'private') {
            const isTyping = this.typingUsers.has(String(chat.id));
            const isOnline = this.onlineUsers.has(String(chat.id));
            
            if (isTyping) {
                statusEl.innerHTML = '<span class="typing-indicator">is typing...</span>';
            } else {
                statusEl.innerText = isOnline ? 'Online' : 'Offline';
                statusEl.style.color = isOnline ? '#10b981' : '#ef4444';
            }
            if (broadcastBtn) broadcastBtn.style.display = 'none';
        } else {
            statusEl.innerText = 'Online'; // Hubs are always "online"
            statusEl.style.color = '#10b981';
            if (broadcastBtn) broadcastBtn.style.display = 'none';
        }
    }

    async openClassroomMaterials(classId, className) {
        try {
            const res = await fetch(`${API_BASE}/classroom-subject/${classId}`);
            const data = await res.json();
            if (res.ok && data.subject_id) {
                this.openMaterials(data.subject_id, className);
            } else {
                alert("This classroom does not have a materials folder yet.");
            }
        } catch (e) {
            console.error("Error opening classroom materials:", e);
            alert("Could not load class materials.");
        }
    }

    renderMessages() {
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        (this.messages[this.activeChatId] || []).forEach(m => {
            const div = document.createElement('div');
            div.className = `message ${m.type === 'sent' ? 'msg-sent' : 'msg-received'} ${m.broadcast ? 'msg-broadcast' : ''}`;
            
            // Show sender name if in a classroom hub (for Professors)
            const isGroup = this.currentChat && (this.currentChat.type === 'group' || this.currentChat.type === 'global');
            const showDetails = isGroup && m.type === 'received';
            
            const avatarHtml = (showDetails && m.sender_pic) ? `<img src="${m.sender_pic}" class="msg-avatar">` : '';
            const nameHtml = showDetails ? `<div class="msg-sender" onclick="app.setRecipient(${m.sender_id}, '${m.sender_name}')">${avatarHtml} ${m.sender_name} ${m.broadcast ? '<i class="fas fa-bullhorn" style="font-size:0.7rem; margin-left:5px;"></i>' : ''}</div>` : '';

            const timeStr = m.time ? new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            
            div.innerHTML = `
                ${nameHtml}
                <div class="msg-text">${m.text}</div>
                <span class="msg-time">${timeStr}</span>
            `;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    }

    setRecipient(id, name) {
        this.activeRecipientId = id;
        this.activeRecipientName = name;
        this.updateInputPlaceholder();
        alert(`Now replying privately to: ${name}. To broadcast instead, use the bullhorn button.`);
    }

    updateInputPlaceholder() {
        const input = document.getElementById('msg-input');
        if (!input) return;
        if (this.user.role === 'professor' && this.currentChat && this.currentChat.type === 'group') {
            input.placeholder = this.activeRecipientId ? `Private reply to ${this.activeRecipientName}...` : "Broadcast to your class...";
        } else {
            input.placeholder = "Type a message...";
        }
    }

    sendMessage(forceBroadcast = false) {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if (!text) return;
        const chat = this.currentChat;
        if (!chat) return;

        let msgData;
        if (this.user.role === 'professor') {
            if (forceBroadcast) {
                // Explicit Broadcast
                msgData = {
                    sender_id: this.user.id,
                    sender_name: this.user.name || this.user.full_name,
                    classroom_id: chat.id,
                    message_text: text,
                    message_type: 'broadcast'
                };
                this.socket.send("broadcast", msgData);
            } else if (chat.type === 'group' && this.activeRecipientId) {
                // Private Reply within a classroom
                msgData = {
                    sender_id: this.user.id,
                    sender_name: this.user.name || this.user.full_name,
                    receiver_id: this.activeRecipientId,
                    classroom_id: chat.id,
                    message_text: text,
                    message_type: 'private'
                };
                this.socket.send("send-message", msgData);
            } else if (chat.type === 'group' && !this.activeRecipientId) {
                // Default to broadcast if in a group and no one selected (or optional: alert)
                msgData = {
                    sender_id: this.user.id,
                    sender_name: this.user.name || this.user.full_name,
                    classroom_id: chat.id,
                    message_text: text,
                    message_type: 'broadcast'
                };
                this.socket.send("broadcast", msgData);
            } else {
                // Normal private Chat (Faculty Chat)
                msgData = {
                    sender_id: this.user.id,
                    sender_name: this.user.name || this.user.full_name,
                    receiver_id: chat.id,
                    message_text: text,
                    message_type: 'private'
                };
                this.socket.send("send-message", msgData);
            }
        } else {
            // Student sending to professor
            msgData = {
                sender_id: this.user.id,
                sender_name: this.user.name || this.user.full_name,
                receiver_id: chat.id, // The Professor's ID
                classroom_id: chat.classroom_id,
                message_text: text,
                message_type: 'private'
            };
            this.socket.send("send-message", msgData);
        }
        input.value = '';
    }

    setupEventListeners() {
        if (document.getElementById('chat-search')) {
            let searchTimeout;
            document.getElementById('chat-search').oninput = (e) => {
                const val = e.target.value;
                this.renderChatList(val);

                clearTimeout(searchTimeout);
                if (val.length > 2) {
                    searchTimeout = setTimeout(async () => {
                        const res = await fetch(`${API_BASE}/search-users?q=${encodeURIComponent(val)}`);
                        this.searchResults = await res.json();
                        this.renderChatList(val);
                    }, 500);
                } else {
                    this.searchResults = [];
                }
            };
        }
        if (document.getElementById('send-btn')) document.getElementById('send-btn').onclick = () => this.sendMessage();
        if (document.getElementById('msg-input')) {
            const input = document.getElementById('msg-input');
            input.onkeypress = (e) => { 
                if (e.key === 'Enter') {
                    this.sendMessage();
                    this.stopTyping();
                }
            };
            input.oninput = () => this.handleTyping();
        }

        const createBtn = document.getElementById('create-class-btn');
        if (createBtn) createBtn.onclick = () => this.handleCreateClass();

        const broadcastBtn = document.getElementById('broadcast-btn');
        if (broadcastBtn) broadcastBtn.onclick = () => this.sendMessage(true);

        if (document.getElementById('join-class-btn')) document.getElementById('join-class-btn').onclick = () => window.location.href = 'join_class.html';
        document.getElementById('univ-chat-btn').onclick = () => window.location.href = 'global_chat.html';
        document.getElementById('status-btn').onclick = () => window.location.href = 'status.html';

        if (document.getElementById('profile-trigger')) document.getElementById('profile-trigger').onclick = () => {
            this.syncUserProfile();
            document.getElementById('profile-modal').style.display = 'flex';
        };
        
        if (document.getElementById('profile-pic-input')) {
            document.getElementById('profile-pic-input').onchange = (e) => this.handleProfilePicChange(e);
        }

        if (document.getElementById('save-profile')) {
            document.getElementById('save-profile').onclick = () => this.saveProfile();
        }

        document.querySelectorAll('.close-modal').forEach(c => c.onclick = () => { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); });

        if (document.getElementById('menu-trigger')) document.getElementById('menu-trigger').onclick = () => document.getElementById('side-drawer').classList.add('open');
        if (document.getElementById('close-drawer')) document.getElementById('close-drawer').onclick = () => document.getElementById('side-drawer').classList.remove('open');

        // Mobile Sidebar Toggles
        const mobileBack = document.getElementById('mobile-back');

        if (mobileBack) {
            mobileBack.onclick = () => {
                // Return to chat list on mobile
                document.querySelector('.sidebar').classList.add('open');
                this.activeChatId = null;
            };
        }

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
        if (!this.user) return;
        if (this.user.role === 'professor') {
            document.querySelectorAll('.professor-only').forEach(el => el.style.display = 'flex');
            document.querySelectorAll('.student-only').forEach(el => el.style.display = 'none');
            if (document.getElementById('msg-input')) document.getElementById('msg-input').placeholder = "Broadcast to your class...";
            
            // Profile Modal Labels for Professor
            const labels = document.querySelectorAll('#profile-modal .info-item label');
            if (labels.length >= 4) {
                labels[0].innerText = "Faculty Dept";
                labels[1].innerText = "Faculty Name";
                labels[2].innerText = "Classes Incharge";
                labels[3].innerText = "Faculty Code";
            }
        } else {
            document.querySelectorAll('.professor-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.student-only').forEach(el => el.style.display = 'flex');
            
            // Profile Modal Labels for Student
            const labels = document.querySelectorAll('#profile-modal .info-item label');
            if (labels.length >= 4) {
                labels[0].innerText = "Course";
                labels[1].innerText = "Year";
                labels[2].innerText = "Class Incharge";
                labels[3].innerText = "Class Code";
            }
        }
    }

    syncUserProfile() {
        if (!this.user) return;
        const u = this.user;

        // Sidebar Update
        const sidebarPic = document.getElementById('sidebar-profile-pic');
        if (sidebarPic) {
            if (u.profile_pic) {
                sidebarPic.innerHTML = '';
                sidebarPic.style.backgroundImage = `url(${u.profile_pic})`;
                sidebarPic.style.backgroundSize = 'cover';
                sidebarPic.style.backgroundPosition = 'center';
            } else {
                sidebarPic.innerHTML = `<i class="fas fa-${u.role === 'professor' ? 'user-tie' : 'user-graduate'}"></i>`;
                sidebarPic.style.backgroundImage = 'none';
            }
        }

        // Modal Update
        const modalPic = document.getElementById('profile-pic-display');
        if (modalPic) {
            if (u.profile_pic) {
                modalPic.innerHTML = '';
                modalPic.style.backgroundImage = `url(${u.profile_pic})`;
                modalPic.style.backgroundSize = 'cover';
                modalPic.style.backgroundPosition = 'center';
            } else {
                modalPic.innerHTML = `<i class="fas fa-${u.role === 'professor' ? 'user-tie' : 'user-graduate'}"></i>`;
                modalPic.style.backgroundImage = 'none';
            }
        }

        if (u.role === 'professor') {
            document.getElementById('p-course').innerText = u.dept || "Faculty of Eng.";
            document.getElementById('p-year').innerText = u.full_name;
            document.getElementById('p-incharge').innerText = this.managedClasses.map(c => c.name).join(", ") || "No active classes";
            document.getElementById('p-code').innerText = u.prn;
        } else {
            document.getElementById('p-course').innerText = u.course || "B.Tech IT";
            document.getElementById('p-year').innerText = u.year || "3rd Year";
            document.getElementById('p-incharge').innerText = u.class_incharge || "Prof. Sharma";
            document.getElementById('p-code').innerText = u.class_code || "Not Joined";
        }

        document.getElementById('p-contact').value = u.contact_number || "";
        document.getElementById('p-email').value = u.email || "";
    }

    handleProfilePicChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Img = event.target.result;
            this.user.profile_pic = base64Img;
            this.syncUserProfile();
        };
        reader.readAsDataURL(file);
    }

    async saveProfile() {
        if (!this.user || !this.user.id) return alert("User not found. Please log in again.");
        
        // Collect data from the modal with null checks
        const isProf = this.user.role === 'professor';
        const elCourse = document.getElementById('p-course');
        const elYear = document.getElementById('p-year');
        const elIncharge = document.getElementById('p-incharge');
        const elContact = document.getElementById('p-contact');
        const elEmail = document.getElementById('p-email');

        const payload = {
            userId: this.user.id,
            full_name: isProf ? (elYear ? elYear.innerText : this.user.full_name) : (this.user.full_name || "Student"),
            contact_number: (elContact ? elContact.value : null) || (this.user.contact_number || ""),
            email: (elEmail ? elEmail.value : null) || (this.user.email || ""),
            profile_pic: this.user.profile_pic || "",
            course: (elCourse ? elCourse.innerText : null) || (isProf ? this.user.dept : this.user.course) || "",
            year: isProf ? (this.user.year || "") : (elYear ? elYear.innerText : this.user.year) || "",
            class_incharge: isProf ? (this.user.class_incharge || "") : (elIncharge ? elIncharge.innerText : this.user.class_incharge) || ""
        };

        console.log("Saving profile with payload:", payload);

        try {
            const res = await fetch(`${API_BASE}/update-profile`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            console.log("Profile update response:", data);
            
            if (res.ok) {
                this.user = data.user;
                localStorage.setItem('italk_user', JSON.stringify(this.user));
                alert("Profile Saved Successfully!");
                this.syncUserProfile();
            } else {
                alert("Server Error: " + data.message);
            }
        } catch (e) {
            console.error("Save profile fatal error:", e);
            alert("Network Error: Could not save profile. Please check your connection.");
        }
    }

    handleTyping() {
        if (!this.currentChat || this.currentChat.type !== 'private') return;
        
        // Emit typing event
        this.socket.send("typing", {
            sender_id: this.user.id,
            receiver_id: this.currentChat.id
        });

        // Clear existing timeout
        if (this.typingTimeout) clearTimeout(this.typingTimeout);

        // Set timeout to stop typing
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }

    stopTyping() {
        if (!this.currentChat || this.currentChat.type !== 'private') return;
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = null;
        
        this.socket.send("stop-typing", {
            sender_id: this.user.id,
            receiver_id: this.currentChat.id
        });
    }

    async handleCreateClass() {
        const name = prompt("Enter Classroom Name (e.g. Physics B3):");
        if (!name) return;
        try {
            const res = await fetch(`${API_BASE}/create-class`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ professorId: this.user.id, name })
            });
            const data = await res.json();
            if (res.ok) {
                alert("Class Created! Code: " + data.code);
                this.showClassQR(data.code);
                await this.loadChats();
                this.renderChatList();
            } else {
                alert(data.message);
            }
        } catch (e) {
            console.error(e);
            alert("Error creating class.");
        }
    }

    showClassQR(code) {
        document.getElementById('display-class-code').innerText = code;
        const qrImg = document.getElementById('qr-image');
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${code}`;
        qrImg.onload = () => qrImg.style.display = 'block';
        document.getElementById('qr-modal').style.display = 'flex';
    }

    async fetchClassroomStudents(classCode, className) {
        document.getElementById('students-modal-title').innerText = `Students in ${className}`;
        document.getElementById('students-modal').style.display = 'flex';
        const tbody = document.getElementById('students-tbody');
        tbody.innerHTML = '<tr><td colspan="3" style="padding: 10px;">Loading...</td></tr>';

        try {
            const res = await fetch(`${API_BASE}/classroom-students/${classCode}`);
            const students = await res.json();
            tbody.innerHTML = '';

            if (students.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="padding: 10px; text-align: center; color: #aaa;">No students have joined yet.</td></tr>';
                return;
            }

            students.forEach(s => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';
                const joinedAt = s.joined_at ? new Date(s.joined_at).toLocaleString() : 'N/A';
                tr.innerHTML = `
                    <td style="padding: 12px; display: flex; align-items: center; gap: 10px;">
                        <div class="chat-avatar-placeholder" style="width: 30px; height: 30px; font-size: 0.8rem;">
                            <i class="fas fa-user-graduate"></i>
                        </div>
                        ${s.name}
                    </td>
                    <td style="padding: 12px;">${s.prn}</td>
                    <td style="padding: 12px; color: #94a3b8; font-size: 0.9rem;">${joinedAt}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            console.error("Error fetching students:", e);
            tbody.innerHTML = '<tr><td colspan="3" style="padding: 10px; color: #ef4444;">Error loading student list.</td></tr>';
        }
    }
}

window.onerror = function (msg, url, line) {
    console.error(`GLOBAL ERROR: ${msg} at ${url}:${line}`);
    alert("Application Error: Check console for details.");
};

const app = new ITALKApp();
