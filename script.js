// script.js

// --- Global Utility Functions ---

/**
 * Displays a temporary message to the user.
 * @param {string} msg - The message to display.
 * @param {'info' | 'error'} type - The type of message (influences styling).
 */
function showMessage(msg, type = 'info') {
    const messageArea = document.getElementById('message-area');
    if (messageArea) {
        messageArea.textContent = msg;
        messageArea.className = `p-3 rounded-lg text-white mb-6 w-full max-w-md text-center ${type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`;
        messageArea.classList.remove('hidden');

        // Clear any existing timeout before setting a new one
        if (window.messageTimeout) {
            clearTimeout(window.messageTimeout);
        }
        window.messageTimeout = setTimeout(() => {
            messageArea.classList.add('hidden');
        }, 3000);
    } else {
        console.warn(`Message area not found. Message: ${msg} Type: ${type}`);
    }
}

/**
 * Generates a unique ID (UUID v4).
 * @returns {string} A unique ID.
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- Local Storage Functions ---

const LOCAL_STORAGE_KEY = 'mrcChessTournaments';

/**
 * Saves the current list of tournaments to local storage.
 * @param {Array<Object>} tournaments - The array of tournament objects to save.
 */
function saveTournamentsToLocalStorage(tournaments) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tournaments));
    } catch (error) {
        console.error("Error saving to local storage:", error);
        showMessage("Failed to save tournament data. Local storage might be full or inaccessible.", "error");
    }
}

/**
 * Loads tournaments from local storage.
 * @returns {Array<Object>} An array of tournament objects, or an empty array if none found.
 */
function loadTournamentsFromLocalStorage() {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        // Parse dates back to Date objects for easier manipulation
        const tournaments = data ? JSON.parse(data) : [];
        return tournaments.map(t => {
            if (t.createdAt) t.createdAt = new Date(t.createdAt);
            if (t.lastUpdated) t.lastUpdated = new Date(t.lastUpdated);
            if (t.completedAt) t.completedAt = new Date(t.completedAt);
            if (t.players) {
                t.players = t.players.map(p => {
                    if (p.addedAt) p.addedAt = new Date(p.addedAt);
                    // Ensure pastOpponents is an array, initialize if missing
                    if (!p.pastOpponents) p.pastOpponents = [];
                    return p;
                });
            }
            if (t.rounds) {
                t.rounds = t.rounds.map(r => {
                    if (r.startedAt) r.startedAt = new Date(r.startedAt);
                    if (r.completedAt) r.completedAt = new Date(r.completedAt);
                    if (r.matches) {
                        r.matches = r.matches.map(m => {
                            if (m.startTime) m.startTime = new Date(m.startTime);
                            if (m.endTime) m.endTime = new Date(m.endTime);
                            return m;
                        });
                    }
                    return r;
                });
            }
            return t;
        });
    } catch (error) {
        console.error("Error loading from local storage:", error);
        showMessage("Failed to load tournament data. Data might be corrupted.", "error");
        return [];
    }
}

/**
 * Finds a tournament by its ID.
 * @param {string} tournamentId - The ID of the tournament to find.
 * @returns {Object | null} The tournament object if found, otherwise null.
 */
function findTournamentById(tournamentId) {
    const tournaments = loadTournamentsFromLocalStorage();
    return tournaments.find(t => t.id === tournamentId);
}

/**
 * Updates a tournament in local storage.
 * @param {Object} updatedTournament - The tournament object with updated data.
 */
function updateTournamentInLocalStorage(updatedTournament) {
    let tournaments = loadTournamentsFromLocalStorage();
    const index = tournaments.findIndex(t => t.id === updatedTournament.id);
    if (index !== -1) {
        // Replace existing tournament with updated one
        tournaments[index] = updatedTournament;
        saveTournamentsToLocalStorage(tournaments);
    } else {
        console.error("Tournament not found for update:", updatedTournament.id);
        showMessage("Error: Tournament not found for update.", "error");
    }
}

/**
 * Deletes a tournament from local storage.
 * @param {string} tournamentId - The ID of the tournament to delete.
 */
function deleteTournamentFromLocalStorage(tournamentId) {
    let tournaments = loadTournamentsFromLocalStorage();
    const filteredTournaments = tournaments.filter(t => t.id !== tournamentId);
    saveTournamentsToLocalStorage(filteredTournaments);
}

// --- Page-Specific Initialization Functions ---

// Global variable to keep track of the current filter status on the home page
let currentHomeFilter = 'active'; // 'active' or 'completed'

/**
 * Initializes the home page (index.html).
 * Loads and displays tournaments.
 */
function initializeIndexPage() {
    // Set initial active filter button style
    document.getElementById('filter-active-btn').classList.add('active');

    // Attach event listeners for filter buttons
    document.getElementById('filter-active-btn').addEventListener('click', () => {
        currentHomeFilter = 'active';
        renderTournamentList(currentHomeFilter);
        document.getElementById('filter-active-btn').classList.add('active');
        document.getElementById('filter-completed-btn').classList.remove('active');
    });
    document.getElementById('filter-completed-btn').addEventListener('click', () => {
        currentHomeFilter = 'completed';
        renderTournamentList(currentHomeFilter);
        document.getElementById('filter-active-btn').classList.remove('active');
        document.getElementById('filter-completed-btn').classList.add('active');
    });

    renderTournamentList(currentHomeFilter); // Render initially with active tournaments
    document.getElementById('importFileInput').addEventListener('change', handleImportTournament);
}

/**
 * Initializes the tournament detail page (tournament-detail.html).
 * Handles creating new tournaments or loading existing ones.
 */
function initializeTournamentDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id');
    const isNew = urlParams.get('new') === 'true';

    let currentTournament = null;

    // Check if celebration needs to be shown based on URL param
    if (urlParams.get('celebrate') === 'true') {
        showCelebrationOverlay();
        // Remove the celebrate param to prevent re-showing on refresh
        urlParams.delete('celebrate');
        const newUrl = `${window.location.origin}${window.location.pathname}?${urlParams.toString()}`;
        window.history.replaceState({}, document.title, newUrl);
    }

    if (isNew) {
        // Prepare for new tournament creation
        document.getElementById('tournament-info').classList.add('hidden'); // Hide info until created
        document.getElementById('player-management').classList.add('hidden');
        document.getElementById('team-management').classList.add('hidden'); // Hide team management initially
        document.getElementById('current-round').classList.add('hidden');
        document.getElementById('leaderboard-section').classList.add('hidden');
        renderCreateTournamentForm(); // Render the form
    } else if (tournamentId) {
        // Load existing tournament
        currentTournament = findTournamentById(tournamentId);
        if (currentTournament) {
            renderTournamentDetails(currentTournament);
            renderTeamManagement(currentTournament); // Render team management section
            renderPlayerList(currentTournament);
            renderPlayerTeamDropdown(currentTournament); // Populate team dropdown for players
            if (currentTournament.status === 'ongoing' || currentTournament.status === 'completed') {
                renderCurrentRound(currentTournament);
                renderLeaderboard(currentTournament);
            }
        } else {
            showMessage("Tournament not found!", "error");
            // Redirect back to home after a short delay
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
    } else {
        // No ID and not new, redirect to create new
        showMessage("No tournament selected. Redirecting to create new...", "info");
        setTimeout(() => window.location.href = 'tournament-detail.html?new=true', 2000);
        return;
    }

    // Attach general event listeners (always available if tournament is loaded/being created)
    document.getElementById('add-player-btn').addEventListener('click', () => addPlayer(currentTournament));
    document.getElementById('download-pdf-btn').addEventListener('click', () => downloadTournamentPDF(currentTournament));
    document.getElementById('export-json-btn').addEventListener('click', () => exportTournamentJSON(currentTournament));
    document.getElementById('admin-panel-btn').addEventListener('click', () => {
        if (currentTournament) {
            window.location.href = `admin-panel.html?id=${currentTournament.id}`;
        }
    });
    // New delete tournament button listener
    document.getElementById('delete-tournament-btn').addEventListener('click', () => confirmDeleteTournament(currentTournament));


    // Team management event listeners
    document.getElementById('add-team-btn').addEventListener('click', () => addTeam(currentTournament));

    // Celebration overlay close button
    const celebrationCloseBtn = document.getElementById('celebration-close-btn');
    if (celebrationCloseBtn) {
        celebrationCloseBtn.addEventListener('click', hideCelebrationOverlay);
    }

    // Player Details Modal Close button
    document.getElementById('close-player-details-modal').addEventListener('click', hidePlayerDetailsModal);
}

/**
 * Initializes the admin panel page (admin-panel.html).
 */
function initializeAdminPanel() {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id');

    if (!tournamentId) {
        showMessage("No tournament ID provided for admin panel. Redirecting to home.", "error");
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    let currentTournament = findTournamentById(tournamentId);
    if (!currentTournament) {
        showMessage("Tournament not found for admin panel!", "error");
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    // Render admin panel specific details
    document.getElementById('admin-tournament-name').textContent = currentTournament.name;
    document.getElementById('admin-tournament-info').textContent =
        `Mode: ${currentTournament.mode.replace('-', ' ')} | Time Control: ${currentTournament.timeControl || 'N/A'} | Total Rounds: ${currentTournament.numRounds || 'N/A'} | Status: ${currentTournament.status}`;

    const adminStatusElement = document.getElementById('admin-tournament-info');
    adminStatusElement.className = `font-medium capitalize ${currentTournament.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`;

    // Attach event listeners for admin actions
    document.getElementById('back-to-detail-btn').addEventListener('click', () => {
        window.location.href = `tournament-detail.html?id=${currentTournament.id}`;
    });

    document.getElementById('start-tournament-btn').addEventListener('click', () => startTournament(currentTournament));
    document.getElementById('end-tournament-btn').addEventListener('click', () => endTournament(currentTournament));
    document.getElementById('generate-next-round-btn').addEventListener('click', () => generateNextRound(currentTournament));

    document.getElementById('manual-pairing-btn').addEventListener('click', () => {
        const manualPairingArea = document.getElementById('manual-pairing-area');
        const isExpanded = manualPairingArea.classList.contains('visually-hidden');
        if (isExpanded) {
            manualPairingArea.classList.remove('visually-hidden');
            manualPairingArea.focus(); // Focus the area when it becomes visible
            document.getElementById('manual-pairing-btn').setAttribute('aria-expanded', 'true');
            renderManualPairingControls(currentTournament);
        } else {
            manualPairingArea.classList.add('visually-hidden');
            document.getElementById('manual-pairing-btn').setAttribute('aria-expanded', 'false');
        }
    });

    document.getElementById('random-pairing-btn').addEventListener('click', () => handlePairing('random', currentTournament));
    document.getElementById('auto-pairing-btn').addEventListener('click', () => handlePairing('auto', currentTournament));
    document.getElementById('pairing-with-points-btn').addEventListener('click', () => handlePairing('points', currentTournament));
    document.getElementById('add-manual-pair-btn').addEventListener('click', () => addManualPair(currentTournament));


    renderAdminPairingAndResults(currentTournament);
    if (currentTournament.mode === 'cup' &&
        (currentTournament.status === 'ongoing' || currentTournament.status === 'completed')) {
        document.getElementById('cup-flowchart-section').classList.remove('visually-hidden');
        renderCupFlowchart(currentTournament);
    }
}

// --- Home Page Rendering ---

/**
 * Renders the list of tournaments on the home page based on the current filter.
 * @param {'active' | 'completed'} filter - The filter to apply.
 */
function renderTournamentList(filter) {
    const tournamentListDiv = document.getElementById('tournament-list');
    let tournaments = loadTournamentsFromLocalStorage();
    tournamentListDiv.innerHTML = ''; // Clear existing list

    let filteredTournaments = [];
    if (filter === 'active') {
        filteredTournaments = tournaments.filter(t => t.status !== 'completed');
    } else if (filter === 'completed') {
        filteredTournaments = tournaments.filter(t => t.status === 'completed');
    }

    filteredTournaments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort by creation date descending

    if (filteredTournaments.length === 0) {
        tournamentListDiv.innerHTML = `
            <div class="text-center col-span-full">
                <h2 class="text-2xl font-semibold mb-4 text-gray-200">No ${filter} Tournaments Yet!</h2>
                <p class="text-gray-400">${filter === 'active' ? 'Start by creating a new tournament.' : 'Completed tournaments will appear here.'}</p>
                ${filter === 'active' ? `
                <a href="tournament-detail.html?new=true" class="neumorphic-button mt-6 px-6 py-3 text-lg font-semibold text-blue-300 hover:text-blue-100 inline-block">
                    Create New Tournament
                </a>
                ` : ''}
            </div>
        `;
        return;
    }

    filteredTournaments.forEach(tournament => {
        const tournamentCard = document.createElement('div');
        tournamentCard.className = 'neumorphic-card p-6 rounded-lg flex flex-col justify-between';
        tournamentCard.innerHTML = `
            <div>
                <h3 class="text-xl font-semibold text-blue-300 mb-2">${escapeHTML(tournament.name)}</h3>
                <p class="text-gray-300 mb-1">Mode: <span class="font-medium text-gray-200 capitalize">${escapeHTML(tournament.mode.replace('-', ' '))}</span></p>
                <p class="text-gray-300 mb-1">Time Control: <span class="font-medium text-gray-200">${escapeHTML(tournament.timeControl || 'N/A')}</span></p>
                <p class="text-gray-300 mb-1">Rounds: <span class="font-medium text-gray-200">${tournament.numRounds !== null ? tournament.numRounds : 'Unlimited'}</span></p>
                ${tournament.isTeamTournament ? '<p class="text-gray-300 mb-1">Type: <span class="font-medium text-gray-200">Team Tournament</span></p>' : ''}
                <p class="text-gray-300 mb-3">Status: <span class="font-medium ${tournament.status === 'completed' ? 'text-green-400' : 'text-yellow-400'} capitalize">${escapeHTML(tournament.status)}</span></p>
                ${tournament.players && tournament.players.length > 0 ? `<p class="text-gray-300">Players: ${tournament.players.length}</p>` : ''}
                ${tournament.teams && tournament.teams.length > 0 ? `<p class="text-gray-300">Teams: ${tournament.teams.length}</p>` : ''}
            </div>
            <button class="neumorphic-button mt-4 px-4 py-2 text-md font-semibold text-gray-200 hover:text-white view-tournament-btn" data-id="${tournament.id}">
                View Tournament
            </button>
        `;
        tournamentListDiv.appendChild(tournamentCard);
    });

    document.querySelectorAll('.view-tournament-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const tournamentId = e.target.dataset.id;
            window.location.href = `tournament-detail.html?id=${tournamentId}`;
        });
    });
}

