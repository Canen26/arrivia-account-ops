require('dotenv').config({ path: require('path').join(process.execPath ? require('path').dirname(process.execPath) : __dirname, '.env') });
const { exec } = require('child_process');
const path = require('path');
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const axios = require('axios');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from same directory as the exe
const staticDir = process.pkg ? path.dirname(process.execPath) : __dirname;
app.use(express.static(staticDir));
app.use(express.static(__dirname)); // fallback for dev mode

const upload = multer({ storage: multer.memoryStorage() });

const ADO_ORG           = 'arrivia';
const ADO_PROJECT       = 'SoftEng';
const ADO_WORK_ITEM_TYPE = 'Account Operations';

const FIELD_ORDER = [
  { key: 'employeeName',               label: 'Arrivia Employee Name' },
  { key: 'employeeEmail',              label: 'Arrivia Employee Email' },
  { key: 'requestingDepartment',       label: 'Requesting Department' },
  { key: 'requestTitle',               label: 'Request Title' },
  { key: 'typeOfRequest',              label: 'Type of Request' },
  { key: 'accountNumber',              label: 'Account Number' },
  { key: 'certOrCurrency',             label: 'Certificate or Currency' },
  { key: 'certName',                   label: 'Certificate Name / Number / Cert Master ID' },
  { key: 'currencyDetails',            label: 'Currency Details' },
  { key: 'auditDetails',               label: 'Audit Details' },
  { key: 'crmType',                    label: 'CRM Type' },
  { key: 'correctionAccountNumber',    label: 'Account Number (Correction)' },
  { key: 'reproSteps',                 label: 'Repro Steps and Details' },
  { key: 'affiliatePinPurpose',        label: 'Affiliate Pin Purpose' },
  { key: 'memberClassName',            label: 'Member Class Name and ID' },
  { key: 'affiliatePinDescription',    label: 'Description' },
  { key: 'certMasterDescription',      label: 'Description' },
  { key: 'demoClubName',               label: 'Demo Club Name' },
  { key: 'demoTierLevel',              label: 'Demo Tier Level' },
  { key: 'demoContactInfo',            label: 'Demo Account Contact Information' },
  { key: 'demoAdditionalItems',        label: 'Additional Currencies / Certs' },
  { key: 'displayOptionPurpose',       label: 'Display Option Purpose' },
  { key: 'displayOptionNewOrModify',   label: 'New or Modify Display Option' },
  { key: 'existingPartnerDescription', label: 'Existing Partner Changes Description' },
  { key: 'tierLevels',                 label: 'Tier Levels / MemberClass' },
  { key: 'closingTools',               label: 'Closing Tools Needed' },
  { key: 'payInFull',                  label: 'Pay in Full Incentives Needed' },
  { key: 'dpp',                        label: 'DPP Needed' },
  { key: 'accountManager',             label: 'Account Manager' },
  { key: 'partnerName',                label: 'Partner Name' },
  { key: 'programName',                label: 'Program Name' },
  { key: 'membershipSales',            label: 'Membership Sales' },
  { key: 'enrollmentSetup',            label: 'Enrollment Setup' },
  { key: 'nationalMemberClasses',      label: 'National Member Classes' },
  { key: 'hasDomains',                 label: 'Has Domains' },
  { key: 'hasPhoneNumbers',            label: 'Has Phone Numbers' },
  { key: 'newBuildDescription',        label: 'New Build Requirements' },
  { key: 'sslOrBindings',              label: 'SSL Certificates or Bindings' },
  { key: 'sslClubIds',                 label: 'Club ID(s)' },
  { key: 'sslUrl',                     label: 'URL' },
  { key: 'travelChangeType',           label: 'Type of Changes' },
  { key: 'travelClubIds',              label: 'Club ID(s) for Request' },
  { key: 'travelChangeDescription',    label: 'Description of Changes' },
  { key: 'auditType',                  label: 'Audit Type' },
  { key: 'additionalInfo',             label: 'Additional Information' },
  { key: 'estimatedCompletion',        label: 'Estimated Date of Completion' }
];

