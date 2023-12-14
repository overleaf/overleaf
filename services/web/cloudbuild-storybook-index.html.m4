divert(`-1')
define(`foreach', `pushdef(`$1')_foreach($@)popdef(`$1')')
define(`_arg1', `$1')
define(`_foreach', `ifelse(`$2', `()', `',
  `define(`$1', _arg1$2)$3`'$0(`$1', (shift$2), `$3')')')
divert`'dnl
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Overleaf Storybook builds</title>
      <style>
        body {
          background-color: #fff;
          color: #5d6879;
          font-family: Lato,sans-serif;
          font-size: 16px;
          line-height: 1.5625;
          min-height: 100%;
          position: relative;
          margin: 0px;
        }
        h1, h2, h3, h4, h5, h6 {
          color: rgb(80, 80, 80);
          font-family: Merriweather, serif;
          font-weight: 500;
          line-height: 1.35;
        }
        h1 {
          margin-top: 0px;
          padding-top: 100px;
        }
        .navbar-default {
          background-color: #1e2530;
          border-color: transparent;
          height: 68px;
          padding: 15px 10px;
          position: absolute;
          top: 0;
          width: 100%;
          box-sizing: border-box;
          display: block;
        }
        .navbar-default .navbar-brand {
          background-image: url(https://cdn.overleaf.com/images/overleaf-white-65b70e33f35fccdf6f8d.svg);
          background-position: 0;
          background-repeat: no-repeat;
          background-size: contain;
          bottom: 5px;
          padding: 0;
          position: absolute;
          top: 5px;
          width: 130px;
        }
      </style>
  </head>
  <body>
    <nav class="navbar-default">
      <a class="navbar-brand" href="https://www.overleaf.com/"></a>
    </nav>
    <h1>Overleaf Storybook builds</h1>
    <h2>Branches:</h2>
    <ul>
      foreach(DIR, (LIST),
      <li>
        <a href="DIR/">DIR/</a>
        <a href="https://github.com/overleaf/internal/tree/DIR">
          <img src="https://github.com/favicon.ico" alt="GitHub" width="15em">
        </a>
      </li>
      )
    </ul>
    <small>
      Last updated on syscmd(date)dnl
      for ifdef(`BRANCH_NAME',<a href="BRANCH_NAME/">BRANCH_NAME</a>,unknown branch)
      (<a href="https://console.cloud.google.com/cloud-build/builds?project=overleaf-dev&pageState=(%22builds%22:(%22f%22:%22%255B%257B_22k_22_3A_22Trigger%2520Name_22_2C_22t_22_3A10_2C_22v_22_3A_22_5C_22storybook-pr-trigger_5C_22_22_2C_22s_22_3Atrue_2C_22i_22_3A_22triggerName_22%257D_2C%257B_22k_22_3A_22_22_2C_22t_22_3A10_2C_22v_22_3A_22_5C_22OR_5C_22_22_2C_22o_22_3Atrue_2C_22s_22_3Atrue%257D_2C%257B_22k_22_3A_22Trigger%2520Name_22_2C_22t_22_3A10_2C_22v_22_3A_22_5C_22storybook-push-trigger_5C_22_22_2C_22s_22_3Atrue_2C_22i_22_3A_22triggerName_22%257D%255D%22))">build history</a>).
    </small>
  </body>
</html>
