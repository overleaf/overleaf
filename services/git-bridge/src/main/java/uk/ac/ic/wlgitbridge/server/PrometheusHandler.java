package uk.ac.ic.wlgitbridge.server;

import io.prometheus.client.CollectorRegistry;
import io.prometheus.client.exporter.common.TextFormat;
import io.prometheus.client.hotspot.DefaultExports;

import org.eclipse.jetty.server.HttpConnection;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.util.Log;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.Writer;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

public class PrometheusHandler extends AbstractHandler {

  public PrometheusHandler() {
    DefaultExports.initialize();
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
        && target.matches("^/metrics/?$")
    ) {
      Log.debug(method + " <- /metrics");
      this.printMetrics(request, response);
      baseRequest.setHandled(true);
    }
  }

  private void printMetrics(
    HttpServletRequest request,
    HttpServletResponse response
  ) throws ServletException, IOException {
    response.setStatus(200);
    String contentType = TextFormat.chooseContentType(request.getHeader("Accept"));
    response.setContentType(contentType);

    Writer writer = new BufferedWriter(response.getWriter());

    try {
      TextFormat.writeFormat(contentType, writer, CollectorRegistry.defaultRegistry.filteredMetricFamilySamples(parse(request)));
      writer.flush();
    } finally {
      writer.close();
    }
  }

  private Set<String> parse(HttpServletRequest req) {
    String[] includedParam = req.getParameterValues("name[]");
    if (includedParam == null) {
      return Collections.emptySet();
    } else {
      return new HashSet<String>(Arrays.asList(includedParam));
    }
  }
}