/**
 * Handles importing a tournament from a JSON file.
 * @param {Event} event - The file input change event.
 */
function handleImportTournament(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            // Basic validation for imported data structure
            if (!importedData.id || !importedData.name || !importedData.mode || !Array.isArray(importedData.players) || !Array.isArray(importedData.rounds)) {
                showMessage('Invalid tournament data in JSON file. Missing required fields.', 'error');
                return;
            }

            // Ensure unique ID or generate new one to avoid conflicts
            let tournaments = loadTournamentsFromLocalStorage();
            if (tournaments.some(t => t.id === importedData.id)) {
                // If ID conflicts, generate a new one
                importedData.id = generateUUID();
                showMessage('Tournament ID conflicted. Imported with a new ID.', 'info');
            }

            // Manually re-parse date strings to Date objects if needed, as loadTournamentsFromLocalStorage expects them
            if (importedData.createdAt) importedData.createdAt = new Date(importedData.createdAt);
            if (importedData.lastUpdated) importedData.lastUpdated = new Date(importedData.lastUpdated);
            if (importedData.completedAt) importedData.completedAt = new Date(importedData.completedAt);

            importedData.players = importedData.players.map(p => {
                if (p.addedAt) p.addedAt = new Date(p.addedAt);
                if (!p.pastOpponents) p.pastOpponents = []; // Ensure this exists
                return p;
            });
            importedData.rounds = importedData.rounds.map(r => {
                if (r.startedAt) r.startedAt = new Date(r.startedAt);
                if (r.completedAt) r.completedAt = new Date(r.completedAt);
                r.matches = r.matches.map(m => {
                    if (m.startTime) m.startTime = new Date(m.startTime);
                    if (m.endTime) m.endTime = new Date(m.endTime);
                    return m;
                });
                return r;
            });


            tournaments.push(importedData);
            saveTournamentsToLocalStorage(tournaments);
            showMessage('Tournament imported successfully!', 'info');
            renderTournamentList(currentHomeFilter); // Re-render the list to show the new tournament
        } catch (error) {
            console.error("Error importing tournament:", error);
            showMessage(`Failed to import tournament: ${error.message}`, 'error');
        } finally {
            event.target.value = ''; // Clear the file input
        }
    };
    reader.readAsText(file);
}

// --- Create Tournament Form (on tournament-detail.html when new=true) ---

/**
 * Renders the form to create a new tournament.
 */
function renderCreateTournamentForm() {
    const container = document.getElementById('tournament-detail-container');
    container.innerHTML = `
        <div class="neumorphic-card p-8 rounded-xl max-w-lg mx-auto">
            <h2 class="text-3xl font-bold mb-6 text-gray-50 text-center">Create New Tournament</h2>
            <form id="create-tournament-form" class="flex flex-col space-y-5">
                <div>
                    <label for="new-tournament-name" class="block text-gray-300 text-lg font-medium mb-2">Tournament Name</label>
                    <input
                        type="text"
                        id="new-tournament-name"
                        class="neumorphic-input w-full"
                        placeholder="e.g., Spring Chess Championship"
                        required
                    />
                </div>
                <div>
                    <label for="new-tournament-mode" class="block text-gray-300 text-lg font-medium mb-2">Tournament Mode</label>
                    <select
                        id="new-tournament-mode"
                        class="neumorphic-select w-full"
                        required
                    >
                        <option value="swiss">Swiss System</option>
                        <option value="round-robin">Round Robin</option>
                        <option value="cup">Cup Mode</option>
                    </select>
                </div>
                <div>
                    <label for="new-tournament-time-control" class="block text-gray-300 text-lg font-medium mb-2">Time Control (e.g., 10+0, 30+5, 90+30)</label>
                    <input
                        type="text"
                        id="new-tournament-time-control"
                        class="neumorphic-input w-full"
                        placeholder="e.g., 10+0 (10 min per side, 0 increment)"
                        required
                    />
                </div>
                 <div>
                    <label for="new-tournament-num-rounds" class="block text-gray-300 text-lg font-medium mb-2">Number of Rounds (Optional, leave blank for unlimited)</label>
                    <input
                        type="number"
                        id="new-tournament-num-rounds"
                        class="neumorphic-input w-full"
                        placeholder="e.g., 7"
                        min="1"
                    />
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="is-team-tournament" class="h-5 w-5 text-blue-600 rounded focus:ring-blue-500">
                    <label for="is-team-tournament" class="text-gray-300 text-lg font-medium">Team Tournament?</label>
                </div>
                <button
                    type="submit"
                    id="create-tournament-submit-btn"
                    class="neumorphic-button px-6 py-3 text-lg font-semibold text-blue-300 hover:text-blue-100 flex items-center justify-center"
                >
                    Create Tournament
                </button>
            </form>
        </div>
    `;

    document.getElementById('create-tournament-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('new-tournament-name').value.trim();
        const mode = document.getElementById('new-tournament-mode').value;
        const timeControl = document.getElementById('new-tournament-time-control').value.trim();
        const numRoundsInput = document.getElementById('new-tournament-num-rounds').value.trim();
        const numRounds = numRoundsInput !== '' ? parseInt(numRoundsInput, 10) : null;
        const isTeamTournament = document.getElementById('is-team-tournament').checked;

        if (!name || !mode || !timeControl) {
            showMessage('Please fill in all required fields.', 'error');
            return;
        }
        if (numRoundsInput !== '' && (isNaN(numRounds) || numRounds < 1)) {
            showMessage('Number of rounds must be a positive number or left blank.', 'error');
            return;
        }


        const newTournament = {
            id: generateUUID(),
            name: name,
            mode: mode,
            timeControl: timeControl,
            numRounds: numRounds, // Store number of rounds
            isTeamTournament: isTeamTournament,
            status: 'pending', // 'pending', 'ongoing', 'completed'
            players: [],
            teams: isTeamTournament ? [] : undefined, // Only add teams array if it's a team tournament
            rounds: [], // Each round will contain matches
            leaderboard: [],
            createdAt: new Date().toISOString(), // Store as ISO string
            lastUpdated: new Date().toISOString()
        };

        let tournaments = loadTournamentsFromLocalStorage();
        tournaments.push(newTournament);
        saveTournamentsToLocalStorage(tournaments);
        showMessage('Tournament created successfully!', 'info');

        // Redirect to the newly created tournament's detail page
        window.location.href = `tournament-detail.html?id=${newTournament.id}`;
    });
}

// --- Tournament Detail Page Rendering & Logic ---

/**
 * Renders the main details of a tournament.
 * @param {Object} tournament - The tournament object.
 */
function renderTournamentDetails(tournament) {
    document.getElementById('tournament-info').classList.remove('hidden');
    document.getElementById('player-management').classList.remove('hidden');
    document.getElementById('tournament-name').textContent = tournament.name;
    document.getElementById('tournament-mode').textContent = tournament.mode.replace('-', ' ');
    document.getElementById('tournament-time-control').textContent = tournament.timeControl || 'N/A';
    document.getElementById('tournament-total-rounds').textContent = tournament.numRounds !== null ? tournament.numRounds : 'Unlimited'; // Display total rounds
    const statusElement = document.getElementById('tournament-status');
    statusElement.textContent = tournament.status;
    statusElement.className = `font-medium capitalize ${tournament.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}`;

    // Hide/show sections based on tournament status
    if (tournament.status === 'pending') {
        document.getElementById('current-round').classList.add('hidden');
        document.getElementById('leaderboard-section').classList.add('hidden');
    } else {
        document.getElementById('current-round').classList.remove('hidden');
        document.getElementById('leaderboard-section').classList.remove('hidden');
    }
}

/**
 * Displays a confirmation dialog before deleting a tournament.
 * @param {Object} tournament - The tournament object to delete.
 */
