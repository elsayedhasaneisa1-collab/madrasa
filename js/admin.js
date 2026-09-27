// ═══════════════════════════════════════════════════════════
// 👑 لوحة تحكم الأستاذ - النسخة الكاملة
// ═══════════════════════════════════════════════════════════

async function switchAdminTab(tab, el) {
  if (el) {
    document.querySelectorAll('#adminPanel .tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  }

  const content = document.getElementById('adminTabContent');
  if (!content) return;
  content.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

  if (tab === 'adminCourses') await renderAdminCourses(content);
  else if (tab === 'adminLessons') await renderAdminLessons(content);
  else if (tab === 'adminExams') await renderAdminExams(content);
  else if (tab === 'adminHomeworks') await renderAdminHomeworks(content);
  else if (tab === 'adminAnnouncements') await renderAdminAnnouncements(content);
  else if (tab === 'adminStudents') await renderAdminStudents(content);
}

async function renderAdminCourses(content) {
  const { data } = await supabaseClient
    .from('courses').select('*').order('created_at', { ascending: false });

  content.innerHTML = `
    <button class="btn" style="margin-bottom:20px" onclick="openCourseForm()">
      ➕ إضافة كورس جديد
    </button>
    <div>${(data || []).map(c => `
      <div class="item-row">
        <div class="item-info">
          <h4>📚 ${escapeHtml(c.title)}</h4>
          <p>
            <span class="timer-badge">${escapeHtml(c.grade || 'عام')}</span>
            <span class="timer-badge">💰 ${c.price} ج.م</span>
          </p>
        </div>
        <div class="item-actions">
          <button class="btn btn-outline" onclick='openCourseForm(${JSON.stringify(c).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn btn-outline" onclick="deleteCourse(${c.id})">🗑️</button>
        </div>
      </div>`).join('')}
    </div>`;
}

function openCourseForm(course = null) {
  const isEdit = !!course;
  openAdminModal(isEdit ? '✏️ تعديل كورس' : '➕ إضافة كورس', `
    <div class="form-group"><label>عنوان الكورس *</label>
      <input id="cfTitle" value="${escapeHtml(course?.title || '')}"></div>
    <div class="form-group"><label>الوصف</label>
      <textarea id="cfDesc" rows="3" style="width:100%;padding:12px;background:rgba(0,0,0,0.4);
        border:1px solid rgba(212,175,55,0.3);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical">${escapeHtml(course?.description || '')}</textarea></div>
    <div class="form-group"><label>السعر (ج.م)</label>
      <input id="cfPrice" type="number" value="${course?.price ?? 0}" min="0"></div>
    <div class="form-group"><label>الصف</label>
      <select id="cfGrade">
        <option value="">اختر</option>
        ${CONFIG.GRADES.map(g => `<option ${course?.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>🔗 رابط صورة الكورس</label>
      <input id="cfImage" value="${escapeHtml(course?.image_url || '')}" placeholder="https://..."></div>
    <button class="btn" onclick="saveCourse(${course?.id || 'null'})">💾 حفظ</button>
  `);
}

async function saveCourse(id) {
  const title = document.getElementById('cfTitle').value.trim();
  if (!title) { showToast('العنوان مطلوب', true); return; }

  const payload = {
    title,
    description: document.getElementById('cfDesc').value.trim(),
    price: parseFloat(document.getElementById('cfPrice').value) || 0,
    grade: document.getElementById('cfGrade').value,
    image_url: document.getElementById('cfImage').value.trim()
  };

  const btn = event.target;
  btn.disabled = true;

  try {
    let error;
    if (id) ({ error } = await supabaseClient.from('courses').update(payload).eq('id', id));
    else ({ error } = await supabaseClient.from('courses').insert(payload));
    if (error) throw error;

    showToast('✅ تم الحفظ');
    closeAdminModal();
    if (typeof loadCourses === 'function') await loadCourses();
    switchAdminTab('adminCourses');
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function deleteCourse(id) {
  if (!confirm('حذف الكورس وكل دروسه؟')) return;
  const { error } = await supabaseClient.from('courses').delete().eq('id', id);
  if (error) { showToast(error.message, true); return; }
  showToast('تم الحذف');
  if (typeof loadCourses === 'function') await loadCourses();
  switchAdminTab('adminCourses');
}

async function renderAdminLessons(content) {
  const { data: courses } = await supabaseClient.from('courses').select('id,title').order('title');

  content.innerHTML = `
    <button class="btn" style="margin-bottom:20px" onclick="openLessonForm()">➕ إضافة درس</button>
    <div id="lessonsList"></div>`;

  const list = document.getElementById('lessonsList');
  if (!courses?.length) {
    list.innerHTML = '<div class="empty-state">أضف كورساً أولاً</div>';
    return;
  }

  const { data: lessons } = await supabaseClient
    .from('lessons').select('*, courses(title)').order('course_id').order('order');

  if (!lessons?.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🎬</div>لا توجد دروس</div>';
    return;
  }

  list.innerHTML = lessons.map(l => `
    <div class="item-row">
      <div class="item-info">
        <h4>🎬 ${escapeHtml(l.title)}</h4>
        <p>
          <span class="timer-badge">📚 ${escapeHtml(l.courses?.title || '-')}</span>
          <span class="timer-badge">⏱ ${escapeHtml(l.duration || '-')}</span>
        </p>
      </div>
      <div class="item-actions">
        <button class="btn btn-outline" onclick='openLessonForm(${JSON.stringify(l).replace(/'/g, "&#39;")})'>✏️</button>
        <button class="btn btn-outline" onclick="deleteLesson(${l.id})">🗑️</button>
      </div>
    </div>`).join('');
}

async function openLessonForm(lesson = null) {
  const { data: courses } = await supabaseClient.from('courses').select('id,title').order('title');
  const isEdit = !!lesson;

  openAdminModal(isEdit ? '✏️ تعديل درس' : '➕ إضافة درس', `
    <div class="form-group"><label>الكورس *</label>
      <select id="lfCourse">
        ${(courses || []).map(c => `<option value="${c.id}" ${lesson?.course_id === c.id ? 'selected' : ''}>${escapeHtml(c.title)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>عنوان الدرس *</label>
      <input id="lfTitle" value="${escapeHtml(lesson?.title || '')}"></div>
    <div class="form-group"><label>المدة</label>
      <input id="lfDuration" value="${escapeHtml(lesson?.duration || '')}" placeholder="25 دقيقة"></div>
    <div class="form-group"><label>الترتيب</label>
      <input id="lfOrder" type="number" value="${lesson?.order ?? 0}" min="0"></div>
    <div class="form-group"><label>🎬 رابط الفيديو *</label>
      <input id="lfVideo" value="${escapeHtml(lesson?.video_url || '')}" placeholder="https://youtube.com/..."></div>
    <button class="btn" onclick="saveLesson(${lesson?.id || 'null'})">💾 حفظ</button>
  `);
}

async function saveLesson(id) {
  const title = document.getElementById('lfTitle').value.trim();
  const courseId = document.getElementById('lfCourse').value;
  if (!title || !courseId) { showToast('العنوان والكورس مطلوبان', true); return; }

  const payload = {
    title,
    course_id: parseInt(courseId),
    duration: document.getElementById('lfDuration').value.trim(),
    order: parseInt(document.getElementById('lfOrder').value) || 0,
    video_url: document.getElementById('lfVideo').value.trim()
  };

  const btn = event.target;
  btn.disabled = true;

  try {
    let error;
    if (id) ({ error } = await supabaseClient.from('lessons').update(payload).eq('id', id));
    else ({ error } = await supabaseClient.from('lessons').insert(payload));
    if (error) throw error;

    showToast('✅ تم الحفظ');
    closeAdminModal();
    switchAdminTab('adminLessons');
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function deleteLesson(id) {
  if (!confirm('حذف الدرس؟')) return;
  const { error } = await supabaseClient.from('lessons').delete().eq('id', id);
  if (error) { showToast(error.message, true); return; }
  showToast('تم الحذف');
  switchAdminTab('adminLessons');
}

async function renderAdminExams(content) {
  await cleanupExpiredExams();

  const { data: courses } = await supabaseClient.from('courses').select('id,title').order('title');

  content.innerHTML = `
    <button class="btn" style="margin-bottom:20px" onclick="openExamForm()">➕ إضافة امتحان</button>
    <div id="examsList"></div>`;

  const list = document.getElementById('examsList');
  if (!courses?.length) {
    list.innerHTML = '<div class="empty-state">أضف كورساً أولاً</div>';
    return;
  }

  const { data: exams } = await supabaseClient
    .from('exams').select('*, courses(title)').order('created_at', { ascending: false });

  if (!exams?.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📝</div>لا توجد امتحانات</div>';
    return;
  }

  const now = new Date();

  list.innerHTML = exams.map(e => {
    const expiresAt = e.expires_at ? new Date(e.expires_at) : null;
    const isExpired = expiresAt && expiresAt < now;
    const remaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))) : 0;

    return `
      <div class="item-row">
        <div class="item-info">
          <h4>📝 ${escapeHtml(e.title)}</h4>
          <p>
            <span class="timer-badge">📚 ${escapeHtml(e.courses?.title || '-')}</span>
            <span class="timer-badge">⏱ ${e.duration || 0} دقيقة</span>
            ${expiresAt ? `<span class="timer-badge ${isExpired ? 'danger' : 'success'}">
              ${isExpired ? '❌ منتهي' : `⏳ ${remaining} يوم`}
            </span>` : ''}
          </p>
        </div>
        <div class="item-actions">
          <button class="btn btn-outline" onclick='openExamForm(${JSON.stringify(e).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn btn-outline" onclick="deleteExam(${e.id})">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function openExamForm(exam = null) {
  const isEdit = !!exam;

  openAdminModal(isEdit ? '✏️ تعديل امتحان' : '➕ إضافة امتحان', `
    <div class="form-group"><label>عنوان الامتحان *</label>
      <input id="efTitle" value="${escapeHtml(exam?.title || '')}"></div>
    <div class="form-group"><label>الكورس *</label>
      <select id="efCourse"></select></div>
    <div class="form-group"><label>⏱ مدة الامتحان (دقائق) *</label>
      <input id="efDuration" type="number" value="${exam?.duration ?? 30}" min="1"></div>
    <div class="form-group"><label>⏳ مدة السريان (أيام) *</label>
      <input id="efExpiryDays" type="number" value="7" min="1"></div>
    <div class="form-group"><label>📝 تعليمات</label>
      <textarea id="efInstructions" rows="3" style="width:100%;padding:12px;background:rgba(0,0,0,0.4);
        border:1px solid rgba(212,175,55,0.3);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical">${escapeHtml(exam?.instructions || '')}</textarea></div>
    <button class="btn" onclick="saveExam(${exam?.id || 'null'})">💾 حفظ</button>
  `);

  (async () => {
    const { data: courses } = await supabaseClient.from('courses').select('id,title').order('title');
    const select = document.getElementById('efCourse');
    if (select) {
      select.innerHTML = (courses || []).map(c =>
        `<option value="${c.id}" ${exam?.course_id === c.id ? 'selected' : ''}>${escapeHtml(c.title)}</option>`
      ).join('');
    }
  })();
}

async function saveExam(id) {
  const title = document.getElementById('efTitle').value.trim();
  const courseId = document.getElementById('efCourse').value;
  const duration = parseInt(document.getElementById('efDuration').value) || 30;
  const expiryDays = parseInt(document.getElementById('efExpiryDays').value) || 7;
  const instructions = document.getElementById('efInstructions').value.trim();

  if (!title || !courseId) { showToast('العنوان والكورس مطلوبان', true); return; }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const payload = {
    title,
    course_id: parseInt(courseId),
    duration: duration,
    expires_at: expiresAt.toISOString(),
    instructions: instructions
  };

  const btn = event.target;
  btn.disabled = true;

  try {
    let error;
    if (id) ({ error } = await supabaseClient.from('exams').update(payload).eq('id', id));
    else ({ error } = await supabaseClient.from('exams').insert(payload));
    if (error) throw error;

    showToast('✅ تم حفظ الامتحان');
    closeAdminModal();
    switchAdminTab('adminExams');
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function deleteExam(id) {
  if (!confirm('حذف الامتحان؟')) return;
  const { error } = await supabaseClient.from('exams').delete().eq('id', id);
  if (error) { showToast(error.message, true); return; }
  showToast('تم الحذف');
  switchAdminTab('adminExams');
}

async function cleanupExpiredExams() {
  const now = new Date().toISOString();
  try {
    await supabaseClient.from('exams').delete().lt('expires_at', now);
  } catch (err) {
    console.warn('خطأ في التنظيف:', err);
  }
}

setInterval(cleanupExpiredExams, 5 * 60 * 1000);

async function renderAdminHomeworks(content) {
  const { data: courses } = await supabaseClient.from('courses').select('id,title').order('title');

  content.innerHTML = `
    <button class="btn" style="margin-bottom:20px" onclick="openHomeworkForm()">➕ إضافة واجب</button>
    <div id="homeworksList"></div>`;

  const list = document.getElementById('homeworksList');
  if (!courses?.length) {
    list.innerHTML = '<div class="empty-state">أضف كورساً أولاً</div>';
    return;
  }

  const { data: hws } = await supabaseClient
    .from('homeworks').select('*, courses(title)').order('created_at', { ascending: false });

  if (!hws?.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📓</div>لا توجد واجبات</div>';
    return;
  }

  const now = new Date();

  list.innerHTML = hws.map(h => {
    const dueDate = h.due_date ? new Date(h.due_date) : null;
    const isOverdue = dueDate && dueDate < now;

    return `
      <div class="item-row">
        <div class="item-info">
          <h4>📓 ${escapeHtml(h.title)}</h4>
          <p>
            <span class="timer-badge">📚 ${escapeHtml(h.courses?.title || '-')}</span>
            ${dueDate ? `<span class="timer-badge ${isOverdue ? 'danger' : 'success'}">
              ${isOverdue ? '❌ منتهي' : `📅 ${dueDate.toLocaleDateString('ar-EG')}`}
            </span>` : ''}
          </p>
        </div>
        <div class="item-actions">
          <button class="btn btn-outline" onclick='openHomeworkForm(${JSON.stringify(h).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn btn-outline" onclick="deleteHomework(${h.id})">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

function openHomeworkForm(hw = null) {
  const isEdit = !!hw;

  openAdminModal(isEdit ? '✏️ تعديل واجب' : '➕ إضافة واجب', `
    <div class="form-group"><label>عنوان الواجب *</label>
      <input id="hfTitle" value="${escapeHtml(hw?.title || '')}"></div>
    <div class="form-group"><label>الكورس *</label>
      <select id="hfCourse"></select></div>
    <div class="form-group"><label>📅 تاريخ التسليم</label>
      <input id="hfDueDate" type="datetime-local" value="${hw?.due_date ? new Date(hw.due_date).toISOString().slice(0, 16) : ''}"></div>
    <div class="form-group"><label>📝 تفاصيل الواجب</label>
      <textarea id="hfDescription" rows="4" style="width:100%;padding:12px;background:rgba(0,0,0,0.4);
        border:1px solid rgba(212,175,55,0.3);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical">${escapeHtml(hw?.description || '')}</textarea></div>
    <div class="form-group"><label>🔗 رابط إضافي</label>
      <input id="hfLink" value="${escapeHtml(hw?.link || '')}" placeholder="https://..."></div>
    <button class="btn" onclick="saveHomework(${hw?.id || 'null'})">💾 حفظ</button>
  `);

  (async () => {
    const { data: courses } = await supabaseClient.from('courses').select('id,title').order('title');
    const select = document.getElementById('hfCourse');
    if (select) {
      select.innerHTML = (courses || []).map(c =>
        `<option value="${c.id}" ${hw?.course_id === c.id ? 'selected' : ''}>${escapeHtml(c.title)}</option>`
      ).join('');
    }
  })();
}

async function saveHomework(id) {
  const title = document.getElementById('hfTitle').value.trim();
  const courseId = document.getElementById('hfCourse').value;
  const dueDate = document.getElementById('hfDueDate').value;
  const description = document.getElementById('hfDescription').value.trim();
  const link = document.getElementById('hfLink').value.trim();

  if (!title || !courseId) { showToast('العنوان والكورس مطلوبان', true); return; }

  const payload = {
    title,
    course_id: parseInt(courseId),
    due_date: dueDate ? new Date(dueDate).toISOString() : null,
    description: description,
    link: link
  };

  const btn = event.target;
  btn.disabled = true;

  try {
    let error;
    if (id) ({ error } = await supabaseClient.from('homeworks').update(payload).eq('id', id));
    else ({ error } = await supabaseClient.from('homeworks').insert(payload));
    if (error) throw error;

    showToast('✅ تم حفظ الواجب');
    closeAdminModal();
    switchAdminTab('adminHomeworks');
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function deleteHomework(id) {
  if (!confirm('حذف الواجب؟')) return;
  const { error } = await supabaseClient.from('homeworks').delete().eq('id', id);
  if (error) { showToast(error.message, true); return; }
  showToast('تم الحذف');
  switchAdminTab('adminHomeworks');
}

async function renderAdminAnnouncements(content) {
  const { data } = await supabaseClient
    .from('announcements').select('*').order('created_at', { ascending: false });

  content.innerHTML = `
    <button class="btn" style="margin-bottom:20px" onclick="openAnnouncementForm()">➕ إضافة إعلان</button>
    <div>${(data || []).map(a => `
      <div class="item-row">
        <div class="item-info">
          <h4>📢 ${escapeHtml(a.title)}</h4>
          <p>${escapeHtml(a.content || '')}</p>
          <p style="margin-top:6px;color:#666;font-size:11px">
            📅 ${new Date(a.created_at).toLocaleDateString('ar-EG')}
          </p>
        </div>
        <div class="item-actions">
          <button class="btn btn-outline" onclick='openAnnouncementForm(${JSON.stringify(a).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn btn-outline" onclick="deleteAnnouncement(${a.id})">🗑️</button>
        </div>
      </div>`).join('')}
    </div>`;
}

function openAnnouncementForm(a = null) {
  const isEdit = !!a;
  openAdminModal(isEdit ? '✏️ تعديل إعلان' : '➕ إعلان جديد', `
    <div class="form-group"><label>العنوان *</label>
      <input id="afTitle" value="${escapeHtml(a?.title || '')}"></div>
    <div class="form-group"><label>المحتوى</label>
      <textarea id="afContent" rows="5" style="width:100%;padding:12px;background:rgba(0,0,0,0.4);
        border:1px solid rgba(212,175,55,0.3);border-radius:8px;color:var(--text);font-family:inherit;resize:vertical">${escapeHtml(a?.content || '')}</textarea></div>
    <button class="btn" onclick="saveAnnouncement(${a?.id || 'null'})">💾 حفظ</button>
  `);
}

async function saveAnnouncement(id) {
  const payload = {
    title: document.getElementById('afTitle').value.trim(),
    content: document.getElementById('afContent').value.trim()
  };
  if (!payload.title) { showToast('العنوان مطلوب', true); return; }

  let error;
  if (id) ({ error } = await supabaseClient.from('announcements').update(payload).eq('id', id));
  else ({ error } = await supabaseClient.from('announcements').insert(payload));

  if (error) { showToast(error.message, true); return; }
  showToast('✅ تم الحفظ');
  closeAdminModal();
  if (typeof loadAnnouncements === 'function') await loadAnnouncements();
  switchAdminTab('adminAnnouncements');
}

async function deleteAnnouncement(id) {
  if (!confirm('حذف الإعلان؟')) return;
  const { error } = await supabaseClient.from('announcements').delete().eq('id', id);
  if (error) { showToast(error.message, true); return; }
  showToast('تم الحذف');
  if (typeof loadAnnouncements === 'function') await loadAnnouncements();
  switchAdminTab('adminAnnouncements');
}

async function renderAdminStudents(content) {
  const { data: enr } = await supabaseClient
    .from('enrollments')
    .select('*, courses(title), students:student_id(full_name, phone, parent_phone, gender, grade)')
    .order('created_at', { ascending: false });

  if (!enr?.length) {
    content.innerHTML = '<div class="empty-state"><div class="icon">👥</div>لا توجد اشتراكات</div>';
    return;
  }

  content.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;background:var(--dark-2);border-radius:12px;overflow:hidden">
        <thead style="background:rgba(212,175,55,0.15);color:var(--gold)">
          <tr>
            <th style="padding:12px;text-align:right">الطالب</th>
            <th style="padding:12px;text-align:right">النوع</th>
            <th style="padding:12px;text-align:right">الهاتف</th>
            <th style="padding:12px;text-align:right">ولي الأمر</th>
            <th style="padding:12px;text-align:right">الصف</th>
            <th style="padding:12px;text-align:right">الكورس</th>
            <th style="padding:12px;text-align:right">الحالة</th>
            <th style="padding:12px;text-align:right">إجراء</th>
          </tr>
        </thead>
        <tbody>
          ${enr.map(e => `
            <tr style="border-bottom:1px solid rgba(212,175,55,0.1)">
              <td style="padding:12px">${escapeHtml(e.students?.full_name || '-')}</td>
              <td style="padding:12px">${e.students?.gender === 'male' ? '👦' : e.students?.gender === 'female' ? '👧' : '-'}</td>
              <td style="padding:12px">${escapeHtml(e.students?.phone || '-')}</td>
              <td style="padding:12px">${escapeHtml(e.students?.parent_phone || '-')}</td>
              <td style="padding:12px">${escapeHtml(e.students?.grade || '-')}</td>
              <td style="padding:12px">${escapeHtml(e.courses?.title || '-')}</td>
              <td style="padding:12px">${
                e.status === 'approved' ? '✅ مفعّل' :
                e.status === 'rejected' ? '❌ مرفوض' : '⏳ انتظار'
              }</td>
              <td style="padding:12px;display:flex;gap:6px;flex-wrap:wrap">
                ${e.status !== 'approved' ? `<button class="btn" style="padding:6px 12px;font-size:12px" onclick="updateEnrollment(${e.id},'approved')">✅</button>` : ''}
                ${e.status !== 'rejected' ? `<button class="btn btn-outline" style="padding:6px 12px;font-size:12px" onclick="updateEnrollment(${e.id},'rejected')">❌</button>` : ''}
                <button class="btn btn-outline" style="padding:6px 12px;font-size:12px" onclick="deleteEnrollment(${e.id})">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function updateEnrollment(id, status) {
  const { error } = await supabaseClient.from('enrollments').update({ status }).eq('id', id);
  if (error) { showToast(error.message, true); return; }
  showToast('تم التحديث');
  switchAdminTab('adminStudents');
}

async function deleteEnrollment(id) {
  if (!confirm('حذف الاشتراك؟')) return;
  const { error } = await supabaseClient.from('enrollments').delete().eq('id', id);
  if (error) { showToast(error.message, true); return; }
  showToast('تم الحذف');
  switchAdminTab('adminStudents');
}

function openAdminModal(title, bodyHtml) {
  const titleEl = document.getElementById('adminModalTitle');
  const bodyEl = document.getElementById('adminModalBody');
  const modal = document.getElementById('adminModal');
  if (!titleEl || !bodyEl || !modal) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  modal.classList.add('active');
}

function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.classList.remove('active');
}