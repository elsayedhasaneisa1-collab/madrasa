// ═══════════════════════════════════════════════════════════
// 🎬 مشغل الفيديو المحمي - يدعم يوتيوب + Vimeo + MP4
// ═══════════════════════════════════════════════════════════

let playerState = {
  video: null,
  container: null,
  watermark: null,
  watermarkInterval: null,
  userLabel: '',
  protectionActive: false,
  type: 'video'
};

// ═══════════════ استخراج معرف يوتيوب ═══════════════
function extractYouTubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
    /youtube\.com\/live\/([^?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return '';
}

// ═══════════════ استخراج معرف Vimeo ═══════════════
function extractVimeoId(url) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : '';
}

// ═══════════════ فتح المشغل ═══════════════
async function openSecurePlayer(lesson, studentName, studentId) {
  const modal = document.getElementById('playerModal');
  if (!modal) return;
  modal.classList.add('active');

  const videoUrl = (lesson.video_url || '').trim();
  let videoHTML = '';
  let type = 'video';

  // ═══ اكتشف نوع الرابط ═══
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    type = 'youtube';
    const videoId = extractYouTubeId(videoUrl);
    videoHTML = `
      <iframe 
        id="secureVideo"
        width="100%" 
        height="100%" 
        style="position:absolute;inset:0;border:0;"
        src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}"
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    `;
  } else if (videoUrl.includes('vimeo.com')) {
    type = 'vimeo';
    const videoId = extractVimeoId(videoUrl);
    videoHTML = `
      <iframe 
        id="secureVideo"
        src="https://player.vimeo.com/video/${videoId}?title=0&byline=0&portrait=0&dnt=1" 
        width="100%" 
        height="100%" 
        style="position:absolute;inset:0;border:0;"
        frameborder="0" 
        allow="autoplay; fullscreen; picture-in-picture" 
        allowfullscreen>
      </iframe>
    `;
  } else if (videoUrl.includes('drive.google.com')) {
    // Google Drive
    type = 'drive';
    let driveId = '';
    const match1 = videoUrl.match(/\/file\/d\/([^/]+)/);
    const match2 = videoUrl.match(/id=([^&]+)/);
    driveId = match1 ? match1[1] : (match2 ? match2[1] : '');
    videoHTML = `
      <iframe 
        id="secureVideo"
        src="https://drive.google.com/file/d/${driveId}/preview" 
        width="100%" 
        height="100%" 
        style="position:absolute;inset:0;border:0;"
        frameborder="0" 
        allow="autoplay; fullscreen"
        allowfullscreen>
      </iframe>
    `;
  } else {
    // فيديو مباشر MP4
    type = 'video';
    videoHTML = `
      <video 
        id="secureVideo" 
        controls 
        playsinline
        style="position:absolute;inset:0;width:100%;height:100%;background:#000;"
        controlsList="nodownload"
        disablePictureInPicture
        oncontextmenu="return false">
        <source src="${escapeHtml(videoUrl)}" type="video/mp4">
        متصفحك لا يدعم تشغيل الفيديو
      </video>
    `;
  }

  // ═══ HTML المشغل ═══
  const body = document.getElementById('playerBody');
  body.innerHTML = `
    <div id="playerContainer" style="
      position: relative;
      width: 100%;
      max-width: 900px;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      margin: 0 auto;
      aspect-ratio: 16/9;
    ">
      <div id="videoContainer" style="position:absolute;inset:0;"></div>

      <!-- 💧 العلامة المائية -->
      <div id="watermark" style="
        position:absolute;
        padding:8px 14px;
        background:rgba(0,0,0,0.6);
        color:#fff;
        font-size:${CONFIG.WATERMARK.fontSize};
        opacity:${CONFIG.WATERMARK.opacity};
        pointer-events:none;
        border-radius:8px;
        font-weight:600;
        letter-spacing:1px;
        transition: top 0.9s ease, left 0.9s ease, opacity 0.6s ease;
        text-shadow: 0 0 6px rgba(0,0,0,0.95);
        z-index: 10;
        white-space: nowrap;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(212,175,55,0.3);
      ">${escapeHtml(studentName)} • ${escapeHtml(studentId.slice(0, 6))}</div>

      <!-- 🛡️ Overlay الحماية -->
      <div id="protectionOverlay" style="
        position:absolute;inset:0;
        display:none;
        background:rgba(0,0,0,0.95);
        color:#d4af37;
        align-items:center;justify-content:center;
        flex-direction:column;gap:15px;
        font-size:22px;font-weight:bold;
        text-align:center;
        padding:30px;
        z-index: 20;
        backdrop-filter: blur(10px);
      ">
        <div style="font-size:60px">🔒</div>
        <div>تم إيقاف التشغيل مؤقتاً</div>
        <div style="font-size:14px;color:#aaa;font-weight:normal">
          أغلق أدوات المطور للمتابعة
        </div>
      </div>
    </div>

    <div style="margin-top:15px;text-align:center;color:#888;font-size:13px;display:flex;justify-content:center;align-items:center;gap:15px;flex-wrap:wrap;">
      <span>🛡️ محتوى محمي</span>
      <span>•</span>
      <span>👤 ${escapeHtml(studentName)}</span>
      <span>•</span>
      <span>🆔 ${escapeHtml(studentId.slice(0, 8))}</span>
    </div>
  `;

  // ═══ ضع الفيديو ═══
  document.getElementById('videoContainer').innerHTML = videoHTML;

  const container = document.getElementById('playerContainer');
  const watermark = document.getElementById('watermark');
  const video = document.getElementById('secureVideo');
  const overlay = document.getElementById('protectionOverlay');

  playerState.video = video;
  playerState.container = container;
  playerState.watermark = watermark;
  playerState.userLabel = `${studentName} • ${studentId.slice(0, 6)}`;
  playerState.type = type;
  playerState.overlay = overlay;

  // ═══ تفعيل الحماية ═══
  activateAllProtection();
  applyProtection(container);

  // ═══ حرك العلامة المائية ═══
  startWatermarkAnimation(watermark, container);

  // ═══ كشف أدوات المطور ═══
  detectDevTools(() => {
    if (type === 'video' && video && video.pause) {
      video.pause();
    }
    if (overlay) overlay.style.display = 'flex';
    showToast('⚠️ تم رصد أدوات المطور', true);

    const hideCheck = setInterval(() => {
      const modal = document.getElementById('playerModal');
      if (!modal || !modal.classList.contains('active')) {
        clearInterval(hideCheck);
        return;
      }
      const widthDiff = window.outerWidth - window.innerWidth > 160;
      const heightDiff = window.outerHeight - window.innerHeight > 160;
      if (!widthDiff && !heightDiff) {
        if (overlay) overlay.style.display = 'none';
        clearInterval(hideCheck);
      }
    }, 1000);
  });

  window.addEventListener('beforeunload', cleanupPlayer);
}

