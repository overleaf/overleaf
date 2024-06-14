package uk.ac.ic.wlgitbridge.server;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InvalidPostbackKeyException;

/*
 * Serve files referenced by the snapshot that we send to the Overleaf API.
 *
 * Requests must include the postback key.
 */
public class FileHandler extends ResourceHandler {
  private static final Logger LOG = LoggerFactory.getLogger(FileHandler.class);

  private final Bridge bridge;
  private final Pattern DOC_KEY_PATTERN = Pattern.compile("^/(\\w+)/.+$");

  public FileHandler(Bridge bridge) {
    this.bridge = bridge;
  }

  @Override
  public void handle(
      String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
      throws IOException, ServletException {
    if (!"GET".equals(baseRequest.getMethod())) return;
    LOG.debug("GET <- {}", baseRequest.getRequestURI());

    Matcher docKeyMatcher = DOC_KEY_PATTERN.matcher(target);
    if (!docKeyMatcher.matches()) return;
    String docKey = docKeyMatcher.group(1);

    String apiKey = request.getParameter("key");
    if (apiKey == null) return;

    try {
      bridge.checkPostbackKey(docKey, apiKey);
    } catch (InvalidPostbackKeyException e) {
      LOG.warn("INVALID POST BACK KEY: docKey={} apiKey={}", docKey, apiKey);
      return;
    }

    super.handle(target, baseRequest, request, response);
  }
}
