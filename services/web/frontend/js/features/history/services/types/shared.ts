export interface User {
  first_name: string
  last_name: string
  email: string
  id: string
}

export interface Meta {
  users: User[]
  start_ts: number
  end_ts: number
}
