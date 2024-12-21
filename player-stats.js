// player-stats.js
import utils from './utils.js';

/**
 * Manages player statistics display and calculations
 */
class PlayerStatsManager {
    /**
     * Initialize PlayerStatsManager
     */
    constructor() {
        this.statsData = null;
        this.playerName = '';
        this.playerStats = {
            tournaments: [],
            overall: {
                totalScore: 0,
                gamesPlayed: 0,
                averageScore: 0,
                bestGame: null,
                worstGame: null,
                totalWins: 0
            },
            gameStats: new Map()
        };
    }

    /**
     * Initialize player statistics
     */
    async initialize() {
        try {
            await this.loadData();
            await this.processPlayerStats();
            this.render();
        } catch (error) {
            utils.dom.showError('Failed to load player statistics', 'playerStats');
        }
    }

    /**
     * Load player data
     */
    async loadData() {
        this.statsData = await utils.api.fetchStats();
        this.playerName = utils.url.getParam('player');

        if (!this.playerName) {
            throw new Error('No player selected');
        }

        if (!this.validatePlayerExists()) {
            throw new Error(`Player not found: ${this.playerName}`);
        }
    }

    /**
     * Validate player exists in data
     * @returns {boolean} Whether player exists
     */
    validatePlayerExists() {
        return Object.values(this.statsData.tournaments).some(tournament =>
            tournament.teams.some(team =>
                team.players.some(player => {
                    const playerNames = Array.isArray(player.name) ? player.name : [player.name];
                    return playerNames.includes(this.playerName);
                })
            )
        );
    }

    /**
     * Process player statistics
     */
    processPlayerStats() {
        Object.entries(this.statsData.tournaments).forEach(([tournamentName, tournament]) => {
            const playerData = this.findPlayerInTournament(tournamentName, tournament);
            if (playerData) {
                this.processPlayerTournamentData(playerData, tournamentName, tournament);
            }
        });

        this.calculateOverallStats();
    }

    /**
     * Find player in tournament
     * @param {string} tournamentName Tournament name
     * @param {Object} tournament Tournament data
     * @returns {Object|null} Player data and context
     */
    findPlayerInTournament(tournamentName, tournament) {
        for (const team of tournament.teams) {
            const player = team.players.find(p => {
                const playerNames = Array.isArray(p.name) ? p.name : [p.name];
                return playerNames.includes(this.playerName);
            });

            if (player) {
                return {
                    player,
                    team: team.name,
                    isWinner: team.name === tournament.winners
                };
            }
        }
        return null;
    }

    /**
     * Process player's tournament data
     * @param {Object} playerData Player data and context
     * @param {string} tournamentName Tournament name
     * @param {Object} tournament Tournament data
     */
    processPlayerTournamentData(playerData, tournamentName, tournament) {
        const tournamentStats = {
            name: tournamentName,
            team: playerData.team,
            isWinner: playerData.isWinner,
            games: {},
            total: 0,
            position: this.calculateTournamentPosition(playerData.player, tournament),
            originalData: playerData.player
        };

        this.processPlayerGames(playerData.player, tournament, tournamentStats);
        this.playerStats.tournaments.push(tournamentStats);
    }

    /**
     * Process player's game performances
     * @param {Object} player Player data
     * @param {Object} tournament Tournament data
     * @param {Object} tournamentStats Tournament statistics object
     */
    processPlayerGames(player, tournament, tournamentStats) {
        Object.entries(tournament.games).forEach(([game, gameConfig]) => {
            const gameStats = this.processGameStats(player, game, gameConfig);
            if (gameStats) {
                tournamentStats.games[game] = gameStats;
                tournamentStats.total += gameStats.totalScore;
                this.updateGameStats(game, gameStats);
            }
        });
    }

    /**
     * Process game statistics
     * @param {Object} player Player data
     * @param {string} game Game name
     * @param {Object} gameConfig Game configuration
     * @returns {Object|null} Game statistics
     */
    processGameStats(player, game, gameConfig) {
        if (!player.scores[game]) return null;

        const scores = player.scores[game];
        const multipliedScores = scores.map(score => score * gameConfig.multiplier);

        return {
            scores,
            multipliedScores,
            totalScore: utils.score.calculatePlayerScore(scores, gameConfig.multiplier),
            average: utils.score.calculateAverageScore(multipliedScores),
            best: Math.max(...scores),
            worst: Math.min(...scores),
            multiplier: gameConfig.multiplier
        };
    }

