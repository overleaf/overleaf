import { Button, Modal } from 'react-bootstrap'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import { useTabularContext } from './contexts/tabular-context'

export const TableGeneratorHelpModal = () => {
  const { helpShown, hideHelp } = useTabularContext()
  if (!helpShown) return null

  return (
    <AccessibleModal
      show={helpShown}
      onHide={hideHelp}
      className="table-generator-help-modal"
    >
      <Modal.Header closeButton>
        <Modal.Title>Help</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          This tool helps you insert simple tables into your project without
          writing LaTeX code. This tool is new, so please{' '}
          <a
            href="https://forms.gle/ri3fzV1oQDAjmfmD7"
            target="_blank"
            rel="noopener noreferrer"
          >
            give us feedback
          </a>{' '}
          and look out for additional functionality coming soon.
        </p>
        <b>How it works</b>
        <p>
          You’ll get the best results from using this tool in the{' '}
          <b>Visual Editor</b>, although you can still use it to insert tables
          in the <b>Code Editor</b>. Once you’ve selected the number of rows and
          columns you need, the table will appear in your document and you can
          double click in a cell to add contents to it.
        </p>
        <b>Customizing tables</b>
        <p>
          If you need to customize your table further, you can. Using LaTeX
          code, you can change anything from table styles and border styles to
          colors and column widths.{' '}
          <a
            href="https://www.overleaf.com/learn/latex/Tables"
            target="_blank"
            rel="noopener"
          >
            Read our guide
          </a>{' '}
          to using tables in LaTeX to help you get started.
        </p>
        <b>Changing the position of your table</b>
        <p>
          LaTeX places tables according to a special algorithm. You can use
          “placement parameters” to influence the position of the table.{' '}
          <a
            href="https://www.overleaf.com/learn/latex/Positioning_images_and_tables"
            target="_blank"
            rel="noopener"
          >
            This article
          </a>{' '}
          explains how to do this.
        </p>
        <b>Understanding labels</b>
        <p>
          Labels help you to reference your tables throughout your document
          easily. To reference a table within the text, reference the label
          using the <code>\ref&#123;...&#125;</code> command. This makes it easy
          to reference tables without manually remembering the table numbering.{' '}
          <a
            href="https://www.overleaf.com/learn/latex/Inserting_Images#Labels_and_cross-references"
            target="_blank"
            rel="noopener"
          >
            Read about labels and cross-references.
          </a>
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={hideHelp}>Close</Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
