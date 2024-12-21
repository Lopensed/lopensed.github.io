/**
 * Base API configuration
 */
const API_BASE_URL = 'https://lopensed.github.io/';
const ENDPOINTS = {
    stats: `${API_BASE_URL}data/stats.json`,
    screenshots: (tournament) => `${API_BASE_URL}data/tournament-screenshots/${tournament}/index.json`
};

/**
 * API utilities for data fetching
 */
const api = {
    /**
     * Fetches tournament statistics
     * @returns {Promise<Object>} Tournament statistics data
     * @throws {Error} If fetch fails
     */
    async fetchStats() {
        try {
            const response = await fetch(ENDPOINTS.stats);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching stats:', error);
            throw new Error('Failed to load tournament statistics');
        }
    },

    /**
     * Fetches tournament screenshots
     * @param {string} tournament Tournament name
     * @returns {Promise<Array>} Array of screenshot data
     */
    async fetchScreenshots(tournament) {
        try {
            const response = await fetch(ENDPOINTS.screenshots(tournament));
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching screenshots:', error);
            return [];
        }
    }
};

/**
 * Score calculation utilities
 */
const scoreUtils = {
    /**
     * Calculates player score for a game
     * @param {Array<number>} scores Array of scores
     * @param {number} multiplier Score multiplier
     * @returns {number} Total score
     */
    calculatePlayerScore(scores, multiplier = 1.0) {
        if (!Array.isArray(scores) || scores.length === 0) return 0;
        return scores.reduce((a, b) => a + b, 0) * multiplier;
    },

    /**
     * Calculates team score for a specific game
     * @param {Object} team Team data
     * @param {string} game Game name
     * @param {Object} gameConfig Game configuration
     * @returns {number} Team's total score for the game
     */
    calculateTeamGameScore(team, game, gameConfig) {
        return team.players.reduce((total, player) => {
            if (player.scores[game]) {
                return total + this.calculatePlayerScore(player.scores[game], gameConfig.multiplier);
            }
            return total;
        }, 0);
    },

    /**
     * Calculates total team score across all games
     * @param {Object} team Team data
     * @param {string} tournament Tournament name
     * @param {Object} games Games configuration
     * @returns {number} Team's total tournament score
     */
    calculateTotalTeamScore(team, tournament, games) {
        return Object.entries(games).reduce((total, [game, config]) => {
            return total + this.calculateTeamGameScore(team, game, config);
        }, 0);
    },

    /**
     * Calculates player's total tournament score
     * @param {Object} player Player data
     * @param {string} tournament Tournament name
     * @param {Object} games Games configuration
     * @returns {number} Player's total tournament score
     */
    calculatePlayerTournamentScore(player, tournament, games) {
        return Object.entries(games).reduce((total, [game, config]) => {
            if (player.scores[game]) {
                return total + this.calculatePlayerScore(player.scores[game], config.multiplier);
            }
            return total;
        }, 0);
    },

    /**
     * Calculates player's average score for a game
     * @param {Array<number>} scores Array of scores
     * @returns {number} Average score
     */
    calculateAverageScore(scores) {
        if (!Array.isArray(scores) || scores.length === 0) return 0;
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    }
};

/**
 * DOM manipulation utilities
 */
