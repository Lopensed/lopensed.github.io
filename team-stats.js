// team-stats.js
import utils from './utils.js';

/**
 * Manages team statistics display and calculations
 */
class TeamStatsManager {
    /**
     * Initialize TeamStatsManager
     */
    constructor() {
        this.statsData = null;
        this.teamName = '';
        this.teamStats = {
            tournaments: [],
            overall: {
                totalScore: 0,
                gamesPlayed: 0,
                wins: 0,
                playerCount: 0
            },
            gameStats: new Map(),
            playerStats: new Map()
        };
    }

    /**
     * Initialize team statistics
     */
    async initialize() {
        try {
            await this.loadData();
            await this.processTeamStats();
            this.render();
        } catch (error) {
            utils.dom.showError('Failed to load team statistics', 'teamStats');
        }
    }

    /**
     * Load team data
     */
    async loadData() {
        this.statsData = await utils.api.fetchStats();
        this.teamName = utils.url.getParam('team');

        if (!this.teamName) {
            throw new Error('No team selected');
        }

        if (!this.validateTeamExists()) {
            throw new Error(`Team not found: ${this.teamName}`);
        }
    }

    /**
     * Validate team exists in data
     * @returns {boolean} Whether team exists
     */
    validateTeamExists() {
        return Object.values(this.statsData.tournaments).some(tournament =>
            tournament.teams.some(team => team.name === this.teamName)
        );
    }

    /**
     * Process team statistics
     */
    processTeamStats() {
        Object.entries(this.statsData.tournaments).forEach(([tournamentName, tournament]) => {
            const team = tournament.teams.find(t => t.name === this.teamName);
            if (team) {
                this.processTeamTournament(team, tournamentName, tournament);
            }
        });

        this.calculateOverallStats();
    }

    /**
     * Process team's tournament performance
     * @param {Object} team Team data
     * @param {string} tournamentName Tournament name
     * @param {Object} tournament Tournament data
     */
    processTeamTournament(team, tournamentName, tournament) {
        const tournamentStats = {
            name: tournamentName,
            isWinner: team.name === tournament.winners,
            games: {},
            players: [],
            total: 0,
            position: this.calculateTournamentPosition(team, tournament),
            canon: tournament.canon !== false 
        };
    
        this.processTeamGames(team, tournament, tournamentStats);
        this.processTeamPlayers(team, tournament, tournamentStats);
        this.teamStats.tournaments.push(tournamentStats);
    }
    

    /**
     * Process team's game performances
     * @param {Object} team Team data
     * @param {Object} tournament Tournament data
     * @param {Object} tournamentStats Tournament statistics object
     */
    processTeamGames(team, tournament, tournamentStats) {
        Object.entries(tournament.games).forEach(([game, config]) => {
            const gameStats = this.processGameStats(team, game, config);
            tournamentStats.games[game] = gameStats;
            tournamentStats.total += gameStats.score;
            
            if (tournament.canon !== false) {
                this.updateGameStats(game, gameStats);
            }
        });
    }

    /**
     * Process game statistics
     * @param {Object} team Team data
     * @param {string} game Game name
     * @param {Object} gameConfig Game configuration
     * @returns {Object} Game statistics
     */
    processGameStats(team, game, gameConfig) {
        const playerScores = team.players.flatMap(player => 
            player.scores[game] || []);
        
        return {
            score: utils.score.calculateTeamGameScore(team, game, gameConfig),
            playerScores: playerScores,
            average: utils.score.calculateAverageScore(playerScores),
            multiplier: gameConfig.multiplier,
            order: gameConfig.order
        };
    }

    /**
     * Update overall game statistics
     * @param {string} game Game name
     * @param {Object} stats Game statistics
     */
    updateGameStats(game, stats) {
        if (!this.teamStats.gameStats.has(game)) {
            this.teamStats.gameStats.set(game, {
                totalScore: 0,
                appearances: 0,
                average: 0,
                highestScore: 0,
                lowestScore: Infinity
            });
        }

        const gameStats = this.teamStats.gameStats.get(game);
        gameStats.totalScore += stats.score;
        gameStats.appearances++;
        gameStats.average = gameStats.totalScore / gameStats.appearances;
        gameStats.highestScore = Math.max(gameStats.highestScore, stats.score);
        gameStats.lowestScore = Math.min(gameStats.lowestScore, stats.score);
    }

