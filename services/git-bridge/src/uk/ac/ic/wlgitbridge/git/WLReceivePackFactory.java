package uk.ac.ic.wlgitbridge.git;

import org.eclipse.jgit.lib.RefUpdate;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.PreReceiveHook;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.transport.resolver.ReceivePackFactory;
import org.eclipse.jgit.transport.resolver.ServiceNotAuthorizedException;
import org.eclipse.jgit.transport.resolver.ServiceNotEnabledException;

import javax.servlet.http.HttpServletRequest;
import java.util.Collection;

/**
 * Created by Winston on 02/11/14.
 */
public class WLReceivePackFactory implements ReceivePackFactory<HttpServletRequest> {

    @Override
    public ReceivePack create(HttpServletRequest httpServletRequest, Repository repository) throws ServiceNotEnabledException, ServiceNotAuthorizedException {
        ReceivePack receivePack = new ReceivePack(repository);
        receivePack.setPreReceiveHook(new PreReceiveHook() {
            @Override
            public void onPreReceive(ReceivePack receivePack, Collection<ReceiveCommand> receiveCommands) {
                System.out.println("Size: " + receiveCommands.size());
                for (ReceiveCommand receiveCommand : receiveCommands) {
                    System.out.println(receiveCommand);
                    System.out.println(receiveCommand.getMessage());
                    System.out.println(receiveCommand.getType());
                    System.out.println(receiveCommand.getResult());
                    System.out.println(receiveCommand.getRefName());
                    receiveCommand.setResult(RefUpdate.Result.REJECTED);
                }
                receivePack.sendError("hello this is not a fast forward");
            }
        });
        return receivePack;
    }

}