const domUtils = {
    /**
     * Creates an HTML table with headers and rows
     * @param {Array<string>} headers Table headers
     * @param {Array<Array>} rows Table rows
     * @param {Object} options Additional options
     * @returns {HTMLElement} Table container element
     */
    createTable(headers, rows, options = {}) {
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.innerHTML = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        
        rows.forEach(row => {
            const tr = document.createElement('tr');
            row.forEach(cell => {
                const td = document.createElement('td');
                td.innerHTML = cell;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        
        table.appendChild(thead);
        table.appendChild(tbody);
        return this.wrapTableWithContainer(table);
    },

    /**
     * Wraps table in a container div
     * @param {HTMLElement} table Table element
     * @returns {HTMLElement} Container element
     */
    wrapTableWithContainer(table) {
        const container = document.createElement('div');
        container.className = 'table-container';
        container.appendChild(table);
        return container;
    },

    /**
     * Creates a link element
     * @param {string} href Link URL
     * @param {string} text Link text
     * @param {string} className Optional CSS class
     * @returns {HTMLElement} Link element
     */
    createLink(href, text, className = '') {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = text;
        if (className) link.className = className;
        return link;
    },

    /**
     * Shows error message in container
     * @param {string} message Error message
     * @param {string} containerId Container element ID
     */
    showError(message, containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <p>${message}</p>
                    <button onclick="window.location.reload()">Retry</button>
                </div>
            `;
        }
    },

    /**
     * Creates a card element
     * @param {string} title Card title
     * @param {string} content Card content
     * @param {Object} options Additional options
     * @returns {HTMLElement} Card element
     */
    createCard(title, content, options = {}) {
        const card = document.createElement('div');
        card.className = `card ${options.className || ''}`;
        
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'card-header';
            titleEl.innerHTML = `<h3>${title}</h3>`;
            card.appendChild(titleEl);
        }

        const contentEl = document.createElement('div');
        contentEl.className = 'card-content';
        contentEl.innerHTML = content;
        card.appendChild(contentEl);

        return card;
    }
};

/**
 * Theme management utilities
 */
const themeUtils = {
    /**
     * Toggles between light and dark theme
     */
    toggle() {
        document.documentElement.classList.toggle('light-mode');
        const isLight = document.documentElement.classList.contains('light-mode');
        localStorage.setItem('lightMode', isLight);
        this.updateToggleButton(isLight);
    },

    /**
     * Initializes theme based on stored preference
     */
    initialize() {
        const isLight = localStorage.getItem('lightMode') === 'true';
        if (isLight) {
            document.documentElement.classList.add('light-mode');
            this.updateToggleButton(true);
        }
    },

    /**
     * Updates theme toggle button text
     * @param {boolean} isLight Whether light theme is active
     */
    updateToggleButton(isLight) {
        const button = document.getElementById('modeToggle');
        if (button) {
            button.textContent = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';
        }
    }
};

/**
 * Formatting utilities
 */
const formatUtils = {
    /**
     * Formats number with thousands separator
     * @param {number} number Number to format
     * @returns {string} Formatted number
     */
    formatNumber(number) {
        return Math.round(number).toLocaleString();
    },

    /**
     * Formats player name
     * @param {string|Array<string>} name Player name(s)
     * @returns {string} Formatted name
     */
    formatPlayerName(name) {
        if (Array.isArray(name)) {
            return name.join(' / ');
        }
        return name;
    },

    /**
     * Creates player link HTML
     * @param {string|Array<string>} name Player name(s)
     * @returns {string} HTML string
     */
    createPlayerLink(name) {
        if (Array.isArray(name)) {
            return name.map(n => 
                `<a href="player-stats.html?player=${encodeURIComponent(n)}" class="player-link">${n}</a>`
            ).join(' / ');
        }
        return `<a href="player-stats.html?player=${encodeURIComponent(name)}" class="player-link">${name}</a>`;
    },

    /**
     * Formats date
     * @param {Date} date Date to format
     * @returns {string} Formatted date
     */
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
};

/**
 * URL parameter utilities
 */
const urlUtils = {
    /**
     * Gets URL parameter value
     * @param {string} param Parameter name
     * @returns {string|null} Parameter value
     */
    getParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    /**
     * Sets URL parameter
     * @param {string} param Parameter name
     * @param {string} value Parameter value
     */
    setParam(param, value) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set(param, value);
        window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`);
    }
};

/**
 * Event handling utilities
 */
const eventUtils = {
    /**
     * Debounces function execution
     * @param {Function} func Function to debounce
     * @param {number} wait Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

/**
 * Navigation utilities
 */
const navUtils = {
    /**
     * Navigates to page with parameters
     * @param {string} page Page URL
     * @param {Object} params URL parameters
     */
    goToPage(page, params = {}) {
        const queryString = Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        window.location.href = `${page}${queryString ? '?' + queryString : ''}`;
    }
};

/**
 * Template utilities
 */
const templateUtils = {
    /**
     * Creates tournament card HTML
     * @param {Object} tournament Tournament data
     * @returns {string} HTML string
     */
    createTournamentCard(tournament) {
        return `
            <div class="tournament-card">
                <div class="tournament-header">
                    <h3>${tournament.name}</h3>
                    <span class="tournament-date">${formatUtils.formatDate(tournament.date)}</span>
                </div>
                <div class="tournament-content">
                    <div class="tournament-stats">
                        <span>${tournament.teams.length} Teams</span>
                        <span>${tournament.games.length} Games</span>
                    </div>
                    <div class="tournament-winner">
                        Winner: ${tournament.winner}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Creates game card HTML
     * @param {Object} game Game data
     * @returns {string} HTML string
     */
    createGameCard(game) {
        return `
            <div class="game-card">
                <div class="game-header">
                    <h4>${game.name}</h4>
                    <span class="game-multiplier">${game.multiplier}x</span>
                </div>
                <div class="game-content">
                    ${game.description || ''}
                </div>
            </div>
        `;
    }
};

// Export utilities
const utils = {
    api,
    score: scoreUtils,
    dom: domUtils,
    theme: themeUtils,
    format: formatUtils,
    url: urlUtils,
    event: eventUtils,
    nav: navUtils,
    template: templateUtils
};

export default utils;