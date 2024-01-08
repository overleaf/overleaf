import UserNotifications from '../../js/features/project-list/components/notifications/user-notifications'
import { ProjectListProvider } from '../../js/features/project-list/context/project-list-context'
import useFetchMock from '../hooks/use-fetch-mock'
import {
  commonSetupMocks,
  errorsMocks,
  fakeReconfirmationUsersData,
  institutionSetupMocks,
  reconfirmAffiliationSetupMocks,
  reconfirmationSetupMocks,
  setCommonMeta,
  setInstitutionMeta,
  setReconfirmAffiliationMeta,
  setReconfirmationMeta,
} from './helpers/emails'

export const ProjectInvite = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    templateKey: 'notification_project_invite',
    messageOpts: {
      projectId: '123',
      projectName: 'Abc Project',
      userName: 'fakeUser',
      token: 'abcdef',
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const ProjectInviteNetworkError = (args: any) => {
  useFetchMock(errorsMocks)
  setCommonMeta({
    templateKey: 'notification_project_invite',
    messageOpts: {
      projectId: '123',
      projectName: 'Abc Project',
      userName: 'fakeUser',
      token: 'abcdef',
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const Wfh2020UpgradeOffer = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    _id: 1,
    templateKey: 'wfh_2020_upgrade_offer',
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const IPMatchedAffiliationSsoEnabled = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    _id: 1,
    templateKey: 'notification_ip_matched_affiliation',
    messageOpts: {
      university_name: 'Abc University',
      institutionId: '456',
      ssoEnabled: true,
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const IPMatchedAffiliationSsoDisabled = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    _id: 1,
    templateKey: 'notification_ip_matched_affiliation',
    messageOpts: {
      university_name: 'Abc University',
      institutionId: '456',
      ssoEnabled: false,
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const TpdsFileLimit = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    _id: 1,
    templateKey: 'notification_tpds_file_limit',
    messageOpts: {
      projectName: 'Abc Project',
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const DropBoxDuplicateProjectNames = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    _id: 1,
    templateKey: 'notification_dropbox_duplicate_project_names',
    messageOpts: {
      projectName: 'Abc Project',
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const DropBoxUnlinkedDueToLapsedReconfirmation = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    _id: 1,
    templateKey: 'notification_dropbox_unlinked_due_to_lapsed_reconfirmation',
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const NotificationGroupInvitation = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    _id: 1,
    templateKey: 'notification_group_invitation',
    messageOpts: {
      inviterName: 'John Doe',
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const NotificationGroupInvitationCancelSubscription = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({
    _id: 1,
    templateKey: 'notification_group_invitation',
    messageOpts: {
      inviterName: 'John Doe',
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  window.metaAttributesCache.set('ol-hasIndividualRecurlySubscription', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const NonSpecificMessage = (args: any) => {
  useFetchMock(commonSetupMocks)
  setCommonMeta({ _id: 1, html: 'Non specific message' })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const InstitutionSsoAvailable = (args: any) => {
  useFetchMock(institutionSetupMocks)
  setInstitutionMeta({
    _id: 1,
    templateKey: 'notification_institution_sso_available',
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const InstitutionSsoLinked = (args: any) => {
  useFetchMock(institutionSetupMocks)
  setInstitutionMeta({
    _id: 1,
    templateKey: 'notification_institution_sso_linked',
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const InstitutionSsoNonCanonical = (args: any) => {
  useFetchMock(institutionSetupMocks)
  setInstitutionMeta({
    _id: 1,
    templateKey: 'notification_institution_sso_non_canonical',
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const InstitutionSsoAlreadyRegistered = (args: any) => {
  useFetchMock(institutionSetupMocks)
  setInstitutionMeta({
    _id: 1,
    templateKey: 'notification_institution_sso_already_registered',
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const InstitutionSsoError = (args: any) => {
  useFetchMock(institutionSetupMocks)
  setInstitutionMeta({
    templateKey: 'notification_institution_sso_error',
    error: {
      message: 'message',
      translatedMessage: 'Translated Message',
      tryAgain: true,
    },
  })
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const ResendConfirmationEmail = (args: any) => {
  useFetchMock(reconfirmationSetupMocks)
  setReconfirmationMeta()
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const ResendConfirmationEmailNetworkError = (args: any) => {
  useFetchMock(errorsMocks)
  setReconfirmationMeta()
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const ReconfirmAffiliation = (args: any) => {
  useFetchMock(reconfirmAffiliationSetupMocks)
  setReconfirmAffiliationMeta()
  window.metaAttributesCache.set('ol-allInReconfirmNotificationPeriods', [
    fakeReconfirmationUsersData,
  ])
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const ReconfirmAffiliationNetworkError = (args: any) => {
  useFetchMock(errorsMocks)
  setReconfirmAffiliationMeta()
  window.metaAttributesCache.set('ol-allInReconfirmNotificationPeriods', [
    fakeReconfirmationUsersData,
  ])
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export const ReconfirmedAffiliationSuccess = (args: any) => {
  useFetchMock(reconfirmAffiliationSetupMocks)
  setReconfirmAffiliationMeta()
  window.metaAttributesCache.set('ol-userEmails', [fakeReconfirmationUsersData])
  window.metaAttributesCache.set('ol-newNotificationStyle', true)
  return (
    <ProjectListProvider>
      <UserNotifications {...args} />
    </ProjectListProvider>
  )
}

export default {
  title: 'Project List / Notifications New Style',
  component: UserNotifications,
}
