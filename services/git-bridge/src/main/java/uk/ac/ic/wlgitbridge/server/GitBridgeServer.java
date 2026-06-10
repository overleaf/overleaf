package uk.ac.ic.wlgitbridge.server;

import ch.qos.logback.classic.Level;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.Filter;
import jakarta.servlet.ServletException;
import java.io.File;
import java.net.BindException;
import java.nio.file.Paths;
import java.util.EnumSet;
import org.eclipse.jetty.ee10.servlet.FilterHolder;
import org.eclipse.jetty.ee10.servlet.ServletContextHandler;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.eclipse.jetty.ee10.servlet.SessionHandler;
import org.eclipse.jetty.server.Handler;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.eclipse.jetty.server.handler.ContextHandler;
import org.eclipse.jetty.server.handler.DefaultHandler;
import org.eclipse.jetty.util.resource.ResourceFactory;
import uk.ac.ic.wlgitbridge.application.config.Config;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.bridge.db.DBStore;
import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SqliteDBStore;
import uk.ac.ic.wlgitbridge.bridge.repo.FSGitRepoStore;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStoreConfig;
import uk.ac.ic.wlgitbridge.bridge.snapshot.NetSnapshotApi;
import uk.ac.ic.wlgitbridge.bridge.snapshot.SnapshotApi;
import uk.ac.ic.wlgitbridge.bridge.swap.store.SwapStore;
import uk.ac.ic.wlgitbridge.git.servlet.WLGitServlet;
import uk.ac.ic.wlgitbridge.snapshot.base.SnapshotAPIRequest;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 02/11/14.
 */

/*
 * Class for the actual server.
 */
public class GitBridgeServer {

  private final Bridge bridge;

  private final Server jettyServer;

  private final GceMetadataLogLevelChecker logLevelChecker;

  private ServerConnector connector;

  private final int port;
  private final String bindIp;
  private String rootGitDirectoryPath;
  private String apiBaseURL;

  public GitBridgeServer(Config config) throws ServletException {
    this.port = config.getPort();
    this.bindIp = config.getBindIp();
    this.rootGitDirectoryPath = config.getRootGitDirectory();
    RepoStore repoStore =
        new FSGitRepoStore(
            rootGitDirectoryPath, config.getRepoStore().flatMap(RepoStoreConfig::getMaxFileSize));
    DBStore dbStore =
        new SqliteDBStore(
            Paths.get(repoStore.getRootDirectory().getAbsolutePath())
                .resolve(".wlgb")
                .resolve("wlgb.db")
                .toFile(),
            config.getSqliteHeapLimitBytes());
    SwapStore swapStore = SwapStore.fromConfig(config.getSwapStore());
    SnapshotApi snapshotApi = new NetSnapshotApi();
    bridge = Bridge.make(config, repoStore, dbStore, swapStore, snapshotApi);
    jettyServer = new Server();
    configureJettyServer(config, repoStore, snapshotApi);
    apiBaseURL = config.getAPIBaseURL();
    SnapshotAPIRequest.setBaseURL(apiBaseURL);
    Util.setServiceName(config.getServiceName());
    Util.setPostbackURL(config.getPostbackURL());
    Util.setPort(config.getPort());
    String configuredLogLevel = System.getenv().getOrDefault("LOG_LEVEL", "INFO");
    String normalizedLogLevel =
        "WARNING".equalsIgnoreCase(configuredLogLevel) ? "WARN" : configuredLogLevel;
    Level defaultLogLevel = Level.toLevel(normalizedLogLevel, Level.INFO);
    logLevelChecker = new GceMetadataLogLevelChecker(config.getServiceName(), defaultLogLevel);
  }

