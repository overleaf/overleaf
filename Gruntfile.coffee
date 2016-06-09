services = require('./services')

module.exports = (grunt) ->
        
        tag = grunt.option("tag") or 'latest'
        to = grunt.option("to") or 'latest'
        repos = []
        for service in services
                url = service.repo.split('/')
                owner = url[3]
                repo = url[4].replace('.git','')
                repos.push "/repos/#{owner}/#{repo}/git/refs/heads/#{service.version}"
        
        grunt.initConfig
                docker_io:
                        default_options:
                                options:
                                        dockerFileLocation: '.'
                                        buildName: 'sharelatex'
                                        tag: grunt.option('tag') or 'latest'
                                        push: grunt.option('push') or false
                                        force: true

                github:
                        combinedRevisions:
                                options:
                                        #oAuth:
                                        #        access_token: ''
                                        concat: true
                                src: repos
                                dest: 'versions/' + tag + '.json'

                rename:
                        main:
                                files: [{ src: ['versions/latest.json'], dest: 'versions/' + to + '.json'}]

        grunt.loadNpmTasks 'grunt-docker-io'
        grunt.loadNpmTasks 'grunt-github-api'
        grunt.loadNpmTasks 'grunt-contrib-rename'

        grunt.registerTask 'build', ['docker_io', 'github']
        grunt.registerTask 'gitrev', ['github']
        grunt.registerTask 'cut', ['rename']

        grunt.registerTask 'default', ['build']
