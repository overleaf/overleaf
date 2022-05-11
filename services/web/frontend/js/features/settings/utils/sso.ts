import getMeta from '../../../utils/meta'
import { InstitutionInfo } from '../components/emails/add-email/input'
import { ExposedSettings } from '../../../../../types/exposed-settings'
import { Nullable } from '../../../../../types/utils'

const ssoAvailableForDomain = (domain: InstitutionInfo | null) => {
  const { hasSamlBeta, hasSamlFeature } = getMeta(
    'ol-ExposedSettings'
  ) as ExposedSettings
  if (!hasSamlFeature || !domain || !domain.confirmed || !domain.university) {
    return false
  }
  if (domain.university.ssoEnabled) {
    return true
  }
  return hasSamlBeta && domain.university.ssoBeta
}

export const isSsoAvailable = (
  institutionInfo: Nullable<InstitutionInfo>
): institutionInfo is InstitutionInfo => {
  return Boolean(institutionInfo && ssoAvailableForDomain(institutionInfo))
}
