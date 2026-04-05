import { db, doc, setDoc, onSnapshot, updateDoc, getDoc, arrayUnion } from './firebase.js';

// --- APP STATE & CONSTANTS ---

const MAPS = [
    { id: 0, name: 'Akina', image: '/img/akina_day.png' },
    { id: 1, name: 'Tsuchisaka', image: '/img/tsuchisaka_day.png' },
    { id: 2, name: 'Tsubaki', image: '/img/tsubaki_day.png' },
    { id: 3, name: 'Irohazaka', image: '/img/irohazaka_day.png' },
    { id: 4, name: 'Akagi', image: '/img/akagi_day.png' },
    { id: 5, name: 'Usui', image: '/img/usui_day.png' },
    { id: 6, name: 'Myogi', image: '/img/myogi_day.png' },
    { id: 7, name: 'Sadamine', image: '/img/sadamine_day.png' },
    { id: 9, name: 'Nagao', image: '/img/nagao_day.png' },
    { id: 10, name: 'Tsukuba', image: '/img/tsukuba_day.png' },
    { id: 11, name: 'Nanamagari', image: '/img/nanamagari_day.png' },
    { id: 12, name: 'Takigahara', image: '/img/takigahara_day.png' },
    { id: 13, name: 'Ashinoko', image: '/img/ashinoko_day.png' },
    { id: 14, name: 'Enna Skyline', image: '/img/enna_day.png' },
    { id: 15, name: 'Shomaru', image: '/img/shomaru_day.png' }
];

// STATE PHASES
const PHASE = {
    WAITING: 'WAITING',
    PICK_HOME_A: 'PICK_HOME_A',
    PICK_HOME_B: 'PICK_HOME_B',
    BAN_A: 'BAN_A',
    BAN_B: 'BAN_B',
    PICK_MAP_A: 'PICK_MAP_A',
    PICK_MAP_B: 'PICK_MAP_B',
    RACING: 'RACING',
    DECIDER: 'DECIDER',
    COMPLETE: 'COMPLETE'
};

const ROLES = {
    TEAM_A: 'TEAM_A',
    TEAM_B: 'TEAM_B',
    SPECTATOR: 'SPECTATOR'
};

let currentSessionId = null;
let playerRole = ROLES.SPECTATOR; // Default
let localState = {
    phase: PHASE.WAITING,
    format: 'BO3',
    round: 1,
    homeA: null,
    homeB: null,
    bans: [],
    picks: [],
    liveScore: { teamA: 0, teamB: 0 },
    teamAHigherRank: true,
    matchId: null,
    history: [],
    teamAName: 'Team A',
    teamBName: 'Team B',
    teamAClaimed: false,
    teamBClaimed: false
};

let unsubscribeSnapshot = null;

// --- DOM ELEMENTS ---
const lobbyScreen = document.getElementById('lobby-screen');
const createSection = document.getElementById('create-section');
const joinSection = document.getElementById('join-section');
const gameScreen = document.getElementById('game-screen');
const turnDisplay = document.getElementById('turn-display');
const connectionStatus = document.getElementById('connection-status');
const historyLog = document.getElementById('history-log');

// --- INIT ---

function init() {
    renderMapGrid(); // Initial render to populate grid if needed

    // Check URL params for join link
    const urlParams = new URLSearchParams(window.location.search);
    const joinId = urlParams.get('join');

    if (joinId) {
        // Show Join UI
        createSection.classList.add('hidden');
        joinSection.classList.remove('hidden');
        setupJoinListeners(joinId);
        listenToSession(joinId); // Start listening immediately to update button availability
    } else {
        // Show Create UI
        createSection.classList.remove('hidden');
        joinSection.classList.add('hidden');
        document.getElementById('create-session-btn').addEventListener('click', createSession);
    }
}

// --- FIREBASE LOGIC ---

