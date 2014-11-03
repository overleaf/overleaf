package uk.ac.ic.wlgitbridge.git.handler.hook;

import org.eclipse.jgit.lib.RefUpdate;
import org.eclipse.jgit.transport.PreReceiveHook;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceivePack;

import java.util.Collection;

/**
 * Created by Winston on 03/11/14.
 */
public class CheckNonFastForwardHook implements PreReceiveHook {

    @Override
    public void onPreReceive(ReceivePack receivePack, Collection<ReceiveCommand> receiveCommands) {
        for (ReceiveCommand receiveCommand : receiveCommands) {
            if (receiveCommand.getType() == ReceiveCommand.Type.UPDATE_NONFASTFORWARD) {
                receivePack.sendError("You can't do a force push");
                receiveCommand.setResult(RefUpdate.Result.REJECTED);
            }
        }
    }

}
