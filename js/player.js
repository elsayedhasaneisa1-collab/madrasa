// ═══════════════════════════════════════════════════════════
// 🎬 مشغل الفيديو المحمي + علامة مائية متحركة
// ═══════════════════════════════════════════════════════════

let playerState = {
  video: null,
  container: null,
  watermark: null,
  watermarkInterval: null,
  userLabel: '',
  protectionActive: false
};

async function openSecurePlayer(lesson, studentName, studentId) {
  const modal = document.getElementById('playerModal');
  if (!modal) return;
  modal.classList.add('active');

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
    ">
      <video id="secureVideo" controls playsinline
        style="width:100%;display:block;background:#000"
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        oncontextmenu="return false">
      </video>

      <div id="watermark" style="
        position:absolute;
        padding:6px 12px;
        background:rgba(0,0,0,0.4);
        color:#fff;
        font-size:${CONFIG.WATERMARK.fontSize};
        opacity:${CONFIG.WATERMARK.opacity};
        pointer-events:none;
        border-radius:6px;
        font-weight:600;
        letter-spacing:1px;
        transition: top 0.8s ease, left 0.8s ease, opacity 0.5s ease;
        text-shadow: 0 0 4px rgba(0,0,0,0.9);
        z-index: 10;
        white-space: nowrap;
      ">${escapeHtml(studentName)}</div>

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
      ">
        <div style="font-size:60px">🔒</div>
        <div>تم إيقاف التشغيل مؤقتاً</div>
        <div style="font-size:14px;color:#aaa;font-weight:normal">
          أدوات المطور مكتشفة — أغلقها للمتابعة
        </div>
      </div>
    </div>

    <div style="margin-top:15px;text-align:center;color:#888;font-size:13px">
      🛡️ محتوى محمي • ${escapeHtml(studentId.slice(0, 8))}
    </div>
  `;

  const video = document.getElementById('secureVideo');
  const container = document.getElementById('playerContainer');
  const watermark = document.getElementById('watermark');
  const overlay = document.getElementById('protectionOverlay');

  playerState.video = video;
  playerState.container = container;
  playerState.watermark = watermark;
  playerState.userLabel = `${studentName} • ${studentId.slice(0, 8)}`;

  try {
    let finalUrl = lesson.video_url;

    if (finalUrl && finalUrl.includes('/storage/v1/object/public/videos/')) {
      const path = finalUrl.split('/videos/')[1];
      const { data, error } = await supabaseClient
        .storage.from('videos')
        .createSignedUrl(path, CONFIG.SIGNED_URL_EXPIRY);

      if (!error && data?.signedUrl) finalUrl = data.signedUrl;
    }

    video.src = finalUrl;
    video.load();
    video.play().catch(() => {});
  } catch (err) {
    showToast('تعذر تحميل الفيديو', true);
  }

  activateAllProtection();
  applyProtection(container);
  applyProtection(video);
  playerState.protectionActive = true;

  startWatermarkAnimation(watermark, container);

  detectDevTools(() => {
    if (video) video.pause();
    overlay.style.display = 'flex';
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
        overlay.style.display = 'none';
        clearInterval(hideCheck);
      }
    }, 1000);
  });

  window.addEventListener('beforeunload', cleanupPlayer);
}

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
    watermark.style.opacity = (0.25 + Math.random() * 0.2).toFixed(2);
  };

  moveWatermark();
  playerState.watermarkInterval = setInterval(moveWatermark, CONFIG.WATERMARK.interval);
  window.addEventListener('resize', moveWatermark);
}

function closeSecurePlayer() {
  cleanupPlayer();
  const modal = document.getElementById('playerModal');
  if (modal) modal.classList.remove('active');
  const body = document.getElementById('playerBody');
  if (body) body.innerHTML = '';
}

function cleanupPlayer() {
  if (playerState.video) {
    playerState.video.pause();
    playerState.video.src = '';
    playerState.video.load();
  }
  if (playerState.watermarkInterval) {
    clearInterval(playerState.watermarkInterval);
    playerState.watermarkInterval = null;
  }
  playerState = {
    video: null, container: null, watermark: null,
    watermarkInterval: null, userLabel: '', protectionActive: false
  };
}