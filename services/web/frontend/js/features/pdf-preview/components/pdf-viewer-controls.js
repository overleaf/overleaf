import { ButtonGroup } from 'react-bootstrap'
import PropTypes from 'prop-types'
import Button from 'react-bootstrap/lib/Button'
import Icon from '../../../shared/components/icon'
import { memo } from 'react'

function PdfViewerControls({ setZoom }) {
  return (
    <ButtonGroup>
      <Button
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
        bsSize="large"
        onClick={() => setZoom('fit-width')}
      >
        <Icon type="arrows-h" />
      </Button>
      <Button
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
        bsSize="large"
        onClick={() => setZoom('fit-height')}
      >
        <Icon type="arrows-v" />
      </Button>
      <Button
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
        bsSize="large"
        onClick={() => setZoom('zoom-in')}
      >
        <Icon type="search-plus" />
      </Button>
      <Button
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
        bsSize="large"
        onClick={() => setZoom('zoom-out')}
      >
        <Icon type="search-minus" />
      </Button>
    </ButtonGroup>
  )
}

PdfViewerControls.propTypes = {
  setZoom: PropTypes.func.isRequired,
}

export default memo(PdfViewerControls)
