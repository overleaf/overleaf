package uk.ac.ic.wlgitbridge.git.handler;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.resolver.ReceivePackFactory;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.git.handler.hook.WriteLatexPutHook;

import javax.servlet.http.HttpServletRequest;

/**
 * Created by Winston on 02/11/14.
 */
/* */
public class WLReceivePackFactory implements ReceivePackFactory<HttpServletRequest> {

    private final WriteLatexDataSource writeLatexDataSource;

    public WLReceivePackFactory(WriteLatexDataSource writeLatexDataSource) {
        this.writeLatexDataSource = writeLatexDataSource;
    }

    @Override
    public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
        ReceivePack receivePack = new ReceivePack(repository);
        receivePack.setPreReceiveHook(new WriteLatexPutHook(writeLatexDataSource, httpServletRequest.getLocalName()));
        return receivePack;
    }

}
