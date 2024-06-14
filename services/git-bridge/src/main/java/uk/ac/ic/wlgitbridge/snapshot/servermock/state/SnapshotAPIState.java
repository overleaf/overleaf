package uk.ac.ic.wlgitbridge.snapshot.servermock.state;

import java.util.*;
import uk.ac.ic.wlgitbridge.snapshot.getdoc.GetDocResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.GetForVersionResult;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotAttachment;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotData;
import uk.ac.ic.wlgitbridge.snapshot.getforversion.SnapshotFile;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.GetSavedVersResult;
import uk.ac.ic.wlgitbridge.snapshot.getsavedvers.SnapshotInfo;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.data.SnapshotPushResult;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.data.SnapshotPushResultSuccess;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback.SnapshotPostbackRequest;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.push.postback.SnapshotPostbackRequestInvalidProject;

/*
 * Created by Winston on 09/01/15.
 */
public class SnapshotAPIState {

  private Map<String, GetDocResult> getDoc;
  private Map<String, GetSavedVersResult> getSavedVers;
  private Map<String, Map<Integer, GetForVersionResult>> getForVers;
  private Map<String, SnapshotPushResult> push;
  private Map<String, SnapshotPostbackRequest> postback;

  public SnapshotAPIState(
      Map<String, GetDocResult> getDoc,
      Map<String, GetSavedVersResult> getSavedVers,
      Map<String, Map<Integer, GetForVersionResult>> getForVers,
      Map<String, SnapshotPushResult> push,
      Map<String, SnapshotPostbackRequest> postback) {
    this.getDoc = getDoc;
    this.getSavedVers = getSavedVers;
    this.getForVers = getForVers;
    this.push = push;
    this.postback = postback;
  }

