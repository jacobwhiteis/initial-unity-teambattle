import './nav.js';
import {
  db, auth, discordProvider,
  collection, doc, getDoc, getDocs, query, orderBy, limit, where, onSnapshot,
  setDoc, updateDoc, deleteDoc, addDoc, writeBatch, Timestamp,
  signInWithPopup, onAuthStateChanged, signOut
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
const seasonResetBtn = document.getElementById('seasonResetBtn');
const delTeamBtn    = document.getElementById('delTeamBtn');
const delMatchBtn   = document.getElementById('delMatchBtn');
const toastEl       = document.getElementById('toast');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentUser    = null;
let staffRole      = null;
let teamsCache     = [];
let standingsCache = [];
let matchesCache   = [];

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
      staffUser.textContent = staffDoc.data().discordUsername || user.displayName || 'Staff';
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
    refreshDropdowns();
  });

  onSnapshot(query(collection(db, 'standings'), orderBy('rank', 'asc')), snap => {
    standingsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refreshTeamList();
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

  // Danger zone
  seasonResetBtn.addEventListener('click', seasonReset);
  delTeamBtn.addEventListener('click', deleteTeamAction);
  delMatchBtn.addEventListener('click', deleteMatchAction);

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

  document.getElementById('d-team').innerHTML = baseOpt + teamOpts;
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
// Team Management
// ---------------------------------------------------------------------------

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
        <button class="btn btn-ghost btn-sm" data-team-id="${t.id}">Edit</button>
      </div>
      <div style="width:100%;padding-top:.4rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
        <span style="color:var(--text-mute);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;">Drivers (${drivers.length}/${MAX_ROSTER_SIZE}):</span>
        <span style="color:var(--text-dim);font-size:.82rem;">${driverNames || 'None'}</span>
        <button class="btn btn-ghost btn-sm" data-manage-team="${t.id}" style="margin-left:auto;font-size:.7rem;">Manage Drivers</button>
      </div>
    </div>`;
  }).join('');

  // Wire edit buttons
  el.querySelectorAll('[data-team-id]').forEach(btn => {
    btn.addEventListener('click', () => loadTeamForEdit(btn.dataset.teamId));
  });
  // Wire manage driver buttons
  el.querySelectorAll('[data-manage-team]').forEach(btn => {
    btn.addEventListener('click', () => openDriverManager(btn.dataset.manageTeam));
  });
}

function loadTeamForEdit(teamId) {
  const t = teamsCache.find(x => x.id === teamId);
  if (!t) return;
  document.getElementById('t-name').value = t.name || '';
  document.getElementById('t-tag').value = t.tag || '';
  document.getElementById('t-captain').value = t.captainDiscordId || '';
  document.getElementById('t-active').checked = t.active !== false;
  document.getElementById('t-editing').value = teamId;
  // Switch to teams section
  document.querySelectorAll('.mod-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.mod-nav').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-teams').classList.add('active');
  document.querySelector('[data-section="sec-teams"]').classList.add('active');
}

function clearTeamForm() {
  document.getElementById('t-name').value = '';
  document.getElementById('t-tag').value = '';
  document.getElementById('t-captain').value = '';
  document.getElementById('t-active').checked = true;
  document.getElementById('t-editing').value = '';
}

async function saveTeam() {
  const name = document.getElementById('t-name').value.trim();
  const tag = document.getElementById('t-tag').value.trim().toUpperCase();
  const captain = document.getElementById('t-captain').value.trim();
  const active = document.getElementById('t-active').checked;
  const editingId = document.getElementById('t-editing').value;

  if (!name) { toast('Team name required', true); return; }
  if (!tag) { toast('Team tag required', true); return; }

  // Parse initial drivers from the form (only for new teams)
  const leaderName = document.getElementById('t-leader')?.value.trim() || '';
  const coLeaderName = document.getElementById('t-coleader')?.value.trim() || '';
  const driverInputs = document.querySelectorAll('.t-driver-input');
  const initialRoster = [];
  if (leaderName) initialRoster.push({ name: leaderName, role: 'Leader' });
  if (coLeaderName) initialRoster.push({ name: coLeaderName, role: 'Co-Leader' });
  driverInputs.forEach(input => {
    const v = input.value.trim();
    if (v) initialRoster.push({ name: v, role: 'Member' });
  });

  if (initialRoster.length > MAX_ROSTER_SIZE) {
    toast(`Maximum ${MAX_ROSTER_SIZE} drivers per team`, true);
    return;
  }

  const batch = writeBatch(db);

  if (editingId) {
    // Update existing
    const teamRef = doc(db, 'teams', editingId);
    batch.update(teamRef, { name, tag, captainDiscordId: captain, active });
    const standingRef = doc(db, 'standings', editingId);
    batch.update(standingRef, { teamName: name, teamTag: tag });
  } else {
    // Create new
    const id = tag.toLowerCase();
    const teamRef = doc(db, 'teams', id);
    batch.set(teamRef, {
      name, tag, captainDiscordId: captain, active,
      roster: initialRoster, createdAt: Timestamp.now()
    });
    const standingRef = doc(db, 'standings', id);
    batch.set(standingRef, {
      teamName: name, teamTag: tag,
      wins: 0, losses: 0, mapWins: 0, mapLosses: 0, winRate: 0,
      streak: 0, rank: standingsCache.length + 1,
      crp: 0, position: null, consecutive_wins: 0,
      roster: initialRoster, match_history: [], lastMatchDate: null
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

// ---------------------------------------------------------------------------
// Driver Manager (inline in teams tab)
// ---------------------------------------------------------------------------

function openDriverManager(teamId) {
  const team = teamsCache.find(t => t.id === teamId);
  if (!team) return;
  const drivers = team.roster || [];

  // Switch to teams section
  document.querySelectorAll('.mod-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.mod-nav').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-teams').classList.add('active');
  document.querySelector('[data-section="sec-teams"]').classList.add('active');

  // Show driver manager panel
  const el = document.getElementById('driver-manager');
  el.style.display = 'block';
  el.innerHTML = `
    <h4 style="margin-bottom:1rem;">${team.name} [${team.tag}] — Drivers (${drivers.length}/${MAX_ROSTER_SIZE})</h4>
    <div class="mod-list" id="dm-driver-list">
      ${drivers.length ? drivers.map(d => `<div class="mod-list-item">
        <span class="ml-name">${d.name}</span>
        <span class="ml-info">${d.role || 'Member'}</span>
        <button class="btn btn-danger btn-sm" data-dm-remove="${teamId}:${d.name}">Remove</button>
      </div>`).join('') : '<p class="empty-state">No drivers.</p>'}
    </div>
    ${drivers.length < MAX_ROSTER_SIZE ? `
    <div style="display:flex;gap:.5rem;margin-top:1rem;align-items:end;">
      <div class="form-group" style="flex:1;margin:0;">
        <label for="dm-name">Driver Name</label>
        <input type="text" id="dm-name" placeholder="Driver name">
      </div>
      <div class="form-group" style="width:140px;margin:0;">
        <label for="dm-role">Role</label>
        <select id="dm-role">
          <option value="Member">Member</option>
          <option value="Co-Leader">Co-Leader</option>
          <option value="Leader">Leader</option>
        </select>
      </div>
      <button class="btn btn-primary btn-sm" id="dm-add-btn" style="height:38px;">Add</button>
    </div>` : '<p style="color:var(--text-mute);font-size:.82rem;margin-top:.5rem;">Roster full (${MAX_ROSTER_SIZE}/${MAX_ROSTER_SIZE})</p>'}
    <div style="margin-top:.75rem;"><button class="btn btn-ghost btn-sm" id="dm-close-btn">Close</button></div>
  `;

  // Wire remove buttons
  el.querySelectorAll('[data-dm-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [tid, dName] = btn.dataset.dmRemove.split(':');
      const t = teamsCache.find(x => x.id === tid);
      if (!t) return;
      const newRoster = (t.roster || []).filter(d => d.name !== dName);
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', tid), { roster: newRoster });
      batch.update(doc(db, 'standings', tid), { roster: newRoster });
      await batch.commit();
      toast(`Removed ${dName}`);
      openDriverManager(tid);
    });
  });

  // Wire add button
  const addBtn = el.querySelector('#dm-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const dName = document.getElementById('dm-name').value.trim();
      const dRole = document.getElementById('dm-role').value;
      if (!dName) { toast('Enter a driver name', true); return; }
      const t = teamsCache.find(x => x.id === teamId);
      if (!t) return;
      const roster = t.roster || [];
      if (roster.length >= MAX_ROSTER_SIZE) { toast(`Maximum ${MAX_ROSTER_SIZE} drivers`, true); return; }
      if (roster.find(d => d.name === dName)) { toast('Driver already on roster', true); return; }
      const newRoster = [...roster, { name: dName, role: dRole }];
      const batch = writeBatch(db);
      batch.update(doc(db, 'teams', teamId), { roster: newRoster });
      batch.update(doc(db, 'standings', teamId), { roster: newRoster });
      await batch.commit();
      toast(`Added ${dName}`);
      openDriverManager(teamId);
    });
  }

  // Wire close
  el.querySelector('#dm-close-btn')?.addEventListener('click', () => {
    el.style.display = 'none';
  });
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
  if (c.streakBonus) rows += `<div class="crp-row"><span>Streak bonus x${c.newStreak} (${loseTeam?.name}'s streak value)</span><span class="cv">+${c.streakBonus}</span></div>`;
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

// --- Season Reset ---
function seasonReset() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const btn = seasonResetBtn;
  if (btn.dataset.confirm !== 'season') {
    btn.textContent = 'Click again to confirm reset';
    btn.dataset.confirm = 'season';
    setTimeout(() => { btn.textContent = 'Reset Season'; delete btn.dataset.confirm; }, 4000);
    return;
  }
  delete btn.dataset.confirm;
  btn.textContent = 'Reset Season';

  const batch = writeBatch(db);
  standingsCache.forEach(s => {
    batch.update(doc(db, 'standings', s.id), {
      crp: 0, wins: 0, losses: 0, mapWins: 0, mapLosses: 0,
      winRate: 0, streak: 0, consecutive_wins: 0, match_history: []
    });
  });
  batch.commit()
    .then(() => toast('Season reset complete — all CRP, W/L and history cleared'))
    .catch(e => toast('Reset failed: ' + e.message, true));
}

// --- Delete Team ---
function deleteTeamAction() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const teamId = document.getElementById('del-team').value;
  if (!teamId) { toast('Select a team first', true); return; }
  const btn = delTeamBtn;
  if (btn.dataset.confirm !== teamId) {
    btn.textContent = 'Click again to confirm';
    btn.dataset.confirm = teamId;
    setTimeout(() => { btn.textContent = 'Delete Team'; delete btn.dataset.confirm; }, 3000);
    return;
  }
  delete btn.dataset.confirm;
  btn.textContent = 'Delete Team';

  const batch = writeBatch(db);
  batch.delete(doc(db, 'teams', teamId));
  batch.delete(doc(db, 'standings', teamId));
  batch.commit()
    .then(() => toast('Team deleted'))
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
      return `<option value="${m.id}">${m.teamAName} vs ${m.teamBName} (${dateStr})</option>`;
    }).join('');
}

