import org.junit.Test;
import uk.ac.ic.wlgitbridge.test.server.MockSnapshotServer;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIState;
import uk.ac.ic.wlgitbridge.test.state.SnapshotAPIStateBuilder;

/**
 * Created by Winston on 11/01/15.
 */
public class TTest {

    @Test
    public void testStreamToString() {
        SnapshotAPIStateBuilder stateBuilder = new SnapshotAPIStateBuilder(getClass().getResourceAsStream("/state.json"));
        SnapshotAPIState state = stateBuilder.build();
        MockSnapshotServer server = new MockSnapshotServer();
        server.setState(state);
        server.start();
        while (true);
    }

}
