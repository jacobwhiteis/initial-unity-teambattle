import './nav.js';
import {
  db, auth, discordProvider,
  collection, doc, getDoc, getDocs, query, orderBy, limit, where, onSnapshot,
  setDoc, updateDoc, deleteDoc, addDoc, writeBatch, Timestamp,
  signInWithPopup, getAdditionalUserInfo, onAuthStateChanged, signOut
} from './firebase.js';
import { getTier, getRules, calcCRP } from './crp.js';
import { finalizeMatch } from './finalize.js';
import { postToDiscord, battleCreatedMessage, clearWebhookCache } from './discord.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ROSTER_SIZE = 6;

// ---------------------------------------------------------------------------
// DOM Elements
// ---------------------------------------------------------------------------

const loginView     = document.getElementById('loginView');
const dashView      = document.getElementById('dashView');
const loginBtn      = document.getElementById('loginBtn');
const authError     = document.getElementById('authError');
const authLoading   = document.getElementById('authLoading');
const staffUser     = document.getElementById('staffUser');
const logoutBtn     = document.getElementById('logoutBtn');
const dangerNav     = document.getElementById('dangerNav');
const saveTeamBtn   = document.getElementById('saveTeamBtn');
const clearTeamBtn  = document.getElementById('clearTeamBtn');
const logMatchBtn   = document.getElementById('logMatchBtn');
const delTeamBtn    = document.getElementById('delTeamBtn');
const delMatchBtn   = document.getElementById('delMatchBtn');
const toastEl       = document.getElementById('toast');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentUser       = null;
let staffRole         = null;
let discordUsername   = null;
let teamsCache        = [];
let standingsCache    = [];
let matchesCache      = [];

// ---------------------------------------------------------------------------
// Toast Utility
// ---------------------------------------------------------------------------

let _tt;
function toast(msg, err = false) {
  clearTimeout(_tt);
  toastEl.textContent = msg;
  toastEl.className = 'show' + (err ? ' err' : '');
  _tt = setTimeout(() => toastEl.className = '', 3200);
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

async function checkStaffAccess(user, showInviteOnFail) {
  try {
    const staffPromise = getDoc(doc(db, 'staff', user.uid));
    const timeout = new Promise((_, rej) =>
      setTimeout(() => rej(new Error('Staff check timed out')), 8000));
    const staffDoc = await Promise.race([staffPromise, timeout]);
    if (staffDoc.exists()) {
      staffRole = staffDoc.data().role || 'moderator';
      // TEMP: Grant moderators full admin access (incl. danger zone). See CLAUDE.md "Temporary overrides". Revert before public launch.
      if (staffRole === 'moderator') staffRole = 'admin';
      let displayName = staffDoc.data().discordUsername;
      // Auto-fix "Unknown" display names from Discord provider data
      if (!displayName || displayName === 'Unknown') {
        const providerName = user.providerData?.find(p => p.providerId === 'oidc.discord')?.displayName
          || discordUsername || user.displayName;
        if (providerName && providerName !== 'Unknown') {
          displayName = providerName;
          updateDoc(doc(db, 'staff', user.uid), { discordUsername: providerName }).catch(() => {});
        }
      }
      staffUser.textContent = displayName || user.displayName || 'Staff';
      loginView.style.display = 'none';
      dashView.style.display = 'block';
      if (staffRole === 'admin') {
        dangerNav.style.display = '';
        document.getElementById('invitesNav').style.display = '';
      }
      initDashboard();
      return true;
    }
  } catch (e) {
    console.log('Staff check failed (likely not staff):', e.code || e.message);
  }
  authLoading.style.display = 'none';
  loginBtn.disabled = false;
  if (showInviteOnFail) {
    authError.style.display = 'block';
    document.getElementById('redeemInviteBtn').onclick = () => redeemInvite(user);
  }
  return false;
}

loginBtn.addEventListener('click', async () => {
  loginBtn.disabled = true;
  authLoading.style.display = 'block';
  authError.style.display = 'none';
  try {
    const result = await signInWithPopup(auth, discordProvider);
    currentUser = result.user;
    const additionalInfo = getAdditionalUserInfo(result);
    discordUsername = additionalInfo?.profile?.global_name
      || additionalInfo?.profile?.username
      || result.user.displayName;
    await checkStaffAccess(result.user, true);
  } catch (e) {
    console.error('Login failed:', e);
    toast('Login failed: ' + e.message, true);
    authLoading.style.display = 'none';
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    console.log('Firebase UID:', user.uid, '| Display name:', user.displayName);
    await checkStaffAccess(user, false);
  } else {
    currentUser = null;
    staffRole = null;
    loginView.style.display = 'block';
    dashView.style.display = 'none';
    authLoading.style.display = 'none';
    authError.style.display = 'none';
    loginBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Sidebar Navigation
// ---------------------------------------------------------------------------

document.querySelectorAll('.mod-nav').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mod-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.mod-nav').forEach(b => b.classList.remove('active'));
    document.getElementById(btn.dataset.section).classList.add('active');
    btn.classList.add('active');
  });
});

// ---------------------------------------------------------------------------
// Dashboard Initialization
// ---------------------------------------------------------------------------

