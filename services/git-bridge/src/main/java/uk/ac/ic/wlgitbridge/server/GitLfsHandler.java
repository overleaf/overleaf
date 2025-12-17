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

public class GitLfsHandler extends Handler.Abstract {

  private final Bridge bridge;

  public GitLfsHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String method = request.getMethod();
    String path = Request.getPathInContext(request);
    if (("POST".equals(method))
        && path != null
        && path.matches("^/[0-9a-z]+\\.git/info/lfs/objects/batch/?$")) {
      Log.debug(method + " <- /<project>.git/info/lfs/objects/batch");
      response.getHeaders().put("Content-Type", "application/vnd.git-lfs+json");
      response.setStatus(HttpStatus.UNPROCESSABLE_ENTITY_422);
      ByteBuffer responseBuffer =
          ByteBuffer.wrap(
              "{\"message\": \"ERROR: Git LFS is not supported on Overleaf\"}\n"
                  .getBytes(StandardCharsets.UTF_8));
      response.write(true, responseBuffer, callback);
      return true;
    }
    return false;
  }
}
