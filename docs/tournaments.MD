# Floggerz Stats Documentation

## Project Structure

```
lopensed.github.io/
├── data/                           # Data directory
│   ├── tournament-screenshots/     # Tournament screenshots storage
│   │   └── MccF{1..12}/          # Individual tournament folders
│   │       ├── index.json         # Screenshots listing
│   │       └── *.jpg              # Screenshot files
│   ├── players.json               # Player identities and IDs
│   └── stats.json                 # Tournament statistics
│
├── docs/                          # Documentation
│   ├── stats_template.json        # Template for new tournaments
│   └── tournaments.MD             # Documentation guide
│
├── hof.html                      # Hall of Fame page
├── hof.js                        # Hall of Fame functionality
├── index.html                    # Main leaderboard page
├── navigation.html               # Navigation/search page
├── navigation.js                 # Navigation/search functionality
├── player-stats.html             # Individual player statistics
├── player-stats.js               # Player statistics handling
├── script.js                     # Main leaderboard functionality
├── styles.css                    # Global styles
├── team-stats.html               # Team statistics
├── team-stats.js                 # Team statistics handling
├── tournaments.html              # Tournament details
├── tournaments.js                # Tournament details handling
├── utils.js                      # Shared utilities
├── favicon.ico                    # Site favicon (32x32)
├── LICENSE                       # GNU General Public License v3
└── README.MD                     # Project overview
```

## Core Components

### Data Management
- `stats.json`: Primary data store for all tournament information
- `players.json`: Player identity management
- `stats_template.json`: Template for adding new tournaments

### Pages
- Leaderboard: Global rankings and filtering
- Hall of Fame: Record tracking and achievements
- Navigation: Search and browse functionality
- Player Stats: Individual performance tracking
- Team Stats: Team performance analytics
- Tournament Details: Tournament information

## Additional Documentation

### Screenshot System
Tournament screenshots are stored in `/data/tournament-screenshots/[TournamentName]/`. Each tournament folder should contain:
- An `index.json` file listing all screenshots
- The screenshot files (jpg/png format)

[
    "screenshot1.jpg",
    "screenshot2.jpg"
]

### Data Structure

#### Tournament Data (`stats.json`)
Each tournament contains:
- Winners
- Game list with order and multipliers
- Teams with players and their scores

Example structure:
```json
{
  "tournaments": {
    "TournamentName": {
      "winners": "Team Name",
      "games": {
        "GameName": {
          "order": 1,
          "multiplier": 1.0
        }
      },
      "teams": [
        {
          "name": "Team Name",
          "players": [
            {
              "name": "PlayerName",
              "scores": {
                "GameName": [score1, score2, ...]
              }
            }
          ]
        }
      ]
    }
  }
}
```

#### Player Data (`players.json`)
Links player names to their:
- Minecraft UUID
- Discord ID

```json
{
  "users": [
    {
      "username": "PlayerName",
      "mcUUID": "Minecraft UUID",
      "discordID": "Discord ID"
    }
  ]
}
```

### Canon vs Non-Canon Events
Tournament events are marked as either canon or non-canon in the tournament data. Only canon events should be counted towards overall statistics, records, and rankings. Non-canon events are stored for historical purposes but must be excluded from:

- Global leaderboards (unless explicitly showing all events)
- Player statistics and averages
- Team performance metrics
- Hall of Fame records
- Achievement calculations

Non-canon events should be clearly marked in the UI to distinguish them from canon events. When displaying tournament history, non-canon events should be included but visually differentiated and not factored into aggregate statistics.

