package uk.ac.ic.wlgitbridge.application;

import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.handler.HandlerCollection;
import org.eclipse.jetty.server.handler.ResourceHandler;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.util.log.Log;
import uk.ac.ic.wlgitbridge.application.jetty.NullLogger;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;
import uk.ac.ic.wlgitbridge.git.servlet.WLGitServlet;
import uk.ac.ic.wlgitbridge.util.Util;
import uk.ac.ic.wlgitbridge.writelatex.WriteLatexAPI;
import uk.ac.ic.wlgitbridge.writelatex.api.request.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.writelatex.model.WLDataModel;

import javax.servlet.ServletException;
import java.io.File;
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
    private String writeLatexHostname;

    /**
     * Constructs an instance of the server.
     * @param port the port number to listen on
     * @param rootGitDirectoryPath the root directory path containing the git repositories
     * @param apiKey
     * @throws ServletException if the servlet throws an exception
     */
    private WLGitBridgeServer(final int port, String rootGitDirectoryPath, String apiKey) throws ServletException, InvalidRootDirectoryPathException {
        this.port = port;
        this.rootGitDirectoryPath = rootGitDirectoryPath;
        Log.setLog(new NullLogger());
        jettyServer = new Server(port);
        configureJettyServer();
    }

    public WLGitBridgeServer(Config config) throws ServletException, InvalidRootDirectoryPathException {
        this(config.getPort(), config.getRootGitDirectory(), config.getAPIKey());
        SnapshotAPIRequest.setBasicAuth(config.getUsername(), config.getPassword());
        writeLatexHostname = config.getAPIBaseURL();
        SnapshotAPIRequest.setBaseURL(writeLatexHostname);
        Util.setServiceName(config.getServiceName());
    }

    /**
     * Starts the server on the port given on construction.
     */
    public void start() {
        try {
            jettyServer.start();
            System.out.println();
            System.out.println("WriteLatex-Git Bridge server started");
            System.out.println("Listening on port: " + port);
            System.out.println("Bridged to: " + writeLatexHostname);
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
        HandlerCollection handlers = new HandlerCollection();
        WriteLatexAPI writeLatexDataSource = new WriteLatexAPI(new WLDataModel(rootGitDirectoryPath));
        handlers.setHandlers(new Handler[] {
                initResourceHandler(writeLatexDataSource),
                new SnapshotPushPostbackHandler(writeLatexDataSource),
                initGitHandler(writeLatexDataSource)
        });
        jettyServer.setHandler(handlers);
    }

    private Handler initGitHandler(WriteLatexDataSource writeLatexDataSource) throws ServletException, InvalidRootDirectoryPathException {
        final ServletContextHandler servletContextHandler = new ServletContextHandler(ServletContextHandler.SESSIONS);
        servletContextHandler.setContextPath("/");
        servletContextHandler.addServlet(
                new ServletHolder(
                        new WLGitServlet(servletContextHandler, writeLatexDataSource, rootGitDirectoryPath)),
                "/*"
        );
        return servletContextHandler;
    }

    private Handler initResourceHandler(WriteLatexAPI writeLatexDataSource) {
        ResourceHandler resourceHandler = new AttsResourceHandler(writeLatexDataSource);
        resourceHandler.setResourceBase(new File(rootGitDirectoryPath, ".wlgb/atts").getAbsolutePath());
        return resourceHandler;
    }

}
