import { useTranslation } from 'react-i18next'
import getMeta from '../../../utils/meta'
import ActionsCopyProject from './actions-copy-project'
import ActionsWordCount from './actions-word-count'

export default function ActionsMenu() {
  const { t } = useTranslation()
  const anonymous = getMeta('ol-anonymous') as boolean | undefined

  if (anonymous === true || anonymous === undefined) {
    return null
  }

  return (
    <>
      <h4>{t('actions')}</h4>
      <ul className="list-unstyled nav">
        <li>
          <ActionsCopyProject />
        </li>
        <li>
          <ActionsWordCount />
        </li>
      </ul>
    </>
  )
}
