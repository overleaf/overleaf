package uk.ac.ic.wlgitbridge.snapshot.servermock.server;

import java.io.File;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.NetworkConnector;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.util.resource.ResourceFactory;
import uk.ac.ic.wlgitbridge.snapshot.servermock.response.SnapshotResponseBuilder;
import uk.ac.ic.wlgitbridge.snapshot.servermock.state.SnapshotAPIState;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 09/01/15.
 */
public class MockSnapshotServer {

  private final Server server;
  private final SnapshotResponseBuilder responseBuilder;
  private int port;

  public MockSnapshotServer(int port, File resourceBase) {
    server = new Server(port);
    responseBuilder = new SnapshotResponseBuilder();

    Handler.Sequence handlers = new Handler.Sequence();
    handlers.addHandler(new MockOAuthRequestHandler());
    handlers.addHandler(getHandlerForResourceBase(resourceBase));
    server.setHandler(handlers);
  }

  private Handler.Sequence getHandlerForResourceBase(File resourceBase) {
    Handler.Sequence handlers = new Handler.Sequence();
    handlers.addHandler(new MockSnapshotRequestHandler(responseBuilder));
    handlers.addHandler(resourceHandlerWithBase(resourceBase));
    return handlers;
  }

  private ResourceHandler resourceHandlerWithBase(File resourceBase) {
    ResourceHandler resourceHandler = new ResourceHandler();
    resourceHandler.setBaseResource(
        ResourceFactory.of(resourceHandler).newResource(resourceBase.toPath()));
    return resourceHandler;
  }

  public void start() {
    try {
      server.start();
    } catch (Exception e) {
      Log.warn("Exception when trying to start server", e);
    }
    port = ((NetworkConnector) server.getConnectors()[0]).getLocalPort();
  }

  public void stop() {
    try {
      server.stop();
    } catch (Exception e) {
      Log.warn("Exception when trying to stop server", e);
    }
  }

  public void setState(SnapshotAPIState state) {
    responseBuilder.setState(state);
  }
}
