import EmailBuilder from '../Email/EmailBuilder.mjs'
import EmailMessageHelper from '../Email/EmailMessageHelper.mjs'
import settings from '@overleaf/settings'

EmailBuilder.templates.trialOnboarding = EmailBuilder.NoCTAEmailTemplate({
  subject(opts) {
    return `Welcome to your Overleaf ${opts.planName} plan trial`
  },
  title(opts) {
    return `Welcome to your Overleaf ${opts.planName} plan trial`
  },
  greeting() {
    return 'Hello,'
  },
  message(opts, isPlainText) {
    const invitingNamedCollaborators = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/Sharing_a_project?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=invitelink#Inviting_named_collaborators`,
      isPlainText
    )
    const increasedCompileTimeout = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/What_is_the_maximum_compilation_time,_file_number_and_project_size_allowed_on_free_vs_paid_plans%3F?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=compilelink`,
      isPlainText
    )
    const realTimeTrackChanges = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/Track_Changes_in_Overleaf?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=trackchangeslink`,
      isPlainText
    )
    const history = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/latex/Using_the_History_feature?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=historylink`,
      isPlainText
    )
    const versioning = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/Can_I_save_versions_of_my_work%3F?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=versioninglink`,
      isPlainText
    )
    const advancedReferenceSearch = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/How_to_search_for_references_in_an_Overleaf_project?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=adrefsearchlink`,
      isPlainText
    )
    const referenceManagerSync = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/How_to_link_your_Overleaf_account_to_Mendeley_and_Zotero?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=refmansynclink`,
      isPlainText
    )
    const dropboxSync = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/Dropbox_Synchronization?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=dropboxlink`,
      isPlainText
    )
    const gitSync = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/Using_Git_and_GitHub?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=gitgithublink`,
      isPlainText
    )
    const symbolPalette = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/how-to/Using_the_Symbol_Palette_in_Overleaf#:~:text=To%20open%20the%20Symbol%20Palette,the%20handle%20up%20and%20down.`,
      isPlainText
    )
    const latexTutorials = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/latex/Learn_LaTeX_in_30_minutes?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=latextutorialslink`,
      isPlainText
    )
    const knowledgeBase = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=learnlink`,
      isPlainText
    )
    const technicalArticles = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/learn/latex/Articles?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=articleslink`,
      isPlainText
    )
    const webinars = EmailMessageHelper.displayLink(
      'Read More',
      `${settings.siteUrl}/events/webinars?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=webinarslink`,
      isPlainText
    )

    const cancel = EmailMessageHelper.displayLink(
      'cancel at any time',
      `${settings.siteUrl}/learn/how-to/Canceling_Subscription?utm_source=Overleaf&utm_medium=email&utm_campaign=TrialEmail&utm_content=cancellink`,
      isPlainText
    )

    const feedback = EmailMessageHelper.displayLink(
      'hear your feedback',
      `https://docs.google.com/forms/d/e/1FAIpQLSfMbbh_z-9-dZ3YnrDCyNpNxFPGA492ZSallKOt8WWp2nx7kg/viewform?usp=sf_link/viewform`,
      isPlainText
    )

    const unsubscribe = EmailMessageHelper.displayLink(
      'here',
      `${settings.siteUrl}/user/email-preferences`,
      isPlainText
    )

    const canInviteMoreNamedCollaborators =
      opts.features.collaborators === -1 ||
      opts.features.collaborators > settings.defaultFeatures.collaborators

    let n = 1
    return [
      `Welcome to your Overleaf Premium Features Trial!  We really appreciate your support of Overleaf and are excited for you to use our premium features and get the most out of your trial.`,
      `<b>During your trial period, be sure to check out these premium features: </b>`,

      ...(canInviteMoreNamedCollaborators
        ? [
            `${n++}. <b>Invite more collaborators</b>: You can now invite named collaborators to your project via the ‘share’ menu in your project (with read-only or edit access). Simply add their email address and an email invitation will be sent to them. You can remove these named collaborators at any time via the same ‘share’ menu.`,
            `<ul><li> Inviting Named Collaborators: ${invitingNamedCollaborators}</li></ul>`,
          ]
        : []),

      `${n++}. <b>Increased compile timeout</b>: You now have more time for compilation (to generate a PDF of your document) before receiving a timeout error message.`,
      `<ul><li> Compile Timeout: ${increasedCompileTimeout}</li></ul>`,

      ...(opts.features.trackChanges
        ? [
            `${n++}. <b>Real-time track changes</b>: The track changes mode lets you see exactly what has been changed by your collaborators, and allows you to accept or reject each individual change. `,
            `<ul><li> Track Changes: ${realTimeTrackChanges}</li></ul>`,
          ]
        : []),

      `${n++}. <b>Full document history and versioning</b>: View the entire history of your project with the ability to revert to previous versions of your document from your project history (versus only 24 hours of history availability on a  free Overleaf account). No more fear of losing work or making changes you can’t undo. `,
      `<ul><li> History: ${history}</li>
      <li>Versioning: ${versioning}</li></ul>`,

      `${n++}. <b>Advanced reference search</b>: You can search by citation key, and our premium feature allows the added ability to search by author, title, year, or journal.`,
      `<ul><li>Advanced Reference Search: ${advancedReferenceSearch}</li></ul>`,

      `${n++}. <b>Reference manager sync </b>: You can link your Mendeley and Zotero accounts to your Overleaf account, allowing you to import your reference library and keep your Overleaf document in sync with the references stored in Mendeley / Zotero.`,
      `<ul><li> Reference Manager Sync: ${referenceManagerSync}</li></ul>`,

      `${n++}. <b>Dropbox Sync</b>: You can link your Dropbox account to your Overleaf account, allowing 2-way integration with Dropbox `,
      `<ul><li> Dropbox Sync: ${dropboxSync}</li></ul>`,

      `${n++}. <b>Git and GitHub integration</b>: You can configure your Overleaf project to sync directly with a repository on GitHub, or you can use raw git access. This allows you to work offline and sync your files whenever you come back online. You can also use our Overleaf Git Bridge integration, which lets you git clone, push and pull changes between the online Overleaf editor, and your local offline git repository.`,
      `<ul><li> Git, GitHub and Git Bridge: ${gitSync}</li></ul>`,

      `${n++}. <b>Symbol Palette</b>: A quick and convenient tool to insert math symbols into your document.`,
      `<ul><li> Symbol Palette: ${symbolPalette}</li></ul>`,

      `${n++}. <b>Online tutorials and knowledge base</b>: We have an extensive online knowledge base providing a wide range of platform guidance, LaTeX tutorials, technical articles, and webinars.`,
      `<ul><li>LaTeX tutorials: ${latexTutorials}</li>
      <li>Knowledge base: ${knowledgeBase}</li>
      <li>Technical articles: ${technicalArticles}</li>
      <li>Webinars: ${webinars}</li></ul>`,

      `Your trial will last for seven days from when you started it, and you can ${cancel} via your subscription page on your dashboard. If you’d like to continue your subscription after your trial, you’re all set!`,

      `Please let us know if we can provide any additional support or answer any questions - and we’d love to ${feedback}!`,
      `Thanks again for supporting Overleaf - Happy TeXing!`,
      `The Overleaf Team <hr>`,

      `You're receiving this email because you've recently signed up for an Overleaf premium trial. If you've previously subscribed to emails about product offers and company news and events, you can unsubscribe ${unsubscribe}.`,
    ]
  },
})
