// ═══════════════════════════════════════════════════════════
// المصادقة + الجلسة الواحدة
// ═══════════════════════════════════════════════════════════

let currentUser = null;
let isAdmin = false;
let authMode = 'login';

function openAuth(mode) {
  authMode = mode;
  updateAuthUI();
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.add('active');
}

function closeAuth() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
  const form = document.getElementById('authForm');
  if (form) form.reset();
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  updateAuthUI();
}

function updateAuthUI() {
  const isSignup = authMode === 'signup';
  const title = document.getElementById('authTitle');
  const submit = document.getElementById('authSubmit');
  if (!title || !submit) return;

  title.textContent = isSignup ? 'إنشاء حساب جديد' : 'تسجيل الدخول';
  submit.textContent = isSignup ? 'إنشاء الحساب' : 'دخول';

  ['nameGroup', 'phoneGroup', 'gradeGroup'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isSignup ? 'block' : 'none';
  });

  const switchText = document.getElementById('switchText');
  const switchBtn = document.getElementById('switchBtn');
  if (switchText) switchText.textContent = isSignup ? 'لديك حساب؟' : 'ليس لديك حساب؟';
  if (switchBtn) switchBtn.textContent = isSignup ? 'تسجيل الدخول' : 'إنشاء حساب';
}

// ═══════════════ معالجة الدخول ═══════════════
async function handleAuth(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('authSubmit');

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'جاري المعالجة...';

  try {
    if (authMode === 'signup') {
      const fullName = document.getElementById('fullName').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const grade = document.getElementById('grade').value;

      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        const fingerprint = getDeviceFingerprint();
        await supabaseClient.from('students').insert({
          id: data.user.id,
          full_name: fullName,
          phone: phone,
          grade: grade,
          device_fingerprint: fingerprint
        });
      }

      showToast('✅ تم إنشاء الحساب! تحقق من بريدك');
      closeAuth();
    } else {
      // ═══ تسجيل دخول ═══
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // ✅ ابدأ الجلسة الواحدة
      const { data: { user } } = await supabaseClient.auth.getUser();
      await startSession(user.id);

      // حدّث بيانات الدخول
      const fingerprint = getDeviceFingerprint();
      await supabaseClient.from('students')
        .update({
          last_login: new Date().toISOString(),
          device_fingerprint: fingerprint
        })
        .eq('id', user.id);

      showToast('✅ تم تسجيل الدخول');
      closeAuth();
    }
  } catch (err) {
    showToast(err.message || 'حدث خطأ', true);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ═══════════════ تسجيل الخروج ═══════════════
async function logout() {
  if (currentUser) {
    await stopSession(currentUser.id);
  }
  await supabaseClient.auth.signOut();
  showToast('تم تسجيل الخروج');
}

// ═══════════════ التحقق من الجلسة ═══════════════
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    currentUser = session.user;

    // ✅ هل جلسة المستخدم الحالية موجودة؟
    const { data: sessionRow } = await supabaseClient
      .from('user_sessions')
      .select('session_id')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (!sessionRow) {
      // جلسة جديدة (مثلاً بعد Refresh للصفحة)
      await startSession(currentUser.id);
    } else {
      // جلسة قديمة — لازم نستبدلها
      await startSession(currentUser.id);
    }

    await onLogin();
  }
}

// ═══════════════ بعد تسجيل الدخول ═══════════════
async function onLogin() {
  const { data: adminRow } = await supabaseClient
    .from('admins')
    .select('id')
    .eq('id', currentUser.id)
    .maybeSingle();

  isAdmin = !!adminRow;

  const loginBtn = document.getElementById('loginBtn');
  const adminBtn = document.getElementById('adminBtn');

  if (loginBtn) {
    loginBtn.textContent = 'خروج';
    loginBtn.onclick = logout;
  }
  if (adminBtn) {
    adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
  }

  if (!isAdmin) {
    const { data } = await supabaseClient
      .from('students')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    const studentName = document.getElementById('studentName');
    if (studentName) {
      studentName.textContent = data?.full_name || currentUser.email.split('@')[0];
    }
  }

  ['home', 'courses', 'announcements'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const dashboard = document.getElementById('dashboard');
  const adminPanel = document.getElementById('adminPanel');

  if (dashboard) dashboard.classList.toggle('active', !isAdmin);
  if (adminPanel) adminPanel.style.display = 'none';

  if (!isAdmin) {
    switchTab('myCourses');
    scrollToSection('dashboard');
  }
}

// ═══════════════ عند تسجيل الخروج ═══════════════
function onLogoutUI() {
  isAdmin = false;
  currentUser = null;

  const loginBtn = document.getElementById('loginBtn');
  const adminBtn = document.getElementById('adminBtn');

  if (loginBtn) {
    loginBtn.textContent = 'تسجيل الدخول';
    loginBtn.onclick = () => openAuth('login');
  }
  if (adminBtn) adminBtn.style.display = 'none';

  ['home', 'courses', 'announcements'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });

  const dashboard = document.getElementById('dashboard');
  const adminPanel = document.getElementById('adminPanel');

  if (dashboard) dashboard.classList.remove('active');
  if (adminPanel) adminPanel.style.display = 'none';
}