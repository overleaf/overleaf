import { expect } from 'chai'
import sinon from 'sinon'
import React from 'react'
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  waitForElementToBeRemoved
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import ShareProjectModal from '../../../../../frontend/js/features/share-project-modal/components/share-project-modal'
import * as locationModule from '../../../../../frontend/js/features/share-project-modal/utils/location'

describe('<ShareProjectModal/>', function() {
  const project = {
    _id: 'test-project',
    name: 'Test Project',
    features: {
      collaborators: 10
    },
    owner: {
      email: 'project-owner@example.com'
    },
    members: [],
    invites: []
  }

  const contacts = [
    // user with edited name
    {
      type: 'user',
      email: 'test-user@example.com',
      first_name: 'Test',
      last_name: 'User',
      name: 'Test User'
    },
    // user with default name (email prefix)
    {
      type: 'user',
      email: 'test@example.com',
      first_name: 'test'
    },
    // no last name
    {
      type: 'user',
      first_name: 'Eratosthenes',
      email: 'eratosthenes@example.com'
    },
    // more users
    {
      type: 'user',
      first_name: 'Claudius',
      last_name: 'Ptolemy',
      email: 'ptolemy@example.com'
    },
    {
      type: 'user',
      first_name: 'Abd al-Rahman',
      last_name: 'Al-Sufi',
      email: 'al-sufi@example.com'
    },
    {
      type: 'user',
      first_name: 'Nicolaus',
      last_name: 'Copernicus',
      email: 'copernicus@example.com'
    }
  ]

  const ideWithProject = project => {
    return {
      $scope: {
        $watch: () => () => {},
        $applyAsync: () => {},
        project
      }
    }
  }

  const modalProps = {
    ide: ideWithProject(project),
    show: true,
    isAdmin: true,
    handleHide: sinon.stub()
  }

  const originalExposedSettings = window.ExposedSettings

  before(function() {
    window.ExposedSettings = { appName: 'Overleaf' }
  })

  after(function() {
    window.ExposedSettings = originalExposedSettings
  })

  beforeEach(function() {
    fetchMock.get('/user/contacts', { contacts })
  })

  afterEach(function() {
    fetchMock.restore()
    cleanup()
  })

  it('renders the modal', async function() {
    render(<ShareProjectModal {...modalProps} />)

    await screen.findByText('Share Project')
  })

  it('calls handleHide when a Close button is pressed', async function() {
    const handleHide = sinon.stub()

    render(<ShareProjectModal {...modalProps} handleHide={handleHide} />)

    const [
      headerCloseButton,
      footerCloseButton
    ] = await screen.findAllByRole('button', { name: 'Close' })

    fireEvent.click(headerCloseButton)
    fireEvent.click(footerCloseButton)

    expect(handleHide.callCount).to.equal(2)
  })

  it('handles access level "private"', async function() {
    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({ ...project, publicAccesLevel: 'private' })}
      />
    )

    await screen.findByText(
      'Link sharing is off, only invited users can view this project.'
    )
    await screen.findByRole('button', { name: 'Turn on link sharing' })

    expect(screen.queryByText('Anyone with this link can view this project')).to
      .be.null
    expect(screen.queryByText('Anyone with this link can edit this project')).to
      .be.null
  })

  it('handles access level "tokenBased"', async function() {
    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({ ...project, publicAccesLevel: 'tokenBased' })}
      />
    )

    await screen.findByText('Link sharing is on')
    await screen.findByRole('button', { name: 'Turn off link sharing' })

    expect(screen.queryByText('Anyone with this link can view this project'))
      .not.to.be.null
    expect(screen.queryByText('Anyone with this link can edit this project'))
      .not.to.be.null
  })

  it('handles legacy access level "readAndWrite"', async function() {
    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({ ...project, publicAccesLevel: 'readAndWrite' })}
      />
    )

    await screen.findByText(
      'This project is public and can be edited by anyone with the URL.'
    )
    await screen.findByRole('button', { name: 'Make Private' })
  })

  it('handles legacy access level "readOnly"', async function() {
    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({ ...project, publicAccesLevel: 'readOnly' })}
      />
    )

    await screen.findByText(
      'This project is public and can be viewed but not edited by anyone with the URL'
    )
    await screen.findByRole('button', { name: 'Make Private' })
  })

  it('hides actions from non-admins', async function() {
    const invites = [
      {
        _id: 'invited-author',
        email: 'invited-author@example.com',
        privileges: 'readAndWrite'
      }
    ]

    // render as admin: actions should be present
    const { rerender } = render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          invites,
          publicAccesLevel: 'tokenBased'
        })}
        isAdmin
      />
    )

    await screen.findByRole('button', { name: 'Turn off link sharing' })
    await screen.findByRole('button', { name: 'Resend' })

    // render as non-admin, link sharing on: actions should be missing and message should be present
    rerender(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          invites,
          publicAccesLevel: 'tokenBased'
        })}
        isAdmin={false}
      />
    )

    await screen.findByText(
      'To change access permissions, please ask the project owner'
    )

    expect(screen.queryByRole('button', { name: 'Turn off link sharing' })).to
      .be.null
    expect(screen.queryByRole('button', { name: 'Turn on link sharing' })).to.be
      .null
    expect(screen.queryByRole('button', { name: 'Resend' })).to.be.null

    // render as non-admin (non-owner), link sharing off: actions should be missing and message should be present
    rerender(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          invites,
          publicAccesLevel: 'private'
        })}
        isAdmin={false}
      />
    )

    await screen.findByText(
      'To change access permissions, please ask the project owner'
    )

    expect(screen.queryByRole('button', { name: 'Turn off link sharing' })).to
      .be.null
    expect(screen.queryByRole('button', { name: 'Turn on link sharing' })).to.be
      .null
    expect(screen.queryByRole('button', { name: 'Resend' })).to.be.null
  })

  it('only shows read-only token link to restricted token members', async function() {
    window.isRestrictedTokenMember = true

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({ ...project, publicAccesLevel: 'tokenBased' })}
      />
    )

    window.isRestrictedTokenMember = false

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

  it('displays project members and invites', async function() {
    const members = [
      {
        _id: 'member-author',
        email: 'member-author@example.com',
        privileges: 'readAndWrite'
      },
      {
        _id: 'member-viewer',
        email: 'member-viewer@example.com',
        privileges: 'readOnly'
      }
    ]

    const invites = [
      {
        _id: 'invited-author',
        email: 'invited-author@example.com',
        privileges: 'readAndWrite'
      },
      {
        _id: 'invited-viewer',
        email: 'invited-viewer@example.com',
        privileges: 'readOnly'
      }
    ]

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          members,
          invites,
          publicAccesLevel: 'tokenBased'
        })}
      />
    )

    expect(screen.queryAllByText('project-owner@example.com')).to.have.length(1)
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

  it('resends an invite', async function() {
    fetchMock.postOnce(
      'express:/project/:projectId/invite/:inviteId/resend',
      204
    )

    const invites = [
      {
        _id: 'invited-author',
        email: 'invited-author@example.com',
        privileges: 'readAndWrite'
      }
    ]

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          invites,
          publicAccesLevel: 'tokenBased'
        })}
      />
    )

    const [, closeButton] = screen.getAllByRole('button', {
      name: 'Close'
    })

    const resendButton = screen.getByRole('button', { name: 'Resend' })
    fireEvent.click(resendButton)

    await waitFor(() => expect(closeButton.disabled).to.be.true)

    expect(fetchMock.done()).to.be.true
    expect(closeButton.disabled).to.be.false
  })

  it('revokes an invite', async function() {
    fetchMock.deleteOnce('express:/project/:projectId/invite/:inviteId', 204)

    const invites = [
      {
        _id: 'invited-author',
        email: 'invited-author@example.com',
        privileges: 'readAndWrite'
      }
    ]

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          invites,
          publicAccesLevel: 'tokenBased'
        })}
      />
    )

    const [, closeButton] = screen.getAllByRole('button', {
      name: 'Close'
    })

    const revokeButton = screen.getByRole('button', { name: 'Revoke' })
    fireEvent.click(revokeButton)
    await waitFor(() => expect(closeButton.disabled).to.be.true)

    expect(fetchMock.done()).to.be.true
    expect(closeButton.disabled).to.be.false
  })

  it('changes member privileges to read + write', async function() {
    fetchMock.putOnce('express:/project/:projectId/users/:userId', 204)

    const members = [
      {
        _id: 'member-viewer',
        email: 'member-viewer@example.com',
        privileges: 'readOnly'
      }
    ]

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          members,
          publicAccesLevel: 'tokenBased'
        })}
      />
    )

    const [, closeButton] = await screen.getAllByRole('button', {
      name: 'Close'
    })

    expect(screen.queryAllByText('member-viewer@example.com')).to.have.length(1)

    const select = screen.getByDisplayValue('Read Only')
    await fireEvent.change(select, { target: { value: 'readAndWrite' } })

    const changeButton = screen.getByRole('button', { name: 'Change' })

    fireEvent.click(changeButton)
    await waitFor(() => expect(closeButton.disabled).to.be.true)

    const { body } = fetchMock.lastOptions()
    expect(JSON.parse(body)).to.deep.equal({ privilegeLevel: 'readAndWrite' })

    expect(fetchMock.done()).to.be.true
    expect(closeButton.disabled).to.be.false
  })

  it('removes a member from the project', async function() {
    fetchMock.deleteOnce('express:/project/:projectId/users/:userId', 204)

    const members = [
      {
        _id: 'member-viewer',
        email: 'member-viewer@example.com',
        privileges: 'readOnly'
      }
    ]

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          members,
          publicAccesLevel: 'tokenBased'
        })}
      />
    )

    expect(screen.queryAllByText('member-viewer@example.com')).to.have.length(1)

    const removeButton = screen.getByRole('button', {
      name: 'Remove from project'
    })

    fireEvent.click(removeButton)

    const url = fetchMock.lastUrl()
    expect(url).to.equal('/project/test-project/users/member-viewer')

    expect(fetchMock.done()).to.be.true

    await waitForElementToBeRemoved(() =>
      screen.queryByText('member-viewer@example.com')
    )
  })

  it('changes member privileges to owner with confirmation', async function() {
    fetchMock.postOnce('express:/project/:projectId/transfer-ownership', 204)

    const members = [
      {
        _id: 'member-viewer',
        email: 'member-viewer@example.com',
        privileges: 'readOnly'
      }
    ]

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          members,
          publicAccesLevel: 'tokenBased'
        })}
      />
    )

    expect(screen.queryAllByText('member-viewer@example.com')).to.have.length(1)

    const select = screen.getByDisplayValue('Read Only')
    fireEvent.change(select, { target: { value: 'owner' } })

    const changeButton = screen.getByRole('button', { name: 'Change' })
    await fireEvent.click(changeButton)

    screen.getByText((_, node) => {
      return (
        node.textContent ===
        'Are you sure you want to make member-viewer@example.com the owner of Test Project?'
      )
    })

    const reloadStub = sinon.stub(locationModule, 'reload')

    const confirmButton = screen.getByRole('button', {
      name: 'Change owner'
    })
    fireEvent.click(confirmButton)
    await waitFor(() => expect(confirmButton.disabled).to.be.true)

    const { body } = fetchMock.lastOptions()
    expect(JSON.parse(body)).to.deep.equal({ user_id: 'member-viewer' })

    expect(fetchMock.done()).to.be.true
    expect(reloadStub.calledOnce).to.be.true
    reloadStub.restore()
  })

  it('sends invites to input email addresses', async function() {
    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          publicAccesLevel: 'tokenBased'
        })}
      />
    )

    const [inputElement] = await screen.findAllByLabelText(
      'Share with your collaborators'
    )

    // loading contacts
    await waitFor(() => {
      expect(fetchMock.called('express:/user/contacts')).to.be.true
    })

    // displaying a list of matching contacts
    inputElement.focus()
    fireEvent.change(inputElement, { target: { value: 'ptolemy' } })

    await screen.findByText(/ptolemy@example.com/)

    // sending invitations

    fetchMock.post('express:/project/:projectId/invite', (url, req) => {
      const data = JSON.parse(req.body)

      if (data.email === 'a@b.c') {
        return {
          status: 400,
          body: { errorReason: 'invalid_email' }
        }
      }

      return {
        status: 200,
        body: {
          invite: {
            ...data,
            _id: data.email
          }
        }
      }
    })

    fireEvent.paste(inputElement, {
      clipboardData: {
        getData: () =>
          'test@example.com, foo@example.com, bar@example.com, a@b.c'
      }
    })

    const privilegesElement = screen.getByDisplayValue('Can Edit')
    fireEvent.change(privilegesElement, { target: { value: 'readOnly' } })

    const submitButton = screen.getByRole('button', { name: 'Share' })
    submitButton.click()

    let calls
    await waitFor(
      () => {
        calls = fetchMock.calls('express:/project/:projectId/invite')
        expect(calls).to.have.length(4)
      },
      { timeout: 5000 } // allow time for delay between each request
    )

    expect(calls[0][1].body).to.equal(
      JSON.stringify({ email: 'test@example.com', privileges: 'readOnly' })
    )
    expect(calls[1][1].body).to.equal(
      JSON.stringify({ email: 'foo@example.com', privileges: 'readOnly' })
    )
    expect(calls[2][1].body).to.equal(
      JSON.stringify({ email: 'bar@example.com', privileges: 'readOnly' })
    )
    expect(calls[3][1].body).to.equal(
      JSON.stringify({ email: 'a@b.c', privileges: 'readOnly' })
    )

    // error from the last invite
    screen.getByText('An email address is invalid')
  })

  it('displays a message when the collaborator limit is reached', async function() {
    const originalUser = window.user

    window.user = { allowedFreeTrial: true }

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          publicAccesLevel: 'tokenBased',
          features: {
            collaborators: 0
          }
        })}
      />
    )

    expect(screen.queryByLabelText('Share with your collaborators')).to.be.null

    screen.getByText(
      /You need to upgrade your account to add more collaborators/
    )

    window.user = originalUser
  })

  it('handles server error responses', async function() {
    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({
          ...project,
          publicAccesLevel: 'tokenBased'
        })}
      />
    )

    // loading contacts
    await waitFor(() => {
      expect(fetchMock.called('express:/user/contacts')).to.be.true
    })

    const [inputElement] = await screen.findAllByLabelText(
      'Share with your collaborators'
    )

    const submitButton = screen.getByRole('button', { name: 'Share' })

    const respondWithError = async function(errorReason) {
      inputElement.focus()
      fireEvent.change(inputElement, {
        target: { value: 'invited-author-1@example.com' }
      })
      inputElement.blur()

      fetchMock.postOnce(
        'express:/project/:projectId/invite',
        {
          status: 400,
          body: { errorReason }
        },
        { overwriteRoutes: true }
      )

      expect(submitButton.disabled).to.be.false
      submitButton.click()
      await fetchMock.flush(true)
      expect(fetchMock.done()).to.be.true
    }

    await respondWithError('cannot_invite_non_user')
    await screen.findByText(
      `Can't send invite. Recipient must already have a Overleaf account`
    )

    await respondWithError('cannot_verify_user_not_robot')
    await screen.findByText(
      `Sorry, we could not verify that you are not a robot. Please check that Google reCAPTCHA is not being blocked by an ad blocker or firewall.`
    )

    await respondWithError('cannot_invite_self')
    await screen.findByText(`Can't send invite to yourself`)

    await respondWithError('invalid_email')
    await screen.findByText(`An email address is invalid`)

    await respondWithError('too_many_requests')
    await screen.findByText(
      `Too many requests were received in a short space of time. Please wait for a few moments and try again.`
    )
  })

  it('handles switching between access levels', async function() {
    fetchMock.post('express:/project/:projectId/settings/admin', 204)

    render(
      <ShareProjectModal
        {...modalProps}
        ide={ideWithProject({ ...project, publicAccesLevel: 'private' })}
      />
    )

    await screen.findByText(
      'Link sharing is off, only invited users can view this project.'
    )

    const enableButton = await screen.findByRole('button', {
      name: 'Turn on link sharing'
    })
    fireEvent.click(enableButton)
    await waitFor(() => expect(enableButton.disabled).to.be.true)

    const { body: tokenBody } = fetchMock.lastOptions()
    expect(JSON.parse(tokenBody)).to.deep.equal({
      publicAccessLevel: 'tokenBased'
    })

    await screen.findByText('Link sharing is on')
    const disableButton = await screen.findByRole('button', {
      name: 'Turn off link sharing'
    })
    fireEvent.click(disableButton)
    await waitFor(() => expect(disableButton.disabled).to.be.true)

    const { body: privateBody } = fetchMock.lastOptions()
    expect(JSON.parse(privateBody)).to.deep.equal({
      publicAccessLevel: 'private'
    })

    await screen.findByText(
      'Link sharing is off, only invited users can view this project.'
    )
  })

  it('avoids selecting unmatched contact', async function() {
    render(<ShareProjectModal {...modalProps} />)

    const [inputElement] = await screen.findAllByLabelText(
      'Share with your collaborators'
    )

    // Wait for contacts to load
    await waitFor(() => {
      expect(fetchMock.called('express:/user/contacts')).to.be.true
    })

    // Enter a prefix that matches a contact
    inputElement.focus()
    fireEvent.change(inputElement, { target: { value: 'ptolemy' } })

    // The matching contact should now be present and selected
    await screen.findByRole('option', {
      name: `Claudius Ptolemy <ptolemy@example.com>`,
      selected: true
    })

    // Keep entering text so the contact no longer matches
    fireEvent.change(inputElement, {
      target: { value: 'ptolemy.new@example.com' }
    })

    // The matching contact should no longer be present
    expect(
      screen.queryByRole('option', {
        name: `Claudius Ptolemy <ptolemy@example.com>`
      })
    ).to.be.null

    // No items should be added yet
    expect(screen.queryByRole('button', { name: 'Remove' })).to.be.null

    // Pressing Tab should add the entered item
    fireEvent.keyDown(inputElement, { key: 'Tab', code: 'Tab' })
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove' })).to.have.length(
        1
      )
    })

    // Blurring the input should not add another contact
    fireEvent.blur(inputElement)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove' })).to.have.length(
        1
      )
    })
  })
})
