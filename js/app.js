// ═══════════════════════════════════════════════════════════
// التهيئة الرئيسية
// ═══════════════════════════════════════════════════════════

// ═══════════════ Observer للأنيميشن ═══════════════
window._revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('active');
    }
  });
}, {
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px'
});

// ═══════════════ مستمع تغيّر حالة المصادقة ═══════════════
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    // لو الجلسة اتغيرت من مكان تاني، متعملش UI reset
    if (sessionState.isActive) return;

    currentUser = null;
    onLogoutUI();
  } else if (session?.user) {
    currentUser = session.user;
  }
});

// ═══════════════ حماية عامة ═══════════════
(function initialProtection() {
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
    }
  });
})();

// ═══════════════ كشف رجوع الصفحة من Cache ═══════════════
window.addEventListener('pageshow', async (event) => {
  if (event.persisted && currentUser) {
    // الصفحة رجعت من cache — تأكد إن الجلسة لسه موجودة
    const { data } = await supabaseClient
      .from('user_sessions')
      .select('session_id')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (!data || data.session_id !== sessionState.sessionId) {
      handleSessionReplaced();
    }
  }
});

// ═══════════════ التهيئة ═══════════════
(async function init() {
  await loadCourses();
  await loadAnnouncements();
  await checkSession();

  // راقب كل عناصر الأنيميشن
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale')
    .forEach(el => window._revealObserver.observe(el));
})();