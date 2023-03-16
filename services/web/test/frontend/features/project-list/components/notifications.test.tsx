import { expect } from 'chai'
import sinon from 'sinon'
import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { merge, cloneDeep } from 'lodash'
import {
  professionalUserData,
  unconfirmedUserData,
} from '../../settings/fixtures/test-user-email-data'
import {
  notification,
  notificationsInstitution,
} from '../fixtures/notifications-data'
import Common from '../../../../../frontend/js/features/project-list/components/notifications/groups/common'
import Institution from '../../../../../frontend/js/features/project-list/components/notifications/groups/institution'
import ConfirmEmail from '../../../../../frontend/js/features/project-list/components/notifications/groups/confirm-email'
import ReconfirmationInfo from '../../../../../frontend/js/features/project-list/components/notifications/groups/affiliation/reconfirmation-info'
import { ProjectListProvider } from '../../../../../frontend/js/features/project-list/context/project-list-context'
import {
  Notification,
  Institution as InstitutionType,
} from '../../../../../types/project/dashboard/notification'
import { DeepPartial } from '../../../../../types/utils'
import { Project } from '../../../../../types/project/dashboard/api'
import GroupsAndEnterpriseBanner from '../../../../../frontend/js/features/project-list/components/notifications/groups-and-enterprise-banner'
import localStorage from '../../../../../frontend/js/infrastructure/local-storage'
import * as useLocationModule from '../../../../../frontend/js/shared/hooks/use-location'

const renderWithinProjectListProvider = (Component: React.ComponentType) => {
  render(<Component />, {
    wrapper: ({ children }) => (
      <ProjectListProvider>
        <ul className="list-unstyled">{children}</ul>
      </ProjectListProvider>
    ),
  })
}

