package uk.ac.ic.wlgitbridge.test.writelatex.api.request.getforversion;

import org.junit.Test;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionResult;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetForVersionRequestTests {

    @Test
    public void nothingToTest() {
        SnapshotGetForVersionRequest request = new SnapshotGetForVersionRequest("1826rqgsdb", 76);
        request.request();
        try {
            SnapshotGetForVersionResult result = request.getResult();
        } catch (Throwable throwable) {
            throwable.printStackTrace();
        }


    }

}
