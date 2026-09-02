import 'express'

declare module 'express' {
  // eslint-disable-next-line no-unused-vars
  interface Response {
    // Set per-request by the addSetContentDisposition middleware in
    // app/src/infrastructure/ExpressLocals.mjs (web/private-api/public-api routers only).
    setContentDisposition(
      type: 'attachment' | 'inline',
      opts: { filename: string }
    ): void
  }
}
