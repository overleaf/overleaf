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

/**
  * Wrapper for the MetricsServlet from the Prometheus client.
  *
  * We wrap this in a handler here, as we use a wildcard servlet context on /*, and adding
  * an additional servlet context collides with it. Adding a servlet context on /metrics
  * causes a redirect to /metrics/ which breaks things when jetty doesn't know the full
  * public URL.
  * 
  * There may still be a better way to do this, but it works.
  **/

public class PrometheusHandler extends AbstractHandler {

  private final ServletHolder holder;

  public PrometheusHandler() {
    DefaultExports.initialize();

    this.holder = new ServletHolder(new MetricsServlet());
    try {
      this.holder.initialize();
    } catch (Exception e) {
      Log.error("Unable to initialise metrics servlet: " + e.getMessage());
    }
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

      if (!this.holder.isAvailable()) {
        try {
          this.holder.start();
        } catch (Exception e) {
          Log.error("Unable to start metrics servlet: " + e.getMessage());
          response.setStatus(500);
          baseRequest.setHandled(true);
          return;
        }
      }

      this.holder.handle(baseRequest, request, response);
      baseRequest.setHandled(true);
    }
  }
}
