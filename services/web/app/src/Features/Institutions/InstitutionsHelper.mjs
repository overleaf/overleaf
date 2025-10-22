function emailHasLicence(emailData) {
  if (!emailData.confirmedAt) {
    return false
  }
  if (!emailData.affiliation) {
    return false
  }
  const affiliation = emailData.affiliation
  const institution = affiliation.institution
  if (!institution) {
    return false
  }
  if (!institution.confirmed) {
    return false
  }
  if (!affiliation.licence) {
    return false
  }
  if (affiliation.pastReconfirmDate) {
    return false
  }

  return affiliation.licence !== 'free'
}

export default {
  emailHasLicence,
}
