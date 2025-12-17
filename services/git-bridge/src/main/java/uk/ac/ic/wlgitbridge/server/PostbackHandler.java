package uk.ac.ic.wlgitbridge.server;

import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import jakarta.servlet.ServletException;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.io.Content;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.UnexpectedPostbackException;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 16/11/14.
 */
public class PostbackHandler extends Handler.Abstract {

  private final Bridge bridge;

  public PostbackHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String target = Request.getPathInContext(request);
    Log.debug("PostbackHandler: " + request.getMethod() + " <- " + request.getHttpURI());
    try {
      if (request.getMethod().equals("POST") && target.endsWith("postback")) {
        response.getHeaders().put("Content-Type", "application/json");
        String contents = Content.Source.asString(request);
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
          response.setStatus(HttpStatus.CONFLICT_409);
          body.add("code", new JsonPrimitive("unexpectedPostback"));
          response.write(
              true, ByteBuffer.wrap((body + "\n").getBytes(StandardCharsets.UTF_8)), callback);
          return true;
        }
        response.setStatus(HttpStatus.OK_200);
        body.add("code", new JsonPrimitive("success"));
        response.write(
            true, ByteBuffer.wrap((body + "\n").getBytes(StandardCharsets.UTF_8)), callback);
        return true;
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
    return false;
  }
}
