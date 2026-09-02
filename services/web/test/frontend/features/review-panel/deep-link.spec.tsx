import CodeMirrorEditor from '../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { GlobalToasts } from '../../../../frontend/js/features/ide-react/components/global-toasts'
import {
  EditorProviders,
  makeProjectProvider,
  USER_EMAIL,
  USER_ID,
} from '../../helpers/editor-providers'
import { mockScope } from '../source-editor/helpers/mock-scope'
import { TestContainer } from '../source-editor/helpers/test-container'
import { docId, mockDocContent } from '../source-editor/helpers/mock-doc'
import { mockProject } from '../source-editor/helpers/mock-project'

const userData = {
  avatar_text: 'User',
  email: USER_EMAIL,
  hue: 180,
  id: USER_ID,
  isSelf: true,
  first_name: 'Test',
  last_name: 'User',
}

const unresolvedThreadId = 'unresolved-thread-id'

const commentOps = [
  {
    id: 'unresolved-op-id',
    op: { p: 210, c: 'Your results', t: unresolvedThreadId },
  },
]

const threads = {
  [unresolvedThreadId]: {
    messages: [
      {
        content: 'unresolved comment text',
        id: `${unresolvedThreadId}-1`,
        timestamp: new Date('2025-01-01T00:00:00.000Z'),
        user: userData,
        user_id: USER_ID,
      },
    ],
  },
}

const resolvedThreadId = 'resolved-thread-id'

const resolvedCommentOps = [
  {
    id: 'resolved-op-id',
    op: { p: 210, c: 'Your results', t: resolvedThreadId },
  },
]

const resolvedThreads = {
  [resolvedThreadId]: {
    resolved: true,
    resolved_at: '2025-01-02T00:00:00.000Z',
    resolved_by_user_id: USER_ID,
    resolved_by_user: userData,
    messages: [
      {
        content: 'resolved comment text',
        id: `${resolvedThreadId}-1`,
        timestamp: new Date('2025-01-01T00:00:00.000Z'),
        user: userData,
        user_id: USER_ID,
      },
    ],
  },
}

const insertChangeId = 'insert-change-id'
const aggregatedDeleteChangeId = 'aggregated-delete-change-id'
const standaloneDeleteChangeId = 'standalone-delete-change-id'

const changesOps = [
  {
    metadata: {
      user_id: USER_ID,
      ts: new Date('2025-01-01T00:00:00.000Z'),
    },
    id: insertChangeId,
    op: { p: 166, t: insertChangeId, i: 'introduction' },
  },
  // adjacent same-user deletion starting at insert end -> aggregated into
  // the preceding insert's entry by review-panel-current-file
  {
    metadata: {
      user_id: USER_ID,
      ts: new Date('2025-01-01T00:00:01.000Z'),
    },
    id: aggregatedDeleteChangeId,
    op: {
      p: 166 + 'introduction'.length,
      t: aggregatedDeleteChangeId,
      d: 'preface',
    },
  },
  {
    metadata: {
      user_id: USER_ID,
      ts: new Date('2025-01-01T01:00:00.000Z'),
    },
    id: standaloneDeleteChangeId,
    op: { p: 110, t: standaloneDeleteChangeId, d: 'beautiful ' },
  },
]

// a doc long enough that its end sits outside the rendered CodeMirror viewport,
// so the review panel renders no entry for a range there until the editor
// scrolls to it
const belowFoldMarker = 'content line 1900'
const belowFoldContent = mockDocContent(
  Array.from(Array(2000), (e, i) => `content line ${i}`).join('\n')
)
const belowFoldPosition = belowFoldContent.indexOf(belowFoldMarker)

const belowFoldThreadId = 'below-fold-thread-id'

const belowFoldCommentOps = [
  {
    id: 'below-fold-op-id',
    op: { p: belowFoldPosition, c: belowFoldMarker, t: belowFoldThreadId },
  },
]

const belowFoldThreads = {
  [belowFoldThreadId]: {
    messages: [
      {
        content: 'below fold comment text',
        id: `${belowFoldThreadId}-1`,
        timestamp: new Date('2025-01-01T00:00:00.000Z'),
        user: userData,
        user_id: USER_ID,
      },
    ],
  },
}

const belowFoldChangeId = 'below-fold-change-id'

const belowFoldChangeOps = [
  {
    metadata: {
      user_id: USER_ID,
      ts: new Date('2025-01-01T00:00:00.000Z'),
    },
    id: belowFoldChangeId,
    op: { p: belowFoldPosition, t: belowFoldChangeId, i: belowFoldMarker },
  },
]

type MountOptions = {
  search?: string
  comments?: typeof commentOps
  changes?: typeof changesOps
  threads?: object
  trackChangesVisible?: boolean
  content?: string
}

function mountEditor({
  search = '',
  comments = [],
  changes = [],
  threads = {},
  trackChangesVisible = true,
  content,
}: MountOptions = {}) {
  cy.intercept('GET', '/project/*/changes/users', [
    {
      id: USER_ID,
      email: USER_EMAIL,
      first_name: 'Test',
      last_name: 'User',
    },
  ])

  cy.intercept('GET', '/project/*/threads', threads)

  cy.intercept('GET', '/project/*/ranges', [
    {
      id: docId,
      ranges: { changes, comments, docId },
    },
  ])

  cy.intercept('POST', `/project/*/doc/${docId}/metadata`, {})

  cy.window().then(win => {
    win.history.replaceState({}, '', `${win.location.pathname}${search}`)
  })

  const scope = mockScope(content, {
    docOptions: {
      rangesOptions: {
        comments,
        changes,
        getChanges: cy.stub().returns([]),
        removeChangeIds: cy.stub(),
      },
    },
  })

  const project = mockProject({
    projectOwner: { _id: USER_ID },
    projectFeatures: { trackChanges: false, trackChangesVisible },
  })

  cy.mount(
    <TestContainer className="rp-size-expanded">
      <EditorProviders
        scope={scope}
        providers={{ ProjectProvider: makeProjectProvider(project) }}
      >
        {/* mounted first so the toast listener is registered before the
        editor, as it is in the real IDE page */}
        <GlobalToasts />
        <CodeMirrorEditor />
      </EditorProviders>
    </TestContainer>
  )

  // Wait for the editor to be ready before making assertions
  cy.get('.cm-content').should('have.css', 'opacity', '1')
}

