package uk.ac.ic.wlgitbridge.git.handler;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.resolver.ReceivePackFactory;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.git.handler.hook.CheckNonFastForwardHook;
import uk.ac.ic.wlgitbridge.writelatex.api.SnapshotDBAPI;

import javax.servlet.http.HttpServletRequest;

/**
 * Created by Winston on 02/11/14.
 */
/* */
public class WLReceivePackFactory implements ReceivePackFactory<HttpServletRequest> {

    public WLReceivePackFactory(SnapshotDBAPI snapshotDBAPI) {

    }

    @Override
    public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
        ReceivePack receivePack = new ReceivePack(repository);
        receivePack.setPreReceiveHook(new CheckNonFastForwardHook());
        return receivePack;
    }

}
