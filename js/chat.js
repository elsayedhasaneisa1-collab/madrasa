// ═══════════════════════════════════════════════════════════
// 💬 شات المنصة
// ═══════════════════════════════════════════════════════════

let chatState = {
  isOpen: false,
  channel: null,
  userRole: 'student',
  currentConvoUserId: null
};

async function openChat() {
  if (!currentUser) {
    showToast('سجّل الدخول أولاً للمحادثة', true);
    setTimeout(() => window.location.href = 'login.html', 800);
    return;
  }

  const { data: adminRow } = await supabaseClient
    .from('admins').select('id').eq('id', currentUser.id).maybeSingle();
  chatState.userRole = adminRow ? 'admin' : 'student';

  const modal = document.getElementById('chatModal');
  if (!modal) return;

  modal.classList.add('active');
  chatState.isOpen = true;

  if (chatState.userRole === 'admin') {
    await renderAdminChat();
  } else {
    await renderStudentChat();
  }

  subscribeToChat();
}

function closeChat() {
  const modal = document.getElementById('chatModal');
  if (modal) modal.classList.remove('active');
  chatState.isOpen = false;
  chatState.currentConvoUserId = null;

  if (chatState.channel) {
    supabaseClient.removeChannel(chatState.channel);
    chatState.channel = null;
  }
}

async function renderStudentChat() {
  const body = document.getElementById('chatBody');
  if (!body) return;

  body.innerHTML = `
    <div class="chat-messages" id="chatMessages">
      <div class="chat-loading">جاري التحميل...</div>
    </div>
    <div class="chat-input-area">
      <input 
        type="text" 
        id="chatInput" 
        placeholder="اكتب رسالتك..." 
        onkeypress="if(event.key==='Enter') sendChatMessage()"
        autocomplete="off">
      <button onclick="sendChatMessage()" class="chat-send-btn">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  `;

  await loadStudentMessages();
}

async function loadStudentMessages() {
  const messagesBox = document.getElementById('chatMessages');
  if (!messagesBox) return;

  const { data, error } = await supabaseClient
    .from('chat_messages')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  if (error) {
    messagesBox.innerHTML = '<div class="chat-error">خطأ في التحميل</div>';
    return;
  }

  if (!data?.length) {
    messagesBox.innerHTML = `
      <div class="chat-welcome-msg">
        <div class="chat-welcome-icon"><i class="fas fa-comments"></i></div>
        <h3>مرحباً بك في شات المنصة</h3>
        <p>اكتب رسالتك للأستاذ وسيتم الرد عليك قريباً</p>
      </div>
    `;
    return;
  }

  messagesBox.innerHTML = data.map(m => renderMessage(m)).join('');
  scrollChatToBottom();
}

async function renderAdminChat() {
  const body = document.getElementById('chatBody');
  if (!body) return;

  const { data: messages } = await supabaseClient
    .from('chat_messages')
    .select('user_id, user_name, message, created_at, is_read, user_role')
    .order('created_at', { ascending: false });

  const conversations = new Map();
  (messages || []).forEach(m => {
    if (!conversations.has(m.user_id)) {
      conversations.set(m.user_id, {
        user_id: m.user_id,
        user_name: m.user_name,
        last_message: m.message,
        last_time: m.created_at,
        unread: 0
      });
    }
    if (!m.is_read && m.user_role !== 'admin') {
      conversations.get(m.user_id).unread++;
    }
  });

  const list = Array.from(conversations.values());

  body.innerHTML = `
    <div class="chat-conversations">
      <h3 style="color:var(--gold);margin-bottom:15px;font-size:16px;">
        <i class="fas fa-inbox"></i> المحادثات (${list.length})
      </h3>
      ${list.length === 0 
        ? '<div class="chat-empty"><i class="fas fa-inbox"></i><p>لا توجد محادثات بعد</p></div>'
        : list.map(c => `
          <div class="chat-conv-item" onclick="openConversation('${c.user_id}', '${escapeHtml(c.user_name || 'طالب')}')">
            <div class="chat-conv-avatar">
              ${(c.user_name || 'ط').charAt(0)}
            </div>
            <div class="chat-conv-info">
              <strong>${escapeHtml(c.user_name || 'طالب')}</strong>
              <span>${escapeHtml((c.last_message || '').slice(0, 40))}${(c.last_message || '').length > 40 ? '...' : ''}</span>
            </div>
            ${c.unread > 0 ? `<div class="chat-conv-badge">${c.unread}</div>` : ''}
          </div>
        `).join('')}
    </div>
  `;
}

