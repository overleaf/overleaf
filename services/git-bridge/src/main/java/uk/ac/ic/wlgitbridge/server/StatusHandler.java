package uk.ac.ic.wlgitbridge.server;

import java.nio.charset.StandardCharsets;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.util.Log;

public class StatusHandler extends Handler.Abstract {

  private final Bridge bridge;

  public StatusHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String method = request.getMethod();
    String target = Request.getPathInContext(request);
    if (("GET".equals(method) || "HEAD".equals(method))
        && target != null
        && target.matches("^/status/?$")) {
      Log.debug(method + " <- /status");
      response.setStatus(HttpStatus.OK_200);
      response.getHeaders().put("Content-Type", "text/plain");
      response.write(
          true, java.nio.ByteBuffer.wrap("ok\n".getBytes(StandardCharsets.UTF_8)), callback);
      return true;
    }
    return false;
  }
}
