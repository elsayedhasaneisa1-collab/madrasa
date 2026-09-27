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
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: { user } } = await supabaseClient.auth.getUser();
      await startSession(user.id);

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

async function logout() {
  if (currentUser) {
    await stopSession(currentUser.id);
  }
  await supabaseClient.auth.signOut();
  showToast('تم تسجيل الخروج');
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await startSession(currentUser.id);
    await onLogin();
  }
}

async function onLogin() {
  const { data: adminRow } = await supabaseClient
    .from('admins')
    .select('id')
    .eq('id', currentUser.id)
    .maybeSingle();

  isAdmin = !!adminRow;

  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const adminBtn = document.getElementById('adminBtn');

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

  if (loginBtn) loginBtn.style.display = 'none';
  if (registerBtn) registerBtn.style.display = 'none';
  if (adminBtn) adminBtn.style.display = isAdmin ? 'inline-block' : 'none';

  let logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
      logoutBtn = document.createElement('button');
      logoutBtn.id = 'logoutBtn';
      logoutBtn.className = 'btn btn-outline menu-btn';
      logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> خروج';
      logoutBtn.onclick = logout;
      navLinks.appendChild(logoutBtn);
    }
  }
  if (logoutBtn) logoutBtn.style.display = 'inline-flex';

  ['home', 'courses', 'announcements', 'about', 'access', 'features'].forEach(id => {
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

function onLogoutUI() {
  isAdmin = false;
  currentUser = null;

  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const adminBtn = document.getElementById('adminBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (loginBtn) {
    loginBtn.style.display = 'inline-flex';
    loginBtn.onclick = () => location.href = 'login.html';
  }
  if (registerBtn) registerBtn.style.display = 'inline-flex';
  if (adminBtn) adminBtn.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'none';

  ['home', 'courses', 'announcements', 'about', 'access', 'features'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });

  const dashboard = document.getElementById('dashboard');
  const adminPanel = document.getElementById('adminPanel');

  if (dashboard) dashboard.classList.remove('active');
  if (adminPanel) adminPanel.style.display = 'none';
}