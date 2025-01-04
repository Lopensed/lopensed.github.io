// script.js
import utils from './utils.js';

/**
 * Manages the leaderboard functionality
 */
class LeaderboardManager {
    /**
     * Initialize LeaderboardManager
     */
    constructor() {
        this.statsData = null;
        this.currentData = null;
        this.filters = {
            tournament: 'All',
            category: 'player', 
            game: 'All',
            sortBy: 'score_high_to_low'
        };
        this.initializeEventListeners();
    }

    /**
     * Initialize the leaderboard
     */
    async initialize() {
        try {
            await this.loadData();
            this.initializeFilters();
            
            const categorySelect = document.getElementById('categorySelect');
            if (categorySelect) {
                categorySelect.value = this.filters.category;
            }
            
            this.updateLeaderboard();
        } catch (error) {
            utils.dom.showError('Failed to load leaderboard data', 'leaderboard');
        }
    }

    /**
     * Load tournament statistics data
     */
    async loadData() {
        this.statsData = await utils.api.fetchStats();
        if (!this.statsData?.tournaments) {
            throw new Error('Invalid stats data format');
        }
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        const selectors = ['tournament', 'category', 'game', 'sort'].map(type => `${type}Select`);
        selectors.forEach(selector => {
            document.getElementById(selector)?.addEventListener('change', () => this.handleFilterChange());
        });

        document.getElementById('searchInput')?.addEventListener('input', 
            utils.event.debounce(() => this.performSearch(), 300)
        );
    }

    /**
     * Initialize filter dropdowns
     */
    initializeFilters() {
        this.initializeTournamentSelect();
        this.initializeGameSelect(this.filters.tournament);
        const canonToggle = document.getElementById('canonToggle');
        if (canonToggle) {
            canonToggle.addEventListener('change', () => this.handleFilterChange());
        }
    }

    /**
     * Initialize tournament selection dropdown
     */
    initializeTournamentSelect() {
        const select = document.getElementById('tournamentSelect');
        if (!select) return;

        select.innerHTML = '<option value="All">All Tournaments</option>';
        Object.keys(this.statsData.tournaments).forEach(tournament => {
            const option = document.createElement('option');
            option.value = tournament;
            option.textContent = tournament;
            select.appendChild(option);
        });
    }

    /**
     * Initialize game selection dropdown
     * @param {string} tournament Selected tournament
     */
    initializeGameSelect(tournament) {
        const select = document.getElementById('gameSelect');
        if (!select) return;

        select.innerHTML = '<option value="All">All Games</option>';
        
        const games = tournament === 'All' 
            ? Object.keys(this.statsData.tournaments[Object.keys(this.statsData.tournaments)[0]].games)
            : Object.entries(this.statsData.tournaments[tournament].games).map(([game, config]) => ({
                name: game,
                multiplier: config.multiplier
            }));

        games.forEach(game => {
            const option = document.createElement('option');
            option.value = typeof game === 'string' ? game : game.name;
            option.textContent = typeof game === 'string' ? game : `${game.name} (${game.multiplier}x)`;
            select.appendChild(option);
        });
    }

    /**
    * Handle filter change event
    * Updates filter values and refreshes leaderboard
    * @param {Event} e Change event
     */
    handleFilterChange() {
        const prevGame = this.filters.game;
        
        const selectedTournament = document.getElementById('tournamentSelect')?.value || 'All';
        const selectedCategory = document.getElementById('categorySelect')?.value || 'player';
        const selectedGame = document.getElementById('gameSelect')?.value || 'All';
        const selectedSortBy = document.getElementById('sortSelect')?.value || 'score_high_to_low';
        let selectedCanon = document.getElementById('canonToggle')?.value || 'canon';
    
        if (selectedTournament !== 'All') {
            const tournamentData = this.statsData.tournaments[selectedTournament];
            if (tournamentData) {
                selectedCanon = tournamentData.canon ? 'canon' : 'all';
            }
        }
    
        this.filters = {
            tournament: selectedTournament,
            category: selectedCategory,
            game: selectedGame,
            sortBy: selectedSortBy,
            canon: selectedCanon
        };
    
        const gameSelect = document.getElementById('gameSelect');
        if (gameSelect) {
            if (this.filters.tournament === 'All') {
                gameSelect.innerHTML = '<option value="All">All Games</option>';
                const defaultGames = Object.keys(this.statsData.tournaments[Object.keys(this.statsData.tournaments)[0]].games);
                defaultGames.forEach(game => {
                    const option = document.createElement('option');
                    option.value = game;
                    option.textContent = game;
                    gameSelect.appendChild(option);
                });
            } else {
                this.initializeGameSelect(this.filters.tournament);
            }
    
            const options = Array.from(gameSelect.options);
            const matchingOption = options.find(option => option.value === this.filters.game);
            if (matchingOption) {
                matchingOption.selected = true;
            }
        }
    
        this.updateLeaderboard();
    }

