package uk.ac.ic.wlgitbridge.server;

import io.prometheus.client.CollectorRegistry;
import io.prometheus.client.exporter.common.TextFormat;
import io.prometheus.client.hotspot.DefaultExports;
import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.util.*;
import org.eclipse.jetty.http.HttpField;
import org.eclipse.jetty.http.HttpHeader;
import org.eclipse.jetty.http.HttpStatus;
import org.eclipse.jetty.io.Content;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import org.eclipse.jetty.util.Fields;
import uk.ac.ic.wlgitbridge.util.Log;

public class PrometheusHandler extends Handler.Abstract {

  public PrometheusHandler() {
    DefaultExports.initialize();
  }

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String method = request.getMethod();
    String path = Request.getPathInContext(request);
    if (("GET".equals(method)) && path != null && path.matches("^/metrics/?$")) {
      Log.debug(method + " <- /metrics");
      this.printMetrics(request, response, callback);
      return true;
    }
    return false;
  }

  private void printMetrics(Request request, Response response, Callback callback)
      throws Exception {
    response.setStatus(HttpStatus.OK_200);
    HttpField acceptField = request.getHeaders().getField(HttpHeader.ACCEPT);
    String accept = acceptField != null ? acceptField.getValue() : null;
    String contentType = TextFormat.chooseContentType(accept);
    response.getHeaders().put("Content-Type", contentType);

    Writer writer =
        new BufferedWriter(new OutputStreamWriter(Content.Sink.asOutputStream(response)));

    try {
      TextFormat.writeFormat(
          contentType,
          writer,
          CollectorRegistry.defaultRegistry.filteredMetricFamilySamples(parse(request)));
      writer.flush();
    } finally {
      writer.close();
      callback.succeeded();
    }
  }

  private Set<String> parse(Request req) {
    try {
      Fields parameters = Request.getParameters(req);
      if (parameters == null) {
        return Collections.emptySet();
      }
      List<String> values = parameters.getValues("name[]");
      if (values == null || values.isEmpty()) {
        return Collections.emptySet();
      }
      String[] includedParam = values.toArray(new String[0]);
      return new HashSet<String>(Arrays.asList(includedParam));
    } catch (Exception e) {
      return Collections.emptySet();
    }
  }
}
