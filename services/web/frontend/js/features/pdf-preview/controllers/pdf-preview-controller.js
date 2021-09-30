import App from '../../../base'
import { react2angular } from 'react2angular'

import PdfPreview from '../components/pdf-preview'
import { rootContext } from '../../../shared/context/root-context'

App.component('pdfPreview', react2angular(rootContext.use(PdfPreview), []))
