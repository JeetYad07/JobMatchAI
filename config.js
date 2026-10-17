/**
 * Loads all personal data + credentials from .env so nothing sensitive lives in code.
 * Tiny hand-rolled parser — no dependency needed for a flat KEY=value file.
 */
const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs
    .readFileSync(file, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const E = loadEnv(path.join(__dirname, ".env"));
const g = (k, d = "") =>
  E[k] != null && E[k] !== "" ? E[k] : process.env[k] || d;

if (!g("NAME") || !g("EMAIL")) {
  console.warn(
    "[config] .env missing or empty — copy .env.example to .env and fill it in.",
  );
}

function calcExperience(startDateStr, fallbackStr) {
  const start = startDateStr ? new Date(startDateStr) : new Date("2022-06-01");
  if (isNaN(start.getTime())) {
    const raw = fallbackStr || "4.5 years";
    return {
      text: raw,
      num: (raw.match(/\d+(\.\d+)?/) || ["4"])[0],
      int: parseInt((raw.match(/\d+/) || ["4"])[0], 10),
      detailed: raw,
    };
  }
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) months = 0;

  const yearsDecimal = (months / 12).toFixed(1).replace(/\.0$/, "");
  const yearsInt = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const detailed = remainingMonths > 0
    ? `${yearsDecimal} years (${yearsInt} yrs ${remainingMonths} mos)`
    : `${yearsDecimal} years`;

  return {
    text: `${yearsDecimal} years professional experience`,
    num: String(yearsDecimal),
    int: Math.max(1, yearsInt),
    detailed,
  };
}

const exp = calcExperience(g("CAREER_START_DATE", "2022-06-01"), g("YEARS_EXPERIENCE"));

const CV = {
  name: g("NAME"),
  email: g("EMAIL"),
  phone: g("PHONE"),
  location: g("LOCATION"),
  currentRole: g("CURRENT_ROLE"),
  company:
    g("COMPANY") || (g("CURRENT_ROLE").split(" at ")[1] || "").split(" (")[0],
  education: g("EDUCATION"),
  careerStartDate: g("CAREER_START_DATE", "2022-06-01"),
  yearsOfExperience: exp.text,
  yearsNumber: exp.num,
  yearsInt: exp.int,
  yearsDetailed: exp.detailed,
  skills: g("SKILLS"),
  highlights: g("HIGHLIGHTS")
    .split("||")
    .map((s) => s.trim())
    .filter(Boolean),
  // application answers
  noticePeriod: g("NOTICE_PERIOD"),
  currentCTC: g("CURRENT_CTC"), // bare number for chatbots, e.g. "10"
  expectedCTC: g("EXPECTED_CTC"), // e.g. "18-25"
  currentSalary: g("CURRENT_CTC") + " LPA", // formatted for free-text fields
  expectedSalary: g("EXPECTED_CTC") + " LPA",
  dob: g("DOB"),
  workAuth: g("WORK_AUTH", "Authorized to work in my country of residence."),
  minSalaryLPA: Number(g("MIN_SALARY_LPA", "18")) || 18,
  requireAllCriteria: g("REQUIRE_ALL_CRITERIA_MATCHED", "true") !== "false",
  // links
  github: g("GITHUB_URL"),
  linkedin: g("LINKEDIN_URL"),
  portfolio: g("PORTFOLIO_URL"),
  links: `GitHub: ${g("GITHUB_URL")} | LinkedIn: ${g("LINKEDIN_URL")} | Portfolio: ${g("PORTFOLIO_URL")}`,
  // derived sentences
  remoteOk:
    "Yes, I am fully set up for remote work and also open to hybrid/onsite.",
  relocate: `Yes, I am open to relocation. I am currently based in ${g("LOCATION")}.`,
  startDate: `I can start within ${g("NOTICE_PERIOD")}.`,
};

const CREDS = {
  email: g("GOOGLE_EMAIL") || g("EMAIL"),
  password: g("GOOGLE_PASSWORD"),
};
const geminiKey = g("GEMINI_KEY");
const naukriProfileUrl = g(
  "NAUKRI_PROFILE_URL",
  "https://www.naukri.com/mnjuser/profile",
);
// The PDF uploaded to the Naukri profile and attached to external application forms.
// Relative names resolve against the repo folder; an absolute path is used as-is.
const resumePath = path.resolve(
  __dirname,
  g("RESUME_FILE", "Ankit Baghel.pdf"),
);

const emailConfig = {
  enabled: g("EMAIL_NOTIFICATIONS", "false") === "true",
  host: (g("SMTP_HOST", "smtp.gmail.com") || "smtp.gmail.com").trim(),
  port: parseInt(g("SMTP_PORT", "465"), 10) || 465,
  secure: (parseInt(g("SMTP_PORT", "465"), 10) || 465) === 465,
  user: (g("SMTP_USER") || g("GOOGLE_EMAIL") || g("EMAIL") || "").trim(),
  pass: g("SMTP_PASS", "").replace(/\s+/g, ""), // strip any spaces from 16-char app pass
  to: (g("NOTIFICATION_EMAIL") || g("EMAIL") || g("GOOGLE_EMAIL") || "").trim(),
};

module.exports = { CV, CREDS, geminiKey, naukriProfileUrl, resumePath, emailConfig };
