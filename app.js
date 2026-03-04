// ── DYNAMIC DATA (loaded from data/lists.xlsx) ────────────────────────────────
let TEAM = [], CONTACTS = [], CARS = [];
let LIST_SITE_TYPES = [], LIST_PROJECTS = [], LIST_SUB_CONTRACTORS = [];

// Populate the three shared datalists from the loaded arrays
function populateDatalists() {
  function fill(id, items) {
    const dl = document.getElementById(id);
    if (!dl) return;
    dl.innerHTML = items.map(v => `<option value="${v.replace(/"/g,'&quot;')}">`).join('');
  }
  fill('teamNames',    TEAM.map(t => t.name));
  fill('driverNames',  CARS.map(c => c.name));
  fill('contactNames', CONTACTS.map(c => c.name));
}

// Apply loaded dropdown options to a single site block
function applyDropdownOptions(block) {
  function fill(name, items, placeholder) {
    const sel = block.querySelector(`select[name="${name}"]`);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">${placeholder}</option>` +
      items.map(v => `<option>${v}</option>`).join('');
    if (cur) sel.value = cur;
  }
  fill('siteType',      LIST_SITE_TYPES,      'Select type…');
  fill('projectName',   LIST_PROJECTS,         'Select project…');
  fill('subContractor', LIST_SUB_CONTRACTORS,  'Select sub-contractor…');
}

// Load data/lists.xlsx via SheetJS and populate all dropdowns
async function loadListsData() {
  const overlay = document.getElementById('lists-loading');
  const card    = document.getElementById('ll-card-inner');
  try {
    console.log('[DailyPlan] Fetching data/lists.xlsx…');
    const resp = await fetch('data/lists.xlsx');
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);
    const arrayBuffer = await resp.arrayBuffer();
    const workbook    = XLSX.read(arrayBuffer, { type: 'array' });
    console.log('[DailyPlan] Sheets:', workbook.SheetNames);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    console.log('[DailyPlan] Sheet ref:', sheet['!ref']);

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header:  1,
      defval:  '',
      range:   0
    });
    console.log('[DailyPlan] Rows parsed:', rows.length);

    // Reset arrays
    TEAM = []; CONTACTS = []; CARS = [];
    LIST_SUB_CONTRACTORS = []; LIST_SITE_TYPES = []; LIST_PROJECTS = [];

    // Row 0 is the header; data starts at index 1
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];

      // Col 0: Site Engineer name, Col 1: Phone (may be stored as a number)
      const teamName = String(r[0] || '').trim();
      if (teamName) {
        const raw = r[1];
        // Numeric Egyptian mobile: 10 digits stored without leading 0
        const mob = (typeof raw === 'number')
          ? '0' + String(raw)
          : String(raw || '').trim();
        TEAM.push({ name: teamName, mob });
      }

      // Col 4: Contact Person, Col 5: Phone
      const contactName = String(r[4] || '').trim();
      if (contactName) CONTACTS.push({ name: contactName, mob: String(r[5] || '').trim() });

      // Col 7: Sub-Contractor
      const sub = String(r[7] || '').trim();
      if (sub && !LIST_SUB_CONTRACTORS.includes(sub)) LIST_SUB_CONTRACTORS.push(sub);

      // Col 8: Site Type
      const stype = String(r[8] || '').trim();
      if (stype && !LIST_SITE_TYPES.includes(stype)) LIST_SITE_TYPES.push(stype);

      // Col 9: Project Name
      const proj = String(r[9] || '').trim();
      if (proj && !LIST_PROJECTS.includes(proj)) LIST_PROJECTS.push(proj);

      // Col 11: Driver Name, Col 12: Car Plate No.
      const driverName = String(r[11] || '').trim();
      if (driverName) CARS.push({ name: driverName, plate: String(r[12] || '').trim() });
    }

    console.log('[DailyPlan] Loaded — TEAM:', TEAM.length,
      '| CONTACTS:', CONTACTS.length, '| CARS:', CARS.length,
      '| SiteTypes:', LIST_SITE_TYPES.length, '| Projects:', LIST_PROJECTS.length,
      '| SubContractors:', LIST_SUB_CONTRACTORS.length);

    populateDatalists();
    document.querySelectorAll('.site-block').forEach(applyDropdownOptions);
    overlay.classList.add('hidden');

  } catch (err) {
    console.error('[DailyPlan] loadListsData error:', err);
    card.innerHTML =
      `<div class="ll-error-icon">⚠️</div>` +
      `<div class="ll-error-title">Could not load dropdown data</div>` +
      `<div class="ll-error-msg">Make sure <code>data/lists.xlsx</code> exists next to this file.<br>${err.message}</div>` +
      `<button class="ll-retry" onclick="loadListsData()">Retry</button>`;
  }
}


