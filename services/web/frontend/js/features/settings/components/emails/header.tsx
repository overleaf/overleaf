import { useTranslation } from 'react-i18next'
import EmailCell from './cell'
import ColWrapper from '@/features/ui/components/bootstrap-5/wrappers/col-wrapper'
import RowWrapper from '@/features/ui/components/bootstrap-5/wrappers/row-wrapper'
import classnames from 'classnames'
import { bsVersion } from '@/features/utils/bootstrap-5'

function Header() {
  const { t } = useTranslation()

  return (
    <>
      <RowWrapper>
        <ColWrapper
          md={4}
          className={bsVersion({
            bs5: 'd-none d-sm-block',
            bs3: 'hidden-xs',
          })}
        >
          <EmailCell>
            <strong>{t('email')}</strong>
          </EmailCell>
        </ColWrapper>
        <ColWrapper
          md={8}
          className={bsVersion({
            bs5: 'd-none d-sm-block',
            bs3: 'hidden-xs',
          })}
        >
          <EmailCell>
            <strong>{t('institution_and_role')}</strong>
          </EmailCell>
        </ColWrapper>
      </RowWrapper>
      <div
        className={classnames(
          bsVersion({ bs5: 'd-none d-sm-block', bs3: 'hidden-xs' }),
          'horizontal-divider'
        )}
      />
      <div
        className={classnames(
          bsVersion({ bs5: 'd-none d-sm-block', bs3: 'hidden-xs' }),
          'horizontal-divider'
        )}
      />
    </>
  )
}

export default Header
