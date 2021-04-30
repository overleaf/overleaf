import React, { useEffect } from 'react'
import fetchMock from 'fetch-mock'
import ShareProjectModal from '../js/features/share-project-modal/components/share-project-modal'

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

const setupFetchMock = () => {
  const delay = 1000

  fetchMock
    .restore()
    // list contacts
    .get('express:/user/contacts', { contacts }, { delay })
    // change privacy setting
    .post('express:/project/:projectId/settings/admin', 200, { delay })
    // update project member (e.g. set privilege level)
    .put('express:/project/:projectId/users/:userId', 200, { delay })
    // remove project member
    .delete('express:/project/:projectId/users/:userId', 200, { delay })
    // transfer ownership
    .post('express:/project/:projectId/transfer-ownership', 200, {
      delay,
    })
    // send invite
    .post('express:/project/:projectId/invite', 200, { delay })
    // delete invite
    .delete('express:/project/:projectId/invite/:inviteId', 204, {
      delay,
    })
    // resend invite
    .post('express:/project/:projectId/invite/:inviteId/resend', 200, {
      delay,
    })
    // send analytics event
    .post('express:/event/:key', 200)
}

const ideWithProject = project => {
  return {
    $scope: {
      $watch: () => () => {},
      $applyAsync: () => {},
      project,
    },
  }
}

export const LinkSharingOff = args => {
  setupFetchMock()

  const project = {
    ...args.project,
    publicAccesLevel: 'private',
  }

  return <ShareProjectModal {...args} ide={ideWithProject(project)} />
}

export const LinkSharingOn = args => {
  setupFetchMock()

  const project = {
    ...args.project,
    publicAccesLevel: 'tokenBased',
  }

  return <ShareProjectModal {...args} ide={ideWithProject(project)} />
}

export const LinkSharingLoading = args => {
  setupFetchMock()

  const project = {
    ...args.project,
    publicAccesLevel: 'tokenBased',
    tokens: undefined,
  }

  return <ShareProjectModal {...args} ide={ideWithProject(project)} />
}

export const NonAdminLinkSharingOff = args => {
  const project = {
    ...args.project,
    publicAccesLevel: 'private',
  }

  return (
    <ShareProjectModal
      {...args}
      isAdmin={false}
      ide={ideWithProject(project)}
    />
  )
}

export const NonAdminLinkSharingOn = args => {
  const project = {
    ...args.project,
    publicAccesLevel: 'tokenBased',
  }

  return (
    <ShareProjectModal
      {...args}
      isAdmin={false}
      ide={ideWithProject(project)}
    />
  )
}

export const RestrictedTokenMember = args => {
  window.isRestrictedTokenMember = true

  useEffect(() => {
    return () => {
      window.isRestrictedTokenMember = false
    }
  }, [])

  const project = {
    ...args.project,
    publicAccesLevel: 'tokenBased',
  }

  return <ShareProjectModal {...args} ide={ideWithProject(project)} />
}

export const LegacyLinkSharingReadAndWrite = args => {
  setupFetchMock()

  const project = {
    ...args.project,
    publicAccesLevel: 'readAndWrite',
  }

  return <ShareProjectModal {...args} ide={ideWithProject(project)} />
}

export const LegacyLinkSharingReadOnly = args => {
  setupFetchMock()

  const project = {
    ...args.project,
    publicAccesLevel: 'readOnly',
  }

  return <ShareProjectModal {...args} ide={ideWithProject(project)} />
}

export const LimitedCollaborators = args => {
  setupFetchMock()

  const project = {
    ...args.project,
    features: {
      ...args.project.features,
      collaborators: 3,
    },
  }

  return <ShareProjectModal {...args} ide={ideWithProject(project)} />
}

const project = {
  _id: 'a-project',
  name: 'A Project',
  features: {
    collaborators: -1, // unlimited
  },
  publicAccesLevel: 'private',
  tokens: {
    readOnly: 'ro-token',
    readAndWrite: 'rw-token',
  },
  owner: {
    email: 'stories@overleaf.com',
  },
  members: [
    {
      _id: 'viewer-member',
      type: 'user',
      privileges: 'readOnly',
      name: 'Viewer User',
      email: 'viewer@example.com',
    },
    {
      _id: 'author-member',
      type: 'user',
      privileges: 'readAndWrite',
      name: 'Author User',
      email: 'author@example.com',
    },
  ],
  invites: [
    {
      _id: 'test-invite-1',
      privileges: 'readOnly',
      name: 'Invited Viewer',
      email: 'invited-viewer@example.com',
    },
    {
      _id: 'test-invite-2',
      privileges: 'readAndWrite',
      name: 'Invited Author',
      email: 'invited-author@example.com',
    },
  ],
}

export default {
  title: 'Modals / Share Project',
  component: ShareProjectModal,
  args: {
    show: true,
    animation: false,
    isAdmin: true,
    user: {},
    project,
  },
  argTypes: {
    handleHide: { action: 'hide' },
  },
}
