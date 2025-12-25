package uk.ac.ic.wlgitbridge.git.servlet;

import jakarta.servlet.ServletException;
import org.eclipse.jetty.ee10.servlet.ServletContextHandler;
import org.eclipse.jgit.http.server.GitServlet;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.git.handler.WLReceivePackFactory;
import uk.ac.ic.wlgitbridge.git.handler.WLRepositoryResolver;
import uk.ac.ic.wlgitbridge.git.handler.WLUploadPackFactory;

/*
 * Created by Winston on 02/11/14.
 */
/*
 * This is the Servlet created by the {@link GitBridgeServer} that does all of
 * the work in handling user Git requests and directing them to the
 * {@link Bridge}.
 *
 * The {@link GitServlet} does all of the Git work, and these main three
 * interfaces do all of the Git Bridge work:
 *
 * @see WLRepositoryResolver
 * @see WLReceivePackFactory
 * @see WLUploadPackFactory
 */
public class WLGitServlet extends GitServlet {

  /*
   * Constructor that sets all of the resolvers and factories for the
   * {@link GitServlet}.
   *
   * Also needs to call init with a config ({@link WLGitServletConfig}, as
   * required by the {@link GitServlet}.
   * @param ctxHandler
   * @param bridge
   * @throws ServletException
   */
  public WLGitServlet(ServletContextHandler ctxHandler, RepoStore repoStore, Bridge bridge)
      throws ServletException {
    setRepositoryResolver(new WLRepositoryResolver(bridge));
    setReceivePackFactory(new WLReceivePackFactory(repoStore, bridge));
    setUploadPackFactory(new WLUploadPackFactory());
    init(new WLGitServletConfig(ctxHandler));
  }
}
