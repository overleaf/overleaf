package uk.ac.ic.wlgitbridge.server;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.Response;
import org.eclipse.jetty.server.handler.ErrorHandler;
import org.eclipse.jetty.util.Callback;

public class ProductionErrorHandler extends ErrorHandler {
  @Override
  public boolean handle(Request request, Response response, Callback callback) throws Exception {
    String message = "{\"message\":\"HTTP error " + response.getStatus() + "\"}";
    response.write(true, ByteBuffer.wrap(message.getBytes(StandardCharsets.UTF_8)), callback);
    return true;
  }
}
