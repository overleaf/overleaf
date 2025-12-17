package uk.ac.ic.wlgitbridge.snapshot.servermock.server;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;

public class MockOAuthRequestHandler extends Handler.Abstract {

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String method = request.getMethod();
    String path = Request.getPathInContext(request);
    if (method.equals("GET") && path.equals("/oauth/token/info")) {
      response.getHeaders().put("Content-Type", "application/json");
      response.setStatus(HttpStatus.OK_200);
      response.write(true, ByteBuffer.wrap("{}\n".getBytes(StandardCharsets.UTF_8)), callback);
      return true;
    }
    return false;
  }
}
