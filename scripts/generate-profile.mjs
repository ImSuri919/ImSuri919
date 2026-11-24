import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOGIN = process.env.GITHUB_LOGIN || "ImSuri919";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "profile-generator",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(endpoint) {
  const response = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!response.ok) throw new Error(`${endpoint}: ${response.status} ${await response.text()}`);
  return response.json();
}

const LANGUAGE_STYLE = {
  JavaScript: ["f7df1e", "black"],
  TypeScript: ["3178c6", "white"],
  Kotlin: ["a97bff", "white"],
  Python: ["3776ab", "white"],
  HTML: ["e34f26", "white"],
  CSS: ["1572b6", "white"],
  Java: ["007396", "white"],
  Dart: ["0175c2", "white"],
  Shell: ["89e051", "black"],
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clean(value, max = 80) {
  let text = String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > max) text = `${text.slice(0, max - 3).trimEnd()}...`;
  return text;
}

function day(iso) {
  return iso ? iso.slice(0, 10) : "unknown";
}

function shortDay(iso) {
  return iso ? iso.slice(2, 10) : "unknown";
}

function describeActivity(events) {
  const groups = new Map();
  for (const event of events) {
    const repo = event.repo?.name?.split("/").pop() || "unknown";
    const payload = event.payload || {};
    let text = "";
    if (event.type === "PushEvent") {
      const commits = payload.commits?.length || 1;
      text = `Pushed ${commits} commit${commits === 1 ? "" : "s"} to ${repo}`;
    } else if (event.type === "WatchEvent" && payload.action === "started") {
      text = `Starred ${repo}`;
    } else if (event.type === "ForkEvent") {
      text = `Forked ${repo}`;
    } else if (event.type === "CreateEvent") {
      text = `Created ${payload.ref_type || "repository"} in ${repo}`;
    } else if (event.type === "PublicEvent") {
      text = `Made ${repo} public`;
    } else {
      text = `${event.type.replace("Event", "")} on ${repo}`;
    }
    const existing = groups.get(text);
    if (existing) {
      existing.count += 1;
      if (event.created_at > existing.date) existing.date = event.created_at;
    } else {
      groups.set(text, { text, count: 1, date: event.created_at });
    }
  }
  return [...groups.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6)
    .map((item) => `${item.text}${item.count > 1 ? ` (x${item.count})` : ""} on ${day(item.date)}`);
}

const [user, repos, events] = await Promise.all([
  api(`/users/${LOGIN}`),
  api(`/users/${LOGIN}/repos?per_page=100&sort=updated`),
  api(`/users/${LOGIN}/events/public?per_page=90`),
]);

const publicRepos = repos.filter((repo) => !repo.private);
const featured = publicRepos
  .filter((repo) => repo.name !== LOGIN && repo.name.toLowerCase() !== "readme.md")
  .sort((a, b) => (a.pushed_at < b.pushed_at ? 1 : -1))
  .slice(0, 6);
const totalStars = publicRepos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);

const languageTotals = new Map();
const languageResults = await Promise.allSettled(
  featured.map((repo) => api(`/repos/${LOGIN}/${encodeURIComponent(repo.name)}/languages`)),
);
languageResults.forEach((result) => {
  if (result.status !== "fulfilled") return;
  for (const [language, bytes] of Object.entries(result.value)) {
    languageTotals.set(language, (languageTotals.get(language) || 0) + bytes);
  }
});
const languages = [...languageTotals.entries()]
  .filter(([language]) => language in LANGUAGE_STYLE)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8);

const activity = describeActivity(events);
const current = featured[0];
const generated = new Date().toISOString().slice(0, 10);

const avatarResponse = await fetch(user.avatar_url, { headers: { "User-Agent": "profile-generator" } });
if (!avatarResponse.ok) throw new Error(`avatar download failed: ${avatarResponse.status}`);
const avatarMime = avatarResponse.headers.get("content-type") || "image/png";
const avatarUri = `data:${avatarMime};base64,${Buffer.from(await avatarResponse.arrayBuffer()).toString("base64")}`;

