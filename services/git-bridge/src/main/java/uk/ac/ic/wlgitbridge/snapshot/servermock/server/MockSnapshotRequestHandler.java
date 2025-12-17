package uk.ac.ic.wlgitbridge.snapshot.servermock.server;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import org.eclipse.jetty.io.Content;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.util.Callback;
import uk.ac.ic.wlgitbridge.snapshot.servermock.exception.InvalidAPICallException;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.*;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 09/01/15.
 */
public class MockSnapshotRequestHandler extends Handler.Abstract {

  private final SnapshotResponseBuilder responseBuilder;

  public MockSnapshotRequestHandler(SnapshotResponseBuilder responseBuilder) {
    this.responseBuilder = responseBuilder;
  }

  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String path = Request.getPathInContext(request);
    boolean handled;
    try {
      String requestBody = Content.Source.asString(request);
      final SnapshotResponse snapshotResponse =
          responseBuilder.buildWithTarget(path, request.getMethod());
      String responseText = snapshotResponse.respond() + "\n";
      response.write(
          true, ByteBuffer.wrap(responseText.getBytes(StandardCharsets.UTF_8)), callback);
      new PostbackThread(requestBody, snapshotResponse.postback()).startIfNotNull();
      handled = true;
    } catch (InvalidAPICallException e) {
      handled = false;
    } catch (RuntimeException e) {
      Log.warn("Runtime exception when handling request", e);
      callback.succeeded();
      handled = true;
    }
    return handled;
  }
}
