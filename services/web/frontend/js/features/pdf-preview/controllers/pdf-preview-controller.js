import App from '../../../base'
import { react2angular } from 'react2angular'

import PdfPreviewPane from '../components/pdf-preview-pane'

App.component('pdfPreviewPane', react2angular(PdfPreviewPane, undefined))
