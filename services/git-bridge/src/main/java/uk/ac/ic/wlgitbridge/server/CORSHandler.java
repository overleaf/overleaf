package uk.ac.ic.wlgitbridge.server;

import java.util.Set;
import org.eclipse.jetty.http.HttpField;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import uk.ac.ic.wlgitbridge.util.Log;

public class CORSHandler extends Handler.Abstract {
  private final Set<String> allowedCorsOrigins;

  public CORSHandler(String[] allowedCorsOrigins) {
    this.allowedCorsOrigins = Set.of(allowedCorsOrigins);
  }

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    HttpField originField = request.getHeaders().getField(HttpHeader.ORIGIN);
    String origin = originField != null ? originField.getValue() : null;

    if (origin == null) {
      return false; // Not a CORS request
    }

    final boolean ok = allowedCorsOrigins.contains(origin);
    if (ok) {
      response.getHeaders().put("Access-Control-Allow-Origin", origin);
      response.getHeaders().put("Access-Control-Allow-Credentials", "true");
      response.getHeaders().put("Access-Control-Allow-Methods", "GET, HEAD, PUT, POST, DELETE");
      response.getHeaders().put("Access-Control-Allow-Headers", "Authorization, Content-Type");
      response.getHeaders().put("Access-Control-Max-Age", "86400"); // cache for 24h
    }
    String method = request.getMethod();
    if ("OPTIONS".equals(method)) {
      String path = Request.getPathInContext(request);
      Log.debug("OPTIONS <- {}", path);
      if (ok) {
        response.setStatus(HttpStatus.OK_200);
      } else {
        response.setStatus(HttpStatus.FORBIDDEN_403);
      }
      callback.succeeded();
      return true;
    }
    return false;
  }
}
