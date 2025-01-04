// hof.js
import utils from './utils.js';

/**
 * Manages the Hall of Fame functionality
 */
class HallOfFameManager {
    /**
     * Initialize HallOfFameManager
     */
    constructor() {
        this.statsData = null;
        this.records = {
            gameRecords: new Map(),
            playerRecords: new Map(),
            teamRecords: new Map(),
            tournamentRecords: []
        };
    }

    /**
     * Initialize the Hall of Fame
     */
    async initialize() {
        try {
            await this.loadData();
            this.calculateAllRecords();
            this.renderHallOfFame();
        } catch (error) {
            utils.dom.showError('Failed to load Hall of Fame data', 'hofStats');
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
     * Calculate all record types
     */
    calculateAllRecords() {
        this.calculateGameRecords();
        this.calculatePlayerRecords();
        this.calculateTeamRecords();
        this.compileTournamentRecords();
    }

    /**
     * Calculate game-specific records
     */
    calculateGameRecords() {
        const games = new Set();
        Object.values(this.statsData.tournaments).forEach(tournament => {
            Object.keys(tournament.games).forEach(game => games.add(game));
        });

        games.forEach(game => {
            this.records.gameRecords.set(game, {
                highest: {
                    unmultiplied: { score: 0, player: '', tournament: '' },
                    multiplied: { score: 0, player: '', tournament: '' }
                },
                lowest: {
                    unmultiplied: { score: Infinity, player: '', tournament: '' },
                    multiplied: { score: Infinity, player: '', tournament: '' }
                },
                averages: {
                    highest: { value: 0, player: '', tournament: '' },
                    lowest: { value: Infinity, player: '', tournament: '' }
                },
                firstPlaces: new Map()
            });
        });

        Object.entries(this.statsData.tournaments).forEach(([tournamentName, tournament]) => {
            this.processGameRecordsForTournament(tournamentName, tournament);
        });
    }

    /**
     * Process game records for a specific tournament
     * @param {string} tournamentName Tournament name
     * @param {Object} tournament Tournament data
     */
    processGameRecordsForTournament(tournamentName, tournament) {
        if (tournament.canon === false) return;
    
        tournament.teams.forEach(team => {
            team.players.forEach(player => {
                Object.entries(tournament.games).forEach(([game, gameConfig]) => {
                    if (player.scores[game]) {
                        const playerName = Array.isArray(player.name) ? player.name[0] : player.name;
                        const scores = player.scores[game];
                        const multiplier = gameConfig.multiplier;
                        
                        this.updateGameRecords(game, scores, multiplier, playerName, tournamentName);
                        this.updateFirstPlaces(game, scores, player, tournamentName, tournament);
                    }
                });
            });
        });
    }
    /**
     * Update game records with new scores
     * @param {string} game Game name
     * @param {Array<number>} scores Array of scores
     * @param {number} multiplier Score multiplier
     * @param {string} playerName Player name
     * @param {string} tournamentName Tournament name
     */
    updateGameRecords(game, scores, multiplier, playerName, tournamentName) {
        const gameRecord = this.records.gameRecords.get(game);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const avgScore = utils.score.calculateAverageScore(scores);

        if (maxScore > gameRecord.highest.unmultiplied.score) {
            gameRecord.highest.unmultiplied = {
                score: maxScore,
                player: playerName,
                tournament: tournamentName
            };
        }

        const maxMultiplied = maxScore * multiplier;
        if (maxMultiplied > gameRecord.highest.multiplied.score) {
            gameRecord.highest.multiplied = {
                score: maxMultiplied,
                player: playerName,
                tournament: tournamentName
            };
        }

        if (minScore < gameRecord.lowest.unmultiplied.score) {
            gameRecord.lowest.unmultiplied = {
                score: minScore,
                player: playerName,
                tournament: tournamentName
            };
        }

        const minMultiplied = minScore * multiplier;
        if (minMultiplied < gameRecord.lowest.multiplied.score) {
            gameRecord.lowest.multiplied = {
                score: minMultiplied,
                player: playerName,
                tournament: tournamentName
            };
        }

        if (avgScore > gameRecord.averages.highest.value) {
            gameRecord.averages.highest = {
                value: avgScore,
                player: playerName,
                tournament: tournamentName
            };
        }
        if (avgScore < gameRecord.averages.lowest.value) {
            gameRecord.averages.lowest = {
                value: avgScore,
                player: playerName,
                tournament: tournamentName
            };
        }
    }

    /**
     * Update first place records
     * @param {string} game Game name
     * @param {Array<number>} scores Array of scores
     * @param {Object} player Player data
     * @param {string} tournamentName Tournament name
     * @param {Object} tournament Tournament data
     */
    updateFirstPlaces(game, scores, player, tournamentName, tournament) {
        const playerName = Array.isArray(player.name) ? player.name[0] : player.name;
        const playerMaxScore = Math.max(...scores);
        const gameRecord = this.records.gameRecords.get(game);
        
        let allScores = [];
        tournament.teams.forEach(team => {
            team.players.forEach(p => {
                if (p.scores[game]) {
                    allScores.push(Math.max(...p.scores[game]));
                }
            });
        });
    
        if (playerMaxScore === Math.max(...allScores)) {
            const currentCount = gameRecord.firstPlaces.get(playerName) || 0;
            gameRecord.firstPlaces.set(playerName, currentCount + 1);
        }
    }

    /**
     * Calculate player records
     */
    calculatePlayerRecords() {
        const playerStats = new Map();
    
        Object.entries(this.statsData.tournaments).forEach(([tournamentName, tournament]) => {
            if (tournament.canon !== false) { 
                tournament.teams.forEach(team => {
                    const isWinningTeam = team.name === tournament.winners;
                    
                    team.players.forEach(player => {
                        const playerName = Array.isArray(player.name) ? player.name[0] : player.name;
                        
                        if (!playerStats.has(playerName)) {
                            playerStats.set(playerName, {
                                wins: 0,
                                participations: 0,
                                totalScore: 0,
                                gamesPlayed: 0,
                                firstPlaces: 0,
                                tournaments: new Set()
                            });
                        }
    
                        const stats = playerStats.get(playerName);
                        this.updatePlayerStats(stats, player, tournament, isWinningTeam, tournamentName);
                    });
                });
            }
        });
    
        this.records.playerRecords = this.compilePlayerRecords(playerStats);
    }
    /**
     * Update player statistics
     * @param {Object} stats Player stats object
     * @param {Object} player Player data
     * @param {Object} tournament Tournament data
     * @param {boolean} isWinningTeam Whether player's team won
     * @param {string} tournamentName Tournament name
     */
    updatePlayerStats(stats, player, tournament, isWinningTeam, tournamentName) {
        stats.participations++;
        stats.tournaments.add(tournamentName);
        
        if (isWinningTeam) {
            stats.wins++;
        }

        Object.entries(tournament.games).forEach(([game, gameConfig]) => {
            if (player.scores[game]) {
                const scores = player.scores[game];
                stats.totalScore += utils.score.calculatePlayerScore(scores, gameConfig.multiplier);
                stats.gamesPlayed += scores.length;
            }
        });
    }

    /**
     * Compile player records
     * @param {Map} playerStats Player statistics map
     * @returns {Object} Compiled player records
     */
    compilePlayerRecords(playerStats) {
        let highestAverage = { player: '', value: 0 };
        let lowestAverage = { player: '', value: Infinity };
        let mostWins = { player: '', value: 0 };
        let mostParticipations = { player: '', value: 0 };
        let mostFirstPlaces = { player: '', value: 0 };
    
        Object.entries(this.statsData.tournaments).forEach(([tournamentName, tournament]) => {
            const teamScores = tournament.teams.map(team => ({
                name: team.name,
                score: utils.score.calculateTotalTeamScore(team, tournament, tournament.games)
            }));
            
            teamScores.sort((a, b) => b.score - a.score);
            const firstPlaceTeam = teamScores[0].name;
    
            const winningTeam = tournament.teams.find(team => team.name === firstPlaceTeam);
            if (winningTeam) {
                winningTeam.players.forEach(player => {
                    const playerName = Array.isArray(player.name) ? player.name[0] : player.name;
                    const stats = playerStats.get(playerName);
                    if (stats) {
                        stats.firstPlaces = (stats.firstPlaces || 0) + 1;
                    }
                });
            }
        });
    
        playerStats.forEach((stats, player) => {
            const average = stats.totalScore / stats.gamesPlayed;
            
            if (average > highestAverage.value) {
                highestAverage = { player, value: average };
            }
            if (average < lowestAverage.value && average > 0) {
                lowestAverage = { player, value: average };
            }
            if (stats.wins > mostWins.value) {
                mostWins = { player, value: stats.wins };
            }
            if (stats.participations > mostParticipations.value) {
                mostParticipations = { player, value: stats.participations };
            }
            if (stats.firstPlaces > mostFirstPlaces.value) {
                mostFirstPlaces = { player, value: stats.firstPlaces };
            }
        });
    
        return {
            all: playerStats,
            highestAverage,
            lowestAverage,
            mostWins,
            mostParticipations,
            mostFirstPlaces
        };
    }

    /**
     * Calculate team records
     */
    calculateTeamRecords() {
        const teamStats = new Map();

        Object.entries(this.statsData.tournaments).forEach(([tournamentName, tournament]) => {
            tournament.teams.forEach(team => {
                const teamScore = this.calculateTeamTournamentScore(team, tournament);
                const isWinner = team.name === tournament.winners;
                
                if (!teamStats.has(team.name)) {
                    teamStats.set(team.name, {
                        totalScore: 0,
                        tournaments: 0,
                        wins: 0,
                        averageScore: 0,
                        scores: []
                    });
                }

                const stats = teamStats.get(team.name);
                this.updateTeamStats(stats, teamScore, isWinner);
            });
        });

        this.records.teamRecords = this.compileTeamRecords(teamStats);
    }

    /**
     * Calculate team's tournament score
     * @param {Object} team Team data
     * @param {Object} tournament Tournament data
     * @returns {number} Total score
     */
    calculateTeamTournamentScore(team, tournament) {
        return utils.score.calculateTotalTeamScore(team, tournament, tournament.games);
    }

    /**
     * Update team statistics
     * @param {Object} stats Team stats object
     * @param {number} teamScore Team score
     * @param {boolean} isWinner Whether team won
     */
    updateTeamStats(stats, teamScore, isWinner) {
        stats.totalScore += teamScore;
        stats.tournaments++;
        if (isWinner) stats.wins++;
        stats.scores.push(teamScore);
        stats.averageScore = stats.totalScore / stats.tournaments;
    }

    /**
     * Compile team records
     * @param {Map} teamStats Team statistics map
     * @returns {Object} Compiled team records
     */
    compileTeamRecords(teamStats) {
        let bestTeam = { name: '', score: 0 };
        let worstTeam = { name: '', score: Infinity };

        teamStats.forEach((stats, team) => {
            if (stats.averageScore > bestTeam.score) {
                bestTeam = { name: team, score: stats.averageScore };
            }
            if (stats.averageScore < worstTeam.score) {
                worstTeam = { name: team, score: stats.averageScore };
            }
        });

        return {
            all: teamStats,
            bestTeam,
            worstTeam
        };
    }

    /**
     * Compile tournament records
     */
    compileTournamentRecords() {
        this.records.tournamentRecords = Object.entries(this.statsData.tournaments).map(([name, data]) => {
            const winningTeam = data.teams.find(team => team.name === data.winners);
            return {
                name,
                winner: data.winners,
                winningTeamMembers: winningTeam ? winningTeam.players.map(p => 
                    Array.isArray(p.name) ? p.name[0] : p.name
                ) : []
            };
        });
    }

/**
     * Render Hall of Fame content
     */
renderHallOfFame() {
    const container = document.getElementById('hofStats');
    if (!container) return;

    container.innerHTML = `
        ${this.renderIndividualRecords()}
        ${this.renderTournamentRecords()}
        ${this.renderPlayerRecords()}
        ${this.renderTeamRecords()}
    `;
}

/**
 * Render individual game records
 * @returns {string} HTML content
 */
renderIndividualRecords() {
    return `
        <section id="individual-records" class="record-section">
            <h2>Individual Game Records</h2>
            <div class="game-records-grid">
                ${Array.from(this.records.gameRecords.entries())
                    .map(([game, records]) => this.createGameRecordCard(game, records))
                    .join('')}
            </div>
        </section>
    `;
}

/**
 * Create game record card
 * @param {string} game Game name
 * @param {Object} records Game records
 * @returns {string} HTML content
 */
createGameRecordCard(game, records) {
    return `
        <div class="game-record-card">
            <div class="game-record-header">
                <h3 class="game-record-title">${game}</h3>
            </div>
            
            ${this.createRecordStatsGroup('Highest Scores', [
                {
                    label: 'Highest Unmultiplied',
                    ...records.highest.unmultiplied
                },
                {
                    label: 'Highest Multiplied',
                    ...records.highest.multiplied
                }
            ])}

            ${this.createRecordStatsGroup('Lowest Scores', [
                {
                    label: 'Lowest Unmultiplied',
                    ...records.lowest.unmultiplied
                },
                {
                    label: 'Lowest Multiplied',
                    ...records.lowest.multiplied
                }
            ])}

            ${this.createRecordStatsGroup('Averages', [
                {
                    label: 'Highest Average',
                    ...records.averages.highest
                },
                {
                    label: 'Lowest Average',
                    ...records.averages.lowest
                }
            ])}
        </div>
    `;
}

/**
 * Create record stats group
 * @param {string} title Group title
 * @param {Array} stats Stats to display
 * @returns {string} HTML content
 */
createRecordStatsGroup(title, stats) {
    return `
        <div class="record-stats-group">
            <div class="record-group-label">${title}</div>
            ${stats.map(stat => `
                <div class="record-stat">
                    <div class="record-stat-label">${stat.label}</div>
                    <div class="record-stat-value">${utils.format.formatNumber(stat.score || stat.value)}</div>
                    <div class="record-stat-details">
                        by ${utils.format.createPlayerLink(stat.player)}
                        in ${this.createTournamentLink(stat.tournament)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Render tournament records
 * @returns {string} HTML content
 */
renderTournamentRecords() {
    return `
        <section id="tournament-records" class="record-section">
            <h2>Tournament History</h2>
            <div class="tournament-history-grid">
                ${this.records.tournamentRecords.map(record => `
                    <div class="tournament-record-card">
                        <div class="tournament-record-header">
                            <h3>${record.name}</h3>
                        </div>
                        <div class="tournament-record-content">
                            <div class="winner-info">
                                <div class="winner-label">Winning Team</div>
                                <div class="winner-value">${this.createTeamLink(record.winner)}</div>
                            </div>
                            <div class="team-members">
                                <div class="team-members-label">Team Members</div>
                                <div class="team-members-list">
                                    ${record.winningTeamMembers.map(player => 
                                        utils.format.createPlayerLink(player)
                                    ).join(', ')}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
}

/**
 * Render player records
 * @returns {string} HTML content
 */
renderPlayerRecords() {
    const records = this.records.playerRecords;
    
    return `
        <section id="player-records" class="record-section">
            <h2>Player Records</h2>
            <div class="player-achievements-grid">
                ${this.createAchievementCard('Most Tournament Wins', records.mostWins)}
                ${this.createAchievementCard('Most Participations', records.mostParticipations)}
                ${this.createAchievementCard('Highest Overall Average', records.highestAverage)}
                ${this.createAchievementCard('Most First Places', records.mostFirstPlaces)}
            </div>
            <div class="top-players-section">
                <h3>Top Players Overview</h3>
                ${this.createPlayerStatsTable()}
            </div>
        </section>
    `;
}

/**
 * Create achievement card
 * @param {string} title Achievement title
 * @param {Object} achievement Achievement data
 * @returns {string} HTML content
 */
createAchievementCard(title, achievement) {
    return `
        <div class="achievement-card">
            <div class="achievement-header">${title}</div>
            <div class="achievement-value">${utils.format.formatNumber(achievement.value)}</div>
            <div class="achievement-holder">
                ${utils.format.createPlayerLink(achievement.player)}
            </div>
        </div>
    `;
}

/**
 * Create player stats table
 * @returns {string} HTML content
 */
createPlayerStatsTable() {
    const headers = ['Player', 'Tournaments', 'Wins', 'First Places', 'Average Score'];
    const rows = Array.from(this.records.playerRecords.all.entries())
        .map(([player, stats]) => [
            utils.format.createPlayerLink(player),
            stats.tournaments.size,
            stats.wins,
            stats.firstPlaces,
            utils.format.formatNumber(stats.totalScore / stats.gamesPlayed)
        ])
        .sort((a, b) => b[4] - a[4])
        .slice(0, 10);

    return utils.dom.createTable(headers, rows).outerHTML;
}

/**
 * Render team records
 * @returns {string} HTML content
 */
renderTeamRecords() {
    const records = this.records.teamRecords;
    
    return `
        <section id="team-records" class="record-section">
            <h2>Team Records</h2>
            <div class="team-records-grid">
                ${this.createTeamRecordCard('Best Performing Team', records.bestTeam)}
                ${this.createTeamRecordCard('Lowest Performing Team', records.worstTeam)}
            </div>
            <div class="team-stats-section">
                <h3>Team Performance Overview</h3>
                ${this.createTeamStatsTable()}
            </div>
        </section>
    `;
}

/**
 * Create team record card
 * @param {string} title Card title
 * @param {Object} team Team data
 * @returns {string} HTML content
 */
createTeamRecordCard(title, team) {
    return `
        <div class="team-record-card">
            <div class="team-record-header">${title}</div>
            <div class="team-record-name">${this.createTeamLink(team.name)}</div>
            <div class="team-record-score">
                Average Score: ${utils.format.formatNumber(team.score)}
            </div>
        </div>
    `;
}

/**
 * Create team stats table
 * @returns {string} HTML content
 */
createTeamStatsTable() {
    const headers = ['Team', 'Tournaments', 'Wins', 'Average Score'];
    const rows = Array.from(this.records.teamRecords.all.entries())
        .map(([team, stats]) => [
            this.createTeamLink(team),
            stats.tournaments,
            stats.wins,
            utils.format.formatNumber(stats.averageScore)
        ])
        .sort((a, b) => b[3] - a[3]);

    return utils.dom.createTable(headers, rows).outerHTML;
}

/**
 * Create tournament link
 * @param {string} tournament Tournament name
 * @returns {string} HTML content
 */
createTournamentLink(tournament) {
    return `<a href="tournaments.html?tournament=${encodeURIComponent(tournament)}">${tournament}</a>`;
}

/**
 * Create team link
 * @param {string} team Team name
 * @returns {string} HTML content
 */
createTeamLink(team) {
    return `<a href="team-stats.html?team=${encodeURIComponent(team)}">${team}</a>`;
}
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
utils.theme.initialize();
document.getElementById('modeToggle')?.addEventListener('click', () => utils.theme.toggle());
const hofManager = new HallOfFameManager();
hofManager.initialize();
});

export default HallOfFameManager;