describe('<DeepLink />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)

    cy.interceptEvents()
  })

  describe('review panel deep link', function () {
    it('opens the review panel', function () {
      mountEditor({ search: '?open=review-panel' })

      cy.findByTestId('review-panel').should(
        'not.have.class',
        'review-panel-mini'
      )
    })

    it('strips the deep link param from the URL', function () {
      mountEditor({ search: '?open=review-panel' })

      cy.location('search').should('not.contain', 'open=')
    })

    it('leaves the review panel in mini mode without the param', function () {
      mountEditor({ comments: commentOps, threads })

      cy.findByTestId('review-panel').should('have.class', 'review-panel-mini')
    })

    it('does not render the review panel when track changes is not available', function () {
      mountEditor({
        search: '?open=review-panel',
        trackChangesVisible: false,
      })

      cy.findByTestId('review-panel').should('not.exist')
    })
  })

  describe('comment deep link', function () {
    function mountWithDeepLink(
      threadId: string,
      { trackChangesVisible = true } = {}
    ) {
      mountEditor({
        search: `?comment=${threadId}`,
        comments: commentOps,
        threads,
        trackChangesVisible,
      })
    }

    it('opens the review panel and selects an unresolved comment', function () {
      mountWithDeepLink(unresolvedThreadId)

      cy.findByTestId('review-panel').should(
        'not.have.class',
        'review-panel-mini'
      )
      cy.findByText('unresolved comment text')
        .closest('.review-panel-entry')
        .should('have.class', 'review-panel-entry-selected')
    })

    it('strips the deep link params from the URL', function () {
      mountWithDeepLink(unresolvedThreadId)

      cy.location('search').should('not.contain', 'comment=')
    })

    it('selects and focuses a comment below the rendered viewport', function () {
      mountEditor({
        search: `?comment=${belowFoldThreadId}`,
        comments: belowFoldCommentOps,
        threads: belowFoldThreads,
        content: belowFoldContent,
      })

      cy.findByText('below fold comment text')
        .closest('.review-panel-entry')
        .should('have.class', 'review-panel-entry-selected')
        .and('have.focus')
    })

    it('shows a toast when the comment does not exist', function () {
      mountWithDeepLink('missing-thread-id')

      cy.findByText('Comment not found').should('exist')
    })

    it('opens the review panel and shows a toast when the comment is resolved', function () {
      mountEditor({
        search: `?comment=${resolvedThreadId}`,
        comments: resolvedCommentOps,
        threads: resolvedThreads,
      })

      cy.findByTestId('review-panel').should(
        'not.have.class',
        'review-panel-mini'
      )
      cy.findByText('Comment not found').should('exist')
    })

    it('shows a toast when track changes is not available', function () {
      mountWithDeepLink(unresolvedThreadId, { trackChangesVisible: false })

      cy.findByText('Comment not found').should('exist')
    })
  })

  describe('tracked change deep link', function () {
    function mountWithDeepLink(
      changeId: string,
      { trackChangesVisible = true } = {}
    ) {
      mountEditor({
        search: `?change=${changeId}`,
        changes: changesOps,
        trackChangesVisible,
      })
    }

    it('opens the review panel and selects the matching change', function () {
      mountWithDeepLink(standaloneDeleteChangeId)

      cy.findByTestId('review-panel').should(
        'not.have.class',
        'review-panel-mini'
      )
      cy.findByText('beautiful')
        .closest('.review-panel-entry')
        .should('have.class', 'review-panel-entry-selected')
    })

    it('selects the aggregated entry when the id belongs to the absorbed deletion', function () {
      mountWithDeepLink(aggregatedDeleteChangeId)

      cy.findByText('preface')
        .closest('.review-panel-entry')
        .should('have.class', 'review-panel-entry-selected')
        .and('have.class', 'review-panel-entry-insert')
    })

    it('selects and focuses a change below the rendered viewport', function () {
      mountEditor({
        search: `?change=${belowFoldChangeId}`,
        changes: belowFoldChangeOps,
        content: belowFoldContent,
      })

      // the marker text also appears in the document, so scope the lookup to
      // the review panel
      cy.findByTestId('review-panel')
        .findByText(belowFoldMarker)
        .closest('.review-panel-entry')
        .should('have.class', 'review-panel-entry-selected')
        .and('have.focus')
    })

    it('strips the deep link params from the URL', function () {
      mountWithDeepLink(insertChangeId)

      cy.location('search').should('not.contain', 'change=')
    })

    it('opens the review panel and drops the pending id when the change does not exist', function () {
      mountWithDeepLink('missing-change-id')

      cy.findByTestId('review-panel').should(
        'not.have.class',
        'review-panel-mini'
      )
      cy.findAllByText('Comment not found').should('not.exist')
    })

    it('silently opens the doc when track changes is not available', function () {
      mountWithDeepLink(insertChangeId, { trackChangesVisible: false })

      cy.findAllByText('Comment not found').should('not.exist')
    })
  })
})
