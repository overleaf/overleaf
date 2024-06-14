package uk.ac.ic.wlgitbridge.server;

import java.io.IOException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.handler.ErrorHandler;

public class ProductionErrorHandler extends ErrorHandler {
  @Override
  public void handle(
      String target,
      org.eclipse.jetty.server.Request baseRequest,
      HttpServletRequest request,
      HttpServletResponse response)
      throws IOException {
    response
        .getWriter()
        .append("{\"message\":\"HTTP error ")
        .append(String.valueOf(response.getStatus()))
        .append("\"}");
  }
}
