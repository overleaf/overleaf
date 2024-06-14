package uk.ac.ic.wlgitbridge.server;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.bridge.Bridge;

public class ProjectDeletionHandler extends AbstractHandler {

  private final Bridge bridge;
  private final Pattern routePattern = Pattern.compile("^/projects/([0-9a-f]{24})$");

  public ProjectDeletionHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    String method = baseRequest.getMethod();
    Matcher matcher = routePattern.matcher(target);
    if (method.equals("DELETE") && target != null && matcher.matches()) {
      String projectName = matcher.group(1);
      response.setContentType("text/plain");
      response.setStatus(204);
      this.bridge.deleteProject(projectName);
      baseRequest.setHandled(true);
    }
  }
}
