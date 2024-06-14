package uk.ac.ic.wlgitbridge.server;

import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.UnexpectedPostbackException;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 16/11/14.
 */
public class PostbackHandler extends AbstractHandler {

  private final Bridge bridge;

  public PostbackHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException, ServletException {
    Log.debug("PostbackHandler: " + baseRequest.getMethod() + " <- " + baseRequest.getHttpURI());
    try {
      if (request.getMethod().equals("POST") && target.endsWith("postback")) {
        response.setContentType("application/json");
        String contents = Util.getContentsOfReader(request.getReader());
        String[] parts = target.split("/");
        if (parts.length < 4) {
          throw new ServletException();
        }
        String projectName = parts[1];
        String postbackKey = parts[2];
        PostbackContents postbackContents =
            new PostbackContents(bridge, projectName, postbackKey, contents);
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
      Log.warn("IOException when handling postback to target: " + target, e);
      throw e;
    } catch (ServletException e) {
      Log.warn("ServletException when handling postback to target: " + target, e);
      throw e;
    } catch (RuntimeException e) {
      Log.warn("RuntimeException when handling postback to target: " + target, e);
      throw e;
    }
  }
}
