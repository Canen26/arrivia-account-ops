require('dotenv').config();
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const axios = require('axios');
const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_TABLE = `${SUPABASE_URL}/rest/v1/submissions`;

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function dbLoad() {
  try {
    const { data } = await axios.get(`${SUPABASE_TABLE}?order=submitted_at.desc&limit=500`, { headers: sbHeaders() });
    return data.map(r => ({
      id:            r.id,
      submittedAt:   r.submitted_at,
      employeeName:  r.employee_name,
      employeeEmail: r.employee_email,
      requestTitle:  r.request_title,
      typeOfRequest: r.type_of_request,
      adoId:         r.ado_id,
      adoUrl:        r.ado_url,
      adoSuccess:    r.ado_success,
      adoError:      r.ado_error,
      emailSuccess:  r.email_success,
      emailError:    r.email_error
    }));
  } catch (e) {
    console.error('Failed to load submissions from Supabase:', e.message);
    return [];
  }
}

function dbInsert(log) {
  return axios.post(SUPABASE_TABLE, {
    id:            log.id,
    submitted_at:  log.submittedAt,
    employee_name: log.employeeName,
    employee_email: log.employeeEmail,
    request_title: log.requestTitle,
    type_of_request: log.typeOfRequest,
    ado_id:        log.adoId,
    ado_url:       log.adoUrl,
    ado_success:   log.adoSuccess,
    ado_error:     log.adoError,
    email_success: log.emailSuccess,
    email_error:   log.emailError
  }, { headers: sbHeaders({ Prefer: 'return=minimal' }) })
  .catch(e => console.error('Supabase insert failed:', e.message));
}

function dbUpdate(log) {
  return axios.patch(`${SUPABASE_TABLE}?id=eq.${log.id}`, {
    ado_id:        log.adoId,
    ado_url:       log.adoUrl,
    ado_success:   log.adoSuccess,
    ado_error:     log.adoError,
    email_success: log.emailSuccess,
    email_error:   log.emailError
  }, { headers: sbHeaders({ Prefer: 'return=minimal' }) })
  .catch(e => console.error('Supabase update failed:', e.message));
}

let submissions = [];

const upload = multer({ storage: multer.memoryStorage() });

const ADO_ORG = 'arrivia';
const ADO_PROJECT = 'SoftEng';
const ADO_WORK_ITEM_TYPE = 'Account Operations';

// Ordered field map — determines description/email order
const FIELD_ORDER = [
  { key: 'employeeName',               label: 'Arrivia Employee Name' },
  { key: 'employeeEmail',              label: 'Arrivia Employee Email' },
  { key: 'requestingDepartment',       label: 'Requesting Department' },
  { key: 'requestTitle',               label: 'Request Title' },
  { key: 'typeOfRequest',              label: 'Type of Request' },
  // Add Cert / Currency
  { key: 'accountNumber',              label: 'Account Number' },
  { key: 'certOrCurrency',             label: 'Certificate or Currency' },
  { key: 'certName',                   label: 'Certificate Name / Number / Cert Master ID' },
  { key: 'currencyDetails',            label: 'Currency Details' },
  // Audit
  { key: 'auditDetails',               label: 'Audit Details' },
  // Account Correction
  { key: 'crmType',                    label: 'CRM Type' },
  { key: 'correctionAccountNumber',    label: 'Account Number (Correction)' },
  { key: 'reproSteps',                 label: 'Repro Steps and Details' },
  // Affiliate Pin
  { key: 'affiliatePinPurpose',        label: 'Affiliate Pin Purpose' },
  { key: 'memberClassName',            label: 'Member Class Name and ID' },
  { key: 'affiliatePinDescription',    label: 'Description' },
  // Cert Master
  { key: 'certMasterDescription',      label: 'Description' },
  // Demo Account
  { key: 'demoClubName',               label: 'Demo Club Name' },
  { key: 'demoTierLevel',              label: 'Demo Tier Level' },
  { key: 'demoContactInfo',            label: 'Demo Account Contact Information' },
  { key: 'demoAdditionalItems',        label: 'Additional Currencies / Certs' },
  // Display Option
  { key: 'displayOptionPurpose',       label: 'Display Option Purpose' },
  { key: 'displayOptionNewOrModify',   label: 'New or Modify Display Option' },
  // Existing Partner
  { key: 'existingPartnerDescription', label: 'Existing Partner Changes Description' },
  // Membership Product Builds
  { key: 'tierLevels',                 label: 'Tier Levels / MemberClass' },
  { key: 'closingTools',               label: 'Closing Tools Needed' },
  { key: 'payInFull',                  label: 'Pay in Full Incentives Needed' },
  { key: 'dpp',                        label: 'DPP Needed' },
  // New Partner
  { key: 'accountManager',             label: 'Account Manager' },
  { key: 'partnerName',                label: 'Partner Name' },
  { key: 'programName',                label: 'Program Name' },
  { key: 'membershipSales',            label: 'Membership Sales' },
  { key: 'enrollmentSetup',            label: 'Enrollment Setup' },
  { key: 'nationalMemberClasses',      label: 'National Member Classes' },
  { key: 'hasDomains',                 label: 'Has Domains' },
  { key: 'hasPhoneNumbers',            label: 'Has Phone Numbers' },
  { key: 'newBuildDescription',        label: 'New Build Requirements' },
  // Travel SSL / Bindings
  { key: 'sslOrBindings',              label: 'SSL Certificates or Bindings' },
  { key: 'sslClubIds',                 label: 'Club ID(s)' },
  { key: 'sslUrl',                     label: 'URL' },
  // Travel Club Changes
  { key: 'travelChangeType',           label: 'Type of Changes' },
  { key: 'travelClubIds',              label: 'Club ID(s) for Request' },
  { key: 'travelChangeDescription',    label: 'Description of Changes' },
  // Travel Audit
  { key: 'auditType',                  label: 'Audit Type' },
  { key: 'additionalInfo',             label: 'Additional Information' },
  { key: 'otherDescription',           label: 'Request Details' },
  { key: 'generalNotes',               label: 'Additional Information' },
  // Always last
  { key: 'estimatedCompletion',        label: 'Estimated Date of Completion' }
];

