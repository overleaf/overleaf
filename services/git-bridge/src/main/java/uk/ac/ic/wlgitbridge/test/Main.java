package uk.ac.ic.wlgitbridge.test;

import uk.ac.ic.wlgitbridge.test.server.MockSnapshotServer;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIState;

/**
 * Created by Winston on 10/01/15.
 */
public class Main {

    public static void main(String[] args) {
        MockSnapshotServer server = new MockSnapshotServer();
        server.setState(new SnapshotAPIState());
        server.start();
    }

}
