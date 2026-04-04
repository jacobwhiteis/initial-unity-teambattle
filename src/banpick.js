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
    DECIDER: 'DECIDER'
};

const ROLES = {
    TEAM_A: 'TEAM_A',
    TEAM_B: 'TEAM_B',
    SPECTATOR: 'SPECTATOR'
};

let currentSessionId = null;
let playerRole = ROLES.SPECTATOR; // Default
let localState = {
    phase: PHASE.WAITING, // Default to waiting
    homeA: null,
    homeB: null,
    bans: [],
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

async function handleMapClick(mapId) {
    // Only Active Roles
    if (playerRole === ROLES.SPECTATOR) return;

    // Phase checks
    if (playerRole === ROLES.TEAM_A) {
        if (localState.phase !== PHASE.PICK_HOME_A && localState.phase !== PHASE.BAN_A) return;
    } else if (playerRole === ROLES.TEAM_B) {
        if (localState.phase !== PHASE.PICK_HOME_B && localState.phase !== PHASE.BAN_B) return;
    }

    // Validation
    if (localState.bans.includes(mapId)) return;
    if (localState.homeA === mapId || localState.homeB === mapId) return;

    // Calculate Next State
    let updates = {};
    const mapName = MAPS.find(m => m.id === mapId).name;
    const now = Date.now();

    // Team Names for Log
    const nameA = localState.teamAName || "Team A";
    const nameB = localState.teamBName || "Team B";

    if (localState.phase === PHASE.PICK_HOME_A) {
        updates.homeA = mapId;
        updates.phase = PHASE.PICK_HOME_B;
        updates.history = arrayUnion({ text: `${nameA} picked HOME: ${mapName}`, timestamp: now });
    } else if (localState.phase === PHASE.PICK_HOME_B) {
        updates.homeB = mapId;
        updates.phase = PHASE.BAN_A; // Start Bans
        updates.history = arrayUnion({ text: `${nameB} picked HOME: ${mapName}`, timestamp: now });
    } else if (localState.phase === PHASE.BAN_A) {
        updates.bans = arrayUnion(mapId);
        updates.history = arrayUnion({ text: `${nameA} BANNED: ${mapName}`, timestamp: now });

        const predictedBans = [...localState.bans, mapId];
        const nextPhase = checkDeciderPhase(predictedBans, localState.homeA, localState.homeB) ? PHASE.DECIDER : PHASE.BAN_B;
        updates.phase = nextPhase;

    } else if (localState.phase === PHASE.BAN_B) {
        updates.bans = arrayUnion(mapId);
        updates.history = arrayUnion({ text: `${nameB} BANNED: ${mapName}`, timestamp: now });

        const predictedBans = [...localState.bans, mapId];
        const nextPhase = checkDeciderPhase(predictedBans, localState.homeA, localState.homeB) ? PHASE.DECIDER : PHASE.BAN_A;
        updates.phase = nextPhase;
    }

    // Apply Update
    try {
        const docRef = doc(db, "sessions", currentSessionId);
        await updateDoc(docRef, updates);
    } catch (e) {
        console.error("Error updating game state:", e);
    }
}

function checkDeciderPhase(bans, homeA, homeB) {
    const totalMaps = MAPS.length;
    const picked = (homeA !== null ? 1 : 0) + (homeB !== null ? 1 : 0);
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
        case PHASE.DECIDER:
            mainText = "DECIDER CHOSEN";
            subText = "Ban Phase Complete";
            break;
    }

    // Update Text
    const turnDisplay = document.getElementById('turn-display');
    const turnSubtext = document.getElementById('turn-subtext');

    // Check if it's my turn
    const isMyTurn = (playerRole === ROLES.TEAM_A && (localState.phase === PHASE.PICK_HOME_A || localState.phase === PHASE.BAN_A)) ||
        (playerRole === ROLES.TEAM_B && (localState.phase === PHASE.PICK_HOME_B || localState.phase === PHASE.BAN_B));

    // Add waiting indicator if not my turn and game is active
    const isGameActive = localState.phase !== PHASE.WAITING && localState.phase !== PHASE.DECIDER;
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
        if (localState.phase === PHASE.PICK_HOME_A || localState.phase === PHASE.PICK_HOME_B) {
            statusBar.classList.add('pulse-pick');
        } else if (localState.phase === PHASE.BAN_A || localState.phase === PHASE.BAN_B) {
            statusBar.classList.add('pulse-ban');
        }

        // Turn Flash - check role
        const isMyTurn = (playerRole === ROLES.TEAM_A && (localState.phase === PHASE.PICK_HOME_A || localState.phase === PHASE.BAN_A)) ||
            (playerRole === ROLES.TEAM_B && (localState.phase === PHASE.PICK_HOME_B || localState.phase === PHASE.BAN_B));

        if (isMyTurn) {
            statusBar.classList.add('your-turn');
        }
    }

    // Highlight Text Color - REMOVED per user request (White only)
    if (turnDisplay) {
        turnDisplay.style.color = '#fff';
    }

    // PHASE LOGIC
    if (localState.phase === PHASE.DECIDER) {
        renderResults();
    } else {
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
    // 1. Calculate Decider
    const allIds = MAPS.map(m => m.id);
    const taken = [...localState.bans];
    if (localState.homeA !== null) taken.push(localState.homeA);
    if (localState.homeB !== null) taken.push(localState.homeB);
    const deciderId = allIds.find(id => !taken.includes(id));

    // 2. Fade Out Grid
    if (mapGridContainer) {
        mapGridContainer.classList.add('fade-out');
        setTimeout(() => { mapGridContainer.style.display = 'none'; }, 500);
    }

    // 3. Populate Results
    setTimeout(() => {
        if (resultsView) {
            resultsView.style.display = 'flex'; // Set display first

            const homeA = MAPS.find(m => m.id === localState.homeA);
            const homeB = MAPS.find(m => m.id === localState.homeB);
            const decider = MAPS.find(m => m.id === deciderId);

            const elHomeA = document.getElementById('res-home-a');
            const elHomeB = document.getElementById('res-home-b');
            const elDecider = document.getElementById('res-decider');

            if (elHomeA) elHomeA.innerHTML = createResultCard(homeA, 'picked');
            if (elHomeB) elHomeB.innerHTML = createResultCard(homeB, 'picked');
            if (elDecider) elDecider.innerHTML = createResultCard(decider, 'decider');

            // Labels
            const labelA = resultsView.querySelector('.area-home-a .bp-result-label');
            const labelB = resultsView.querySelector('.area-home-b .bp-result-label');
            const labelDecider = resultsView.querySelector('.area-decider .bp-result-label');

            const nameA = (localState.teamAName || "TEAM A").toUpperCase();
            const nameB = (localState.teamBName || "TEAM B").toUpperCase();

            if (labelB) {
                labelB.innerHTML = `MAP 1: ${nameB} HOME<br><small style="color:var(--text-mute)" style="font-size: 0.8rem; font-weight: normal; letter-spacing: 0;">${nameA} SELECTS STARTING POSITIONS</small>`;
            }
            if (labelA) {
                labelA.innerHTML = `MAP 2: ${nameA} HOME<br><small style="color:var(--text-mute)" style="font-size: 0.8rem; font-weight: normal; letter-spacing: 0;">${nameB} SELECTS STARTING POSITIONS</small>`;
            }
            if (labelDecider) {
                labelDecider.textContent = "MAP 3: DECIDER";
            }

            // Use double RAF to ensure browser registers the initial state (display:flex, opacity:0) before transitioning to opacity:1
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    resultsView.classList.add('visible');
                });
            });
        }
    }, 500);
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

    // Find Decider (redundant check but good for safety)
    let deciderId = null;
    if (localState.phase === PHASE.DECIDER) {
        const allIds = MAPS.map(m => m.id);
        const taken = [...localState.bans];
        if (localState.homeA !== null) taken.push(localState.homeA);
        if (localState.homeB !== null) taken.push(localState.homeB);
        deciderId = allIds.find(id => !taken.includes(id));
    }

    MAPS.forEach(map => {
        const el = document.createElement('div');
        console.log("Rendering Map:", map.name, "Phase:", localState.phase); // Debug check
        el.className = 'bp-map';

        // Add Picking/Banning Class for CSS Hover
        if (localState.phase === PHASE.PICK_HOME_A || localState.phase === PHASE.PICK_HOME_B) {
            el.classList.add('picking');
        } else if (localState.phase === PHASE.BAN_A || localState.phase === PHASE.BAN_B) {
            el.classList.add('banning');
        }

        const bg = document.createElement('div');
        bg.className = 'bp-map-bg';
        bg.style.backgroundImage = `url('${map.image}')`;
        el.appendChild(bg);

        // Hover Overlay (Only during interactive phases)
        const isInteractivePhase = [PHASE.PICK_HOME_A, PHASE.PICK_HOME_B, PHASE.BAN_A, PHASE.BAN_B].includes(localState.phase);

        if (isInteractivePhase) {
            const hoverOverlay = document.createElement('div');
            hoverOverlay.className = 'bp-map-overlay';
            let actionText = "";
            let color = "";

            if (localState.phase === PHASE.PICK_HOME_A || localState.phase === PHASE.PICK_HOME_B) {
                actionText = "PICK HOME";
                color = "#2ecc71";
            } else {
                actionText = "BAN MAP";
                color = "#ff3d00";
            }

            hoverOverlay.style.color = color;
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
        } else if (map.id === deciderId) {
            el.classList.add('decider');
        } else {
            // Interaction Check using new ROLES
            const isMyTurn = (playerRole === ROLES.TEAM_A && (localState.phase === PHASE.PICK_HOME_A || localState.phase === PHASE.BAN_A)) ||
                (playerRole === ROLES.TEAM_B && (localState.phase === PHASE.PICK_HOME_B || localState.phase === PHASE.BAN_B));

            if (!isMyTurn || localState.phase === PHASE.DECIDER) {
                el.classList.add('disabled');
            } else {
                el.onclick = () => handleMapClick(map.id);
            }
        }

        mapGridContainer.appendChild(el);
    });
}

// Run Init
document.addEventListener('DOMContentLoaded', init);
