export default function freeTrialExpiresUnderSevenDays(
  trialEndsAt?: string | null
) {
  if (!trialEndsAt) return false

  const sevenDaysTime = new Date()
  sevenDaysTime.setDate(sevenDaysTime.getDate() + 7)
  const freeTrialEndDate = new Date(trialEndsAt)

  return new Date() < freeTrialEndDate && freeTrialEndDate < sevenDaysTime
}
