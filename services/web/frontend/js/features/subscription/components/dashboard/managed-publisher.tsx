import { Trans, useTranslation } from 'react-i18next'
import { Publisher } from './managed-publishers'

type ManagedPublisherProps = {
  publisher: Publisher
}

export default function ManagedPublisher({ publisher }: ManagedPublisherProps) {
  const { t } = useTranslation()

  return (
    <div>
      <p>
        <Trans
          i18nKey="you_are_a_manager_of_publisher_x"
          components={[<strong />]} // eslint-disable-line react/jsx-key
          values={{
            publisherName: publisher.name || '',
          }}
        />
      </p>
      <p>
        <a href={`/publishers/${publisher.slug}/hub`}>
          <i className="fa fa-fw fa-user-circle" /> {t('view_hub')}
        </a>
      </p>
      <p>
        <a href={`/manage/publishers/${publisher.slug}/managers`}>
          <i className="fa fa-fw fa-users" /> {t('manage_publisher_managers')}
        </a>
      </p>
      <hr />
    </div>
  )
}
