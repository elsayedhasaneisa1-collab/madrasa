// ═══════════════════════════════════════════════════════════
// التهيئة الرئيسية
// ═══════════════════════════════════════════════════════════

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

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    if (sessionState.isActive) return;
    currentUser = null;
    onLogoutUI();
  } else if (session?.user) {
    currentUser = session.user;
  }
});

(function initialProtection() {
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
    }
  });
})();

window.addEventListener('pageshow', async (event) => {
  if (event.persisted && currentUser) {
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

(async function init() {
  await loadCourses();
  await loadAnnouncements();
  await checkSession();

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale')
    .forEach(el => window._revealObserver.observe(el));
})();