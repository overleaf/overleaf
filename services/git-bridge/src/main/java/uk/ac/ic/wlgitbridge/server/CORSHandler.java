package uk.ac.ic.wlgitbridge.server;

import java.io.IOException;
import java.util.Set;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.util.Log;

public class CORSHandler extends AbstractHandler {
  private final Set<String> allowedCorsOrigins;

  public CORSHandler(String[] allowedCorsOrigins) {
    this.allowedCorsOrigins = Set.of(allowedCorsOrigins);
  }

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException {

    String origin = request.getHeader("Origin");
    if (origin == null) {
      return; // Not a CORS request
    }

    final boolean ok = allowedCorsOrigins.contains(origin);
    if (ok) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, POST, DELETE");
      response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.setHeader("Access-Control-Max-Age", "86400"); // cache for 24h
    }
    String method = baseRequest.getMethod();
    if ("OPTIONS".equals(method)) {
      Log.debug("OPTIONS <- {}", target);
      baseRequest.setHandled(true);
      if (ok) {
        response.setStatus(200);
      } else {
        response.setStatus(403);
      }
    }
  }
}
