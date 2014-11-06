package uk.ac.ic.wlgitbridge.test.writelatex.api;

import org.junit.Test;
import uk.ac.ic.wlgitbridge.writelatex.api.request.Request;
import uk.ac.ic.wlgitbridge.writelatex.api.request.SnapshotGetDocRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.SnapshotGetForVersionRequest;
import uk.ac.ic.wlgitbridge.writelatex.api.request.SnapshotGetSavedVersRequest;

import java.io.IOException;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 06/11/14.
 */
public class RequestTests {

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
            System.out.println(getDoc.getResponse());
            System.out.println(getSavedVers.getResponse());
            System.out.println(getForVersion.getResponse());
        } catch (IOException e) {
            e.printStackTrace();
        } catch (ExecutionException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

}
