import { expect } from 'chai'
import sinon from 'sinon'
import { screen, Screen, fireEvent, waitFor } from '@testing-library/react'
import fetchMock, { CallLog } from 'fetch-mock'
import userEvent from '@testing-library/user-event'

import ShareProjectModal from '../../../../../frontend/js/features/share-project-modal/components/share-project-modal'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import {
  makeProjectProvider,
  projectDefaults,
  USER_EMAIL,
  USER_ID,
} from '../../../helpers/editor-providers'
import { location } from '@/shared/components/location'
import { useProjectContext } from '@/shared/context/project-context'
import {
  ProjectMember,
  ProjectMetadata,
} from '@/shared/context/types/project-metadata'
import { UserId } from '@ol-types/user'
import { PublicAccessLevel } from '@ol-types/public-access-level'

async function changePrivilegeLevel(
  screen: Screen,
  { current, next }: { current: string; next: string }
) {
  const select = screen.getByDisplayValue(current)
  fireEvent.click(select)
  const option = screen.getByRole('option', {
    name: next,
  })
  fireEvent.click(option)
}

const testProjectOverrides: Partial<ProjectMetadata> = {
  _id: 'test-project',
  name: 'Test Project',
  features: {
    collaborators: 10,
    compileGroup: 'standard',
  },
  owner: {
    _id: USER_ID,
    email: USER_EMAIL,
    first_name: 'Test',
    last_name: 'Owner',
    privileges: 'owner',
    signUpDate: new Date('2025-07-07').toISOString(),
  },
}

const shareModalProjectDefaults: ProjectMetadata = Object.assign(
  {},
  projectDefaults,
  testProjectOverrides
)

function createContextProps(projectOverrides?: Partial<ProjectMetadata>) {
  const project = Object.assign({}, shareModalProjectDefaults, projectOverrides)
  return { providers: { ProjectProvider: makeProjectProvider(project) } }
}

