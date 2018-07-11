String cron_string = BRANCH_NAME == "master" ? "@daily" : ""

pipeline {

  agent any

  environment  {
      HOME = "/tmp"
  }

  triggers {
    pollSCM('* * * * *')
    cron(cron_string)
  }

  stages {
    stage('Install modules') {
      steps {
        sshagent (credentials: ['GIT_DEPLOY_KEY']) {
          sh 'bin/install_modules'
        }
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
        sh 'rm -rf node_modules/'
        sh 'npm install --quiet'
        sh 'npm rebuild'
        // It's too easy to end up shrinkwrapping to an outdated version of translations.
        // Ensure translations are always latest, regardless of shrinkwrap
        sh 'npm install git+https://github.com/sharelatex/translations-sharelatex.git#master'
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
        sh 'make clean compile_full'
        // replace the build number placeholder for sentry
        sh 'node_modules/.bin/grunt version'
      }
    }

    stage('Lint') {
      agent {
        docker {
          image 'node:6.9.5'
          reuseNode true
        }
      }
      steps {
        sh 'make --no-print-directory lint'
      }
    }

    stage('Test and Minify') {
      parallel {
        stage('Unit Test') {
          agent {
            docker {
              image 'node:6.9.5'
              reuseNode true
            }
          }
          steps {
            sh 'make --no-print-directory test_unit MOCHA_ARGS="--reporter tap"'
          }
        }

        stage('Acceptance Test') {
          steps {
            // Spawns its own docker containers
            sh 'make --no-print-directory test_acceptance MOCHA_ARGS="--reporter tap"'
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
            sh 'WEBPACK_ENV=production make minify'
          }
        }
      }
    }

    stage('Frontend Unit Test') {
      steps {
        // Spawns its own docker containers
        sh 'make --no-print-directory test_frontend'
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
    always {
      sh 'make clean_ci'
    }

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