function confirmDeleteTournament(tournament) {
    const modalHtml = `
        <div id="confirm-delete-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
            <div class="modal-content neumorphic-card">
                <h3 id="confirm-delete-title" class="text-2xl font-bold mb-4 text-gray-50">Confirm Deletion</h3>
                <p class="text-gray-200 mb-6">Are you sure you want to delete tournament "<span class="font-semibold text-red-400">${escapeHTML(tournament.name)}</span>"? This action cannot be undone.</p>
                <div class="flex justify-center space-x-4">
                    <button id="cancel-delete-btn" class="neumorphic-button px-6 py-3 text-lg font-semibold text-blue-300 hover:text-blue-100">Cancel</button>
                    <button id="execute-delete-btn" class="neumorphic-button px-6 py-3 text-lg font-semibold bg-red-600 text-white hover:bg-red-700">Delete</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const confirmDeleteModal = document.getElementById('confirm-delete-modal');
    confirmDeleteModal.focus(); // Set focus to the modal

    document.getElementById('cancel-delete-btn').addEventListener('click', () => {
        confirmDeleteModal.remove();
    });
    document.getElementById('execute-delete-btn').addEventListener('click', () => {
        deleteTournament(tournament.id);
        confirmDeleteModal.remove();
    });
}

/**
 * Deletes a tournament from local storage and redirects to home.
 * @param {string} tournamentId - The ID of the tournament to delete.
 */
function deleteTournament(tournamentId) {
    deleteTournamentFromLocalStorage(tournamentId);
    showMessage('Tournament deleted successfully!', 'info');
    setTimeout(() => {
        window.location.href = 'index.html'; // Redirect to home page
    }, 1000);
}


// --- Team Management Functions ---

/**
 * Renders the team management section if it's a team tournament.
 * @param {Object} tournament - The tournament object.
 */
function renderTeamManagement(tournament) {
    const teamManagementSection = document.getElementById('team-management');
    if (tournament.isTeamTournament) {
        teamManagementSection.classList.remove('hidden');
        renderTeamList(tournament);
        // Ensure event listener for add team button is active
        document.getElementById('add-team-btn').onclick = () => addTeam(tournament);
    } else {
        teamManagementSection.classList.add('hidden');
    }
}

/**
 * Renders the list of teams for a tournament.
 * @param {Object} tournament - The tournament object.
 */
function renderTeamList(tournament) {
    const teamListUl = document.getElementById('team-list-ul');
    const noTeamsMessage = document.getElementById('no-teams-message');
    teamListUl.innerHTML = ''; // Clear existing list

    if (!tournament.teams || tournament.teams.length === 0) {
        noTeamsMessage.classList.remove('hidden');
    } else {
        noTeamsMessage.classList.add('hidden');
        tournament.teams.forEach(team => {
            const listItem = document.createElement('li');
            listItem.setAttribute('data-team-id', team.id);
            listItem.setAttribute('role', 'listitem');
            listItem.innerHTML = `
                <span class="team-name text-lg font-medium">${escapeHTML(team.name)}</span>
                <div class="action-buttons">
                    <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-yellow-300 hover:text-yellow-100 edit-team-btn" data-id="${team.id}" aria-label="Edit team ${escapeHTML(team.name)}">Edit</button>
                    <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-red-300 hover:text-red-100 delete-team-btn" data-id="${team.id}" aria-label="Delete team ${escapeHTML(team.name)}">Delete</button>
                </div>
            `;
            teamListUl.appendChild(listItem);
        });

        // Attach event listeners for edit/delete buttons
        teamListUl.querySelectorAll('.edit-team-btn').forEach(button => {
            button.addEventListener('click', (e) => editTeam(tournament, e.target.dataset.id));
        });
        teamListUl.querySelectorAll('.delete-team-btn').forEach(button => {
            button.addEventListener('click', (e) => deleteTeam(tournament, e.target.dataset.id));
        });
    }
}

/**
 * Adds a new team to the tournament.
 * @param {Object} tournament - The tournament object.
 */
function addTeam(tournament) {
    const newTeamNameInput = document.getElementById('new-team-name');
    const teamName = newTeamNameInput.value.trim();

    if (!teamName) {
        showMessage('Team name cannot be empty!', 'error');
        return;
    }

    if (tournament.teams.some(t => t.name.toLowerCase() === teamName.toLowerCase())) {
        showMessage('A team with this name already exists!', 'error');
        return;
    }

    const newTeam = {
        id: generateUUID(),
        name: teamName,
        createdAt: new Date().toISOString()
    };

    tournament.teams.push(newTeam);
    tournament.lastUpdated = new Date().toISOString();
    updateTournamentInLocalStorage(tournament);
    showMessage(`Team "${teamName}" added!`, 'info');

    newTeamNameInput.value = ''; // Clear input field
    renderTeamList(tournament); // Re-render team list
    renderPlayerTeamDropdown(tournament); // Update player team dropdown
}

/**
 * Handles editing an existing team.
 * @param {Object} tournament - The tournament object.
 * @param {string} teamId - The ID of the team to edit.
 */
function editTeam(tournament, teamId) {
    const team = tournament.teams.find(t => t.id === teamId);
    if (!team) {
        showMessage('Team not found!', 'error');
        return;
    }

    const listItem = document.querySelector(`li[data-team-id="${teamId}"]`);
    if (!listItem) return;

    const originalName = team.name;

    listItem.innerHTML = `
        <input type="text" id="edit-team-name-${teamId}" value="${escapeHTML(originalName)}" class="neumorphic-input flex-grow" aria-label="Edit name for team ${escapeHTML(originalName)}">
        <div class="action-buttons">
            <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-green-300 hover:text-green-100 save-edit-btn" data-id="${teamId}" aria-label="Save changes for team ${escapeHTML(originalName)}">Save</button>
            <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-red-300 hover:text-red-100 cancel-edit-btn" data-id="${teamId}" aria-label="Cancel editing for team ${escapeHTML(originalName)}">Cancel</button>
        </div>
    `;
    document.getElementById(`edit-team-name-${teamId}`).focus(); // Focus the input field

    // Attach event listeners for save/cancel
    listItem.querySelector('.save-edit-btn').addEventListener('click', () => {
        const editedName = document.getElementById(`edit-team-name-${teamId}`).value.trim();

        if (!editedName) {
            showMessage('Team name cannot be empty!', 'error');
            return;
        }
        if (tournament.teams.some(t => t.id !== teamId && t.name.toLowerCase() === editedName.toLowerCase())) {
            showMessage('A team with this name already exists!', 'error');
            return;
        }

        team.name = editedName;
        tournament.players.filter(p => p.teamId === teamId).forEach(p => p.teamName = editedName); // Update player team names
        tournament.lastUpdated = new Date().toISOString();
        updateTournamentInLocalStorage(tournament);
        showMessage(`Team "${originalName}" updated to "${editedName}"!`, 'info');
        renderTeamList(tournament); // Re-render to show updated team
        renderPlayerList(tournament); // Re-render players to reflect team name change
    });

    listItem.querySelector('.cancel-edit-btn').addEventListener('click', () => {
        renderTeamList(tournament); // Re-render to revert changes
    });
}

/**
 * Handles deleting a team.
 * @param {Object} tournament - The tournament object.
 * @param {string} teamId - The ID of the team to delete.
 */
function deleteTeam(tournament, teamId) {
    const teamIndex = tournament.teams.findIndex(t => t.id === teamId);
    if (teamIndex !== -1) {
        const teamName = tournament.teams[teamIndex].name;

        // Check if any players are assigned to this team
        const playersInTeam = tournament.players.filter(p => p.teamId === teamId);
        if (playersInTeam.length > 0) {
            showMessage(`Cannot delete team "${teamName}". It has ${playersInTeam.length} player(s) assigned. Please reassign or delete them first.`, 'error');
            return;
        }

        tournament.teams.splice(teamIndex, 1);
        tournament.lastUpdated = new Date().toISOString();
        updateTournamentInLocalStorage(tournament);
        showMessage(`Team "${teamName}" deleted!`, 'info');
        renderTeamList(tournament);
        renderPlayerTeamDropdown(tournament); // Update dropdown
    } else {
        showMessage('Team not found!', 'error');
    }
}

// --- Player Management & Details Functions ---

/**
 * Renders the list of players for a tournament.
 * @param {Object} tournament - The tournament object.
 */
function renderPlayerList(tournament) {
    const playerListUl = document.getElementById('player-list-ul');
    const noPlayersMessage = document.getElementById('no-players-message');
    playerListUl.innerHTML = ''; // Clear existing list

    if (tournament.players.length === 0) {
        noPlayersMessage.classList.remove('hidden');
    } else {
        noPlayersMessage.classList.add('hidden');
        tournament.players.forEach(player => {
            const listItem = document.createElement('li');
            listItem.setAttribute('data-player-id', player.id);
            listItem.setAttribute('role', 'listitem');
            listItem.innerHTML = `
                <span class="player-name text-lg font-medium" data-id="${player.id}" tabindex="0" role="button" aria-label="View details for ${escapeHTML(player.name)}">${escapeHTML(player.name)}</span>
                ${player.rating ? `<span class="player-rating text-base">Rating: ${player.rating}</span>` : ''}
                ${player.teamName ? `<span class="player-team text-base">(${escapeHTML(player.teamName)})</span>` : ''}
                <div class="action-buttons">
                    <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-yellow-300 hover:text-yellow-100 edit-player-btn" data-id="${player.id}" aria-label="Edit player ${escapeHTML(player.name)}">Edit</button>
                    <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-red-300 hover:text-red-100 delete-player-btn" data-id="${player.id}" aria-label="Delete player ${escapeHTML(player.name)}">Delete</button>
                </div>
            `;
            playerListUl.appendChild(listItem);
        });

        // Attach event listeners for player name click/keypress to show details
        playerListUl.querySelectorAll('.player-name').forEach(span => {
            span.addEventListener('click', (e) => showPlayerDetailsModal(tournament, e.target.dataset.id));
            span.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { // Allow activation with Enter or Space
                    e.preventDefault();
                    showPlayerDetailsModal(tournament, e.target.dataset.id);
                }
            });
        });
        // Attach event listeners for edit/delete buttons
        playerListUl.querySelectorAll('.edit-player-btn').forEach(button => {
            button.addEventListener('click', (e) => editPlayer(tournament, e.target.dataset.id));
        });
        playerListUl.querySelectorAll('.delete-player-btn').forEach(button => {
            button.addEventListener('click', (e) => deletePlayer(tournament, e.target.dataset.id));
        });
    }
}

/**
 * Populates the team dropdown for adding new players if it's a team tournament.
 * @param {Object} tournament - The tournament object.
 */
function renderPlayerTeamDropdown(tournament) {
    const playerTeamSelect = document.getElementById('new-player-team');
    if (tournament.isTeamTournament) {
        playerTeamSelect.classList.remove('hidden');
        playerTeamSelect.innerHTML = '<option value="">Select Team (Optional)</option>'; // Add an optional "no team" option
        tournament.teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = escapeHTML(team.name);
            playerTeamSelect.appendChild(option);
        });
    } else {
        playerTeamSelect.classList.add('hidden');
    }
}


/**
 * Adds a new player to the tournament.
 * @param {Object} tournament - The tournament object.
 */
function addPlayer(tournament) {
    const newPlayerNameInput = document.getElementById('new-player-name');
    const newPlayerRatingInput = document.getElementById('new-player-rating');
    const newPlayerTeamSelect = document.getElementById('new-player-team'); // Only exists for team tournaments

    const playerName = newPlayerNameInput.value.trim();
    const playerRating = parseInt(newPlayerRatingInput.value, 10);
    const playerTeamId = tournament.isTeamTournament ? newPlayerTeamSelect.value : null;

    if (!playerName) {
        showMessage('Player name cannot be empty!', 'error');
        return;
    }

    if (tournament.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
        showMessage('A player with this name already exists!', 'error');
        return;
    }

    let teamName = null;
    if (tournament.isTeamTournament && playerTeamId) {
        const selectedTeam = tournament.teams.find(t => t.id === playerTeamId);
        if (!selectedTeam) {
            showMessage('Selected team not found!', 'error');
            return;
        }
        teamName = selectedTeam.name;
    }

    const newPlayer = {
        id: generateUUID(),
        name: playerName,
        rating: isNaN(playerRating) ? null : playerRating,
        score: 0,
        tieBreak: 0, // Simplified tie-break, could be calculated more complexly later
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
        teamId: playerTeamId, // Store team ID
        teamName: teamName, // Store team name for easier access
        eliminated: false, // For cup mode
        pastOpponents: [], // Initialize past opponents array
        addedAt: new Date().toISOString()
    };

    tournament.players.push(newPlayer);
    tournament.lastUpdated = new Date().toISOString();
    updateTournamentInLocalStorage(tournament);
    showMessage(`Player "${playerName}" added!`, 'info');

    newPlayerNameInput.value = ''; // Clear input fields
    newPlayerRatingInput.value = '';
    if (tournament.isTeamTournament) {
        newPlayerTeamSelect.value = ''; // Reset team dropdown
    }
    renderPlayerList(tournament); // Re-render player list
}

/**
 * Handles editing an existing player.
 * @param {Object} tournament - The tournament object.
 * @param {string} playerId - The ID of the player to edit.
 */
function editPlayer(tournament, playerId) {
    const player = tournament.players.find(p => p.id === playerId);
    if (!player) {
        showMessage('Player not found!', 'error');
        return;
    }

    const listItem = document.querySelector(`li[data-player-id="${playerId}"]`);
    if (!listItem) return;

    const originalName = player.name;
    const originalRating = player.rating;
    const originalTeamId = player.teamId;

    let teamOptionsHtml = '';
    if (tournament.isTeamTournament) {
        teamOptionsHtml += '<option value="">Select Team (Optional)</option>';
        tournament.teams.forEach(team => {
            const optionSelected = team.id === originalTeamId ? 'selected' : '';
            teamOptionsHtml += `<option value="${team.id}" ${optionSelected}>${escapeHTML(team.name)}</option>`;
        });
    }

    listItem.innerHTML = `
        <input type="text" id="edit-player-name-${playerId}" value="${escapeHTML(originalName)}" class="neumorphic-input flex-grow" aria-label="Edit name for player ${escapeHTML(originalName)}">
        <input type="number" id="edit-player-rating-${playerId}" value="${originalRating !== null ? originalRating : ''}" placeholder="Rating" class="neumorphic-input w-full md:w-32" aria-label="Edit rating for player ${escapeHTML(originalName)}">
        ${tournament.isTeamTournament ? `<select id="edit-player-team-${playerId}" class="neumorphic-select w-full md:w-48" aria-label="Select team for player ${escapeHTML(originalName)}">${teamOptionsHtml}</select>` : ''}
        <div class="action-buttons">
            <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-green-300 hover:text-green-100 save-edit-btn" data-id="${playerId}" aria-label="Save changes for player ${escapeHTML(originalName)}">Save</button>
            <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-red-300 hover:text-red-100 cancel-edit-btn" data-id="${playerId}" aria-label="Cancel editing for player ${escapeHTML(originalName)}">Cancel</button>
        </div>
    `;
    document.getElementById(`edit-player-name-${playerId}`).focus(); // Focus the input field

    // Attach event listeners for save/cancel
    listItem.querySelector('.save-edit-btn').addEventListener('click', () => {
        const editedName = document.getElementById(`edit-player-name-${playerId}`).value.trim();
        const editedRating = parseInt(document.getElementById(`edit-player-rating-${playerId}`).value, 10);
        const editedTeamId = tournament.isTeamTournament ? document.getElementById(`edit-player-team-${playerId}`).value : null;

        if (!editedName) {
            showMessage('Player name cannot be empty!', 'error');
            return;
        }
        if (tournament.players.some(p => p.id !== playerId && p.name.toLowerCase() === editedName.toLowerCase())) {
            showMessage('A player with this name already exists!', 'error');
            return;
        }

        player.name = editedName;
        player.rating = isNaN(editedRating) ? null : editedRating;
        player.teamId = editedTeamId;
        player.teamName = editedTeamId ? tournament.teams.find(t => t.id === editedTeamId)?.name : null;

        tournament.lastUpdated = new Date().toISOString();
        updateTournamentInLocalStorage(tournament);
        showMessage(`Player "${originalName}" updated to "${editedName}"!`, 'info');
        renderPlayerList(tournament); // Re-render to show updated player
    });

    listItem.querySelector('.cancel-edit-btn').addEventListener('click', () => {
        renderPlayerList(tournament); // Re-render to revert changes
    });
}

/**
 * Handles deleting a player.
 * @param {Object} tournament - The tournament object.
 * @param {string} playerId - The ID of the player to delete.
 */
function deletePlayer(tournament, playerId) {
    // Check if player has played any matches. If so, prevent deletion.
    const playerMatches = tournament.rounds.flatMap(r => r.matches).filter(m => m.player1Id === playerId || m.player2Id === playerId);
    if (playerMatches.length > 0) {
        showMessage('Cannot delete player: They have already participated in matches. You can only delete players before the tournament starts or if they have not played any matches.', 'error');
        return;
    }

    const playerIndex = tournament.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
        const playerName = tournament.players[playerIndex].name;
        tournament.players.splice(playerIndex, 1);
        tournament.lastUpdated = new Date().toISOString();
        updateTournamentInLocalStorage(tournament);
        showMessage(`Player "${playerName}" deleted!`, 'info');
        renderPlayerList(tournament);
    } else {
        showMessage('Player not found!', 'error');
    }
}

/**
 * Displays player details in a modal.
 * @param {Object} tournament - The tournament object.
 * @param {string} playerId - The ID of the player to display.
 */
function showPlayerDetailsModal(tournament, playerId) {
    const player = tournament.players.find(p => p.id === playerId);
    if (!player) {
        showMessage('Player details not found.', 'error');
        return;
    }

    document.getElementById('modal-player-name').textContent = escapeHTML(player.name);
    document.getElementById('modal-player-team').textContent = player.teamName ? escapeHTML(player.teamName) : 'N/A';
    document.getElementById('modal-player-rating').textContent = player.rating !== null ? player.rating : 'N/A';
    document.getElementById('modal-player-score').textContent = player.score;
    document.getElementById('modal-player-wins').textContent = player.wins;
    document.getElementById('modal-player-losses').textContent = player.losses;
    document.getElementById('modal-player-draws').textContent = player.draws;
    document.getElementById('modal-player-matches-played').textContent = player.matchesPlayed;

    const playerDetailsModal = document.getElementById('player-details-modal');
    playerDetailsModal.classList.remove('hidden');
    playerDetailsModal.focus(); // Set focus to the modal for accessibility
}

/**
 * Hides the player details modal.
 */
function hidePlayerDetailsModal() {
    document.getElementById('player-details-modal').classList.add('hidden');
}


/**
 * Renders the current round's pairings.
 * @param {Object} tournament - The tournament object.
 */
function renderCurrentRound(tournament) {
    const currentRoundDiv = document.getElementById('current-round');
    const currentRoundNumberSpan = document.getElementById('current-round-number');
    const pairingsListDiv = document.getElementById('pairings-list');
    const noPairingsMessage = document.getElementById('no-pairings-message');

    // Robust check for element existence, return early if not found
    if (!currentRoundDiv || !currentRoundNumberSpan || !pairingsListDiv || !noPairingsMessage) {
        console.warn("renderCurrentRound: One or more required DOM elements not found. Skipping render.");
        return;
    }

    if (tournament.status === 'pending') {
        currentRoundDiv.classList.add('hidden');
        return;
    } else {
        currentRoundDiv.classList.remove('hidden');
    }

    const currentRound = tournament.rounds[tournament.rounds.length - 1]; // Get the last (current) round

    if (!currentRound || currentRound.matches.length === 0) {
        pairingsListDiv.innerHTML = '';
        noPairingsMessage.classList.remove('hidden');
        currentRoundNumberSpan.textContent = tournament.rounds.length > 0 ? tournament.rounds.length : 'N/A';
        return;
    }

    noPairingsMessage.classList.add('hidden');
    currentRoundNumberSpan.textContent = currentRound.roundNumber;
    pairingsListDiv.innerHTML = ''; // Clear previous pairings

    // Sort matches by board number for display
    const sortedMatches = [...currentRound.matches].sort((a, b) => a.boardNumber - b.boardNumber);

    sortedMatches.forEach(match => {
        const player1 = tournament.players.find(p => p.id === match.player1Id);
        const player2 = tournament.players.find(p => p.id === match.player2Id);

        const matchDiv = document.createElement('div');
        matchDiv.className = 'pairing-item';
        matchDiv.setAttribute('data-match-id', match.id);
        matchDiv.innerHTML = `
            <div class="board-number">Board #${match.boardNumber}</div>
            <div class="players" aria-label="Players for match on board ${match.boardNumber}">
                <span>${player1 ? escapeHTML(player1.name) : 'BYE'}</span>
                <span>vs</span>
                <span>${player2 ? escapeHTML(player2.name) : 'BYE'}</span>
            </div>
            <div class="result-control">
                <label for="result-select-${match.id}" class="visually-hidden">Select result for match on board ${match.boardNumber}</label>
                <select id="result-select-${match.id}" class="neumorphic-select">
                    <option value="">Select Result</option>
                    <option value="${match.player1Id}" ${match.winnerId === match.player1Id ? 'selected' : ''}>${player1 ? escapeHTML(player1.name) : 'BYE'} Wins</option>
                    ${player2 ? `<option value="${match.player2Id}" ${match.winnerId === match.player2Id ? 'selected' : ''}>${escapeHTML(player2.name)} Wins</option>` : ''}
                    <option value="draw" ${match.result === 'draw' ? 'selected' : ''}>Draw</option>
                </select>
                <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-blue-300 hover:text-blue-100 record-result-btn" data-match-id="${match.id}" aria-label="Record result for board ${match.boardNumber}">Record Result</button>
            </div>
            ${match.result ? `<div class="text-sm text-gray-400 mt-1" aria-live="polite">Result: ${match.result === 'draw' ? 'Draw' : (match.winnerId === player1?.id ? `${escapeHTML(player1.name)} Wins` : `${escapeHTML(player2?.name || 'BYE')} Wins`)}</div>` : ''}
        `;
        pairingsListDiv.appendChild(matchDiv);
    });

    pairingsListDiv.querySelectorAll('.record-result-btn').forEach(button => {
        button.addEventListener('click', (e) => recordMatchResult(tournament, e.target.dataset.matchId));
    });
}


/**
 * Records the result of a match.
 * @param {Object} tournament - The tournament object.
 * @param {string} matchId - The ID of the match whose result is being recorded.
 */
function recordMatchResult(tournament, matchId) {
    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    const match = currentRound.matches.find(m => m.id === matchId);
    if (!match) {
        showMessage('Match not found!', 'error');
        return;
    }

    // Determine if this call is from the Tournament Details page or Admin Panel
    const resultSelectIdPrefix = window.location.pathname.endsWith('admin-panel.html') ? 'admin-result-select-' : 'result-select-';
    const resultSelect = document.getElementById(`${resultSelectIdPrefix}${matchId}`);

    if (!resultSelect) { // Check if the element actually exists on the current page
        console.error(`Result select element with ID ${resultSelectIdPrefix}${matchId} not found on this page.`);
        showMessage('Error: Result input missing. Please refresh.', 'error');
        return;
    }

    const selectedValue = resultSelect.value;

    if (!selectedValue) {
        showMessage('Please select a result!', 'error');
        return;
    }

    const player1 = tournament.players.find(p => p.id === match.player1Id);
    const player2 = tournament.players.find(p => p.id === match.player2Id);

    // Revert previous points/stats for players if result is being re-recorded
    if (match.result) {
        if (match.result === 'draw') {
            if (player1) { player1.score -= 0.5; player1.draws = Math.max(0, player1.draws - 1); }
            if (player2) { player2.score -= 0.5; player2.draws = Math.max(0, player2.draws - 1); }
        } else if (match.winnerId === player1?.id) {
            if (player1) { player1.score -= 1; player1.wins = Math.max(0, player1.wins - 1); }
            if (player2) { player2.losses = Math.max(0, player2.losses - 1); }
        } else if (match.winnerId === player2?.id) {
            if (player2) { player2.score -= 1; player2.wins = Math.max(0, player2.wins - 1); }
            if (player1) { player1.losses = Math.max(0, player1.losses - 1); }
        }
    }

    // Apply new result
    match.endTime = new Date().toISOString();
    if (selectedValue === 'draw') {
        match.result = 'draw';
        match.winnerId = null;
        if (player1) { player1.score += 0.5; player1.draws++; }
        if (player2) { player2.score += 0.5; player2.draws++; }
    } else {
        match.winnerId = selectedValue;
        match.result = 'win';
        const winner = tournament.players.find(p => p.id === match.winnerId);
        const loser = tournament.players.find(p => p.id === (match.winnerId === match.player1Id ? match.player2Id : match.player1Id));
        if (winner) { winner.score += 1; winner.wins++; }
        if (loser) { loser.losses++; }

        // Handle elimination for cup mode
        if (tournament.mode === 'cup' && loser) {
            loser.eliminated = true;
            // Also eliminate from any pending matches in the *current* round if not yet played
            // This handles a scenario where a player gets eliminated but was also scheduled for another match
            currentRound.matches.forEach(m => {
                if ((m.player1Id === loser.id || m.player2Id === loser.id) && !m.result) {
                    // Mark match as 'forfeited' or 'walkover' for the opponent
                    if (m.player1Id === loser.id && m.player2Id) {
                        m.result = 'win';
                        m.winnerId = m.player2Id;
                        m.endTime = new Date().toISOString();
                        const opponent = tournament.players.find(p => p.id === m.player2Id);
                        if (opponent) { opponent.score += 1; opponent.wins++; }
                    } else if (m.player2Id === loser.id && m.player1Id) {
                        m.result = 'win';
                        m.winnerId = m.player1Id;
                        m.endTime = new Date().toISOString();
                        const opponent = tournament.players.find(p => p.id === m.player1Id);
                        if (opponent) { opponent.score += 1; opponent.wins++; }
                    } else if (m.player1Id === loser.id && m.player2Id === null) { // If the eliminated player was supposed to get a BYE, they don't get the point.
                        m.result = 'eliminated-bye';
                        m.winnerId = null; // No one gets points for this specific scenario
                        m.endTime = new Date().toISOString();
                    }
                }
            });
        }
    }

    // Add opponent to pastOpponents list for both players if they played a real match
    if (player1 && player2) {
        if (!player1.pastOpponents.includes(player2.id)) player1.pastOpponents.push(player2.id);
        if (!player2.pastOpponents.includes(player1.id)) player2.pastOpponents.push(player1.id);
    } else if (player1 && match.player2Id === null) { // BYE case for player1
        // No opponent to add to pastOpponents
    }

    // Increment matchesPlayed only if not already done for this match
    if (player1 && !match.player1Played) { player1.matchesPlayed++; match.player1Played = true; }
    if (player2 && match.player2Id && !match.player2Played) { player2.matchesPlayed++; match.player2Played = true; }


    tournament.lastUpdated = new Date().toISOString();
    updateTournamentInLocalStorage(tournament);
    showMessage(`Result recorded for match on Board #${match.boardNumber}!`, 'info');

    // Refresh UI elements that depend on the tournament state
    // ONLY call page-specific rendering functions for the current page
    if (window.location.pathname.endsWith('tournament-detail.html')) {
        renderCurrentRound(tournament);
        renderLeaderboard(tournament);
    } else if (window.location.pathname.endsWith('admin-panel.html')) {
        renderAdminPairingAndResults(tournament);
        if (tournament.mode === 'cup') {
            renderCupFlowchart(tournament);
        }
    }
}


