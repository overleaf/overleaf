package uk.ac.ic.wlgitbridge.server;

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.util.Callback;
import org.eclipse.jetty.util.Fields;
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
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    if (!"GET".equals(request.getMethod())) return false;
    String path = Request.getPathInContext(request);
    LOG.debug("GET <- {}", request.getHttpURI());

    Matcher docKeyMatcher = DOC_KEY_PATTERN.matcher(path);
    if (!docKeyMatcher.matches()) return false;
    String docKey = docKeyMatcher.group(1);

    Fields parameters = Request.getParameters(request);
    String apiKey = parameters != null ? parameters.getValue("key") : null;
    if (apiKey == null) return false;

    try {
      bridge.checkPostbackKey(docKey, apiKey);
    } catch (InvalidPostbackKeyException e) {
      LOG.warn("INVALID POST BACK KEY: docKey={} apiKey={}", docKey, apiKey);
      return false;
    }

    return super.handle(request, response, callback);
  }
}
