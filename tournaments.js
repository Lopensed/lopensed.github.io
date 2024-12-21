// tournaments.js
import utils from './utils.js';

/**
 * Manages tournament statistics and display
 */
class TournamentManager {
    /**
     * Initialize TournamentManager
     */
    constructor() {
        this.statsData = null;
        this.tournamentData = null;
        this.tournamentName = '';
        this.currentData = {
            screenshots: [],
            galleryPosition: 0,
            lightboxIndex: 0
        };
    }

    /**
     * Initialize tournament display
     */
    async initialize() {
        try {
            await this.loadData();
            await this.renderTournament();
            this.initializeEventListeners();
        } catch (error) {
            utils.dom.showError('Failed to load tournament statistics', 'tournamentStats');
        }
    }

    /**
     * Load tournament data
     */
    async loadData() {
        try {
            this.statsData = await utils.api.fetchStats();
            this.tournamentName = utils.url.getParam('tournament');

            if (!this.tournamentName) {
                throw new Error('No tournament selected');
            }

            this.tournamentData = this.statsData.tournaments[this.tournamentName];
            if (!this.tournamentData) {
                throw new Error(`No data found for tournament: ${this.tournamentName}`);
            }

            this.currentData.screenshots = await utils.api.fetchScreenshots(this.tournamentName);
        } catch (error) {
            console.error('Error loading tournament data:', error);
            throw error;
        }
    }

    /**
     * Render tournament content
     */
    async renderTournament() {
        const container = document.getElementById('tournamentStats');
        if (!container) return;

        container.innerHTML = `
            ${this.createTournamentHeader()}
            ${await this.createScreenshotGallery()}
            ${this.createTeamStandings()}
            ${this.createGameStatistics()}
        `;
    }

    /**
     * Create tournament header section
     * @returns {string} HTML content
     */
    createTournamentHeader() {
        const stats = this.calculateTournamentStats();
        const winningTeam = this.tournamentData.teams.find(t => t.name === this.tournamentData.winners);

        return `
            <div class="tournament-header">
                <h2>${this.tournamentName}</h2>
                <div class="tournament-summary">
                    ${this.createTournamentSummary(stats)}
                    ${this.createWinnerInfo(winningTeam)}
                </div>
            </div>
        `;
    }

    /**
     * Calculate tournament statistics
     * @returns {Object} Tournament statistics
     */
    calculateTournamentStats() {
        return {
            totalTeams: this.tournamentData.teams.length,
            totalPlayers: this.calculateTotalPlayers(),
            totalGames: Object.keys(this.tournamentData.games).length
        };
    }

