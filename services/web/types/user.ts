export type User = {
  id: string
  email: string
  allowedFreeTrial?: boolean
  features?: Record<string, boolean>
}

export type MongoUser = Pick<User, Exclude<keyof User, 'id'>> & { _id: string }
