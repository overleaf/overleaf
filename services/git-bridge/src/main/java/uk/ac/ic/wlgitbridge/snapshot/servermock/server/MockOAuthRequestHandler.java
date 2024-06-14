package uk.ac.ic.wlgitbridge.snapshot.servermock.server;

import java.io.IOException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;

public class MockOAuthRequestHandler extends AbstractHandler {

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    String method = baseRequest.getMethod();
    if (method.equals("GET") && target.equals("/oauth/token/info")) {
      response.setContentType("application/json");
      response.setStatus(HttpServletResponse.SC_OK);
      response.getWriter().println("{}");
      baseRequest.setHandled(true);
    }
  }
}