    /**
     * Calculate total unique players
     * @returns {number} Total players
     */
    calculateTotalPlayers() {
        const uniquePlayers = new Set();
        this.tournamentData.teams.forEach(team => {
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
     * Create tournament summary section
     * @param {Object} stats Tournament statistics
     * @returns {string} HTML content
     */
    createTournamentSummary(stats) {
        return `
            <div class="summary-stats">
                <div class="stat-item">
                    <span class="stat-value">${stats.totalTeams}</span>
                    <span class="stat-label">Teams</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${stats.totalPlayers}</span>
                    <span class="stat-label">Players</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${stats.totalGames}</span>
                    <span class="stat-label">Games</span>
                </div>
            </div>
        `;
    }

    /**
     * Create winner information section
     * @param {Object} winningTeam Winning team data
     * @returns {string} HTML content
     */
    createWinnerInfo(winningTeam) {
        return `
            <div class="winner-info">
                <h3>Winner</h3>
                <div class="winning-team">
                    <a href="team-stats.html?team=${encodeURIComponent(winningTeam.name)}" 
                       class="team-name">${winningTeam.name}</a>
                    <div class="team-members">
                        ${winningTeam.players.map(p => 
                            utils.format.createPlayerLink(p.name)
                        ).join(', ')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create screenshot gallery
     * @returns {Promise<string>} HTML content
     */
    async createScreenshotGallery() {
        if (this.currentData.screenshots.length === 0) return '';

        return `
            <section class="tournament-gallery">
                <h3>Tournament Screenshots</h3>
                ${this.createGalleryContainer()}
                ${this.createLightbox()}
            </section>
        `;
    }

    /**
     * Create gallery container
     * @returns {string} HTML content
     */
    createGalleryContainer() {
        return `
            <div class="screenshot-gallery-container">
                <button class="gallery-nav-btn prev-btn" aria-label="Previous screenshot">
                    <span class="arrow">←</span>
                </button>
                <div class="screenshot-gallery">
                    ${this.currentData.screenshots.map((screenshot, index) => 
                        this.createScreenshotItem(screenshot, index)
                    ).join('')}
                </div>
                <button class="gallery-nav-btn next-btn" aria-label="Next screenshot">
                    <span class="arrow">→</span>
                </button>
            </div>
        `;
    }

    /**
     * Create screenshot item
     * @param {string} screenshot Screenshot filename
     * @param {number} index Screenshot index
     * @returns {string} HTML content
     */
    createScreenshotItem(screenshot, index) {
        return `
            <div class="screenshot-item">
                <img src="data/tournament-screenshots/${this.tournamentName}/${screenshot}" 
                     alt="Tournament screenshot ${index + 1}" 
                     class="tournament-screenshot"
                     loading="lazy"
                     data-index="${index}">
            </div>
        `;
    }

    /**
     * Create lightbox
     * @returns {string} HTML content
     */
    createLightbox() {
        return `
            <div class="lightbox" role="dialog" aria-label="Screenshot preview">
                <button class="close-btn" aria-label="Close preview">×</button>
                <button class="lightbox-nav-btn prev-btn" aria-label="Previous screenshot">
                    <span class="arrow">←</span>
                </button>
                <img class="lightbox-content" alt="Screenshot preview">
                <button class="lightbox-nav-btn next-btn" aria-label="Next screenshot">
                    <span class="arrow">→</span>
                </button>
            </div>
        `;
    }

    /**
         * Create team standings section
         * @returns {string} HTML content
         */
    createTeamStandings() {
        const teamStats = this.calculateTeamStats();
        
        return `
            <section class="tournament-standings">
                <h3>Team Standings</h3>
                <div class="standings-container">
                    <div class="standings-table-wrapper">
                        ${this.createStandingsTable(teamStats)}
                    </div>
                    ${this.createTeamDetailsGrid(teamStats)}
                </div>
            </section>
        `;
    }

    /**
     * Calculate team statistics
     * @returns {Array} Team statistics
     */
    calculateTeamStats() {
        return this.tournamentData.teams.map(team => {
            const gameScores = {};
            let totalScore = 0;

            Object.entries(this.tournamentData.games).forEach(([game, config]) => {
                const score = utils.score.calculateTeamGameScore(team, game, config);
                gameScores[game] = score;
                totalScore += score;
            });

            return {
                name: team.name,
                players: team.players,
                totalScore,
                gameScores,
                isWinner: team.name === this.tournamentData.winners
            };
        }).sort((a, b) => b.totalScore - a.totalScore);
    }

    /**
     * Create standings table
     * @param {Array} teamStats Team statistics
     * @returns {string} HTML content
     */
    createStandingsTable(teamStats) {
        const headers = ['Rank', 'Team', 'Total Score', 'Players'];
        const rows = teamStats.map((team, index) => [
            index + 1,
            `<a href="team-stats.html?team=${encodeURIComponent(team.name)}" 
                class="team-link ${team.isWinner ? 'winner' : ''}">${team.name}</a>`,
            utils.format.formatNumber(team.totalScore),
            team.players.length
        ]);

        return utils.dom.createTable(headers, rows).outerHTML;
    }

    /**
     * Create team details grid
     * @param {Array} teamStats Team statistics
     * @returns {string} HTML content
     */
    createTeamDetailsGrid(teamStats) {
        return `
            <div class="team-details-grid">
                ${teamStats.map(team => this.createTeamDetailCard(team)).join('')}
            </div>
        `;
    }

    /**
     * Create team detail card
     * @param {Object} team Team statistics
     * @returns {string} HTML content
     */
    createTeamDetailCard(team) {
        return `
            <div class="team-detail-card ${team.isWinner ? 'winner' : ''}">
                <div class="team-header">
                    <h4>${team.name}</h4>
                    <span class="team-score">
                        ${utils.format.formatNumber(team.totalScore)} points
                    </span>
                </div>
                ${this.createTeamPlayersSection(team)}
                ${this.createTeamGameBreakdown(team)}
            </div>
        `;
    }

    /**
     * Create team players section
     * @param {Object} team Team data
     * @returns {string} HTML content
     */
    createTeamPlayersSection(team) {
        return `
            <div class="team-players">
                <h5>Players</h5>
                <ul>
                    ${team.players.map(player => `
                        <li>
                            ${utils.format.createPlayerLink(player.name)}
                            <span class="player-score">
                                ${utils.format.formatNumber(
                                    this.calculatePlayerTotalScore(player)
                                )} points
                            </span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Calculate player's total tournament score
     * @param {Object} player Player data
     * @returns {number} Total score
     */
    calculatePlayerTotalScore(player) {
        return utils.score.calculatePlayerTournamentScore(
            player,
            this.tournamentName,
            this.tournamentData.games
        );
    }

    /**
     * Create team game breakdown section
     * @param {Object} team Team data
     * @returns {string} HTML content
     */
    createTeamGameBreakdown(team) {
        return `
            <div class="team-game-breakdown">
                <h5>Game Breakdown</h5>
                <div class="game-scores">
                    ${Object.entries(team.gameScores).map(([game, score]) => `
                        <div class="game-score">
                            <span class="game-name">${game}</span>
                            <span class="score">${utils.format.formatNumber(score)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Create game statistics section
     * @returns {string} HTML content
     */
    createGameStatistics() {
        const sortedGames = this.getSortedGames();
        
        return `
            <section class="tournament-games">
                <h3>Games</h3>
                <div class="games-container">
                    ${this.createGameNavigation(sortedGames)}
                    <div id="game-content" class="games-content">
                        ${this.createGameSection(sortedGames[0][0], sortedGames[0][1])}
                    </div>
                </div>
            </section>
        `;
    }

    /**
     * Get sorted games by order
     * @returns {Array} Sorted games
     */
    getSortedGames() {
        return Object.entries(this.tournamentData.games)
            .sort(([,a], [,b]) => a.order - b.order);
    }

    /**
     * Create game navigation
     * @param {Array} sortedGames Sorted games
     * @returns {string} HTML content
     */
    createGameNavigation(sortedGames) {
        return `
            <div class="games-nav">
                ${sortedGames.map(([game, config], index) => `
                    <button class="game-nav-item ${index === 0 ? 'active' : ''}" 
                            data-game="${game}">
                        <span class="game-name">${game}</span>
                        <span class="game-multiplier">${config.multiplier}x</span>
                        <span class="game-order">Game ${config.order}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    /**
     * Create game section
     * @param {string} game Game name
     * @param {Object} gameConfig Game configuration
     * @returns {string} HTML content
     */
    createGameSection(game, gameConfig) {
        const gameStats = this.calculateGameStats(game, gameConfig);
        
        return `
            <div id="game-${game}" class="game-section">
                ${this.createGameHeader(game, gameConfig)}
                <div class="game-content">
                    <div class="game-standings">
                        ${this.createGameStandings(gameStats)}
                    </div>
                    <div class="game-details">
                        ${this.createGameDetails(game, gameStats)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Calculate game statistics
     * @param {string} game Game name
     * @param {Object} gameConfig Game configuration
     * @returns {Object} Game statistics
     */
    calculateGameStats(game, gameConfig) {
        const teamScores = this.tournamentData.teams.map(team => ({
            team: team.name,
            players: team.players,
            score: utils.score.calculateTeamGameScore(team, game, gameConfig),
            playerScores: team.players.map(player => ({
                name: player.name,
                scores: player.scores[game] || [],
                total: utils.score.calculatePlayerScore(
                    player.scores[game] || [], 
                    gameConfig.multiplier
                )
            }))
        })).sort((a, b) => b.score - a.score);

        return {
            teams: teamScores,
            highestScore: Math.max(...teamScores.map(t => t.score)),
            totalRounds: Math.max(...teamScores.flatMap(t => 
                t.playerScores.map(p => p.scores.length)
            ))
        };
    }

    /**
     * Create game header
     * @param {string} game Game name
     * @param {Object} gameConfig Game configuration
     * @returns {string} HTML content
     */
    createGameHeader(game, gameConfig) {
        return `
            <div class="game-header">
                <h4>${game}</h4>
                <div class="game-info">
                    <span class="game-order">Game ${gameConfig.order}</span>
                    <span class="game-multiplier">${gameConfig.multiplier}x Multiplier</span>
                </div>
            </div>
        `;
    }

    /**
     * Create game standings table
     * @param {Object} gameStats Game statistics
     * @returns {string} HTML content
     */
    createGameStandings(gameStats) {
        const headers = ['Rank', 'Team', 'Score', 'Details'];
        const rows = gameStats.teams.map((team, index) => [
            index + 1,
            `<a href="team-stats.html?team=${encodeURIComponent(team.team)}">${team.team}</a>`,
            utils.format.formatNumber(team.score),
            `<button class="details-toggle" data-team="${team.team}">Show Details</button>`
        ]);

        return utils.dom.createTable(headers, rows).outerHTML;
    }

    /**
     * Create game details section
     * @param {string} game Game name
     * @param {Object} gameStats Game statistics
     * @returns {string} HTML content
     */
    createGameDetails(game, gameStats) {
        return `
            <div class="player-performances">
                ${gameStats.teams.map(team => `
                    <div class="team-performance" id="details-${team.team}" style="display: none;">
                        <h5>${team.team} Player Performances</h5>
                        ${this.createPlayerPerformanceTable(team.playerScores, gameStats.totalRounds)}
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Create player performance table
     * @param {Array} playerScores Player scores
     * @param {number} totalRounds Total rounds
     * @returns {string} HTML content
     */
    createPlayerPerformanceTable(playerScores, totalRounds) {
        const headers = [
            'Player', 
            ...Array(totalRounds).fill(0).map((_, i) => `Round ${i + 1}`),
            'Total'
        ];
        
        const rows = playerScores.map(player => [
            utils.format.createPlayerLink(player.name),
            ...Array(totalRounds).fill(0).map((_, i) => 
                player.scores[i] ? utils.format.formatNumber(player.scores[i]) : '-'
            ),
            utils.format.formatNumber(player.total)
        ]);

        return utils.dom.createTable(headers, rows).outerHTML;
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        this.initializeGameNavigation();
        this.initializeDetailToggles();
        this.initializeGallery();
    }

    /**
     * Initialize game navigation
     */
    initializeGameNavigation() {
        document.querySelectorAll('.game-nav-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const game = e.currentTarget.dataset.game;
                const gameConfig = this.tournamentData.games[game];
                
                this.updateActiveGameTab(e.currentTarget);
                this.updateGameContent(game, gameConfig);
            });
        });
    }

    /**
     * Update active game tab
     * @param {HTMLElement} clickedButton Clicked navigation button
     */
    updateActiveGameTab(clickedButton) {
        document.querySelectorAll('.game-nav-item').forEach(btn => 
            btn.classList.remove('active'));
        clickedButton.classList.add('active');
    }

    /**
     * Update game content
     * @param {string} game Game name
     * @param {Object} gameConfig Game configuration
     */
    updateGameContent(game, gameConfig) {
        const gameContent = document.getElementById('game-content');
        if (gameContent) {
            gameContent.innerHTML = this.createGameSection(game, gameConfig);
            this.initializeDetailToggles();
        }
    }

    /**
     * Initialize detail toggles
     */
    initializeDetailToggles() {
        document.querySelectorAll('.details-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const team = e.currentTarget.dataset.team;
                this.toggleTeamDetails(team, e.currentTarget);
            });
        });
    }

    /**
     * Toggle team details visibility
     * @param {string} team Team name
     * @param {HTMLElement} button Toggle button
     */
    toggleTeamDetails(team, button) {
        const details = document.getElementById(`details-${team}`);
        const isVisible = details.style.display !== 'none';
        
        document.querySelectorAll('.team-performance').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('.details-toggle').forEach(btn => {
            btn.textContent = 'Show Details';
        });

        if (!isVisible) {
            details.style.display = 'block';
            button.textContent = 'Hide Details';
        }
    }

    /**
     * Initialize gallery functionality
     */
    initializeGallery() {
        this.initializeScreenshotEvents();
        this.initializeLightboxEvents();
        this.initializeKeyboardNavigation();
    }

    /**
     * Initialize screenshot events
     */
    initializeScreenshotEvents() {
        document.querySelectorAll('.tournament-screenshot').forEach(img => {
            img.addEventListener('click', (e) => {
                this.openLightbox(parseInt(e.currentTarget.dataset.index));
            });
        });
    }

    /**
     * Initialize lightbox events
     */
    initializeLightboxEvents() {
        const lightbox = document.querySelector('.lightbox');
        if (!lightbox) return;

        lightbox.querySelector('.close-btn')?.addEventListener('click', () => 
            this.closeLightbox());
        
        lightbox.querySelector('.prev-btn')?.addEventListener('click', () => 
            this.navigateLightbox(-1));
        
        lightbox.querySelector('.next-btn')?.addEventListener('click', () => 
            this.navigateLightbox(1));
    }

    /**
     * Initialize keyboard navigation
     */
    initializeKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            const lightbox = document.querySelector('.lightbox');
            if (!lightbox?.classList.contains('active')) return;

            switch(e.key) {
                case 'Escape': this.closeLightbox(); break;
                case 'ArrowLeft': this.navigateLightbox(-1); break;
                case 'ArrowRight': this.navigateLightbox(1); break;
            }
        });
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    utils.theme.initialize();
    document.getElementById('modeToggle')?.addEventListener('click', () => utils.theme.toggle());
    const tournamentManager = new TournamentManager();
    tournamentManager.initialize();
});

export default TournamentManager;