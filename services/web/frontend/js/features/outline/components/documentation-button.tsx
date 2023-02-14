import { useState } from 'react'
import Icon from '../../../shared/components/icon'
import { useSplitTestContext } from '../../../shared/context/split-test-context'
import { sendMB } from '../../../infrastructure/event-tracking'
import PropTypes from 'prop-types'
import { Button } from 'react-bootstrap'

function DocumentationButton() {
  const { splitTestVariants } = useSplitTestContext({
    splitTestVariants: PropTypes.object,
  })
  const documentationButtonVariant =
    splitTestVariants['documentation-on-editor']

  let documentationButtonText = ''

  if (documentationButtonVariant === 'latex-help')
    documentationButtonText = 'LaTeX help'
  else if (documentationButtonVariant === 'documentation')
    documentationButtonText = 'Documentation'
  else if (documentationButtonVariant === 'help-guides')
    documentationButtonText = 'Help guides'
  const [showDocumentationButton, setShowDocumentationButton] = useState(
    !(documentationButtonVariant === 'default')
  )

  function handleCloseClick() {
    sendMB('file-tree-documentation-dismiss ')

    setShowDocumentationButton(false)
  }

  function handleDocumentationLinkClick() {
    sendMB('file-tree-documentation-click')
  }
  return (
    <div className="outline-pane">
      {showDocumentationButton ? (
        <header className="outline-footer">
          <div className="outline-header-expand-collapse-btn documentation-btn">
            <a
              href="/learn"
              target="_blank"
              rel="noreferrer"
              className="documentation-link"
              onClick={handleDocumentationLinkClick}
            >
              <Icon
                type="question-circle"
                className="outline-caret-icon"
                style={{ color: 'white' }}
              />
              <h4 className="outline-header-name">{documentationButtonText}</h4>
            </a>
            <Button bsStyle="link">
              <Icon
                style={{ color: 'white' }}
                type="times"
                onClick={handleCloseClick}
                className="outline-caret-icon"
              />
            </Button>
          </div>
        </header>
      ) : null}
    </div>
  )
}

export default DocumentationButton