describe('<UserNotifications />', function () {
  const exposedSettings = {
    samlInitPath: '/fakeSaml/',
    appName: 'Overleaf',
  }

  beforeEach(function () {
    window.metaAttributesCache = window.metaAttributesCache || new Map()
    fetchMock.reset()

    // at least one project is required to show some notifications
    const projects = [{}] as Project[]
    fetchMock.post(/\/api\/project/, {
      status: 200,
      body: {
        projects,
        totalSize: projects.length,
      },
    })
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    fetchMock.reset()
  })

  describe('<Common>', function () {
    beforeEach(function () {
      window.metaAttributesCache = window.metaAttributesCache || new Map()
      window.metaAttributesCache.set('ol-ExposedSettings', exposedSettings)
    })

    afterEach(function () {
      window.metaAttributesCache = new Map()
      fetchMock.reset()
    })

    it('accepts project invite', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        _id: 1,
        templateKey: 'notification_project_invite',
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)

      const deleteMock = fetchMock.delete(
        `/notifications/${reconfiguredNotification._id}`,
        200
      )
      const acceptMock = fetchMock.post(
        `project/${notification.messageOpts.projectId}/invite/token/${notification.messageOpts.token}/accept`,
        200
      )

      screen.getByRole('alert')
      screen.getByText(/would like you to join/i)

      const joinBtn = screen.getByRole('button', {
        name: /join project/i,
      }) as HTMLButtonElement

      expect(joinBtn.disabled).to.be.false

      fireEvent.click(joinBtn)

      expect(joinBtn.disabled).to.be.true

      await waitForElementToBeRemoved(() =>
        screen.getByRole('button', { name: /joining/i })
      )

      expect(acceptMock.called()).to.be.true
      screen.getByText(/joined/i)
      expect(screen.queryByRole('button', { name: /join project/i })).to.be.null

      const openProject = screen.getByRole('link', { name: /open project/i })
      expect(openProject.getAttribute('href')).to.equal(
        `/project/${notification.messageOpts.projectId}`
      )

      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(deleteMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('fails to accept project invite', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        _id: 1,
        templateKey: 'notification_project_invite',
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)
      fetchMock.post(
        `project/${notification.messageOpts.projectId}/invite/token/${notification.messageOpts.token}/accept`,
        500
      )

      screen.getByRole('alert')
      screen.getByText(/would like you to join/i)

      const joinBtn = screen.getByRole('button', {
        name: /join project/i,
      }) as HTMLButtonElement

      fireEvent.click(joinBtn)

      await waitForElementToBeRemoved(() =>
        screen.getByRole('button', { name: /joining/i })
      )

      expect(fetchMock.called()).to.be.true
      screen.getByRole('button', { name: /join project/i })
      expect(screen.queryByRole('link', { name: /open project/i })).to.be.null
    })

    it('shows WFH2020', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        _id: 1,
        templateKey: 'wfh_2020_upgrade_offer',
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)
      fetchMock.delete(`/notifications/${reconfiguredNotification._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(/your free WFH2020 upgrade came to an end on/i)

      const viewLink = screen.getByRole('link', { name: /view/i })
      expect(viewLink.getAttribute('href')).to.equal(
        'https://www.overleaf.com/events/wfh2020'
      )
      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows IP matched affiliation with SSO enabled', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        _id: 1,
        templateKey: 'notification_ip_matched_affiliation',
        messageOpts: { ssoEnabled: true },
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)
      fetchMock.delete(`/notifications/${reconfiguredNotification._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(/it looks like you’re at/i)
      screen.getByText(/you can now log in through your institution/i)
      screen.getByText(
        /link an institutional email address to your account to get started/i
      )

      const findOutMore = screen.getByRole('link', { name: /find out more/i })
      expect(findOutMore.getAttribute('href')).to.equal(
        'https://www.overleaf.com/learn/how-to/Institutional_Login'
      )
      const linkAccount = screen.getByRole('link', { name: /link account/i })
      expect(linkAccount.getAttribute('href')).to.equal(
        `${exposedSettings.samlInitPath}?university_id=${notification.messageOpts.institutionId}&auto=/project`
      )
      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows IP matched affiliation with SSO disabled', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        _id: 1,
        templateKey: 'notification_ip_matched_affiliation',
        messageOpts: { ssoEnabled: false },
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)
      fetchMock.delete(`/notifications/${reconfiguredNotification._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(/it looks like you’re at/i)
      screen.getByText(/did you know that/i)
      screen.getByText(
        /add an institutional email address to claim your features/i
      )

      const addAffiliation = screen.getByRole('link', {
        name: /add affiliation/i,
      })
      expect(addAffiliation.getAttribute('href')).to.equal(`/user/settings`)
      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows tpds file limit', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        templateKey: 'notification_tpds_file_limit',
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)

      screen.getByRole('alert')
      screen.getByText(/file limit/i)
      screen.getByText(
        /please decrease the size of your project to prevent further errors/i
      )

      const accountSettings = screen.getByRole('link', {
        name: /account settings/i,
      })
      expect(accountSettings.getAttribute('href')).to.equal('/user/settings')
      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows dropbox duplicate project names warning', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        _id: 1,
        templateKey: 'notification_dropbox_duplicate_project_names',
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)
      fetchMock.delete(`/notifications/${reconfiguredNotification._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(/you have more than one project called/i)
      screen.getByText(/make your project names unique/i)

      const learnMore = screen.getByRole('link', { name: /learn more/i })
      expect(learnMore.getAttribute('href')).to.equal(
        '/learn/how-to/Dropbox_Synchronization#Troubleshooting'
      )
      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows dropbox unlinked tue to lapsed reconfirmation', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        _id: 1,
        templateKey:
          'notification_dropbox_unlinked_due_to_lapsed_reconfirmation',
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)
      fetchMock.delete(`/notifications/${reconfiguredNotification._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(/your Dropbox account has been unlinked/i)
      screen.getByText(
        /confirm you are still at the institution and on their license, or upgrade your account in order to relink your dropbox account/i
      )

      const learnMore = screen.getByRole('link', { name: /learn more/i })
      expect(learnMore.getAttribute('href')).to.equal(
        '/learn/how-to/Institutional_Email_Reconfirmation'
      )
      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows non specific notification', async function () {
      const reconfiguredNotification: DeepPartial<Notification> = {
        _id: 1,
        html: 'unspecific message',
      }
      window.metaAttributesCache.set('ol-notifications', [
        merge(cloneDeep(notification), reconfiguredNotification),
      ])

      renderWithinProjectListProvider(Common)
      await fetchMock.flush(true)
      fetchMock.delete(`/notifications/${reconfiguredNotification._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(reconfiguredNotification.html!)

      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })
  })

  describe('<Institution>', function () {
    beforeEach(function () {
      window.metaAttributesCache = window.metaAttributesCache || new Map()
      window.metaAttributesCache.set('ol-ExposedSettings', exposedSettings)
      fetchMock.reset()
    })

    afterEach(function () {
      fetchMock.reset()
    })

    it('shows sso available', function () {
      const institution: DeepPartial<InstitutionType> = {
        templateKey: 'notification_institution_sso_available',
      }
      window.metaAttributesCache.set('ol-notificationsInstitution', [
        { ...notificationsInstitution, ...institution },
      ])
      render(<Institution />)

      screen.getByRole('alert')
      screen.getByText(/you can now link/i)
      screen.getByText(/doing this will allow you to log in/i)

      const learnMore = screen.getByRole('link', { name: /learn more/i })
      expect(learnMore.getAttribute('href')).to.equal(
        '/learn/how-to/Institutional_Login'
      )

      const action = screen.getByRole('link', { name: /link account/i })
      expect(action.getAttribute('href')).to.equal(
        `${exposedSettings.samlInitPath}?university_id=${notificationsInstitution.institutionId}&auto=/project&email=${notificationsInstitution.email}`
      )
    })

    it('shows sso linked', function () {
      const institution: DeepPartial<InstitutionType> = {
        _id: 1,
        templateKey: 'notification_institution_sso_linked',
      }
      window.metaAttributesCache.set('ol-notificationsInstitution', [
        { ...notificationsInstitution, ...institution },
      ])
      render(<Institution />)
      fetchMock.delete(`/notifications/${institution._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(/has been linked to your/i)

      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows sso non canonical', function () {
      const institution: DeepPartial<InstitutionType> = {
        _id: 1,
        templateKey: 'notification_institution_sso_non_canonical',
      }
      window.metaAttributesCache.set('ol-notificationsInstitution', [
        { ...notificationsInstitution, ...institution },
      ])
      render(<Institution />)
      fetchMock.delete(`/notifications/${institution._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(/you’ve tried to log in with/i)
      screen.getByText(
        /in order to match your institutional metadata, your account is associated with/i
      )

      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows sso already registered', function () {
      const institution: DeepPartial<InstitutionType> = {
        _id: 1,
        templateKey: 'notification_institution_sso_already_registered',
      }
      window.metaAttributesCache.set('ol-notificationsInstitution', [
        { ...notificationsInstitution, ...institution },
      ])
      render(<Institution />)
      fetchMock.delete(`/notifications/${institution._id}`, 200)

      screen.getByRole('alert')
      screen.getByText(/which is already registered with/i)

      const action = screen.getByRole('link', { name: /find out more/i })
      expect(action.getAttribute('href')).to.equal(
        '/learn/how-to/Institutional_Login'
      )

      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('shows sso error', function () {
      const institution: DeepPartial<InstitutionType> = {
        templateKey: 'notification_institution_sso_error',
        error: {
          message: 'fake message',
          tryAgain: true,
        },
      }
      window.metaAttributesCache.set('ol-notificationsInstitution', [
        { ...notificationsInstitution, ...institution },
      ])
      render(<Institution />)

      screen.getByRole('alert')
      screen.getByText(/something went wrong/i)
      screen.getByText(institution.error!.message!)
      screen.getByText(/please try again/i)

      const closeBtn = screen.getByRole('button', { name: /close/i })
      fireEvent.click(closeBtn)

      expect(screen.queryByRole('alert')).to.be.null
    })
  })

  describe('<ConfirmEmail/>', function () {
    beforeEach(async function () {
      window.metaAttributesCache.set('ol-ExposedSettings', {
        emailConfirmationDisabled: false,
      })
      window.metaAttributesCache.set('ol-userEmails', [unconfirmedUserData])

      renderWithinProjectListProvider(ConfirmEmail)
      await fetchMock.flush(true)
    })

    afterEach(function () {
      fetchMock.reset()
    })

    it('sends successfully', async function () {
      fetchMock.post('/user/emails/resend_confirmation', 200)

      const resendButton = screen.getByRole('button', { name: /resend/i })
      fireEvent.click(resendButton)

      expect(screen.queryByRole('button', { name: /resend/i })).to.be.null

      await waitForElementToBeRemoved(() =>
        screen.getByText(/resending confirmation email/i)
      )

      expect(fetchMock.called()).to.be.true
      expect(screen.queryByRole('alert')).to.be.null
    })

    it('fails to send', async function () {
      fetchMock.post('/user/emails/resend_confirmation', 500)

      const resendButton = screen.getByRole('button', { name: /resend/i })
      fireEvent.click(resendButton)

      await waitForElementToBeRemoved(() =>
        screen.getByText(/resending confirmation email/i)
      )

      expect(fetchMock.called()).to.be.true
      screen.getByText(/something went wrong/i)
    })
  })

  describe('<Affiliation/>', function () {
    let assignStub: sinon.SinonStub

    beforeEach(function () {
      window.metaAttributesCache = window.metaAttributesCache || new Map()
      window.metaAttributesCache.set('ol-ExposedSettings', exposedSettings)
      assignStub = sinon.stub()
      this.locationStub = sinon.stub(useLocationModule, 'useLocation').returns({
        assign: assignStub,
        reload: sinon.stub(),
      })
      fetchMock.reset()
    })

    afterEach(function () {
      window.metaAttributesCache = new Map()
      this.locationStub.restore()
      fetchMock.reset()
    })

    it('shows reconfirm message with SSO disabled', async function () {
      window.metaAttributesCache.set('ol-allInReconfirmNotificationPeriods', [
        { ...professionalUserData, samlProviderId: 'Saml Provider' },
      ])

      render(<ReconfirmationInfo />)
      screen.getByRole('alert')
      screen.getByText(
        /take a moment to confirm your institutional email address/i
      )

      const removeLink = screen.getByRole('link', { name: /remove it/i })
      expect(removeLink.getAttribute('href')).to.equal(
        `/user/settings?remove=${professionalUserData.email}`
      )
      const learnMore = screen.getByRole('link', { name: /learn more/i })
      expect(learnMore.getAttribute('href')).to.equal(
        '/learn/how-to/Institutional_Email_Reconfirmation'
      )

      const sendReconfirmationMock = fetchMock.post(
        '/user/emails/send-reconfirmation',
        200
      )
      fireEvent.click(
        screen.getByRole('button', { name: /confirm affiliation/i })
      )

      await waitForElementToBeRemoved(() => screen.getByText(/sending/i))
      screen.getByText(/check your email inbox to confirm/i)
      expect(screen.queryByRole('button', { name: /confirm affiliation/i })).to
        .be.null
      expect(screen.queryByRole('link', { name: /remove it/i })).to.be.null
      expect(screen.queryByRole('link', { name: /learn more/i })).to.be.null
      expect(sendReconfirmationMock.called()).to.be.true
      fireEvent.click(
        screen.getByRole('button', { name: /resend confirmation email/i })
      )
      await waitForElementToBeRemoved(() => screen.getByText(/sending/i))
      expect(sendReconfirmationMock.calls()).to.have.lengthOf(2)
    })

    it('shows reconfirm message with SSO enabled', async function () {
      window.metaAttributesCache.set('ol-allInReconfirmNotificationPeriods', [
        merge(cloneDeep(professionalUserData), {
          affiliation: { institution: { ssoEnabled: true } },
        }),
      ])
      render(<ReconfirmationInfo />)
      fireEvent.click(
        screen.getByRole('button', { name: /confirm affiliation/i })
      )
      sinon.assert.calledOnce(assignStub)
      sinon.assert.calledWithMatch(
        assignStub,
        `${exposedSettings.samlInitPath}?university_id=${professionalUserData.affiliation.institution.id}&reconfirm=/project`
      )
    })

    it('shows success reconfirmation message', function () {
      window.metaAttributesCache.set('ol-userEmails', [
        { ...professionalUserData, samlProviderId: 'Saml Provider' },
      ])
      window.metaAttributesCache.set('ol-reconfirmedViaSAML', 'Saml Provider')

      const { rerender } = render(<ReconfirmationInfo />)
      screen.getByRole('alert')
      screen.getByText(professionalUserData.affiliation!.institution!.name!)
      screen.getByText(/affiliation is confirmed/i)

      window.metaAttributesCache.set('ol-reconfirmedViaSAML', '')
      rerender(<ReconfirmationInfo />)
      expect(screen.queryByRole('alert')).to.be.null
    })
  })

  describe('<GroupsAndEnterpriseBanner />', function () {
    beforeEach(function () {
      window.metaAttributesCache = window.metaAttributesCache || new Map()
      localStorage.clear()
      fetchMock.reset()

      // at least one project is required to show some notifications
      const projects = [{}] as Project[]
      fetchMock.post(/\/api\/project/, {
        status: 200,
        body: {
          projects,
          totalSize: projects.length,
        },
      })

      window.metaAttributesCache.set(
        'ol-groupsAndEnterpriseBannerVariant',
        'did-you-know'
      )
    })

    afterEach(function () {
      fetchMock.reset()
      window.metaAttributesCache = window.metaAttributesCache || new Map()
    })

    it('does not show the banner for users that are in group or are affiliated', async function () {
      window.metaAttributesCache.set('ol-showGroupsAndEnterpriseBanner', false)

      renderWithinProjectListProvider(GroupsAndEnterpriseBanner)
      await fetchMock.flush(true)

      expect(screen.queryByRole('link', { name: 'Contact Sales' })).to.be.null
    })

    it('shows the banner for users that have dismissed the previous banners', async function () {
      window.metaAttributesCache.set('ol-showGroupsAndEnterpriseBanner', true)
      localStorage.setItem('has_dismissed_groups_and_enterprise_banner', true)

      renderWithinProjectListProvider(GroupsAndEnterpriseBanner)
      await fetchMock.flush(true)

      expect(screen.queryByRole('link', { name: 'Contact Sales' })).to.not.be
        .null
    })

    it('shows the banner for users that have dismissed the banner more than 30 days ago', async function () {
      const dismissed = new Date()
      dismissed.setDate(dismissed.getDate() - 31) // 31 days
      window.metaAttributesCache.set('ol-showGroupsAndEnterpriseBanner', true)
      localStorage.setItem(
        'has_dismissed_groups_and_enterprise_banner',
        dismissed
      )

      renderWithinProjectListProvider(GroupsAndEnterpriseBanner)
      await fetchMock.flush(true)

      expect(screen.queryByRole('link', { name: 'Contact Sales' })).to.not.be
        .null
    })

    it('does not show the banner for users that have dismissed the banner within the last 30 days', async function () {
      const dismissed = new Date()
      dismissed.setDate(dismissed.getDate() - 29) // 29 days
      window.metaAttributesCache.set('ol-showGroupsAndEnterpriseBanner', true)
      localStorage.setItem(
        'has_dismissed_groups_and_enterprise_banner',
        dismissed
      )

      renderWithinProjectListProvider(GroupsAndEnterpriseBanner)
      await fetchMock.flush(true)

      expect(screen.queryByRole('link', { name: 'Contact Sales' })).to.be.null
    })

    describe('users that are not in group and are not affiliated', function () {
      beforeEach(function () {
        localStorage.clear()
        fetchMock.reset()

        // at least one project is required to show some notifications
        const projects = [{}] as Project[]
        fetchMock.post(/\/api\/project/, {
          status: 200,
          body: {
            projects,
            totalSize: projects.length,
          },
        })

        window.metaAttributesCache.set('ol-showGroupsAndEnterpriseBanner', true)
      })

      afterEach(function () {
        fetchMock.reset()
        window.metaAttributesCache = window.metaAttributesCache || new Map()
      })

      after(function () {
        localStorage.clear()
      })

      it('will show the correct text for the `did-you-know` variant', async function () {
        window.metaAttributesCache.set(
          'ol-groupsAndEnterpriseBannerVariant',
          'did-you-know'
        )

        renderWithinProjectListProvider(GroupsAndEnterpriseBanner)
        await fetchMock.flush(true)

        screen.getByText(
          'Did you know that Overleaf offers group and organization-wide subscription options? Request information or a quote.'
        )
        const link = screen.getByRole('link', { name: 'Contact Sales' })

        expect(link.getAttribute('href')).to.equal(`/for/contact-sales-1`)
      })

      it('will show the correct text for the `on-premise` variant', async function () {
        window.metaAttributesCache.set(
          'ol-groupsAndEnterpriseBannerVariant',
          'on-premise'
        )

        renderWithinProjectListProvider(GroupsAndEnterpriseBanner)
        await fetchMock.flush(true)

        screen.getByText(
          'Overleaf On-Premises: Does your company want to keep its data within its firewall? Overleaf offers Server Pro, an on-premises solution for companies. Get in touch to learn more.'
        )
        const link = screen.getByRole('link', { name: 'Contact Sales' })

        expect(link.getAttribute('href')).to.equal(`/for/contact-sales-2`)
      })

      it('will show the correct text for the `people` variant', async function () {
        window.metaAttributesCache.set(
          'ol-groupsAndEnterpriseBannerVariant',
          'people'
        )

        renderWithinProjectListProvider(GroupsAndEnterpriseBanner)
        await fetchMock.flush(true)

        screen.getByText(
          'Other people at your company may already be using Overleaf. Save money with Overleaf group and company-wide subscriptions. Request more information.'
        )
        const link = screen.getByRole('link', { name: 'Contact Sales' })

        expect(link.getAttribute('href')).to.equal(`/for/contact-sales-3`)
      })

      it('will show the correct text for the `FOMO` variant', async function () {
        window.metaAttributesCache.set(
          'ol-groupsAndEnterpriseBannerVariant',
          'FOMO'
        )

        renderWithinProjectListProvider(GroupsAndEnterpriseBanner)
        await fetchMock.flush(true)

        screen.getByText(
          'Why do Fortune 500 companies and top research institutions trust Overleaf to streamline their collaboration? Get in touch to learn more.'
        )
        const link = screen.getByRole('link', { name: 'Contact Sales' })

        expect(link.getAttribute('href')).to.equal(`/for/contact-sales-4`)
      })
    })
  })
})
