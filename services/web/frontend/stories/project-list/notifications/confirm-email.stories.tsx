import { SplitTestProvider } from '@/shared/context/split-test-context'
import UserNotifications from '../../../js/features/project-list/components/notifications/user-notifications'
import { ProjectListProvider } from '../../../js/features/project-list/context/project-list-context'
import { useMeta } from '../../hooks/use-meta'
import useFetchMock from '../../hooks/use-fetch-mock'
import ConfirmEmailNotification from '@/features/project-list/components/notifications/groups/confirm-email'

export const ConfirmEmail = (args: any) => {
  useMeta({
    'ol-userEmails': [
      {
        email: 'erika.mustermann+unconfirmed-primary@example.com',
        default: true,
      },
      { email: 'erika.mustermann+unconfirmed@example.com' },
      {
        email: 'erika.mustermann+untrusted@example.com',
        lastConfirmedAt: '2019-01-01',
        confirmedAt: '2019-01-01',
      },
      {
        email: 'erika.mustermann+mit@example.com',
        affiliation: {
          institution: {
            id: 123,
            name: 'Massachusetts Institute of Technology',
            confirmed: true,
            commonsAccount: true,
          },
        },
      },
    ],
    'ol-user': { signUpDate: '2021-01-01' },
    'ol-usersBestSubscription': { type: 'free' },
    'ol-prefetchedProjectsBlob': { totalSize: 20 },
  })
  useFetchMock(fetchMock => {
    fetchMock.post('/user/emails/send-confirmation-code', args.statusCode, {
      delay: 500,
    })
    fetchMock.post('/user/emails/confirm-code', args.statusCode, {
      delay: 500,
    })
    fetchMock.post('/user/emails/resend-confirmation-code', args.statusCode, {
      delay: 500,
    })
  })
  return (
    <SplitTestProvider>
      <ProjectListProvider>
        <UserNotifications {...args} />
      </ProjectListProvider>
    </SplitTestProvider>
  )
}

export default {
  title: 'Project List / Notifications',
  component: ConfirmEmailNotification,
  args: {
    statusCode: 200,
  },
  argTypes: {
    statusCode: { type: 'select', options: [200, 400, 429] },
  },
}
