import { Project } from '../../../types/project'

export const project: Project = {
  _id: '63e21c07946dd8c76505f85a',
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
    _id: 'project-owner',
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
