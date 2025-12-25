package uk.ac.ic.wlgitbridge.server;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.util.Log;

public class HealthCheckHandler extends Handler.Abstract {

  private final Bridge bridge;

  public HealthCheckHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String method = request.getMethod();
    String path = Request.getPathInContext(request);
    if (("GET".equals(method) || "HEAD".equals(method))
        && path != null
        && path.matches("^/health_check/?$")) {
      Log.debug(method + " <- /health_check");
      response.getHeaders().put("Content-Type", "text/plain");
      if (bridge.healthCheck()) {
        response.setStatus(HttpStatus.OK_200);
        response.write(true, ByteBuffer.wrap("ok\n".getBytes(StandardCharsets.UTF_8)), callback);
      } else {
        response.setStatus(HttpStatus.INTERNAL_SERVER_ERROR_500);
        response.write(
            true, ByteBuffer.wrap("failed\n".getBytes(StandardCharsets.UTF_8)), callback);
      }
      return true;
    }
    return false;
  }
}
