package uk.ac.ic.wlgitbridge.server;

import java.io.IOException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.util.Log;

public class HealthCheckHandler extends AbstractHandler {

  private final Bridge bridge;

  public HealthCheckHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    String method = baseRequest.getMethod();
    if (("GET".equals(method) || "HEAD".equals(method))
        && target != null
        && target.matches("^/health_check/?$")) {
      Log.debug(method + " <- /health_check");
      baseRequest.setHandled(true);
      response.setContentType("text/plain");
      if (bridge.healthCheck()) {
        response.setStatus(200);
        response.getWriter().println("ok");
      } else {
        response.setStatus(500);
        response.getWriter().println("failed");
      }
    }
  }
}