function formatFieldValue(key, value) {
  if (key === 'estimatedCompletion' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${m}/${d}/${y}`;
  }
  return value.replace(/\n/g, '<br>');
}

function buildHtmlDescription(formData) {
  return FIELD_ORDER
    .filter(f => formData[f.key])
    .map(f => `<p><strong>${f.label}:</strong> ${formatFieldValue(f.key, formData[f.key])}</p>`)
    .join('\n');
}

function buildEmailHtml(formData, workItemId, workItemUrl) {
  const rows = FIELD_ORDER
    .filter(f => formData[f.key])
    .map(f => `<tr><td style="font-weight:bold;padding:6px 16px 6px 0;vertical-align:top;white-space:nowrap;width:1%;">${f.label}:</td><td style="padding:6px 0;vertical-align:top;">${formatFieldValue(f.key, formData[f.key])}</td></tr>`)
    .join('\n');

  return `
<div style="font-family:Arial,sans-serif;color:#333;max-width:700px;">
  <div style="background:#002E5D;color:white;padding:20px 24px 28px;border-radius:6px 6px 0 0;">
    <h2 style="margin:0;font-size:1.3rem;">New Account Operations Request</h2>
  </div>
  <div style="background:#f5f7fa;padding:28px 24px 18px;border:1px solid #dde3ec;border-top:none;">
    <p style="margin:0;">A new ADO ticket has been created:
      <a href="${workItemUrl}" style="color:#0070C0;font-weight:bold;">Work Item #${workItemId}</a>
    </p>
  </div>
  <div style="padding:20px 24px;border:1px solid #dde3ec;border-top:none;border-radius:0 0 6px 6px;">
    <table style="border-collapse:collapse;width:auto;">
      ${rows}
    </table>
  </div>
  <p style="font-size:0.8rem;color:#888;margin-top:12px;">Account Operations Powered by Arrivia</p>
</div>`;
}

function getAdoAuthHeader() {
  const encoded = Buffer.from(`:${process.env.ADO_PAT}`).toString('base64');
  return `Basic ${encoded}`;
}

async function createWorkItem(title, description) {
  const url = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/$${encodeURIComponent(ADO_WORK_ITEM_TYPE)}?api-version=7.1`;

  const body = [
    { op: 'add', path: '/fields/System.Title',         value: title },
    { op: 'add', path: '/fields/System.State',         value: 'New' },
    { op: 'add', path: '/fields/System.AreaPath',      value: `${ADO_PROJECT}\\${ADO_WORK_ITEM_TYPE}` },
    { op: 'add', path: '/fields/System.IterationPath', value: ADO_PROJECT },
    { op: 'add', path: '/fields/System.Description',   value: description }
  ];

  const { data } = await axios.patch(url, body, {
    headers: {
      Authorization:   getAdoAuthHeader(),
      'Content-Type':  'application/json-patch+json'
    }
  });
  return data;
}

async function uploadAttachment(filename, buffer) {
  const url = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/attachments?fileName=${encodeURIComponent(filename)}&api-version=7.1`;
  const { data } = await axios.post(url, buffer, {
    headers: {
      Authorization:  getAdoAuthHeader(),
      'Content-Type': 'application/octet-stream'
    },
    maxContentLength: Infinity,
    maxBodyLength:    Infinity
  });
  return data;
}

async function addAttachmentToWorkItem(workItemId, attachmentUrl, filename) {
  const url = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
  const body = [{
    op: 'add',
    path: '/relations/-',
    value: { rel: 'AttachedFile', url: attachmentUrl, attributes: { comment: filename } }
  }];
  const { data } = await axios.patch(url, body, {
    headers: {
      Authorization:  getAdoAuthHeader(),
      'Content-Type': 'application/json-patch+json'
    }
  });
  return data;
}

async function sendEmails(formData, workItemId, workItemUrl) {
  const requesterEmail = (formData.employeeEmail || '').trim();

  const recipients = new Set([
    'sandra.canen@arrivia.com',
    'elizabeth.lampe@arrivia.com'
  ]);
  if (requesterEmail) recipients.add(requesterEmail.toLowerCase());

  const to = Array.from(recipients).map(email => ({ email }));

  const payload = {
    personalizations: [{ to }],
    from:     { email: 'arriviaoperations@gmail.com', name: 'Arrivia Account Operations' },
    reply_to: { email: 'account.operations@arrivia.com' },
    subject:  `New Account Operations Form Submitted - ${formData.typeOfRequest || ''}`,
    content:  [{ type: 'text/html', value: buildEmailHtml(formData, workItemId, workItemUrl) }]
  };

  const { data } = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
    headers: {
      Authorization:  `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 20000
  });
  return data;
}