/**
 * Renders the leaderboard for the tournament.
 * @param {Object} tournament - The tournament object.
 */
function renderLeaderboard(tournament) {
    const leaderboardSection = document.getElementById('leaderboard-section');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const noLeaderboardMessage = document.getElementById('no-leaderboard-message');
    const teamColHeaders = document.querySelectorAll('.team-col'); // Select all team columns

    // Robust check for element existence, return early if not found
    if (!leaderboardSection || !leaderboardBody || !noLeaderboardMessage || teamColHeaders.length === 0) {
        console.warn("renderLeaderboard: One or more required DOM elements not found. Skipping render.");
        return;
    }

    if (tournament.status === 'pending') {
        leaderboardSection.classList.add('hidden');
        return;
    } else {
        leaderboardSection.classList.remove('hidden');
    }

    // Show/hide team column based on tournament type
    teamColHeaders.forEach(th => {
        if (tournament.isTeamTournament) {
            th.classList.remove('hidden');
        } else {
            th.classList.add('hidden');
        }
    });


    // Calculate tie-breaks (e.g., sum of opponent's scores for Swiss/Round Robin, not relevant for Cup initially)
    // For simplicity here, tie-break will be current score, then player rating, then alphabetically.
    // In a real system, you'd calculate more complex tie-breaks like Buchholz or Sonneborn-Berger.
    const sortedPlayers = [...tournament.players].sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score; // Higher score first
        }
        if (b.rating !== a.rating) {
            return (b.rating || 0) - (a.rating || 0); // Higher rating first (treat null as 0)
        }
        return a.name.localeCompare(b.name); // Alphabetical if scores and ratings are same
    });

    leaderboardBody.innerHTML = '';
    if (sortedPlayers.length === 0) {
        noLeaderboardMessage.classList.remove('hidden');
        return;
    } else {
        noLeaderboardMessage.classList.add('hidden');
    }

    sortedPlayers.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2">${index + 1}</td>
            <td class="px-4 py-2">${escapeHTML(player.name)}</td>
            <td class="px-4 py-2">${player.score}</td>
            <td class="px-4 py-2">${player.rating || 'N/A'}</td> <td class="px-4 py-2 team-col ${tournament.isTeamTournament ? '' : 'hidden'}">${player.teamName ? escapeHTML(player.teamName) : 'N/A'}</td>
        `;
        leaderboardBody.appendChild(row);
    });

    // Update tournament.leaderboard (important for PDF export)
    tournament.leaderboard = sortedPlayers;
    // Don't save here, as this function is for rendering only.
    // Saving happens when match results are recorded or tournament ends.
}

/**
 * Downloads tournament data as a PDF.
 * @param {Object} tournament - The tournament object.
 */
async function downloadTournamentPDF(tournament) {
    showMessage('Generating PDF...', 'info');

    // Create a temporary div to render PDF content
    const pdfContent = document.createElement('div');
    pdfContent.style.padding = '25px'; // Increased padding
    pdfContent.style.fontFamily = 'Inter, sans-serif';
    pdfContent.style.color = '#333'; // Dark text for PDF
    pdfContent.style.backgroundColor = '#fff'; // White background

    let contentHTML = `
        <h1 style="text-align: center; color: #1a202c; margin-bottom: 15px;">${escapeHTML(tournament.name)} Chess Tournament</h1>
        <p style="text-align: center; margin-bottom: 10px;">Mode: <strong>${escapeHTML(tournament.mode.replace('-', ' '))}</strong></p>
        <p style="text-align: center; margin-bottom: 10px;">Time Control: <strong>${escapeHTML(tournament.timeControl || 'N/A')}</strong></p>
        <p style="text-align: center; margin-bottom: 10px;">Total Rounds: <strong>${tournament.numRounds !== null ? tournament.numRounds : 'Unlimited'}</strong></p>
        ${tournament.isTeamTournament ? '<p style="text-align: center; margin-bottom: 10px;">Type: <strong>Team Tournament</strong></p>' : ''}
        <p style="text-align: center; margin-bottom: 25px;">Status: <strong>${escapeHTML(tournament.status)}</strong></p>
    `;

    // Add Players Section
    contentHTML += `<h2 style="color: #2c5282; margin-top: 35px; margin-bottom: 15px;">Players (${tournament.players.length})</h2>`;
    if (tournament.players.length > 0) {
        contentHTML += `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                <thead>
                    <tr style="background-color: #e2e8f0;">
                        <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Name</th>
                        ${tournament.isTeamTournament ? '<th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Team</th>' : ''}
                        <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Rating</th>
                        <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Score</th>
                        <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Wins</th>
                        <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Draws</th>
                        <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Losses</th>
                    </tr>
                </thead>
                <tbody>
        `;
        tournament.players.forEach(player => {
            contentHTML += `
                <tr>
                    <td style="border: 1px solid #cbd5e0; padding: 10px;">${escapeHTML(player.name)}</td>
                    ${tournament.isTeamTournament ? `<td style="border: 1px solid #cbd5e0; padding: 10px;">${player.teamName ? escapeHTML(player.teamName) : 'N/A'}</td>` : ''}
                    <td style="border: 1px solid #cbd5e0; padding: 10px;">${player.rating || 'N/A'}</td>
                    <td style="border: 1px solid #cbd5e0; padding: 10px;">${player.score}</td>
                    <td style="border: 1px solid #cbd5e0; padding: 10px;">${player.wins}</td>
                    <td style="border: 1px solid #cbd5e0; padding: 10px;">${player.draws}</td>
                    <td style="border: 1px solid #cbd5e0; padding: 10px;">${player.losses}</td>
                </tr>
            `;
        });
        contentHTML += `</tbody></table>`;
    } else {
        contentHTML += `<p>No players registered yet.</p>`;
    }

    // Add Teams Section (if applicable)
    if (tournament.isTeamTournament && tournament.teams && tournament.teams.length > 0) {
        contentHTML += `<h2 style="color: #2c5282; margin-top: 35px; margin-bottom: 15px;">Teams (${tournament.teams.length})</h2>`;
        contentHTML += `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                <thead>
                    <tr style="background-color: #e2e8f0;">
                        <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Team Name</th>
                    </tr>
                </thead>
                <tbody>
        `;
        tournament.teams.forEach(team => {
            contentHTML += `
                <tr>
                    <td style="border: 1px solid #cbd5e0; padding: 10px;">${escapeHTML(team.name)}</td>
                </tr>
            `;
        });
        contentHTML += `</tbody></table>`;
    }


    // Add Rounds and Pairings
    contentHTML += `<h2 style="color: #2c5282; margin-top: 35px; margin-bottom: 15px;">Rounds & Pairings</h2>`;
    if (tournament.rounds.length > 0) {
        tournament.rounds.forEach(round => {
            contentHTML += `<h3 style="color: #4a5568; margin-top: 25px; margin-bottom: 10px;">Round ${round.roundNumber}</h3>`;
            if (round.matches.length > 0) {
                contentHTML += `
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                        <thead>
                            <tr style="background-color: #edf2f7;">
                                <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Board #</th>
                                <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Player 1</th>
                                ${tournament.isTeamTournament ? '<th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">P1 Team</th>' : ''}
                                <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Player 2</th>
                                ${tournament.isTeamTournament ? '<th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">P2 Team</th>' : ''}
                                <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Result</th>
                                <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Winner</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                // Sort matches by board number for PDF
                const sortedRoundMatches = [...round.matches].sort((a, b) => a.boardNumber - b.boardNumber);
                sortedRoundMatches.forEach(match => {
                    const player1 = tournament.players.find(p => p.id === match.player1Id);
                    const player2 = tournament.players.find(p => p.id === match.player2Id);
                    const winner = tournament.players.find(p => p.id === match.winnerId);
                    contentHTML += `
                        <tr>
                            <td style="border: 1px solid #cbd5e0; padding: 10px;">${match.boardNumber || 'N/A'}</td>
                            <td style="border: 1px solid #cbd5e0; padding: 10px;">${player1 ? escapeHTML(player1.name) : 'BYE'}</td>
                            ${tournament.isTeamTournament ? `<td style="border: 1px solid #cbd5e0; padding: 10px;">${player1?.teamName ? escapeHTML(player1.teamName) : 'N/A'}</td>` : ''}
                            <td style="border: 1px solid #cbd5e0; padding: 10px;">${player2 ? escapeHTML(player2.name) : 'BYE'}</td>
                            ${tournament.isTeamTournament ? `<td style="border: 1px solid #cbd5e0; padding: 10px;">${player2?.teamName ? escapeHTML(player2.teamName) : 'N/A'}</td>` : ''}
                            <td style="border: 1px solid #cbd5e0; padding: 10px;">${match.result ? escapeHTML(match.result) : 'N/A'}</td>
                            <td style="border: 1px solid #cbd5e0; padding: 10px;">${winner ? escapeHTML(winner.name) : (match.result === 'draw' ? 'Draw' : 'N/A')}</td>
                        </tr>
                    `;
                });
                contentHTML += `</tbody></table>`;
            } else {
                contentHTML += `<p>No matches generated for this round.</p>`;
            }
        });
    } else {
        contentHTML += `<p>No rounds or pairings yet.</p>`;
    }

    // Add Leaderboard (only if not pending)
    if (tournament.status !== 'pending') {
        contentHTML += `<h2 style="color: #2c5282; margin-top: 35px; margin-bottom: 15px;">Final Leaderboard</h2>`;
        // Ensure leaderboard is up-to-date before generating PDF
        const sortedLeaderboardPlayers = [...tournament.players].sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            if (b.rating !== a.rating) {
                return (b.rating || 0) - (a.rating || 0);
            }
            return a.name.localeCompare(b.name);
        });

        if (sortedLeaderboardPlayers && sortedLeaderboardPlayers.length > 0) {
            contentHTML += `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #e2e8f0;">
                            <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Rank</th>
                            <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Player</th>
                            <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Score</th>
                            <th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Tie-Break</th>
                            ${tournament.isTeamTournament ? '<th style="border: 1px solid #cbd5e0; padding: 10px; text-align: left;">Team</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
            `;
            sortedLeaderboardPlayers.forEach((player, index) => {
                contentHTML += `
                    <tr>
                        <td style="border: 1px solid #cbd5e0; padding: 10px;">${index + 1}</td>
                        <td style="border: 1px solid #cbd5e0; padding: 10px;">${escapeHTML(player.name)}</td>
                        <td style="border: 1px solid #cbd5e0; padding: 10px;">${player.score}</td>
                        <td style="border: 1px solid #cbd5e0; padding: 10px;">${player.rating || 'N/A'}</td>
                        ${tournament.isTeamTournament ? `<td style="border: 1px solid #cbd5e0; padding: 10px;">${player.teamName ? escapeHTML(player.teamName) : 'N/A'}</td>` : ''}
                    </tr>
                `;
            });
            contentHTML += `</tbody></table>`;
        } else {
            contentHTML += `<p>Leaderboard not available or empty.</p>`;
        }
    }

    pdfContent.innerHTML = contentHTML;

    // Append to body temporarily for html2canvas
    document.body.appendChild(pdfContent);

    try {
        const canvas = await html2canvas(pdfContent, {
            scale: 2, // Higher scale for better resolution
            useCORS: true, // If any external images were involved
            logging: false // Suppress html2canvas logs
        });
        const imgData = canvas.toDataURL('image/png');

        const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;

        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(`${tournament.name.replace(/\s/g, '_')}_details.pdf`);
        showMessage('PDF generated successfully!', 'info');
    } catch (error) {
        console.error("Error generating PDF:", error);
        showMessage(`Failed to generate PDF: ${error.message}`, 'error');
    } finally {
        // Remove the temporary div
        if (pdfContent.parentNode) {
            pdfContent.parentNode.removeChild(pdfContent);
        }
    }
}