function initDashboard() {
  // Real-time listeners
  onSnapshot(query(collection(db, 'teams'), orderBy('name')), snap => {
    teamsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshTeamList();
    refreshDriverList();
    refreshDropdowns();
    refreshDriverDeleteDropdown();
  });

  onSnapshot(query(collection(db, 'standings'), orderBy('rank', 'asc')), snap => {
    standingsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshTeamList();
    refreshDriverList();
    refreshDropdowns();
    onMatchSelectionChange();
  });

  // Load recent matches for delete dropdown
  loadMatchesForDelete();

  // Wire up event listeners
  saveTeamBtn.addEventListener('click', saveTeam);
  clearTeamBtn.addEventListener('click', clearTeamForm);
  logMatchBtn.addEventListener('click', logMatch);

  // Match form change listeners
  document.getElementById('m-ta').addEventListener('change', onMatchSelectionChange);
  document.getElementById('m-tb').addEventListener('change', onMatchSelectionChange);
  document.getElementById('m-win').addEventListener('change', onMatchSelectionChange);
  document.getElementById('m-home').addEventListener('change', onMatchSelectionChange);

  // Battles
  document.getElementById('createBattleBtn').addEventListener('click', createBattle);
  document.getElementById('b-ta').addEventListener('change', refreshBattleDropdowns);
  document.getElementById('b-tb').addEventListener('change', refreshBattleDropdowns);
  loadBattles();

  // Webhook config
  document.getElementById('saveWebhookBtn').addEventListener('click', saveWebhook);
  loadWebhookConfig();

  // CRP / position override (admin only)
  document.getElementById('setCrpBtn').addEventListener('click', setCrpOverride);
  document.getElementById('setPositionBtn').addEventListener('click', setPositionOverride);

  // Danger zone
  delTeamBtn.addEventListener('click', deleteTeamAction);
  delMatchBtn.addEventListener('click', deleteMatchAction);
  document.getElementById('delDriverBtn').addEventListener('click', deleteDriverAction);
  document.getElementById('resetSeasonBtn').addEventListener('click', resetSeasonAction);

  // Invite system (admin only)
  document.getElementById('genInviteBtn').addEventListener('click', generateInvite);
  if (staffRole === 'admin') {
    refreshInviteList();
  }
}

// ---------------------------------------------------------------------------
// Refresh Dropdowns
// ---------------------------------------------------------------------------