    /**
     * Process team players' performances
     * @param {Object} team Team data
     * @param {Object} tournament Tournament data
     * @param {Object} tournamentStats Tournament statistics object
     */
    processTeamPlayers(team, tournament, tournamentStats) {
        team.players.forEach(player => {
            const playerStats = this.processPlayerStats(player, tournament);
            tournamentStats.players.push(playerStats);
            this.updatePlayerStats(player, playerStats);
        });
    }

    /**
     * Process individual player statistics
     * @param {Object} player Player data
     * @param {Object} tournament Tournament data
     * @returns {Object} Player statistics
     */
    processPlayerStats(player, tournament) {
        const stats = {
            name: player.name,
            scores: {},
            total: 0
        };
    
        if (tournament.canon === false) return stats;
    
        Object.entries(tournament.games).forEach(([game, config]) => {
            if (player.scores[game]) {
                const score = utils.score.calculatePlayerScore(
                    player.scores[game], 
                    config.multiplier
                );
                stats.scores[game] = {
                    raw: player.scores[game],
                    multiplied: score
                };
                stats.total += score;
            }
        });
    
        return stats;
    }

    /**
     * Update player statistics
     * @param {Object} player Player data
     * @param {Object} stats Player statistics
     */
    updatePlayerStats(player, stats) {
        const playerNames = Array.isArray(player.name) ? player.name : [player.name];
        
        playerNames.forEach(name => {
            if (!this.teamStats.playerStats.has(name)) {
                this.teamStats.playerStats.set(name, {
                    totalScore: 0,
                    appearances: 0,
                    average: 0,
                    canonAppearances: 0 
                });
            }
    
            const playerStats = this.teamStats.playerStats.get(name);
            playerStats.totalScore += stats.total;
            if (stats.total > 0) {
                playerStats.appearances++;
                playerStats.average = playerStats.totalScore / playerStats.appearances;
            }
        });
    }

    /**
     * Calculate team's tournament position
     * @param {Object} team Team data
     * @param {Object} tournament Tournament data
     * @returns {number} Tournament position
     */
    calculateTournamentPosition(team, tournament) {
        const scores = tournament.teams.map(t => ({
            name: t.name,
            score: utils.score.calculateTotalTeamScore(t, tournament.name, tournament.games)
        }));
        
        scores.sort((a, b) => b.score - a.score);
        return scores.findIndex(t => t.name === team.name) + 1;
    }

    /**
     * Calculate overall team statistics
     */
    calculateOverallStats() {
        const stats = this.teamStats.overall;
        const canonTournaments = this.teamStats.tournaments.filter(t => t.canon);
    
        stats.wins = canonTournaments.filter(t => t.isWinner).length;
        stats.totalScore = canonTournaments.reduce((total, t) => total + t.total, 0);
        stats.gamesPlayed = Array.from(this.teamStats.gameStats.values())
            .reduce((total, game) => total + game.appearances, 0);
        stats.playerCount = this.teamStats.playerStats.size;
        stats.averageScore = stats.totalScore / stats.gamesPlayed;
    }

    /**
     * Render team statistics
     */
    render() {
        const container = document.getElementById('teamStats');
        if (!container) return;

        container.innerHTML = `
            ${this.renderTeamHeader()}
            ${this.renderOverallStats()}
            ${this.renderGamePerformance()}
            ${this.renderPlayerContributions()}
            ${this.renderTournamentHistory()}
        `;
    }

