import App from '../../../base'
import { react2angular } from 'react2angular'

import PdfPreview from '../components/pdf-preview'
import { rootContext } from '../../../shared/context/root-context'
import PdfSynctexControls from '../components/pdf-synctex-controls'
import { DetacherSynctexControl } from '../components/detach-synctex-control'

App.component('pdfPreview', react2angular(rootContext.use(PdfPreview), []))
App.component(
  'pdfSynctexControls',
  react2angular(rootContext.use(PdfSynctexControls), [])
)
App.component(
  'detacherSynctexControl',
  react2angular(rootContext.use(DetacherSynctexControl), [])
)
