import customLocalStorage from '@/infrastructure/local-storage'
import getMeta from '@/utils/meta'
import {
  RefProviderSettings,
  UserSettings,
} from '../../../../types/user-settings'

type RefProvider = 'mendeley' | 'zotero' | 'papers'

const providers: RefProvider[] = ['mendeley', 'zotero', 'papers']

const buildLegacyKey = (userId: string, provider: RefProvider, key: string) =>
  `user.${userId}.write-and-cite.${provider}.${key}`

const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean'

const parseGroups = (value: unknown): { id: string }[] | undefined => {
  return Array.isArray(value)
    ? (value as { id: string | number }[]).map(group => ({
        id: typeof group.id === 'number' ? String(group.id) : group.id,
      }))
    : undefined
}

export type LegacyWriteAndCiteMigration = {
  patch: Partial<Pick<UserSettings, 'mendeley' | 'zotero' | 'papers'>>
  keysToRemove: string[]
}

export const getLegacyWriteAndCiteMigration = (
  userSettings: UserSettings
): LegacyWriteAndCiteMigration => {
  const userId = getMeta('ol-user_id')
  if (!userId) {
    return {
      patch: {},
      keysToRemove: [],
    }
  }

  const patch: LegacyWriteAndCiteMigration['patch'] = {}
  const keysToRemove: string[] = []

  for (const provider of providers) {
    const currentProviderSettings = userSettings[provider]

    if (currentProviderSettings.migrated) {
      continue
    }

    const enabledKey = buildLegacyKey(userId, provider, 'enabled')
    const groupsKey = buildLegacyKey(userId, provider, 'groups')
    const disablePersonalLibraryKey = buildLegacyKey(
      userId,
      provider,
      'disablePersonalLibrary'
    )

    const enabledValue = customLocalStorage.getItem(enabledKey)
    const groupsValue = customLocalStorage.getItem(groupsKey)
    const disablePersonalLibraryValue = customLocalStorage.getItem(
      disablePersonalLibraryKey
    )

    // Storage.getItem returns null if the key does not exist
    const hasEnabledValue = enabledValue !== null
    const hasGroupsValue = groupsValue !== null
    const hasDisablePersonalLibraryValue = disablePersonalLibraryValue !== null

    if (
      !hasEnabledValue &&
      !hasGroupsValue &&
      !hasDisablePersonalLibraryValue
    ) {
      continue
    }

    const nextProviderSettings: RefProviderSettings = {
      enabled: isBoolean(enabledValue)
        ? enabledValue
        : currentProviderSettings.enabled,
      groups: parseGroups(groupsValue) ?? currentProviderSettings.groups,
      disablePersonalLibrary: isBoolean(disablePersonalLibraryValue)
        ? disablePersonalLibraryValue
        : currentProviderSettings.disablePersonalLibrary,
      migrated: true,
    }

    patch[provider] = nextProviderSettings

    keysToRemove.push(enabledKey, groupsKey, disablePersonalLibraryKey)
  }

  return {
    patch,
    keysToRemove: [],
  }
}