async function createSession() {
    // Clear any previous role when creating a new session
    localStorage.removeItem('banpick_session');

    const nameA = document.getElementById('input-team-a').value.trim() || "Team A";
    const nameB = document.getElementById('input-team-b').value.trim() || "Team B";

    // Generate Random 6-char ID
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    currentSessionId = sessionId;

    // Initial State
    const initialState = {
        phase: PHASE.WAITING, // Wait for both teams to join
        homeA: null,
        homeB: null,
        bans: [],
        history: [{ text: "Session initialized.", timestamp: Date.now() }],
        createdAt: Date.now(),
        teamAName: nameA,
        teamBName: nameB,
        teamAClaimed: false,
        teamBClaimed: false
    };

    try {
        await setDoc(doc(db, "sessions", sessionId), initialState);
        console.log(`Session ${sessionId} created.`);

        // Auto-redirect to join link
        const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?join=${sessionId}`;
        window.location.href = newUrl;

    } catch (e) {
        console.error("Error creating session:", e);
        alert("Failed to create session. Check console.");
    }
}

function setupJoinListeners(sessionId) {
    currentSessionId = sessionId;

    // Check if user was previously in this session
    const savedSession = localStorage.getItem('banpick_session');
    if (savedSession) {
        try {
            const { sessionId: savedSessionId, role, timestamp } = JSON.parse(savedSession);

            // If same session and saved within last 24 hours, remember role but stay in lobby
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            if (savedSessionId === sessionId && timestamp > oneDayAgo) {
                console.log("Found saved role:", role);
                playerRole = role;
                // We stay in lobby to allow switching to spectator if desired
            } else {
                localStorage.removeItem('banpick_session');
            }
        } catch (e) {
            console.error("Error parsing saved session:", e);
            localStorage.removeItem('banpick_session');
        }
    }

    document.getElementById('btn-copy-link').addEventListener('click', () => {
        const link = window.location.href;
        navigator.clipboard.writeText(link).then(() => {
            const btn = document.getElementById('btn-copy-link');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> LINK COPIED';
            btn.classList.remove('text-white-50');
            btn.classList.add('text-success', 'fw-bold');
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.classList.remove('text-success', 'fw-bold');
                btn.classList.add('text-white-50');
            }, 2000);
        });
    });

    document.getElementById('btn-copy-game').addEventListener('click', () => {
        const link = window.location.href;
        navigator.clipboard.writeText(link).then(() => {
            const btn = document.getElementById('btn-copy-game');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="text-success fw-bold" style="font-size: 0.7rem; margin-left: 5px;">COPIED!</span>';
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        });
    });

    document.getElementById('btn-join-a').addEventListener('click', () => claimRole(sessionId, ROLES.TEAM_A));
    document.getElementById('btn-join-b').addEventListener('click', () => claimRole(sessionId, ROLES.TEAM_B));
    document.getElementById('btn-spectate').addEventListener('click', () => {
        playerRole = ROLES.SPECTATOR;
        localStorage.setItem('banpick_session', JSON.stringify({
            sessionId: currentSessionId,
            role: ROLES.SPECTATOR,
            timestamp: Date.now()
        }));
        enterGameMode();
    });
}

async function claimRole(sessionId, role) {
    // If we already have this role, just enter the game
    if (playerRole === role) {
        enterGameMode();
        return;
    }

    if ((role === ROLES.TEAM_A && localState.teamAClaimed) ||
        (role === ROLES.TEAM_B && localState.teamBClaimed)) {
        alert("This role is already taken!");
        return;
    }

    try {
        const update = {};
        if (role === ROLES.TEAM_A) update.teamAClaimed = true;
        if (role === ROLES.TEAM_B) update.teamBClaimed = true;

        // Check if both teams will be ready after this claim
        const teamAWillBeClaimed = (role === ROLES.TEAM_A) || localState.teamAClaimed;
        const teamBWillBeClaimed = (role === ROLES.TEAM_B) || localState.teamBClaimed;
        const willBothBeReady = teamAWillBeClaimed && teamBWillBeClaimed;

        // If both teams are now ready and we're in WAITING phase, start the game
        if (willBothBeReady && localState.phase === PHASE.WAITING) {
            update.phase = PHASE.PICK_HOME_A;
            update.history = arrayUnion({
                text: "Both teams ready. Game starting!",
                timestamp: Date.now()
            });
        }

        const docRef = doc(db, "sessions", sessionId);
        await updateDoc(docRef, update);

        // Set role locally - the snapshot listener will handle entering game mode
        playerRole = role;

        // Save to localStorage for persistence across refreshes
        localStorage.setItem('banpick_session', JSON.stringify({
            sessionId: currentSessionId,
            role: role,
            timestamp: Date.now()
        }));

        // If we're still in lobby, enter game mode immediately
        // The UI will update when the snapshot arrives
        if (!lobbyScreen.classList.contains('hidden')) {
            enterGameMode();
        }

    } catch (e) {
        console.error("Error claiming role:", e);
        alert("Failed to claim role. Try again.");
    }
}

function listenToSession(sessionId) {
    if (unsubscribeSnapshot) unsubscribeSnapshot();

    const docRef = doc(db, "sessions", sessionId);
    unsubscribeSnapshot = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            handleStateUpdate(data);
        } else {
            console.log("Session deleted or invalid.");
            alert("Session not found!");
        }
    });
}

function handleStateUpdate(newState) {
    console.log("State update received:", newState.phase, "TeamA:", newState.teamAClaimed, "TeamB:", newState.teamBClaimed);
    localState = newState;
    updateLobbyButtons(); // Update button states based on claimed roles

    // Always update UI if we're in game screen
    if (!lobbyScreen.classList.contains('hidden')) {
        // Still in lobby, just update buttons
    } else {
        // In game, update game UI
        updateUI();
    }
}

function updateLobbyButtons() {
    const btnA = document.getElementById('btn-join-a');
    const btnB = document.getElementById('btn-join-b');

    if (btnA) {
        btnA.textContent = `JOIN AS ${localState.teamAName || 'TEAM A'}`;
        if (localState.teamAClaimed) {
            if (playerRole === ROLES.TEAM_A) {
                btnA.disabled = false;
                btnA.textContent = `RE-JOIN AS ${localState.teamAName || 'TEAM A'}`;
            } else {
                btnA.disabled = true;
                btnA.textContent += " (TAKEN)";
            }
        } else {
            btnA.disabled = false;
        }
    }

    if (btnB) {
        btnB.textContent = `JOIN AS ${localState.teamBName || 'TEAM B'}`;
        if (localState.teamBClaimed) {
            if (playerRole === ROLES.TEAM_B) {
                btnB.disabled = false;
                btnB.textContent = `RE-JOIN AS ${localState.teamBName || 'TEAM B'}`;
            } else {
                btnB.disabled = true;
                btnB.textContent += " (TAKEN)";
            }
        } else {
            btnB.disabled = false;
        }
    }

    // Hide status text if it exists
    const statusText = document.getElementById('lobby-game-status');
    if (statusText) statusText.classList.add('hidden');
}

// --- GAME LOGIC ---

function getFirstPicker(score, teamAHigherRank) {
    // Losing team picks first (advantage). If tied, lower-ranked team picks first.
    if (score.teamA < score.teamB) return 'A';
    if (score.teamB < score.teamA) return 'B';
    // Tied: lower-ranked picks first (advantage)
    return teamAHigherRank ? 'B' : 'A';
}

async function handleMapClick(mapId) {
    // Only Active Roles
    if (playerRole === ROLES.SPECTATOR) return;

    // Phase checks — which phases can each team act in?
    const teamAPhases = [PHASE.PICK_HOME_A, PHASE.BAN_A, PHASE.PICK_MAP_A];
    const teamBPhases = [PHASE.PICK_HOME_B, PHASE.BAN_B, PHASE.PICK_MAP_B];

    if (playerRole === ROLES.TEAM_A && !teamAPhases.includes(localState.phase)) return;
    if (playerRole === ROLES.TEAM_B && !teamBPhases.includes(localState.phase)) return;

    // Validation — can't click banned, home-picked, or secondary-picked maps
    if (localState.bans.includes(mapId)) return;
    if (localState.homeA === mapId || localState.homeB === mapId) return;
    if ((localState.picks || []).includes(mapId)) return;

    // Calculate Next State
    let updates = {};
    const mapName = MAPS.find(m => m.id === mapId).name;
    const now = Date.now();
    const nameA = localState.teamAName || "Team A";
    const nameB = localState.teamBName || "Team B";
    const format = localState.format || 'BO3';
    const round = localState.round || 1;
    const score = localState.liveScore || { teamA: 0, teamB: 0 };

    if (localState.phase === PHASE.PICK_HOME_A) {
        updates.homeA = mapId;
        updates.phase = PHASE.PICK_HOME_B;
        updates.history = arrayUnion({ text: `${nameA} picked HOME: ${mapName}`, timestamp: now });

    } else if (localState.phase === PHASE.PICK_HOME_B) {
        updates.homeB = mapId;
        if (localState.matchId) {
            // Live battle (BO3 or BO5): go to RACING, battle.js will orchestrate
            updates.phase = PHASE.RACING;
            updates.history = arrayUnion(
                { text: `${nameB} picked HOME: ${mapName}`, timestamp: now },
                { text: 'Home maps selected. Waiting for race results.', timestamp: now + 1 }
            );
        } else {
            // Standalone session (no battle): go straight to bans (legacy behavior)
            updates.phase = PHASE.BAN_A;
            updates.history = arrayUnion({ text: `${nameB} picked HOME: ${mapName}`, timestamp: now });
        }

    } else if (localState.phase === PHASE.BAN_A) {
        updates.bans = arrayUnion(mapId);
        updates.history = arrayUnion({ text: `${nameA} BANNED: ${mapName}`, timestamp: now });
        const predictedBans = [...localState.bans, mapId];
        updates.phase = getNextBanPhase('A', predictedBans, localState, format, round, score);

    } else if (localState.phase === PHASE.BAN_B) {
        updates.bans = arrayUnion(mapId);
        updates.history = arrayUnion({ text: `${nameB} BANNED: ${mapName}`, timestamp: now });
        const predictedBans = [...localState.bans, mapId];
        updates.phase = getNextBanPhase('B', predictedBans, localState, format, round, score);

    } else if (localState.phase === PHASE.PICK_MAP_A) {
        updates.picks = arrayUnion(mapId);
        updates.history = arrayUnion({ text: `${nameA} picked MAP: ${mapName}`, timestamp: now });
        const pickCount = (localState.picks || []).length + 1;
        if (pickCount >= 2) {
            updates.phase = PHASE.RACING;
            updates.history = arrayUnion({ text: 'All maps selected. Waiting for race results.', timestamp: now + 1 });
        } else {
            updates.phase = PHASE.PICK_MAP_B;
        }

    } else if (localState.phase === PHASE.PICK_MAP_B) {
        updates.picks = arrayUnion(mapId);
        updates.history = arrayUnion({ text: `${nameB} picked MAP: ${mapName}`, timestamp: now });
        const pickCount = (localState.picks || []).length + 1;
        if (pickCount >= 2) {
            updates.phase = PHASE.RACING;
            updates.history = arrayUnion({ text: 'All maps selected. Waiting for race results.', timestamp: now + 1 });
        } else {
            updates.phase = PHASE.PICK_MAP_A;
        }
    }

    // Apply Update
    try {
        const docRef = doc(db, "sessions", currentSessionId);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating game state:", e);
    }
}

// Determine next phase after a ban
function getNextBanPhase(banningTeam, predictedBans, state, format, round, score) {
    const picks = state.picks || [];

    // BO5 secondary bans: round 2 for live battles, round 1 for standalone sessions
    if (format === 'BO5' && (round === 2 || (round === 1 && !state.matchId))) {
        if (predictedBans.length >= 4) {
            const firstPicker = getFirstPicker(score, state.teamAHigherRank);
            return firstPicker === 'A' ? PHASE.PICK_MAP_A : PHASE.PICK_MAP_B;
        }
        return banningTeam === 'A' ? PHASE.BAN_B : PHASE.BAN_A;
    }

    // Decider round (BO3 round 2, BO5 round 3): ban until 1 map left
    if (checkDeciderPhase(predictedBans, state.homeA, state.homeB, picks)) {
        return PHASE.DECIDER;
    }
    return banningTeam === 'A' ? PHASE.BAN_B : PHASE.BAN_A;
}

function checkDeciderPhase(bans, homeA, homeB, picks) {
    const totalMaps = MAPS.length;
    const picked = (homeA !== null ? 1 : 0) + (homeB !== null ? 1 : 0) + (picks || []).length;
    const banned = bans.length;
    const remaining = totalMaps - picked - banned;
    return remaining === 1;
}

// --- RENDER ---

const statusBar = document.getElementById('status-bar');
const mapGridContainer = document.getElementById('map-grid');
const resultsView = document.getElementById('results-view');

function enterGameMode() {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    document.getElementById('display-session-id').textContent = currentSessionId;

    // Update URL if not already done (it should be)
    // const newUrl = ...

    // Role Display
    const roleEl = document.getElementById('player-role');
    roleEl.style.color = '#fff'; // Always white as requested

    if (playerRole === ROLES.TEAM_A) {
        roleEl.textContent = (localState.teamAName || "TEAM A").toUpperCase();
    } else if (playerRole === ROLES.TEAM_B) {
        roleEl.textContent = (localState.teamBName || "TEAM B").toUpperCase();
    } else {
        roleEl.textContent = "SPECTATOR";
    }

    // Update UI with current state
    updateUI();
}

function updateUI() {
    // Status Badge
    const bothTeamsReady = localState.teamAClaimed && localState.teamBClaimed;

    if (bothTeamsReady) {
        connectionStatus.textContent = "ACTIVE";
        connectionStatus.className = 'bp-badge bp-badge-active';
    } else {
        connectionStatus.textContent = "WAITING";
        connectionStatus.className = 'bp-badge bp-badge-waiting';
    }

    // Header Text & Styling
    let mainText = "";
    let subText = "";
    let turnColorClass = "";

    // Team Names
    const nameA = (localState.teamAName || "TEAM A").toUpperCase();
    const nameB = (localState.teamBName || "TEAM B").toUpperCase();

    switch (localState.phase) {
        case PHASE.WAITING:
            mainText = "WAITING TO START";
            break;
        case PHASE.PICK_HOME_A:
            mainText = `${nameA} TURN`;
            subText = "Picking Home Map";
            turnColorClass = "team-a-turn";
            break;
        case PHASE.PICK_HOME_B:
            mainText = `${nameB} TURN`;
            subText = "Picking Home Map";
            turnColorClass = "team-b-turn";
            break;
        case PHASE.BAN_A:
            mainText = `${nameA} TURN`;
            subText = "Banning a Map";
            turnColorClass = "team-a-turn";
            break;
        case PHASE.BAN_B:
            mainText = `${nameB} TURN`;
            subText = "Banning a Map";
            turnColorClass = "team-b-turn";
            break;
        case PHASE.PICK_MAP_A:
            mainText = `${nameA} TURN`;
            subText = "Picking a Map";
            turnColorClass = "team-a-turn";
            break;
        case PHASE.PICK_MAP_B:
            mainText = `${nameB} TURN`;
            subText = "Picking a Map";
            turnColorClass = "team-b-turn";
            break;
        case PHASE.RACING:
            mainText = "RACING";
            subText = "Waiting for race results";
            break;
        case PHASE.DECIDER:
            mainText = "DECIDER CHOSEN";
            subText = "Ban Phase Complete";
            break;
        case PHASE.COMPLETE:
            mainText = "COMPLETE";
            subText = "All maps determined";
            break;
    }

    // Update Text
    const turnDisplay = document.getElementById('turn-display');
    const turnSubtext = document.getElementById('turn-subtext');

    // Check if it's my turn
    const isMyTurn = (playerRole === ROLES.TEAM_A && [PHASE.PICK_HOME_A, PHASE.BAN_A, PHASE.PICK_MAP_A].includes(localState.phase)) ||
        (playerRole === ROLES.TEAM_B && [PHASE.PICK_HOME_B, PHASE.BAN_B, PHASE.PICK_MAP_B].includes(localState.phase));

    // Add waiting indicator if not my turn and game is active
    const isGameActive = ![PHASE.WAITING, PHASE.DECIDER, PHASE.RACING, PHASE.COMPLETE].includes(localState.phase);
    const waitingIndicator = '<span class="waiting-indicator"><span></span><span></span><span></span></span>';

    if (turnDisplay) {
        if (isGameActive && !isMyTurn && playerRole !== ROLES.SPECTATOR) {
            turnDisplay.innerHTML = mainText + waitingIndicator;
        } else {
            turnDisplay.textContent = mainText;
        }
    }
    if (turnSubtext) turnSubtext.textContent = subText;

    // Status Bar Classes
    if (statusBar) {
        statusBar.classList.remove('team-a-turn', 'team-b-turn', 'pulse-pick', 'pulse-ban', 'your-turn');
        if (turnColorClass) statusBar.classList.add(turnColorClass);

        // Pulse Type
        if ([PHASE.PICK_HOME_A, PHASE.PICK_HOME_B, PHASE.PICK_MAP_A, PHASE.PICK_MAP_B].includes(localState.phase)) {
            statusBar.classList.add('pulse-pick');
        } else if (localState.phase === PHASE.BAN_A || localState.phase === PHASE.BAN_B) {
            statusBar.classList.add('pulse-ban');
        }

        // Turn Flash - check role
        const isMyTurn2 = (playerRole === ROLES.TEAM_A && [PHASE.PICK_HOME_A, PHASE.BAN_A, PHASE.PICK_MAP_A].includes(localState.phase)) ||
            (playerRole === ROLES.TEAM_B && [PHASE.PICK_HOME_B, PHASE.BAN_B, PHASE.PICK_MAP_B].includes(localState.phase));

        if (isMyTurn2) {
            statusBar.classList.add('your-turn');
        }
    }

    // Highlight Text Color - REMOVED per user request (White only)
    if (turnDisplay) {
        turnDisplay.style.color = '#fff';
    }

    // Pipeline visual
    renderPipeline();

    // PHASE LOGIC
    const racingView = document.getElementById('racing-view');
    if (localState.phase === PHASE.DECIDER || localState.phase === PHASE.COMPLETE) {
        if (racingView) racingView.style.display = 'none';
        renderResults();
    } else if (localState.phase === PHASE.RACING) {
        if (resultsView) resultsView.classList.remove('visible');
        if (mapGridContainer) {
            mapGridContainer.classList.add('fade-out');
            setTimeout(() => { mapGridContainer.style.display = 'none'; }, 500);
        }
        renderRacingView();
    } else {
        if (racingView) racingView.style.display = 'none';
        if (resultsView) resultsView.classList.remove('visible');
        if (mapGridContainer) {
            mapGridContainer.classList.remove('fade-out');
            mapGridContainer.style.display = 'grid';
        }
        renderMapGrid();
    }

    // Render Log
    if (localState.history) {
        historyLog.innerHTML = localState.history.map(entry =>
            `<div class="log-entry"><small style="color:var(--text-mute)">[${new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</small> ${entry.text}</div>`
        ).join('');
        historyLog.scrollTop = historyLog.scrollHeight;
    }
}

function renderResults() {
    // Calculate Decider
    const allIds = MAPS.map(m => m.id);
    const taken = [...localState.bans, ...(localState.picks || [])];
    if (localState.homeA !== null) taken.push(localState.homeA);
    if (localState.homeB !== null) taken.push(localState.homeB);
    const deciderId = allIds.find(id => !taken.includes(id));

    // Fade Out Grid
    if (mapGridContainer) {
        mapGridContainer.classList.add('fade-out');
        setTimeout(() => { mapGridContainer.style.display = 'none'; }, 500);
    }
    const racingView = document.getElementById('racing-view');
    if (racingView) racingView.style.display = 'none';

    // Populate Results
    setTimeout(() => {
        if (!resultsView) return;
        const nameA = (localState.teamAName || "TEAM A").toUpperCase();
        const nameB = (localState.teamBName || "TEAM B").toUpperCase();
        const format = localState.format || 'BO3';
        const picks = localState.picks || [];

        // Build results grid dynamically
        let gridHtml = '';
        let mapNum = 1;

        // Home maps (always present)
        const homeA = MAPS.find(m => m.id === localState.homeA);
        const homeB = MAPS.find(m => m.id === localState.homeB);

        gridHtml += `<div class="bp-result-card">
            <div class="bp-result-label">MAP ${mapNum}: ${nameA} HOME</div>
            <div>${createResultCard(homeA, 'picked')}</div>
        </div>`;
        mapNum++;
        gridHtml += `<div class="bp-result-card">
            <div class="bp-result-label">MAP ${mapNum}: ${nameB} HOME</div>
            <div>${createResultCard(homeB, 'picked')}</div>
        </div>`;
        mapNum++;

        // Secondary picks (BO5 only)
        if (format === 'BO5' && picks.length > 0) {
            picks.forEach(pickId => {
                const pickMap = MAPS.find(m => m.id === pickId);
                gridHtml += `<div class="bp-result-card">
                    <div class="bp-result-label">MAP ${mapNum}: PICK</div>
                    <div>${createResultCard(pickMap, 'picked')}</div>
                </div>`;
                mapNum++;
            });
        }

        // Decider
        if (deciderId != null) {
            const decider = MAPS.find(m => m.id === deciderId);
            gridHtml += `<div class="bp-result-card" style="grid-column: 1 / -1; max-width: 320px; justify-self: center;">
                <div class="bp-result-label decider-label">MAP ${mapNum}: DECIDER</div>
                <div>${createResultCard(decider, 'decider')}</div>
            </div>`;
        }

        resultsView.innerHTML = `<div class="bp-results-grid" style="grid-template-columns: repeat(2, 1fr); gap: 1.2rem; max-width: 700px; width: 100%;">${gridHtml}</div>`;
        resultsView.style.display = 'flex';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                resultsView.classList.add('visible');
            });
        });
    }, 500);
}

function renderRacingView() {
    const racingView = document.getElementById('racing-view');
    if (!racingView) return;

    const nameA = (localState.teamAName || "TEAM A").toUpperCase();
    const nameB = (localState.teamBName || "TEAM B").toUpperCase();
    const round = localState.round || 1;
    const picks = localState.picks || [];
    const score = localState.liveScore || { teamA: 0, teamB: 0 };

    let mapsHtml = '';

    if (round === 1) {
        // Round 1: show home maps
        if (localState.homeA !== null) {
            const homeA = MAPS.find(m => m.id === localState.homeA);
            const homeB = MAPS.find(m => m.id === localState.homeB);
            mapsHtml += `<div class="racing-map-row">
                <div class="racing-map-card">${createResultCard(homeA, 'picked')}<div class="racing-map-label">${nameA} HOME</div></div>
                <div class="racing-map-card">${createResultCard(homeB, 'picked')}<div class="racing-map-label">${nameB} HOME</div></div>
            </div>`;
        }
    } else if (round === 2) {
        // Round 2: show secondary picks
        if (picks.length > 0) {
            mapsHtml += '<div class="racing-map-row">';
            picks.forEach((pickId, i) => {
                const pickMap = MAPS.find(m => m.id === pickId);
                mapsHtml += `<div class="racing-map-card">${createResultCard(pickMap, 'picked')}<div class="racing-map-label">MAP ${3 + i}</div></div>`;
            });
            mapsHtml += '</div>';
        }
    }

    const battleLink = localState.matchId ? `<a href="/battle?id=${localState.matchId}" class="racing-battle-link" target="_blank">Go to Battle Page</a>` : '';

    racingView.innerHTML = `
        <div class="racing-content">
            <div class="racing-score">${score.teamA} — ${score.teamB}</div>
            <div class="racing-title">WAITING FOR RACE RESULTS</div>
            <div class="racing-subtitle">Maps will be raced on the battle page</div>
            ${mapsHtml}
            ${battleLink}
        </div>
    `;
    racingView.style.display = 'flex';
}

function createResultCard(map, type) {
    if (!map) return '';
    const extraClass = type === 'decider' ? 'decider' : 'picked';
    return `
        <div class="bp-map ${extraClass}" style="pointer-events:none;cursor:default;aspect-ratio:16/9;">
            <div class="bp-map-bg" style="background-image:url('${map.image}');"></div>
            <div class="bp-map-name">${map.name}</div>
        </div>
    `;
}

function renderMapGrid() {
    if (!mapGridContainer) return;
    mapGridContainer.innerHTML = '';

    const picks = localState.picks || [];

    // Find Decider
    let deciderId = null;
    if (localState.phase === PHASE.DECIDER) {
        const allIds = MAPS.map(m => m.id);
        const taken = [...localState.bans, ...picks];
        if (localState.homeA !== null) taken.push(localState.homeA);
        if (localState.homeB !== null) taken.push(localState.homeB);
        deciderId = allIds.find(id => !taken.includes(id));
    }

    // Determine current action type
    const isPickPhase = [PHASE.PICK_HOME_A, PHASE.PICK_HOME_B, PHASE.PICK_MAP_A, PHASE.PICK_MAP_B].includes(localState.phase);
    const isBanPhase = [PHASE.BAN_A, PHASE.BAN_B].includes(localState.phase);
    const isInteractivePhase = isPickPhase || isBanPhase;

    // Determine action text for overlay
    let actionText = '';
    let actionColor = '';
    if (localState.phase === PHASE.PICK_HOME_A || localState.phase === PHASE.PICK_HOME_B) {
        actionText = 'PICK HOME';
        actionColor = '#2ecc71';
    } else if (localState.phase === PHASE.PICK_MAP_A || localState.phase === PHASE.PICK_MAP_B) {
        actionText = 'PICK MAP';
        actionColor = '#2ecc71';
    } else if (isBanPhase) {
        actionText = 'BAN MAP';
        actionColor = '#ff3d00';
    }

    // isMyTurn check
    const isMyTurn = (playerRole === ROLES.TEAM_A && [PHASE.PICK_HOME_A, PHASE.BAN_A, PHASE.PICK_MAP_A].includes(localState.phase)) ||
        (playerRole === ROLES.TEAM_B && [PHASE.PICK_HOME_B, PHASE.BAN_B, PHASE.PICK_MAP_B].includes(localState.phase));

    MAPS.forEach(map => {
        const el = document.createElement('div');
        el.className = 'bp-map';

        // Add Picking/Banning Class for CSS Hover
        if (isPickPhase) el.classList.add('picking');
        else if (isBanPhase) el.classList.add('banning');

        const bg = document.createElement('div');
        bg.className = 'bp-map-bg';
        bg.style.backgroundImage = `url('${map.image}')`;
        el.appendChild(bg);

        // Hover Overlay
        if (isInteractivePhase) {
            const hoverOverlay = document.createElement('div');
            hoverOverlay.className = 'bp-map-overlay';
            hoverOverlay.style.color = actionColor;
            hoverOverlay.innerHTML = `<div class="bp-map-overlay-text">${actionText}</div>`;
            el.appendChild(hoverOverlay);
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'bp-map-name';
        nameEl.textContent = map.name;
        el.appendChild(nameEl);

        // State Styling
        if (localState.bans.includes(map.id)) {
            el.classList.add('banned');
        } else if (localState.homeA === map.id || localState.homeB === map.id) {
            el.classList.add('picked');
        } else if (picks.includes(map.id)) {
            el.classList.add('picked', 'secondary-pick');
        } else if (map.id === deciderId) {
            el.classList.add('decider');
        } else {
            if (!isMyTurn || localState.phase === PHASE.DECIDER) {
                el.classList.add('disabled');
            } else {
                el.onclick = () => handleMapClick(map.id);
            }
        }

        mapGridContainer.appendChild(el);
    });
}

// --- PIPELINE ---

function getPipelineStages() {
    const format = localState.format || 'BO3';
    const round = localState.round || 1;

    if (format === 'BO5') {
        const stages = [
            { id: 'home-picks', label: 'HOME PICKS' },
            { id: 'race-homes', label: 'RACE HOMES' },
        ];
        if (round >= 2) {
            stages.push({ id: 'secondary-bans', label: 'BANS' });
            stages.push({ id: 'secondary-picks', label: 'PICKS' });
            stages.push({ id: 'race-secondary', label: 'RACE' });
        }
        if (round >= 3) {
            stages.push({ id: 'decider-bans', label: 'DECIDER BANS' });
            stages.push({ id: 'race-decider', label: 'DECIDER' });
        }
        return stages;
    }

    // BO3
    const stages = [
        { id: 'home-picks', label: 'HOME PICKS' },
        { id: 'race-homes', label: 'RACE HOMES' },
    ];
    // Decider stages only appear once round 2 is reached
    if (round >= 2) {
        stages.push({ id: 'decider-bans', label: 'DECIDER BANS' });
        stages.push({ id: 'race-decider', label: 'DECIDER' });
    }
    return stages;
}

function getCurrentStageId() {
    const phase = localState.phase;
    const format = localState.format || 'BO3';
    const round = localState.round || 1;

    if (phase === PHASE.WAITING || phase === PHASE.PICK_HOME_A || phase === PHASE.PICK_HOME_B) return 'home-picks';

    if (format === 'BO5') {
        if (phase === PHASE.RACING && round === 1) return 'race-homes';
        if (round === 2 && (phase === PHASE.BAN_A || phase === PHASE.BAN_B)) return 'secondary-bans';
        if (round === 2 && (phase === PHASE.PICK_MAP_A || phase === PHASE.PICK_MAP_B)) return 'secondary-picks';
        if (phase === PHASE.RACING && round === 2) return 'race-secondary';
        if (round === 3 && (phase === PHASE.BAN_A || phase === PHASE.BAN_B)) return 'decider-bans';
        if (phase === PHASE.DECIDER || phase === PHASE.COMPLETE) return 'race-decider';
        return 'home-picks';
    }

    // BO3
    if (phase === PHASE.RACING && round === 1) return 'race-homes';
    if (round >= 2 && (phase === PHASE.BAN_A || phase === PHASE.BAN_B)) return 'decider-bans';
    if (phase === PHASE.DECIDER || phase === PHASE.COMPLETE) return 'race-decider';
    return 'home-picks';
}

function renderPipeline() {
    const container = document.getElementById('pipeline');
    if (!container) return;

    const stages = getPipelineStages();
    const currentId = getCurrentStageId();
    let reachedCurrent = false;

    container.innerHTML = stages.map((stage, i) => {
        let stateClass = '';
        if (stage.id === currentId) {
            stateClass = 'pipeline-active';
            reachedCurrent = true;
        } else if (!reachedCurrent) {
            stateClass = 'pipeline-done';
        } else {
            stateClass = 'pipeline-future';
        }
        const separator = i < stages.length - 1 ? '<span class="pipeline-sep"></span>' : '';
        return `<span class="pipeline-stage ${stateClass}">${stage.label}</span>${separator}`;
    }).join('');
}

// Run Init
document.addEventListener('DOMContentLoaded', init);