    /**
     * Process tournament data based on filters
     * @returns {Array} Processed data
     */
    processData() {
        const tournaments = this.filters.tournament === 'All' 
            ? Object.keys(this.statsData.tournaments) 
            : [this.filters.tournament];
    
        const filteredTournaments = tournaments.filter(tournament => {
            const tournamentData = this.statsData.tournaments[tournament];
            return this.filters.canon === 'all' || tournamentData.canon !== false;
        });
    
        return this.filters.category === 'team' 
            ? this.processTeamData(filteredTournaments)
            : this.processPlayerData(filteredTournaments);
    }

    /**
     * Process team data
     * @param {Array} tournaments Tournament list
     * @returns {Array} Processed team data
     */
    processTeamData(tournaments) {
        return tournaments.flatMap(tournament => {
            const tournamentData = this.statsData.tournaments[tournament];
            return tournamentData.teams.map(team => ({
                name: team.name,
                score: this.filters.game === 'All'
                    ? utils.score.calculateTotalTeamScore(team, tournament, tournamentData.games)
                    : utils.score.calculateTeamGameScore(team, this.filters.game, tournamentData.games[this.filters.game]),
                players: team.players,
                tournament
            }));
        });
    }

    /**
     * Process player data
     * @param {Array} tournaments Tournament list
     * @returns {Array} Processed player data
     */
    processPlayerData(tournaments) {
        const playerMap = new Map();

        tournaments.forEach(tournament => {
            const tournamentData = this.statsData.tournaments[tournament];
            tournamentData.teams.forEach(team => {
                team.players.forEach(player => {
                    const score = this.filters.game === 'All'
                        ? utils.score.calculatePlayerTournamentScore(player, tournament, tournamentData.games)
                        : utils.score.calculatePlayerScore(
                            player.scores[this.filters.game] || [], 
                            tournamentData.games[this.filters.game]?.multiplier || 1
                        );

                    this.updatePlayerMap(playerMap, player, score, tournament);
                });
            });
        });

        return Array.from(playerMap.values());
    }

    /**
     * Update player map with scores
     * @param {Map} playerMap Player data map
     * @param {Object} player Player data
     * @param {number} score Player score
     * @param {string} tournament Tournament name
     */
    updatePlayerMap(playerMap, player, score, tournament) {
        const playerNames = Array.isArray(player.name) ? player.name : [player.name];
        playerNames.forEach(name => {
            if (playerMap.has(name)) {
                const playerData = playerMap.get(name);
                playerData.score += score;
                if (!playerData.tournaments.includes(tournament)) {
                    playerData.tournaments.push(tournament);
                }
            } else {
                playerMap.set(name, {
                    name,
                    score,
                    tournaments: [tournament]
                });
            }
        });
    }

    /**
     * Sort leaderboard data
     * @param {Array} data Data to sort
     * @returns {Array} Sorted data
     */
    sortLeaderboard(data) {
        const sortFunctions = {
            score_high_to_low: (a, b) => b.score - a.score,
            score_low_to_high: (a, b) => a.score - b.score,
            alphabetical: (a, b) => a.name.localeCompare(b.name)
        };

        return [...data].sort(sortFunctions[this.filters.sortBy] || sortFunctions.score_high_to_low);
    }

    /**
     * Perform search on current data
     */
    performSearch() {
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        if (!this.currentData) return;

        const searchResults = this.currentData
            .map((item, index) => ({ ...item, originalRank: index + 1 }))
            .filter(item => {
                const names = Array.isArray(item.name) ? item.name : [item.name];
                return names.some(n => n.toLowerCase().includes(searchTerm));
            });

        this.displayLeaderboard(searchResults, true);
    }

    /**
     * Update leaderboard display
     */
    updateLeaderboard() {
        this.currentData = this.processData();
        this.currentData = this.sortLeaderboard(this.currentData);
        this.displayLeaderboard(this.currentData);
    }


