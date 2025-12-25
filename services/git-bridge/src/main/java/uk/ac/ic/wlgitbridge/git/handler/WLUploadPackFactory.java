package uk.ac.ic.wlgitbridge.git.handler;

import jakarta.servlet.http.HttpServletRequest;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.UploadPack;
import org.eclipse.jgit.transport.resolver.UploadPackFactory;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 02/11/14.
 */
/*
 * One of the "big three" interfaces created by {@link WLGitServlet} to handle
 * user Git requests.
 *
 * The actual class doesn't do much, and most of the work is done when the
 * project name is being resolved by the {@link WLRepositoryResolver}.
 */
public class WLUploadPackFactory implements UploadPackFactory<HttpServletRequest> {

  /*
   * This does nothing special. Synchronising the project with Overleaf will
   * have been performed by {@link WLRepositoryResolver}.
   * @param __ Not used, required by the {@link UploadPackFactory} interface
   * @param repository The JGit repository provided by the
   * {@link WLRepositoryResolver}
   * @return the {@link UploadPack}, used by JGit to serve the request
   */
  @Override
  public UploadPack create(HttpServletRequest __, Repository repository) {
    Log.debug("[{}] Creating upload-pack", repository.getWorkTree().getName());
    return new UploadPack(repository);
  }
}
