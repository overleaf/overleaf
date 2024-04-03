import { useTranslation } from 'react-i18next'
import { Row, Col } from 'react-bootstrap'
import EmailCell from './cell'
import classnames from 'classnames'
import { bsClassName } from '@/features/utils/bootstrap-5'

function Header() {
  const { t } = useTranslation()

  return (
    <>
      <Row>
        <Col
          md={4}
          className={bsClassName({
            bs5: 'd-none d-sm-block',
            bs3: 'hidden-xs',
          })}
        >
          <EmailCell>
            <strong>{t('email')}</strong>
          </EmailCell>
        </Col>
        <Col
          md={8}
          className={bsClassName({
            bs5: 'd-none d-sm-block',
            bs3: 'hidden-xs',
          })}
        >
          <EmailCell>
            <strong>{t('institution_and_role')}</strong>
          </EmailCell>
        </Col>
      </Row>
      <div
        className={classnames(
          bsClassName({ bs5: 'd-none d-sm-block', bs3: 'hidden-xs' }),
          'horizontal-divider'
        )}
      />
      <div
        className={classnames(
          bsClassName({ bs5: 'd-none d-sm-block', bs3: 'hidden-xs' }),
          'horizontal-divider'
        )}
      />
    </>
  )
}

export default Header
