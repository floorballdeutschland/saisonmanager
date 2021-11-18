
export interface GameEvent {
    row: number
    time: string
    period: number
    home_goals: number
    guest_goals: number
    home_assist: number
    home_number: number
    penalty_id: string
    penalty_code_id: string
    guest_number?: number
    guest_assist?: number
}

export interface GamePlayerEntry {
    player_id: number
    goalkeeper?: boolean
    player_name: string
    trikot_number: number
    player_firstname: string
    captain?: boolean
}

export interface GamePlayers {
    home: GamePlayerEntry[]
    guest: GamePlayerEntry[]
}

export interface Game {
    id: number
    game_number: string
    start_time: string
    audience: number
    home_team_name: string
    guest_team_name: string
    events: GameEvent[]
    players: GamePlayers
    referees: string
    location: string
}