app.post('/submit', upload.array('attachments'), async (req, res) => {
  const formData = JSON.parse(req.body.formData || '{}');

  const log = {
    id:            Date.now(),
    submittedAt:   new Date().toISOString(),
    employeeName:  formData.employeeName  || '',
    employeeEmail: formData.employeeEmail || '',
    requestTitle:  formData.requestTitle  || '',
    typeOfRequest: formData.typeOfRequest || '',
    adoId:         null,
    adoUrl:        null,
    adoSuccess:    false,
    adoError:      null,
    emailSuccess:  false,
    emailError:    null
  };
  submissions.unshift(log);
  if (submissions.length > 500) submissions.pop();
  dbInsert(log);

  try {
    const files       = req.files || [];
    const title       = formData.requestTitle || 'New Account Operations Request';
    const description = buildHtmlDescription(formData);

    const workItem    = await createWorkItem(title, description);
    log.adoId      = workItem.id;
    log.adoUrl     = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_workitems/edit/${workItem.id}`;
    log.adoSuccess = true;

    for (const file of files) {
      try {
        const att = await uploadAttachment(file.originalname, file.buffer);
        await addAttachmentToWorkItem(workItem.id, att.url, file.originalname);
      } catch (e) {
        console.error(`Attachment failed (${file.originalname}):`, e.message);
      }
    }

    try {
      await sendEmails(formData, workItem.id, log.adoUrl);
      log.emailSuccess = true;
    } catch (e) {
      log.emailError = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      console.error('Email failed:', log.emailError);
    }

    dbUpdate(log);
    res.json({ success: true, workItemId: workItem.id, workItemUrl: log.adoUrl,
               emailStatus: log.emailSuccess ? 'sent' : log.emailError });
  } catch (err) {
    log.adoError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('Submit error:', log.adoError);
    dbUpdate(log);
    res.status(500).json({ success: false, error: 'Submission failed. Please contact Account Operations directly.' });
  }
});

app.get('/monitor', (req, res) => {
  res.sendFile(path.join(__dirname, 'monitor.html'));
});

app.get('/api/submissions', (req, res) => {
  if (req.query.key !== (process.env.MONITOR_KEY || 'accountops2026')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json(submissions);
});

const PORT = process.env.PORT || 3000;
dbLoad().then(rows => {
  submissions.push(...rows);
  console.log(`Loaded ${submissions.length} submission(s) from Supabase`);
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
});
