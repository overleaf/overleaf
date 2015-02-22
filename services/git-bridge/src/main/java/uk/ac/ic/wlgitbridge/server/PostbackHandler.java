package uk.ac.ic.wlgitbridge.server;

import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.bridge.BridgeAPI;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.UnexpectedPostbackException;
import uk.ac.ic.wlgitbridge.util.Util;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Created by Winston on 16/11/14.
 */
public class PostbackHandler extends AbstractHandler {

    private final BridgeAPI bridgeAPI;

    public PostbackHandler(BridgeAPI bridgeAPI) {
        this.bridgeAPI = bridgeAPI;
    }

    @Override
    public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response) throws IOException, ServletException {

        try {
            if (request.getMethod().equals("POST") && target.endsWith("postback")) {
                response.setContentType("application/json");
                String contents = Util.getContentsOfReader(request.getReader());
                String[] parts = request.getRequestURI().split("/");
                if (parts.length < 4) {
                    throw new ServletException();
                }
                String projectName = parts[1];
                String postbackKey = parts[2];
                Util.sout(baseRequest.getMethod() + " <- " + baseRequest.getUri());
                PostbackContents postbackContents = new PostbackContents(bridgeAPI, projectName, postbackKey, contents);
                JsonObject body = new JsonObject();

                try {
                    postbackContents.processPostback();
                } catch (UnexpectedPostbackException e) {
                    response.setStatus(HttpServletResponse.SC_CONFLICT);
                    body.add("code", new JsonPrimitive("unexpectedPostback"));
                    response.getWriter().println(body);
                    baseRequest.setHandled(true);
                    return;
                }
                response.setStatus(HttpServletResponse.SC_OK);
                body.add("code", new JsonPrimitive("success"));
                response.getWriter().println(body);
                baseRequest.setHandled(true);
            }
        } catch (IOException e) {
            Util.printStackTrace(e);
            throw e;
        } catch (ServletException e) {
            Util.printStackTrace(e);
            throw e;
        } catch (RuntimeException e) {
            Util.printStackTrace(e);
            throw e;
        }
    }

}
