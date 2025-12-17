package uk.ac.ic.wlgitbridge.git.handler;

import com.google.api.client.auth.oauth2.Credential;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.Optional;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import org.eclipse.jgit.transport.resolver.RepositoryResolver;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.data.CannotAcquireLockException;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.server.Oauth2Filter;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

/*
 * Created by Winston on 02/11/14.
 */
/*
 * One of the "big three" interfaces created by {@link WLGitServlet} to handle
 * user Git requests.
 *
 * This class is used by all Git requests to resolve a project name to a
 * JGit {@link Repository}, or fail by throwing an exception.
 *
 * It has a single method, {@link #open(HttpServletRequest, String)}, which
 * calls into the {@link Bridge} to synchronise the project with Overleaf, i.e.
 * bringing it onto disk and applying commits to it until it is up-to-date with
 * Overleaf.
 */
public class WLRepositoryResolver implements RepositoryResolver<HttpServletRequest> {

  private final Bridge bridge;

  public WLRepositoryResolver(Bridge bridge) {
    this.bridge = bridge;
  }

  /*
   * Calls into the Bridge to resolve a project name to a JGit
   * {@link Repository}, or throw an exception.
   *
   * On success, the repository will have been brought onto disk and updated
   * to the latest (synced).
   *
   * In the case of clones and fetches, upload packs are created from the
   * returned JGit {@link Repository} by the {@link WLUploadPackFactory}.
   *
   * The project lock is acquired for this process so it can't be swapped out.
   *
   * However, it can still be swapped out between this and a Git push. The
   * push would fail due to the project changed on Overleaf between the sync
   * and the actual push to Overleaf (performed by the
   * {@link WLReceivePackFactory} and {@link WriteLatexPutHook}. In this case,
   * the user will have to try again (which prompts another update, etc. until
   * this no longer happens).
   * @param httpServletRequest The HttpServletRequest as required by the
   * interface. We injected the oauth2 creds into it with
   * {@link Oauth2Filter}, which was set up by the {@link GitBridgeServer}.
   * @param name The name of the project
   * @return the JGit {@link Repository}.
   * @throws RepositoryNotFoundException If the project does not exist
   * @throws ServiceNotAuthorizedException If the user did not auth when
   * required to
   * @throws ServiceMayNotContinueException If any other general user
   * exception occurs that must be propogated back to the user, e.g.
   * internal errors (IOException, etc), too large file, and so on.
   */
  @Override
  public Repository open(HttpServletRequest httpServletRequest, String name)
      throws RepositoryNotFoundException,
          ServiceNotAuthorizedException,
          ServiceMayNotContinueException {
    Log.debug("[{}] Request to open git repo", name);
    Optional<Credential> oauth2 =
        Optional.ofNullable(
            (Credential) httpServletRequest.getAttribute(Oauth2Filter.ATTRIBUTE_KEY));
    String projName = Util.removeAllSuffixes(name, "/", ".git");
    try {
      return bridge.getUpdatedRepo(oauth2, projName).getJGitRepository();
    } catch (RepositoryNotFoundException e) {
      Log.warn("Repository not found: " + name);
      throw e;
      /*
      } catch (ServiceNotAuthorizedException e) {
          cannot occur
      } catch (ServiceNotEnabledException e) {
          cannot occur
          */
    } catch (ServiceMayNotContinueException e) {
      /* Such as FailedConnectionException */
      throw e;
    } catch (CannotAcquireLockException e) {
      throw new ServiceMayNotContinueException(e.getMessage());
    } catch (RuntimeException e) {
      Log.warn("Runtime exception when trying to open repo: " + projName, e);
      throw new ServiceMayNotContinueException(e);
    } catch (ForbiddenException e) {
      throw new ServiceNotAuthorizedException();
    } catch (GitUserException e) {
      throw new ServiceMayNotContinueException(
          e.getMessage() + "\n" + String.join("\n", e.getDescriptionLines()), e);
    } catch (IOException e) {
      Log.warn("IOException when trying to open repo: " + projName, e);
      throw new ServiceMayNotContinueException("Internal server error.");
    }
  }
}
