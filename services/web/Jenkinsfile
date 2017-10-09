pipeline {
  
  agent any
  
  environment  {
      HOME = "/tmp"
  }
  
  triggers {
    pollSCM('* * * * *')
    cron('@daily')
  }
  
  stages {
    stage('Set up') {
      agent {
        docker {
          image 'node:6.9.5'
          reuseNode true
        }
      }
      steps {
        // we need to disable logallrefupdates, else git clones during the npm install will require git to lookup the user id
        // which does not exist in the container's /etc/passwd file, causing the clone to fail.
        sh 'git config --global core.logallrefupdates false'
        
        sh 'rm -rf node_modules/*'
      }
    }
    
    stage('Clone Dependencies') {
      steps {
        sh 'rm -rf public/brand modules'
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'public/brand'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/brand-sharelatex']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'app/views/external'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/external-pages-sharelatex']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/web-sharelatex-modules']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/admin-panel'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/admin-panel']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/groovehq'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@bitbucket.org:sharelatex/groovehq']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/references-search'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@bitbucket.org:sharelatex/references-search.git']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/tpr-webmodule'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/tpr-webmodule.git ']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/learn-wiki'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@bitbucket.org:sharelatex/learn-wiki-web-module.git']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/templates'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/templates-webmodule.git']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/track-changes'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/track-changes-web-module.git']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/overleaf-integration'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/overleaf-integration-web-module.git']]])
        checkout([$class: 'GitSCM', branches: [[name: '*/master']], extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'modules/overleaf-account-merge'], [$class: 'CloneOption', shallow: true]], userRemoteConfigs: [[credentialsId: 'GIT_DEPLOY_KEY', url: 'git@github.com:sharelatex/overleaf-account-merge.git']]])
      }
    }
    
    stage('Install') {
      agent {
        docker {
          image 'node:6.9.5'
          args "-v /var/lib/jenkins/.npm:/tmp/.npm"
          reuseNode true
        }
      }
      steps {
        sh 'git config --global core.logallrefupdates false'
        sh 'mv app/views/external/robots.txt public/robots.txt'
        sh 'mv app/views/external/googlebdb0f8f7f4a17241.html public/googlebdb0f8f7f4a17241.html'
        sh 'npm install'
        sh 'npm rebuild'
        // It's too easy to end shrinkwrapping to a local, outdated version of translations.
        // Ensure translations are always latest, regardless of shrinkwrap
        sh 'npm install git+https://github.com/sharelatex/translations-sharelatex.git#master'
        sh 'npm install --quiet grunt'
        sh 'npm install --quiet grunt-cli'
        sh 'ls -l node_modules/.bin'
      }
    }

    stage('Compile') {
      agent {
        docker {
          image 'node:6.9.5'
          reuseNode true
        }
      }
      steps {
        sh 'node_modules/.bin/grunt compile  --verbose'
        // replace the build number placeholder for sentry
        sh 'node_modules/.bin/grunt version'
      }
    }

    stage('Smoke Test') {
      agent {
        docker {
          image 'node:6.9.5'
          reuseNode true
        }
      }
      steps {
        sh 'node_modules/.bin/grunt compile:smoke_tests'
      }
    }

    stage('Minify') {
      agent {
        docker {
          image 'node:6.9.5'
          reuseNode true
        }
      }
      steps {
        sh 'node_modules/.bin/grunt compile:minify'
      }
    }
    
    stage('Unit Test') {
      agent {
        docker {
          image 'node:6.9.5'
          reuseNode true
        }
      }
      steps {
        sh 'env NODE_ENV=development ./node_modules/.bin/grunt test:unit --reporter=tap'
      }
    }
    
    stage('Acceptance Tests') {
      steps {
        sh 'docker pull sharelatex/acceptance-test-runner'
        sh 'docker run --rm -v $(pwd):/app --env SHARELATEX_ALLOW_PUBLIC_ACCESS=true sharelatex/acceptance-test-runner'
      }
    }
    
    stage('Package') {
      steps {
        sh 'rm -rf ./node_modules/grunt*'
        sh 'echo ${BUILD_NUMBER} > build_number.txt'
        sh 'touch build.tar.gz' // Avoid tar warning about files changing during read
        sh 'tar -czf build.tar.gz --exclude=build.tar.gz --exclude-vcs .'
      }
    }
    
    stage('Publish') {
      steps {
        withAWS(credentials:'S3_CI_BUILDS_AWS_KEYS', region:"${S3_REGION_BUILD_ARTEFACTS}") {
            s3Upload(file:'build.tar.gz', bucket:"${S3_BUCKET_BUILD_ARTEFACTS}", path:"${JOB_NAME}/${BUILD_NUMBER}.tar.gz")
            // The deployment process uses this file to figure out the latest build
            s3Upload(file:'build_number.txt', bucket:"${S3_BUCKET_BUILD_ARTEFACTS}", path:"${JOB_NAME}/latest")
        }
      }
    }
    
    
    stage('Sync OSS') {
      when {
        branch 'master'
      }
      steps {
        sshagent (credentials: ['GIT_DEPLOY_KEY']) {
          sh 'git push git@github.com:sharelatex/web-sharelatex.git HEAD:master'
        }
      }
    }
  }
  
  post {
    failure {
      mail(from: "${EMAIL_ALERT_FROM}", 
           to: "${EMAIL_ALERT_TO}", 
           subject: "Jenkins build failed: ${JOB_NAME}:${BUILD_NUMBER}",
           body: "Build: ${BUILD_URL}")
    }
  }
  

  // The options directive is for configuration that applies to the whole job.
  options {
    // Only build one at a time
    disableConcurrentBuilds()
    
    // we'd like to make sure remove old builds, so we don't fill up our storage!
    buildDiscarder(logRotator(numToKeepStr:'50'))
    
    // And we'd really like to be sure that this build doesn't hang forever, so let's time it out after:
    timeout(time: 30, unit: 'MINUTES')
  }
}