function buildBanner(avatar) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="260" viewBox="0 0 880 260" role="img" aria-label="SURI animated developer banner">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#080d18"/>
      <stop offset="55%" stop-color="#0b1224"/>
      <stop offset="100%" stop-color="#070b14"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#dbe6ff"/>
      <stop offset="100%" stop-color="#7dd3fc"/>
    </linearGradient>
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".16"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity=".045"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity=".11"/>
    </linearGradient>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".75"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity=".14"/>
      <stop offset="100%" stop-color="#7dd3fc" stop-opacity=".45"/>
    </linearGradient>
    <linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="cyan" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity=".95"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="violet" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity=".95"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pink" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity=".85"/>
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blue" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity=".9"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
    <filter id="softblur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <filter id="liquid" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="9" result="wave">
        <animate attributeName="baseFrequency" values="0.012 0.018;0.02 0.011;0.012 0.018" dur="14s" repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="wave" scale="26" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="7"/>
    </filter>
    <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="cardClip"><rect x="56" y="48" width="768" height="164" rx="30"/></clipPath>
    <clipPath id="avatarClip"><circle cx="132" cy="130" r="40"/></clipPath>
  </defs>

  <rect width="880" height="260" fill="url(#bg)"/>

  <g filter="url(#softblur)">
    <circle cx="170" cy="70" r="125" fill="url(#cyan)" opacity=".72">
      <animate attributeName="cx" values="130;235;130" dur="12s" repeatCount="indefinite"/>
      <animate attributeName="cy" values="60;105;60" dur="9s" repeatCount="indefinite"/>
    </circle>
    <circle cx="670" cy="70" r="150" fill="url(#violet)" opacity=".75">
      <animate attributeName="cx" values="700;610;700" dur="11s" repeatCount="indefinite"/>
      <animate attributeName="cy" values="55;100;55" dur="13s" repeatCount="indefinite"/>
    </circle>
    <circle cx="470" cy="235" r="140" fill="url(#pink)" opacity=".55">
      <animate attributeName="cx" values="420;540;420" dur="15s" repeatCount="indefinite"/>
    </circle>
    <circle cx="830" cy="220" r="130" fill="url(#blue)" opacity=".7">
      <animate attributeName="cx" values="850;770;850" dur="12.5s" repeatCount="indefinite"/>
    </circle>
  </g>

  <g filter="url(#liquid)" opacity=".32">
    <ellipse cx="250" cy="150" rx="190" ry="46" fill="#22d3ee">
      <animate attributeName="cx" values="200;320;200" dur="16s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="640" cy="120" rx="210" ry="52" fill="#a855f7">
      <animate attributeName="cx" values="680;580;680" dur="14s" repeatCount="indefinite"/>
    </ellipse>
  </g>

  <g clip-path="url(#cardClip)">
    <rect x="56" y="48" width="768" height="164" fill="#ffffff" opacity=".055"/>
    <rect x="56" y="48" width="768" height="164" fill="url(#glass)" opacity=".9"/>
    <rect x="-320" y="30" width="200" height="200" fill="url(#shimmer)" opacity=".7" transform="skewX(-22)">
      <animate attributeName="x" values="-320;1020;-320" dur="7s" repeatCount="indefinite"/>
    </rect>
  </g>

  <rect x="56" y="48" width="768" height="164" rx="30" fill="none" stroke="url(#stroke)" stroke-width="2"/>
  <path d="M84 50 H470" stroke="#ffffff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/>

  <circle cx="132" cy="130" r="54" fill="url(#cyan)" opacity=".45"/>
  <circle cx="132" cy="130" r="50" fill="none" stroke="url(#ringGrad)" stroke-width="2.5">
    <animateTransform attributeName="transform" type="rotate" from="0 132 130" to="360 132 130" dur="9s" repeatCount="indefinite"/>
  </circle>
  <circle cx="132" cy="130" r="59" fill="none" stroke="#ffffff" stroke-opacity=".2" stroke-width="1" stroke-dasharray="2 10">
    <animateTransform attributeName="transform" type="rotate" from="360 132 130" to="0 132 130" dur="18s" repeatCount="indefinite"/>
  </circle>
  <g>
    <animateTransform attributeName="transform" type="rotate" from="0 132 130" to="360 132 130" dur="6s" repeatCount="indefinite"/>
    <circle cx="132" cy="71" r="4" fill="#7dffbe" filter="url(#glow)"/>
  </g>
  <image href="${avatar}" x="92" y="90" width="80" height="80" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
  <circle cx="132" cy="130" r="40" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="1.5"/>

  <text x="212" y="118" font-family="Roboto, Arial, sans-serif" font-size="55" font-weight="800" letter-spacing="1" fill="url(#titleGrad)">SURI</text>
  <text x="366" y="118" font-family="Roboto, Arial, sans-serif" font-size="23" font-weight="700" letter-spacing="1" fill="#7dd3fc">//919</text>
  <text x="215" y="154" font-family="Roboto, Arial, sans-serif" font-size="15" letter-spacing="2.2" fill="#dbe6ff">@ImSuri919  //  BUILDING IN PUBLIC</text>

  <rect x="724" y="60" width="96" height="28" rx="14" fill="#7dffbe" fill-opacity=".12" stroke="#7dffbe" stroke-opacity=".55"/>
  <circle cx="742" cy="74" r="4.5" fill="#7dffbe" filter="url(#glow)">
    <animate attributeName="opacity" values="1;.35;1" dur="2.2s" repeatCount="indefinite"/>
  </circle>
  <text x="756" y="78" font-family="Roboto, Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="2" fill="#bff7d8">LIVE</text>
  <text x="816" y="180" text-anchor="end" font-family="Roboto, Arial, sans-serif" font-size="10" letter-spacing="2.5" fill="#7f91b3">SHIP  /  MEASURE  /  REPEAT</text>

  <text x="215" y="240" font-family="Roboto, Arial, sans-serif" font-size="12.5" letter-spacing="3.2" fill="#9fb0d0">DEVTOOLS  /  ANDROID  /  AGENT SKILLS  /  OPEN SOURCE</text>
