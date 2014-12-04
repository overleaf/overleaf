package uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion;

import org.junit.Test;

/**
 * Created by Winston on 06/11/14.
 */
public class SnapshotGetForVersionRequestTest {

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
