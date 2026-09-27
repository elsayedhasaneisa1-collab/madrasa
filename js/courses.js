// ═══════════════════════════════════════════════════════════
// الكورسات + الدروس + لوحة الطالب
// ═══════════════════════════════════════════════════════════

let allCourses = [];

async function loadCourses() {
  const grid = document.getElementById('coursesGrid');
  if (!grid) return;

  const { data, error } = await supabaseClient
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div>خطأ في التحميل</div>';
    return;
  }

  allCourses = data || [];

  if (!data?.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">📚</div>لا توجد كورسات</div>';
    return;
  }

  grid.innerHTML = data.map(renderCourseCard).join('');
}

function renderCourseCard(c) {
  return `
    <div class="card reveal">
      <div class="card-img">
        ${c.image_url ? `<img src="${escapeHtml(c.image_url)}" alt="" onerror="this.style.display='none'">` : '📖'}
      </div>
      <div class="card-body">
        <span class="card-grade">${escapeHtml(c.grade || 'عام')}</span>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description || '')}</p>
        <div class="card-footer">
          <div class="price">${c.price} <span>ج.م</span></div>
          <button class="btn" onclick="enroll(${c.id})">اشترك الآن</button>
        </div>
      </div>
    </div>`;
}

async function loadAnnouncements() {
  const list = document.getElementById('announcementsList');
  if (!list) return;

  const { data } = await supabaseClient
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data?.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📢</div>لا توجد إعلانات</div>';
    return;
  }

  list.innerHTML = data.map(a => `
    <div class="announcement reveal">
      <h4>${escapeHtml(a.title)}</h4>
      <p>${escapeHtml(a.content || '')}</p>
      <div class="date">${new Date(a.created_at).toLocaleDateString('ar-EG')}</div>
    </div>
  `).join('');

  document.querySelectorAll('.reveal').forEach(el => {
    if (window._revealObserver) window._revealObserver.observe(el);
  });
}

async function enroll(courseId) {
  if (!currentUser) {
    showToast('سجّل الدخول أولاً', true);
    setTimeout(() => location.href = 'login.html', 800);
    return;
  }

  const { error } = await supabaseClient.from('enrollments').insert({
    student_id: currentUser.id,
    course_id: courseId,
    status: 'pending'
  });

  if (error) {
    showToast(error.code === '23505' ? 'مشترك بالفعل' : error.message, true);
    return;
  }

  showToast('✅ تم إرسال طلب الاشتراك');
}

async function switchTab(tab, el) {
  if (el) {
    document.querySelectorAll('#dashboard .tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  }

  const content = document.getElementById('tabContent');
  if (!content) return;

  content.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

  if (tab === 'myCourses') await renderMyCourses(content);
  else if (tab === 'allCourses') renderAllCourses(content);
  else if (tab === 'profile') await renderProfile(content);
}

async function renderMyCourses(content) {
  const { data } = await supabaseClient
    .from('enrollments')
    .select('*, courses(*)')
    .eq('student_id', currentUser.id);

  if (!data?.length) {
    content.innerHTML = '<div class="empty-state"><div class="icon">📚</div>لم تشترك في أي كورس</div>';
    return;
  }

  content.innerHTML = '<div class="grid">' + data.map(e => {
    const c = e.courses;
    if (!c) return '';
    return `
      <div class="card">
        <div class="card-img">${c.image_url ? `<img src="${escapeHtml(c.image_url)}">` : '📖'}</div>
        <div class="card-body">
          <span class="card-grade">${
            e.status === 'approved' ? '✅ مفعّل' :
            e.status === 'rejected' ? '❌ مرفوض' : '⏳ قيد المراجعة'
          }</span>
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.description || '')}</p>
          ${e.status === 'approved'
            ? `<button class="btn" onclick="viewCourseLessons(${c.id})">🎬 مشاهدة الدروس</button>`
            : ''}
        </div>
      </div>`;
  }).join('') + '</div>';
}

function renderAllCourses(content) {
  content.innerHTML = '<div class="grid">' + allCourses.map(renderCourseCard).join('') + '</div>';
}

async function renderProfile(content) {
  const { data } = await supabaseClient
    .from('students')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  content.innerHTML = `
    <div class="dash-header">
      <h2 style="margin-bottom:15px">بياناتي</h2>
      <p><strong style="color:var(--gold)">البريد:</strong> ${escapeHtml(currentUser.email)}</p>
      <p style="margin-top:8px"><strong style="color:var(--gold)">الاسم:</strong> ${escapeHtml(data?.full_name || '-')}</p>
      <p style="margin-top:8px"><strong style="color:var(--gold)">النوع:</strong> ${data?.gender === 'male' ? '👦 طالب' : data?.gender === 'female' ? '👧 طالبة' : '-'}</p>
      <p style="margin-top:8px"><strong style="color:var(--gold)">الهاتف:</strong> ${escapeHtml(data?.phone || '-')}</p>
      <p style="margin-top:8px"><strong style="color:var(--gold)">ولي الأمر:</strong> ${escapeHtml(data?.parent_phone || '-')}</p>
      <p style="margin-top:8px"><strong style="color:var(--gold)">الصف:</strong> ${escapeHtml(data?.grade || '-')}</p>
    </div>`;
}

async function viewCourseLessons(courseId) {
  const { data } = await supabaseClient
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('order');

  const c = allCourses.find(x => x.id === courseId);
  const content = document.getElementById('tabContent');

  if (!data?.length) {
    content.innerHTML = `
      <div class="dash-header"><h2>🎬 ${escapeHtml(c?.title || '')}</h2></div>
      <div class="empty-state"><div class="icon">🎬</div>لا توجد دروس بعد</div>
      <button class="btn btn-outline" onclick="switchTab('myCourses')">رجوع</button>`;
    return;
  }

  content.innerHTML = `
    <div class="dash-header"><h2>🎬 ${escapeHtml(c?.title || '')}</h2></div>
    <div style="display:grid;gap:12px">
      ${data.map((l, i) => `
        <div class="lesson-item" onclick="playLesson(${l.id})"
          style="cursor:pointer;padding:18px;
          background:linear-gradient(145deg,var(--dark-2),var(--dark-3));
          border:1px solid rgba(212,175,55,0.2);border-radius:12px;transition:0.3s">
          <h4 style="color:var(--gold);margin-bottom:6px">
            الدرس ${i+1}: ${escapeHtml(l.title)}
          </h4>
          <p style="color:#888;font-size:13px">⏱ ${escapeHtml(l.duration || 'غير محدد')}</p>
        </div>
      `).join('')}
    </div>
    <button class="btn btn-outline" style="margin-top:15px" onclick="switchTab('myCourses')">رجوع</button>
  `;

  window._lessons = data;
}

async function playLesson(lessonId) {
  const l = window._lessons?.find(x => x.id === lessonId);
  if (!l) return;

  const { data: student } = await supabaseClient
    .from('students')
    .select('full_name')
    .eq('id', currentUser.id)
    .single();

  openSecurePlayer(l, student?.full_name || 'طالب', currentUser.id);
}