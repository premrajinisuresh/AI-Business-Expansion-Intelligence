/* ============================================================
   scripts/lead-validators.mjs
   Shared "is this value sane?" checks used by BOTH:
     - enrich-buyers-v6.mjs (so it never SAVES an absurd value)
     - cleanup-buyers-v6.mjs (so it can find and blank absurd
       values that already got saved before this fix)
   Every function returns true if the value looks legitimate,
   false if it should be treated as empty/absurd.
   ============================================================ */

export const TN_CITIES = [
  "Chennai", "Madurai", "Coimbatore", "Trichy", "Tiruchirappalli",
  "Salem", "Erode", "Tirunelveli", "Vellore", "Thoothukudi",
  "Dindigul", "Thanjavur", "Karur", "Namakkal"
];

const IGNORED_EMAIL_DOMAINS = [
  "sentry.io", "wixpress.com", "godaddy.com", "schema.org", "w3.org",
  "example.com", "yourdomain.com", "domain.com", "wordpress.com",
  "gstatic.com", "googleapis.com"
];

const PLACEHOLDER_10_DIGIT = new Set([
  "0000000000", "1111111111", "2222222222", "3333333333", "4444444444",
  "5555555555", "6666666666", "7777777777", "8888888888", "9999999999",
  "1234567890", "9876543210"
]);

export function normalizeDigits(raw) {
  return String(raw || "").replace(/[^\d]/g, "");
}

export function last10(raw) {
  return normalizeDigits(raw).slice(-10);
}

export function isValidEmail(value) {
  if (!value) return false;
  const v = String(value).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return false;
  if (/\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(v)) return false;
  const domain = v.split("@")[1] || "";
  if (IGNORED_EMAIL_DOMAINS.some((d) => domain.includes(d))) return false;
  return true;
}

export function isValidMobile(value) {
  if (!value) return false;
  // Accept comma-joined lists: every piece must be individually valid.
  const parts = String(value).split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((p) => {
    const digits = last10(p);
    if (digits.length !== 10) return false;
    if (!/^[6-9]/.test(digits)) return false;
    if (PLACEHOLDER_10_DIGIT.has(digits)) return false;
    return true;
  });
}

export function isValidPhone(value) {
  if (!value) return false;
  const parts = String(value).split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  return parts.every((p) => {
    const digits = normalizeDigits(p);
    if (digits.length < 8 || digits.length > 13) return false;
    if (/^0+$/.test(digits)) return false;
    if (PLACEHOLDER_10_DIGIT.has(digits.slice(-10))) return false;
    // Must be mostly digits with only phone-safe separators.
    if (!/^[\d+\-\s()]+$/.test(p)) return false;
    return true;
  });
}

export function isValidWhatsApp(value) {
  return isValidMobile(value);
}

export function isValidPin(value) {
  if (!value) return false;
  const v = String(value).trim();
  if (!/^\d{6}$/.test(v)) return false;
  if (/^(\d)\1{5}$/.test(v)) return false; // e.g. 000000, 999999
  if (v === "123456") return false;
  return true;
}

const ADDRESS_JUNK_PATTERNS = [
  "{", "}", "font-", "color:", "px;", "elementor", "<", ">",
  "function(", "var ", "@media", ".css", "px}", "important;"
];

export function isValidAddress(value) {
  if (!value) return false;
  const v = String(value).trim();
  if (v.length < 6 || v.length > 250) return false;
  const lower = v.toLowerCase();
  if (ADDRESS_JUNK_PATTERNS.some((p) => lower.includes(p))) return false;
  // Should contain at least a few letters (not just symbols/digits).
  if ((v.match(/[a-zA-Z]/g) || []).length < 5) return false;
  return true;
}

export function isValidState(value, city) {
  if (!value) return false;
  const v = String(value).trim();
  if (v.length < 3 || v.length > 30) return false;
  // If the City is a known Tamil Nadu city but State is something
  // else entirely, the State was almost certainly grabbed from
  // unrelated template/footer text on the page (this is exactly
  // the "Chennai, Andhra Pradesh" bug) - treat it as invalid.
  if (city && TN_CITIES.includes(city) && v !== "Tamil Nadu") {
    return false;
  }
  return true;
}

export function isValidCity(value) {
  if (!value) return false;
  const v = String(value).trim();
  return v.length >= 3 && v.length <= 40;
}

function looksLikeDirectionsJunk(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes("/maps/dir/")) return true;
  const coordMarkers = (url.match(/!2d/g) || []).length;
  if (coordMarkers >= 2) return true;
  return false;
}

export function isValidGoogleMaps(value) {
  if (!value) return false;
  const v = String(value).trim();
  if (!/^https?:\/\//i.test(v)) return false;
  if (!/google\.[a-z.]+\/maps|maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(v)) {
    return false;
  }
  if (looksLikeDirectionsJunk(v)) return false;
  return true;
}

function isValidSocialUrl(value, domainPattern) {
  if (!value) return false;
  const v = String(value).trim();
  if (!/^https?:\/\//i.test(v)) return false;
  if (!domainPattern.test(v)) return false;
  try {
    const u = new URL(v);
    const path = u.pathname.replace(/\/+$/, "");
    if (!path || path === "") return false; // bare domain, not a real profile
    if (/^\/(sharer|share|intent)/i.test(path)) return false; // generic share widgets
    return true;
  } catch {
    return false;
  }
}

export function isValidFacebook(value) {
  return isValidSocialUrl(value, /facebook\.com/i);
}
export function isValidLinkedIn(value) {
  return isValidSocialUrl(value, /linkedin\.com/i);
}
export function isValidInstagram(value) {
  return isValidSocialUrl(value, /instagram\.com/i);
}
export function isValidX(value) {
  return isValidSocialUrl(value, /(twitter\.com|x\.com)/i);
}
export function isValidYouTube(value) {
  return isValidSocialUrl(value, /(youtube\.com|youtu\.be)/i);
}

export function isValidContactPage(value) {
  if (!value) return false;
  return /^https?:\/\//i.test(String(value).trim());
}
