import { expect } from 'chai'
import { mockScope } from './scope'
import { EditorProviders } from '../../helpers/editor-providers'
import { renderHook } from '@testing-library/react'
import { useNewEditorVariant } from '@/features/ide-redesign/utils/new-editor-utils'

describe('new-editor-utils', function () {
  describe('useNewEditorVariant', function () {
    const newEditorVariants = [
      { splitTestVariant: 'default', uiVariant: 'default' },
      {
        splitTestVariant: 'new-editor',
        uiVariant: 'new-editor-new-logs-old-position',
      },
      {
        splitTestVariant: 'new-editor-old-logs',
        uiVariant: 'new-editor-new-logs-old-position',
      },
      {
        splitTestVariant: 'new-editor-new-logs-old-position',
        uiVariant: 'new-editor-new-logs-old-position',
      },
    ]
    for (const variant of newEditorVariants) {
      it(`forwards ?editor-redesign-new-users=${variant}`, function () {
        window.metaAttributesCache.set('ol-splitTestVariants', {
          'editor-redesign-new-users': variant.splitTestVariant,
        })

        const scope = mockScope()

        const { result } = renderHook(() => useNewEditorVariant(), {
          wrapper: ({ children }) => (
            <EditorProviders
              scope={scope}
              userSettings={{ enableNewEditor: true }}
            >
              {children}
            </EditorProviders>
          ),
        })
        expect(result.current).to.equal(variant.uiVariant)
      })
    }
    for (const variant of newEditorVariants) {
      it(`ignores ?editor-redesign-new-users=${variant} when disabled by user`, function () {
        window.metaAttributesCache.set('ol-splitTestVariants', {
          'editor-redesign-new-users': variant.splitTestVariant,
        })

        const scope = mockScope()

        const { result } = renderHook(() => useNewEditorVariant(), {
          wrapper: ({ children }) => (
            <EditorProviders
              scope={scope}
              userSettings={{ enableNewEditor: false }}
            >
              {children}
            </EditorProviders>
          ),
        })
        expect(result.current).to.equal('default')
      })
    }
    it(`handles ?editor-redesign=enabled`, function () {
      window.metaAttributesCache.set('ol-splitTestVariants', {
        'editor-redesign': 'enabled',
      })

      const scope = mockScope()

      const { result } = renderHook(() => useNewEditorVariant(), {
        wrapper: ({ children }) => (
          <EditorProviders
            scope={scope}
            userSettings={{ enableNewEditor: true }}
          >
            {children}
          </EditorProviders>
        ),
      })
      expect(result.current).to.equal('new-editor-new-logs-old-position')
    })
  })
})