/**
 * Exports the current tournament data to a JSON file.
 * @param {Object} tournament - The tournament object to export.
 */
function exportTournamentJSON(tournament) {
    try {
        // Prepare tournament data for export: convert Date objects to ISO strings
        const tournamentToExport = JSON.parse(JSON.stringify(tournament)); // Deep copy to avoid modifying original
        tournamentToExport.createdAt = tournament.createdAt.toISOString();
        tournamentToExport.lastUpdated = tournament.lastUpdated.toISOString();
        if (tournament.completedAt) tournamentToExport.completedAt = tournament.completedAt.toISOString();

        tournamentToExport.players = tournamentToExport.players.map(p => ({
            ...p,
            addedAt: p.addedAt ? new Date(p.addedAt).toISOString() : null
        }));
        tournamentToExport.rounds = tournamentToExport.rounds.map(r => ({
            ...r,
            startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null,
            completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null,
            matches: r.matches.map(m => ({
                ...m,
                startTime: m.startTime ? new Date(m.startTime).toISOString() : null,
                endTime: m.endTime ? new Date(m.endTime).toISOString() : null
            }))
        }));

        const dataStr = JSON.stringify(tournamentToExport, null, 2); // Pretty print JSON
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `${tournament.name.replace(/\s/g, '_')}_${tournament.id}.json`;

        let linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click(); // Simulate click to trigger download
        linkElement.remove(); // Clean up

        showMessage('Tournament data exported to JSON!', 'info');
    } catch (error) {
        console.error("Error exporting JSON:", error);
        showMessage(`Failed to export JSON: ${error.message}`, 'error');
    }
}

// --- Admin Panel Logic ---

/**
 * Renders various controls and information for the admin panel.
 * @param {Object} tournament - The tournament object.
 */
function renderAdminPairingAndResults(tournament) {
    const adminCurrentRoundNumber = document.getElementById('admin-current-round-number');
    adminCurrentRoundNumber.textContent = tournament.rounds.length > 0 ? tournament.rounds.length : 0;

    // Update button states based on tournament status and number of players
    const startBtn = document.getElementById('start-tournament-btn');
    const endBtn = document.getElementById('end-tournament-btn');
    const nextRoundBtn = document.getElementById('generate-next-round-btn');
    const pairingBtns = [
        document.getElementById('manual-pairing-btn'),
        document.getElementById('random-pairing-btn'),
        document.getElementById('auto-pairing-btn'),
        document.getElementById('pairing-with-points-btn')
    ];
    const recordResultsSection = document.getElementById('record-results');

    if (tournament.status === 'pending') {
        startBtn.disabled = tournament.players.length < 2 || (tournament.isTeamTournament && tournament.teams.length < 2); // Need at least 2 players/teams to start
        endBtn.disabled = true;
        nextRoundBtn.disabled = true;
        pairingBtns.forEach(btn => btn.disabled = true);
        recordResultsSection.classList.add('visually-hidden'); // Use visually-hidden for sections
    } else if (tournament.status === 'ongoing') {
        startBtn.disabled = true;
        endBtn.disabled = false;

        // Check if all matches in the current round have results
        const currentRound = tournament.rounds[tournament.rounds.length - 1];
        const allMatchesRecorded = currentRound && currentRound.matches.every(m => m.result || m.player2Id === null); // BYE matches are considered recorded

        // Disable next round button if total rounds limit reached
        const currentRoundCount = tournament.rounds.length;
        const totalRoundsLimitReached = tournament.numRounds !== null && currentRoundCount >= tournament.numRounds;

        if (tournament.mode === 'cup' && tournament.players.filter(p => !p.eliminated).length <= 1) {
             // If cup mode has found a winner or only one left, no more rounds.
             nextRoundBtn.disabled = true;
             endBtn.disabled = false; // Allow ending
             if(tournament.players.filter(p => !p.eliminated).length === 1 && tournament.status === 'ongoing') {
                 showMessage('Cup Tournament has a winner! End the tournament to finalize results.', 'info');
             } else if (tournament.status === 'ongoing') {
                 showMessage('All matches in cup mode are completed for this stage. Ready to end the tournament.', 'info');
             }
        } else {
            nextRoundBtn.disabled = !allMatchesRecorded || totalRoundsLimitReached;
            endBtn.disabled = !allMatchesRecorded; // Only enable if all matches in current round are recorded
            if (totalRoundsLimitReached && allMatchesRecorded && tournament.status === 'ongoing') {
                showMessage(`Tournament has reached its maximum of ${tournament.numRounds} rounds. Ready to end.`, 'info');
            }
        }

        // Only enable pairing options if current round is fully recorded OR if no rounds have been generated yet
        // and the tournament is ongoing (e.g., after initial start, but before first pairings)
        const canGeneratePairings = allMatchesRecorded || tournament.rounds.length === 0;
        pairingBtns.forEach(btn => btn.disabled = !canGeneratePairings);

        recordResultsSection.classList.remove('visually-hidden');
        renderMatchesToRecord(tournament);
    } else if (tournament.status === 'completed') {
        startBtn.disabled = true;
        endBtn.disabled = true;
        nextRoundBtn.disabled = true;
        pairingBtns.forEach(btn => btn.disabled = true);
        recordResultsSection.classList.add('visually-hidden');
    }

    // Hide manual pairing controls by default or if not expanded
    const manualPairingArea = document.getElementById('manual-pairing-area');
    const manualPairingBtn = document.getElementById('manual-pairing-btn');
    if (!manualPairingBtn.getAttribute('aria-expanded') || manualPairingBtn.getAttribute('aria-expanded') === 'false') {
        manualPairingArea.classList.add('visually-hidden');
    } else {
        manualPairingArea.classList.remove('visually-hidden');
    }
}


