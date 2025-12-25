package uk.ac.ic.wlgitbridge.server;

import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.lang.management.ManagementFactory;
import javax.management.JMException;
import javax.management.ObjectName;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.io.Content;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import uk.ac.ic.wlgitbridge.util.Log;

public class DiagnosticsHandler extends Handler.Abstract {

  public DiagnosticsHandler() {}

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String method = request.getMethod();
    String path = Request.getPathInContext(request);
    if (("GET".equals(method)) && path != null && path.matches("^/diags/?$")) {
      Log.debug(method + " <- /diags");

      String detail;
      String summary;

      try {
        detail = execute("vmNativeMemory", "detail");
        summary = execute("vmNativeMemory", "summary");
      } catch (JMException e) {
        Log.error("Failed to get native memory detail: " + e.getMessage());
        response.setStatus(HttpStatus.INTERNAL_SERVER_ERROR_500);
        callback.succeeded();
        return true;
      }

      response.getHeaders().put("Content-Type", "text/plain");
      response.setStatus(HttpStatus.OK_200);

      Writer writer =
          new BufferedWriter(new OutputStreamWriter(Content.Sink.asOutputStream(response)));
      try {
        writer.write(summary);
        writer.write("\n----------\n\n");
        writer.write(detail);
        writer.flush();
      } finally {
        writer.close();
        callback.succeeded();
      }
      return true;
    }
    return false;
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
