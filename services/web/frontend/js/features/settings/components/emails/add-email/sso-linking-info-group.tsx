import { DomainInfo } from './input'
import { Trans } from 'react-i18next'

type SSOLinkingInfoProps = {
  domainInfo: DomainInfo
}

function SsoLinkingInfoGroup({ domainInfo }: SSOLinkingInfoProps) {
  if (!domainInfo.group.ssoConfig) {
    return
  }

  const institutionName =
    domainInfo.group.teamName || domainInfo.university.name

  return (
    <>
      <p>
        <Trans
          i18nKey="to_add_email_accounts_need_to_be_linked_2"
          components={[<strong />]} // eslint-disable-line react/jsx-key
          values={{ institutionName }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
        />
      </p>

      <p>This feature is currently unavailable.</p>
    </>
  )
}

export default SsoLinkingInfoGroup
