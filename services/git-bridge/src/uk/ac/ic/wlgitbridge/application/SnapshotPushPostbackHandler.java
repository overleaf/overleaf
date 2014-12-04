package uk.ac.ic.wlgitbridge.application;

import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.UnexpectedPostbackException;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;

/**
 * Created by Winston on 16/11/14.
 */
public class SnapshotPushPostbackHandler extends AbstractHandler {

    private final WriteLatexDataSource writeLatexDataSource;

    public SnapshotPushPostbackHandler(WriteLatexDataSource writeLatexDataSource) {
        this.writeLatexDataSource = writeLatexDataSource;
    }

    @Override
    public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {
        if (request.getMethod().equals("POST") && request.getPathInfo().endsWith("postback")) {
            String contents = getContentsOfReader(request.getReader());
            String[] parts = request.getRequestURI().split("/");
            if (parts.length < 4) {
                throw new ServletException();
            }
            String projectName = parts[1];
            String postbackKey = parts[2];
            System.out.println("Postback received for project: " + projectName);
            SnapshotPushPostbackContents postbackContents = new SnapshotPushPostbackContents(writeLatexDataSource, projectName, postbackKey, contents);
            try {
                postbackContents.processPostback();
            } catch (UnexpectedPostbackException e) {
                throw new ServletException();
            }
            baseRequest.setHandled(true);
        }
    }

    private static String getContentsOfReader(BufferedReader reader) throws IOException {
        StringBuilder sb = new StringBuilder();
        for (String line; (line = reader.readLine()) != null; ) {
            sb.append(line);
        }
        return sb.toString();
    }

}
