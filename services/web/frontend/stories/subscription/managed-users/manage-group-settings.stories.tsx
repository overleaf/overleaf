import GroupSettings from '../../../../modules/managed-users/frontend/js/components/group-settings'
import { useMeta } from '../../hooks/use-meta'

export const GroupSettingsWithManagedUsersDisabledAndNoSSOFeature = () => {
  useMeta({
    'ol-managedUsersEnabled': false,
    'ol-hasGroupSSOFeature': false,
  })
  return <GroupSettings />
}

export const GroupSettingsWithManagedUsersDisabledAndSSOFeature = () => {
  useMeta({
    'ol-managedUsersEnabled': false,
    'ol-hasGroupSSOFeature': true,
  })
  return <GroupSettings />
}

export const GroupSettingsWithManagedUsersEnabledAndNoSSOFeature = () => {
  useMeta({
    'ol-managedUsersEnabled': true,
    'ol-hasGroupSSOFeature': false,
  })
  return <GroupSettings />
}

export const GroupSettingsWithManagedUsersEnabledAndSSOFeature = () => {
  useMeta({
    'ol-managedUsersEnabled': true,
    'ol-hasGroupSSOFeature': true,
  })
  return <GroupSettings />
}

export default {
  title: 'Subscription / Managed Users',
  component: GroupSettings,
}
