// ═══════════════════════════════════════════════════════════
// إعدادات المنصة - الأستاذ محمد عيسى
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  SUPABASE_URL: 'https://brawrhpvtnzvvrzkguic.supabase.co',
  SUPABASE_KEY: 'sb_publishable_Q8fBS3nVZqgvfd6diaul8A_cMvHUFtN',

  BUCKETS: {
    videos: 'videos',
    images: 'images'
  },

  SIGNED_URL_EXPIRY: 3600,
  MAX_VIDEO_SIZE_MB: 500,

  WATERMARK: {
    interval: 4000,
    opacity: 0.35,
    fontSize: '16px'
  },

  TEACHER: {
    name: 'الأستاذ محمد عيسى',
    email: 'elsayedhasaneisa1@gmail.com',
    platformName: 'منصة الأستاذ محمد عيسى التعليمية'
  },

  GRADES: [
    'الأول الثانوي',
    'الثاني الثانوي',
    'الثالث الثانوي'
  ],

  // ═══════════════ إعدادات الجلسة الواحدة ═══════════════
  SESSION: {
    heartbeatInterval: 15000,  // كل 15 ثانية يحدث نبضة
    checkInterval: 8000,        // كل 8 ثوانٍ يفحص هل الجلسة اتغيرت
    staleAfter: 60000           // بعد دقيقة بدون نبضة تعتبر ميتة
  }
};

const supabaseClient = supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'x-application-name': 'mohamed-issa-platform'
      }
    }
  }
);

const SB = supabaseClient;