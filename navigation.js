// navigation.js
import utils from './utils.js';

/**
 * Manages navigation and search functionality
 */
class NavigationManager {
    /**
     * Initialize NavigationManager
     */
    constructor() {
        this.statsData = null;
        this.searchState = {
            debounceTimer: null,
            currentResults: [],
            searchTypes: ['Tournament', 'Team', 'Player']
        };
    }

    /**
     * Initialize navigation
     */
    async initialize() {
        try {
            await this.loadData();
            this.initializeNavigation();
            this.setupEventListeners();
        } catch (error) {
            utils.dom.showError('Failed to load navigation data', 'search-results');
        }
    }

    /**
     * Load tournament data
     */
    async loadData() {
        this.statsData = await utils.api.fetchStats();
        if (!this.statsData?.tournaments) {
            throw new Error('Invalid stats data format');
        }
    }

    /**
     * Initialize navigation elements
     */
    initializeNavigation() {
        this.displayTournamentLinks();
        this.initializeSearch();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', 
                utils.event.debounce(() => this.performSearch(), 300)
            );
        }
    }

    /**
     * Display tournament links
     */
    displayTournamentLinks() {
        const container = document.getElementById('tournament-links');
        if (!container || !this.statsData) return;

        const tournaments = Object.keys(this.statsData.tournaments);
        container.innerHTML = `
            <div class="tournament-nav">
                ${tournaments.map(tournament => this.createTournamentLink(tournament)).join('')}
            </div>
        `;
    }

    /**
     * Create tournament link
     * @param {string} tournament Tournament name
     * @returns {string} HTML content
     */
    createTournamentLink(tournament) {
        const tournamentData = this.statsData.tournaments[tournament];
        const stats = {
            teamCount: tournamentData.teams.length,
            playerCount: this.countUniquePlayers(tournamentData.teams),
            gameCount: Object.keys(tournamentData.games).length
        };

        return `
            <a href="tournaments.html?tournament=${encodeURIComponent(tournament)}" 
               class="tournament-nav-item">
                <h3>${tournament}</h3>
                <div class="tournament-stats">
                    <p>${stats.teamCount} Teams</p>
                    <p>${stats.playerCount} Players</p>
                    <p>${stats.gameCount} Games</p>
                </div>
            </a>
        `;
    }

    /**
     * Count unique players in teams
     * @param {Array} teams Array of teams
     * @returns {number} Number of unique players
     */
    countUniquePlayers(teams) {
        const uniquePlayers = new Set();
        teams.forEach(team => {
            team.players.forEach(player => {
                if (Array.isArray(player.name)) {
                    player.name.forEach(name => uniquePlayers.add(name));
                } else {
                    uniquePlayers.add(player.name);
                }
            });
        });
        return uniquePlayers.size;
    }

    /**
     * Initialize search functionality
     */
    initializeSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.setAttribute('aria-label', 'Search players, teams, or tournaments');
            searchInput.setAttribute('aria-controls', 'search-results');
        }
    }

    /**
     * Perform search
     */
    performSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput?.value.toLowerCase().trim() || '';
        const resultsContainer = document.getElementById('search-results');

        if (!resultsContainer) return;

        if (searchTerm.length < 2) {
            resultsContainer.innerHTML = '';
            return;
        }

        this.searchState.currentResults = this.searchEntities(searchTerm);
        this.displaySearchResults();
    }

    /**
     * Search entities across tournaments
     * @param {string} searchTerm Search term
     * @returns {Array} Search results
     */
    searchEntities(searchTerm) {
        const results = [];
        const playerMap = new Map();

        Object.entries(this.statsData.tournaments).forEach(([tournamentName, tournament]) => {
            this.searchTournament(tournamentName, tournament, searchTerm, results, playerMap);
        });

        this.addCombinedPlayerResults(playerMap, results);
        return this.sortSearchResults(results);
    }

    /**
     * Search within a tournament
     * @param {string} tournamentName Tournament name
     * @param {Object} tournament Tournament data
     * @param {string} searchTerm Search term
     * @param {Array} results Results array
     * @param {Map} playerMap Player map for combining results
     */
    searchTournament(tournamentName, tournament, searchTerm, results, playerMap) {
        if (tournamentName.toLowerCase().includes(searchTerm)) {
            results.push({
                type: 'Tournament',
                name: tournamentName,
                data: {
                    teams: tournament.teams.length,
                    games: Object.keys(tournament.games).length
                }
            });
        }

        tournament.teams.forEach(team => {
            this.searchTeamAndPlayers(team, tournamentName, searchTerm, results, playerMap);
        });
    }

    /**
     * Search team and its players
     * @param {Object} team Team data
     * @param {string} tournament Tournament name
     * @param {string} searchTerm Search term
     * @param {Array} results Results array
     * @param {Map} playerMap Player map
     */
    searchTeamAndPlayers(team, tournament, searchTerm, results, playerMap) {
        if (team.name.toLowerCase().includes(searchTerm)) {
            results.push({
                type: 'Team',
                name: team.name,
                data: {
                    tournament,
                    playerCount: team.players.length
                }
            });
        }

        team.players.forEach(player => {
            const playerNames = Array.isArray(player.name) ? player.name : [player.name];
            playerNames.forEach(name => {
                if (name.toLowerCase().includes(searchTerm)) {
                    this.updatePlayerSearchData(name, tournament, player, playerMap);
                }
            });
        });
    }

    /**
     * Update player search data
     * @param {string} name Player name
     * @param {string} tournament Tournament name
     * @param {Object} player Player data
     * @param {Map} playerMap Player map
     */
    updatePlayerSearchData(name, tournament, player, playerMap) {
        if (playerMap.has(name)) {
            const data = playerMap.get(name);
            if (!data.tournaments.includes(tournament)) {
                data.tournaments.push(tournament);
            }
        } else {
            playerMap.set(name, {
                tournaments: [tournament],
                totalGames: this.countPlayerGames(player)
            });
        }
    }

    /**
     * Count total games played by player
     * @param {Object} player Player data
     * @returns {number} Total games played
     */
    countPlayerGames(player) {
        return Object.values(player.scores).reduce((total, scores) => 
            total + (scores ? scores.length : 0), 0);
    }

    /**
     * Add combined player results to results array
     * @param {Map} playerMap Player map
     * @param {Array} results Results array
     */
    addCombinedPlayerResults(playerMap, results) {
        playerMap.forEach((data, name) => {
            results.push({
                type: 'Player',
                name: name,
                data: data
            });
        });
    }

    /**
     * Sort search results
     * @param {Array} results Results to sort
     * @returns {Array} Sorted results
     */
    sortSearchResults(results) {
        const typeOrder = { Tournament: 1, Team: 2, Player: 3 };
        return results.sort((a, b) => {
            if (typeOrder[a.type] !== typeOrder[b.type]) {
                return typeOrder[a.type] - typeOrder[b.type];
            }
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * Display search results
     */
    displaySearchResults() {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;

        if (this.searchState.currentResults.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No results found</p>';
            return;
        }

        const resultsByType = this.groupResultsByType();
        resultsContainer.innerHTML = this.createResultsHTML(resultsByType);
    }

    /**
     * Group results by type
     * @returns {Object} Grouped results
     */
    groupResultsByType() {
        return this.searchState.currentResults.reduce((grouped, result) => {
            if (!grouped[result.type]) {
                grouped[result.type] = [];
            }
            grouped[result.type].push(result);
            return grouped;
        }, {});
    }

    /**
     * Create results HTML
     * @param {Object} resultsByType Grouped results
     * @returns {string} HTML content
     */
    createResultsHTML(resultsByType) {
        return Object.entries(resultsByType).map(([type, results]) => `
            <div class="search-results-section">
                <h3>${type}s</h3>
                <div class="results-grid">
                    ${results.map(result => this.createResultCard(result)).join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * Create result card
     * @param {Object} result Search result
     * @returns {string} HTML content
     */
    createResultCard(result) {
        switch (result.type) {
            case 'Tournament': return this.createTournamentCard(result);
            case 'Team': return this.createTeamCard(result);
            case 'Player': return this.createPlayerCard(result);
            default: return '';
        }
    }

    /**
     * Create tournament card
     * @param {Object} result Tournament result
     * @returns {string} HTML content
     */
    createTournamentCard(result) {
        return `
            <a href="tournaments.html?tournament=${encodeURIComponent(result.name)}" 
               class="result-card">
                <h4>${result.name}</h4>
                <p>${result.data.teams} Teams | ${result.data.games} Games</p>
            </a>
        `;
    }

    /**
     * Create team card
     * @param {Object} result Team result
     * @returns {string} HTML content
     */
    createTeamCard(result) {
        return `
            <a href="team-stats.html?team=${encodeURIComponent(result.name)}" 
               class="result-card">
                <h4>${result.name}</h4>
                <p>Tournament: ${result.data.tournament}</p>
                <p>${result.data.playerCount} Players</p>
            </a>
        `;
    }

    /**
     * Create player card
     * @param {Object} result Player result
     * @returns {string} HTML content
     */
    createPlayerCard(result) {
        return `
            <a href="player-stats.html?player=${encodeURIComponent(result.name)}" 
               class="result-card">
                <h4>${result.name}</h4>
                <p>${result.data.tournaments.length} Tournaments</p>
                <p>${result.data.totalGames} Games Played</p>
            </a>
        `;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    utils.theme.initialize();
    document.getElementById('modeToggle')?.addEventListener('click', () => utils.theme.toggle());
    const navigation = new NavigationManager();
    navigation.initialize();
});

export default NavigationManager;