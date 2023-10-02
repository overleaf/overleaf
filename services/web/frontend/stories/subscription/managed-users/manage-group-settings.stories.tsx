import GroupSettings from '../../../../modules/managed-users/frontend/js/components/group-settings'
import { useMeta } from '../../hooks/use-meta'
import useFetchMock from '../../hooks/use-fetch-mock'

export const GroupSettingsWithManagedUsersDisabledAndNoSSOFeature = () => {
  useMeta({
    'ol-managedUsersEnabled': false,
    'ol-hasGroupSSOFeature': false,
  })
  return <GroupSettings />
}

export const GroupSettingsWithManagedUsersDisabledAndSSOFeature = () => {
  useFetchMock(fetchMock =>
    fetchMock.get('express:/manage/groups/:id/settings/sso', {})
  )
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

export const GroupSettingsWithManagedUsersEnabledAndSSOFeatureNotConfigured =
  () => {
    useMeta({
      'ol-managedUsersEnabled': true,
      'ol-hasGroupSSOFeature': true,
    })
    useFetchMock(fetchMock => {
      fetchMock.get(
        'express:/manage/groups/:id/settings/sso',
        {},
        {
          delay: 500,
        }
      )
    })
    return <GroupSettings />
  }

export const GroupSettingsWithManagedUsersEnabledAndSSOFeatureConfigured =
  () => {
    const config = {
      entryPoint: 'http://idp.example.com/entry_point',
      certificate:
        'X1JQa2tWQmYzYlN1aUZORVhzZGpURVp3c0U4T3J3bWtjYVZsQ2h4MkRyRUpOVGtxV2hXcG9KbG1WZ2hYclB1YUVNeFVjM0pFZW5Zd1dQRzB5bldxWm5xYm5IdEJ5d1VGQlQ2RWJ1bHdQeJ0VmpoMkFUeHlIaE5KUVBqYm1iUlB1ckZjQnZzRzlZWW5RZVpYU3pKd3V3Z1l3cE5ZeE9XZkx5ZlVJZGVKQk5JkFUeHlIaE5KUV',
      signatureAlgorithm: 'sha256',
      userIdAttribute: 'email',
      enabled: true,
    }
    useFetchMock(fetchMock => {
      fetchMock.get('express:/manage/groups/:id/settings/sso', config, {
        delay: 500,
      })
    })

    useMeta({
      'ol-managedUsersEnabled': true,
      'ol-hasGroupSSOFeature': true,
    })
    return <GroupSettings />
  }

export const GroupSettingsWithManagedUsersDisabledAndSSOFeatureConfigured =
  () => {
    const config = {
      entryPoint: 'http://idp.example.com/entry_point',
      certificate:
        'X1JQa2tWQmYzYlN1aUZORVhzZGpURVp3c0U4T3J3bWtjYVZsQ2h4MkRyRUpOVGtxV2hXcG9KbG1WZ2hYclB1YUVNeFVjM0pFZW5Zd1dQRzB5bldxWm5xYm5IdEJ5d1VGQlQ2RWJ1bHdQeJ0VmpoMkFUeHlIaE5KUVBqYm1iUlB1ckZjQnZzRzlZWW5RZVpYU3pKd3V3Z1l3cE5ZeE9XZkx5ZlVJZGVKQk5JkFUeHlIaE5KUV',
      signatureAlgorithm: 'sha256',
      userIdAttribute: 'email',
      enabled: false,
    }
    useFetchMock(fetchMock => {
      fetchMock.get('express:/manage/groups/:id/settings/sso', config, {
        delay: 500,
      })
    })

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