describe('<ShareProjectModal/>', function () {
  const contacts = [
    // user with edited name
    {
      type: 'user',
      email: 'test-user@example.com',
      first_name: 'Test',
      last_name: 'User',
      name: 'Test User',
    },
    // user with default name (email prefix)
    {
      type: 'user',
      email: 'test@example.com',
      first_name: 'test',
    },
    // no last name
    {
      type: 'user',
      first_name: 'Eratosthenes',
      email: 'eratosthenes@example.com',
    },
    // more users
    {
      type: 'user',
      first_name: 'Claudius',
      last_name: 'Ptolemy',
      email: 'ptolemy@example.com',
    },
    {
      type: 'user',
      first_name: 'Abd al-Rahman',
      last_name: 'Al-Sufi',
      email: 'al-sufi@example.com',
    },
    {
      type: 'user',
      first_name: 'Nicolaus',
      last_name: 'Copernicus',
      email: 'copernicus@example.com',
    },
  ]

  const modalProps = {
    show: true,
    handleHide: sinon.stub(),
    handleOpen: sinon.stub(),
  }

  beforeEach(function () {
    this.locationWrapperSandbox = sinon.createSandbox()
    this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
    fetchMock.get('/user/contacts', { contacts })
    window.metaAttributesCache.set('ol-user', { allowedFreeTrial: true })
    window.metaAttributesCache.set('ol-showUpgradePrompt', true)
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
  })

  afterEach(function () {
    this.locationWrapperSandbox.restore()
    fetchMock.removeRoutes().clearHistory()
  })

  it('renders the modal', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps()
    )

    await screen.findByText('Share Project')
  })

  it('calls handleHide when a Close button is pressed', async function () {
    const handleHide = sinon.stub()

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} handleHide={handleHide} />,
      createContextProps()
    )

    const closeButton = screen.getByRole('button', { name: 'Close dialog' })
    await userEvent.click(closeButton)

    expect(handleHide.callCount).to.equal(1)
  })

  it('handles access level "private"', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'private' })
    )

    await screen.findByText('Link sharing is off')
    await screen.findByRole('button', { name: 'Turn on link sharing' })

    expect(screen.queryByText('Anyone with this link can view this project')).to
      .be.null
    expect(screen.queryByText('Anyone with this link can edit this project')).to
      .be.null
  })

  it('handles access level "tokenBased"', async function () {
    const tokens = {
      readAndWrite: '6862414195fwtbrtrdtskb',
      readAndWritePrefix: '6862414195',
      readOnly: 'wrnjfzkysqkr',
      readAndWriteHashPrefix: 'taEVki',
      readOnlyHashPrefix: 'j2xYbL',
    }
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, tokens)
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased' })
    )

    await screen.findByText('Link sharing is on')
    await screen.findByRole('button', { name: 'Turn off link sharing' })

    expect(screen.queryByText('Anyone with this link can view this project'))
      .not.to.be.null
    expect(screen.queryByText('Anyone with this link can edit this project'))
      .not.to.be.null

    screen.getByText(
      `https://www.test-overleaf.com/${tokens.readAndWrite}#${tokens.readAndWriteHashPrefix}`
    )
    screen.getByText(
      `https://www.test-overleaf.com/read/${tokens.readOnly}#${tokens.readOnlyHashPrefix}`
    )
  })

  it('handles legacy access level "readAndWrite"', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'readAndWrite' })
    )

    await screen.findByText(
      'This project is public and can be edited by anyone with the URL.'
    )
    await screen.findByRole('button', { name: 'Make private' })
  })

  it('handles legacy access level "readOnly"', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'readOnly' })
    )

    await screen.findByText(
      'This project is public and can be viewed but not edited by anyone with the URL'
    )
    await screen.findByRole('button', { name: 'Make private' })
  })

  it('displays actions for project-owners', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})

    const invites: ProjectMember[] = [
      {
        _id: 'invited-author' as UserId,
        email: 'invited-author@example.com',
        privileges: 'readAndWrite',
        first_name: 'Invited',
        last_name: 'Author',
      },
    ]

    // render as project owner: actions should be present
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased', invites })
    )

    await screen.findByRole('button', { name: 'Turn off link sharing' })
    await screen.findByRole('button', { name: 'Resend' })
  })

  it('hides actions from non-project-owners when link sharing on', async function () {
    const invites: ProjectMember[] = [
      {
        _id: 'invited-author' as UserId,
        email: 'invited-author@example.com',
        privileges: 'readAndWrite',
        first_name: 'Invited',
        last_name: 'Author',
      },
    ]

    renderWithEditorContext(<ShareProjectModal {...modalProps} />, {
      ...createContextProps({ publicAccessLevel: 'tokenBased', invites }),
      user: {
        id: 'non-project-owner',
        email: 'non-project-owner@example.com',
      },
    })

    await screen.findByText(
      'To change access permissions, please ask the project owner'
    )

    expect(screen.queryByRole('button', { name: 'Turn off link sharing' })).to
      .be.null
    expect(screen.queryByRole('button', { name: 'Turn on link sharing' })).to.be
      .null
    expect(screen.queryByRole('button', { name: 'Resend' })).to.be.null
  })

  it('hides actions from non-project-owners when link sharing off', async function () {
    const invites: ProjectMember[] = [
      {
        _id: 'invited-author' as UserId,
        email: 'invited-author@example.com',
        privileges: 'readAndWrite',
        first_name: 'Invited',
        last_name: 'Author',
      },
    ]

    renderWithEditorContext(<ShareProjectModal {...modalProps} />, {
      ...createContextProps({ publicAccessLevel: 'private', invites }),
      user: {
        id: 'non-project-owner',
        email: 'non-project-owner@example.com',
      },
    })

    await screen.findByText(
      'To add more collaborators or turn on link sharing, please ask the project owner'
    )

    expect(screen.queryByRole('button', { name: 'Turn off link sharing' })).to
      .be.null
    expect(screen.queryByRole('button', { name: 'Turn on link sharing' })).to.be
      .null
    expect(screen.queryByRole('button', { name: 'Resend' })).to.be.null
  })

  it('only shows read-only token link to restricted token members', async function () {
    window.metaAttributesCache.set('ol-isRestrictedTokenMember', true)
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})

    renderWithEditorContext(<ShareProjectModal {...modalProps} />, {
      ...createContextProps({ publicAccessLevel: 'private' }),
      isRestrictedTokenMember: true,
    })

    // no buttons
    expect(screen.queryByRole('button', { name: 'Turn on link sharing' })).to.be
      .null
    expect(screen.queryByRole('button', { name: 'Turn off link sharing' })).to
      .be.null

    // only read-only token link
    await screen.findByText('Anyone with this link can view this project')
    expect(screen.queryByText('Anyone with this link can edit this project')).to
      .be.null
  })

  it('displays project members and invites', async function () {
    const members: ProjectMember[] = [
      {
        _id: 'member-author' as UserId,
        email: 'member-author@example.com',
        privileges: 'readAndWrite',
        first_name: 'Member',
        last_name: 'Author',
      },
      {
        _id: 'member-viewer' as UserId,
        email: 'member-viewer@example.com',
        privileges: 'readOnly',
        first_name: 'Member',
        last_name: 'Viewer',
      },
    ]

    const invites: ProjectMember[] = [
      {
        _id: 'invited-author' as UserId,
        email: 'invited-author@example.com',
        privileges: 'readAndWrite',
        first_name: 'Invited',
        last_name: 'Author',
      },
      {
        _id: 'invited-viewer' as UserId,
        email: 'invited-viewer@example.com',
        privileges: 'readOnly',
        first_name: 'Invited',
        last_name: 'Viewer',
      },
    ]

    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased', members, invites })
    )

    const projectOwnerEmail = USER_EMAIL

    await screen.findByText(projectOwnerEmail)
    expect(screen.queryAllByText(projectOwnerEmail)).to.have.length(1)
    expect(screen.queryAllByText('member-author@example.com')).to.have.length(1)
    expect(screen.queryAllByText('member-viewer@example.com')).to.have.length(1)
    expect(screen.queryAllByText('invited-author@example.com')).to.have.length(
      1
    )
    expect(screen.queryAllByText('invited-viewer@example.com')).to.have.length(
      1
    )

    expect(screen.queryAllByText('Invite not yet accepted.')).to.have.length(
      invites.length
    )
    expect(screen.queryAllByRole('button', { name: 'Resend' })).to.have.length(
      invites.length
    )
  })

  it('resends an invite', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})
    fetchMock.postOnce(
      'express:/project/:projectId/invite/:inviteId/resend',
      204
    )

    const invites: ProjectMember[] = [
      {
        _id: 'invited-author' as UserId,
        email: 'invited-author@example.com',
        privileges: 'readAndWrite',
        first_name: 'Invited',
        last_name: 'Author',
      },
    ]

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased', invites })
    )

    const closeButton = screen.getByRole('button', {
      name: 'Close',
    })

    const resendButton = screen.getByRole('button', { name: 'Resend' })
    fireEvent.click(resendButton)

    await waitFor(
      () => expect((closeButton as HTMLButtonElement).disabled).to.be.true
    )

    expect(fetchMock.callHistory.done()).to.be.true
    await waitFor(
      () => expect((closeButton as HTMLButtonElement).disabled).to.be.false
    )
  })

  it('revokes an invite', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})
    fetchMock.deleteOnce('express:/project/:projectId/invite/:inviteId', 204)

    const invites: ProjectMember[] = [
      {
        _id: 'invited-author' as UserId,
        email: 'invited-author@example.com',
        privileges: 'readAndWrite',
        first_name: 'Invited',
        last_name: 'Author',
      },
    ]

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased', invites })
    )

    const closeButton = screen.getByRole('button', {
      name: 'Close',
    })

    const revokeButton = screen.getByRole('button', { name: 'Revoke' })
    fireEvent.click(revokeButton)
    await waitFor(
      () => expect((closeButton as HTMLButtonElement).disabled).to.be.true
    )

    expect(fetchMock.callHistory.done()).to.be.true
    await waitFor(
      () => expect((closeButton as HTMLButtonElement).disabled).to.be.false
    )
  })

  it('changes member privileges to read + write', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})
    fetchMock.putOnce('express:/project/:projectId/users/:userId', 204)

    const members: ProjectMember[] = [
      {
        _id: 'member-viewer' as UserId,
        email: 'member-viewer@example.com',
        privileges: 'readOnly',
        first_name: 'Member',
        last_name: 'Viewer',
      },
    ]

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased', members })
    )

    const closeButton = screen.getByRole('button', {
      name: 'Close',
    })

    expect(
      await screen.findAllByText('member-viewer@example.com')
    ).to.have.length(1)

    await changePrivilegeLevel(screen, { current: 'Viewer', next: 'Editor' })

    await waitFor(
      () => expect((closeButton as HTMLButtonElement).disabled).to.be.true
    )

    const body = fetchMock.callHistory.calls().at(-1)?.options?.body
    expect(JSON.parse(body as string)).to.deep.equal({
      privilegeLevel: 'readAndWrite',
    })

    expect(fetchMock.callHistory.done()).to.be.true
    await waitFor(
      () => expect((closeButton as HTMLButtonElement).disabled).to.be.false
    )
  })

  it('removes a member from the project', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})
    fetchMock.deleteOnce('express:/project/:projectId/users/:userId', 204)

    const members: ProjectMember[] = [
      {
        _id: 'member-viewer' as UserId,
        email: 'member-viewer@example.com',
        privileges: 'readOnly',
        first_name: 'Member',
        last_name: 'Viewer',
      },
    ]

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased', members })
    )

    expect(
      await screen.findAllByText('member-viewer@example.com')
    ).to.have.length(1)

    await changePrivilegeLevel(screen, {
      current: 'Viewer',
      next: 'Remove access',
    })
    const removeButton = screen.getByRole('button', {
      name: 'Change',
    })
    fireEvent.click(removeButton)

    const url = fetchMock.callHistory.calls().at(-1)?.url
    expect(url).to.equal(
      'https://www.test-overleaf.com/project/test-project/users/member-viewer'
    )

    expect(fetchMock.callHistory.done()).to.be.true
  })

  it('changes member privileges to owner with confirmation', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})
    fetchMock.postOnce('express:/project/:projectId/transfer-ownership', 204)

    const members: ProjectMember[] = [
      {
        _id: 'member-viewer' as UserId,
        email: 'member-viewer@example.com',
        privileges: 'readOnly',
        first_name: 'Member',
        last_name: 'Viewer',
      },
    ]

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased', members })
    )

    await screen.findByText('member-viewer@example.com')
    expect(screen.queryAllByText('member-viewer@example.com')).to.have.length(1)

    await changePrivilegeLevel(screen, {
      current: 'Viewer',
      next: 'Make owner',
    })

    screen.getByText((_, node) => {
      return (
        node !== null &&
        node.textContent ===
          'Are you sure you want to make member-viewer@example.com the owner of Test Project?'
      )
    })

    const confirmButton: HTMLButtonElement = screen.getByRole('button', {
      name: 'Change owner',
    })
    fireEvent.click(confirmButton)
    await waitFor(() => expect(confirmButton.disabled).to.be.true)

    const body = fetchMock.callHistory.calls().at(-1)?.options?.body
    expect(JSON.parse(body as string)).to.deep.equal({
      user_id: 'member-viewer',
    })

    expect(fetchMock.callHistory.done()).to.be.true
  })

  it('sends invites to input email addresses', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({ publicAccessLevel: 'tokenBased' })
    )

    const [inputElement] = await screen.findAllByLabelText('Add email address')

    // loading contacts
    await waitFor(() => {
      expect(fetchMock.callHistory.called('express:/user/contacts')).to.be.true
    })

    // displaying a list of matching contacts
    inputElement.focus()
    fireEvent.change(inputElement, { target: { value: 'ptolemy' } })

    await screen.findByText(/ptolemy@example.com/)

    // sending invitations

    fetchMock.post(
      'express:/project/:projectId/invite',
      ({ args: [, req] }) => {
        const data = JSON.parse((req as { body: string }).body)

        if (data.email === 'a@b.c') {
          return {
            status: 400,
            body: { errorReason: 'invalid_email' },
          }
        }

        return {
          status: 200,
          body: {
            invite: {
              ...data,
              _id: data.email,
            },
          },
        }
      }
    )

    fireEvent.paste(inputElement, {
      clipboardData: {
        getData: () =>
          `test@example.com; foo@example.com
          bar@example.com, a@b.c`,
      },
    })

    const user = userEvent.setup()
    await user.click(screen.getByTestId('add-collaborator-select'))
    await user.click(screen.getByText('Viewer'))

    const submitButton = screen.getByRole('button', { name: 'Invite' })
    await userEvent.click(submitButton)

    let calls: CallLog[] = []
    await waitFor(
      () => {
        calls = fetchMock.callHistory.calls(
          'express:/project/:projectId/invite'
        )
        expect(calls).to.have.length(4)
      },
      { timeout: 5000 } // allow time for delay between each request
    )

    expect((calls[0].args[1] as { body: string }).body).to.equal(
      JSON.stringify({ email: 'test@example.com', privileges: 'readOnly' })
    )
    expect((calls[1].args[1] as { body: string }).body).to.equal(
      JSON.stringify({ email: 'foo@example.com', privileges: 'readOnly' })
    )
    expect((calls[2].args[1] as { body: string }).body).to.equal(
      JSON.stringify({ email: 'bar@example.com', privileges: 'readOnly' })
    )
    expect((calls[3].args[1] as { body: string }).body).to.equal(
      JSON.stringify({ email: 'a@b.c', privileges: 'readOnly' })
    )

    // error from the last invite
    screen.getByText('An email address is invalid')
  })

  it('displays a message when the collaborator limit is reached', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})
    fetchMock.post(
      '/event/paywall-prompt',
      {},
      { body: { 'paywall-type': 'project-sharing' } }
    )

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({
        publicAccessLevel: 'tokenBased',
        features: {
          collaborators: 0,
          compileGroup: 'standard',
          trackChangesVisible: true,
        },
      })
    )

    await screen.findByText('Add more collaborators')

    const user = userEvent.setup()
    await user.click(screen.getByTestId('add-collaborator-select'))
    const editorOption = screen.getByText('Editor').closest('button')
    const reviewerOption = screen.getByText('Reviewer').closest('button')
    const viewerOption = screen.getByText('Viewer').closest('button')

    expect(editorOption?.classList.contains('disabled')).to.be.true
    expect(reviewerOption?.classList.contains('disabled')).to.be.true
    expect(viewerOption?.classList.contains('disabled')).to.be.false

    screen.getByText(
      /Upgrade to add more collaborators and access collaboration features like track changes and full project history/
    )
  })

  it('counts reviewers towards the collaborator limit', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({
        features: {
          collaborators: 1,
          trackChangesVisible: true,
        },
        members: [
          {
            _id: 'reviewer-id' as UserId,
            email: 'reviewer@example.com',
            privileges: 'review',
            first_name: 'Reviewer',
            last_name: 'LastName',
          },
        ],
      })
    )

    await screen.findByText('Add more collaborators')

    const user = userEvent.setup()
    await user.click(screen.getByTestId('add-collaborator-select'))

    const editorOption = screen.getByText('Editor').closest('button')
    const reviewerOption = screen.getByText('Reviewer').closest('button')
    const viewerOption = screen.getByText('Viewer').closest('button')

    expect(editorOption?.classList.contains('disabled')).to.be.true
    expect(reviewerOption?.classList.contains('disabled')).to.be.true
    expect(viewerOption?.classList.contains('disabled')).to.be.false

    screen.getByText(
      /Upgrade to add more collaborators and access collaboration features like track changes and full project history/
    )
  })

  it('handles server error responses', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})

    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps({
        publicAccessLevel: 'tokenBased',
      })
    )

    // loading contacts
    await waitFor(() => {
      expect(fetchMock.callHistory.called('express:/user/contacts')).to.be.true
    })

    const [inputElement] = await screen.findAllByLabelText('Add email address')

    const submitButton: HTMLButtonElement = screen.getByRole('button', {
      name: 'Invite',
    })

    const respondWithError = async function (errorReason: string) {
      fireEvent.focus(inputElement)
      fireEvent.change(inputElement, {
        target: { value: 'invited-author-1@example.com' },
      })
      fireEvent.blur(inputElement)

      fetchMock.postOnce('express:/project/:projectId/invite', {
        status: 400,
        body: { errorReason },
      })

      expect(submitButton.disabled).to.be.false
      await userEvent.click(submitButton)
      await fetchMock.callHistory.flush(true)
      expect(fetchMock.callHistory.done()).to.be.true
    }

    await respondWithError('cannot_invite_non_user')
    await screen.findByText(
      `Can’t send invite. Recipient must already have an Overleaf account`
    )

    await respondWithError('cannot_verify_user_not_robot')
    await screen.findByText(
      `Sorry, we could not verify that you are not a robot. Please check that Google reCAPTCHA is not being blocked by an ad blocker or firewall.`
    )

    await respondWithError('cannot_invite_self')
    await screen.findByText(`Can’t send invite to yourself`)

    await respondWithError('invalid_email')
    await screen.findByText(`An email address is invalid`)

    await respondWithError('too_many_requests')
    await screen.findByText(
      `Too many requests were received in a short space of time. Please wait for a few moments and try again.`
    )
  })

  it('handles switching between access levels', async function () {
    fetchMock.get(`/project/${shareModalProjectDefaults._id}/tokens`, {})
    fetchMock.post('express:/project/:projectId/settings/admin', 204)

    let setPublicAccessLevel = function (_: PublicAccessLevel) {}

    function WrappedModal() {
      const { updateProject } = useProjectContext()
      setPublicAccessLevel = (publicAccessLevel: PublicAccessLevel) => {
        updateProject({ publicAccessLevel })
      }
      return <ShareProjectModal {...modalProps} />
    }

    renderWithEditorContext(
      <WrappedModal />,
      createContextProps({
        publicAccessLevel: 'private',
      })
    )

    await screen.findByText('Link sharing is off')

    const enableButton: HTMLButtonElement = await screen.findByRole('button', {
      name: 'Turn on link sharing',
    })
    fireEvent.click(enableButton)
    await waitFor(() => expect(enableButton.disabled).to.be.true)

    const tokenBody = fetchMock.callHistory.calls().at(-1)?.options.body
    expect(JSON.parse(tokenBody as string)).to.deep.equal({
      publicAccessLevel: 'tokenBased',
    })

    // NOTE: the project data is usually updated via the websocket connection
    // but we can't do that so we're doing it via the project context, which is
    // exposed in a hacky way here
    setPublicAccessLevel('tokenBased')

    await screen.findByText('Link sharing is on')
    const disableButton: HTMLButtonElement = await screen.findByRole('button', {
      name: 'Turn off link sharing',
    })
    fireEvent.click(disableButton)
    await waitFor(() => expect(disableButton.disabled).to.be.true)

    const privateBody = fetchMock.callHistory.calls().at(-1)?.options.body
    expect(JSON.parse(privateBody as string)).to.deep.equal({
      publicAccessLevel: 'private',
    })

    setPublicAccessLevel('private')

    await screen.findByText('Link sharing is off')
  })

  it('avoids selecting unmatched contact', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps()
    )

    const [inputElement] = await screen.findAllByLabelText('Add email address')

    // Wait for contacts to load
    await waitFor(() => {
      expect(fetchMock.callHistory.called('express:/user/contacts')).to.be.true
    })

    // Enter a prefix that matches a contact
    inputElement.focus()
    fireEvent.change(inputElement, { target: { value: 'ptolemy' } })

    // The matching contact should now be present and selected
    await screen.findByRole('option', {
      name: `Claudius Ptolemy <ptolemy@example.com>`,
      selected: true,
    })

    // Keep entering text so the contact no longer matches
    fireEvent.change(inputElement, {
      target: { value: 'ptolemy.new@example.com' },
    })

    // The matching contact should no longer be present
    expect(
      screen.queryByRole('option', {
        name: `Claudius Ptolemy <ptolemy@example.com>`,
      })
    ).to.be.null

    // No items should be added yet
    expect(screen.queryByRole('button', { name: 'Remove' })).to.be.null

    // Pressing Tab should add the entered item
    fireEvent.keyDown(inputElement, { key: 'Tab', code: 'Tab' })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Remove/ })).to.have.length(
        1
      )
    })

    // Blurring the input should not add another contact
    fireEvent.blur(inputElement)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Remove/ })).to.have.length(
        1
      )
    })
  })

  it('selects contact by typing the entire email and blurring the input', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps()
    )

    const [inputElement] = await screen.findAllByLabelText('Add email address')

    // Wait for contacts to load
    await waitFor(() => {
      expect(fetchMock.callHistory.called('express:/user/contacts')).to.be.true
    })

    // Enter a prefix that matches a contact
    await userEvent.type(inputElement, 'ptolemy@example.com')

    // The matching contact should now be present and selected
    await screen.findByRole('option', {
      name: `Claudius Ptolemy <ptolemy@example.com>`,
      selected: true,
    })

    // No items should be added yet
    expect(screen.queryByRole('button', { name: /Remove/ })).to.be.null

    // Click anywhere on the form to blur the input
    await userEvent.click(screen.getByRole('dialog'))

    // The contact should be added
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Remove/ })).to.have.length(
        1
      )
    })
  })

  it('selects contact by typing a partial email and selecting the suggestion', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps()
    )

    const [inputElement] = await screen.findAllByLabelText('Add email address')

    // Wait for contacts to load
    await waitFor(() => {
      expect(fetchMock.callHistory.called('express:/user/contacts')).to.be.true
    })

    // Enter a prefix that matches a contact
    await userEvent.type(inputElement, 'pto')

    // The matching contact should now be present and selected
    await userEvent.click(
      screen.getByRole('option', {
        name: `Claudius Ptolemy <ptolemy@example.com>`,
        selected: true,
      })
    )

    // Click anywhere on the form to blur the input
    await userEvent.click(screen.getByRole('dialog'))

    // The contact should be added
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Remove/ })).to.have.length(
        1
      )
    })
  })

  it('allows an email address to be selected, removed, then re-added', async function () {
    renderWithEditorContext(
      <ShareProjectModal {...modalProps} />,
      createContextProps()
    )

    const [inputElement] = await screen.findAllByLabelText('Add email address')

    // Wait for contacts to load
    await waitFor(() => {
      expect(fetchMock.callHistory.called('express:/user/contacts')).to.be.true
    })

    // Enter a prefix that matches a contact
    await userEvent.type(inputElement, 'pto')

    // Select the suggested contact
    await userEvent.click(
      screen.getByRole('option', {
        name: `Claudius Ptolemy <ptolemy@example.com>`,
        selected: true,
      })
    )

    // Click anywhere on the form to blur the input
    await userEvent.click(screen.getByRole('dialog'))

    // Remove the just-added collaborator
    await userEvent.click(screen.getByRole('button', { name: /Remove/ }))

    // Remove button should now be gone
    expect(screen.queryByRole('button', { name: /Remove/ })).to.be.null

    // Add the same collaborator again
    await userEvent.type(inputElement, 'pto')

    // Click the suggested contact again
    await userEvent.click(
      screen.getByRole('option', {
        name: `Claudius Ptolemy <ptolemy@example.com>`,
        selected: true,
      })
    )

    // Click anywhere on the form to blur the input
    await userEvent.click(screen.getByRole('dialog'))

    // The contact should be added
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Remove/ })).to.have.length(
        1
      )
    })
  })
})