    /**
     * Update game statistics
     * @param {string} game Game name
     * @param {Object} stats Game statistics
     */
    updateGameStats(game, stats) {
        if (!this.playerStats.gameStats.has(game)) {
            this.playerStats.gameStats.set(game, {
                totalScore: 0,
                gamesPlayed: 0,
                average: 0,
                best: 0,
                worst: Infinity
            });
        }

        const gameStats = this.playerStats.gameStats.get(game);
        this.updateGameStatsValues(gameStats, stats);
    }

    /**
     * Update game statistics values
     * @param {Object} gameStats Existing game statistics
     * @param {Object} stats New game statistics
     */
    updateGameStatsValues(gameStats, stats) {
        gameStats.totalScore += stats.totalScore;
        gameStats.gamesPlayed += stats.scores.length;
        gameStats.average = gameStats.totalScore / gameStats.gamesPlayed;
        gameStats.best = Math.max(gameStats.best, stats.best);
        gameStats.worst = Math.min(gameStats.worst, stats.worst);
    }

    /**
     * Calculate tournament position
     * @param {Object} player Player data
     * @param {Object} tournament Tournament data
     * @returns {number} Tournament position
     */
    calculateTournamentPosition(player, tournament) {
        const allPlayers = tournament.teams.flatMap(team => team.players);
        const playerScores = allPlayers.map(p => ({
            name: Array.isArray(p.name) ? p.name[0] : p.name,
            score: this.calculatePlayerTournamentScore(p, tournament)
        }));

        playerScores.sort((a, b) => b.score - a.score);
        return playerScores.findIndex(p => p.name === this.playerName) + 1;
    }

