package uk.ac.ic.wlgitbridge.test.server;

import org.eclipse.jetty.server.NetworkConnector;
import org.eclipse.jetty.server.Server;
import uk.ac.ic.wlgitbridge.test.response.SnapshotResponseBuilder;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIState;

/**
 * Created by Winston on 09/01/15.
 */
public class MockSnapshotServer {

    private final Server server;
    private final SnapshotResponseBuilder responseBuilder;
    private int port;

    public MockSnapshotServer() {
        server = new Server(60000);
        responseBuilder = new SnapshotResponseBuilder();
        server.setHandler(new MockSnapshotRequestHandler(responseBuilder));
    }

    public void start() {
        try {
            server.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
        port = ((NetworkConnector) server.getConnectors()[0]).getLocalPort();
        System.out.println(port);
    }

    public void setState(SnapshotAPIState state) {
        responseBuilder.setState(state);
    }

}
