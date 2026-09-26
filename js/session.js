// ═══════════════════════════════════════════════════════════
// 🔐 نظام الجلسة الواحدة لكل مستخدم
// ═══════════════════════════════════════════════════════════

let sessionState = {
  sessionId: null,
  heartbeatTimer: null,
  checkTimer: null,
  realtimeChannel: null,
  isActive: false,
  deviceInfo: {}
};

// ═══════════════ توليد معرف جلسة فريد ═══════════════
function generateSessionId() {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `sess_${timestamp}_${random}`;
}

// ═══════════════ معلومات الجهاز ═══════════════
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let device = 'جهاز غير معروف';
  let browser = 'متصفح غير معروف';
  let os = 'نظام غير معروف';

  // الجهاز
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) device = 'جوال';
  else if (/Tablet|iPad/i.test(ua)) device = 'تابلت';
  else device = 'كمبيوتر';

  // المتصفح
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera';

  // النظام
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iOS|iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return {
    device,
    browser,
    os,
    full: `${device} • ${browser} • ${os}`,
    userAgent: ua.slice(0, 200)
  };
}

// ═══════════════ بدء الجلسة ═══════════════
async function startSession(userId) {
  try {
    const sessionId = generateSessionId();
    const deviceInfo = getDeviceInfo();

    sessionState.sessionId = sessionId;
    sessionState.deviceInfo = deviceInfo;

    // 1) امسح كل الجلسات القديمة للمستخدم
    await supabaseClient
      .from('user_sessions')
      .delete()
      .eq('user_id', userId);

    // 2) سجّل الجلسة الجديدة
    const { error } = await supabaseClient
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        device_info: deviceInfo.full,
        user_agent: deviceInfo.userAgent,
        last_heartbeat: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('فشل تسجيل الجلسة:', error);
      return false;
    }

    sessionState.isActive = true;

    // 3) ابدأ نبضة كل 15 ثانية
    startHeartbeat(userId, sessionId);

    // 4) ابدأ فحص الجلسة كل 8 ثوانٍ
    startSessionCheck(userId, sessionId);

    // 5) استمع للتغييرات اللحظية
    subscribeToSessionChanges(userId, sessionId);

    return true;
  } catch (err) {
    console.error('خطأ في بدء الجلسة:', err);
    return false;
  }
}

// ═══════════════ النبضة (Heartbeat) ═══════════════
function startHeartbeat(userId, sessionId) {
  if (sessionState.heartbeatTimer) {
    clearInterval(sessionState.heartbeatTimer);
  }

  const sendHeartbeat = async () => {
    if (!sessionState.isActive) return;

    try {
      await supabaseClient
        .from('user_sessions')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('session_id', sessionId);
    } catch (err) {
      console.warn('فشلت النبضة:', err);
    }
  };

  sendHeartbeat();
  sessionState.heartbeatTimer = setInterval(
    sendHeartbeat,
    CONFIG.SESSION.heartbeatInterval
  );
}

// ═══════════════ فحص الجلسة ═══════════════
function startSessionCheck(userId, sessionId) {
  if (sessionState.checkTimer) {
    clearInterval(sessionState.checkTimer);
  }

  sessionState.checkTimer = setInterval(async () => {
    if (!sessionState.isActive) return;

    try {
      const { data } = await supabaseClient
        .from('user_sessions')
        .select('session_id')
        .eq('user_id', userId)
        .maybeSingle();

      // الجلسة اتشالت أو اتغيرت = حد دخل من جهاز تاني
      if (!data || data.session_id !== sessionId) {
        await handleSessionReplaced();
      }
    } catch (err) {
      console.warn('فشل فحص الجلسة:', err);
    }
  }, CONFIG.SESSION.checkInterval);
}