function refreshDropdowns() {
  const sorted = [...teamsCache].sort((a, b) => a.name.localeCompare(b.name));
  const teamOpts = sorted.map(t => {
    const standing = standingsCache.find(s => s.id === t.id);
    const pos = standing?.position;
    const tier = getTier(pos);
    return `<option value="${t.id}">${t.name}${pos ? ` (#${pos}) — ${tier}` : ' — Unranked'}</option>`;
  }).join('');
  const baseOpt = '<option value="">— select team —</option>';

  document.getElementById('m-ta').innerHTML = baseOpt + teamOpts;
  document.getElementById('m-tb').innerHTML = baseOpt + teamOpts;
  document.getElementById('del-team').innerHTML = baseOpt + teamOpts;

  // Battle dropdowns sorted by position, filtered to exclude opposite selection
  refreshBattleDropdowns();
}

function refreshBattleDropdowns() {
  const baseOpt = '<option value="">— select team —</option>';
  const posSorted = [...teamsCache].sort((a, b) => {
    const sA = standingsCache.find(s => s.id === a.id);
    const sB = standingsCache.find(s => s.id === b.id);
    return (sA?.position || 999) - (sB?.position || 999);
  });

  const bta = document.getElementById('b-ta');
  const btb = document.getElementById('b-tb');
  const selA = bta.value;
  const selB = btb.value;

  function buildOpts(excludeId) {
    return posSorted.filter(t => t.id !== excludeId).map(t => {
      const standing = standingsCache.find(s => s.id === t.id);
      const pos = standing?.position;
      const tier = getTier(pos);
      return `<option value="${t.id}">${pos ? `#${pos} ` : ''}${t.name} — ${tier}</option>`;
    }).join('');
  }

  bta.innerHTML = baseOpt + buildOpts(selB);
  btb.innerHTML = baseOpt + buildOpts(selA);
  bta.value = selA;
  btb.value = selB;
}

// ---------------------------------------------------------------------------
// All Drivers List
// ---------------------------------------------------------------------------

function refreshDriverList() {
  const el = document.getElementById('all-drivers-list');
  if (!el) return;
  const allDrivers = [];
  teamsCache.forEach(t => {
    (t.roster || []).forEach((d, idx) => {
      allDrivers.push({ ...d, teamName: t.name, teamTag: t.tag, teamId: t.id, rosterIdx: idx });
    });
  });
  if (!allDrivers.length) {
    el.innerHTML = '<p class="empty-state">No drivers registered yet.</p>';
    return;
  }
  allDrivers.sort((a, b) => a.name.localeCompare(b.name));
  el.innerHTML = allDrivers.map((d, i) => {
    const roleTag = d.role === 'Leader' ? ' ★' : d.role === 'Co-Leader' ? ' ☆' : '';
    return `<div class="mod-list-item" style="flex-wrap:wrap;gap:.5rem;">
      <span class="ml-name">${d.name}${roleTag}</span>
      <span class="tag-badge" style="font-size:.65rem;">${d.teamTag}</span>
      <select class="dl-car" data-dl-idx="${i}" style="width:110px;padding:.3rem .5rem;font-size:.85rem;">
        ${carOptions(d.car)}
      </select>
      <button class="btn btn-primary btn-sm dl-save-car" data-dl-idx="${i}">Save</button>
      ${d.discordId ? `<span style="color:var(--text-mute);font-size:.7rem;margin-left:auto;">${d.discordId}</span>` : ''}
    </div>`;
  }).join('');

  // Store driver refs for save handlers
  el._drivers = allDrivers;

  el.querySelectorAll('.dl-save-car').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.dlIdx);
      const d = allDrivers[idx];
      const newCar = el.querySelector(`.dl-car[data-dl-idx="${idx}"]`).value || null;
      const t = teamsCache.find(x => x.id === d.teamId);
      if (!t) return;
      const newRoster = [...(t.roster || [])];
      newRoster[d.rosterIdx] = { ...newRoster[d.rosterIdx], car: newCar };
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'teams', d.teamId), { roster: newRoster });
        batch.update(doc(db, 'standings', d.teamId), { roster: newRoster });
        await batch.commit();
        toast(`Updated ${d.name}'s car to ${newCar || 'none'}`);
      } catch (e) {
        toast('Failed to update car: ' + e.message, true);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Team Management
// ---------------------------------------------------------------------------

const CAR_LIST = [
  'AE86','FD3S','RPS13','BNR32','CE9A','EG6','SW20','FC3S',
  'AP1','NA6CE','NA1','GC8F','DC2','JZA80','S14','ZZW30','EA11R','CN9A'
];
const MAX_TEAM_STAFF = 2;

function carOptions(selected) {
  return '<option value=""' + (!selected ? ' selected' : '') + '>— no car —</option>' +
    CAR_LIST.map(c => `<option value="${c}"${selected === c ? ' selected' : ''}>${c}</option>`).join('');
}

function refreshTeamList() {
  const el = document.getElementById('mod-team-list');
  if (!teamsCache.length) {
    el.innerHTML = '<p class="empty-state">No teams yet.</p>';
    return;
  }
  el.innerHTML = teamsCache.map(t => {
    const standing = standingsCache.find(s => s.id === t.id);
    const drivers = t.roster || [];
    const driverNames = drivers.map(d => {
      const roleTag = d.role === 'Leader' ? ' ★' : d.role === 'Co-Leader' ? ' ☆' : '';
      return d.name + roleTag;
    }).join(', ');
    return `<div class="mod-list-item" style="flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:200px;">
        <span class="tag-badge">${t.tag || '?'}</span>
        <span class="ml-name">${t.name}</span>
        <span class="ml-info">${standing?.wins || 0}W / ${standing?.losses || 0}L</span>
        <span class="ml-crp">${standing?.crp || 0} CRP</span>
        <a href="/team?t=${t.tag}" class="btn btn-ghost btn-sm" style="text-decoration:none;" target="_blank">View</a>
        <button class="btn btn-ghost btn-sm" data-edit-team="${t.id}">Edit</button>
      </div>
      <div style="width:100%;padding-top:.4rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
        <span style="color:var(--text-mute);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;">Drivers (${drivers.length}/${MAX_ROSTER_SIZE}):</span>
        <span style="color:var(--text-dim);font-size:.82rem;">${driverNames || 'None'}</span>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-edit-team]').forEach(btn => {
    btn.addEventListener('click', () => openTeamEditor(btn.dataset.editTeam));
  });
}

// ---------------------------------------------------------------------------
// Unified Team Editor (team info + drivers + team staff)
// ---------------------------------------------------------------------------

function openTeamEditor(teamId) {
  const team = teamsCache.find(t => t.id === teamId);
  if (!team) return;
  const drivers = team.roster || [];
  const teamStaff = team.teamStaff || [];

  // Populate team info form
  document.getElementById('t-name').value = team.name || '';
  document.getElementById('t-tag').value = team.tag || '';
  document.getElementById('t-captain').value = team.captainDiscordId || '';
  document.getElementById('t-active').checked = team.active !== false;
  document.getElementById('t-editing').value = teamId;

  // Show CRP override for admins
  const crpGroup = document.getElementById('t-crp-group');
  if (staffRole === 'admin') {
    const standing = standingsCache.find(s => s.id === teamId);
    document.getElementById('t-crp').value = standing?.crp ?? 0;
    crpGroup.style.display = '';
  } else {
    crpGroup.style.display = 'none';
  }

  // Switch to teams section
  document.querySelectorAll('.mod-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.mod-nav').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-teams').classList.add('active');
  document.querySelector('[data-section="sec-teams"]').classList.add('active');

  // Render driver + staff editor in the driver-manager panel
  const el = document.getElementById('driver-manager');
  el.style.display = 'block';
  el.innerHTML = `
    <h4 style="margin-bottom:.5rem;">Drivers (${drivers.length}/${MAX_ROSTER_SIZE})</h4>
    <p style="color:var(--text-mute);font-size:.82rem;margin-bottom:1rem;">New drivers are added via Discord bot (<code>/add-team-driver</code>). Edit name, role, or car below.</p>
    <div class="mod-list" id="dm-driver-list">
      ${drivers.length ? drivers.map((d, i) => `<div class="mod-list-item" style="flex-wrap:wrap;gap:.5rem;">
        <div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:200px;flex-wrap:wrap;">
          <input type="text" class="dm-edit-name" data-idx="${i}" value="${(d.name || '').replace(/"/g, '&quot;')}" style="flex:1;min-width:120px;padding:.3rem .5rem;font-size:.85rem;">
          <select class="dm-edit-role" data-idx="${i}" style="width:120px;padding:.3rem .5rem;font-size:.85rem;">
            <option value="Member"${d.role === 'Member' ? ' selected' : ''}>Member</option>
            <option value="Co-Leader"${d.role === 'Co-Leader' ? ' selected' : ''}>Co-Leader</option>
            <option value="Leader"${d.role === 'Leader' ? ' selected' : ''}>Leader</option>
          </select>
          <select class="dm-edit-car" data-idx="${i}" style="width:110px;padding:.3rem .5rem;font-size:.85rem;">
            ${carOptions(d.car)}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;">
          ${d.discordId ? `<span style="color:var(--text-mute);font-size:.75rem;">${d.discordId}</span>` : ''}
          <button class="btn btn-primary btn-sm dm-save-btn" data-idx="${i}" data-team-id="${teamId}">Save</button>
          <button class="btn btn-danger btn-sm dm-remove-btn" data-team-id="${teamId}" data-driver-idx="${i}">Remove</button>
        </div>
      </div>`).join('') : '<p class="empty-state">No drivers — use <code>/add-team-driver</code> in Discord.</p>'}
    </div>

    <h4 style="margin-top:1.5rem;margin-bottom:.5rem;">Coaches (${teamStaff.length}/${MAX_TEAM_STAFF})</h4>
    <div class="mod-list" id="dm-staff-list">
      ${teamStaff.map((s, i) => `<div class="mod-list-item" style="gap:.5rem;">
        <input type="text" class="ts-edit-name" data-idx="${i}" value="${(s.name || '').replace(/"/g, '&quot;')}" style="flex:1;padding:.3rem .5rem;font-size:.85rem;">
        <button class="btn btn-primary btn-sm ts-save-btn" data-idx="${i}" data-team-id="${teamId}">Save</button>
        <button class="btn btn-danger btn-sm ts-remove-btn" data-team-id="${teamId}" data-staff-idx="${i}">Remove</button>
      </div>`).join('')}
      ${teamStaff.length < MAX_TEAM_STAFF ? `
      <div style="display:flex;gap:.5rem;margin-top:.5rem;align-items:end;">
        <input type="text" id="ts-new-name" placeholder="Coach name" style="flex:1;padding:.3rem .5rem;font-size:.85rem;">
        <button class="btn btn-primary btn-sm" id="ts-add-btn" data-team-id="${teamId}">Add</button>
      </div>` : ''}
    </div>
    <div style="margin-top:1rem;"><button class="btn btn-ghost btn-sm" id="dm-close-btn">Close</button></div>
  `;

  wireTeamEditorEvents(el, teamId);
}

function wireTeamEditorEvents(el, teamId) {
  // --- Driver save buttons ---
  el.querySelectorAll('.dm-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const newName = el.querySelector(`.dm-edit-name[data-idx="${idx}"]`).value.trim();
      const newRole = el.querySelector(`.dm-edit-role[data-idx="${idx}"]`).value;
      const newCar = el.querySelector(`.dm-edit-car[data-idx="${idx}"]`).value || null;
      if (!newName) { toast('Name cannot be empty', true); return; }
      const t = teamsCache.find(x => x.id === teamId);
      if (!t) return;
      const newRoster = [...(t.roster || [])];
      newRoster[idx] = { ...newRoster[idx], name: newName, role: newRole, car: newCar };
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'teams', teamId), { roster: newRoster });
        batch.update(doc(db, 'standings', teamId), { roster: newRoster });
        await batch.commit();
        toast(`Updated ${newName}`);
        openTeamEditor(teamId);
      } catch (e) {
        toast('Failed to update driver: ' + e.message, true);
      }
    });
  });

  // --- Driver remove buttons ---
  el.querySelectorAll('.dm-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.driverIdx);
      const t = teamsCache.find(x => x.id === teamId);
      if (!t) return;
      const newRoster = (t.roster || []).filter((_, i) => i !== idx);
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'teams', teamId), { roster: newRoster });
        batch.update(doc(db, 'standings', teamId), { roster: newRoster });
        await batch.commit();
        toast('Driver removed');
        openTeamEditor(teamId);
      } catch (e) {
        toast('Failed to remove driver: ' + e.message, true);
      }
    });
  });

  // --- Team staff save buttons ---
  el.querySelectorAll('.ts-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      const newName = el.querySelector(`.ts-edit-name[data-idx="${idx}"]`).value.trim();
      if (!newName) { toast('Name cannot be empty', true); return; }
      const t = teamsCache.find(x => x.id === teamId);
      if (!t) return;
      const newStaff = [...(t.teamStaff || [])];
      newStaff[idx] = { name: newName, role: 'Coach' };
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'teams', teamId), { teamStaff: newStaff });
        batch.update(doc(db, 'standings', teamId), { teamStaff: newStaff });
        await batch.commit();
        toast(`Updated ${newName}`);
        openTeamEditor(teamId);
      } catch (e) {
        toast('Failed to update staff: ' + e.message, true);
      }
    });
  });

  // --- Team staff remove buttons ---
  el.querySelectorAll('.ts-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.staffIdx);
      const t = teamsCache.find(x => x.id === teamId);
      if (!t) return;
      const newStaff = (t.teamStaff || []).filter((_, i) => i !== idx);
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'teams', teamId), { teamStaff: newStaff });
        batch.update(doc(db, 'standings', teamId), { teamStaff: newStaff });
        await batch.commit();
        toast('Staff member removed');
        openTeamEditor(teamId);
      } catch (e) {
        toast('Failed to remove staff: ' + e.message, true);
      }
    });
  });

  // --- Team staff add button ---
  el.querySelector('#ts-add-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('ts-new-name').value.trim();
    if (!name) { toast('Enter a name', true); return; }
    const t = teamsCache.find(x => x.id === teamId);
    if (!t) return;
    const staff = t.teamStaff || [];
    if (staff.length >= MAX_TEAM_STAFF) { toast(`Maximum ${MAX_TEAM_STAFF} coaches`, true); return; }
    const newStaff = [...staff, { name, role: 'Coach' }];
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', teamId), { teamStaff: newStaff });
      batch.update(doc(db, 'standings', teamId), { teamStaff: newStaff });
      await batch.commit();
      toast(`Added ${name}`);
      openTeamEditor(teamId);
    } catch (e) {
      toast('Failed to add staff: ' + e.message, true);
    }
  });

  // --- Close ---
  el.querySelector('#dm-close-btn')?.addEventListener('click', () => {
    el.style.display = 'none';
    clearTeamForm();
  });
}

function clearTeamForm() {
  document.getElementById('t-name').value = '';
  document.getElementById('t-tag').value = '';
  document.getElementById('t-captain').value = '';
  document.getElementById('t-active').checked = true;
  document.getElementById('t-editing').value = '';
  document.getElementById('t-crp-group').style.display = 'none';
  document.getElementById('driver-manager').style.display = 'none';
}

async function setCrpOverride() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const teamId = document.getElementById('t-editing').value;
  if (!teamId) { toast('Select a team to edit first', true); return; }
  const crp = parseInt(document.getElementById('t-crp').value);
  if (isNaN(crp) || crp < 0) { toast('Enter a valid CRP value', true); return; }
  try {
    await updateDoc(doc(db, 'standings', teamId), { crp });
    toast(`CRP set to ${crp}`);
  } catch (e) {
    toast('Failed to set CRP: ' + e.message, true);
  }
}

async function setPositionOverride() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const teamId = document.getElementById('t-editing').value;
  if (!teamId) { toast('Select a team to edit first', true); return; }
  const position = parseInt(document.getElementById('t-position').value);
  if (isNaN(position) || position < 1) { toast('Enter a valid position (1 or higher)', true); return; }
  try {
    await updateDoc(doc(db, 'standings', teamId), { position, rank: position });
    toast(`Position set to #${position}`);
  } catch (e) {
    toast('Failed to set position: ' + e.message, true);
  }
}

async function resetSeasonAction() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const confirm = document.getElementById('reset-season-confirm').value.trim();
  if (confirm !== 'RESET SEASON') { toast('Type "RESET SEASON" to confirm', true); return; }

  try {
    const snap = await getDocs(collection(db, 'standings'));
    const batch = writeBatch(db);
    snap.forEach(d => {
      batch.update(doc(db, 'standings', d.id), {
        crp: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        streak: 0,
        consecutive_wins: 0,
        mapWins: 0,
        mapLosses: 0,
        match_history: [],
      });
    });
    await batch.commit();
    toast('Season reset — all stats cleared');
    document.getElementById('reset-season-confirm').value = '';
  } catch (e) {
    toast('Reset failed: ' + e.message, true);
  }
}

async function saveTeam() {
  const name = document.getElementById('t-name').value.trim();
  const tag = document.getElementById('t-tag').value.trim().toUpperCase();
  const captain = document.getElementById('t-captain').value.trim();
  const active = document.getElementById('t-active').checked;
  const editingId = document.getElementById('t-editing').value;

  if (!name) { toast('Team name required', true); return; }
  if (!tag) { toast('Team tag required', true); return; }

  const batch = writeBatch(db);

  if (editingId) {
    const teamRef = doc(db, 'teams', editingId);
    batch.update(teamRef, { name, tag, captainDiscordId: captain, active });
    const standingRef = doc(db, 'standings', editingId);
    batch.update(standingRef, { teamName: name, teamTag: tag });
  } else {
    const id = tag.toLowerCase();
    const teamRef = doc(db, 'teams', id);
    batch.set(teamRef, {
      name, tag, captainDiscordId: captain, active,
      roster: [], teamStaff: [], createdAt: Timestamp.now()
    });
    const standingRef = doc(db, 'standings', id);
    batch.set(standingRef, {
      teamName: name, teamTag: tag,
      wins: 0, losses: 0, mapWins: 0, mapLosses: 0, winRate: 0,
      streak: 0, rank: standingsCache.length + 1,
      crp: 0, position: null, consecutive_wins: 0,
      roster: [], teamStaff: [], match_history: [], lastMatchDate: null
    });
  }

  try {
    await batch.commit();
    toast(`Team "${name}" saved`);
    clearTeamForm();
  } catch (e) {
    console.error(e);
    toast('Failed to save team: ' + e.message, true);
  }
}

// (Driver management is now inline in the Teams tab via openDriverManager)

// ---------------------------------------------------------------------------
// Match Logging — CRP Preview
// ---------------------------------------------------------------------------

function onMatchSelectionChange() {
  const taId = document.getElementById('m-ta').value;
  const tbId = document.getElementById('m-tb').value;
  const win = document.getElementById('m-win').value;
  const home = document.getElementById('m-home').value;
  const infoBox = document.getElementById('match-info-box');
  const prevEl = document.getElementById('crp-preview');

  if (!taId || !tbId) { prevEl.style.display = 'none'; infoBox.innerHTML = 'Select both teams to see tier info and CRP preview.'; return; }
  if (taId === tbId) { prevEl.style.display = 'none'; infoBox.innerHTML = '⚠ Select two different teams.'; return; }

  const sA = standingsCache.find(s => s.id === taId);
  const sB = standingsCache.find(s => s.id === tbId);
  if (!sA || !sB) { prevEl.style.display = 'none'; return; }

  const tA = teamsCache.find(t => t.id === taId);
  const tB = teamsCache.find(t => t.id === tbId);

  infoBox.innerHTML = `<b>${tA?.name}</b> — ${getTier(sA.position)} (Pos ${sA.position ?? 'Unranked'}) · ${getRules(sA.position).format}<br><b>${tB?.name}</b> — ${getTier(sB.position)} (Pos ${sB.position ?? 'Unranked'}) · ${getRules(sB.position).format}`;

  if (!win) { prevEl.style.display = 'none'; return; }

  const winStanding = win === 'A' ? sA : sB;
  const loseStanding = win === 'A' ? sB : sA;
  const winTeam = win === 'A' ? tA : tB;
  const loseTeam = win === 'A' ? tB : tA;
  const wIsA = win === 'A';

  let homeFor = 'none';
  if (home === 'A') homeFor = wIsA ? 'winner' : 'loser';
  else if (home === 'B') homeFor = wIsA ? 'loser' : 'winner';
  else if (home === 'both') homeFor = 'both';

  const c = calcCRP(winStanding, loseStanding, homeFor);

  let rows = `<div class="crp-row"><span>${winTeam?.name} wins (${loseTeam?.name}'s win value)</span><span class="cv">+${c.winnerBase}</span></div>`;
  if (c.winnerHome) rows += `<div class="crp-row"><span>Home map bonus (${loseTeam?.name}'s home value)</span><span class="cv">+${c.winnerHome}</span></div>`;
  if (c.streakBonus) rows += `<div class="crp-row"><span>Streak bonus x${c.newStreak} (${winTeam?.name}'s streak value)</span><span class="cv">+${c.streakBonus}</span></div>`;
  rows += `<div class="crp-div"></div><div class="crp-row"><span><b>→ ${winTeam?.name} total</b></span><span class="cv">+${c.winnerTotal}</span></div><div class="crp-div"></div>`;
  rows += `<div class="crp-row"><span>${loseTeam?.name} loses (${winTeam?.name}'s loss value)</span><span class="cv">+${c.loserBase}</span></div>`;
  if (c.loserHome) rows += `<div class="crp-row"><span>Home map bonus (${winTeam?.name}'s home value)</span><span class="cv">+${c.loserHome}</span></div>`;
  rows += `<div class="crp-div"></div><div class="crp-row"><span><b>→ ${loseTeam?.name} total</b></span><span class="cv">+${c.loserTotal}</span></div>`;

  // Position shift preview
  const wPos = winStanding.position;
  const lPos = loseStanding.position;
  if (wPos != null && lPos != null && wPos > lPos) {
    rows += `<div class="crp-div"></div><div class="crp-row" style="color:var(--accent)"><span>📈 ${winTeam?.name} moves to #${lPos} · teams #${lPos}–#${wPos - 1} shift down</span><span></span></div>`;
  } else if (wPos != null && lPos != null && wPos < lPos) {
    rows += `<div class="crp-div"></div><div class="crp-row" style="color:var(--text-mute)"><span>No position change (winner already ranked higher)</span><span></span></div>`;
  }

  document.getElementById('crp-rows').innerHTML = rows;
  prevEl.style.display = 'block';
}

// ---------------------------------------------------------------------------
// Match Logging — logMatch()
// ---------------------------------------------------------------------------

async function logMatch() {
  const taId = document.getElementById('m-ta').value;
  const tbId = document.getElementById('m-tb').value;
  const win = document.getElementById('m-win').value;
  const home = document.getElementById('m-home').value;
  const scoreA = parseInt(document.getElementById('m-score-a').value) || 0;
  const scoreB = parseInt(document.getElementById('m-score-b').value) || 0;
  const notes = document.getElementById('m-notes').value.trim();

  if (!taId || !tbId) { toast('Select both teams', true); return; }
  if (taId === tbId) { toast('Teams must be different', true); return; }
  if (!win) { toast('Select a winner', true); return; }

  const winnerId = win === 'A' ? taId : tbId;
  const loserId = win === 'A' ? tbId : taId;
  const wStanding = standingsCache.find(s => s.id === winnerId);
  const lStanding = standingsCache.find(s => s.id === loserId);
  const wTeam = teamsCache.find(t => t.id === winnerId);
  const lTeam = teamsCache.find(t => t.id === loserId);

  if (!wStanding || !lStanding || !wTeam || !lTeam) { toast('Team data not found', true); return; }

  const wIsA = win === 'A';
  let homeFor = 'none';
  if (home === 'A') homeFor = wIsA ? 'winner' : 'loser';
  else if (home === 'B') homeFor = wIsA ? 'loser' : 'winner';
  else if (home === 'both') homeFor = 'both';

  const format = getRules(Math.min(wStanding.position || 999, lStanding.position || 999)).format;

  try {
    const result = await finalizeMatch(db, {
      matchId: null,
      winnerId,
      loserId,
      winnerName: wTeam.name,
      loserName: lTeam.name,
      homeFor,
      score: { teamA: scoreA, teamB: scoreB },
      format,
      recordedBy: currentUser.uid,
      notes,
      matchData: {},
    }, wStanding, lStanding, standingsCache);

    const shiftMsg = result.positionShifted ? ` · ${wTeam.name} moved to #${lStanding.position}` : '';
    toast(`Match logged: ${wTeam.name} wins · +${result.winnerCRP} / +${result.loserCRP} CRP${shiftMsg}`);
    // Clear form
    document.getElementById('m-win').value = '';
    document.getElementById('m-home').value = 'none';
    document.getElementById('m-score-a').value = '0';
    document.getElementById('m-score-b').value = '0';
    document.getElementById('m-notes').value = '';
    document.getElementById('crp-preview').style.display = 'none';
    loadMatchesForDelete();
  } catch (e) {
    console.error(e);
    toast('Failed to log match: ' + e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Danger Zone
// ---------------------------------------------------------------------------

// --- Delete Team ---
function deleteTeamAction() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const teamId = document.getElementById('del-team').value;
  if (!teamId) { toast('Select a team first', true); return; }
  const team = teamsCache.find(t => t.id === teamId);
  if (!team) { toast('Team not found', true); return; }
  const confirm = document.getElementById('del-team-confirm').value.trim();
  if (confirm !== team.name) { toast(`Type "${team.name}" to confirm`, true); return; }

  const batch = writeBatch(db);
  batch.delete(doc(db, 'teams', teamId));
  batch.delete(doc(db, 'standings', teamId));
  for (const driver of (team.roster || [])) {
    if (driver.discordId) batch.delete(doc(db, 'drivers', driver.discordId));
  }
  batch.commit()
    .then(() => { toast('Team deleted'); document.getElementById('del-team-confirm').value = ''; })
    .catch(e => toast('Delete failed: ' + e.message, true));
}

// --- Delete Match ---
async function loadMatchesForDelete() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('date', 'desc'), limit(20)));
  matchesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sel = document.getElementById('del-match');
  sel.innerHTML = '<option value="">— select match —</option>' +
    matchesCache.map(m => {
      const dateStr = m.date?.toDate ? m.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `<option value="${m.id}" data-label="${m.teamATag || ''} vs ${m.teamBTag || ''}">${m.teamAName} vs ${m.teamBName} (${dateStr})</option>`;
    }).join('');
}

