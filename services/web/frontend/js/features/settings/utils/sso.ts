import getMeta from '../../../utils/meta'
import { DomainInfo } from '../components/emails/add-email/input'
import { Institution } from '../../../../../types/institution'

export const ssoAvailableForDomain = (
  domain: DomainInfo | null
): domain is DomainInfo => {
  const { hasSamlBeta, hasSamlFeature } = getMeta('ol-ExposedSettings')
  if (!hasSamlFeature || !domain || !domain.confirmed || !domain.university) {
    return false
  }
  if (domain.university.ssoEnabled) {
    return true
  }

  if (domain.group?.ssoConfig?.enabled) {
    return true
  }

  return Boolean(hasSamlBeta && domain.university.ssoBeta)
}

export const ssoAvailableForInstitution = (institution: Institution | null) => {
  const { hasSamlBeta, hasSamlFeature } = getMeta('ol-ExposedSettings')
  if (!hasSamlFeature || !institution || !institution.confirmed) {
    return false
  }
  if (institution.ssoEnabled) {
    return true
  }
  return hasSamlBeta && institution.ssoBeta
}
