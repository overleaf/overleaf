package uk.ac.ic.wlgitbridge.server;

import java.io.IOException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.util.Log;

public class GitLfsHandler extends AbstractHandler {

  private final Bridge bridge;

  public GitLfsHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    String method = baseRequest.getMethod();
    if (("POST".equals(method))
        && target != null
        && target.matches("^/[0-9a-z]+\\.git/info/lfs/objects/batch/?$")) {
      Log.debug(method + " <- /<project>.git/info/lfs/objects/batch");
      response.setContentType("application/vnd.git-lfs+json");
      response.setStatus(422);
      response
          .getWriter()
          .println("{\"message\": \"ERROR: Git LFS is not supported on Overleaf\"}");
      baseRequest.setHandled(true);
    }
  }
}
