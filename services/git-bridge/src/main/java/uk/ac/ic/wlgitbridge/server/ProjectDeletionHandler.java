package uk.ac.ic.wlgitbridge.server;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import uk.ac.ic.wlgitbridge.bridge.Bridge;

public class ProjectDeletionHandler extends Handler.Abstract {

  private final Bridge bridge;
  private final Pattern routePattern = Pattern.compile("^/projects/([0-9a-f]{24})$");

  public ProjectDeletionHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String method = request.getMethod();
    String target = Request.getPathInContext(request);
    Matcher matcher = routePattern.matcher(target);
    if (method.equals("DELETE") && target != null && matcher.matches()) {
      String projectName = matcher.group(1);
      response.getHeaders().put("Content-Type", "text/plain");
      response.setStatus(HttpStatus.NO_CONTENT_204);
      this.bridge.deleteProject(projectName);
      callback.succeeded();
      return true;
    }
    return false;
  }
}
