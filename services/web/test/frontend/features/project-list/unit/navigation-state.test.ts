import { expect } from 'chai'
import {
  getInitialNavigationState,
  getNavigationState,
  getNavigationUrl,
  migrateLegacyNavigationState,
} from '../../../../../frontend/js/features/project-list/util/navigation-state'
import { UNCATEGORIZED_KEY } from '../../../../../frontend/js/features/project-list/context/project-list-context'

const LEGACY_FILTER_KEY = 'project-list-filter'
const LEGACY_SELECTED_TAG_ID_KEY = 'project-list-selected-tag-id'

describe('navigation-state', function () {
  describe('getNavigationState', function () {
    it('maps the bare dashboard path to the default filter', function () {
      expect(getNavigationState('/project')).to.deep.equal({
        type: 'filter',
        filter: 'all',
      })
    })

    it('ignores a trailing slash', function () {
      expect(getNavigationState('/project/')).to.deep.equal({
        type: 'filter',
        filter: 'all',
      })
    })

    it('maps filter segments to filters', function () {
      expect(getNavigationState('/project/owned')).to.deep.equal({
        type: 'filter',
        filter: 'owned',
      })
      expect(getNavigationState('/project/shared')).to.deep.equal({
        type: 'filter',
        filter: 'shared',
      })
      expect(getNavigationState('/project/archived')).to.deep.equal({
        type: 'filter',
        filter: 'archived',
      })
      expect(getNavigationState('/project/trashed')).to.deep.equal({
        type: 'filter',
        filter: 'trashed',
      })
    })

    it('maps the untagged path to the uncategorized tag', function () {
      expect(getNavigationState('/project/untagged')).to.deep.equal({
        type: 'tag',
        tag: UNCATEGORIZED_KEY,
      })
    })

    it('maps a tag path to the tag id', function () {
      expect(getNavigationState('/project/tags/abc123')).to.deep.equal({
        type: 'tag',
        tag: 'abc123',
      })
    })

    it('decodes the tag id', function () {
      expect(getNavigationState('/project/tags/a%2Fb')).to.deep.equal({
        type: 'tag',
        tag: 'a/b',
      })
    })

    it('falls back to the default filter for unknown paths', function () {
      expect(getNavigationState('/project/nonsense')).to.deep.equal({
        type: 'filter',
        filter: 'all',
      })
    })
  })

  describe('getNavigationUrl', function () {
    it('maps the default filter to the bare dashboard path', function () {
      expect(getNavigationUrl({ type: 'filter', filter: 'all' })).to.equal(
        '/project'
      )
    })

    it('maps filters to filter segments', function () {
      expect(getNavigationUrl({ type: 'filter', filter: 'owned' })).to.equal(
        '/project/owned'
      )
      expect(getNavigationUrl({ type: 'filter', filter: 'shared' })).to.equal(
        '/project/shared'
      )
      expect(getNavigationUrl({ type: 'filter', filter: 'archived' })).to.equal(
        '/project/archived'
      )
      expect(getNavigationUrl({ type: 'filter', filter: 'trashed' })).to.equal(
        '/project/trashed'
      )
    })

    it('maps the uncategorized tag to the untagged path', function () {
      expect(
        getNavigationUrl({ type: 'tag', tag: UNCATEGORIZED_KEY })
      ).to.equal('/project/untagged')
    })

    it('maps a tag id to a tag path', function () {
      expect(getNavigationUrl({ type: 'tag', tag: 'abc123' })).to.equal(
        '/project/tags/abc123'
      )
    })

    it('encodes the tag id', function () {
      expect(getNavigationUrl({ type: 'tag', tag: 'a/b' })).to.equal(
        '/project/tags/a%2Fb'
      )
    })
  })

  describe('legacy local-storage migration', function () {
    const setLegacyFilter = (value: string) =>
      localStorage.setItem(LEGACY_FILTER_KEY, JSON.stringify(value))
    const setLegacyTag = (value: string) =>
      localStorage.setItem(LEGACY_SELECTED_TAG_ID_KEY, JSON.stringify(value))

    beforeEach(function () {
      localStorage.clear()
      window.history.replaceState(null, '', '/project')
    })

    afterEach(function () {
      localStorage.clear()
      window.history.replaceState(null, '', '/project')
    })

    describe('getInitialNavigationState', function () {
      it('uses the URL state when there is no legacy state', function () {
        window.history.replaceState(null, '', '/project/owned')
        expect(getInitialNavigationState()).to.deep.equal({
          type: 'filter',
          filter: 'owned',
        })
      })

      it('restores a legacy filter on the bare dashboard path', function () {
        setLegacyFilter('trashed')
        expect(getInitialNavigationState()).to.deep.equal({
          type: 'filter',
          filter: 'trashed',
        })
      })

      it('restores a legacy selected tag on the bare dashboard path', function () {
        setLegacyTag('abc123')
        expect(getInitialNavigationState()).to.deep.equal({
          type: 'tag',
          tag: 'abc123',
        })
      })

      it('prefers a legacy tag over a legacy filter', function () {
        setLegacyFilter('trashed')
        setLegacyTag(UNCATEGORIZED_KEY)
        expect(getInitialNavigationState()).to.deep.equal({
          type: 'tag',
          tag: UNCATEGORIZED_KEY,
        })
      })

      it('ignores legacy state when the URL already has a navigation state', function () {
        window.history.replaceState(null, '', '/project/shared')
        setLegacyFilter('trashed')
        expect(getInitialNavigationState()).to.deep.equal({
          type: 'filter',
          filter: 'shared',
        })
      })

      it('ignores an invalid legacy filter', function () {
        setLegacyFilter('nonsense')
        expect(getInitialNavigationState()).to.deep.equal({
          type: 'filter',
          filter: 'all',
        })
      })

      it('does not mutate the URL or clear the legacy state', function () {
        setLegacyFilter('trashed')
        getInitialNavigationState()
        expect(window.location.pathname).to.equal('/project')
        expect(localStorage.getItem(LEGACY_FILTER_KEY)).to.not.equal(null)
      })
    })

    describe('migrateLegacyNavigationState', function () {
      it('rewrites the URL to the legacy state and clears it', function () {
        setLegacyFilter('trashed')
        migrateLegacyNavigationState()
        expect(window.location.pathname).to.equal('/project/trashed')
        expect(localStorage.getItem(LEGACY_FILTER_KEY)).to.equal(null)
        expect(localStorage.getItem(LEGACY_SELECTED_TAG_ID_KEY)).to.equal(null)
      })

      it('rewrites the URL to a legacy tag state', function () {
        setLegacyTag('abc123')
        migrateLegacyNavigationState()
        expect(window.location.pathname).to.equal('/project/tags/abc123')
        expect(localStorage.getItem(LEGACY_SELECTED_TAG_ID_KEY)).to.equal(null)
      })

      it('clears legacy state without rewriting on a non-bare path', function () {
        window.history.replaceState(null, '', '/project/owned')
        setLegacyFilter('trashed')
        migrateLegacyNavigationState()
        expect(window.location.pathname).to.equal('/project/owned')
        expect(localStorage.getItem(LEGACY_FILTER_KEY)).to.equal(null)
      })

      it('leaves the URL unchanged when there is no legacy state', function () {
        migrateLegacyNavigationState()
        expect(window.location.pathname).to.equal('/project')
      })
    })
  })
})
