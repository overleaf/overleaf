const request = require('request')
const Settings = require('@overleaf/settings')

const buildUrl = path =>
  `http://${Settings.internal.clsi.host}:${Settings.internal.clsi.port}/${path}`

const url = buildUrl(`project/smoketest-${process.pid}/compile`)

module.exports = {
  sendNewResult(res) {
    this._run(error => this._sendResponse(res, error))
  },
  sendLastResult(res) {
    this._sendResponse(res, this._lastError)
  },
  triggerRun(cb) {
    this._run(error => {
      this._lastError = error
      cb(error)
    })
  },
  lastRunSuccessful() {
    return this._lastError == null
  },

  _lastError: new Error('SmokeTestsPending'),
  _sendResponse(res, error) {
    let code, body
    if (error) {
      code = 500
      body = error.message
    } else {
      code = 200
      body = 'OK'
    }
    res.contentType('text/plain')
    res.status(code).send(body)
  },
  _run(done) {
    request.post(
      {
        url,
        json: {
          compile: {
            options: {
              metricsPath: 'health-check',
            },
            resources: [
              {
                path: 'main.tex',
                content: `\
% Membrane-like surface
% Author: Yotam Avital
\\documentclass{article}
\\usepackage{tikz}
\\usetikzlibrary{calc,fadings,decorations.pathreplacing}
\\usepackage{ifplatform} % test shell escape, conditionals to test which platform is being used
\\usepackage{minted}  % to test shell commands
\\usepackage{bashful} % to test shell commands
\\begin{document}
\\begin{tikzpicture}
  \\def\\nuPi{3.1459265}
  \\foreach \\i in {5,4,...,2}{% This one doesn't matter
    \\foreach \\j in {3,2,...,0}{% This will crate a membrane
                               % with the front lipids visible
      % top layer
      \\pgfmathsetmacro{\\dx}{rand*0.1}% A random variance in the x coordinate
      \\pgfmathsetmacro{\\dy}{rand*0.1}% A random variance in the y coordinate,
                                     % gives a hight fill to the lipid
      \\pgfmathsetmacro{\\rot}{rand*0.1}% A random variance in the
                                      % molecule orientation
      \\shade[ball color=red] ({\\i+\\dx+\\rot},{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)}) circle(0.45);
      \\shade[ball color=gray] (\\i+\\dx,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-0.9}) circle(0.45);
      \\shade[ball color=gray] (\\i+\\dx-\\rot,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-1.8}) circle(0.45);
      % bottom layer
      \\pgfmathsetmacro{\\dx}{rand*0.1}
      \\pgfmathsetmacro{\\dy}{rand*0.1}
      \\pgfmathsetmacro{\\rot}{rand*0.1}
      \\shade[ball color=gray] (\\i+\\dx+\\rot,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-2.8}) circle(0.45);
      \\shade[ball color=gray] (\\i+\\dx,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-3.7}) circle(0.45);
      \\shade[ball color=red] (\\i+\\dx-\\rot,{0.5*\\j+\\dy+0.4*sin(\\i*\\nuPi*10)-4.6}) circle(0.45);
    }
  }
\\end{tikzpicture}

% Test minted (shell commands)
\\begin{minted}{python}
x = 1 + 2
\\end{minted}

% Test bashful (shell commands)
\\bash[stdout,stderr]
date
\\END

% Test system
\\immediate\\write18{/bin/date > date.txt}
\\input date.txt

% Test popen
\\input{"|date"}

\\end{document}\
`,
              },
            ],
          },
        },
      },
      (error, response, body) => {
        if (error) return done(error)
        if (!body || !body.compile || !body.compile.outputFiles) {
          return done(new Error('response payload incomplete'))
        }

        let pdfFound = false
        let logFound = false
        for (const file of body.compile.outputFiles) {
          if (file.type === 'pdf') pdfFound = true
          if (file.type === 'log') logFound = true
        }

        if (!pdfFound) return done(new Error('no pdf returned'))
        if (!logFound) return done(new Error('no log returned'))
        done()
      }
    )
  },
}