function deleteMatchAction() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const matchId = document.getElementById('del-match').value;
  if (!matchId) { toast('Select a match first', true); return; }
  const match = matchesCache.find(m => m.id === matchId);
  if (!match) { toast('Match not found', true); return; }
  const expected = `${match.teamATag || match.teamAName} vs ${match.teamBTag || match.teamBName}`;
  const confirm = document.getElementById('del-match-confirm').value.trim();
  if (confirm !== expected) { toast(`Type "${expected}" to confirm`, true); return; }

  deleteDoc(doc(db, 'matches', matchId))
    .then(() => { toast('Match deleted. CRP and standings were NOT reverted.'); document.getElementById('del-match-confirm').value = ''; loadMatchesForDelete(); })
    .catch(e => toast('Delete failed: ' + e.message, true));
}

// --- Delete Driver ---
function refreshDriverDeleteDropdown() {
  const sel = document.getElementById('del-driver');
  if (!sel) return;
  const allDrivers = [];
  teamsCache.forEach(t => {
    (t.roster || []).forEach((d, idx) => {
      allDrivers.push({ name: d.name, discordId: d.discordId, teamId: t.id, teamTag: t.tag, rosterIdx: idx });
    });
  });
  allDrivers.sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = '<option value="">— select driver —</option>' +
    allDrivers.map((d, i) => `<option value="${i}" data-name="${d.name}">${d.name} [${d.teamTag}]</option>`).join('');
  sel._drivers = allDrivers;
}