/**
 * Starts the tournament.
 * @param {Object} tournament - The tournament object.
 */
function startTournament(tournament) {
    if (tournament.players.length < 2) {
        showMessage('Cannot start tournament: At least two players are required!', 'error');
        return;
    }
    if (tournament.isTeamTournament && tournament.teams.length < 2) {
        showMessage('Cannot start team tournament: At least two teams are required!', 'error');
        return;
    }
    if (tournament.status === 'ongoing' || tournament.status === 'completed') {
        showMessage('Tournament already started or completed!', 'info');
        return;
    }

    tournament.status = 'ongoing';
    tournament.lastUpdated = new Date().toISOString();
    updateTournamentInLocalStorage(tournament);
    showMessage('Tournament started! Generating first round.', 'info');

    // Automatically generate the first round based on mode
    if (tournament.mode === 'swiss' || tournament.mode === 'points' || tournament.mode === 'random') {
        // For Swiss/Points, initial pairing is typically random or based on rating if available
        // For simplicity, we can use 'random' for the very first pairing
        generatePairings('random', tournament); // Generate initial pairings randomly
    } else if (tournament.mode === 'round-robin') {
        generatePairings('round-robin', tournament);
    } else if (tournament.mode === 'cup') {
        generatePairings('cup', tournament); // Generate initial cup matches
    }

    renderAdminPairingAndResults(tournament); // Update admin UI
}

/**
 * Ends the tournament.
 * @param {Object} tournament - The tournament object.
 */
function endTournament(tournament) {
    if (tournament.status === 'completed') {
        showMessage('Tournament already completed!', 'info');
        return;
    }

    // Ensure all matches in the current round have results before ending
    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    if (currentRound && currentRound.matches.some(m => !m.result && m.player2Id !== null)) { // Exclude BYE matches from this check
        showMessage('Please record all results for the current round before ending the tournament!', 'error');
        return;
    }

    tournament.status = 'completed';
    tournament.completedAt = new Date().toISOString();
    // Finalize leaderboard (ensure it's updated)
    // The renderLeaderboard function in tournament-detail.html updates this,
    // but for admin panel context and export, explicitly ensure it's finalized here.
    tournament.leaderboard = [...tournament.players].sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        if (b.rating !== a.rating) {
            return (b.rating || 0) - (a.rating || 0);
        }
        return a.name.localeCompare(b.name);
    });

    tournament.lastUpdated = new Date().toISOString();
    updateTournamentInLocalStorage(tournament);
    showMessage('Tournament ended! Final leaderboard generated.', 'info');

    // Redirect to tournament detail page with a flag to show celebration
    window.location.href = `tournament-detail.html?id=${tournament.id}&celebrate=true`;
}

/**
 * Generates the next round of the tournament.
 * @param {Object} tournament - The tournament object.
 */
function generateNextRound(tournament) {
    if (tournament.status !== 'ongoing') {
        showMessage('Tournament must be ongoing to generate next round!', 'error');
        return;
    }

    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    if (currentRound && currentRound.matches.some(m => !m.result && m.player2Id !== null)) {
        showMessage('Please record all results for the current round before generating the next round!', 'error');
        return;
    }

    // Check if total rounds limit is reached
    if (tournament.numRounds !== null && tournament.rounds.length >= tournament.numRounds) {
        showMessage(`Cannot generate next round: Maximum of ${tournament.numRounds} rounds reached. Please end the tournament.`, 'error');
        return;
    }

    // For cup mode, check if there's only one player left (the winner)
    if (tournament.mode === 'cup') {
        const remainingPlayers = tournament.players.filter(p => !p.eliminated);
        if (remainingPlayers.length <= 1) {
            showMessage('All matches played and a winner is decided for Cup mode. End the tournament to see the final leaderboard.', 'info');
            return;
        }
    }

    // Generate pairings based on the tournament mode
    if (tournament.mode === 'swiss' || tournament.mode === 'points') {
        generatePairings('points', tournament);
    } else if (tournament.mode === 'round-robin') {
        generatePairings('round-robin', tournament);
    } else if (tournament.mode === 'cup') {
        generatePairings('cup', tournament);
    } else {
        generatePairings('random', tournament); // Fallback if type is not recognized for some reason
    }

    showMessage(`Round ${tournament.rounds.length} generated!`, 'info');
    renderAdminPairingAndResults(tournament);
    if (tournament.mode === 'cup') {
        renderCupFlowchart(tournament);
    }
}

/**
 * Handles different pairing methods.
 * @param {'manual' | 'random' | 'auto' | 'points' | 'round-robin' | 'cup'} type - The type of pairing.
 * @param {Object} tournament - The tournament object.
 */