function deleteMatchAction() {
  if (staffRole !== 'admin') { toast('Admin access required', true); return; }
  const matchId = document.getElementById('del-match').value;
  if (!matchId) { toast('Select a match first', true); return; }
  const btn = delMatchBtn;
  if (btn.dataset.confirm !== matchId) {
    btn.textContent = 'Click again to confirm';
    btn.dataset.confirm = matchId;
    setTimeout(() => { btn.textContent = 'Delete Match'; delete btn.dataset.confirm; }, 3000);
    return;
  }
  delete btn.dataset.confirm;
  btn.textContent = 'Delete Match';

  deleteDoc(doc(db, 'matches', matchId))
    .then(() => { toast('Match deleted. CRP and standings were NOT reverted.'); loadMatchesForDelete(); })
    .catch(e => toast('Delete failed: ' + e.message, true));
}

// ---------------------------------------------------------------------------
// Battles
// ---------------------------------------------------------------------------

async function createBattle() {
  const taId = document.getElementById('b-ta').value;
  const tbId = document.getElementById('b-tb').value;
  const threadId = document.getElementById('b-thread').value.trim();

  if (!taId || !tbId) { toast('Select both teams', true); return; }
  if (taId === tbId) { toast('Teams must be different', true); return; }

  const tA = teamsCache.find(t => t.id === taId);
  const tB = teamsCache.find(t => t.id === tbId);
  const sA = standingsCache.find(s => s.id === taId);
  const sB = standingsCache.find(s => s.id === tbId);

  // Live battles are always BO3 (banpick produces 3 maps)
  const format = 'BO3';
  const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const now = Timestamp.now();
  const batch = writeBatch(db);

  batch.set(doc(db, 'sessions', sessionId), {
    phase: 'WAITING',
    homeA: null, homeB: null, bans: [],
    history: [{ text: 'Session initialized.', timestamp: Date.now() }],
    createdAt: Date.now(),
    teamAName: tA.name, teamBName: tB.name,
    teamAClaimed: false, teamBClaimed: false
  });

  const matchRef = doc(collection(db, 'matches'));
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
      return `<div class="mod-list-item">
        <span class="ml-name">${b.teamAName} [${b.teamATag || ''}] vs ${b.teamBName} [${b.teamBTag || ''}]</span>
        <span class="ml-info">${b.score?.teamA || 0} — ${b.score?.teamB || 0}</span>
        <span class="ml-info">${dateStr}</span>
        <a href="/battle?id=${b.id}" class="btn btn-ghost btn-sm" target="_blank">View</a>
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
  if (invite.used) {
    errEl.textContent = 'This invite code has already been used';
    errEl.style.display = 'block';
    return;
  }

  // Create staff doc and mark invite as used
  const batch = writeBatch(db);
  batch.set(doc(db, 'staff', user.uid), {
    discordUsername: user.displayName || 'Unknown',
    role: invite.role || 'moderator',
    inviteCode: code,
    addedAt: Timestamp.now(),
    addedBy: 'invite:' + code
  });
  batch.update(inviteRef, { used: true, usedBy: user.uid, usedAt: Timestamp.now() });

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
