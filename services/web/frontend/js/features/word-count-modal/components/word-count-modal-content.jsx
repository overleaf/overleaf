import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Modal, Row, Col, Grid } from 'react-bootstrap'
import { useIdeContext } from '../../../shared/context/ide-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { useWordCount } from '../hooks/use-word-count'
import Icon from '../../../shared/components/icon'

// NOTE: this component is only mounted when the modal is open
export default function WordCountModalContent({ handleHide }) {
  const { _id: projectId } = useProjectContext()
  const { clsiServerId } = useIdeContext()
  const { t } = useTranslation()
  const { data, error, loading } = useWordCount(projectId, clsiServerId)

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{t('word_count')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {loading && !error && (
          <div className="loading">
            <Icon type="refresh" spin fw />
            &nbsp;
            {t('loading')}…
          </div>
        )}

        {error && (
          <Alert bsStyle="danger">{t('generic_something_went_wrong')}</Alert>
        )}

        {data && (
          <Grid fluid>
            {data.messages && (
              <Row>
                <Col xs={12}>
                  <Alert bsStyle="danger">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{data.messages}</p>
                  </Alert>
                </Col>
              </Row>
            )}

            <Row>
              <Col xs={4}>
                <div className="pull-right">{t('total_words')}:</div>
              </Col>
              <Col xs={6}>{data.textWords}</Col>
            </Row>

            <Row>
              <Col xs={4}>
                <div className="pull-right">{t('headers')}:</div>
              </Col>
              <Col xs={6}>{data.headers}</Col>
            </Row>

            <Row>
              <Col xs={4}>
                <div className="pull-right">{t('math_inline')}:</div>
              </Col>
              <Col xs={6}>{data.mathInline}</Col>
            </Row>

            <Row>
              <Col xs={4}>
                <div className="pull-right">{t('math_display')}:</div>
              </Col>
              <Col xs={6}>{data.mathDisplay}</Col>
            </Row>
          </Grid>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button bsStyle={null} className="btn-secondary" onClick={handleHide}>
          {t('close')}
        </Button>
      </Modal.Footer>
    </>
  )
}

WordCountModalContent.propTypes = {
  handleHide: PropTypes.func.isRequired,
}
