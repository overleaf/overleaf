package uk.ac.ic.wlgitbridge.test.writelatex.model;

import org.junit.Test;
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
            project.update();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (ExecutionException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

}
