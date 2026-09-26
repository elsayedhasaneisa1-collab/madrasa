// ═══════════════════════════════════════════════════════════
// إعدادات المنصة - الأستاذ محمد عيسى
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // Supabase
  SUPABASE_URL: 'https://brawrhpvtnzvvrzkguic.supabase.co',
  SUPABASE_KEY: 'sb_publishable_Q8fBS3nVZqgvfd6diaul8A_cMvHUFtN',

  // Buckets
  BUCKETS: {
    videos: 'videos',
    images: 'images'
  },

  // إعدادات الفيديو
  SIGNED_URL_EXPIRY: 3600,
  MAX_VIDEO_SIZE_MB: 500,

  // العلامة المائية
  WATERMARK: {
    interval: 4000,
    opacity: 0.35,
    fontSize: '16px'
  },

  // معلومات الأستاذ
  TEACHER: {
    name: 'الأستاذ محمد عيسى',
    email: 'elsayedhasaneisa1@gmail.com',
    platformName: 'منصة الأستاذ محمد عيسى التعليمية'
  },

  // الصفوف
  GRADES: [
    'الأول الثانوي',
    'الثاني الثانوي',
    'الثالث الثانوي'
  ]
};

// إنشاء عميل Supabase
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

// اختصار
const SB = supabaseClient;