async function openConversation(userId, userName) {
  const body = document.getElementById('chatBody');
  if (!body) return;

  chatState.currentConvoUserId = userId;

  body.innerHTML = `
    <div class="chat-back-bar">
      <button onclick="renderAdminChat()" class="chat-back-btn">
        <i class="fas fa-arrow-right"></i> رجوع
      </button>
      <span>${escapeHtml(userName)}</span>
    </div>
    <div class="chat-messages" id="chatMessages">
      <div class="chat-loading">جاري التحميل...</div>
    </div>
    <div class="chat-input-area">
      <input 
        type="text" 
        id="chatInput" 
        placeholder="رد على ${escapeHtml(userName)}..." 
        onkeypress="if(event.key==='Enter') sendChatMessage('${userId}')"
        autocomplete="off">
      <button onclick="sendChatMessage('${userId}')" class="chat-send-btn">
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  `;

  await loadConversation(userId);

  await supabaseClient
    .from('chat_messages')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

async function loadConversation(userId) {
  const messagesBox = document.getElementById('chatMessages');
  if (!messagesBox) return;

  const { data } = await supabaseClient
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!data?.length) {
    messagesBox.innerHTML = '<div class="chat-empty"><p>لا توجد رسائل</p></div>';
    return;
  }

  messagesBox.innerHTML = data.map(m => renderMessage(m)).join('');
  scrollChatToBottom();
}

function renderMessage(m) {
  const isMine = m.user_id === currentUser.id && m.user_role !== 'admin';
  const isAdminMsg = m.user_role === 'admin';

  const time = new Date(m.created_at).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <div class="chat-msg ${isAdminMsg ? 'admin-msg' : ''} ${isMine && !isAdminMsg ? 'mine' : ''}">
      ${!isMine || isAdminMsg ? `<div class="chat-msg-name">${isAdminMsg ? '👑 الأستاذ' : escapeHtml(m.user_name || 'طالب')}</div>` : ''}
      <div class="chat-msg-bubble">
        <div class="chat-msg-text">${escapeHtml(m.message)}</div>
        <div class="chat-msg-time">${time}</div>
      </div>
    </div>
  `;
}

async function sendChatMessage(recipientId = null) {
  const input = document.getElementById('chatInput');
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  input.disabled = true;

  try {
    const userId = recipientId || currentUser.id;
    let userName = 'طالب';

    if (chatState.userRole === 'admin') {
      userName = 'الأستاذ محمد عيسى';
    } else {
      const { data: student } = await supabaseClient
        .from('students').select('full_name').eq('id', currentUser.id).single();
      userName = student?.full_name || 'طالب';
    }

    const { error } = await supabaseClient.from('chat_messages').insert({
      user_id: userId,
      user_name: userName,
      user_role: chatState.userRole,
      message: message
    });

    if (error) throw error;

    input.value = '';

    if (chatState.userRole === 'admin' && recipientId) {
      await loadConversation(recipientId);
    } else if (chatState.userRole === 'student') {
      await loadStudentMessages();
    }
  } catch (err) {
    showToast('فشل إرسال الرسالة: ' + err.message, true);
  } finally {
    input.disabled = false;
    input.focus();
  }
}

function subscribeToChat() {
  if (chatState.channel) {
    supabaseClient.removeChannel(chatState.channel);
  }

  const channel = supabaseClient
    .channel('chat_messages_channel')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => {
        if (!chatState.isOpen) return;

        if (chatState.userRole === 'student' && payload.new.user_id === currentUser.id) {
          loadStudentMessages();
        } else if (chatState.userRole === 'admin') {
          if (chatState.currentConvoUserId && payload.new.user_id === chatState.currentConvoUserId) {
            loadConversation(chatState.currentConvoUserId);
          } else {
            renderAdminChat();
          }
        }
      }
    )
    .subscribe();

  chatState.channel = channel;
}

function scrollChatToBottom() {
  const messages = document.getElementById('chatMessages');
  if (messages) {
    setTimeout(() => {
      messages.scrollTop = messages.scrollHeight;
    }, 100);
  }
}