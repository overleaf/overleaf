export type VerificationJobStatus = {
  verified: number
  total: number
  startDate?: Date
  endDate?: Date
  hasFailure: boolean
  errorTypes: Array<string>
}
