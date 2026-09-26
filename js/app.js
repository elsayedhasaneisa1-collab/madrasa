// ═══════════════════════════════════════════════════════════
// التهيئة الرئيسية
// ═══════════════════════════════════════════════════════════

// مستمع تغيّر حالة المصادقة
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) {
    currentUser = null;
    onLogoutUI();
  } else if (session?.user) {
    currentUser = session.user;
  }
});

// حماية عامة
(function initialProtection() {
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
    }
  });
})();

// التهيئة
(async function init() {
  await loadCourses();
  await loadAnnouncements();
  await checkSession();
})();