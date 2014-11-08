package uk.ac.ic.wlgitbridge.test.writelatex.model;

import org.junit.Test;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.getdoc.exception.InvalidProjectException;
import uk.ac.ic.wlgitbridge.writelatex.model.WLProject;

import java.io.IOException;
import java.util.concurrent.ExecutionException;

/**
 * Created by Winston on 06/11/14.
 */
public class WLProjectTests {

    @Test
    public void nothingToTest() {
        WLProject project = new WLProject("1826rqgsdb");
        try {
            project.fetchNewSnapshots();
        } catch (FailedConnectionException e) {
            e.printStackTrace();
        } catch (InvalidProjectException e) {
            e.printStackTrace();
        }
    }

}
