import { useEffect } from 'react'
import ShareProjectModal from '@/features/share-project-modal/components/share-project-modal'
import { useProjectContext } from '@/shared/context/project-context'
import useFetchMock from './hooks/use-fetch-mock'
import { ScopeDecorator } from './decorators/scope'
import { contacts } from './fixtures/contacts'
import { project } from './fixtures/project'
import preview from '@ol-storybook/preview'

const STORY_USER_ID = 'story-user'

const member = (id, privileges, extra = {}) => ({
  _id: id,
  type: 'user',
  privileges,
  name: id,
  email: `${id}@example.com`,
  ...extra,
})
const editor = id => member(id, 'readAndWrite')
const pendingEditor = id => member(id, 'readAndWrite', { pendingEditor: true })
const reviewer = id => member(id, 'review')
const viewer = id => member(id, 'readOnly')
const invite = id => ({
  _id: id,
  privileges: 'readAndWrite',
  name: id,
  email: `${id}@example.com`,
})

// Member setups that, combined with the `collaborators` limit, drive each paywall.
const MEMBER_SCENARIOS = {
  none: [viewer('viewer-1'), editor('editor-1')],
  atLimit: [editor('editor-1')],
  overLimit: [editor('editor-1'), editor('editor-2')],
  downgraded: [pendingEditor('editor-1'), pendingEditor('editor-2')],
  downgradedResolved: [editor('editor-1'), pendingEditor('editor-2')],
  reviewer: [reviewer('reviewer-1')],
  selfPending: [editor('editor-1'), pendingEditor(STORY_USER_ID)],
}

const meta = preview.meta({
  title: 'Editor / Modals',
  component: ShareProjectModal,
  args: {
    show: true,
    animation: false,
    isOwner: true,
    collaborators: 1,
    memberScenario: 'overLimit',
    hasEditorInvite: false,
    trackChanges: false,
    trackChangesVisible: false,
    allowedFreeTrial: true,
    sharingUpdates: false,
    publicAccesLevel: 'private',
    isRestrictedTokenMember: false,
  },
  argTypes: {
    isOwner: {
      control: 'boolean',
      description: 'Whether the current user owns the project (isProjectOwner)',
    },
    collaborators: {
      control: 'number',
      description: 'Plan editor limit (features.collaborators; -1 = unlimited)',
    },
    memberScenario: {
      control: 'select',
      options: Object.keys(MEMBER_SCENARIOS),
      description:
        'Member/privilege makeup. With collaborators=1: atLimit=#3, overLimit=#1, ' +
        'downgraded/downgradedResolved=#2, reviewer=#5c/#6, selfPending (isOwner off)=#7',
    },
    hasEditorInvite: {
      control: 'boolean',
      description: 'Add a pending read+write invite (counts toward the limit)',
    },
    trackChanges: {
      control: 'boolean',
      description: 'features.trackChanges (track changes included)',
    },
    trackChangesVisible: {
      control: 'boolean',
      description: 'features.trackChangesVisible (reviewer role visible)',
    },
    allowedFreeTrial: {
      control: 'boolean',
      description:
        'ol-user.allowedFreeTrial — free-trial button vs plain upgrade',
    },
    sharingUpdates: {
      control: 'boolean',
      description: 'sharing-updates split test — redesigned vs legacy layout',
    },
    publicAccesLevel: {
      control: 'select',
      options: ['private', 'tokenBased', 'readAndWrite', 'readOnly'],
      description: 'Link-sharing / public access level',
    },
    isRestrictedTokenMember: {
      control: 'boolean',
      description: 'ol-isRestrictedTokenMember (link-only viewer)',
    },
    handleHide: { action: 'hide' },
    handleOpen: { action: 'open' },
  },
})

export const ShareProject = meta.story({
  render: args => {
    function Story() {
      // ProjectProvider is normally populated from the socket
      // `joinProjectResponse`, which the noop story socket never fires — so join
      // directly, else the modal early-returns null. (`publicAccessLevel` is the
      // context's spelling.)
      const { joinProject } = useProjectContext()
      useEffect(() => {
        joinProject({
          ...project,
          owner: {
            ...project.owner,
            _id: args.isOwner ? STORY_USER_ID : 'a-different-owner',
          },
          features: {
            ...project.features,
            collaborators: args.collaborators,
            trackChanges: args.trackChanges,
            trackChangesVisible: args.trackChangesVisible,
          },
          members:
            MEMBER_SCENARIOS[args.memberScenario] ?? MEMBER_SCENARIOS.none,
          invites: args.hasEditorInvite ? [invite('invited-editor')] : [],
          publicAccessLevel: args.publicAccesLevel,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [joinProject])
      useFetchMock(setupFetchMock)
      return <ShareProjectModal {...args} />
    }

    const metaTags = {
      'ol-user': {
        id: STORY_USER_ID,
        email: 'story-user@example.com',
        allowedFreeTrial: args.allowedFreeTrial,
        features: {},
      },
      'ol-splitTestVariants': {
        'sharing-updates': args.sharingUpdates ? 'enabled' : 'default',
      },
      'ol-isRestrictedTokenMember': args.isRestrictedTokenMember,
    }

    // Remount on any control change so meta read at provider-mount is re-applied.
    return (
      <div key={JSON.stringify(args)}>
        {ScopeDecorator(Story, { mockCompileOnLoad: false }, metaTags)}
      </div>
    )
  },
})

function setupFetchMock(fetchMock) {
  const delay = 1000

  fetchMock
    .get('express:/user/contacts', { contacts }, { delay })
    .get(
      'express:/project/:projectId/tokens',
      { tokens: project.tokens },
      { delay }
    )
    // 404 => "only invited people" in the redesigned layout
    .get('express:/project/:projectId/sharing-link', { status: 404 }, { delay })
    // project-snapshot bootstrap (runs on provider mount)
    .post('express:/project/:projectId/flush', {})
    .get('express:/project/:projectId/latest/history', {
      chunk: {
        history: { snapshot: { files: {} }, changes: [] },
        startVersion: 0,
      },
    })
    .post('express:/project/:projectId/settings/admin', 200, { delay })
    .put('express:/project/:projectId/users/:userId', 200, { delay })
    .delete('express:/project/:projectId/users/:userId', 200, { delay })
    .post('express:/project/:projectId/transfer-ownership', 200, { delay })
    .post('express:/project/:projectId/invite', 200, { delay })
    .delete('express:/project/:projectId/invite/:inviteId', 204, { delay })
    .post('express:/project/:projectId/invite/:inviteId/resend', 200, { delay })
    .post('express:/event/:key', {})
    // fallback so no request is left unmatched
    .catch({ status: 200, body: {} })
}