function handlePairing(type, tournament) {
    const currentRound = tournament.rounds[tournament.rounds.length - 1];
    if (currentRound && currentRound.matches.some(m => !m.result && m.player2Id !== null)) {
        showMessage('Please record all results for the current round before generating new pairings!', 'error');
        return;
    }
    // Check if total rounds limit is reached
    if (tournament.numRounds !== null && tournament.rounds.length >= tournament.numRounds) {
        showMessage(`Cannot generate new pairings: Maximum of ${tournament.numRounds} rounds reached. Please end the tournament.`, 'error');
        return;
    }

    // Hide manual pairing controls when other options are clicked
    const manualPairingArea = document.getElementById('manual-pairing-area');
    manualPairingArea.classList.add('visually-hidden');
    document.getElementById('manual-pairing-btn').setAttribute('aria-expanded', 'false');


    if (type === 'manual') {
        manualPairingArea.classList.remove('visually-hidden');
        manualPairingArea.focus();
        document.getElementById('manual-pairing-btn').setAttribute('aria-expanded', 'true');
        renderManualPairingControls(tournament);
        return; // Manual pairing is interactive and doesn't call generatePairings directly here
    }

    generatePairings(type, tournament); // Call the actual pairing logic
    renderAdminPairingAndResults(tournament); // Re-render admin UI
    if (tournament.mode === 'cup') {
        renderCupFlowchart(tournament);
    }
    showMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} pairings generated!`, 'info');
}

/**
 * Core pairing logic based on type.
 * Assigns board numbers based on score.
 * Ensures players don't play each other more than once.
 * @param {'random' | 'auto' | 'points' | 'round-robin' | 'cup'} type - The pairing algorithm to use.
 * @param {Object} tournament - The tournament object.
 */
function generatePairings(type, tournament) {
    let availablePlayers = tournament.players.filter(p => !p.eliminated);
    let roundMatches = [];
    let boardNumber = 1;

    const currentRoundNumber = tournament.rounds.length + 1;
    const isFirstRoundOfTournament = tournament.rounds.length === 0;

    // Filter out eliminated players
    let playersForPairing = availablePlayers.filter(p => !p.eliminated);

    // --- Round Robin Pairing ---
    if (tournament.mode === 'round-robin') {
        if (playersForPairing.length < 2) {
            showMessage('Round Robin requires at least two active players.', 'error');
            return;
        }

        // Implement the "circle method" for Round Robin pairing
        // This ensures each player plays every other player exactly once over N-1 (or N) rounds.
        // It's a bit more complex as it needs to track a persistent player order.

        // Initialize players array for round-robin if first round
        if (!tournament.rrPlayersOrder) {
            tournament.rrPlayersOrder = [...playersForPairing];
            // If odd number of players, add a "dummy" bye player for pairing purposes
            if (tournament.rrPlayersOrder.length % 2 !== 0) {
                tournament.rrPlayersOrder.push({ id: 'BYE_PLAYER', name: 'BYE', isByeDummy: true });
            }
        }

        const numParticipants = tournament.rrPlayersOrder.length;
        if (numParticipants < 2) { // Should not happen if initial check passes
            showMessage('Not enough participants for Round Robin pairing.', 'error');
            return;
        }

        // The number of rounds in a Round Robin where N is the number of players/teams (including BYE dummy)
        const totalRRRounds = numParticipants % 2 === 0 ? numParticipants - 1 : numParticipants;
        if (currentRoundNumber > totalRRRounds) {
            showMessage(`All ${totalRRRounds} Round Robin rounds have been played. Tournament should end.`, 'info');
            return;
        }

        let playersInRound = [...tournament.rrPlayersOrder];
        let pairedThisRound = new Set();
        let currentRoundPlayers = [...playersForPairing]; // Actual active players for this round

        // Fix the first player in place (player0)
        const fixedPlayer = playersInRound[0];
        let rotatingPlayers = playersInRound.slice(1);

        // Rotate the players for the current round
        // The rotation needs to align with the current round number
        let effectiveRotation = (currentRoundNumber - 1) % rotatingPlayers.length;
        let rotatedPlayers = rotatingPlayers.slice(effectiveRotation).concat(rotatingPlayers.slice(0, effectiveRotation));

        // Pair the fixed player with the first rotating player
        if (fixedPlayer.id !== 'BYE_PLAYER') {
            const opponentForFixed = rotatedPlayers[0];
            if (opponentForFixed && opponentForFixed.id !== 'BYE_PLAYER') {
                roundMatches.push({
                    id: generateUUID(), player1Id: fixedPlayer.id, player2Id: opponentForFixed.id,
                    result: null, winnerId: null, startTime: new Date().toISOString(), endTime: null,
                    player1Played: false, player2Played: false, boardNumber: boardNumber++
                });
                pairedThisRound.add(fixedPlayer.id);
                pairedThisRound.add(opponentForFixed.id);
            } else if (opponentForFixed && opponentForFixed.isByeDummy) {
                // Fixed player gets BYE
                roundMatches.push({
                    id: generateUUID(), player1Id: fixedPlayer.id, player2Id: null,
                    result: `${fixedPlayer.id} wins (BYE)`, winnerId: fixedPlayer.id,
                    startTime: new Date().toISOString(), endTime: new Date().toISOString(),
                    player1Played: true, player2Played: true, boardNumber: boardNumber++
                });
                fixedPlayer.score += 1;
                fixedPlayer.wins++;
                fixedPlayer.matchesPlayed++;
                pairedThisRound.add(fixedPlayer.id);
            }
        } else {
             // If fixedPlayer is BYE_PLAYER, the first rotating player gets the BYE
             const playerReceivingBye = rotatedPlayers[0];
             if (playerReceivingBye && !playerReceivingBye.isByeDummy) { // Ensure it's a real player
                 roundMatches.push({
                     id: generateUUID(), player1Id: playerReceivingBye.id, player2Id: null,
                     result: `${playerReceivingBye.id} wins (BYE)`, winnerId: playerReceivingBye.id,
                     startTime: new Date().toISOString(), endTime: new Date().toISOString(),
                     player1Played: true, player2Played: true, boardNumber: boardNumber++
                 });
                 playerReceivingBye.score += 1;
                 playerReceivingBye.wins++;
                 playerReceivingBye.matchesPlayed++;
                 pairedThisRound.add(playerReceivingBye.id);
             }
        }

        // Pair the remaining players
        for (let i = 1; i < rotatedPlayers.length / 2; i++) {
            const player1 = rotatedPlayers[i];
            const player2 = rotatedPlayers[rotatedPlayers.length - i];

            // Ensure neither player is the BYE_PLAYER dummy or already paired
            if (!player1.isByeDummy && !player2.isByeDummy && !pairedThisRound.has(player1.id) && !pairedThisRound.has(player2.id)) {
                 if (tournament.isTeamTournament && player1.teamId && player2.teamId && player1.teamId === player2.teamId) {
                    showMessage(`Warning: Cannot pair players from the same team (${player1.name} and ${player2.name}) in Round Robin. This might break the standard Round Robin schedule.`, 'error');
                    continue; // Skip this pairing, but note that it breaks the schedule
                }
                roundMatches.push({
                    id: generateUUID(), player1Id: player1.id, player2Id: player2.id,
                    result: null, winnerId: null, startTime: new Date().toISOString(), endTime: null,
                    player1Played: false, player2Played: false, boardNumber: boardNumber++
                });
                pairedThisRound.add(player1.id);
                pairedThisRound.add(player2.id);
            } else if (player1.isByeDummy && !player2.isByeDummy && !pairedThisRound.has(player2.id)) {
                // Player2 gets BYE
                roundMatches.push({
                    id: generateUUID(), player1Id: player2.id, player2Id: null,
                    result: `${player2.id} wins (BYE)`, winnerId: player2.id,
                    startTime: new Date().toISOString(), endTime: new Date().toISOString(),
                    player1Played: true, player2Played: true, boardNumber: boardNumber++
                });
                player2.score += 1;
                player2.wins++;
                player2.matchesPlayed++;
                pairedThisRound.add(player2.id);
            } else if (player2.isByeDummy && !player1.isByeDummy && !pairedThisRound.has(player1.id)) {
                 // Player1 gets BYE
                roundMatches.push({
                    id: generateUUID(), player1Id: player1.id, player2Id: null,
                    result: `${player1.id} wins (BYE)`, winnerId: player1.id,
                    startTime: new Date().toISOString(), endTime: new Date().toISOString(),
                    player1Played: true, player2Played: true, boardNumber: boardNumber++
                });
                player1.score += 1;
                player1.wins++;
                player1.matchesPlayed++;
                pairedThisRound.add(player1.id);
            }
        }

        // After this, save `tournament.rrPlayersOrder` for the next round's rotation.
        // For round robin, the order usually changes for the next round.
        // A simple rotation for next round's calculation: move last rotating player to second position
        let nextRotatingPlayers = [...rotatingPlayers];
        let lastRotatingPlayer = nextRotatingPlayers.pop();
        if (lastRotatingPlayer) {
            nextRotatingPlayers.unshift(lastRotatingPlayer);
        }
        tournament.rrPlayersOrder = [fixedPlayer, ...nextRotatingPlayers];

    }
    // --- Cup Mode Pairing ---
    else if (tournament.mode === 'cup') {
        const remainingPlayers = tournament.players.filter(p => !p.eliminated);
        if (remainingPlayers.length < 1) {
            showMessage('No players left for Cup mode pairings.', 'info');
            return;
        }
        if (remainingPlayers.length === 1 && tournament.status === 'ongoing') {
            showMessage('A winner has been determined in Cup mode. End the tournament.', 'info');
            return;
        }

        let playersForCupRound = [...remainingPlayers];
        playersForCupRound.sort(() => Math.random() - 0.5); // Randomize for fair initial bracket

        // Handle BYE for odd number of players
        if (playersForCupRound.length % 2 !== 0) {
            // Give BYE to the player with the highest score, or random among highest
            playersForCupRound.sort((a, b) => b.score - a.score);
            const byePlayer = playersForCupRound.shift(); // Take the top player as BYE
            roundMatches.push({
                id: generateUUID(), player1Id: byePlayer.id, player2Id: null,
                result: `${byePlayer.id} wins (BYE)`, winnerId: byePlayer.id,
                startTime: new Date().toISOString(), endTime: new Date().toISOString(),
                player1Played: true, player2Played: true, boardNumber: boardNumber++
            });
            byePlayer.score += 1;
            byePlayer.wins++;
            byePlayer.matchesPlayed++;
        }

        // Pair the remaining players
        while (playersForCupRound.length >= 2) {
            const player1 = playersForCupRound.shift();
            const player2 = playersForCupRound.shift();

            // Check for same-team pairing in team tournaments
            if (tournament.isTeamTournament && player1.teamId && player2.teamId && player1.teamId === player2.teamId) {
                showMessage(`Warning: Team players ${player1.name} and ${player2.name} were paired in Cup mode due to limited opponents. Consider adjusting teams or players.`, 'info');
                // Allow this pairing but warn, as it's a bracket and might be unavoidable
            }

            roundMatches.push({
                id: generateUUID(), player1Id: player1.id, player2Id: player2.id,
                result: null, winnerId: null, startTime: new Date().toISOString(), endTime: null,
                player1Played: false, player2Played: false, boardNumber: boardNumber++
            });
        }
    }
    // --- Swiss / Points / Random Pairing (general logic for all other types) ---
    else {
        let tempUnpaired = [...playersForPairing];
        let pairedThisRound = new Set(); // To ensure players are paired only once per round

        // Sorting for 'points' or 'auto' (Swiss-like)
        if (type === 'points' || type === 'auto') {
            // Sort by score (desc), then rating (desc), then name (asc)
            tempUnpaired.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.rating !== a.rating) return (b.rating || 0) - (a.rating || 0);
                return a.name.localeCompare(b.name);
            });
        } else if (type === 'random') {
            tempUnpaired.sort(() => Math.random() - 0.5); // Randomize
        }

        // Handle BYE for odd number of players
        let byePlayerThisRound = null;
        if (tempUnpaired.length % 2 !== 0) {
            // Find the player who has received the fewest BYEs historically (if any),
            // and among those, the one with the lowest score (to avoid giving bye to top players).
            byePlayerThisRound = tempUnpaired.reduce((bestByeCandidate, player) => {
                // Count historical BYEs for current player
                const playerByeCount = tournament.rounds.filter(r => r.matches.some(m => m.player1Id === player.id && m.player2Id === null)).length;

                if (!bestByeCandidate) {
                    return player; // First candidate is the best so far
                }
                // Count historical BYEs for the current best candidate
                const bestByeCount = tournament.rounds.filter(r => r.matches.some(m => m.player1Id === bestByeCandidate.id && m.player2Id === null)).length;

                if (playerByeCount < bestByeCount) {
                    return player; // Player has fewer BYEs
                } else if (playerByeCount === bestByeCount) {
                    if (player.score < bestByeCandidate.score) { // Prefer lower score for BYE
                        return player;
                    }
                }
                return bestByeCandidate; // Keep current best candidate
            }, null);

            if (byePlayerThisRound) {
                tempUnpaired = tempUnpaired.filter(p => p.id !== byePlayerThisRound.id);
                roundMatches.push({
                    id: generateUUID(), player1Id: byePlayerThisRound.id, player2Id: null,
                    result: `${byePlayerThisRound.id} wins (BYE)`, winnerId: byePlayerThisRound.id,
                    startTime: new Date().toISOString(), endTime: new Date().toISOString(),
                    player1Played: true, player2Played: true, boardNumber: boardNumber++
                });
                byePlayerThisRound.score += 1;
                byePlayerThisRound.wins++;
                byePlayerThisRound.matchesPlayed++;
                pairedThisRound.add(byePlayerThisRound.id); // Mark as paired for this round
            }
        }

        // Pair the remaining players
        while (tempUnpaired.length >= 2) {
            const player1 = tempUnpaired.shift(); // Take the top player

            if (pairedThisRound.has(player1.id)) continue; // Skip if this player was already paired (e.g., received a BYE)

            let foundPair = false;
            // Iterate through remaining players to find a suitable opponent for player1
            for (let i = 0; i < tempUnpaired.length; i++) {
                const player2Candidate = tempUnpaired[i];

                if (pairedThisRound.has(player2Candidate.id)) continue; // Skip if already paired in this round

                // Rule 1: No rematches (skip if they've played before)
                if (player1.pastOpponents.includes(player2Candidate.id)) {
                    continue;
                }

                // Rule 2: No same-team pairing in team tournaments
                if (tournament.isTeamTournament && player1.teamId && player2Candidate.teamId && player1.teamId === player2Candidate.teamId) {
                    continue;
                }

                // If we reach here, player2Candidate is a valid opponent for this algorithm
                roundMatches.push({
                    id: generateUUID(), player1Id: player1.id, player2Id: player2Candidate.id,
                    result: null, winnerId: null, startTime: new Date().toISOString(), endTime: null,
                    player1Played: false, player2Played: false, boardNumber: boardNumber++
                });
                pairedThisRound.add(player1.id);
                pairedThisRound.add(player2Candidate.id);
                tempUnpaired.splice(i, 1); // Remove player2Candidate
                foundPair = true;
                break; // Move to the next player1
            }

            if (!foundPair && player1) {
                // This player could not be paired under the current rules.
                // In a real Swiss system, this would trigger more complex logic (e.g.,
                // trying a different pairing for previous players, or giving this player a BYE if no one else is available).
                // For this implementation, we'll simply log a warning and leave them unpaired.
                console.warn(`Could not find a valid opponent for ${player1.name} in round ${currentRoundNumber}. Player will remain unpaired for this round.`);
            }
        }
    }

    const newRound = {
        roundNumber: currentRoundNumber,
        matches: roundMatches,
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    // Only add a round if there are actual matches (or if it's a BYE only round which happens in cup mode sometimes)
    if (newRound.matches.length > 0 || tournament.mode === 'cup') { // Always add a round in cup mode even if only BYEs
        tournament.rounds.push(newRound);
        tournament.lastUpdated = new Date().toISOString();
        updateTournamentInLocalStorage(tournament);
    } else {
        showMessage('No new matches could be generated for this round with available players. Consider manual pairing or adjust player count.', 'info');
    }
}


/**
 * Displays controls for manual pairing.
 * @param {Object} tournament - The tournament object.
 */
function renderManualPairingControls(tournament) {
    const manualPairingArea = document.getElementById('manual-pairing-area');
    manualPairingArea.classList.remove('visually-hidden');
    manualPairingArea.focus(); // Focus for accessibility

    const unpairedPlayersListDiv = document.getElementById('unpaired-players-list');
    const player1Select = document.getElementById('player1-select');
    const player2Select = document.getElementById('player2-select');

    player1Select.innerHTML = '<option value="">Select Player 1</option>';
    player2Select.innerHTML = '<option value="">Select Player 2</option>';
    unpairedPlayersListDiv.innerHTML = '';

    let currentRound = tournament.rounds[tournament.rounds.length - 1];
    let pairedPlayerIds = new Set();
    if (currentRound && !currentRound.completedAt) { // Only consider current active round
        currentRound.matches.forEach(match => {
            if (match.player1Id) pairedPlayerIds.add(match.player1Id);
            if (match.player2Id) pairedPlayerIds.add(match.player2Id);
        });
    }

    let unpairedPlayers = tournament.players.filter(p => !pairedPlayerIds.has(p.id) && !p.eliminated);
    unpairedPlayers.sort((a,b) => b.score - a.score); // Sort by score for manual selection info

    if (unpairedPlayers.length === 0) {
        unpairedPlayersListDiv.textContent = 'All players are currently paired, eliminated, or have had a BYE.';
    } else {
        unpairedPlayersListDiv.innerHTML = '<span class="font-semibold text-gray-300 mr-2">Unpaired:</span>';
        unpairedPlayers.forEach(player => {
            unpairedPlayersListDiv.innerHTML += `<span class="bg-gray-700 rounded-md px-2 py-1 text-sm">${escapeHTML(player.name)} (${player.score} pts${player.teamName ? ', Team: ' + escapeHTML(player.teamName) : ''})</span>`;
            const option1 = document.createElement('option');
            option1.value = player.id;
            option1.textContent = `${escapeHTML(player.name)} (Score: ${player.score} ${player.teamName ? `, Team: ${escapeHTML(player.teamName)}` : ''})`;
            player1Select.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = player.id;
            option2.textContent = `${escapeHTML(player.name)} (Score: ${player.score} ${player.teamName ? `, Team: ${escapeHTML(player.teamName)}` : ''})`;
            player2Select.appendChild(option2);
        });
    }
}

/**
 * Adds a manual pair to the current round.
 * @param {Object} tournament - The tournament object.
 */
function addManualPair(tournament) {
    const player1Id = document.getElementById('player1-select').value;
    const player2Id = document.getElementById('player2-select').value;

    if (!player1Id || !player2Id) {
        showMessage('Please select both players for manual pairing.', 'error');
        return;
    }
    if (player1Id === player2Id) {
        showMessage('A player cannot be paired with themselves!', 'error');
        return;
    }

    const player1 = tournament.players.find(p => p.id === player1Id);
    const player2 = tournament.players.find(p => p.id === player2Id);

    if (!player1 || !player2) {
        showMessage('Selected player(s) not found.', 'error');
        return;
    }

    if (tournament.isTeamTournament && player1.teamId === player2.teamId) {
        showMessage('Cannot pair players from the same team in a team tournament!', 'error');
        return;
    }

    // Check for rematch for manual pairing
    if (player1.pastOpponents.includes(player2.id)) {
        showMessage(`Warning: ${player1.name} and ${player2.name} have already played each other.`, 'info');
        // You might want to prevent this or ask for confirmation depending on desired strictness
    }


    let currentRound = tournament.rounds[tournament.rounds.length - 1];
    if (!currentRound || currentRound.completedAt) {
        // If no current round or current round is completed, create a new one
        currentRound = {
            roundNumber: tournament.rounds.length + 1,
            matches: [],
            startedAt: new Date().toISOString(),
            completedAt: null
        };
        tournament.rounds.push(currentRound);
    }

    // Check if players are already paired in the current round or have a pending match
    const alreadyPairedInCurrentRound = currentRound.matches.some(match =>
        ((match.player1Id === player1Id || match.player2Id === player1Id) && match.player2Id !== null && !match.result) || // player1 has pending match
        ((match.player1Id === player2Id || match.player2Id === player2Id) && match.player2Id !== null && !match.result) || // player2 has pending match
        (match.player1Id === player1Id && match.player2Id === player2Id) || // direct match found
        (match.player1Id === player2Id && match.player2Id === player1Id)    // reverse match found
    );


    if (alreadyPairedInCurrentRound) {
        showMessage('One or both players are already involved in an unrecorded match in this round, or are already paired.', 'error');
        return;
    }

    // Determine board number for manual pairing (should be highest existing + 1 or 1 if no matches yet)
    let nextBoardNumber = 1;
    if (currentRound.matches.length > 0) {
        const maxBoard = Math.max(...currentRound.matches.map(m => m.boardNumber || 0));
        nextBoardNumber = maxBoard + 1;
    }


    currentRound.matches.push({
        id: generateUUID(),
        player1Id: player1Id,
        player2Id: player2Id,
        result: null,
        winnerId: null,
        startTime: new Date().toISOString(),
        endTime: null,
        player1Played: false,
        player2Played: false,
        boardNumber: nextBoardNumber // Assign board number
    });

    tournament.lastUpdated = new Date().toISOString();
    updateTournamentInLocalStorage(tournament);
    showMessage(`Manual pair added: ${player1.name} vs ${player2.name} on Board #${nextBoardNumber}`, 'info');

    // Re-render manual pairing controls to update available players
    renderManualPairingControls(tournament);
    renderMatchesToRecord(tournament); // Re-render matches to record
}

