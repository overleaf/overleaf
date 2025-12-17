package uk.ac.ic.wlgitbridge.git.handler;

import com.google.api.client.auth.oauth2.Credential;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.resolver.ReceivePackFactory;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.bridge.repo.RepoStore;
import uk.ac.ic.wlgitbridge.git.handler.hook.WriteLatexPutHook;
import uk.ac.ic.wlgitbridge.server.Oauth2Filter;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 02/11/14.
 */
/*
 * One of the "big three" interfaces created by {@link WLGitServlet} to handle
 * user Git requests.
 *
 * This class just puts a {@link WriteLatexPutHook} into the {@link ReceivePack}
 * that it returns.
 */
public class WLReceivePackFactory implements ReceivePackFactory<HttpServletRequest> {

  private final RepoStore repoStore;

  private final Bridge bridge;

  public WLReceivePackFactory(RepoStore repoStore, Bridge bridge) {
    this.repoStore = repoStore;
    this.bridge = bridge;
  }

  /*
   * Puts a {@link WriteLatexPutHook} into the returned {@link ReceivePack}.
   *
   * The {@link WriteLatexPutHook} needs our hostname, which we get from the
   * original {@link HttpServletRequest}, used to provide a postback URL to
   * the {@link SnapshotApi}. We also give it the oauth2 that we injected in
   * the {@link Oauth2Filter}, and the {@link Bridge}.
   *
   * At this point, the repository will have been synced to the latest on
   * Overleaf, but it's possible that an update happens on Overleaf while our
   * put hook is running. In this case, we fail, and the user tries again,
   * triggering another sync, and so on.
   * @param httpServletRequest the original request
   * @param repository the JGit {@link Repository} provided by
   * {@link WLRepositoryResolver}
   * @return a correctly hooked {@link ReceivePack}
   */
  @Override
  public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) {
    Log.debug("[{}] Creating receive-pack", repository.getWorkTree().getName());
    Optional<Credential> oauth2 =
        Optional.ofNullable(
            (Credential) httpServletRequest.getAttribute(Oauth2Filter.ATTRIBUTE_KEY));
    ReceivePack receivePack = new ReceivePack(repository);
    String hostname = Util.getPostbackURL();
    if (hostname == null) {
      hostname = httpServletRequest.getLocalName();
    }
    receivePack.setPreReceiveHook(new WriteLatexPutHook(repoStore, bridge, hostname, oauth2));
    return receivePack;
  }
}
