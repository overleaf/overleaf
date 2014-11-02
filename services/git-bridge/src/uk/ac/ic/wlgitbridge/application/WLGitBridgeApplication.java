package uk.ac.ic.wlgitbridge.application;

import javax.servlet.ServletException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLGitBridgeApplication {

    public WLGitBridgeApplication(String[] args) {
        parseArguments(args);
    }

    public void run() {
        try {
            new WLGitBridgeServer(8080).start();
        } catch (ServletException e) {
            e.printStackTrace();
        }
    }

    private void parseArguments(String[] args) {

    }

}
