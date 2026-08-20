import getMeta from '@/utils/meta'
import { Affiliation } from '../../../../../types/affiliation'
import { ssoAvailableForInstitution } from './sso'

export const emailMustBeConfirmedViaSAML = (
  affiliation: Affiliation | null
): boolean => {
  const { hasSamlFeature } = getMeta('ol-ExposedSettings')
  if (
    !hasSamlFeature ||
    !affiliation ||
    !affiliation.institution ||
    !affiliation.institution.confirmed
  ) {
    return false
  }
  // both groups and Commons have affiliation.institution, but only Commons has SAML
  // information in affiliation.institution
  // ssoAvailableForInstitution will only check affiliation.institution for Commons
  // and there are different rules for whether SAML is enabled or not for groups with
  // domain capture or Commons

  const samlViaCommons = ssoAvailableForInstitution(affiliation.institution)

  const samlViaGroup =
    affiliation.domainCapturedByGroup &&
    affiliation.group?.domainCaptureEnabled &&
    affiliation.group?.managedUsersEnabled

  return samlViaCommons || samlViaGroup || false
}
