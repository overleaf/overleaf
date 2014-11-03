package uk.ac.ic.wlgitbridge.application;

import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import uk.ac.ic.wlgitbridge.git.WLGitServlet;
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;

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

    /**
     * Constructs an instance of the server.
     * @param port the port number to listen on
     * @param rootGitDirectoryPath the root directory path containing the git repositories
     * @throws ServletException if the servlet throws an exception
     */
    public WLGitBridgeServer(final int port, String rootGitDirectoryPath) throws ServletException, InvalidRootDirectoryPathException {
        this.port = port;
        jettyServer = new Server(port);
        configureJettyServer(rootGitDirectoryPath);
    }

    /**
     * Starts the server on the port given on construction.
     */
    public void start() {
        try {
            jettyServer.start();
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

    private void configureJettyServer(String rootGitDirectoryPath) throws ServletException, InvalidRootDirectoryPathException {
        final ServletContextHandler servletContextHandler = new ServletContextHandler(ServletContextHandler.SESSIONS);
        servletContextHandler.setContextPath("/");
        servletContextHandler.addServlet(
                new ServletHolder(
                        new WLGitServlet(servletContextHandler,rootGitDirectoryPath)),
                "/*"
        );
        jettyServer.setHandler(servletContextHandler);
    }

}