function buildHtmlDescription(formData) {
  return FIELD_ORDER
    .filter(f => formData[f.key])
    .map(f => `<p><strong>${f.label}:</strong> ${formData[f.key].replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

function buildEmailHtml(formData, workItemId, workItemUrl) {
  const rows = FIELD_ORDER
    .filter(f => formData[f.key])
    .map(f => `<tr><td style="font-weight:bold;padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap;">${f.label}:</td><td style="padding:6px 0;">${formData[f.key].replace(/\n/g, '<br>')}</td></tr>`)
    .join('\n');
  return `
<div style="font-family:Arial,sans-serif;color:#333;max-width:700px;">
  <div style="background:#002E5D;color:white;padding:20px 24px;border-radius:6px 6px 0 0;">
    <h2 style="margin:0;font-size:1.3rem;">New Account Operations Request</h2>
  </div>
  <div style="background:#f5f7fa;padding:16px 24px;border:1px solid #dde3ec;border-top:none;">
    <p style="margin:0;">ADO ticket created: <a href="${workItemUrl}" style="color:#0070C0;font-weight:bold;">Work Item #${workItemId}</a></p>
  </div>
  <div style="padding:20px 24px;border:1px solid #dde3ec;border-top:none;border-radius:0 0 6px 6px;">
    <table style="border-collapse:collapse;width:100%;">${rows}</table>
  </div>
  <p style="font-size:0.8rem;color:#888;margin-top:12px;">Account Operations Powered by Arrivia</p>
</div>`;
}

function getAdoAuthHeader() {
  return `Basic ${Buffer.from(`:${process.env.ADO_PAT}`).toString('base64')}`;
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
    headers: { Authorization: getAdoAuthHeader(), 'Content-Type': 'application/json-patch+json' }
  });
  return data;
}

async function uploadAttachment(filename, buffer) {
  const url = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/attachments?fileName=${encodeURIComponent(filename)}&api-version=7.1`;
  const { data } = await axios.post(url, buffer, {
    headers: { Authorization: getAdoAuthHeader(), 'Content-Type': 'application/octet-stream' },
    maxContentLength: Infinity, maxBodyLength: Infinity
  });
  return data;
}

async function addAttachmentToWorkItem(workItemId, attachmentUrl, filename) {
  const url = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
  const { data } = await axios.patch(url, [{
    op: 'add', path: '/relations/-',
    value: { rel: 'AttachedFile', url: attachmentUrl, attributes: { comment: filename } }
  }], { headers: { Authorization: getAdoAuthHeader(), 'Content-Type': 'application/json-patch+json' } });
  return data;
}

async function sendEmails(formData, workItemId, workItemUrl) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  const requesterEmail = (formData.employeeEmail || '').trim();
  const to = new Set(['Sandra.canen@arrivia.com', 'elizabeth.lampe@arrivia.com']);
  if (requesterEmail.toLowerCase().endsWith('@arrivia.com')) to.add(requesterEmail);
  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      Array.from(to).join(', '),
    subject: `New Account Operations Form Submitted - ${formData.typeOfRequest || ''}`,
    html:    buildEmailHtml(formData, workItemId, workItemUrl)
  });
}

app.post('/submit', upload.array('attachments'), async (req, res) => {
  try {
    const formData = JSON.parse(req.body.formData || '{}');
    const files    = req.files || [];
    const title    = formData.requestTitle || 'New Account Operations Request';
    const desc     = buildHtmlDescription(formData);
    const workItem = await createWorkItem(title, desc);
    const id       = workItem.id;
    const url      = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_workitems/edit/${id}`;
    for (const file of files) {
      try {
        const att = await uploadAttachment(file.originalname, file.buffer);
        await addAttachmentToWorkItem(id, att.url, file.originalname);
      } catch (e) { console.error(`Attachment failed: ${e.message}`); }
    }
    await sendEmails(formData, id, url);
    res.json({ success: true, workItemId: id, workItemUrl: url });
  } catch (err) {
    console.error('Submit error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Submission failed. Please contact Account Operations.' });
  }
});

app.listen(PORT, () => {
  console.log(`Account Operations Form running at http://localhost:${PORT}`);
  // Auto-open the browser
  exec(`start http://localhost:${PORT}`);
});
