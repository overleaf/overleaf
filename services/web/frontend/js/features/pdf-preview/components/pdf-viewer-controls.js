import { ButtonGroup } from 'react-bootstrap'
import PropTypes from 'prop-types'
import Button from 'react-bootstrap/lib/Button'
import Icon from '../../../shared/components/icon'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

function PdfViewerControls({ setZoom }) {
  const { t } = useTranslation()
  return (
    <ButtonGroup>
      <Button
        aria-label={t('fit_to_width')}
        bsSize="large"
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
        onClick={() => setZoom('fit-width')}
      >
        <Icon type="arrows-h" />
      </Button>
      <Button
        aria-label={t('fit_to_height')}
        bsSize="large"
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
        onClick={() => setZoom('fit-height')}
      >
        <Icon type="arrows-v" />
      </Button>
      <Button
        aria-label={t('zoom_in')}
        bsSize="large"
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
        onClick={() => setZoom('zoom-in')}
      >
        <Icon type="search-plus" />
      </Button>
      <Button
        aria-label={t('zoom_out')}
        bsSize="large"
        bsStyle={null}
        className="btn-secondary-info btn-secondary"
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
