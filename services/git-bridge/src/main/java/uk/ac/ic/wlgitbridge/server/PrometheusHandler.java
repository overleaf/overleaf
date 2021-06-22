package uk.ac.ic.wlgitbridge.server;

import io.prometheus.client.exporter.MetricsServlet;
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
import java.io.IOException;
import java.util.Arrays;

public class PrometheusHandler extends AbstractHandler {

  private final Bridge bridge;
  private final MetricsServlet metricsServlet;
  private final ServletHolder holder;

  public PrometheusHandler(Bridge bridge) {
    this.bridge = bridge;
    this.metricsServlet = new MetricsServlet();
    this.holder = new ServletHolder(metricsServlet);
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
      Log.info(method + " <- /metrics");
      response.setContentType("application/vnd.git-lfs+json");
      response.setStatus(200);
      this.holder.handle(baseRequest, request, response);
      baseRequest.setHandled(true);
    }
  }

}