/**
 * Renders the matches that need results recorded in the admin panel.
 * @param {Object} tournament - The tournament object.
 */
function renderMatchesToRecord(tournament) {
    const matchesToRecordDiv = document.getElementById('matches-to-record');
    const noMatchesMessage = document.getElementById('no-matches-to-record');

    // Robust check for element existence
    if (!matchesToRecordDiv || !noMatchesMessage) {
        // Log a warning instead of error, as it might be an expected state during page transitions or initial load
        console.warn("renderMatchesToRecord: One or both required DOM elements (matches-to-record, no-matches-message) not found. Skipping render.");
        return; // Exit the function gracefully if elements are missing
    }

    matchesToRecordDiv.innerHTML = ''; // Clear previous matches

    const currentRound = tournament.rounds[tournament.rounds.length - 1];

    if (!currentRound || currentRound.matches.length === 0) {
        noMatchesMessage.classList.remove('visually-hidden');
        noMatchesMessage.textContent = 'No matches generated for the current round yet.';
        return;
    } else {
        noMatchesMessage.classList.add('visually-hidden');
    }

    // Filter and sort matches by board number
    const matchesPendingResult = [...currentRound.matches]
        .filter(m => !m.result && m.player2Id !== null) // Exclude BYE matches and already recorded
        .sort((a, b) => a.boardNumber - b.boardNumber); // Sort by board number

    if (matchesPendingResult.length === 0) {
        matchesToRecordDiv.innerHTML = '<p class="text-gray-400 italic">All matches for this round have been recorded.</p>';
        return;
    }

    matchesPendingResult.forEach(match => {
        const player1 = tournament.players.find(p => p.id === match.player1Id);
        const player2 = tournament.players.find(p => p.id === match.player2Id);

        const matchDiv = document.createElement('div');
        matchDiv.className = 'pairing-item';
        matchDiv.setAttribute('data-match-id', match.id);
        matchDiv.innerHTML = `
            <div class="board-number">Board #${match.boardNumber}</div>
            <div class="players" aria-label="Players for match on board ${match.boardNumber}">
                <span>${player1 ? escapeHTML(player1.name) : 'N/A'}</span>
                <span>vs</span>
                <span>${player2 ? escapeHTML(player2.name) : 'N/A'}</span>
            </div>
            <div class="result-control">
                <label for="admin-result-select-${match.id}" class="visually-hidden">Select result for match on board ${match.boardNumber}</label>
                <select id="admin-result-select-${match.id}" class="neumorphic-select" aria-required="true">
                    <option value="">Select Result</option>
                    <option value="${match.player1Id}">${player1 ? escapeHTML(player1.name) : 'N/A'} Wins</option>
                    <option value="${match.player2Id}">${player2 ? escapeHTML(player2.name) : 'N/A'} Wins</option>
                    <option value="draw">Draw</option>
                </select>
                <button class="neumorphic-button px-3 py-1 text-sm font-semibold text-blue-300 hover:text-blue-100 admin-record-result-btn" data-match-id="${match.id}" aria-label="Record result for board ${match.boardNumber}">Record</button>
            </div>
        `;
        matchesToRecordDiv.appendChild(matchDiv);
    });


    matchesToRecordDiv.querySelectorAll('.admin-record-result-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const matchId = e.target.dataset.matchId;
            const resultSelect = document.getElementById(`admin-result-select-${matchId}`);
            // Check if resultSelect exists before using its value
            if (!resultSelect) {
                console.error("Result select element not found for match:", matchId);
                showMessage('Error: Result input missing. Please refresh.', 'error');
                return;
            }
            const selectedValue = resultSelect.value;

            if (!selectedValue) {
                showMessage('Please select a result!', 'error');
                return;
            }

            // Find the match and update its result
            const roundIndex = tournament.rounds.findIndex(r => r.matches.some(m => m.id === matchId));
            if (roundIndex === -1) { showMessage('Match not found!', 'error'); return; }

            const match = tournament.rounds[roundIndex].matches.find(m => m.id === matchId);
            if (!match) { showMessage('Match not found!', 'error'); return; }

            // Call the shared recordMatchResult function
            recordMatchResult(tournament, matchId);
        });
    });
}

/**
 * Renders the Cup mode flowchart.
 * @param {Object} tournament - The tournament object.
 */
function renderCupFlowchart(tournament) {
    const flowchartDiv = document.getElementById('cup-flowchart');
    if (tournament.mode !== 'cup') {
        flowchartDiv.innerHTML = '<p class="text-gray-400 italic text-center">This tournament is not in Cup mode.</p>';
        return;
    }
    const cupFlowchartSection = document.getElementById('cup-flowchart-section');
    if (cupFlowchartSection) { // Ensure section element exists before trying to modify it
        cupFlowchartSection.classList.remove('visually-hidden');
    } else {
        console.warn("Cup flowchart section element not found. Cannot unhide.");
    }


    if (tournament.players.length === 0) {
        flowchartDiv.innerHTML = '<p class="text-gray-400 italic text-center">Add players to visualize the cup mode flowchart.</p>';
        return;
    }

    flowchartDiv.innerHTML = ''; // Clear previous content

    const cupRoundContainer = document.createElement('div');
    cupRoundContainer.className = 'cup-round-container';
    flowchartDiv.appendChild(cupRoundContainer);

    let allPlayersMap = new Map(tournament.players.map(p => [p.id, p]));

    // Determine the players for the "initial" state before any rounds are played
    let initialPlayersForFlowchart = [...tournament.players].filter(p => !p.eliminated);
    initialPlayersForFlowchart.sort((a, b) => a.name.localeCompare(b.name)); // Consistent order

    // Display initial players if no rounds exist yet, or display the progression
    if (tournament.rounds.length === 0 && initialPlayersForFlowchart.length > 0) {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'cup-round';
        roundDiv.innerHTML = `<h4 class="text-xl font-semibold mb-3 text-gray-200">Starting Players</h4>`;
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'matches-container';

        initialPlayersForFlowchart.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'cup-match cup-player-node'; // Add a class for player-only nodes
            playerDiv.innerHTML = `<div class="cup-match-players"><div>${escapeHTML(player.name)}</div></div>`;
            matchesContainer.appendChild(playerDiv);
        });
        roundDiv.appendChild(matchesContainer);
        cupRoundContainer.appendChild(roundDiv);
    }

    // Render each round
    tournament.rounds.forEach((round, roundIndex) => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'cup-round';
        roundDiv.innerHTML = `<h4 class="text-xl font-semibold mb-3 text-gray-200">Round ${round.roundNumber}</h4>`;
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'matches-container';

        // Sort matches by board number for consistent display
        const sortedRoundMatches = [...round.matches].sort((a, b) => a.boardNumber - b.boardNumber);

        sortedRoundMatches.forEach(match => {
            const player1 = allPlayersMap.get(match.player1Id);
            const player2 = allPlayersMap.get(match.player2Id);

            const matchDiv = document.createElement('div');
            // Add 'winner-declared' class if a winner exists for the match
            let winnerClass = '';
            if (match.winnerId) {
                winnerClass = 'winner-declared';
            } else if (match.player2Id === null && match.result && match.result.includes('(BYE)')) {
                // For BYE matches that are implicitly wins
                winnerClass = 'winner-declared';
            }

            matchDiv.className = `cup-match ${winnerClass}`;
            matchDiv.innerHTML = `
                <div class="cup-match-players">
                    <div>${player1 ? escapeHTML(player1.name) : 'BYE'}</div>
                    <div>vs</div>
                    <div>${player2 ? escapeHTML(player2.name) : 'BYE'}</div>
                </div>
                ${match.result ? `<div class="cup-match-score">${match.result === 'draw' ? 'Draw' : (match.winnerId ? `${allPlayersMap.get(match.winnerId)?.name || 'Winner'} wins` : '')}</div>` : ''}
            `;
            matchesContainer.appendChild(matchDiv);
        });
        roundDiv.appendChild(matchesContainer);
        cupRoundContainer.appendChild(roundDiv);
    });

    // Simple textual "winner" display if completed and there's a winner
    if (tournament.status === 'completed') {
        const remainingActivePlayers = tournament.players.filter(p => !p.eliminated);
        if (remainingActivePlayers.length === 1) {
            const winner = remainingActivePlayers[0];
            const winnerDiv = document.createElement('div');
            winnerDiv.className = 'cup-round ml-10';
            winnerDiv.innerHTML = `
                <h4 class="text-xl font-semibold mb-3 text-gray-200">Tournament Winner</h4>
                <div class="neumorphic-card p-4 rounded-lg text-center font-bold text-green-400 text-2xl">
                    ${escapeHTML(winner.name)}
                </div>
            `;
            cupRoundContainer.appendChild(winnerDiv);
        } else {
             // If cup mode ended but no single winner (e.g., all eliminated via draws, or edge case)
             const winnerDiv = document.createElement('div');
             winnerDiv.className = 'cup-round ml-10';
             winnerDiv.innerHTML = `
                 <h4 class="text-xl font-semibold mb-3 text-gray-200">Tournament Ended</h4>
                 <div class="neumorphic-card p-4 rounded-lg text-center font-bold text-yellow-400 text-xl">
                     See Leaderboard for Final Standings
                 </div>
             `;
             cupRoundContainer.appendChild(winnerDiv);
        }
    }

    // Scroll to the right to see latest rounds
    flowchartDiv.scrollLeft = flowchartDiv.scrollWidth;
}


// --- Celebration Animation and Sound ---

/**
 * Shows the celebration overlay and plays sound.
 */
function showCelebrationOverlay() {
    const overlay = document.getElementById('celebration-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.focus(); // Focus on the overlay for accessibility
        playCelebrationSound();
        generateConfetti();
    }
}

/**
 * Hides the celebration overlay and stops sound.
 */
function hideCelebrationOverlay() {
    const overlay = document.getElementById('celebration-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
    stopCelebrationSound();
    // Clean up confetti elements
    document.querySelectorAll('.confetti').forEach(c => c.remove());
}

/**
 * Plays the celebration sound.
 */
function playCelebrationSound() {
    const audio = document.getElementById('celebration-audio');
    if (audio) {
        audio.play().catch(e => console.error("Error playing sound:", e));
    }
}

/**
 * Stops the celebration sound.
 */
function stopCelebrationSound() {
    const audio = document.getElementById('celebration-audio');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

/**
 * Generates confetti particles for the celebration animation.
 */
function generateConfetti() {
    const confettiColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'];
    const numConfetti = 100;
    const body = document.body;

    for (let i = 0; i < numConfetti; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.top = `${-20 - Math.random() * 100}px`; // Start above screen
        confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
        confetti.style.animationDuration = `${Math.random() * 2 + 3}s`; // 3-5 seconds
        confetti.style.animationDelay = `${Math.random() * 0.5}s`;
        confetti.style.opacity = 1;
        body.appendChild(confetti);

        // Remove confetti after animation to prevent DOM clutter
        confetti.addEventListener('animationend', () => {
            confetti.remove();
        });
    }
}

// --- Helper Functions ---

/**
 * Escapes HTML characters to prevent XSS.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHTML(str) {
    if (typeof str !== 'string') return str; // Return non-strings as-is
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}


// --- Main Execution on DOM Content Loaded ---
// This ensures the correct initialization function is called based on the page.

document.addEventListener('DOMContentLoaded', () => {
    // Determine which page is loaded and call its initialization function
    const path = window.location.pathname;
    if (path.endsWith('index.html') || path === '/' || path === '/MRC-Chess-Tournaments/') { // Added '/' and '/MRC-Chess-Tournaments/' for potential root deployment
        initializeIndexPage();
    } else if (path.endsWith('tournament-detail.html')) {
        initializeTournamentDetail();
    } else if (path.endsWith('admin-panel.html')) {
        initializeAdminPanel();
    }
});
// In script.js, towards the end, after all other functions

// Register Service Worker for offline capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { // This is line 2648 in the original code.
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  }); // Ensure this closing parenthesis matches the opening one for window.addEventListener
}
