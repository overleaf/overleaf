package uk.ac.ic.wlgitbridge.application;

import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.util.log.Log;
import uk.ac.ic.wlgitbridge.application.jetty.NullLogger;
import uk.ac.ic.wlgitbridge.git.WLGitServlet;
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;
import uk.ac.ic.wlgitbridge.writelatex.model.WLDataModel;

import javax.servlet.ServletException;
import java.net.BindException;

/**
 * Created by Winston on 02/11/14.
 */

/**
 * Class for the actual server.
 */
public class WLGitBridgeServer {

    private final Server jettyServer;
    private final int port;
    private String rootGitDirectoryPath;

    /**
     * Constructs an instance of the server.
     * @param port the port number to listen on
     * @param rootGitDirectoryPath the root directory path containing the git repositories
     * @throws ServletException if the servlet throws an exception
     */
    public WLGitBridgeServer(final int port, String rootGitDirectoryPath) throws ServletException, InvalidRootDirectoryPathException {
        this.port = port;
        this.rootGitDirectoryPath = rootGitDirectoryPath;
        Log.setLog(new NullLogger());
        jettyServer = new Server(port);
        configureJettyServer();
    }

    /**
     * Starts the server on the port given on construction.
     */
    public void start() {
        try {
            jettyServer.start();
            System.out.println("WriteLatex-Git Bridge server started");
            System.out.println("Listening on port: " + port);
            System.out.println("Root git directory path: " + rootGitDirectoryPath);
        } catch (BindException e) {
            e.printStackTrace();
        } catch (Exception e) {
            e.printStackTrace();
        }
        try {
            jettyServer.join();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    private void configureJettyServer() throws ServletException, InvalidRootDirectoryPathException {
        final ServletContextHandler servletContextHandler = new ServletContextHandler(ServletContextHandler.SESSIONS);
        servletContextHandler.setContextPath("/");
        servletContextHandler.addServlet(
                new ServletHolder(
                        new WLGitServlet(servletContextHandler, new WLDataModel(), rootGitDirectoryPath)),
                "/*"
        );
        jettyServer.setHandler(servletContextHandler);
    }

}
