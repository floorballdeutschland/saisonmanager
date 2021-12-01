
export interface League {
  id: number
  game_operation_id: number
  game_operation_name: string
  league_category_id: string
  league_class_id: string
  league_system_id: string
  name: string
  female: boolean
  enable_scorer: boolean
  short_name: string
  season_id: string
  order_key: string
  game_day_numbers: number[]
  similar_leagues?: League[]
}
