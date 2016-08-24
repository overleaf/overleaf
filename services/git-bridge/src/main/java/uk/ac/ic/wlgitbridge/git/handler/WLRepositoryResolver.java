package uk.ac.ic.wlgitbridge.git.handler;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.errors.RepositoryNotFoundException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ServiceMayNotContinueException;
import org.eclipse.jgit.transport.resolver.RepositoryResolver;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.bridge.Bridge;
import uk.ac.ic.wlgitbridge.bridge.GitProjectRepo;
import uk.ac.ic.wlgitbridge.git.exception.GitUserException;
import uk.ac.ic.wlgitbridge.server.Oauth2Filter;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.util.Log;
import uk.ac.ic.wlgitbridge.util.Util;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLRepositoryResolver
        implements RepositoryResolver<HttpServletRequest> {

    private final Bridge bridge;

    public WLRepositoryResolver(Bridge bridge) {
        this.bridge = bridge;
    }

    @Override
    public Repository open(
            HttpServletRequest httpServletRequest,
            String name
    ) throws RepositoryNotFoundException,
             ServiceNotAuthorizedException,
             ServiceNotEnabledException,
             ServiceMayNotContinueException {
        Credential oauth2 = (Credential) httpServletRequest.getAttribute(
                Oauth2Filter.ATTRIBUTE_KEY
        );
        String projName = Util.removeAllSuffixes(name, "/", ".git");
        try {
            if (!bridge.projectExists(oauth2, projName)) {
                throw new RepositoryNotFoundException(projName);
            }
            GitProjectRepo repo = new GitProjectRepo(projName);
            bridge.updateRepository(oauth2, repo);
            return repo.getJGitRepository();
        } catch (RepositoryNotFoundException e) {
            Log.info("Repository not found: " + name);
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
        } catch (RuntimeException e) {
            Log.warn("Runtime exception when trying to open repo", e);
            throw new ServiceMayNotContinueException(e);
        } catch (ForbiddenException e) {
            throw new ServiceNotAuthorizedException();
        } catch (GitUserException e) {
            throw new ServiceMayNotContinueException(e.getMessage(), e);
        } catch (IOException e) {
            Log.warn("IOException when trying to open repo", e);
            throw new ServiceMayNotContinueException("Internal server error.");
        }
    }

}
