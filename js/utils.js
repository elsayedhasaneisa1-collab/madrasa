// ═══════════════════════════════════════════════════════════
// أدوات مساعدة + الحماية
// ═══════════════════════════════════════════════════════════

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    t.className = 'toast' + (isError ? ' error' : '');
  }, 3000);
}

function escapeHtml(s) {
  return (s || '').toString().replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function applyProtection(element) {
  if (!element) return;
  element.addEventListener('contextmenu', e => e.preventDefault());
  element.addEventListener('dragstart', e => e.preventDefault());
  element.style.userSelect = 'none';
  element.style.webkitUserSelect = 'none';
  element.style.webkitTouchCallout = 'none';
}

function detectDevTools(onDetect) {
  let devtoolsOpen = false;
  const threshold = 160;

  const check = () => {
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;
    const isOpen = widthDiff || heightDiff;

    if (isOpen && !devtoolsOpen) {
      devtoolsOpen = true;
      onDetect && onDetect();
    } else if (!isOpen && devtoolsOpen) {
      devtoolsOpen = false;
    }
  };

  setInterval(check, 1500);

  const bugCheck = () => {
    const start = performance.now();
    debugger;
    if (performance.now() - start > 100) {
      onDetect && onDetect();
    }
  };
  setInterval(bugCheck, 3000);
}

function blockPrintScreen() {
  document.addEventListener('keyup', async (e) => {
    if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
      try { await navigator.clipboard.writeText(''); } catch (_) {}
      showToast('⚠️ لقطات الشاشة غير مسموح بها', true);
    }
  });
}

function blockShortcuts() {
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && ['s', 'u', 'p'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      return false;
    }
    if (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      return false;
    }
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
  });
}

function getDeviceFingerprint() {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.platform
  ].join('|');

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash |= 0;
  }
  return 'fp_' + Math.abs(hash).toString(36);
}

function activateAllProtection() {
  blockShortcuts();
  blockPrintScreen();
}

const secureVideoStore = new Map();

async function fetchVideoAsBlob(url, lessonId) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error('فشل تحميل الفيديو');
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  secureVideoStore.set(lessonId, objUrl);
  return objUrl;
}

function releaseVideoBlob(lessonId) {
  const url = secureVideoStore.get(lessonId);
  if (url) {
    URL.revokeObjectURL(url);
    secureVideoStore.delete(lessonId);
  }
}