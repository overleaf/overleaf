import DownloadMenu from '../../js/features/editor-left-menu/components/download-menu'
import { ScopeDecorator } from '../decorators/scope'
import { mockCompile, mockCompileError } from '../fixtures/compile'
import { document, mockDocument } from '../fixtures/document'
import useFetchMock from '../hooks/use-fetch-mock'
import { useScope } from '../hooks/use-scope'

export default {
  title: 'Editor / Left Menu / Download Menu',
  component: DownloadMenu,
  decorators: [
    (Story: any) => ScopeDecorator(Story, { mockCompileOnLoad: false }),
  ],
}

export const NotCompiled = () => {
  useFetchMock(fetchMock => {
    mockCompileError(fetchMock, 'failure')
  })

  return (
    <div id="left-menu" className="shown">
      <DownloadMenu />
    </div>
  )
}

export const CompileSuccess = () => {
  useScope({
    editor: {
      sharejs_doc: mockDocument(document.tex),
    },
  })

  useFetchMock(fetchMock => {
    mockCompile(fetchMock)
  })

  return (
    <div id="left-menu" className="shown">
      <DownloadMenu />
    </div>
  )
}