function deleteDriverAction() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const sel = document.getElementById('del-driver');
  const idx = sel.value;
  if (idx === '') { toast('Select a driver first', true); return; }
  const driver = sel._drivers[parseInt(idx)];
  if (!driver) { toast('Driver not found', true); return; }
  const confirm = document.getElementById('del-driver-confirm').value.trim();
  if (confirm !== driver.name) { toast(`Type "${driver.name}" to confirm`, true); return; }

  const t = teamsCache.find(x => x.id === driver.teamId);
  if (!t) { toast('Team not found', true); return; }
  const newRoster = (t.roster || []).filter((_, i) => i !== driver.rosterIdx);
  const batch = writeBatch(db);
  batch.update(doc(db, 'teams', driver.teamId), { roster: newRoster });
  batch.update(doc(db, 'standings', driver.teamId), { roster: newRoster });
  batch.commit()
    .then(() => { toast(`Driver "${driver.name}" removed from [${driver.teamTag}]`); document.getElementById('del-driver-confirm').value = ''; })
    .catch(e => toast('Delete failed: ' + e.message, true));
}

// ---------------------------------------------------------------------------
// Battles
// ---------------------------------------------------------------------------

async function createBattle() {
  let taId = document.getElementById('b-ta').value;
  let tbId = document.getElementById('b-tb').value;
  const threadId = document.getElementById('b-thread').value.trim();

  if (!taId || !tbId) { toast('Select both teams', true); return; }
  if (taId === tbId) { toast('Teams must be different', true); return; }

  // Auto-swap so higher-ranked team (lower position number) is always Team A (first pick/ban)
  const sA = standingsCache.find(s => s.id === taId);
  const sB = standingsCache.find(s => s.id === tbId);
  const posA = sA?.position ?? 999;
  const posB = sB?.position ?? 999;
  if (posB < posA) {
    [taId, tbId] = [tbId, taId];
  }

  const tA = teamsCache.find(t => t.id === taId);
  const tB = teamsCache.find(t => t.id === tbId);

  // Determine format from higher-ranked team's position rules
  const higherPos = Math.min(posA, posB);
  const format = getRules(higherPos).format;
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const now = Timestamp.now();
  const batch = writeBatch(db);

  const matchRef = doc(collection(db, 'matches'));

  batch.set(doc(db, 'sessions', sessionId), {
    phase: 'WAITING',
    format,
    round: 1,
    homeA: null, homeB: null, bans: [], picks: [],
    liveScore: { teamA: 0, teamB: 0 },
    teamAHigherRank: true,
    matchId: matchRef.id,
    history: [{ text: 'Session initialized.', timestamp: Date.now() }],
    createdAt: Date.now(),
    teamAName: tA.name, teamBName: tB.name,
    teamAClaimed: false, teamBClaimed: false
  });

  batch.set(matchRef, {
    teamA: taId, teamB: tbId,
    teamAName: tA.name, teamBName: tB.name,
    teamATag: tA.tag, teamBTag: tB.tag,
    format, status: 'banpick',
    winner: null, score: { teamA: 0, teamB: 0 },
    maps: [], mapResults: [],
    liveScore: { teamA: 0, teamB: 0 },
    banpickSessionId: sessionId, banpickResult: null,
    discordThreadId: threadId || null,
    date: now, createdAt: now, finalizedAt: null,
    recordedBy: currentUser.uid, notes: ''
  });

  try {
    await batch.commit();
    const banpickUrl = `${window.location.origin}/banpick?join=${sessionId}`;
    const battleUrl = `${window.location.origin}/battle?id=${matchRef.id}`;
    document.getElementById('battleBanpickLink').href = banpickUrl;
    document.getElementById('battleBanpickLink').textContent = banpickUrl;
    document.getElementById('battlePageLink').href = battleUrl;
    document.getElementById('battlePageLink').textContent = battleUrl;
    document.getElementById('battleCreatedResult').style.display = 'block';
    toast(`Battle created: ${tA.name} vs ${tB.name}`);
    loadBattles();

    // Post to Discord
    postToDiscord(threadId || null, battleCreatedMessage(tA.name, tB.name, banpickUrl));
  } catch (e) {
    console.error(e);
    toast('Failed to create battle: ' + e.message, true);
  }
}

