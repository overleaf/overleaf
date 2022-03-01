package uk.ac.ic.wlgitbridge.server;

import org.eclipse.jetty.server.HttpConnection;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.util.Log;

import javax.management.JMException;
import javax.management.ObjectName;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.Writer;
import java.lang.management.ManagementFactory;

public class DiagnosticsHandler extends AbstractHandler {

  public DiagnosticsHandler() {
  }

  @Override
  public void handle(
    String target,
    Request baseRequest,
    HttpServletRequest request,
    HttpServletResponse response
  ) throws IOException, ServletException {
    String method = baseRequest.getMethod();
    if (
      ("GET".equals(method))
        && target != null
        && target.matches("^/diags/?$")
    ) {
      baseRequest.setHandled(true);

      Log.debug(method + " <- /diags");

      String detail;
      String summary;

      try {
        detail = execute("vmNativeMemory", "detail");
        summary = execute("vmNativeMemory", "summary");
      } catch(JMException e) {
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
    return (String) ManagementFactory.getPlatformMBeanServer().invoke(
      new ObjectName("com.sun.management:type=DiagnosticCommand"),
      command,
      new Object[]{args},
      new String[]{"[Ljava.lang.String;"});
  }
}
