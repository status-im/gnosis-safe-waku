pipeline {
  agent {
    label 'linux'
  }

  options {
    disableConcurrentBuilds()
    /* manage how many builds we keep */
    buildDiscarder(logRotator(
      numToKeepStr: '20',
      daysToKeepStr: '30',
    ))
  }

  environment {
    GIT_COMMITTER_NAME = 'status-im-auto'
    GIT_COMMITTER_EMAIL = 'auto@status.im'
    /* dev page settings */
    DEV_SITE = 'dev-gnosis-safe.wakuconnect.dev'
    DEV_HOST = 'jenkins@node-01.do-ams3.sites.misc.statusim.net'
    SCP_OPTS = 'StrictHostKeyChecking=no'
  }

  stages {
    stage('Deps') {
      steps {
        sh 'yarn install'
      }
    }

    stage('Build') {
      steps {
        /* If CI env var is set warnings are errors. */
        sh 'CI= yarn build'
      }
    }

    stage('Publish') {
      steps {
        sshagent(credentials: ['jenkins-ssh']) {
          sh """
            rsync -e 'ssh -o ${SCP_OPTS}' -r --delete packages/react-app/build/. \
              ${env.DEV_HOST}:/var/www/${env.DEV_SITE}/
          """
        }
      }
    }
  }
}
