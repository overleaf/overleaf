package uk.ac.ic.wlgitbridge.test;

import uk.ac.ic.wlgitbridge.test.server.MockSnapshotServer;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIState;

import java.io.File;

/**
 * Created by Winston on 10/01/15.
 */
public class Main {

    public static void main(String[] args) {
        MockSnapshotServer server = new MockSnapshotServer(new File("/Users/Roxy/Code/java/writelatex-git-bridge"));
        server.setState(new SnapshotAPIState());
        server.start();
    }

}
