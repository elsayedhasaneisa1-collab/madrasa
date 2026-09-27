// ═══════════════════════════════════════════════════════════
// المصادقة + الجلسة الواحدة
// ═══════════════════════════════════════════════════════════

let currentUser = null;
let isAdmin = false;
let authMode = 'login';

function openAuth(mode) { authMode = mode; }
function closeAuth() {}
function toggleAuthMode() {}

async function handleAuth(e) {
  if (e) e.preventDefault();
}

// ═══════════════ تسجيل خروج (محسّن) ═══════════════
async function logout() {
  try {
    // 1) وقف الجلسة
    if (currentUser && typeof stopSession === 'function') {
      await stopSession(currentUser.id);
    }
    
    // 2) سجّل خروج من Supabase
    await supabaseClient.auth.signOut();
    
    // 3) امسح البيانات
    currentUser = null;
    isAdmin = false;
    
    // 4) اعرض رسالة
    showToast('✅ تم تسجيل الخروج');
    
    // 5) حدّث الواجهة
    onLogoutUI();
    
    // 6) روح للصفحة الرئيسية بعد ثانية
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 800);
    
  } catch (err) {
    console.error('خطأ في تسجيل الخروج:', err);
    // حتى لو فيه خطأ، سجّل خروج
    try { await supabaseClient.auth.signOut(); } catch (_) {}
    window.location.href = 'index.html';
  }
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    if (typeof startSession === 'function') {
      await startSession(currentUser.id);
    }
    await onLogin();
  }
}

async function onLogin() {
  const { data: adminRow } = await supabaseClient
    .from('admins').select('id').eq('id', currentUser.id).maybeSingle();

  isAdmin = !!adminRow;

  // جلب اسم الطالب
  if (!isAdmin) {
    const { data } = await supabaseClient
      .from('students').select('*').eq('id', currentUser.id).single();
    
    const studentName = document.getElementById('studentName');
    if (studentName) {
      studentName.textContent = data?.full_name || currentUser.email.split('@')[0];
    }
  }

  // ═══ تحديث الأزرار ═══
  const loginNavBtn = document.getElementById('loginNavBtn');
  const registerNavBtn = document.getElementById('registerNavBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminBtn = document.getElementById('adminBtn');

  // اخفي دخول + حساب جديد
  if (loginNavBtn) loginNavBtn.style.display = 'none';
  if (registerNavBtn) registerNavBtn.style.display = 'none';

  // اظهر خروج + لوحة الأستاذ (لو أدمن)
  if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';

  // افتح لوحة الأستاذ تلقائياً لو أدمن
  if (isAdmin) {
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 500);
  }
}

function onLogoutUI() {
  const loginNavBtn = document.getElementById('loginNavBtn');
  const registerNavBtn = document.getElementById('registerNavBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminBtn = document.getElementById('adminBtn');

  if (loginNavBtn) loginNavBtn.style.display = 'inline-flex';
  if (registerNavBtn) registerNavBtn.style.display = 'inline-flex';
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (adminBtn) adminBtn.style.display = 'none';

  const dashboard = document.getElementById('dashboard');
  if (dashboard) dashboard.classList.remove('active');
}