// ═══════════════ حركة العلامة المائية ═══════════════
function startWatermarkAnimation(watermark, container) {
  if (playerState.watermarkInterval) {
    clearInterval(playerState.watermarkInterval);
  }

  const moveWatermark = () => {
    if (!watermark || !container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const ww = watermark.offsetWidth || 120;
    const wh = watermark.offsetHeight || 30;

    const maxX = Math.max(0, cw - ww - 10);
    const maxY = Math.max(0, ch - wh - 10);

    const x = Math.floor(Math.random() * maxX);
    const y = Math.floor(Math.random() * maxY);

    watermark.style.left = x + 'px';
    watermark.style.top = y + 'px';
    watermark.style.opacity = (0.25 + Math.random() * 0.25).toFixed(2);
  };

  moveWatermark();
  playerState.watermarkInterval = setInterval(moveWatermark, CONFIG.WATERMARK.interval);
  window.addEventListener('resize', moveWatermark);
}

// ═══════════════ إغلاق المشغل ═══════════════
function closeSecurePlayer() {
  cleanupPlayer();
  const modal = document.getElementById('playerModal');
  if (modal) modal.classList.remove('active');
  const body = document.getElementById('playerBody');
  if (body) body.innerHTML = '';
}

// ═══════════════ تنظيف ═══════════════
function cleanupPlayer() {
  if (playerState.video && playerState.video.tagName === 'VIDEO') {
    try {
      playerState.video.pause();
      playerState.video.src = '';
      playerState.video.load();
    } catch (_) {}
  }
  if (playerState.watermarkInterval) {
    clearInterval(playerState.watermarkInterval);
    playerState.watermarkInterval = null;
  }
  playerState = {
    video: null,
    container: null,
    watermark: null,
    watermarkInterval: null,
    userLabel: '',
    protectionActive: false,
    type: 'video',
    overlay: null
  };
}