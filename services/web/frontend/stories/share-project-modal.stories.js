import { useEffect } from 'react'
import ShareProjectModal from '../js/features/share-project-modal/components/share-project-modal'
import useFetchMock from './hooks/use-fetch-mock'
import { withContextRoot } from './utils/with-context-root'

export const LinkSharingOff = args => {
  useFetchMock(setupFetchMock)

  const project = {
    ...args.project,
    publicAccesLevel: 'private',
  }

  return withContextRoot(<ShareProjectModal {...args} />, { project })
}

export const LinkSharingOn = args => {
  useFetchMock(setupFetchMock)

  const project = {
    ...args.project,
    publicAccesLevel: 'tokenBased',
  }

  return withContextRoot(<ShareProjectModal {...args} />, { project })
}

export const LinkSharingLoading = args => {
  useFetchMock(setupFetchMock)

  const project = {
    ...args.project,
    publicAccesLevel: 'tokenBased',
    tokens: undefined,
  }

  return withContextRoot(<ShareProjectModal {...args} />, { project })
}

export const NonAdminLinkSharingOff = args => {
  const project = {
    ...args.project,
    publicAccesLevel: 'private',
  }

  return withContextRoot(<ShareProjectModal {...args} isAdmin={false} />, {
    project,
  })
}

export const NonAdminLinkSharingOn = args => {
  const project = {
    ...args.project,
    publicAccesLevel: 'tokenBased',
  }

  return withContextRoot(<ShareProjectModal {...args} isAdmin={false} />, {
    project,
  })
}

export const RestrictedTokenMember = args => {
  // Override isRestrictedTokenMember to be true, then revert it back to the
  // original value on unmount
  // Currently this is necessary because the context value is set from window,
  // however in the future we should change this to set via props
  const originalIsRestrictedTokenMember = window.isRestrictedTokenMember
  window.isRestrictedTokenMember = true
  useEffect(() => {
    return () => {
      window.isRestrictedTokenMember = originalIsRestrictedTokenMember
    }
  })

  const project = {
    ...args.project,
    publicAccesLevel: 'tokenBased',
  }

  return withContextRoot(<ShareProjectModal {...args} />, { project })
}

export const LegacyLinkSharingReadAndWrite = args => {
  useFetchMock(setupFetchMock)

  const project = {
    ...args.project,
    publicAccesLevel: 'readAndWrite',
  }

  return withContextRoot(<ShareProjectModal {...args} />, { project })
}

export const LegacyLinkSharingReadOnly = args => {
  useFetchMock(setupFetchMock)

  const project = {
    ...args.project,
    publicAccesLevel: 'readOnly',
  }

  return withContextRoot(<ShareProjectModal {...args} />, { project })
}

export const LimitedCollaborators = args => {
  useFetchMock(setupFetchMock)

  const project = {
    ...args.project,
    features: {
      ...args.project.features,
      collaborators: 3,
    },
  }

  return withContextRoot(<ShareProjectModal {...args} />, { project })
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
  title: 'Editor / Modals / Share Project',
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

function setupFetchMock(fetchMock) {
  const delay = 1000

  fetchMock
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