async function loadBattles() {
  const snap = await getDocs(query(collection(db, 'matches'), orderBy('date', 'desc'), limit(20)));
  const battles = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const activeEl = document.getElementById('active-battle-list');
  const recentEl = document.getElementById('recent-battle-list');

  const active = battles.filter(b => b.status === 'banpick' || b.status === 'in_progress');
  const recent = battles.filter(b => b.status === 'completed').slice(0, 10);

  if (active.length) {
    activeEl.innerHTML = active.map(b => {
      const statusBadge = b.status === 'banpick'
        ? '<span class="tier-badge tier-Proficient">Ban/Pick</span>'
        : '<span class="tier-badge tier-Adept">In Progress</span>';
      return `<div class="mod-list-item">
        ${statusBadge}
        <span class="ml-name">${b.teamAName} [${b.teamATag || ''}] vs ${b.teamBName} [${b.teamBTag || ''}]</span>
        <span class="ml-info">${b.liveScore?.teamA || 0} — ${b.liveScore?.teamB || 0}</span>
        <a href="/battle?id=${b.id}" class="btn btn-ghost btn-sm" target="_blank">Open</a>
      </div>`;
    }).join('');
  } else {
    activeEl.innerHTML = '<p class="empty-state">No active battles.</p>';
  }

  if (recent.length) {
    recentEl.innerHTML = recent.map(b => {
      const dateStr = b.date?.toDate ? b.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const maps = (b.mapResults?.length ? b.mapResults : b.maps) || [];
      const mapNames = maps.map(m => m.mapName).filter(Boolean).join(', ');
      const isTeamAWinner = b.winner === b.teamA;
      return `<div class="mod-list-item" style="flex-wrap:wrap;gap:.25rem;">
        <span class="ml-name" style="flex:1;min-width:200px;">
          <span style="color:${isTeamAWinner ? 'var(--win)' : ''}">${b.teamAName} [${b.teamATag || ''}]</span>
          <span style="margin:0 .25rem;">${b.score?.teamA || 0} — ${b.score?.teamB || 0}</span>
          <span style="color:${!isTeamAWinner ? 'var(--win)' : ''}">${b.teamBName} [${b.teamBTag || ''}]</span>
        </span>
        ${mapNames ? `<span style="color:var(--text-mute);font-size:.75rem;">${mapNames}</span>` : ''}
        <span class="ml-info">${dateStr}</span>
        <a href="/match?id=${b.id}" class="btn btn-ghost btn-sm" target="_blank">View</a>
      </div>`;
    }).join('');
  } else {
    recentEl.innerHTML = '<p class="empty-state">No recent battles.</p>';
  }
}

