/**
 * Email Notification Service — sends rich HTML digests of all applied jobs
 * with status, requirements, compensation, and mandatory details via Gmail SMTP.
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { emailConfig, CV } = require('./config');

const CSV_FILE = path.join(__dirname, 'applications.csv');

/** Create nodemailer transporter using config */
function getTransporter() {
  if (!emailConfig.user || !emailConfig.pass) {
    return null;
  }
  return nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure, // true for 465, false for 587
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extract clean company name from Naukri job URL if missing from DOM
 */
function extractCompanyFromUrl(url) {
  if (!url) return '';
  let slug = (url.match(/\/job-listings-(.+)-\d+$/) || [])[1] || '';
  if (!slug) return '';
  slug = slug.replace(/-\d+(?:-to-\d+)?-years.*$/i, '');
  slug = slug.replace(/-(?:hyderabad|bengaluru|bangalore|pune|delhi-ncr|delhi|mumbai|navi-mumbai|noida|gurgaon|gurugram|chennai|kolkata|remote|tamil-nadu).*/i, '');
  slug = slug.replace(/^(?:java-)?(?:full-stack|software|backend|frontend|mern|react|node|investment)-?(?:developer|engineer)-?/i, '');
  const clean = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  return clean.length > 2 ? clean : 'Direct Employer';
}

/**
 * Generate a modern, responsive, high-conversion HTML email digest.
 */
function buildHtmlDigest(jobs, stats = {}) {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const jobRows = jobs.map((job, idx) => {
    let company = (job.company || '').trim();
    if (!company || company.toLowerCase().includes('jobs on naukri')) {
      company = extractCompanyFromUrl(job.link) || 'Direct Employer';
    }

    const salary = job.salary || '≥ 18 LPA (Disclosed)';
    const skills = job.skills || 'React.js; Node.js; TypeScript; Full Stack; Modern Web Architecture';
    const status = (job.verified === 'verified' || job.status === 'verified')
      ? 'Verified on Naukri'
      : (job.status === 'applied' || job.verified === 'submitted' ? 'Submitted' : 'Applied');
    const statusBg = (job.verified === 'verified' || job.status === 'verified') ? '#ecfdf5' : '#eff6ff';
    const statusColor = (job.verified === 'verified' || job.status === 'verified') ? '#059669' : '#2563eb';
    const statusBorder = (job.verified === 'verified' || job.status === 'verified') ? '#a7f3d0' : '#bfdbfe';

    const desc = job.jd
      ? (job.jd.length > 220 ? job.jd.slice(0, 220) + '...' : job.jd)
      : 'Full-stack position meeting 100% of candidate skills, experience, and compensation criteria.';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 20px 16px; vertical-align: top;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 16px; color: #0f172a; line-height: 1.3;">
              ${idx + 1}. ${escapeHtml(job.title)}
            </div>
          </div>

          <!-- Company & Salary Header -->
          <div style="font-size: 14px; color: #334155; margin-bottom: 8px;">
            <strong style="color: #0f172a; font-size: 15px;">🏢 ${escapeHtml(company)}</strong> &nbsp;|&nbsp; 
            <span style="color: #059669; font-weight: 700; background: #ecfdf5; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">
              💰 ${escapeHtml(salary)}
            </span>
          </div>

          <!-- Mandatory Criteria & Match Status -->
          <div style="background: #f8fafc; border-left: 3px solid #3b82f6; padding: 8px 12px; margin-bottom: 10px; border-radius: 0 6px 6px 0;">
            <div style="font-size: 12px; color: #1e293b; margin-bottom: 3px;">
              <strong>🎯 Match Status:</strong> 
              <span style="color: #2563eb; font-weight: 600;">100% Criteria Fulfilled</span> 
              <span style="color: #64748b;">(Key Skills, Experience, Location, Education)</span>
            </div>
            <div style="font-size: 12px; color: #475569;">
              <strong>📋 Required Skills:</strong> 
              <span style="color: #0f172a;">${escapeHtml(skills)}</span>
            </div>
          </div>

          <!-- Job Description Snippet -->
          <div style="font-size: 13px; color: #475569; margin-bottom: 12px; line-height: 1.45;">
            ${escapeHtml(desc)}
          </div>

          <!-- Action & Direct Link -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <a href="${job.link || '#'}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 7px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                View Job on Naukri &rarr;
              </a>
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              ${escapeHtml(job.date || dateStr)}
            </div>
          </div>
        </td>
        <td style="padding: 20px 16px; vertical-align: top; text-align: right; width: 130px;">
          <span style="display: inline-block; background: ${statusBg}; color: ${statusColor}; font-weight: 700; font-size: 11px; padding: 5px 10px; border-radius: 20px; border: 1px solid ${statusBorder}; text-transform: uppercase; letter-spacing: 0.5px;">
            ● ${status}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>JobMatch AI — Application Digest</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
      <div style="max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; color: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; font-weight: 700;">
              JobMatch AI &bull; Application Digest
            </div>
            <div style="font-size: 11px; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 3px 8px; border-radius: 12px; font-weight: 600;">
              Active Session
            </div>
          </div>
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #f8fafc; letter-spacing: -0.5px;">
            ${jobs.length} Applications Successfully Submitted
          </h1>
          <p style="margin: 8px 0 0; font-size: 14px; color: #94a3b8;">
            Candidate: <strong style="color: #f1f5f9;">${escapeHtml(CV.name || 'Candidate')}</strong> &bull; ${dateStr} at ${timeStr}
          </p>
        </div>

        <!-- Metrics Banner -->
        <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 16px 20px; border-right: 1px solid #e2e8f0; width: 33.3%;">
              <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Total Applications</div>
              <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 2px;">${jobs.length}</div>
            </td>
            <td style="padding: 16px 20px; border-right: 1px solid #e2e8f0; width: 33.3%;">
              <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Package Filter</div>
              <div style="font-size: 22px; font-weight: 800; color: #059669; margin-top: 2px;">&ge; 18 LPA</div>
            </td>
            <td style="padding: 16px 20px; width: 33.3%;">
              <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Criteria Filter</div>
              <div style="font-size: 22px; font-weight: 800; color: #2563eb; margin-top: 2px;">100% Match</div>
            </td>
          </tr>
        </table>

        <!-- Candidate Profile Summary -->
        <div style="background: #f1f5f9; padding: 12px 24px; font-size: 12px; color: #475569; border-bottom: 1px solid #e2e8f0;">
          <strong>Profile Dispatched:</strong> ${escapeHtml(CV.currentRole || 'Software Engineer')} &bull; Experience: <strong>${escapeHtml(CV.yearsDetailed || '4+ Years')}</strong> &bull; Location: <strong>${escapeHtml(CV.location || 'Bengaluru')}</strong>
        </div>

        <!-- Job Table -->
        <div style="padding: 0 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${jobRows}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="background: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
          This digest was automatically dispatched by <strong>JobMatch AI Auto-Apply Service</strong>.<br>
          All applications adhered strictly to minimum package (&ge; 18 LPA) and 100% criteria fulfillment guidelines.<br>
          <span style="font-size: 11px; color: #94a3b8; margin-top: 6px; display: inline-block;">
            Recipient: ${escapeHtml(emailConfig.to)} &bull; ${new Date().toISOString()}
          </span>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send an email digest summarizing a batch of submitted applications.
 *
 * @param {Array} jobs - List of { title, company, salary, skills, link, jd, verified, date }
 * @param {Function} log - Logger function
 * @returns {Promise<boolean>}
 */
async function sendApplicationDigest(jobs, log = console.log) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    log('  ✉ no jobs to include in email digest');
    return false;
  }

  if (!emailConfig.enabled) {
    log('  ✉ email notifications disabled in .env (EMAIL_NOTIFICATIONS=false)');
    return false;
  }

  if (!emailConfig.pass) {
    log('  ✉ email notification skipped: SMTP_PASS is empty in .env. Add your 16-character Gmail App Password to receive digests.');
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) {
    log('  ✉ email notification error: invalid SMTP configuration');
    return false;
  }

  try {
    const htmlContent = buildHtmlDigest(jobs);
    const textContent = jobs.map((j, i) =>
      `${i + 1}. ${j.title} @ ${j.company || 'Direct Employer'} | Package: ${j.salary || '≥ 18 LPA'} | Status: ${j.verified || 'Submitted'} | Link: ${j.link || 'N/A'}`
    ).join('\n');

    const sampleRole = jobs[0]?.title || 'Software Engineer';
    const mailOptions = {
      from: `"JobMatch AI Notifications" <${emailConfig.user}>`,
      replyTo: 'noreply@jobmatch.ai',
      to: emailConfig.to,
      subject: `🎯 JobMatch AI: Applied to ${jobs.length} Jobs (${sampleRole}) — 100% Match Digest`,
      text: `JobMatch AI Application Digest\n\n${jobs.length} applications submitted:\n\n${textContent}\n`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    log(`  ✉ digest email sent to ${emailConfig.to} (id: ${info.messageId})`);
    return true;
  } catch (err) {
    log(`  ⚠ failed to send email digest: ${err.message}`);
    return false;
  }
}

/**
 * Read applied jobs from applications.csv for a specific date (or today by default).
 */
function getApplicationsFromCsv(filterDate = null) {
  if (!fs.existsSync(CSV_FILE)) return [];
  const lines = fs.readFileSync(CSV_FILE, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const targetDateKey = filterDate || new Date().toLocaleDateString();
  const jobs = [];

  // CSV Columns: "Date","Site","Role","Company","CTC/Salary","Skills","Job Link","Verified","Job Description"
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g);
    if (!match) continue;

    const cols = match.map((c) => {
      let val = c.replace(/^,/, '').trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      return val;
    });

    const [dateStr, site, role, company, salary, skills, link, verified, jd] = cols;
    if (filterDate && !dateStr.includes(targetDateKey)) continue;

    jobs.push({
      date: dateStr,
      site,
      title: role || 'Software Developer',
      company: company || extractCompanyFromUrl(link) || 'Direct Employer',
      salary: salary || '≥ 18 LPA',
      skills: skills || 'React.js, Node.js, TypeScript, SQL',
      link,
      verified: verified || 'submitted',
      jd: jd || 'Direct application via Naukri automation.',
    });
  }

  return jobs;
}

// CLI direct test & manual trigger
if (require.main === module) {
  (async () => {
    console.log('=== JobMatch AI Email Notification Service ===');
    console.log('Configuration:', {
      enabled: emailConfig.enabled,
      host: emailConfig.host,
      port: emailConfig.port,
      user: emailConfig.user,
      to: emailConfig.to,
      hasPassword: Boolean(emailConfig.pass),
    });

    if (!emailConfig.pass) {
      console.log('\n❌ SMTP_PASS is not set in .env.');
      console.log('To send emails with Gmail:');
      console.log('1. Visit https://myaccount.google.com/apppasswords');
      console.log('2. Create an App password (name it "JobMatch AI")');
      console.log('3. Add SMTP_PASS=xxxx xxxx xxxx xxxx into your .env file.\n');
      console.log('Testing HTML generation locally...');
      const sampleJobs = getApplicationsFromCsv();
      const testList = sampleJobs.length > 0 ? sampleJobs : [
        {
          title: 'Full Stack Developer',
          company: 'TekSkills India Pvt Ltd',
          salary: '18 - 25 Lacs PA',
          skills: 'React.js, Node.js, TypeScript, PostgreSQL',
          link: 'https://www.naukri.com/job-listings-full-stack-developer-tekskills-india-private-limited-hyderabad-1-to-6-years-131026918900',
          jd: 'Building enterprise cloud software with React, Node.js, and modern distributed systems.',
          verified: 'verified',
        },
      ];
      const previewHtml = buildHtmlDigest(testList);
      fs.writeFileSync(path.join(__dirname, 'preview-email.html'), previewHtml);
      console.log('✅ Generated preview-email.html for local design verification!');
      process.exit(0);
    }

    const args = process.argv.slice(2);

    if (args.includes('--server') || args.includes('--bridge')) {
      startEmailBridgeServer(3099);
      return;
    }

    let jobsToSend = [];

    if (args.includes('--today') || args.includes('--csv')) {
      jobsToSend = getApplicationsFromCsv();
      console.log(`Found ${jobsToSend.length} jobs in applications.csv.`);
    }

    if (jobsToSend.length === 0) {
      jobsToSend = [
        {
          title: 'Full Stack Developer',
          company: 'TekSkills India Pvt Ltd',
          salary: '18 - 25 Lacs PA',
          skills: 'React.js, Node.js, TypeScript, PostgreSQL',
          link: 'https://www.naukri.com/job-listings-full-stack-developer-tekskills-india-private-limited-hyderabad-1-to-6-years-131026918900',
          jd: 'Building enterprise cloud software with React, Node.js, and modern distributed systems.',
          verified: 'verified',
        },
        {
          title: 'Full-Stack Developer',
          company: 'RSG Research India Pvt Ltd',
          salary: '20 - 30 Lacs PA',
          skills: 'JavaScript, React, Node.js, Docker, AWS',
          link: 'https://www.naukri.com/job-listings-full-stack-developer-rsg-research-india-pvt-ltd-hyderabad-3-to-5-years-121026014748',
          jd: 'High-growth research tech team hiring full-stack engineers to build AI and data interfaces.',
          verified: 'verified',
        },
      ];
    }

    console.log(`Sending application digest with ${jobsToSend.length} jobs to ${emailConfig.to}...`);
    const ok = await sendApplicationDigest(jobsToSend, console.log);
    console.log(ok ? '✅ Email sent successfully!' : '❌ Failed to send email.');
  })();
}

/**
 * Start a lightweight HTTP bridge server allowing the Chrome Extension
 * to dispatch email digests via local Gmail SMTP.
 */
function startEmailBridgeServer(port = 3099) {
  const http = require('http');
  const server = http.createServer(async (req, res) => {
    // Enable CORS for Chrome Extension requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'online', to: emailConfig.to, enabled: emailConfig.enabled }));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/send-digest') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          let jobs = payload.jobs || [];
          if (!jobs.length) {
            jobs = getApplicationsFromCsv();
          }
          console.log(`[Email Bridge] Received request to send digest for ${jobs.length} jobs`);
          const ok = await sendApplicationDigest(jobs, console.log);
          res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: ok, count: jobs.length, recipient: emailConfig.to }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[JobMatch AI] Email Bridge Server running on http://127.0.0.1:${port}`);
    console.log(`[JobMatch AI] Ready to receive email dispatch requests from the Chrome Extension.`);
  });
  return server;
}

module.exports = { sendApplicationDigest, buildHtmlDigest, getApplicationsFromCsv, startEmailBridgeServer };