</svg>
`;
}

function sectionTitle(y, index, label) {
  return `
    <g>
      <rect x="40" y="${y}" width="4" height="18" rx="2" fill="url(#barGrad)"/>
      <text x="56" y="${y + 15}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="3" fill="#dbe6ff">${index} / ${esc(label)}</text>
      <line x1="56" y1="${y + 27}" x2="840" y2="${y + 27}" stroke="#ffffff" stroke-opacity=".07"/>
    </g>`;
}

function statCard(x, label, value, accent) {
  return `
    <g>
      <rect x="${x}" y="154" width="194" height="88" rx="20" fill="url(#glass)" stroke="url(#stroke)"/>
      <rect x="${x + 18}" y="170" width="26" height="3" rx="1.5" fill="${accent}"/>
      <text x="${x + 18}" y="194" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="2.5" fill="#8fa2c6">${esc(label)}</text>
      <text x="${x + 18}" y="226" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="30" font-weight="800" fill="url(#titleGrad)">${esc(value)}</text>
    </g>`;
}

function repoCard(x, y, repo) {
  const language = repo.language || "CODE";
  const color = LANGUAGE_STYLE[language]?.[0] || "8b949e";
  const name = clean(repo.name, 24);
  const description = clean(repo.description || "Open source project", 44);
  return `
    <g>
      <rect x="${x}" y="${y}" width="394" height="66" rx="18" fill="url(#glass)" stroke="url(#stroke)"/>
      <circle cx="${x + 22}" cy="${y + 25}" r="5" fill="#${color}"/>
      <text x="${x + 36}" y="${y + 29}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${esc(name)}</text>
      <text x="${x + 374}" y="${y + 29}" text-anchor="end" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="1" fill="#8fa2c6">* ${repo.stargazers_count || 0}</text>
      <text x="${x + 22}" y="${y + 50}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="12" fill="#a9b8d6">${esc(description)}</text>
      <text x="${x + 374}" y="${y + 50}" text-anchor="end" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="10" letter-spacing="1" fill="#6f81a5">${shortDay(repo.pushed_at)}</text>
    </g>`;
}

function languagePills(startY) {
  let x = 40;
  let y = startY;
  let endY = startY;
  const parts = [];

  for (const [language] of languages) {
    const color = LANGUAGE_STYLE[language][0];
    const label = clean(language.toUpperCase(), 16);
    const width = Math.max(88, 36 + label.length * 9);
    if (x + width > 840) {
      x = 40;
      y += 42;
    }
    parts.push(`
      <g>
        <rect x="${x}" y="${y}" width="${width}" height="30" rx="15" fill="#${color}" fill-opacity=".14" stroke="#${color}" stroke-opacity=".55"/>
        <circle cx="${x + 16}" cy="${y + 15}" r="4" fill="#${color}"/>
        <text x="${x + 28}" y="${y + 19}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="1.5" fill="#e6edf7">${esc(label)}</text>
      </g>`);
    endY = Math.max(endY, y + 30);
    x += width + 10;
  }

  if (!parts.length) {
    parts.push(`<text x="40" y="${startY + 18}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="13" fill="#8fa2c6">Language data is not available yet.</text>`);
    endY = startY + 30;
  }
  return { svg: parts.join(""), endY };
}