// ── SETTINGS ──────────────────────────────────────────────────────────────────
function openSettings() {
  const coordList = document.getElementById('settCoordList');
  coordList.innerHTML = CONTACTS.map(c => `<option value="${c.name}">`).join('');
  _restoreSettingsUI();
  document.getElementById('settingsPanel').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsPanel').classList.remove('open');
}

function _restoreSettingsUI() {
  const coord = _getSavedCoord();
  document.getElementById('settCoordName').value  = coord ? coord.name  : '';
  document.getElementById('settCoordPhone').value = coord ? coord.phone : '';
  const showCoord = !!(coord && coord.name);
  document.getElementById('coordSavedBadge').classList.toggle('visible', showCoord);
}

function _getSavedCoord() { try { return JSON.parse(localStorage.getItem('defaultCoordinator')); } catch(e) { return null; } }
function _getSavedEng()   { try { return JSON.parse(localStorage.getItem('defaultEngineer'));   } catch(e) { return null; } }

function onSettCoordInput() {
  const name  = document.getElementById('settCoordName').value.trim();
  const match = CONTACTS.find(c => c.name === name);
  document.getElementById('settCoordPhone').value = match ? match.mob : '';
}

function saveCoordinator() {
  const name  = document.getElementById('settCoordName').value.trim();
  const phone = document.getElementById('settCoordPhone').value.trim();
  if (!name) { showToast('Enter a coordinator name first', 'error'); return; }
  localStorage.setItem('defaultCoordinator', JSON.stringify({ name, phone }));
  document.getElementById('coordSavedBadge').classList.add('visible');
  showToast('✓ Default coordinator saved', 'success');
}

// Apply saved defaults to a freshly-created (empty) site block
function applyDefaultContacts(block) {
  const coord = _getSavedCoord();
  if (coord && coord.name) {
    const nf = block.querySelector('[name="contactName"]');
    const mf = block.querySelector('[name="contactMob"]');
    if (nf) nf.value = coord.name;
    if (mf) mf.value = coord.phone || '';
  }
  const eng = _getSavedEng();
  if (eng && eng.name) {
    const nf = block.querySelector('[name="supervisorName"]');
    const mf = block.querySelector('[name="supervisorMob"]');
    if (nf) nf.value = eng.name;
    if (mf) mf.value = eng.phone || '';
  }
}

// Close settings panel when clicking the backdrop
document.getElementById('settingsPanel').addEventListener('click', function(e) {
  if (e.target === this) closeSettings();
});

// ── DATE ──────────────────────────────────────────────────────────────────────
const today   = new Date();
const yyyy    = today.getFullYear();
const mm      = String(today.getMonth()+1).padStart(2,'0');
const dd      = String(today.getDate()).padStart(2,'0');
const todayStr = `${yyyy}-${mm}-${dd}`;
document.getElementById('header-date').textContent =
  today.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});

// ── ACCORDION TOGGLE ──────────────────────────────────────────────────────────
function toggleBlock(headerEl) {
  const block = headerEl.closest('.site-block');
  block.classList.toggle('site-block-open');
}

// ── SUMMARY PILLS (live update as user types) ─────────────────────────────────
function updateSummary(inputEl) {
  const block = inputEl.closest('.site-block');
  refreshSummary(block);
}

