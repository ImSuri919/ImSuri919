import { writeFile } from "node:fs/promises";
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
  JavaScript: ["f7df1e", "javascript", "black"],
  TypeScript: ["3178c6", "typescript", "white"],
  Kotlin: ["a97bff", "kotlin", "white"],
  Python: ["3776ab", "python", "white"],
  HTML: ["e34f26", "html5", "white"],
  CSS: ["1572b6", "css3", "white"],
  Java: ["007396", "openjdk", "white"],
  Dart: ["0175c2", "dart", "white"],
  Shell: ["89e051", "gnubash", "black"],
};

function cell(text) {
  return String(text || "—").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function day(iso) {
  return iso ? iso.slice(0, 10) : "unknown";
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
    .map((item) => `- ${item.text}${item.count > 1 ? ` (x${item.count})` : ""} on ${day(item.date)}`);
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

const raw = `https://raw.githubusercontent.com/${LOGIN}/${LOGIN}/main/assets`;
const divider = `<div align="center"><img src="${raw}/neon-divider.svg" width="880" alt=""></div>`;

const lines = [
  `<div align="center">`,
  ``,
  `<a href="https://github.com/${LOGIN}"><img src="${raw}/profile-banner.svg" width="880" alt="${user.name || user.login} animated banner"></a>`,
  ``,
  `# ${user.name || user.login}`,
  ``,
  `#### @${user.login} · building things for developers`,
  ``,
  `[![Followers](https://img.shields.io/github/followers/${LOGIN}?style=for-the-badge&logo=github&color=2f81f7)](https://github.com/${LOGIN}?tab=followers)`,
  `[![Repositories](https://img.shields.io/github/repos/${LOGIN}?style=for-the-badge&logo=github&color=238636)](https://github.com/${LOGIN}?tab=repositories)`,
  `[![Stars earned](https://img.shields.io/github/stars/${LOGIN}?style=for-the-badge&logo=github&color=d29936)](https://github.com/${LOGIN}?tab=repositories)`,
  ``,
  `Developer tools, Android apps and AI agent workflows. I turn repeated work into reusable open-source tools.`,
  ``,
  `</div>`,
  ``,
  divider,
  ``,
  `## Currently building`,
  ``,
  current
    ? `**[${current.name}](${current.html_url})** — ${cell(current.description || "No description yet.")} Updated on ${day(current.pushed_at)}.`
    : "Nothing pushed yet.",
  ``,
  `## At a glance`,
  ``,
  `| | |`,
  `| --- | --- |`,
  `| Public repositories | ${publicRepos.length} |`,
  `| Stars across repositories | ${totalStars} |`,
  `| Followers | ${user.followers} |`,
  `| Following | ${user.following} |`,
  `| GitHub since | ${day(user.created_at)} |`,
  ``,
  `## Featured repositories`,
  ``,
  `| Repository | Description | Language | Stars | Last push |`,
  `| --- | --- | --- | --- | --- |`,
  ...featured.map(
    (repo) =>
      `| [${repo.name}](${repo.html_url}) | ${cell(repo.description)} | ${repo.language || "various"} | ${repo.stargazers_count || 0} | ${day(repo.pushed_at)} |`,
  ),
  ``,
  `## Languages in recent work`,
  ``,
  languages.length
    ? languages
        .map(([language]) => {
          const style = LANGUAGE_STYLE[language] || ["8b949e", "github", "white"];
          return `![${language}](https://img.shields.io/badge/${encodeURIComponent(language)}-${style[0]}?style=for-the-badge&logo=${style[1]}&logoColor=${style[2]})`;
        })
        .join(" ")
    : "Language data is not available yet.",
  ``,
  `## Recent public activity`,
  ``,
  ...(activity.length ? activity : ["No public events yet."]),
  ``,
  `Public events can be delayed by GitHub. This section is rebuilt every day.`,
  ``,
  `## Find me`,
  ``,
  `- GitHub: [@${LOGIN}](https://github.com/${LOGIN})`,
  `- Agent skills playground: [dev-agent-skills](https://imsuri919.github.io/dev-agent-skills/)`,
  `- Ideas and bug reports: [open an issue](https://github.com/ImSuri919/dev-agent-skills/issues/new/choose)`,
  ``,
  divider,
  ``,
  `<div align="center">`,
  ``,
  `This profile README is generated from the GitHub API by \`scripts/generate-profile.mjs\` and refreshed daily. Last generated ${generated}.`,
  ``,
  `</div>`,
  ``,
];

const target = path.join(root, "README.md");
await writeFile(target, lines.join("\n"), "utf8");
console.log(`Wrote README.md with ${featured.length} repos and ${activity.length} activity lines`);