const workTitleY = 274;
const workStartY = 308;
const workRows = Math.max(1, Math.ceil(featured.length / 2));
const workEndY = workStartY + workRows * 66 + (workRows - 1) * 10;
const toolkitTitleY = workEndY + 30;
const toolkit = languagePills(toolkitTitleY + 34);
const signalTitleY = toolkit.endY + 30;
const signalStartY = signalTitleY + 34;
const activityRows = Math.max(1, Math.min(3, activity.length));
const signalEndY = signalStartY + activityRows * 28;
const connectTitleY = signalEndY + 28;
const connectY = connectTitleY + 34;
const connectH = 44;
const height = connectY + connectH + 58;

const workSvg = featured.length
  ? featured
      .map((repo, index) => repoCard(index % 2 === 0 ? 40 : 446, workStartY + Math.floor(index / 2) * 76, repo))
      .join("")
  : `<text x="40" y="${workStartY + 24}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="13" fill="#8fa2c6">No public repositories yet.</text>`;

const activitySvg = activity.length
  ? activity
      .slice(0, 3)
      .map((item, index) => {
        const y = signalStartY + index * 28;
        const color = index === 0 ? "#22d3ee" : index === 1 ? "#8b5cf6" : "#ec4899";
        return `
        <g>
          <circle cx="50" cy="${y + 6}" r="4" fill="${color}" filter="url(#glow)">
            <animate attributeName="opacity" values="1;.45;1" dur="${2.4 + index * 0.5}s" repeatCount="indefinite"/>
          </circle>
          <text x="70" y="${y + 10}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="12.5" fill="#b9c6df">${esc(clean(item, 88))}</text>
        </g>`;
      })
      .join("")
  : `<text x="70" y="${signalStartY + 10}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="12.5" fill="#8fa2c6">No public events yet.</text>`;

const connectLabels = ["PROFILE", "PLAYGROUND", "ISSUES"];
const connectColors = ["#2f81f7", "#8b5cf6", "#22d3ee"];
const connectSvg = connectLabels
  .map((label, index) => {
    const x = 111 + index * 224;
    return `
      <g>
        <rect x="${x}" y="${connectY}" width="210" height="${connectH}" rx="22" fill="#${connectColors[index]}" fill-opacity=".13" stroke="#${connectColors[index]}" stroke-opacity=".6"/>
        <circle cx="${x + 24}" cy="${connectY + 22}" r="5" fill="#${connectColors[index]}" filter="url(#glow)"/>
        <text x="${x + 40}" y="${connectY + 27}" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="2.5" fill="#eaf1ff">${label}</text>
      </g>`;
  })
  .join("");

