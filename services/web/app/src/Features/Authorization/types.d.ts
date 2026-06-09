type ValueOf<T> = T[keyof T]

export const SourcesType = {
  INVITE: 'invite',
  TOKEN: 'token',
  OWNER: 'owner',
} as const

export type Source = ValueOf<typeof SourcesType>

export const PrivilegeLevelsType = {
  NONE: false,
  READ_ONLY: 'readOnly',
  READ_AND_WRITE: 'readAndWrite',
  REVIEW: 'review',
  OWNER: 'owner',
} as const

export type PrivilegeLevel = ValueOf<typeof PrivilegeLevelsType>

export const PublicAccessLevelsType = {
  READ_ONLY: 'readOnly', // LEGACY
  READ_AND_WRITE: 'readAndWrite', // LEGACY
  PRIVATE: 'private',
  TOKEN_BASED: 'tokenBased',
} as const

export type PublicAccessLevel = ValueOf<typeof PublicAccessLevelsType>

export function isPrivilegeUpgrade(
  currentLevel: PrivilegeLevel,
  newLevel: PrivilegeLevel
): boolean
