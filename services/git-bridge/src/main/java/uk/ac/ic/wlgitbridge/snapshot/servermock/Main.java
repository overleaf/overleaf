package uk.ac.ic.wlgitbridge.snapshot.servermock;

import uk.ac.ic.wlgitbridge.snapshot.servermock.server.MockSnapshotServer;
import uk.ac.ic.wlgitbridge.snapshot.servermock.state.SnapshotAPIStateBuilder;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;

/**
 * Created by Winston on 10/01/15.
 */
public class Main {

    public static void main(String[] args) throws FileNotFoundException {
        MockSnapshotServer server = new MockSnapshotServer(
                60000,
                new File("/Users/Roxy/Code/java/writelatex-git-bridge")
        );
        server.setState(
                new SnapshotAPIStateBuilder(
                        new FileInputStream(
                                new File("/Users/Roxy/Desktop/state.json")
                        )
                ).build()
        );
        server.start();
    }

}
