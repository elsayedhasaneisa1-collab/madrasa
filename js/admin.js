// ═══════════════════════════════════════════════════════════
// 👑 لوحة تحكم الأستاذ
// ═══════════════════════════════════════════════════════════

function openAdminPanel() {
  ['home', 'courses', 'announcements'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const dashboard = document.getElementById('dashboard');
  const adminPanel = document.getElementById('adminPanel');

  if (dashboard) dashboard.classList.remove('active');
  if (adminPanel) adminPanel.style.display = 'block';

  scrollToSection('adminPanel');
  switchAdminTab('adminCourses');
}

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
  else if (tab === 'adminAnnouncements') await renderAdminAnnouncements(content);
  else if (tab === 'adminStudents') await renderAdminStudents(content);
}

// ───────────── الكورسات ─────────────
async function renderAdminCourses(content) {
  const { data } = await supabaseClient
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  content.innerHTML = `
    <button class="btn" style="margin-bottom:20px" onclick="openCourseForm()">
      ➕ إضافة كورس جديد
    </button>
    <div class="grid">${(data || []).map(c => `
      <div class="card">
        <div class="card-img">${c.image_url ? `<img src="${escapeHtml(c.image_url)}">` : '📖'}</div>
        <div class="card-body">
          <span class="card-grade">${escapeHtml(c.grade || 'عام')}</span>
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.description || '')}</p>
          <div class="card-footer">
            <div class="price">${c.price} <span>ج.م</span></div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-outline" onclick='openCourseForm(${JSON.stringify(c).replace(/'/g, "&#39;")})'>✏️</button>
              <button class="btn btn-outline" onclick="deleteCourse(${c.id})">🗑️</button>
            </div>
          </div>
        </div>
      </div>`).join('')}
    </div>`;
}

