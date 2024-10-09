import InstitutionsReconfirmationHandler from '../modules/institutions/app/src/InstitutionsReconfirmationHandler.mjs'

try {
  await InstitutionsReconfirmationHandler.processLapsed()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