function refreshSummary(block) {
  const idVal       = (block.querySelector('[name=siteId]')?.value || '').trim();
  const dateVal     = (block.querySelector('[name=date]')?.value   || '').trim();
  const priority    = (block.querySelector('.riskPriorityInput')?.value || '').trim();
  const permission  = (block.querySelector('.permissionInput')?.value   || '').trim();

  const idPill   = block.querySelector('.summary-id');
  const datePill = block.querySelector('.summary-date');
  const priPill  = block.querySelector('.summary-priority');

  // ID pill
  if (idVal) { idPill.textContent = idVal; idPill.classList.remove('empty'); }
  else        { idPill.textContent = 'No Site ID'; idPill.classList.add('empty'); }

  // Date pill
  if (dateVal) {
    const d = new Date(dateVal + 'T00:00:00');
    datePill.textContent = d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    datePill.classList.remove('empty');
  } else { datePill.textContent = 'No Date'; datePill.classList.add('empty'); }

  // Priority pill — show count of selected risks
  const count = parseInt(priority) || 0;
  if (count > 0) {
    priPill.textContent = `${count} Risk${count > 1 ? 's' : ''}`;
    priPill.style.display = '';
    priPill.classList.add('red');
  } else { priPill.style.display = 'none'; }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function getSiteBlock(el) { return el.closest('.site-block'); }

function toggleRisk(label) {
  event.preventDefault();
  const cb = label.querySelector('input[type=checkbox]');
  cb.checked = !cb.checked;
  label.classList.toggle('checked', cb.checked);

  // Count selected risks and update display
  const block = getSiteBlock(label);
  const count = block.querySelectorAll('.risk-item input[type=checkbox]:checked').length;
  const numEl = block.querySelector('.risk-count-num');
  const hiddenInput = block.querySelector('.riskPriorityInput');
  numEl.textContent = count;
  numEl.classList.toggle('zero', count === 0);
  if (hiddenInput) hiddenInput.value = count;
  refreshSummary(block);
}

function setToggle(btn) {
  const block = getSiteBlock(btn);
  block.querySelector('.permissionInput').value = btn.textContent.trim();
  btn.closest('.toggle-group').querySelectorAll('.toggle-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${type}`;
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

// ── SITE MANAGEMENT ───────────────────────────────────────────────────────────
function createSiteBlock(animate) {
  const tpl   = document.getElementById('site-block-template');
  const node  = tpl.content.cloneNode(true);
  const block = node.querySelector('.site-block');
  block.querySelectorAll('.dateField').forEach(f => f.value = todayStr);
  if (animate) block.classList.add('site-block-new');
  applyDropdownOptions(block);
  applyDefaultContacts(block);
  refreshSummary(block);
  return block;
}

function addSite() {
  // Collapse all existing open blocks for a cleaner view
  document.querySelectorAll('.site-block.site-block-open').forEach(b =>
    b.classList.remove('site-block-open'));

  const block = createSiteBlock(true);
  document.getElementById('sites-container').appendChild(block);
  updateSiteUI();
  setTimeout(() => block.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function removeSite(btn) {
  const block = getSiteBlock(btn);
  if (document.querySelectorAll('.site-block').length <= 1) return;
  showConfirm(
    'Remove this site from the plan? This cannot be undone.',
    'Remove',
    () => {
      block.style.transition = 'opacity 0.2s, transform 0.2s';
      block.style.opacity    = '0';
      block.style.transform  = 'translateY(-8px)';
      setTimeout(() => { block.remove(); updateSiteUI(); }, 220);
    }
  );
}

// ── SITE ID AUTO-FILL ────────────────────────────────────────────────────────
// Type a site number in the Site ID field then leave the field (or press Enter).
// ── SITE ID TYPEAHEAD ──────────────────────────────────────────────────────────
let _siteKeys = null;
const _siteAc = { inp: null };

function hideSiteAc() {
  const el = document.getElementById('siteAc');
  el.classList.remove('open');
  el.innerHTML = '';
  _siteAc.inp = null;
}

function positionSiteAc(inp) {
  const el = document.getElementById('siteAc');
  const r  = inp.getBoundingClientRect();
  el.style.left  = r.left + 'px';
  el.style.top   = (r.bottom + 4) + 'px';
  el.style.width = Math.max(r.width, 220) + 'px';
}

function showSiteAc(inp) {
  if (typeof SITES === 'undefined') return;
  const q = inp.value.trim();
  if (!q) { hideSiteAc(); return; }
  if (!_siteKeys) _siteKeys = Object.keys(SITES);
  const qUp = q.toUpperCase();
  const keys = _siteKeys.filter(k => k.toUpperCase().startsWith(qUp)).slice(0, 12);
  if (!keys.length) { hideSiteAc(); return; }
  _siteAc.inp = inp;
  const el = document.getElementById('siteAc');
  el.innerHTML = '';
  keys.forEach(function(k) {
    const site = SITES[k];
    const area = site[0], addr = site[1];
    const item = document.createElement('div');
    item.className = 'site-ac-item';
    item.innerHTML = '<div class="site-ac-num">' + k + ' \u2014 ' + area + '</div>' +
                     '<div class="site-ac-meta">' + addr + '</div>';
    item.addEventListener('mousedown', function(e) { e.preventDefault(); }); // keep focus on input
    item.addEventListener('click', function() {
      inp.value = k;
      hideSiteAc();
      lookupSiteId(inp);
    });
    el.appendChild(item);
  });
  positionSiteAc(inp);
  el.classList.add('open');
}

document.getElementById('sites-container').addEventListener('input', function(e) {
  if (e.target.name === 'siteId') showSiteAc(e.target);
});
document.getElementById('sites-container').addEventListener('focusout', function(e) {
  if (e.target.name === 'siteId') setTimeout(hideSiteAc, 150);
});
window.addEventListener('scroll', function() { if (_siteAc.inp) positionSiteAc(_siteAc.inp); }, true);
window.addEventListener('resize', function() { if (_siteAc.inp) positionSiteAc(_siteAc.inp); });

// Fills Area, Address, Latitude, Longitude from the embedded SITES lookup table.
// All filled fields stay editable so the user can correct any value.
function lookupSiteId(inp) {
  if (typeof SITES === 'undefined') { showToast('⚠ Site database not loaded', 'info'); return; }
  const block = inp.closest('.site-block');
  if (!block) return;
  const key  = inp.value.trim();
  if (!key) return;
  const site = SITES[key];
  if (!site) { showToast('Site "' + key + '" not found in database', 'info'); return; }
  const [area, addr, lat, lon] = site;
  const fill = (name, val) => { const f = block.querySelector('[name="' + name + '"]'); if (f) f.value = val; };
  fill('area',    area);
  fill('address', addr);
  fill('coordN',  lat);
  fill('coordE',  lon);
  showToast('📍 Location filled — ' + area, 'info');
}
// change fires on desktop (Tab/click away) and mobile (Done/blur)
document.getElementById('sites-container').addEventListener('change', function(e) {
  if (e.target.name === 'siteId') lookupSiteId(e.target);
});
// Also trigger on Enter key for faster workflow
document.getElementById('sites-container').addEventListener('keydown', function(e) {
  if (e.target.name === 'siteId' && (e.key === 'Enter' || e.keyCode === 13)) {
    e.preventDefault();
    hideSiteAc();
    lookupSiteId(e.target);
    e.target.blur();
  }
});

// ── TEAM / CARS AUTO-FILL ─────────────────────────────────────────────────────
// Engineer / Supervisor name → mobile number
// Driver name → car plate number
document.getElementById('sites-container').addEventListener('input', function(e) {
  const inp = e.target;

  if (inp.name === 'engineerName' || inp.name === 'supervisorName') {
    const mobName  = inp.name === 'engineerName' ? 'engineerMob' : 'supervisorMob';
    const card     = inp.closest('.person-card');
    if (!card) return;
    const mobField = card.querySelector(`[name="${mobName}"]`);
    if (!mobField) return;
    const match = TEAM.find(t => t.name.trim() === inp.value.trim());
    if (match)          { mobField.value = match.mob; }
    else if (!inp.value){ mobField.value = ''; }

    // When Site Engineer is chosen, mirror the same name + mobile into Site Supervisor
    if (inp.name === 'engineerName') {
      const block = inp.closest('.site-block');
      if (block) {
        const supName = block.querySelector('[name="supervisorName"]');
        const supMob  = block.querySelector('[name="supervisorMob"]');
        if (match) {
          if (supName) supName.value = match.name;
          if (supMob)  supMob.value  = match.mob;
        } else if (!inp.value) {
          if (supName) supName.value = '';
          if (supMob)  supMob.value  = '';
        }
      }
    }
    return;
  }

  if (inp.name === 'contactName') {
    const card     = inp.closest('.person-card');
    if (!card) return;
    const mobField = card.querySelector('[name="contactMob"]');
    if (!mobField) return;
    const match = CONTACTS.find(c => c.name.trim() === inp.value.trim());
    if (match)          { mobField.value = match.mob; }
    else if (!inp.value){ mobField.value = ''; }
    return;
  }

  if (inp.name === 'driverName') {
    const block      = inp.closest('.site-block');
    if (!block) return;
    const plateField = block.querySelector('[name="carPlate"]');
    if (!plateField) return;
    const match = CARS.find(c => c.name.trim() === inp.value.trim());
    if (match)          { plateField.value = match.plate; }
    else if (!inp.value){ plateField.value = ''; }
  }
});

function updateSiteUI() {
  const blocks = [...document.querySelectorAll('.site-block')];
  const count  = blocks.length;
  blocks.forEach((block, i) => {
    const badge = block.querySelector('.site-num-badge');
    badge.textContent = `Site ${i + 1}`;
    const removeBtn = block.querySelector('.btn-remove-site');
    removeBtn.style.display = count > 1 ? 'flex' : 'none';
    block.classList.toggle('site-block-first', i === 0);
  });
  const submitBtn = document.getElementById('submitBtn');
  const hint      = document.getElementById('siteCountHint');
  if (count > 1) {
    submitBtn.textContent = `💾 Save Plan (${count} Sites)`;
    hint.textContent = `${count} sites will be saved together as one plan`;
  } else {
    submitBtn.textContent = '💾 Save Daily Plan';
    hint.textContent = '';
  }
}

// Init: create first block, then load dropdown data from data/lists.xlsx
(function() {
  const first = createSiteBlock(false);
  document.getElementById('sites-container').appendChild(first);
  updateSiteUI();
  loadListsData();
})();

// ── STORAGE ───────────────────────────────────────────────────────────────────
const KEY = 'dailyPlanEntries_v2';
function getEntries() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e) { return []; } }
function saveEntries(e) { localStorage.setItem(KEY, JSON.stringify(e)); }

// ── EDIT MODE ─────────────────────────────────────────────────────────────────
let _editingPlanId = null;
let _editingOriginal = null;  // deep copy of original sites for diff on export

function editPlan(planId) {
  const plan = getEntries().find(p => p._id === planId);
  if (!plan) return;
  _editingPlanId = planId;
  _editingOriginal = JSON.parse(JSON.stringify(plan.sites || [plan]));

  // Populate form with plan's sites
  const container = document.getElementById('sites-container');
  container.innerHTML = '';
  (plan.sites || [plan]).forEach((siteData, i) => {
    const block = createSiteBlock(false);
    container.appendChild(block);
    populateSiteBlock(block, siteData);
  });
  updateSiteUI();

  // Show edit banner, update submit button
  document.getElementById('edit-mode-banner').classList.add('visible');
  document.getElementById('submitBtn').textContent = '💾 Update Plan';
  document.getElementById('siteCountHint').textContent = '';

  // Scroll to top of form
  document.getElementById('planForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
  _editingPlanId = null;
  _editingOriginal = null;
  document.getElementById('edit-mode-banner').classList.remove('visible');
  const container = document.getElementById('sites-container');
  container.innerHTML = '';
  const fresh = createSiteBlock(false);
  container.appendChild(fresh);
  updateSiteUI();
}

function populateSiteBlock(block, data) {
  // Text / date / select / textarea inputs
  block.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
    if (el.type === 'checkbox') return; // handled below
    if (el.type === 'hidden')   return; // handled separately
    if (el.name === 'contractor') { el.value = 'Landmark'; return; } // always fixed
    const val = data[el.name];
    if (val !== undefined) el.value = val;
  });

  // Checkboxes (risks) + update count display
  ['riskWAH','riskElectrical','riskMechanical','riskManual','riskHotWork'].forEach(name => {
    const cb    = block.querySelector(`input[name="${name}"]`);
    const label = cb?.closest('.risk-item');
    if (!cb) return;
    cb.checked = !!data[name];
    label?.classList.toggle('checked', !!data[name]);
  });
  // Sync count display after restoring checkboxes
  const count  = block.querySelectorAll('.risk-item input[type=checkbox]:checked').length;
  const numEl  = block.querySelector('.risk-count-num');
  const hidden = block.querySelector('.riskPriorityInput');
  if (numEl)  { numEl.textContent = count; numEl.classList.toggle('zero', count === 0); }
  if (hidden) hidden.value = count;

  // Permission toggle
  if (data.permission) {
    block.querySelector('.permissionInput').value = data.permission;
    block.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === data.permission);
    });
  }

  // Open the block and refresh summary
  block.classList.add('site-block-open');
  refreshSummary(block);
}

