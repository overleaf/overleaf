import { DeepReadonly } from '../../../../../types/utils'
import {
  Institution,
  Notification,
} from '../../../../../types/project/dashboard/notification'

export const notificationsInstitution = {
  email: 'email@example.com',
  institutionEmail: 'institution@example.com',
  institutionId: 123,
  institutionName: 'Abc Institution',
  requestedEmail: 'requested@example.com',
} as DeepReadonly<Institution>

export const notification = {
  messageOpts: {
    projectId: '123',
    projectName: 'Abc Project',
    ssoEnabled: false,
    institutionId: '456',
    userName: 'fakeUser',
    university_name: 'Abc University',
    token: 'abcdef',
  },
} as DeepReadonly<Notification>
