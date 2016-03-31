package uk.ac.ic.wlgitbridge;

import uk.ac.ic.wlgitbridge.application.GitBridgeApp;
import uk.ac.ic.wlgitbridge.util.Log;

/**
 * Created by Winston on 01/11/14.
 */
public class Main {

    public static void main(String[] args) {
        try {
            new GitBridgeApp(args).run();
        } catch (Throwable t) {
            /* So that we get a timestamp */
            Log.error("Fatal exception thrown to top level, exiting: ", t);
            System.exit(1);
        }
    }

}