// ── FORM SUBMIT ───────────────────────────────────────────────────────────────
document.getElementById('planForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const sites = [];
  document.querySelectorAll('.site-block').forEach(block => {
    const site = {};
    block.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
      if (el.type === 'checkbox') { if (el.checked) site[el.name] = el.value; }
      else site[el.name] = el.value;
    });
    const riskLabels = [];
    if(site.riskWAH)        riskLabels.push('W-A-H');
    if(site.riskElectrical) riskLabels.push('Electrical');
    if(site.riskMechanical) riskLabels.push('Mech.Lift');
    if(site.riskManual)     riskLabels.push('Man.Lift');
    if(site.riskHotWork)    riskLabels.push('Hot Work');
    site._risks = riskLabels.join(', ') || 'None';
    sites.push(site);
  });

  const count = sites.length;
  let all = getEntries();

  if (_editingPlanId !== null) {
    // ── UPDATE existing plan ──
    const idx = all.findIndex(p => p._id === _editingPlanId);
    if (idx !== -1) {
      all[idx] = {
        ...all[idx],
        _planDate: sites[0]?.date || todayStr,
        _original: _editingOriginal,   // snapshot for Excel diff highlighting
        sites
      };
    }
    saveEntries(all);
    showToast(count > 1 ? `✓ Plan updated — ${count} sites!` : '✓ Plan updated!', 'success');
    _editingPlanId = null;
    _editingOriginal = null;
    document.getElementById('edit-mode-banner').classList.remove('visible');
  } else {
    // ── CREATE new plan ──
    const plan = {
      _id:       Date.now(),
      _savedAt:  new Date().toISOString(),
      _planDate: sites[0]?.date || todayStr,
      sites
    };
    all.unshift(plan);
    saveEntries(all);
    showToast(count > 1 ? `✓ Plan saved — ${count} sites!` : '✓ Plan saved!', 'success');
  }

  renderEntries();

  // Reset to single empty block
  const container = document.getElementById('sites-container');
  container.innerHTML = '';
  const fresh = createSiteBlock(false);
  container.appendChild(fresh);
  updateSiteUI();
});

