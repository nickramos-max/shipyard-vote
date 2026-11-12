/**
 * Shipyard Halloween Pet Photo Shoot: voting backend
 *
 * Setup (one time):
 *   1. Create a new Google Sheet. Extensions > Apps Script.
 *   2. Replace everything in Code.gs with this file. Save.
 *   3. Pick "setup" in the function dropdown and click Run. Approve access.
 *   4. Deploy > New deployment > type "Web app".
 *        Execute as: Me    Who has access: Anyone
 *      Copy the Web app URL and paste it into index.html (SCRIPT_URL).
 *
 * Sheets this creates:
 *   Dogs      : one row per pet. Name, Caption, Photo URL, Show (checkbox).
 *   Votes     : every ballot. One per email.
 *   Results   : live leaderboard (1st = 3 pts, 2nd = 2 pts, 3rd = 1 pt).
 *   Settings  : "Voting open" checkbox. Untick to close voting.
 */

const SHEET_DOGS = 'Dogs';
const SHEET_VOTES = 'Votes';
const SHEET_RESULTS = 'Results';
const SHEET_SETTINGS = 'Settings';

/* ---------- one-time setup ---------- */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const dogs = getOrCreate_(ss, SHEET_DOGS);
  if (dogs.getLastRow() === 0) {
    dogs.appendRow(['Name', 'Caption', 'Photo URL', 'Show']);
    dogs.appendRow(['Example Pup', 'Delete this row and add your pets', '', true]);
    dogs.getRange('D2:D200').insertCheckboxes();
    dogs.setFrozenRows(1);
    dogs.getRange('A1:D1').setFontWeight('bold');
    dogs.setColumnWidth(1, 160);
    dogs.setColumnWidth(2, 260);
    dogs.setColumnWidth(3, 420);
  }

  const votes = getOrCreate_(ss, SHEET_VOTES);
  if (votes.getLastRow() === 0) {
    votes.appendRow(['Timestamp', 'Name', 'Email', '1st place', '2nd place', '3rd place']);
    votes.setFrozenRows(1);
    votes.getRange('A1:F1').setFontWeight('bold');
  }

  const settings = getOrCreate_(ss, SHEET_SETTINGS);
  if (settings.getLastRow() === 0) {
    settings.getRange('A1:B1').setValues([['Voting open', true]]);
    settings.getRange('B1').insertCheckboxes().setValue(true);
    settings.getRange('A1').setFontWeight('bold');
  }

  const results = getOrCreate_(ss, SHEET_RESULTS);
  results.clear();
  results.getRange('A1:E1')
    .setValues([['Pet', '1st place votes', '2nd place votes', '3rd place votes', 'Points']])
    .setFontWeight('bold');
  results.setFrozenRows(1);
  // Sorted by points, ties broken by most 1st place votes, then most 2nd.
  results.getRange('A2').setFormula(
    '=IFERROR(SORT(FILTER({' +
      'Dogs!A2:A,' +
      'COUNTIF(Votes!D:D,Dogs!A2:A),' +
      'COUNTIF(Votes!E:E,Dogs!A2:A),' +
      'COUNTIF(Votes!F:F,Dogs!A2:A),' +
      '3*COUNTIF(Votes!D:D,Dogs!A2:A)+2*COUNTIF(Votes!E:E,Dogs!A2:A)+COUNTIF(Votes!F:F,Dogs!A2:A)' +
    '},Dogs!A2:A<>""),5,FALSE,2,FALSE,3,FALSE),"No pets yet")'
  );
  results.setColumnWidth(1, 180);

  ss.setActiveSheet(dogs);
}

function getOrCreate_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/* ---------- web endpoints ---------- */

// GET: returns the pet list and whether voting is open.
function doGet() {
  return json_({ ok: true, open: isOpen_(), pets: getPets_() });
}

// POST: records a ballot. Body is JSON text: {name, email, picks:[first, second, third]}
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  }

  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  const picks = Array.isArray(body.picks) ? body.picks.map(p => String(p || '').trim()) : [];

  if (!isOpen_()) return json_({ ok: false, error: 'Voting is closed. Thanks for stopping by!' });
  if (!name) return json_({ ok: false, error: 'Please enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json_({ ok: false, error: 'Please enter a valid email.' });
  }

  const validNames = getPets_().map(p => p.name);
  const needed = Math.min(3, validNames.length);
  const chosen = picks.slice(0, needed);
  if (chosen.length < needed || chosen.some(p => !p)) {
    return json_({ ok: false, error: 'Please pick your top ' + needed + '.' });
  }
  if (new Set(chosen).size !== chosen.length) {
    return json_({ ok: false, error: 'Each pick has to be a different pet.' });
  }
  if (chosen.some(p => validNames.indexOf(p) === -1)) {
    return json_({ ok: false, error: 'The lineup changed. Refresh the page and vote again.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const votes = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_VOTES);
    const last = votes.getLastRow();
    if (last > 1) {
      const emails = votes.getRange(2, 3, last - 1, 1).getValues();
      if (emails.some(r => String(r[0]).trim().toLowerCase() === email)) {
        return json_({ ok: false, duplicate: true, error: 'Looks like this email already voted. One ballot per person!' });
      }
    }
    votes.appendRow([new Date(), name, email, chosen[0] || '', chosen[1] || '', chosen[2] || '']);
  } finally {
    lock.releaseLock();
  }

  return json_({ ok: true });
}

/* ---------- helpers ---------- */

function getPets_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DOGS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues()
    .filter(r => String(r[0]).trim() && r[3] !== false)
    .map(r => ({
      name: String(r[0]).trim(),
      caption: String(r[1] || '').trim(),
      photo: toImageUrl_(String(r[2] || '').trim())
    }));
}

function isOpen_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  return !s || s.getRange('B1').getValue() !== false;
}

// Turns Google Drive and Dropbox share links into direct image links.
function toImageUrl_(url) {
  if (!url) return '';
  let m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
          url.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([\w-]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  if (/dropbox\.com/.test(url)) {
    url = url.replace(/([?&])dl=0/, '$1raw=1');
    if (!/[?&]raw=1/.test(url)) url += (url.indexOf('?') === -1 ? '?' : '&') + 'raw=1';
    return url;
  }
  return url;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
