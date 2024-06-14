package uk.ac.ic.wlgitbridge.server;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import javax.management.JMException;
import javax.management.ObjectName;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import uk.ac.ic.wlgitbridge.util.Log;

public class DiagnosticsHandler extends AbstractHandler {

  public DiagnosticsHandler() {}

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException, ServletException {
    String method = baseRequest.getMethod();
    if (("GET".equals(method)) && target != null && target.matches("^/diags/?$")) {
      baseRequest.setHandled(true);

      Log.debug(method + " <- /diags");

      String detail;
      String summary;

      try {
        detail = execute("vmNativeMemory", "detail");
        summary = execute("vmNativeMemory", "summary");
      } catch (JMException e) {
        Log.error("Failed to get native memory detail: " + e.getMessage());
        response.setStatus(500);
        return;
      }

      response.setContentType("text/plain");
      response.setStatus(200);

      response.getWriter().write(summary);
      response.getWriter().write("\n----------\n\n");
      response.getWriter().write(detail);
      response.getWriter().flush();
    }
  }

  public static String execute(String command, String... args) throws JMException {
    return (String)
        ManagementFactory.getPlatformMBeanServer()
            .invoke(
                new ObjectName("com.sun.management:type=DiagnosticCommand"),
                command,
                new Object[] {args},
                new String[] {"[Ljava.lang.String;"});
  }
}