    /**
     * Calculate player's tournament score
     * @param {Object} player Player data
     * @param {Object} tournament Tournament data
     * @returns {number} Total score
     */
    calculatePlayerTournamentScore(player, tournament) {
        return Object.entries(tournament.games).reduce((total, [game, config]) => {
            if (player.scores[game]) {
                return total + utils.score.calculatePlayerScore(player.scores[game], config.multiplier);
            }
            return total;
        }, 0);
    }

/**
     * Calculate overall statistics
     */
calculateOverallStats() {
    const stats = this.playerStats.overall;
    stats.totalWins = this.playerStats.tournaments.filter(t => t.isWinner).length;
    
    this.playerStats.tournaments.forEach(tournament => {
        stats.totalScore += tournament.total;
        Object.values(tournament.games).forEach(game => {
            stats.gamesPlayed += game.scores.length;
        });
    });

    stats.averageScore = stats.totalScore / stats.gamesPlayed;
}

/**
 * Render player statistics
 */
render() {
    const container = document.getElementById('playerStats');
    if (!container) return;

    container.innerHTML = `
        ${this.renderHeader()}
        ${this.renderOverallStats()}
        ${this.renderGamePerformance()}
        ${this.renderTournamentHistory()}
        ${this.renderDetailedStats()}
    `;
}

/**
 * Render header section
 * @returns {string} HTML content
 */
renderHeader() {
    return `
        <h2 class="player-header">
            ${utils.format.formatPlayerName(this.playerName)}
        </h2>
    `;
}

/**
 * Render overall statistics
 * @returns {string} HTML content
 */
renderOverallStats() {
    const stats = this.playerStats.overall;
    const statItems = [
        { value: stats.totalScore, label: 'Total Score' },
        { value: stats.gamesPlayed, label: 'Games Played' },
        { value: stats.averageScore, label: 'Average Score' },
        { value: stats.totalWins, label: 'Tournament Wins' }
    ];

    return `
        <div class="stats-overview">
            ${statItems.map(item => `
                <div class="stat-item">
                    <span class="stat-value">${utils.format.formatNumber(item.value)}</span>
                    <span class="stat-label">${item.label}</span>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render game performance section
 * @returns {string} HTML content
 */
renderGamePerformance() {
    return `
        <div class="game-performance">
            <h3>Game Performance</h3>
            <div class="game-stats-list">
                ${Array.from(this.playerStats.gameStats.entries())
                    .map(([game, stats]) => this.createGameStatCard(game, stats))
                    .join('')}
            </div>
        </div>
    `;
}

/**
 * Create game statistics card
 * @param {string} game Game name
 * @param {Object} stats Game statistics
 * @returns {string} HTML content
 */
createGameStatCard(game, stats) {
    const statItems = [
        { label: 'Avg', value: stats.average },
        { label: 'Best', value: stats.best },
        { label: 'Worst', value: stats.worst },
        { label: 'Games', value: stats.gamesPlayed }
    ];

    return `
        <div class="game-stat-item">
            <div class="game-name">${game}</div>
            <div class="game-stats">
                ${statItems.map(item => 
                    `<span>${item.label}: ${utils.format.formatNumber(item.value)}</span>`
                ).join('')}
            </div>
        </div>
    `;
}

/**
 * Render tournament history section
 * @returns {string} HTML content
 */
renderTournamentHistory() {
    const headers = ['Tournament', 'Team', 'Position', 'Total Score', 'Games'];
    const rows = this.playerStats.tournaments.map(tournament => [
        `<a href="tournaments.html?tournament=${encodeURIComponent(tournament.name)}">${tournament.name}</a>`,
        `<a href="team-stats.html?team=${encodeURIComponent(tournament.team)}">${tournament.team}</a>`,
        `#${tournament.position}`,
        utils.format.formatNumber(tournament.total),
        Object.keys(tournament.games).length
    ]);

    return `
        <div class="tournament-history">
            <h3>Tournament History</h3>
            ${utils.dom.createTable(headers, rows).outerHTML}
        </div>
    `;
}

/**
 * Render detailed statistics section
 * @returns {string} HTML content
 */
renderDetailedStats() {
    return `
        <div class="detailed-stats">
            <h3>Detailed Game Scores</h3>
            <div class="tournament-games-grid">
                ${this.playerStats.tournaments.map(tournament => 
                    this.createTournamentDetailCard(tournament)
                ).join('')}
            </div>
        </div>
    `;
}

/**
 * Create tournament detail card
 * @param {Object} tournament Tournament data
 * @returns {string} HTML content
 */
createTournamentDetailCard(tournament) {
    return `
        <div class="tournament-detail-card">
            <div class="tournament-detail-header">
                <h4>${tournament.name}</h4>
                <span class="tournament-score">
                    Total Score: ${utils.format.formatNumber(tournament.total)}
                </span>
            </div>
            ${this.renderDetailedTournamentStats(tournament)}
        </div>
    `;
}

/**
 * Render detailed tournament statistics
 * @param {Object} tournament Tournament data
 * @returns {string} HTML content
 */
renderDetailedTournamentStats(tournament) {
    return `
        <div class="tournament-games">
            <table class="game-scores-table">
                <thead>
                    <tr>
                        <th>Game</th>
                        <th>Round</th>
                        <th>Raw Score</th>
                        <th>Final Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.createDetailedScoresRows(tournament)}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Create detailed scores rows
 * @param {Object} tournament Tournament data
 * @returns {string} HTML content
 */
createDetailedScoresRows(tournament) {
    return Object.entries(tournament.games).map(([game, stats]) => 
        stats.scores.map((score, index) => `
            <tr>
                ${index === 0 ? `<td rowspan="${stats.scores.length}">${game} (${stats.multiplier}x)</td>` : ''}
                <td>Round ${index + 1}</td>
                <td>${score}</td>
                <td>${utils.format.formatNumber(score * stats.multiplier)}</td>
            </tr>
        `).join('')
    ).join('');
}
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
utils.theme.initialize();
document.getElementById('modeToggle')?.addEventListener('click', () => utils.theme.toggle());
const playerStatsManager = new PlayerStatsManager();
playerStatsManager.initialize();
});

export default PlayerStatsManager;