    /**
     * Render team header
     * @returns {string} HTML content
     */
    renderTeamHeader() {
        return `
            <div class="team-header">
                <h2>${this.teamName}</h2>
                <div class="team-summary">
                    <div class="summary-stats">
                        ${this.createSummaryStats()}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create summary statistics
     * @returns {string} HTML content
     */
    createSummaryStats() {
        const stats = [
            { label: 'Tournament Wins', value: this.teamStats.overall.wins },
            { label: 'Tournaments Played', value: this.teamStats.tournaments.length },
            { label: 'Total Score', value: utils.format.formatNumber(this.teamStats.overall.totalScore) }
        ];

        return stats.map(stat => `
            <div class="stat-item">
                <span class="stat-value">${stat.value}</span>
                <span class="stat-label">${stat.label}</span>
            </div>
        `).join('');
    }

    /**
     * Render overall statistics
     * @returns {string} HTML content
     */
    renderOverallStats() {
        const stats = this.teamStats.overall;
        const statCards = [
            { value: stats.totalScore, label: 'Total Score' },
            { value: stats.wins, label: 'Tournament Wins' },
            { value: stats.totalScore / stats.gamesPlayed, label: 'Average Score per Game' },
            { value: stats.gamesPlayed, label: 'Games Played' }
        ];

        return `
            <section class="team-overall-stats">
                <h3>Overall Performance</h3>
                <div class="stats-grid">
                    ${statCards.map(stat => `
                        <div class="stat-card">
                            <div class="stat-value">${utils.format.formatNumber(stat.value)}</div>
                            <div class="stat-label">${stat.label}</div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }

    /**
     * Render game performance
     * @returns {string} HTML content
     */
    renderGamePerformance() {
        return `
            <section class="game-performance">
                <h3>Game Performance</h3>
                <div class="game-stats-grid">
                    ${Array.from(this.teamStats.gameStats.entries())
                        .map(([game, stats]) => this.createGameCard(game, stats))
                        .join('')}
                </div>
            </section>
        `;
    }

    /**
     * Create game statistics card
     * @param {string} game Game name
     * @param {Object} stats Game statistics
     * @returns {string} HTML content
     */
    createGameCard(game, stats) {
        const statRows = [
            { label: 'Average Score', value: stats.average },
            { label: 'Highest Score', value: stats.highestScore },
            { label: 'Times Played', value: stats.appearances }
        ];

        return `
            <div class="game-stat-card">
                <div class="game-stat-header">
                    <h4>${game}</h4>
                </div>
                <div class="game-stat-content">
                    ${statRows.map(row => `
                        <div class="stat-row">
                            <span class="label">${row.label}</span>
                            <span class="value">${utils.format.formatNumber(row.value)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render player contributions
     * @returns {string} HTML content
     */
    renderPlayerContributions() {
        return `
            <section class="player-contributions">
                <h3>Player Contributions</h3>
                ${this.createPlayerContributionsTable()}
            </section>
        `;
    }

    /**
     * Create player contributions table
     * @returns {string} HTML content
     */
    createPlayerContributionsTable() {
        const headers = ['Player', 'Tournaments', 'Total Score', 'Average Score'];
        const rows = Array.from(this.teamStats.playerStats.entries())
            .filter(([_, stats]) => stats.appearances > 0) // Only show players with appearances
            .map(([player, stats]) => [
                utils.format.createPlayerLink(player),
                stats.appearances,
                utils.format.formatNumber(stats.totalScore),
                utils.format.formatNumber(stats.average)
            ])
            .sort((a, b) => parseFloat(b[2].replace(/,/g, '')) - parseFloat(a[2].replace(/,/g, '')));
    
        return utils.dom.createTable(headers, rows).outerHTML;
    }

    /**
     * Render tournament history
     * @returns {string} HTML content
     */
    renderTournamentHistory() {
        return `
            <section class="tournament-history">
                <h3>Tournament History</h3>
                ${this.createTournamentHistoryTable()}
            </section>
        `;
    }

    /**
     * Create tournament history table
     * @returns {string} HTML content
     */
    createTournamentHistoryTable() {
        const headers = ['Tournament', 'Position', 'Total Score', 'Result', 'Type'];
        const rows = this.teamStats.tournaments
            .sort((a, b) => b.total - a.total)
            .map(tournament => [
                `<a href="tournaments.html?tournament=${encodeURIComponent(tournament.name)}">${tournament.name}</a>`,
                `#${tournament.position}`,
                utils.format.formatNumber(tournament.total), 
                tournament.isWinner ? '<span class="winner">Winner</span>' : '-',
                tournament.canon ? 'Canon' : '<span class="non-canon">Non-Canon</span>'
            ]);
    
        return utils.dom.createTable(headers, rows).outerHTML;
    }

    createSummaryStats() {
        const canonTournaments = this.teamStats.tournaments.filter(t => t.canon);
        const stats = [
            { label: 'Tournament Wins', value: canonTournaments.filter(t => t.isWinner).length },
            { label: 'Tournaments Played', value: canonTournaments.length },
            { label: 'Total Score', value: utils.format.formatNumber(this.teamStats.overall.totalScore) }
        ];
    
        return stats.map(stat => `
            <div class="stat-item">
                <span class="stat-value">${stat.value}</span>
                <span class="stat-label">${stat.label}</span>
            </div>
        `).join('');
    }

}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    utils.theme.initialize();
    document.getElementById('modeToggle')?.addEventListener('click', () => utils.theme.toggle());
    const teamStatsManager = new TeamStatsManager();
    teamStatsManager.initialize();
});

export default TeamStatsManager;