// ---------------------------------------------------------------------------
// Webhook Config
// ---------------------------------------------------------------------------

async function loadWebhookConfig() {
  try {
    const configDoc = await getDoc(doc(db, 'config', 'discord'));
    if (configDoc.exists()) {
      document.getElementById('webhook-url').value = configDoc.data().webhookUrl || '';
    }
  } catch (e) { /* config doc may not exist yet */ }
}

async function saveWebhook() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const url = document.getElementById('webhook-url').value.trim();
  try {
    await setDoc(doc(db, 'config', 'discord'), { webhookUrl: url }, { merge: true });
    clearWebhookCache();
    toast('Webhook URL saved');
  } catch (e) {
    toast('Failed to save: ' + e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Invite System
// ---------------------------------------------------------------------------

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function redeemInvite(user) {
  const code = document.getElementById('invite-code').value.trim().toUpperCase();
  const errEl = document.getElementById('inviteError');
  if (!code) { errEl.textContent = 'Enter an invite code'; errEl.style.display = 'block'; return; }

  const inviteRef = doc(db, 'invites', code);
  const inviteDoc = await getDoc(inviteRef);
  if (!inviteDoc.exists()) {
    errEl.textContent = 'Invalid invite code';
    errEl.style.display = 'block';
    return;
  }
  const invite = inviteDoc.data();
  if (invite.used && !invite.reusable) {
    errEl.textContent = 'This invite code has already been used';
    errEl.style.display = 'block';
    return;
  }

  // Create staff doc and mark invite as used (skip marking reusable invites)
  const discordId = user.providerData?.find(p => p.providerId === 'oidc.discord')?.uid || '';
  const batch = writeBatch(db);
  batch.set(doc(db, 'staff', user.uid), {
    discordUsername: discordUsername || user.displayName || 'Unknown',
    discordId,
    role: invite.role || 'moderator',
    inviteCode: code,
    addedAt: Timestamp.now(),
    addedBy: 'invite:' + code
  });
  if (!invite.reusable) {
    batch.update(inviteRef, { used: true, usedBy: user.uid, usedAt: Timestamp.now() });
  }

  try {
    await batch.commit();
    errEl.style.display = 'none';
    // Re-trigger auth check by reloading
    window.location.reload();
  } catch (e) {
    errEl.textContent = 'Failed to redeem: ' + e.message;
    errEl.style.display = 'block';
  }
}

async function generateInvite() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const role = document.getElementById('inv-role').value;
  const code = generateCode();

  await setDoc(doc(db, 'invites', code), {
    role,
    createdBy: currentUser.uid,
    createdAt: Timestamp.now(),
    used: false
  });

  document.getElementById('genInviteCode').textContent = code;
  document.getElementById('genInviteResult').style.display = 'block';
  toast(`Invite code created: ${code}`);
  refreshInviteList();
}

async function refreshInviteList() {
  // Active invites
  const invSnap = await getDocs(query(collection(db, 'invites'), orderBy('createdAt', 'desc')));
  const invites = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const invEl = document.getElementById('invite-list');

  const active = invites.filter(i => !i.used);
  if (active.length) {
    invEl.innerHTML = active.map(i => {
      const date = i.createdAt?.toDate ? i.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `<div class="mod-list-item">
        <span class="ml-name" style="font-family:var(--font-condensed);letter-spacing:.1em;color:var(--accent)">${i.id}</span>
        <span class="ml-info">${i.role}</span>
        <span class="ml-info">${date}</span>
        <button class="btn btn-danger btn-sm" data-del-invite="${i.id}">Revoke</button>
      </div>`;
    }).join('');
    invEl.querySelectorAll('[data-del-invite]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteDoc(doc(db, 'invites', btn.dataset.delInvite));
        toast('Invite revoked');
        refreshInviteList();
      });
    });
  } else {
    invEl.innerHTML = '<p class="empty-state">No active invites.</p>';
  }

  // Staff members list
  const staffSnap = await getDocs(collection(db, 'staff'));
  const staffMembers = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const staffEl = document.getElementById('staff-list');

  if (staffMembers.length) {
    staffEl.innerHTML = staffMembers.map(s => {
      const date = s.addedAt?.toDate ? s.addedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `<div class="mod-list-item">
        <span class="ml-name">${s.discordUsername || s.id}</span>
        <span class="ml-info">${s.role}</span>
        <span class="ml-info">${date}</span>
        ${s.id !== currentUser.uid ? `<button class="btn btn-danger btn-sm" data-del-staff="${s.id}">Remove</button>` : '<span class="ml-info" style="color:var(--win)">You</span>'}
      </div>`;
    }).join('');
    staffEl.querySelectorAll('[data-del-staff]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await deleteDoc(doc(db, 'staff', btn.dataset.delStaff));
        toast('Staff member removed');
        refreshInviteList();
      });
    });
  } else {
    staffEl.innerHTML = '<p class="empty-state">No staff members.</p>';
  }
}