// ── EXCEL (ExcelJS — full color + alignment support) ─────────────────────────
async function buildExcelBlob(plan) {
  const entries = plan.sites || [plan];
  const dateStr = plan._planDate || (entries[0]?.date) || todayStr;
  const wb      = new ExcelJS.Workbook();
  const ws      = wb.addWorksheet(`Plan ${dateStr}`);

  // ── SECTION COLORS (1-based col ranges) ───────────────────
  const SECTIONS = [
    { from:1,  to:7,  bg:'1F6091', fc:'FFFFFF' }, // Site Info    Steel Blue
    { from:8,  to:11, bg:'920000', fc:'FFFFFF' }, // Location     Dark Red
    { from:12, to:17, bg:'375623', fc:'FFFFFF' }, // Risks        Dark Green
    { from:18, to:20, bg:'3E1F6E', fc:'FFFFFF' }, // Contact      Dark Purple
    { from:21, to:24, bg:'FFD966', fc:'000000' }, // Engineers    Gold
    { from:25, to:28, bg:'006E6E', fc:'FFFFFF' }, // Transport    Dark Teal
    { from:29, to:29, bg:'843C0C', fc:'FFFFFF' }, // Permission   Dark Orange
  ];
  const RISKSUB = { bg:'C6EFCE', fc:'375623' };   // L-P row-2 light green
  const secOf = c => SECTIONS.find(s => c >= s.from && c <= s.to) || { bg:'FFFFFF', fc:'000000' };

  const thin = { style:'thin', color:{ argb:'FF000000' } };
  const borders = { top:thin, bottom:thin, left:thin, right:thin };

  function hdrCell(bg, fc) {
    return {
      fill:      { type:'pattern', pattern:'solid', fgColor:{ argb:'FF'+bg } },
      font:      { name:'Calibri', size:11, bold:true, color:{ argb:'FF'+fc } },
      alignment: { horizontal:'center', vertical:'middle', wrapText:true },
      border:    borders
    };
  }
  const dataStyle = {
    font:      { name:'Calibri', size:11 },
    alignment: { horizontal:'center', vertical:'middle', wrapText:true },
    border:    borders
  };

  function applyStyle(cell, style) {
    cell.fill      = style.fill;
    cell.font      = style.font;
    cell.alignment = style.alignment;
    cell.border    = style.border;
  }

  // ── COLUMN WIDTHS ─────────────────────────────────────────
  [16,17,17.89,19.89,15.55,21.55,39.66,
   13.11,12.11,13,14.89,
   11.11,16.11,18,15.89,13.89,
   14.89,24.44,13,24.44,
   25.11,17.55,31.22,17.55,
   22.44,19.55,20.78,16.89,
   14.55].forEach((w,i) => { ws.getColumn(i+1).width = w; });

  // ── ROW 1 — main headers ──────────────────────────────────
  const r1 = ws.addRow([
    'Site ID','Date','Contractor ','Sub-Contractor ','Site Type','Project Name ','SOW',
    '   Coordinates    ','','Area','Address',
    'High Risks Categories','','','','','Risk priority',
    'Contact person Name','Contact person\nMob. Number','Vodafone Egypt\nTask Owner',
    'Site Engineer\nName','Site Engineer\nMob No.',
    'Site Supervisor\nName','Site Supervisor\nMob No.',
    'Driver Name','Car Plate no.','Truck Driver Name','Truck Plate no.',
    'Permission'
  ]);
  r1.height = 30;
  for (let c = 1; c <= 29; c++) {
    const s = secOf(c);
    applyStyle(r1.getCell(c), hdrCell(s.bg, s.fc));
  }

  // ── ROW 2 — sub-headers ───────────────────────────────────
  const r2 = ws.addRow([
    '','','','','','','',
    'N','E','','',
    'W - A - H  ','Electrical Work','Mechanical Lifting','Manual Lifting','Hot Work ',
    '','','','','','','','','','','','',''
  ]);
  r2.height = 28;
  for (let c = 1; c <= 29; c++) {
    const isRiskSub = c >= 12 && c <= 16;
    const s = isRiskSub ? RISKSUB : secOf(c);
    applyStyle(r2.getCell(c), hdrCell(s.bg, s.fc));
  }

  // ── MERGES ────────────────────────────────────────────────
  [1,2,3,4,5,6,7].forEach(c => ws.mergeCells(1,c,2,c));  // A-G span 2 rows
  ws.mergeCells(1,8,1,9);    // H1:I1  Coordinates
  ws.mergeCells(1,10,2,10);  // J1:J2  Area
  ws.mergeCells(1,11,2,11);  // K1:K2  Address
  ws.mergeCells(1,12,1,16);  // L1:P1  High Risks
  [17,18,19,20,21,22,23,24,25,26,27,28,29].forEach(c => ws.mergeCells(1,c,2,c));

  // ── FIELD → COLUMN MAP (1-based, matches data row order) ─
  const FIELD_MAP = [
    null,             // 0  unused
    'siteId',         // 1
    'date',           // 2
    'contractor',     // 3
    'subContractor',  // 4
    'siteType',       // 5
    'projectName',    // 6
    'sow',            // 7
    'coordN',         // 8
    'coordE',         // 9
    'area',           // 10
    'address',        // 11
    'riskWAH',        // 12
    'riskElectrical', // 13
    'riskMechanical', // 14
    'riskManual',     // 15
    'riskHotWork',    // 16
    'riskPriority',   // 17
    'contactName',    // 18
    'contactMob',     // 19
    'taskOwner',      // 20
    'engineerName',   // 21
    'engineerMob',    // 22
    'supervisorName', // 23
    'supervisorMob',  // 24
    'driverName',     // 25
    'carPlate',       // 26
    'truckDriver',    // 27
    'truckPlate',     // 28
    'permission',     // 29
  ];
  const RISK_FIELDS = new Set(['riskWAH','riskElectrical','riskMechanical','riskManual','riskHotWork']);
  function valChanged(field, newSite, origSite) {
    if (RISK_FIELDS.has(field)) return !!newSite[field] !== !!origSite[field];
    return String(newSite[field] ?? '').trim() !== String(origSite[field] ?? '').trim();
  }

  // ── DATA ROWS ─────────────────────────────────────────────
  entries.forEach((e, siteIdx) => {
    const dr = ws.addRow([
      e.siteId||'', e.date||'', e.contractor||'', e.subContractor||'',
      e.siteType||'', e.projectName||'', e.sow||'',
      e.coordN||'', e.coordE||'', e.area||'', e.address||'',
      e.riskWAH?1:0, e.riskElectrical?1:0, e.riskMechanical?1:0, e.riskManual?1:0, e.riskHotWork?1:0,
      e.riskPriority ? Number(e.riskPriority) : '',
      e.contactName||'', e.contactMob||'', e.taskOwner||'',
      e.engineerName||'', e.engineerMob||'', e.supervisorName||'', e.supervisorMob||'',
      e.driverName||'', e.carPlate||'', e.truckDriver||'', e.truckPlate||'',
      e.permission||''
    ]);
    dr.height = 20;

    // Row color based on Site Status
    const redFill   = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFF0000' } };
    const greenFill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF92D050' } };
    const origSite  = plan._original ? plan._original[siteIdx] : null;

    for (let c = 1; c <= 29; c++) {
      const cell = dr.getCell(c);
      cell.font      = dataStyle.font;
      cell.alignment = dataStyle.alignment;
      cell.border    = dataStyle.border;
      if (e.siteStatus === 'Update') {
        if (c === 1) {
          // Site ID always highlighted
          cell.fill = greenFill;
        } else if (origSite) {
          // Highlight only cells whose value changed from the original
          const field = FIELD_MAP[c];
          if (field && valChanged(field, e, origSite)) cell.fill = greenFill;
        } else {
          // No original saved (first export after this feature) — highlight filled cells
          const v = cell.value;
          if (v !== null && v !== undefined && v !== '' && v !== 0) cell.fill = greenFill;
        }
      } else if (e.siteStatus === 'Cancel') {
        cell.fill = redFill;
      }
    }
  });

  // ── BUILD BLOB ────────────────────────────────────────────
  const buf      = await wb.xlsx.writeBuffer();
  const blob     = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const siteIds  = entries.map(e => e.siteId).filter(Boolean).join('-');
  const fileName = `Daily_Plan_${dateStr}${siteIds ? '_'+siteIds : ''}.xlsx`;
  return { blob, fileName };
}