// ═══════════════ الاستماع للتغييرات اللحظية ═══════════════
function subscribeToSessionChanges(userId, sessionId) {
  if (sessionState.realtimeChannel) {
    supabaseClient.removeChannel(sessionState.realtimeChannel);
  }

  const channel = supabaseClient
    .channel('session_changes_' + userId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_sessions',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        // لو الجلسة اتغيرت
        if (
          payload.new &&
          payload.new.session_id &&
          payload.new.session_id !== sessionId
        ) {
          handleSessionReplaced();
        }

        // لو الجلسة اتمسحت
        if (payload.eventType === 'DELETE') {
          handleSessionReplaced();
        }
      }
    )
    .subscribe();

  sessionState.realtimeChannel = channel;
}

// ═══════════════ إيقاف الجلسة (عند الخروج اليدوي) ═══════════════
async function stopSession(userId) {
  sessionState.isActive = false;

  if (sessionState.heartbeatTimer) {
    clearInterval(sessionState.heartbeatTimer);
    sessionState.heartbeatTimer = null;
  }
  if (sessionState.checkTimer) {
    clearInterval(sessionState.checkTimer);
    sessionState.checkTimer = null;
  }
  if (sessionState.realtimeChannel) {
    await supabaseClient.removeChannel(sessionState.realtimeChannel);
    sessionState.realtimeChannel = null;
  }

  try {
    if (userId && sessionState.sessionId) {
      await supabaseClient
        .from('user_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('session_id', sessionState.sessionId);
    }
  } catch (err) {
    console.warn('فشل حذف الجلسة:', err);
  }
}

// ═══════════════ معالج استبدال الجلسة ═══════════════
async function handleSessionReplaced() {
  if (!sessionState.isActive) return;
  sessionState.isActive = false;

  // أوقف كل المؤقتات
  if (sessionState.heartbeatTimer) clearInterval(sessionState.heartbeatTimer);
  if (sessionState.checkTimer) clearInterval(sessionState.checkTimer);

  // اعرض الرسالة الأنيقة
  showSessionReplacedModal();

  // سجّل خروج من Supabase
  setTimeout(async () => {
    await supabaseClient.auth.signOut();
  }, 500);
}

// ═══════════════ الرسالة الأنيقة ═══════════════
function showSessionReplacedModal() {
  // لو موجودة قبل كده، ما نكررهاش
  if (document.getElementById('sessionReplacedModal')) return;

  const modal = document.createElement('div');
  modal.id = 'sessionReplacedModal';
  modal.className = 'session-replaced-overlay';
  modal.innerHTML = `
    <div class="session-replaced-box">
      <div class="session-replaced-icon">
        <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="#d4af37" stroke-width="1.5">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        </svg>
      </div>
      <h2>⚠️ تم تسجيل خروجك</h2>
      <p>
        تم تسجيل الدخول إلى حسابك من <strong>جهاز آخر</strong>،
        وبالتالي تم إنهاء جلستك الحالية لأسباب أمنية.
      </p>
      <div class="session-replaced-info">
        <div class="info-row">
          <span>🕒 الوقت</span>
          <span>${new Date().toLocaleTimeString('ar-EG')}</span>
        </div>
        <div class="info-row">
          <span>🛡️ السبب</span>
          <span>دخول من جهاز آخر</span>
        </div>
      </div>
      <p class="session-replaced-hint">
        يمكنك تسجيل الدخول مرة أخرى، لكن سيتم إنهاء الجلسة على الجهاز الآخر.
      </p>
      <button onclick="window.location.href='login.html'" class="session-replaced-btn">
        🔐 تسجيل الدخول مرة أخرى
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  // أنيميشن الظهور
  requestAnimationFrame(() => modal.classList.add('show'));
}

// ═══════════════ إيقاف الجلسة عند إغلاق الصفحة ═══════════════
window.addEventListener('beforeunload', () => {
  if (sessionState.heartbeatTimer) clearInterval(sessionState.heartbeatTimer);
  if (sessionState.checkTimer) clearInterval(sessionState.checkTimer);
});