package uk.ac.ic.wlgitbridge.writelatex.api.request.base;

import org.junit.Test;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getforversion.SnapshotGetForVersionRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getsavedvers.SnapshotGetSavedVersRequest;

/**
 * Created by Winston on 06/11/14.
 */
public class RequestTest {

    @Test
    public void nothingToTest() {
        String projectName = "1826rqgsdb";
        Request getDoc = new SnapshotGetDocRequest(projectName);
        Request getSavedVers = new SnapshotGetSavedVersRequest(projectName);
        Request getForVersion = new SnapshotGetForVersionRequest(projectName, 76);

        getDoc.request();
        getSavedVers.request();
        getForVersion.request();

        try {
            System.out.println(getDoc.getResult());
            System.out.println(getSavedVers.getResult());
            System.out.println(getForVersion.getResult());
        } catch (Throwable e) {
            e.printStackTrace();
        }
    }

}
