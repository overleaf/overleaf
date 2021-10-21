import App from '../../../base'
import { react2angular } from 'react2angular'

import PdfPreview from '../components/pdf-preview'
import { rootContext } from '../../../shared/context/root-context'
import PdfSynctexControls from '../components/pdf-synctex-controls'

App.component('pdfPreview', react2angular(rootContext.use(PdfPreview), []))
App.component(
  'pdfSynctexControls',
  react2angular(rootContext.use(PdfSynctexControls), [])
)