const dashboard = `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="${height}" viewBox="0 0 880 ${height}" role="img" aria-label="Auto generated GitHub profile dashboard">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#080d18"/>
      <stop offset="55%" stop-color="#0b1224"/>
      <stop offset="100%" stop-color="#070b14"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".13"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity=".045"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity=".10"/>
    </linearGradient>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".55"/>
      <stop offset="45%" stop-color="#ffffff" stop-opacity=".10"/>
      <stop offset="100%" stop-color="#7dd3fc" stop-opacity=".40"/>
    </linearGradient>
    <linearGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="55%" stop-color="#dbe6ff"/>
      <stop offset="100%" stop-color="#7dd3fc"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity=".5"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="cyan" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="violet" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pink" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity=".42"/>
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0H0V44" fill="none" stroke="#ffffff" stroke-opacity=".035"/>
    </pattern>
    <clipPath id="avatarClip"><circle cx="780" cy="110" r="25"/></clipPath>
    <filter id="softblur" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="30"/>
    </filter>
    <filter id="glow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="880" height="${height}" fill="url(#bg)"/>
  <rect width="880" height="${height}" fill="url(#grid)"/>

  <g filter="url(#softblur)">
    <circle cx="120" cy="90" r="170" fill="url(#cyan)" opacity=".7">
      <animate attributeName="cx" values="90;180;90" dur="13s" repeatCount="indefinite"/>
      <animate attributeName="cy" values="60;120;60" dur="11s" repeatCount="indefinite"/>
    </circle>
    <circle cx="760" cy="70" r="190" fill="url(#violet)" opacity=".75">
      <animate attributeName="cx" values="790;690;790" dur="12s" repeatCount="indefinite"/>
      <animate attributeName="cy" values="55;110;55" dur="14s" repeatCount="indefinite"/>
    </circle>
    <circle cx="500" cy="${height - 60}" r="180" fill="url(#pink)" opacity=".6">
      <animate attributeName="cx" values="430;570;430" dur="16s" repeatCount="indefinite"/>
    </circle>
  </g>

  <rect x="-220" y="0" width="170" height="${height}" fill="url(#shimmer)" opacity=".14" transform="skewX(-18)">
    <animate attributeName="x" values="-220;1080;-220" dur="12s" repeatCount="indefinite"/>
  </rect>

  <g>
    <rect x="40" y="34" width="800" height="104" rx="24" fill="url(#glass)" stroke="url(#stroke)"/>
    <rect x="64" y="58" width="28" height="3" rx="1.5" fill="url(#barGrad)"/>
    <text x="64" y="82" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="#7dd3fc">NOW SHIPPING</text>
    <text x="64" y="112" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="27" font-weight="800" fill="url(#titleGrad)">${esc(clean(current?.name || "Open source work", 28))}</text>
    <text x="64" y="132" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="12.5" fill="#a9b8d6">${esc(clean(current?.description || "Building useful things in public.", 76))}</text>
    <rect x="744" y="58" width="72" height="26" rx="13" fill="#7dffbe" fill-opacity=".12" stroke="#7dffbe" stroke-opacity=".5"/>
    <circle cx="758" cy="71" r="4" fill="#7dffbe" filter="url(#glow)">
      <animate attributeName="opacity" values="1;.35;1" dur="2s" repeatCount="indefinite"/>
    </circle>
    <text x="770" y="75" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="10" font-weight="700" letter-spacing="1.5" fill="#bff7d8">LIVE</text>
    <text x="700" y="132" text-anchor="end" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="10.5" letter-spacing="1" fill="#6f81a5">${shortDay(current?.pushed_at)}</text>
    <circle cx="780" cy="110" r="32" fill="url(#cyan)" opacity=".5"/>
    <circle cx="780" cy="110" r="27" fill="none" stroke="url(#barGrad)" stroke-width="2"/>
    <image href="${avatarUri}" x="755" y="85" width="50" height="50" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
    <circle cx="780" cy="110" r="25" fill="none" stroke="#ffffff" stroke-opacity=".45"/>
  </g>

  ${statCard(40, "REPOSITORIES", publicRepos.length, "#22d3ee")}
  ${statCard(242, "STARS EARNED", totalStars, "#8b5cf6")}
  ${statCard(444, "FOLLOWERS", user.followers, "#ec4899")}
  ${statCard(646, "ON GITHUB SINCE", user.created_at.slice(0, 4), "#3b82f6")}

  ${sectionTitle(workTitleY, "01", "SELECTED WORK")}
  ${workSvg}

  ${sectionTitle(toolkitTitleY, "02", "TOOLKIT")}
  ${toolkit.svg}

  ${sectionTitle(signalTitleY, "03", "SIGNAL")}
  <line x1="50" y1="${signalStartY + 6}" x2="50" y2="${signalStartY + (activityRows - 1) * 28 + 6}" stroke="#ffffff" stroke-opacity=".10"/>
  ${activitySvg}

  ${sectionTitle(connectTitleY, "04", "CONNECT")}
  ${connectSvg}

  <text x="440" y="${height - 28}" text-anchor="middle" font-family="Roboto, Arial, Helvetica, sans-serif" font-size="10" letter-spacing="2" fill="#5f718f">AUTO-SYNCED FROM GITHUB API  /  LAST BUILD ${generated}</text>
</svg>
`;

const raw = `https://raw.githubusercontent.com/${LOGIN}/${LOGIN}/main/assets`;
const readme = [
  `<div align="center">`,
  ``,
  `<a href="https://github.com/${LOGIN}"><img src="${raw}/profile-banner.svg" width="880" alt="${esc(user.name || user.login)} animated banner"></a>`,
  ``,
  `</div>`,
  ``,
  `<div align="center">`,
  ``,
  `<a href="https://github.com/${LOGIN}?tab=repositories"><img src="${raw}/profile-dashboard.svg" width="880" alt="${esc(user.name || user.login)} profile dashboard"></a>`,
  ``,
  `</div>`,
  ``,
].join("\n");

await mkdir(path.join(root, "assets"), { recursive: true });
await writeFile(path.join(root, "assets", "profile-banner.svg"), buildBanner(avatarUri), "utf8");
await writeFile(path.join(root, "assets", "profile-dashboard.svg"), dashboard, "utf8");
await writeFile(path.join(root, "README.md"), readme, "utf8");
console.log(`Wrote banner, dashboard (${height}px) and README with ${featured.length} repos and ${activity.length} activity lines`);