// Trigger a file download from a blob
function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function downloadExcel(plan) {
  const { blob, fileName } = await buildExcelBlob(plan);
  triggerDownload(blob, fileName);
  showToast('✅ Excel downloaded!', 'success');
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────
let _emailEntry = null;
function openEmailModal(plan) {
  _emailEntry = plan;
  const dateStr  = plan._planDate || todayStr;
  const siteList = (plan.sites || [plan]).map(s => s.siteId || '—').join(', ');
  document.getElementById('emailSubject').value = `Daily Site Plan — ${dateStr}`;
  document.getElementById('emailBody').value =
    `Dear Team,\n\nPlease find attached the Daily Site Plan.\n\nDate: ${dateStr}\nSites: ${siteList}\n\nKind regards`;
  document.getElementById('emailTo').value = 'safety@landmark-eg.com';
  document.getElementById('emailCc').value = 'khaled.elsherbiny@landmark-plus.com, s.eldweik@landmark-eg.com';
  document.getElementById('emailModal').classList.add('open');
}
function closeModal() { document.getElementById('emailModal').classList.remove('open'); _emailEntry = null; }
function showAttachBanner(fileName) {
  document.getElementById('attachBannerFile').textContent = fileName;
  document.getElementById('attachBanner').classList.add('show');
}

async function sendEmail() {
  const to      = document.getElementById('emailTo').value.trim();
  const cc      = document.getElementById('emailCc').value.trim();
  const subject = document.getElementById('emailSubject').value;
  const body    = document.getElementById('emailBody').value;
  const plan    = _emailEntry;   // capture before closeModal() nulls it
  closeModal();

  if (!plan) return;
  showToast('⏳ Preparing file…', 'info');

  const { blob, fileName } = await buildExcelBlob(plan);

  // Step 1 — save file to device
  triggerDownload(blob, fileName);
  showToast('📥 File saved — email opens in 4 s…', 'info');

  // Step 2 — open email app after 4 s (gives the file time to land in Downloads/Files)
  const mailLink = 'mailto:' + encodeURIComponent(to) +
    (cc ? '?cc=' + encodeURIComponent(cc) : '?') +
    '&subject=' + encodeURIComponent(subject) +
    '&body='    + encodeURIComponent(body);

  setTimeout(() => {
    window.location.href = mailLink;
    showAttachBanner(fileName);
  }, 4000);
}
document.getElementById('emailModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function showConfirm(message, okLabel, onOk) {
  const modal   = document.getElementById('confirmModal');
  const msgEl   = document.getElementById('confirmMessage');
  const okBtn   = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  msgEl.textContent = message;
  okBtn.textContent = okLabel;
  modal.style.display = 'flex';

  function close() {
    modal.style.display = 'none';
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
    modal.removeEventListener('click', handleBackdrop);
  }
  function handleOk()      { close(); onOk(); }
  function handleCancel()  { close(); }
  function handleBackdrop(e) { if (e.target === modal) close(); }

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
  modal.addEventListener('click', handleBackdrop);
}

// ── ENTRIES ───────────────────────────────────────────────────────────────────
function deleteEntry(id) {
  showConfirm(
    'Are you sure you want to delete this plan? This action cannot be undone.',
    'Delete',
    () => {
      saveEntries(getEntries().filter(p => p._id !== id));
      renderEntries();
      showToast('Plan deleted', 'info');
    }
  );
}

function renderEntries() {
  const plans   = getEntries();
  const section = document.getElementById('entries-section');
  const list    = document.getElementById('entries-list');
  const count   = document.getElementById('entries-count');
  if (!plans.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  count.textContent = `${plans.length} plan${plans.length>1?'s':''}`;

  list.innerHTML = plans.map(plan => {
    const sites    = plan.sites || [plan]; // backwards-compat
    const dateStr  = plan._planDate || sites[0]?.date || '';
    const siteCount = sites.length;

    const sitesHtml = sites.map((s, i) => `
      <div class="plan-site-row">
        <span class="plan-site-num">${i+1}</span>
        <span class="plan-site-id">${s.siteId || '—'}</span>
        ${s.projectName ? `<span class="plan-site-meta">📋 ${s.projectName}</span>` : ''}
        ${s.area        ? `<span class="plan-site-meta">📍 ${s.area}</span>` : ''}
        ${s.contractor  ? `<span class="plan-site-meta">🏗 ${s.contractor}</span>` : ''}
        ${s._risks && s._risks!=='None' ? `<span class="plan-site-meta">⚠️ ${s._risks}</span>` : ''}
        ${s.riskPriority ? `<span class="plan-site-priority p${Math.min(s.riskPriority,3)}">${s.riskPriority} Risk${s.riskPriority>1?'s':''}</span>` : ''}
      </div>`).join('');

    return `
    <div class="entry-card">
      <div class="entry-card-top">
        <div class="entry-site-id">
          Daily Plan
          <span class="entry-date-tag">${dateStr}</span>
        </div>
        <div class="entry-badge">${siteCount} site${siteCount>1?'s':''}</div>
      </div>
      <div class="plan-sites-list">${sitesHtml}</div>
      <div class="entry-actions">
        <button class="btn-ea edit" onclick="editPlan(${plan._id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="btn-ea excel" onclick="downloadExcel(getEntries().find(x=>x._id===${plan._id}))">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Download Excel
        </button>
        <button class="btn-ea email" onclick="openEmailModal(getEntries().find(x=>x._id===${plan._id}))">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>
          Send by Email
        </button>
        <button class="btn-ea del" onclick="deleteEntry(${plan._id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Delete
        </button>
      </div>
    </div>`;
  }).join('');
}

function clearAll() {
  showConfirm(
    'Are you sure you want to delete all saved plans? This action cannot be undone.',
    'Delete',
    () => { localStorage.removeItem(KEY); renderEntries(); }
  );
}

renderEntries();

// ── HARD REFRESH ─────────────────────────────────────────────────────────────
function hardRefresh() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(reg => reg.unregister())))
      .then(() => { window.location.reload(true); });
  } else {
    window.location.reload(true);
  }
}

// ── PWA SERVICE WORKER REGISTRATION ──────────────────────────────────────────
// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(() => { /* SW registration failed silently (e.g. file:// protocol) */ });
  });
}
