package uk.ac.ic.wlgitbridge.test.server;

import org.eclipse.jetty.server.NetworkConnector;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.HandlerCollection;
import org.eclipse.jetty.server.handler.ResourceHandler;
import uk.ac.ic.wlgitbridge.test.response.SnapshotResponseBuilder;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIState;
import uk.ac.ic.wlgitbridge.util.Util;

import java.io.File;

/**
 * Created by Winston on 09/01/15.
 */
public class MockSnapshotServer {

    private final Server server;
    private final SnapshotResponseBuilder responseBuilder;
    private int port;

    public MockSnapshotServer(int port, File resourceBase) {
        server = new Server(port);
        responseBuilder = new SnapshotResponseBuilder();
        server.setHandler(getHandlerForResourceBase(resourceBase));
    }

    private HandlerCollection getHandlerForResourceBase(File resourceBase) {
        HandlerCollection handlers = new HandlerCollection();
        handlers.addHandler(new MockSnapshotRequestHandler(responseBuilder));
        handlers.addHandler(resourceHandlerWithBase(resourceBase));
        return handlers;
    }

    private ResourceHandler resourceHandlerWithBase(File resourceBase) {
        ResourceHandler resourceHandler = new ResourceHandler();
        resourceHandler.setResourceBase(resourceBase.getAbsolutePath());
        return resourceHandler;
    }

    public void start() {
        try {
            server.start();
        } catch (Exception e) {
            Util.printStackTrace(e);
        }
        port = ((NetworkConnector) server.getConnectors()[0]).getLocalPort();
    }

    public void setState(SnapshotAPIState state) {
        responseBuilder.setState(state);
    }

}