  /*
   * Starts the server on the port given on construction.
   */
  public void start() {
    try {
      bridge.checkDB();
      jettyServer.start();
      // Only the integration tests configure port 0, which lets the OS assign a free
      // port at bind time. Production always configures an explicit non-zero port, so
      // this branch never runs there.
      if (port == 0) {
        int actualPort = connector.getLocalPort();
        String postbackURL = "http://" + bindIp + ":" + actualPort + "/";
        Util.setPostbackURL(postbackURL);
      }
      bridge.startBackgroundJobs();
      logLevelChecker.start();
      Log.info(Util.getServiceName() + "-Git Bridge server started");
      Log.info("Listening on port: " + getPort());
      Log.info("Bridged to: " + apiBaseURL);
      Log.info("Postback base URL: " + Util.getPostbackURL());
      Log.info("Root git directory path: " + rootGitDirectoryPath);
    } catch (BindException e) {
      Log.error("Failed to bind Jetty", e);
    } catch (Exception e) {
      Log.error("Failed to start Jetty", e);
    }
  }

  public int getPort() {
    return connector.getLocalPort();
  }

  public void stop() {
    logLevelChecker.stop();
    try {
      jettyServer.stop();
    } catch (Exception e) {
      Log.error("Failed to stop Jetty", e);
    }
  }

  private void configureJettyServer(Config config, RepoStore repoStore, SnapshotApi snapshotApi)
      throws ServletException {
    this.connector = new ServerConnector(this.jettyServer);
    connector.setPort(config.getPort());
    connector.setHost(config.getBindIp());
    connector.setIdleTimeout(config.getIdleTimeout());
    this.jettyServer.addConnector(connector);

    Handler.Sequence handlers = new Handler.Sequence();
    handlers.addHandler(new CORSHandler(config.getAllowedCorsOrigins()));
    handlers.addHandler(initApiHandler());
    handlers.addHandler(initBaseHandler());
    handlers.addHandler(initGitHandler(config, repoStore, snapshotApi));
    jettyServer.setHandler(handlers);
  }

  private Handler initBaseHandler() {
    ContextHandler base = new ContextHandler();
    base.setContextPath("/");
    Handler.Sequence handlers = new Handler.Sequence();
    handlers.addHandler(new StatusHandler(bridge));
    handlers.addHandler(new HealthCheckHandler(bridge));
    handlers.addHandler(new GitLfsHandler(bridge));
    handlers.addHandler(new PrometheusHandler());
    handlers.addHandler(new DiagnosticsHandler());
    base.setHandler(handlers);
    return base;
  }

  private Handler initApiHandler() {
    ContextHandler api = new ContextHandler();
    api.setContextPath("/api");

    Handler.Sequence handlers = new Handler.Sequence();
    handlers.addHandler(initResourceHandler());
    handlers.addHandler(new PostbackHandler(bridge));
    handlers.addHandler(new ProjectDeletionHandler(bridge));
    handlers.addHandler(new DefaultHandler());

    api.setHandler(handlers);

    ProductionErrorHandler errorHandler = new ProductionErrorHandler();
    api.setErrorHandler(errorHandler);
    return api;
  }

  private Handler initGitHandler(Config config, RepoStore repoStore, SnapshotApi snapshotApi)
      throws ServletException {
    final ServletContextHandler servletContextHandler = new ServletContextHandler();
    servletContextHandler.setSessionHandler(new SessionHandler());
    servletContextHandler.addFilter(
        new FilterHolder(new MdcLoggingFilter()), "/*", EnumSet.of(DispatcherType.REQUEST));
    if (config.getOauth2Server() != null) {
      Filter filter =
          new Oauth2Filter(snapshotApi, config.getOauth2Server(), config.isUserPasswordEnabled());
      servletContextHandler.addFilter(
          new FilterHolder(filter), "/*", EnumSet.of(DispatcherType.REQUEST));
    }
    servletContextHandler.setContextPath("/");
    servletContextHandler.addServlet(
        new ServletHolder(new WLGitServlet(servletContextHandler, repoStore, bridge)), "/*");
    ProductionErrorHandler errorHandler = new ProductionErrorHandler();
    servletContextHandler.setErrorHandler(errorHandler);
    return servletContextHandler;
  }

  private Handler initResourceHandler() {
    FileHandler resourceHandler = new FileHandler(bridge);
    File attDir = new File(rootGitDirectoryPath, ".wlgb/atts");
    resourceHandler.setBaseResource(
        ResourceFactory.of(resourceHandler).newResource(attDir.toPath()));
    return resourceHandler;
  }
}
