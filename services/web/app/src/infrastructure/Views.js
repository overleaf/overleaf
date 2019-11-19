const logger = require('logger-sharelatex')
const pug = require('pug')

// List of view names found with
//
// git grep res.render | perl filter.pl  | sort -u
//
// where filter.pl is the perl script below.
//
// #!/usr/bin/perl
// while (<>) {print "'$1',\n" if /render\(\'(.*?)\'/;}

const viewList = [
  'admin/index',
  'admin/register',
  'beta_program/opt_in',
  'blog/blog_holder',
  'external/home/sl',
  'external/home/v2',
  'general/404',
  'general/500',
  'general/closed',
  'project/cannot-import-v1-project',
  'project/editor',
  'project/importing',
  'project/invite/not-valid',
  'project/invite/show',
  'project/list',
  'project/v2-import',
  'referal/bonus',
  'subscriptions/canceled_subscription',
  'subscriptions/dashboard',
  'subscriptions/new',
  'subscriptions/successful_subscription',
  'subscriptions/team/invite',
  'subscriptions/upgradeToAnnual',
  'sudo_mode/sudo_mode_prompt',
  'user/activate',
  'user/confirm_email',
  'user/login',
  'user/logout',
  'user_membership/index',
  'user_membership/new',
  'user/one_time_login',
  'user/passwordReset',
  'user/reconfirm',
  'user/register',
  'user/restricted',
  'user/sessions',
  'user/setPassword',
  'user/settings'
]
module.exports = {
  precompileViews(app) {
    let startTime = Date.now()
    let success = 0
    let failures = 0
    viewList.forEach(view => {
      try {
        let filename = app.get('views') + '/' + view + '.pug'
        pug.compileFile(filename, { cache: true })
        logger.log({ view }, 'compiled')
        success++
      } catch (err) {
        logger.error({ view, err }, 'error compiling')
        failures++
      }
    })
    logger.log(
      { timeTaken: Date.now() - startTime, failures, success },
      'compiled templates'
    )
  }
}
