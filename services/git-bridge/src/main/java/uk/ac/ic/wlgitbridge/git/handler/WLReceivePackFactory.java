package uk.ac.ic.wlgitbridge.git.handler;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.resolver.ReceivePackFactory;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;
import uk.ac.ic.wlgitbridge.bridge.BridgeAPI;
import uk.ac.ic.wlgitbridge.git.handler.hook.WriteLatexPutHook;
import uk.ac.ic.wlgitbridge.util.Util;

import javax.servlet.http.HttpServletRequest;

/**
 * Created by Winston on 02/11/14.
 */
/* */
public class WLReceivePackFactory implements ReceivePackFactory<HttpServletRequest> {

    private final BridgeAPI bridgeAPI;

    public WLReceivePackFactory(BridgeAPI bridgeAPI) {
        this.bridgeAPI = bridgeAPI;
    }

    @Override
    public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
        ReceivePack receivePack = new ReceivePack(repository);
        String hostname = Util.getPostbackURL();
        if (hostname == null) {
            hostname = httpServletRequest.getLocalName();
        }
        receivePack.setPreReceiveHook(new WriteLatexPutHook(bridgeAPI, hostname));
        return receivePack;
    }

}
