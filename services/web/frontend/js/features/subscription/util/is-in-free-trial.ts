export default function isInFreeTrial(trialEndsAt?: string | null) {
  if (!trialEndsAt) return false

  const endDate = new Date(trialEndsAt)

  if (endDate.getTime() < Date.now()) return false

  return true
}