function openCourseForm(course = null) {
  const isEdit = !!course;
  openAdminModal(isEdit ? '✏️ تعديل كورس' : '➕ إضافة كورس', `
    <div class="form-group"><label>عنوان الكورس</label>
      <input id="cfTitle" value="${escapeHtml(course?.title || '')}"></div>
    <div class="form-group"><label>الوصف</label>
      <input id="cfDesc" value="${escapeHtml(course?.description || '')}"></div>
    <div class="form-group"><label>السعر</label>
      <input id="cfPrice" type="number" value="${course?.price ?? 0}"></div>
    <div class="form-group"><label>الصف</label>
      <select id="cfGrade">
        <option value="">اختر</option>
        ${CONFIG.GRADES.map(g =>
          `<option ${course?.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>صورة الكورس</label>
      <input type="file" id="cfImage" accept="image/*">
      <small style="color:#888">اتركها فارغة للإبقاء على الصورة الحالية</small></div>
    <button class="btn" onclick="saveCourse(${course?.id || 'null'})">حفظ</button>
  `);
}

async function saveCourse(id) {
  const title = document.getElementById('cfTitle').value.trim();
  if (!title) { showToast('العنوان مطلوب', true); return; }

  const payload = {
    title,
    description: document.getElementById('cfDesc').value.trim(),
    price: parseFloat(document.getElementById('cfPrice').value) || 0,
    grade: document.getElementById('cfGrade').value
  };

  const file = document.getElementById('cfImage').files[0];
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'جاري الحفظ...';

  try {
    if (file) {
      const path = `course_${Date.now()}_${file.name}`;
      const { error: upErr } = await supabaseClient.storage.from('images').upload(path, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabaseClient.storage.from('images').getPublicUrl(path);
      payload.image_url = urlData.publicUrl;
    }

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('courses').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('courses').insert(payload));
    }
    if (error) throw error;

    showToast('✅ تم الحفظ');
    closeAdminModal();
    await loadCourses();
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
  await loadCourses();
  switchAdminTab('adminCourses');
}

// ───────────── الدروس ─────────────
async function renderAdminLessons(content) {
  const { data: courses } = await supabaseClient
    .from('courses').select('id,title').order('title');

  content.innerHTML = `
    <button class="btn" style="margin-bottom:20px" onclick="openLessonForm()">➕ إضافة درس</button>
    <div id="lessonsList"></div>`;

  const list = document.getElementById('lessonsList');
  if (!courses?.length) {
    list.innerHTML = '<div class="empty-state">أضف كورساً أولاً</div>';
    return;
  }

  const { data: lessons } = await supabaseClient
    .from('lessons')
    .select('*, courses(title)')
    .order('course_id')
    .order('order');

  if (!lessons?.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🎬</div>لا توجد دروس</div>';
    return;
  }

  list.innerHTML = lessons.map(l => `
    <div class="announcement">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <h4>${escapeHtml(l.title)}</h4>
          <p style="color:#888;font-size:13px">
            📚 ${escapeHtml(l.courses?.title || '-')} • ⏱ ${escapeHtml(l.duration || '-')}
          </p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" onclick='openLessonForm(${JSON.stringify(l).replace(/'/g, "&#39;")})'>✏️</button>
          <button class="btn btn-outline" onclick="deleteLesson(${l.id})">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}

async function openLessonForm(lesson = null) {
  const { data: courses } = await supabaseClient
    .from('courses').select('id,title').order('title');

  const isEdit = !!lesson;

  openAdminModal(isEdit ? '✏️ تعديل درس' : '➕ إضافة درس', `
    <div class="form-group"><label>الكورس</label>
      <select id="lfCourse">
        ${(courses || []).map(c =>
          `<option value="${c.id}" ${lesson?.course_id === c.id ? 'selected' : ''}>${escapeHtml(c.title)}</option>`
        ).join('')}
      </select></div>
    <div class="form-group"><label>عنوان الدرس</label>
      <input id="lfTitle" value="${escapeHtml(lesson?.title || '')}"></div>
    <div class="form-group"><label>المدة</label>
      <input id="lfDuration" value="${escapeHtml(lesson?.duration || '')}" placeholder="مثال: 25 دقيقة"></div>
    <div class="form-group"><label>الترتيب</label>
      <input id="lfOrder" type="number" value="${lesson?.order ?? 0}"></div>
    <div class="form-group">
      <label>رفع فيديو (MP4)</label>
      <input type="file" id="lfVideo" accept="video/*">
      <div style="margin-top:8px;color:#888;font-size:13px" id="uploadStatus">
        ${lesson?.video_url
          ? `الفيديو الحالي: <a href="${escapeHtml(lesson.video_url)}" target="_blank" style="color:var(--gold)">مشاهدة</a>`
          : 'لا يوجد فيديو'}
      </div>
      <div style="height:8px;background:rgba(0,0,0,0.4);border-radius:4px;margin-top:8px;overflow:hidden">
        <div id="uploadBar" style="height:100%;width:0;background:linear-gradient(90deg,var(--gold),var(--gold-light));transition:0.3s"></div>
      </div>
      <div id="uploadPct" style="color:var(--gold);font-size:12px;margin-top:4px;text-align:center"></div>
    </div>
    <button class="btn" id="saveLessonBtn"
      onclick="saveLesson(${lesson?.id || 'null'}, ${lesson?.video_url ? `'${lesson.video_url}'` : 'null'})">
      حفظ
    </button>
  `);
}

async function saveLesson(id, existingVideoUrl) {
  const title = document.getElementById('lfTitle').value.trim();
  const courseId = document.getElementById('lfCourse').value;
  if (!title || !courseId) { showToast('العنوان والكورس مطلوبان', true); return; }

  const btn = document.getElementById('saveLessonBtn');
  btn.disabled = true;

  try {
    let videoUrl = existingVideoUrl;
    const file = document.getElementById('lfVideo').files[0];

    if (file) {
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > CONFIG.MAX_VIDEO_SIZE_MB) {
        showToast(`حجم الفيديو ${sizeMB.toFixed(1)}MB أكبر من ${CONFIG.MAX_VIDEO_SIZE_MB}MB`, true);
        btn.disabled = false;
        return;
      }

      if (!file.type.startsWith('video/')) {
        showToast('الملف ليس فيديو صالح', true);
        btn.disabled = false;
        return;
      }

      const path = `lesson_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      document.getElementById('uploadStatus').textContent = 'جاري الرفع...';

      const { data: { session } } = await supabaseClient.auth.getSession();
      const token = session.access_token;
      const uploadUrl = `${CONFIG.SUPABASE_URL}/storage/v1/object/videos/${path}`;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('apikey', CONFIG.SUPABASE_KEY);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            document.getElementById('uploadBar').style.width = pct + '%';
            document.getElementById('uploadPct').textContent = pct + '%';
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
          ? resolve() : reject(new Error(xhr.responseText || 'فشل الرفع'));
        xhr.onerror = () => reject(new Error('خطأ شبكة'));
        xhr.send(file);
      });

      const { data: urlData } = supabaseClient.storage.from('videos').getPublicUrl(path);
      videoUrl = urlData.publicUrl;
      document.getElementById('uploadStatus').textContent = '✅ تم الرفع';
    }

    const payload = {
      title,
      course_id: parseInt(courseId),
      duration: document.getElementById('lfDuration').value.trim(),
      order: parseInt(document.getElementById('lfOrder').value) || 0,
      video_url: videoUrl
    };

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('lessons').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('lessons').insert(payload));
    }
    if (error) throw error;

    showToast('✅ تم حفظ الدرس');
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

// ───────────── الإعلانات ─────────────
async function renderAdminAnnouncements(content) {
  const { data } = await supabaseClient
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  content.innerHTML = `
    <button class="btn" style="margin-bottom:20px" onclick="openAnnouncementForm()">➕ إضافة إعلان</button>
    ${(data || []).map(a => `
      <div class="announcement">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="flex:1">
            <h4>${escapeHtml(a.title)}</h4>
            <p>${escapeHtml(a.content || '')}</p>
            <div class="date">${new Date(a.created_at).toLocaleDateString('ar-EG')}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-outline" onclick='openAnnouncementForm(${JSON.stringify(a).replace(/'/g, "&#39;")})'>✏️</button>
            <button class="btn btn-outline" onclick="deleteAnnouncement(${a.id})">🗑️</button>
          </div>
        </div>
      </div>`).join('')}`;
}

function openAnnouncementForm(a = null) {
  const isEdit = !!a;
  openAdminModal(isEdit ? '✏️ تعديل إعلان' : '➕ إعلان جديد', `
    <div class="form-group"><label>العنوان</label>
      <input id="afTitle" value="${escapeHtml(a?.title || '')}"></div>
    <div class="form-group"><label>المحتوى</label>
      <textarea id="afContent" rows="5" style="width:100%;padding:12px;background:rgba(0,0,0,0.4);
        border:1px solid rgba(212,175,55,0.3);border-radius:8px;color:var(--text);font-family:inherit">
        ${escapeHtml(a?.content || '')}</textarea></div>
    <button class="btn" onclick="saveAnnouncement(${a?.id || 'null'})">حفظ</button>
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
  await loadAnnouncements();
  switchAdminTab('adminAnnouncements');
}

async function deleteAnnouncement(id) {
  if (!confirm('حذف الإعلان؟')) return;
  const { error } = await supabaseClient.from('announcements').delete().eq('id', id);
  if (error) { showToast(error.message, true); return; }
  showToast('تم الحذف');
  await loadAnnouncements();
  switchAdminTab('adminAnnouncements');
}

// ───────────── الطلاب ─────────────
async function renderAdminStudents(content) {
  const { data: enr } = await supabaseClient
    .from('enrollments')
    .select('*, courses(title), students:student_id(full_name, phone, grade)')
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
            <th style="padding:12px;text-align:right">الهاتف</th>
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
              <td style="padding:12px">${escapeHtml(e.students?.phone || '-')}</td>
              <td style="padding:12px">${escapeHtml(e.students?.grade || '-')}</td>
              <td style="padding:12px">${escapeHtml(e.courses?.title || '-')}</td>
              <td style="padding:12px">${
                e.status === 'approved' ? '✅ مفعّل' :
                e.status === 'rejected' ? '❌ مرفوض' : '⏳ انتظار'
              }</td>
              <td style="padding:12px;display:flex;gap:6px;flex-wrap:wrap">
                ${e.status !== 'approved'
                  ? `<button class="btn" style="padding:6px 12px;font-size:12px" onclick="updateEnrollment(${e.id},'approved')">✅ قبول</button>`
                  : ''}
                ${e.status !== 'rejected'
                  ? `<button class="btn btn-outline" style="padding:6px 12px;font-size:12px" onclick="updateEnrollment(${e.id},'rejected')">❌ رفض</button>`
                  : ''}
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

// ───────────── Modal ─────────────
function openAdminModal(title, bodyHtml) {
  document.getElementById('adminModalTitle').textContent = title;
  document.getElementById('adminModalBody').innerHTML = bodyHtml;
  document.getElementById('adminModal').classList.add('active');
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('active');
}