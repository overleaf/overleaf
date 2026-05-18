import { screen, render, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import userEvent from '@testing-library/user-event'
import { EditorProviders, PROJECT_ID } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/settings/context/settings-modal-context'
import ProjectNotificationsSetting from '@/features/settings/components/editor-settings/project-notifications-setting'

const preferencesUrl = `/notifications/preferences/project/${PROJECT_ID}`

const allNotificationsOn = {
  commentOnOwnProject: true,
  commentOnInvitedProject: true,
  repliesOnAuthoredThread: true,
  repliesOnParticipatingThread: true,
  commentResolvedOnAuthoredThread: true,
  commentResolvedOnParticipatingThread: true,
  commentReopenedOnAuthoredThread: true,
  commentReopenedOnParticipatingThread: true,
  trackedChangesOnOwnProject: true,
  trackedChangesOnInvitedProject: true,
  trackChangesAcceptedOnAuthoredChange: true,
  trackChangesRejectedOnAuthoredChange: true,
}

const repliesOnlyPreferences = {
  commentOnOwnProject: false,
  commentOnInvitedProject: false,
  repliesOnAuthoredThread: true,
  repliesOnParticipatingThread: true,
  commentResolvedOnAuthoredThread: true,
  commentResolvedOnParticipatingThread: true,
  commentReopenedOnAuthoredThread: true,
  commentReopenedOnParticipatingThread: true,
  trackedChangesOnOwnProject: false,
  trackedChangesOnInvitedProject: false,
  trackChangesAcceptedOnAuthoredChange: true,
  trackChangesRejectedOnAuthoredChange: true,
}

const globallyMutedPreferences = {
  trackedChangesOnOwnProject: false,
  trackedChangesOnInvitedProject: false,
  commentOnOwnProject: false,
  commentOnInvitedProject: false,
  repliesOnAuthoredThread: false,
  repliesOnParticipatingThread: false,
  muteAllNotifications: true,
  commentResolvedOnAuthoredThread: false,
  commentResolvedOnParticipatingThread: false,
  commentReopenedOnAuthoredThread: false,
  commentReopenedOnParticipatingThread: false,
  trackChangesAcceptedOnAuthoredChange: false,
  trackChangesRejectedOnAuthoredChange: false,
}

const allNotificationsOff = {
  commentOnOwnProject: false,
  commentOnInvitedProject: false,
  repliesOnAuthoredThread: false,
  repliesOnParticipatingThread: false,
  commentResolvedOnAuthoredThread: false,
  commentResolvedOnParticipatingThread: false,
  commentReopenedOnAuthoredThread: false,
  commentReopenedOnParticipatingThread: false,
  trackedChangesOnOwnProject: false,
  trackedChangesOnInvitedProject: false,
  trackChangesAcceptedOnAuthoredChange: false,
  trackChangesRejectedOnAuthoredChange: false,
}

const defaultPreferences = {
  trackedChangesOnOwnProject: true,
  trackedChangesOnInvitedProject: false,
  commentOnOwnProject: true,
  commentOnInvitedProject: false,
  repliesOnAuthoredThread: true,
  repliesOnParticipatingThread: true,
  muteAllNotifications: false,
  commentResolvedOnAuthoredThread: true,
  commentResolvedOnParticipatingThread: true,
  commentReopenedOnAuthoredThread: true,
  commentReopenedOnParticipatingThread: true,
  trackChangesAcceptedOnAuthoredChange: true,
}

function renderComponent(props: { permissionsLevel?: string } = {}) {
  return render(
    <EditorProviders permissionsLevel={props.permissionsLevel as any}>
      <SettingsModalProvider>
        <ProjectNotificationsSetting />
      </SettingsModalProvider>
    </EditorProviders>
  )
}

describe('<ProjectNotificationsSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows loading indicator while preferences are loading', async function () {
    fetchMock.get(preferencesUrl, new Promise(() => {}))

    renderComponent()

    expect(await screen.findByRole('status')).to.exist
    expect(screen.queryByLabelText('All project activity', { exact: false })).to
      .not.exist
  })

  it('selects "All project activity" when all notifications are on', async function () {
    fetchMock.get(preferencesUrl, allNotificationsOn)

    renderComponent()

    await waitFor(
      () =>
        expect(
          (
            screen.getByLabelText('All project activity', {
              exact: false,
            }) as HTMLInputElement
          ).checked
        ).to.be.true
    )
    expect(
      (
        screen.getByLabelText('Replies to your activity only', {
          exact: false,
        }) as HTMLInputElement
      ).checked
    ).to.be.false
    expect(
      (screen.getByLabelText('Off', { exact: false }) as HTMLInputElement)
        .checked
    ).to.be.false
  })

  it('selects "Replies to your activity only" when only reply notifications are on', async function () {
    fetchMock.get(preferencesUrl, repliesOnlyPreferences)

    renderComponent()

    await waitFor(
      () =>
        expect(
          (
            screen.getByLabelText('Replies to your activity only', {
              exact: false,
            }) as HTMLInputElement
          ).checked
        ).to.be.true
    )
    expect(
      (
        screen.getByLabelText('All project activity', {
          exact: false,
        }) as HTMLInputElement
      ).checked
    ).to.be.false
    expect(
      (screen.getByLabelText('Off', { exact: false }) as HTMLInputElement)
        .checked
    ).to.be.false
  })

  it('selects "Off" when all notifications are off', async function () {
    fetchMock.get(preferencesUrl, allNotificationsOff)

    renderComponent()

    await waitFor(
      () =>
        expect(
          (screen.getByLabelText('Off', { exact: false }) as HTMLInputElement)
            .checked
        ).to.be.true
    )
    expect(
      (
        screen.getByLabelText('All project activity', {
          exact: false,
        }) as HTMLInputElement
      ).checked
    ).to.be.false
    expect(
      (
        screen.getByLabelText('Replies to your activity only', {
          exact: false,
        }) as HTMLInputElement
      ).checked
    ).to.be.false
  })

  it('shows muted message and hides radio buttons when muteAllNotifications is true', async function () {
    fetchMock.get(preferencesUrl, globallyMutedPreferences)

    renderComponent()

    await waitFor(
      () =>
        expect(
          screen.getByText(
            'You are not receiving any notifications, as you have disabled all project notifications.',
            { exact: false }
          )
        ).to.exist
    )
    expect(
      screen.getByRole('link', { name: 'Change settings' }).getAttribute('href')
    ).to.equal('/user/notification-preferences')
    expect(screen.queryByLabelText('All project activity', { exact: false })).to
      .not.exist
    expect(
      screen.queryByLabelText('Replies to your activity only', { exact: false })
    ).to.not.exist
    expect(screen.queryByLabelText('Off', { exact: false })).to.not.exist
  })

  it('POSTs "replies" preferences when "Replies to your activity only" is selected', async function () {
    fetchMock.get(preferencesUrl, allNotificationsOn)
    const saveMock = fetchMock.post(preferencesUrl, { status: 200 })

    renderComponent()

    await waitFor(
      () =>
        expect(
          (
            screen.getByLabelText('All project activity', {
              exact: false,
            }) as HTMLInputElement
          ).checked
        ).to.be.true
    )

    await userEvent.click(
      screen.getByLabelText('Replies to your activity only', { exact: false })
    )

    expect(
      saveMock.callHistory.called(preferencesUrl, {
        body: repliesOnlyPreferences,
      })
    ).to.be.true
  })

  it('POSTs "off" preferences when "Off" is selected', async function () {
    fetchMock.get(preferencesUrl, allNotificationsOn)
    const saveMock = fetchMock.post(preferencesUrl, { status: 200 })

    renderComponent()

    await waitFor(
      () =>
        expect(
          (
            screen.getByLabelText('All project activity', {
              exact: false,
            }) as HTMLInputElement
          ).checked
        ).to.be.true
    )

    await userEvent.click(screen.getByLabelText('Off', { exact: false }))

    expect(
      saveMock.callHistory.called(preferencesUrl, {
        body: allNotificationsOff,
      })
    ).to.be.true
  })

  it('shows "all" for owner with default preferences', async function () {
    fetchMock.get(preferencesUrl, defaultPreferences)

    renderComponent({ permissionsLevel: 'owner' })

    await waitFor(
      () =>
        expect(
          (
            screen.getByLabelText('All project activity', {
              exact: false,
            }) as HTMLInputElement
          ).checked
        ).to.be.true
    )
  })

  it('shows "replies" for invitee with default preferences', async function () {
    fetchMock.get(preferencesUrl, defaultPreferences)

    renderComponent({ permissionsLevel: 'readAndWrite' })

    await waitFor(
      () =>
        expect(
          (
            screen.getByLabelText('Replies to your activity only', {
              exact: false,
            }) as HTMLInputElement
          ).checked
        ).to.be.true
    )
  })

  it('POSTs "all" preferences when "All project activity" is selected', async function () {
    fetchMock.get(preferencesUrl, allNotificationsOff)
    const saveMock = fetchMock.post(preferencesUrl, { status: 200 })

    renderComponent()

    await waitFor(
      () =>
        expect(
          (screen.getByLabelText('Off', { exact: false }) as HTMLInputElement)
            .checked
        ).to.be.true
    )

    await userEvent.click(
      screen.getByLabelText('All project activity', { exact: false })
    )

    expect(
      saveMock.callHistory.called(preferencesUrl, {
        body: allNotificationsOn,
      })
    ).to.be.true
  })
})