    /**
     * Display leaderboard data
     * Renders leaderboard content with title, data table, and manages expandable sections
     * @param {Array} data Array of leaderboard entries to display
     * @param {boolean} isSearchResult Whether displaying search results
     */
    displayLeaderboard(data, isSearchResult = false) {
        const container = document.getElementById('leaderboard');
        if (!container) return;

        let title = `${this.filters.category.charAt(0).toUpperCase() + this.filters.category.slice(1)} Leaderboard`;
        
        if (this.filters.tournament !== 'All' && this.filters.game !== 'All') {
            const gameConfig = this.statsData.tournaments[this.filters.tournament].games[this.filters.game];
            title += ` - ${this.filters.game} - ${gameConfig.multiplier}x`;
        } else if (this.filters.game !== 'All') {
            title += ` - ${this.filters.game}`;
        }
        
        container.innerHTML = `
            <h2>${title}</h2>
            ${this.createLeaderboardTable(data, isSearchResult)}
        `;

        this.initializeExpandableSections();
    }
    
    /**
     * Create leaderboard table
     * @param {Array} data Table data
     * @param {boolean} isSearchResult Whether displaying search results
     * @returns {string} Table HTML
     */
    createLeaderboardTable(data, isSearchResult) {
        const headers = ['Rank', 'Name', 'Score', 'Tournaments'];
        const rows = data.map((item, index) => {
            const rank = isSearchResult ? item.originalRank : index + 1;
            return this.filters.category === 'team' 
                ? this.createTeamRow(item, rank)
                : this.createPlayerRow(item, rank);
        });

        return utils.dom.createTable(headers, rows).outerHTML;
    }

    /**
     * Create team row data
     * @param {Object} team Team data
     * @param {number} rank Team rank
     * @returns {Array} Row data
     */
    createTeamRow(team, rank) {
        return [
            rank,
            this.createTeamNameCell(team),
            utils.format.formatNumber(team.score),
            `<a href="tournaments.html?tournament=${encodeURIComponent(team.tournament)}">${team.tournament}</a>`
        ];
    }

    /**
     * Create player row data
     * @param {Object} player Player data
     * @param {number} rank Player rank
     * @returns {Array} Row data
     */
    createPlayerRow(player, rank) {
        return [
            rank,
            utils.format.createPlayerLink(player.name),
            utils.format.formatNumber(player.score),
            player.tournaments.map(t => 
                `<a href="tournaments.html?tournament=${encodeURIComponent(t)}">${t}</a>`
            ).join(', ')
        ];
    }

    /**
     * Create team name cell content
     * @param {Object} team Team data
     * @returns {string} Cell HTML
     */
    createTeamNameCell(team) {
        return `
            <span class="team-name" data-team="${team.name}" data-tournament="${team.tournament}">
                ${team.name}
            </span>
            <a href="team-stats.html?team=${encodeURIComponent(team.name)}" class="team-page-link">(Team Page)</a>
            <div id="team-${this.sanitizeId(team.name)}-${this.sanitizeId(team.tournament)}" class="player-list">
                ${this.createPlayerListTable(team)}
            </div>
        `;
    }

    /**
     * Create player list table
     * @param {Object} team Team data
     * @returns {string} Table HTML
     */
    createPlayerListTable(team) {
        const headers = ['Player', 'Score'];
        const rows = team.players.map(player => [
            utils.format.createPlayerLink(player.name),
            utils.format.formatNumber(
                this.filters.game === 'All'
                    ? utils.score.calculatePlayerTournamentScore(player, team.tournament, this.statsData.tournaments[team.tournament].games)
                    : utils.score.calculatePlayerScore(
                        player.scores[this.filters.game] || [],
                        this.statsData.tournaments[team.tournament].games[this.filters.game]?.multiplier
                    )
            )
        ]);

        return utils.dom.createTable(headers, rows).outerHTML;
    }
    
    /**
     * Initialize expandable sections
     */
    initializeExpandableSections() {
        document.querySelectorAll('.team-name').forEach(teamName => {
            teamName.addEventListener('click', (e) => {
                const team = e.target.dataset.team;
                const tournament = e.target.dataset.tournament;
                if (team && tournament) {
                    this.togglePlayers(team, tournament);
                }
            });
        });
    }

    /**
     * Toggle player list visibility
     * @param {string} teamName Team name
     * @param {string} tournament Tournament name
     */
    togglePlayers(teamName, tournament) {
        const playerList = document.getElementById(
            `team-${this.sanitizeId(teamName)}-${this.sanitizeId(tournament)}`
        );
        if (playerList) {
            playerList.classList.toggle('show');
        }
    }

    /**
     * Sanitize string for use in ID
     * @param {string} str String to sanitize
     * @returns {string} Sanitized string
     */
    sanitizeId(str) {
        return str.replace(/[^a-z0-9]/gi, '');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    utils.theme.initialize();
    document.getElementById('modeToggle')?.addEventListener('click', () => utils.theme.toggle());
    
    const leaderboardManager = new LeaderboardManager();
    leaderboardManager.initialize();
});

export default LeaderboardManager;