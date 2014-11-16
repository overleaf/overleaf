package uk.ac.ic.wlgitbridge.git.handler.hook;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.PreReceiveHook;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceivePack;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.git.handler.hook.exception.ForcedPushException;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.writelatex.OutOfDateException;
import uk.ac.ic.wlgitbridge.writelatex.SnapshotPostException;

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
                handleReceiveCommand(receivePack.getRepository(), receiveCommand);
            } catch (IOException e) {
                receivePack.sendError("IOException");
                receiveCommand.setResult(ReceiveCommand.Result.REJECTED_OTHER_REASON, "I/O Exception");
            } catch (OutOfDateException e) {
                receiveCommand.setResult(ReceiveCommand.Result.REJECTED_NONFASTFORWARD);
            } catch (SnapshotPostException e) {
                String message = e.getMessage();
                receivePack.sendError(message);
                for (String line : e.getDescriptionLines()) {
                    receivePack.sendMessage("hint: " + line);
                }
                receiveCommand.setResult(ReceiveCommand.Result.REJECTED_OTHER_REASON, message);
            }
        }
    }

    private void handleReceiveCommand(Repository repository, ReceiveCommand receiveCommand) throws ForcedPushException, IOException, SnapshotPostException {
        checkForcedPush(receiveCommand);
        writeLatexDataSource.putDirectoryContentsToProjectWithName(repository.getWorkTree().getName(),
                                                                   getPushedDirectoryContents(repository,
                                                                                              receiveCommand));
    }

    private void checkForcedPush(ReceiveCommand receiveCommand) throws ForcedPushException {
        if (receiveCommand.getType() == ReceiveCommand.Type.UPDATE_NONFASTFORWARD) {
            throw new ForcedPushException();
        }
    }

    private RawDirectoryContents getPushedDirectoryContents(Repository repository, ReceiveCommand receiveCommand) throws IOException {
        return new RepositoryObjectTreeWalker(repository,
                                              receiveCommand.getNewId())
               .getDirectoryContents();
    }

}
