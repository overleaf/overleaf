package uk.ac.ic.wlgitbridge.git.handler.hook;

import org.eclipse.jgit.lib.RefUpdate.Result;
import org.eclipse.jgit.transport.PreReceiveHook;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceivePack;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.git.handler.hook.exception.ForcedPushException;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;

import java.io.IOException;
import java.util.Collection;

/**
 * Created by Winston on 03/11/14.
 */
public class WriteLatexPutHook implements PreReceiveHook {

    private final WriteLatexDataSource writeLatexDataSource;

    public WriteLatexPutHook(WriteLatexDataSource writeLatexDataSource) {
        this.writeLatexDataSource = writeLatexDataSource;
    }

    @Override
    public void onPreReceive(ReceivePack receivePack, Collection<ReceiveCommand> receiveCommands) {
        for (ReceiveCommand receiveCommand : receiveCommands) {
            try {
                handleReceiveCommand(receivePack, receiveCommand);
            } catch (ForcedPushException e) {
                receivePack.sendError("You can't do a force push");
                receiveCommand.setResult(Result.REJECTED);
            } catch (IOException e) {
                receivePack.sendError("IOException");
                receiveCommand.setResult(Result.REJECTED);
            }
        }
    }

    private void handleReceiveCommand(ReceivePack receivePack, ReceiveCommand receiveCommand) throws ForcedPushException, IOException {
        checkForcedPush(receiveCommand);
        RawDirectoryContents directoryContents = getPushedDirectoryContents(receivePack, receiveCommand);
    }

    private void checkForcedPush(ReceiveCommand receiveCommand) throws ForcedPushException {
        if (receiveCommand.getType() == ReceiveCommand.Type.UPDATE_NONFASTFORWARD) {
            throw new ForcedPushException();
        }
    }

    private RawDirectoryContents getPushedDirectoryContents(ReceivePack receivePack, ReceiveCommand receiveCommand) throws IOException {
        return new RepositoryObjectTreeWalker(receivePack.getRepository(),
                receiveCommand.getNewId())
                .getDirectoryContents();
    }

}