  public SnapshotAPIState() {
    getDoc = new HashMap<>();
    getDoc.put(
        "1826rqgsdb",
        new GetDocResult(null, 243, "2014-11-30T18:40:58Z", "jdleesmiller+1@gmail.com", "John+1"));

    getSavedVers = new HashMap<String, GetSavedVersResult>();
    List<SnapshotInfo> savedVers = new LinkedList<SnapshotInfo>();
    savedVers.add(
        new SnapshotInfo(
            243,
            "added more info on doc GET and error details",
            "jdleesmiller+1@gmail.com",
            "John+1",
            "2014-11-30T18:47:01Z"));
    savedVers.add(
        new SnapshotInfo(
            185,
            "with more details on POST request",
            "jdleesmiller+1@gmail.com",
            "John+1",
            "2014-11-11T17:18:40Z"));
    savedVers.add(
        new SnapshotInfo(
            175,
            "with updated PUT/POST request",
            "jdleesmiller+1@gmail.com",
            "John+1",
            "2014-11-09T23:09:13Z"));
    savedVers.add(
        new SnapshotInfo(
            146,
            "added PUT format",
            "jdleesmiller@gmail.com",
            "John Lees-Miller",
            "2014-11-07T15:11:35Z"));
    savedVers.add(
        new SnapshotInfo(
            74,
            "with example output",
            "jdleesmiller@gmail.com",
            "John Lees-Miller",
            "2014-11-05T18:09:41Z"));
    savedVers.add(
        new SnapshotInfo(
            39,
            "with more files",
            "jdleesmiller@gmail.com",
            "John Lees-Miller",
            "2014-11-05T18:02:19Z"));
    savedVers.add(
        new SnapshotInfo(
            24,
            "first draft",
            "jdleesmiller@gmail.com",
            "John Lees-Miller",
            "2014-11-05T17:56:58Z"));
    getSavedVers.put("1826rqgsdb", new GetSavedVersResult(savedVers));

    getForVers =
        new HashMap<String, Map<Integer, GetForVersionResult>>() {
          {
            put(
                "1826rqgsdb",
                new HashMap<Integer, GetForVersionResult>() {
                  {
                    put(
                        243,
                        new GetForVersionResult(
                            new SnapshotData(
                                Arrays.asList(
                                    new SnapshotFile(
                                        "\\\\documentclass[a4paper]{article}\\n\\n\\\\usepackage[english]{babel}\\n\\\\usepackage[utf8]{inputenc}\\n\\\\usepackage{graphicx}\\n\\\\usepackage{fullpage}\\n\\\\usepackage{listings}\\n\\\\usepackage{courier}\\n\\\\usepackage{url}\\n\\n\\\\lstset{basicstyle=\\\\ttfamily,breaklines=true}\\n\\n\\\\begin{document}\\n\\\\title{API for the writeLaTeX-Git Bridge}\\n\\\\author{JLM}\\n\\\\date{\\\\today}\\n\\\\maketitle\\n\\n\\\\section{Fetching a Project from WriteLaTeX}\\n\\nThere are three API calls that will likely be of interest. You can run them against this server, \\\\url{radiant-wind-3058.herokuapp.com}, but they're not on the production server yet.\\n\\n\\\\subsection{Get Doc}\\n\\nA ``doc'' is our internal term for a ``project''. This endpoint returns the latest version id, when the latest version was created (ISO8601), and the user that last edited the project (if any, otherwise null).\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb\\n# => {\\n  \\\"latestVerId\\\": 39,\\n  \\\"latestVerAt\\\": \\\"2014-11-30T18:35:27Z\\\",\\n  \\\"latestVerBy\\\": {\\n    \\\"email\\\": \\\"jdleesmiller@gmail.com\\\",\\n    \\\"name\\\": \\\"John Lees-Miller\\\"\\n  }}\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Saved Vers}\\n\\nA ``saved ver'' is a version of a doc, saved by via the versions menu. Note that this query is not currently paginated.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/saved_vers\\n# => [\\n  {\\\"versionId\\\":39,\\n   \\\"comment\\\":\\\"with more files\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T18:02:19Z\\\"},\\n  {\\\"versionId\\\":24,\\n   \\\"comment\\\":\\\"first draft\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T17:56:58Z\\\"}]\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Snapshot for Version}\\n\\nA snapshot contains the content of a project in the given version. You can safely request a snapshot of any version that is, or was at any point in the last 24 hours, (1) a saved version, or (2) the current version. (Older versions may or may not have been moved to cold storage.)\\n\\nThe srcs array contains (content, file name) pairs; the atts array contains (URL, file name) pairs.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/snapshots/39\\n# => {\\n  \\\"srcs\\\":[\\n    [\\\"This text is from another file.\\\",\\\"foo/bar/servermock.tex\\\"],\\n    [\\\"\\\\\\\\documentclass[a4paper]{article}\\\\n...\\\",\\\"main.tex\\\"]],\\n  \\\"atts\\\":[\\n    [\\\"https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png\\\",\\\"min_mean_wait_evm_7_eps_150dpi.png\\\"]]}\\n\\\\end{lstlisting}\\n\\n\\\\section{Pushing a Project to WriteLaTeX}\\n\\n\\\\subsection{Push a Project}\\n\\n\\\\begin{lstlisting}\\n# NB: JLM originally said PUT, but he now thinks POST is better\\n# NB: you must set a Content-Type: application/json header for this request\\n# in order to specify the data as JSON in the request body\\nPOST https://.../api/v0/docs/1826rqgsdb/snapshots\\nData:\\n{\\n  latestVerId: integer,\\n  files: [\\n    {\\n      name: string path (forward slashes, relative to root)\\n      url: string (but only if the file is modified; else no url given)\\n    }, ...\\n  ]\\n  postbackUrl: url to post result back to\\n}\\nResponse on success:\\n{\\n  status: 202,\\n  code: \\\"accepted\\\",\\n  message: \\\"Accepted\\\"\\n}\\nResponse on out of date:\\n{\\n  status: 409, # Conflict\\n  code: \\\"outOfDate\\\",\\n  message: \\\"Out of Date\\\"\\n}\\n\\nPostback Data (METHOD POST):\\nOn success:\\n{\\n  code: \\\"upToDate\\\",\\n  latestVerId: integer\\n}\\nOn out of date:\\n{\\n  code: \\\"outOfDate\\\",\\n  message: \\\"Out of Date\\\"\\n}\\nOn error with the files list (e.g. file extension not allowed):\\n{\\n  code: \\\"invalidFiles\\\",\\n  errors: [ {\\n    file: the file name from the snapshot,\\n    state: \\\"error\\\"|\\\"disallowed\\\"|\\\"unclean_name\\\"\\n  }, ... ]\\n}\\nIf the file's error state is unclean_name, the error object will alsocontain a property cleanFile that contains the name of the file after it has been \\\"cleaned\\\" to meet our file naming requirements; for other file error states, this property is not present.\\nOn error with the project as a whole (e.g. over quota):\\n{\\n  code: \\\"invalidProject\\\",\\n  message: short string message for debugging\\n  errors: [ array of zero or more string messages for the user ]\\n}\\nOn unexpected error (bug):\\n{\\n  code: \\\"error\\\",\\n  message: \\\"Unexpected Error\\\"\\n}\\n\\\\end{lstlisting}\\n\\n\\\\section{Test Data}\\n\\nYou can use this project as one of your servermock projects. I've added an attachment and a file in a subfolder to make it a bit more interesting.\\n\\n\\\\input{foo/bar/servermock}\\n\\n\\\\includegraphics[width=\\\\linewidth]{min_mean_wait_evm_7_eps_150dpi}\\n\\n\\\\end{document}",
                                        "main.tex"),
                                    new SnapshotFile(
                                        "This text is from another file.",
                                        "foo/bar/servermock.tex")),
                                Arrays.asList(
                                    new SnapshotAttachment(
                                        "https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png",
                                        "min_mean_wait_evm_7_eps_150dpi.png")))));
                    put(
                        185,
                        new GetForVersionResult(
                            new SnapshotData(
                                Arrays.asList(
                                    new SnapshotFile(
                                        "\\\\documentclass[a4paper]{article}\\n\\n\\\\usepackage[english]{babel}\\n\\\\usepackage[utf8]{inputenc}\\n\\\\usepackage{graphicx}\\n\\\\usepackage{fullpage}\\n\\\\usepackage{listings}\\n\\\\usepackage{courier}\\n\\\\usepackage{url}\\n\\n\\\\lstset{basicstyle=\\\\ttfamily,breaklines=true}\\n\\n\\\\begin{document}\\n\\\\title{API for the writeLaTeX-Git Bridge}\\n\\\\author{JLM}\\n\\\\date{\\\\today}\\n\\\\maketitle\\n\\n\\\\section{Fetching a Project from WriteLaTeX}\\n\\nThere are three API calls that will likely be of interest. You can run them against this server, \\\\url{radiant-wind-3058.herokuapp.com}, but they're not on the production server yet.\\n\\n\\\\subsection{Get Doc}\\n\\nA ``doc'' is our internal term for a ``project''. At present, this just returns the latest version number.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb\\n# => { latestVerId: 39 }\\nTODO will also include updatedAt time and user (if it was not anonymous)\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Saved Vers}\\n\\nA ``saved ver'' is a version of a doc, saved by via the versions menu. Note that this query is not currently paginated.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/saved_vers\\n# => [\\n  {\\\"versionId\\\":39,\\n   \\\"comment\\\":\\\"with more files\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T18:02:19Z\\\"},\\n  {\\\"versionId\\\":24,\\n   \\\"comment\\\":\\\"first draft\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T17:56:58Z\\\"}]\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Snapshot for Version}\\n\\nA snapshot contains the content of a project in the given version. You can safely request a snapshot of any version that is, or was at any point in the last 24 hours, (1) a saved version, or (2) the current version. (Older versions may or may not have been moved to cold storage.)\\n\\nThe srcs array contains (content, file name) pairs; the atts array contains (URL, file name) pairs.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/snapshots/39\\n# => {\\n  \\\"srcs\\\":[\\n    [\\\"This text is from another file.\\\",\\\"foo/bar/servermock.tex\\\"],\\n    [\\\"\\\\\\\\documentclass[a4paper]{article}\\\\n...\\\",\\\"main.tex\\\"]],\\n  \\\"atts\\\":[\\n    [\\\"https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png\\\",\\\"min_mean_wait_evm_7_eps_150dpi.png\\\"]]}\\n\\\\end{lstlisting}\\n\\n\\\\section{Pushing a Project to WriteLaTeX}\\n\\n\\\\subsection{Push a Project}\\n\\n\\\\begin{lstlisting}\\n# NB: JLM originally said PUT, but he now thinks POST is better\\n# NB: you must set a Content-Type: application/json header for this request\\n# in order to specify the data as JSON in the request body\\nPOST https://.../api/v0/docs/1826rqgsdb/snapshots\\nData:\\n{\\n  latestVerId: integer,\\n  files: [\\n    {\\n      name: string path (forward slashes, relative to root)\\n      url: string (but only if the file is modified; else no url given)\\n    }, ...\\n  ]\\n  postbackUrl: url to post result back to\\n}\\nResponse on success:\\n{\\n  status: 202,\\n  code: \\\"accepted\\\",\\n  message: \\\"Accepted\\\"\\n}\\nResponse on out of date:\\n{\\n  status: 409, # Conflict\\n  code: \\\"outOfDate\\\",\\n  message: \\\"Out of Date\\\"\\n}\\n\\nPostback Data (METHOD POST):\\nOn success:\\n{\\n  code: \\\"upToDate\\\",\\n  latestVerId: integer\\n}\\nOn out of date:\\n{\\n  code: \\\"outOfDate\\\",\\n  message: \\\"Out of Date\\\"\\n}\\nOn error with the files list (e.g. file extension not allowed):\\n{\\n  code: \\\"invalidFiles\\\",\\n  errors: TODO\\n}\\nOn error with the project as a whole (e.g. over quota):\\n{\\n  code: \\\"invalidProject\\\",\\n  errors: TODO\\n}\\nOn unexpected error (bug):\\n{\\n  code: \\\"error\\\",\\n  message: \\\"Unexpected Error\\\"\\n}\\n\\\\end{lstlisting}\\n\\n\\\\section{Test Data}\\n\\nYou can use this project as one of your servermock projects. I've added an attachment and a file in a subfolder to make it a bit more interesting.\\n\\n\\\\input{foo/bar/servermock}\\n\\n\\\\includegraphics[width=\\\\linewidth]{min_mean_wait_evm_7_eps_150dpi}\\n\\n\\\\end{document}",
                                        "main.tex"),
                                    new SnapshotFile(
                                        "This text is from another file.",
                                        "foo/bar/servermock.tex")),
                                Arrays.asList(
                                    new SnapshotAttachment(
                                        "https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png",
                                        "min_mean_wait_evm_7_eps_150dpi.png")))));
                    put(
                        175,
                        new GetForVersionResult(
                            new SnapshotData(
                                Arrays.asList(
                                    new SnapshotFile(
                                        "\\\\documentclass[a4paper]{article}\\n\\n\\\\usepackage[english]{babel}\\n\\\\usepackage[utf8]{inputenc}\\n\\\\usepackage{graphicx}\\n\\\\usepackage{fullpage}\\n\\\\usepackage{listings}\\n\\\\usepackage{courier}\\n\\\\usepackage{url}\\n\\n\\\\lstset{basicstyle=\\\\ttfamily,breaklines=true}\\n\\n\\\\begin{document}\\n\\\\title{API for the writeLaTeX-Git Bridge}\\n\\\\author{JLM}\\n\\\\date{\\\\today}\\n\\\\maketitle\\n\\n\\\\section{Fetching a Project from WriteLaTeX}\\n\\nThere are three API calls that will likely be of interest. You can run them against this server, \\\\url{radiant-wind-3058.herokuapp.com}, but they're not on the production server yet.\\n\\n\\\\subsection{Get Doc}\\n\\nA ``doc'' is our internal term for a ``project''. At present, this just returns the latest version number.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb\\n# => { latestVerId: 39 }\\nTODO will also include updatedAt time and user (if it was not anonymous)\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Saved Vers}\\n\\nA ``saved ver'' is a version of a doc, saved by via the versions menu. Note that this query is not currently paginated.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/saved_vers\\n# => [\\n  {\\\"versionId\\\":39,\\n   \\\"comment\\\":\\\"with more files\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T18:02:19Z\\\"},\\n  {\\\"versionId\\\":24,\\n   \\\"comment\\\":\\\"first draft\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T17:56:58Z\\\"}]\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Snapshot for Version}\\n\\nA snapshot contains the content of a project in the given version. You can safely request a snapshot of any version that is, or was at any point in the last 24 hours, (1) a saved version, or (2) the current version. (Older versions may or may not have been moved to cold storage.)\\n\\nThe srcs array contains (content, file name) pairs; the atts array contains (URL, file name) pairs.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/snapshots/39\\n# => {\\n  \\\"srcs\\\":[\\n    [\\\"This text is from another file.\\\",\\\"foo/bar/servermock.tex\\\"],\\n    [\\\"\\\\\\\\documentclass[a4paper]{article}\\\\n...\\\",\\\"main.tex\\\"]],\\n  \\\"atts\\\":[\\n    [\\\"https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png\\\",\\\"min_mean_wait_evm_7_eps_150dpi.png\\\"]]}\\n\\\\end{lstlisting}\\n\\n\\\\section{Pushing a Project to WriteLaTeX}\\n\\n\\\\subsection{Push a Project}\\n\\n\\\\begin{lstlisting}\\n# NB: JLM originally said PUT, but he now thinks POST is better\\n# NB: you must set a Content-Type: application/json header for this request\\n# in order to specify the data as JSON in the request body\\nPOST https://.../api/v0/docs/1826rqgsdb/snapshots\\nData:\\n{\\n  latestVerId: integer,\\n  files: [\\n    {\\n      name: string path (forward slashes, relative to root)\\n      url: string (but only if the file is modified; else no url given)\\n    }, ...\\n  ]\\n  postbackUrl: url to post result back to\\n}\\nResponse on success:\\n{\\n  status: 202,\\n  code: \\\"accepted\\\",\\n  message: \\\"Accepted\\\"\\n}\\nResponse on out of date:\\n{\\n  status: 409, # Conflict\\n  code: \\\"outOfDate\\\",\\n  message: \\\"Out of Date\\\"\\n}\\n\\nPostback Data (METHOD POST):\\nOn success:\\n{\\n  code: \\\"upToDate\\\",\\n  latestVerId: integer\\n}\\nOn out of date:\\n{\\n  code: \\\"outOfDate\\\",\\n  message: \\\"Out of Date\\\"\\n}\\nOn error:\\n{\\n  code: \\\"invalidFile\\\",\\n  TODO\\n}\\n\\\\end{lstlisting}\\n\\n\\\\section{Test Data}\\n\\nYou can use this project as one of your servermock projects. I've added an attachment and a file in a subfolder to make it a bit more interesting.\\n\\n\\\\input{foo/bar/servermock}\\n\\n\\\\includegraphics[width=\\\\linewidth]{min_mean_wait_evm_7_eps_150dpi}\\n\\n\\\\end{document}",
                                        "main.tex"),
                                    new SnapshotFile(
                                        "This text is from another file.",
                                        "foo/bar/servermock.tex")),
                                Arrays.asList(
                                    new SnapshotAttachment(
                                        "https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png",
                                        "min_mean_wait_evm_7_eps_150dpi.png")))));
                    put(
                        146,
                        new GetForVersionResult(
                            new SnapshotData(
                                Arrays.asList(
                                    new SnapshotFile(
                                        "\\\\documentclass[a4paper]{article}\\n\\n\\\\usepackage[english]{babel}\\n\\\\usepackage[utf8]{inputenc}\\n\\\\usepackage{graphicx}\\n\\\\usepackage{fullpage}\\n\\\\usepackage{listings}\\n\\\\usepackage{courier}\\n\\\\usepackage{url}\\n\\n\\\\lstset{basicstyle=\\\\ttfamily,breaklines=true}\\n\\n\\\\begin{document}\\n\\\\title{API for the writeLaTeX-Git Bridge}\\n\\\\author{JLM}\\n\\\\date{\\\\today}\\n\\\\maketitle\\n\\n\\\\section{Fetching a Project from WriteLaTeX}\\n\\nThere are three API calls that will likely be of interest. You can run them against this server, \\\\url{radiant-wind-3058.herokuapp.com}, but they're not on the production server yet.\\n\\n\\\\subsection{Get Doc}\\n\\nA ``doc'' is our internal term for a ``project''. At present, this just returns the latest version number.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb\\n# => { latestVerId: 39 }\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Saved Vers}\\n\\nA ``saved ver'' is a version of a doc, saved by via the versions menu. Note that this query is not currently paginated.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/saved_vers\\n# => [\\n  {\\\"versionId\\\":39,\\n   \\\"comment\\\":\\\"with more files\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T18:02:19Z\\\"},\\n  {\\\"versionId\\\":24,\\n   \\\"comment\\\":\\\"first draft\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T17:56:58Z\\\"}]\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Snapshot for Version}\\n\\nA snapshot contains the content of a project in the given version. You can safely request a snapshot of any version that is, or was at any point in the last 24 hours, (1) a saved version, or (2) the current version. (Older versions may or may not have been moved to cold storage.)\\n\\nThe srcs array contains (content, file name) pairs; the atts array contains (URL, file name) pairs.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/snapshots/39\\n# => {\\n  \\\"srcs\\\":[\\n    [\\\"This text is from another file.\\\",\\\"foo/bar/servermock.tex\\\"],\\n    [\\\"\\\\\\\\documentclass[a4paper]{article}\\\\n...\\\",\\\"main.tex\\\"]],\\n  \\\"atts\\\":[\\n    [\\\"https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png\\\",\\\"min_mean_wait_evm_7_eps_150dpi.png\\\"]]}\\n\\\\end{lstlisting}\\n\\n\\\\section{Pushing a Project to WriteLaTeX}\\n\\n\\\\subsection{Push a Project}\\n\\n\\\\begin{lstlisting}\\nPUT https://.../api/v0/docs/1826rqgsdb/snapshots\\nData:\\n{\\n  latestVerId: integer,\\n  files: [\\n    {\\n      name: string path (forward slashes, relative to root)\\n      url: string (but only if the file is modified; else no url given)\\n    }, ...\\n  ]\\n  postbackUrl: url to post result back to\\n}\\nResponse on success:\\n{\\n  status: 20x,\\n}\\nResponse on out of date:\\n{\\n  status: 40x,\\n  code: \\\"outOfDate\\\",\\n  message: \\\"Out of Date\\\"\\n}\\n\\nPostback Data (METHOD POST):\\nOn success:\\n{\\n  code: \\\"upToDate\\\",\\n  latestVerId: integer\\n}\\nOn out of date:\\n{\\n  code: \\\"outOfDate\\\",\\n  message: \\\"Out of Date\\\"\\n}\\nOn error:\\n{\\n  code: \\\"invalidFile\\\",\\n  TODO\\n}\\n\\\\end{lstlisting}\\n\\n\\\\section{Test Data}\\n\\nYou can use this project as one of your servermock projects. I've added an attachment and a file in a subfolder to make it a bit more interesting.\\n\\n\\\\input{foo/bar/servermock}\\n\\n\\\\includegraphics[width=\\\\linewidth]{min_mean_wait_evm_7_eps_150dpi}\\n\\n\\\\end{document}",
                                        "main.tex"),
                                    new SnapshotFile(
                                        "This text is from another file.",
                                        "foo/bar/servermock.tex")),
                                Arrays.asList(
                                    new SnapshotAttachment(
                                        "https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png",
                                        "min_mean_wait_evm_7_eps_150dpi.png")))));
                    put(
                        74,
                        new GetForVersionResult(
                            new SnapshotData(
                                Arrays.asList(
                                    new SnapshotFile(
                                        "\\\\documentclass[a4paper]{article}\\n\\n\\\\usepackage[english]{babel}\\n\\\\usepackage[utf8]{inputenc}\\n\\\\usepackage{graphicx}\\n\\\\usepackage{fullpage}\\n\\\\usepackage{listings}\\n\\\\usepackage{courier}\\n\\\\usepackage{url}\\n\\n\\\\lstset{basicstyle=\\\\ttfamily,breaklines=true}\\n\\n\\\\begin{document}\\n\\\\title{API for the writeLaTeX-Git Bridge}\\n\\\\author{JLM}\\n\\\\date{\\\\today}\\n\\\\maketitle\\n\\n\\\\section{Fetching a Project from WriteLaTeX}\\n\\nThere are three API calls that will likely be of interest. You can run them against this server, \\\\url{radiant-wind-3058.herokuapp.com}, but they're not on the production server yet.\\n\\n\\\\subsection{Get Doc}\\n\\nA ``doc'' is our internal term for a ``project''. At present, this just returns the latest version number.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb\\n# => { latestVerId: 39 }\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Saved Vers}\\n\\nA ``saved ver'' is a version of a doc, saved by via the versions menu. Note that this query is not currently paginated.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/saved_vers\\n# => [\\n  {\\\"versionId\\\":39,\\n   \\\"comment\\\":\\\"with more files\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T18:02:19Z\\\"},\\n  {\\\"versionId\\\":24,\\n   \\\"comment\\\":\\\"first draft\\\",\\n   \\\"user\\\":{\\n     \\\"email\\\":\\\"jdleesmiller@gmail.com\\\",\\n     \\\"name\\\":\\\"John Lees-Miller\\\"},\\n   \\\"createdAt\\\":\\\"2014-11-05T17:56:58Z\\\"}]\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Snapshot for Version}\\n\\nA snapshot contains the content of a project in the given version. You can safely request a snapshot of any version that is, or was at any point in the last 24 hours, (1) a saved version, or (2) the current version. (Older versions may or may not have been moved to cold storage.)\\n\\nThe srcs array contains (content, file name) pairs; the atts array contains (URL, file name) pairs.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/snapshots/39\\n# => {\\n  \\\"srcs\\\":[\\n    [\\\"This text is from another file.\\\",\\\"foo/bar/servermock.tex\\\"],\\n    [\\\"\\\\\\\\documentclass[a4paper]{article}\\\\n...\\\",\\\"main.tex\\\"]],\\n  \\\"atts\\\":[\\n    [\\\"https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png\\\",\\\"min_mean_wait_evm_7_eps_150dpi.png\\\"]]}\\n\\\\end{lstlisting}\\n\\n\\\\section{Pushing a Project to WriteLaTeX}\\n\\nTODO still working on this part\\n\\n\\\\section{Test Data}\\n\\nYou can use this project as a servermock project. I've added an attachment and a file in a subfolder to make it a bit more interesting.\\n\\n\\\\input{foo/bar/servermock}\\n\\n\\\\includegraphics[width=\\\\linewidth]{min_mean_wait_evm_7_eps_150dpi}\\n\\n\\\\end{document}",
                                        "main.tex"),
                                    new SnapshotFile(
                                        "This text is from another file.",
                                        "foo/bar/servermock.tex")),
                                Arrays.asList(
                                    new SnapshotAttachment(
                                        "https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png",
                                        "min_mean_wait_evm_7_eps_150dpi.png")))));
                    put(
                        39,
                        new GetForVersionResult(
                            new SnapshotData(
                                Arrays.asList(
                                    new SnapshotFile(
                                        "\\\\documentclass[a4paper]{article}\\n\\n\\\\usepackage[english]{babel}\\n\\\\usepackage[utf8]{inputenc}\\n\\\\usepackage{graphicx}\\n\\\\usepackage{fullpage}\\n\\\\usepackage{listings}\\n\\\\usepackage{courier}\\n\\\\usepackage{url}\\n\\n\\\\lstset{basicstyle=\\\\ttfamily,breaklines=true}\\n\\n\\\\begin{document}\\n\\\\title{API for the writeLaTeX-Git Bridge}\\n\\\\author{JLM}\\n\\\\date{\\\\today}\\n\\\\maketitle\\n\\n\\\\section{Fetching a Project from WriteLaTeX}\\n\\nThere are three API calls that will likely be of interest. You can run them against this server, \\\\url{radiant-wind-3058.herokuapp.com}, but they're not on the production server yet.\\n\\n\\\\subsection{Get Doc}\\n\\nA ``doc'' is our internal term for a ``project''. At present, this just returns the latest version number.\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Saved Vers}\\n\\nA ``saved ver'' is a version of a doc, saved by via the versions menu. To list saved versions for a doc:\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/saved_vers\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Snapshot for Version}\\n\\nA snapshot contains the content of a project in the given version. You can safely request a snapshot of any version that is, or was at any point in the last 24 hours, (1) a saved version, or (2) the current version. (Older versions may or may not have been moved to cold storage.)\\n\\n\\\\begin{lstlisting}\\nGET https://.../api/v0/docs/1826rqgsdb/snapshots/1\\n\\\\end{lstlisting}\\n\\n\\\\section{Pushing a Project to WriteLaTeX}\\n\\nTODO still working on this part\\n\\n\\\\section{Test Data}\\n\\nYou can use this project as a servermock project. I've added an attachment and a file in a subfolder to make it a bit more interesting.\\n\\n\\\\input{foo/bar/servermock}\\n\\n\\\\includegraphics[width=\\\\linewidth]{min_mean_wait_evm_7_eps_150dpi}\\n\\n\\\\end{document}",
                                        "main.tex"),
                                    new SnapshotFile(
                                        "This text is from another file.",
                                        "foo/bar/servermock.tex")),
                                Arrays.asList(
                                    new SnapshotAttachment(
                                        "https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png",
                                        "min_mean_wait_evm_7_eps_150dpi.png")))));
                    put(
                        24,
                        new GetForVersionResult(
                            new SnapshotData(
                                Arrays.asList(
                                    new SnapshotFile(
                                        "\\\\documentclass[a4paper]{article}\\n\\n\\\\usepackage[english]{babel}\\n\\\\usepackage[utf8]{inputenc}\\n\\\\usepackage{graphicx}\\n\\\\usepackage{fullpage}\\n\\\\usepackage{listings}\\n\\\\usepackage{courier}\\n\\\\usepackage{url}\\n\\n\\\\lstset{basicstyle=\\\\ttfamily,breaklines=true}\\n\\n\\\\begin{document}\\n\\\\title{API for the writeLaTeX-Git Bridge}\\n\\\\author{JLM}\\n\\\\date{\\\\today}\\n\\\\maketitle\\n\\n\\\\section{Fetching a Project from WriteLaTeX}\\n\\nThere are three API calls that will likely be of interest. You can run them against this server (radiant-wind-3058.herokuapp.com).\\n\\n\\\\subsection{Get Doc}\\n\\nA ``doc'' is our internal term for a ``project''. At present, this just returns the latest version number.\\n\\n\\\\begin{lstlisting}\\nGET https://radiant-wind.....com/api/v0/docs/1826rqgsdb\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Saved Vers}\\n\\nA ``saved ver'' is a version of a doc, saved by via the versions menu. To list saved versions for a doc:\\n\\n\\\\begin{lstlisting}\\nGET https://radiant-wind.....com/api/v0/docs/1826rqgsdb/saved_vers\\n\\\\end{lstlisting}\\n\\n\\\\subsection{Get Snapshot for Version}\\n\\nA snapshot contains the content of a project in the given version. You can safely request a snapshot of any version that is, or was at any point in the last 24 hours, (1) a saved version, or (2) the current version. (Older versions may or may not have been moved to cold storage.)\\n\\n\\\\begin{lstlisting}\\nGET https://radiant-wind.....com/api/v0/docs/1826rqgsdb/snapshots/1\\n\\\\end{lstlisting}\\n\\n\\\\section{Pushing a Project to WriteLaTeX}\\n\\nTODO still working on this part\\n\\n\\\\section{Test Data}\\n\\nYou can use this project as a servermock project. Here is an extra file to make it a bit more interesting.\\n\\n\\\\includegraphics[width=\\\\linewidth]{min_mean_wait_evm_7_eps_150dpi}\\n\\n\\\\end{document}",
                                        "main.tex")),
                                Arrays.asList(
                                    new SnapshotAttachment(
                                        "https://writelatex-staging.s3.amazonaws.com/filepicker/1ENnu6zJSGyslI3DuNZD_min_mean_wait_evm_7.eps.150dpi.png",
                                        "min_mean_wait_evm_7_eps_150dpi.png")))));
                  }
                });
          }
        };

    push =
        new HashMap<String, SnapshotPushResult>() {
          {
            put("1826rqgsdb", new SnapshotPushResultSuccess());
          }
        };

    postback =
        new HashMap<String, SnapshotPostbackRequest>() {
          {
            //            put(
            //                    "1826rqgsdb",
            //                    new SnapshotPostbackRequestInvalidFiles(
            //                            Arrays.<InvalidFileError>asList(
            //                                    new InvalidFileErrorDefault(
            //                                            "file1.invalid"
            //                                    ),
            //                                    new InvalidFileErrorDisallowed(
            //                                            "file2.exe"
            //                                    ),
            //                                    new InvalidFileErrorUnclean(
            //                                            "hello world.png",
            //                                            "hello_world.png"
            //                                    )
            //                            )
            //                    )
            //            );
            //            put("1826rqgsdb", new SnapshotPostbackRequestOutOfDate());
            put(
                "1826rqgsdb",
                new SnapshotPostbackRequestInvalidProject(
                    Arrays.asList(
                        "Your project is missing main.tex.",
                        "Please name your main latex file main.tex.")));
            //            put("1826rqgsdb", new SnapshotPostbackRequestError());
          }
        };
  }

  public GetDocResult getStateForGetDoc(String projectName) {
    return getDoc.get(projectName);
  }

  public GetSavedVersResult getStateForGetSavedVers(String projectName) {
    return getSavedVers.get(projectName);
  }

  public GetForVersionResult getStateForGetForVers(String projectName, int versionID) {
    return getForVers.get(projectName).get(versionID);
  }

  public SnapshotPushResult getStateForPush(String projectName) {
    return push.get(projectName);
  }

  public SnapshotPostbackRequest getStateForPostback(String projectName) {
    return postback.get(projectName);
  }
}
