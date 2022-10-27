import ActionsMenu from '../../js/features/editor-left-menu/components/actions-menu'
import { ScopeDecorator } from '../decorators/scope'
import { mockCompile, mockCompileError } from '../fixtures/compile'
import { document, mockDocument } from '../fixtures/document'
import useFetchMock from '../hooks/use-fetch-mock'
import { useScope } from '../hooks/use-scope'

export default {
  title: 'Editor / Left Menu / Actions Menu',
  component: ActionsMenu,
  decorators: [
    (Story: any) => ScopeDecorator(Story, { mockCompileOnLoad: false }),
  ],
}

export const NotCompiled = () => {
  window.metaAttributesCache.set('ol-anonymous', false)

  useFetchMock(fetchMock => {
    mockCompileError(fetchMock, 'failure')
  })

  return (
    <div id="left-menu" className="shown">
      <ActionsMenu />
    </div>
  )
}

export const CompileSuccess = () => {
  window.metaAttributesCache.set('ol-anonymous', false)

  useScope({
    editor: {
      sharejs_doc: mockDocument(document.tex),
    },
  })

  useFetchMock(fetchMock => {
    mockCompile(fetchMock)
    fetchMock.get('express:/project/:projectId/wordcount', {
      texcount: {
        encode: 'ascii',
        textWords: 10,
        headers: 11,
        mathInline: 12,
        mathDisplay: 13,
      },
    })
  })

  return (
    <div id="left-menu" className="shown">
      <ActionsMenu />
    </div>
  )
}
