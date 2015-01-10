package uk.ac.ic.wlgitbridge.git.handler.hook;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.PreReceiveHook;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceiveCommand.Result;
import org.eclipse.jgit.transport.ReceivePack;
import uk.ac.ic.wlgitbridge.bridge.RawDirectoryContents;
import uk.ac.ic.wlgitbridge.bridge.WriteLatexDataSource;
import uk.ac.ic.wlgitbridge.git.handler.hook.exception.ForcedPushException;
import uk.ac.ic.wlgitbridge.git.handler.hook.exception.WrongBranchException;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.writelatex.api.request.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.InternalErrorException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.OutOfDateException;
import uk.ac.ic.wlgitbridge.writelatex.api.request.push.exception.SnapshotPostException;

import java.io.IOException;
import java.util.Collection;

/**
 * Created by Winston on 03/11/14.
 */
public class WriteLatexPutHook implements PreReceiveHook {

    private final WriteLatexDataSource writeLatexDataSource;
    private final String hostname;

    public WriteLatexPutHook(WriteLatexDataSource writeLatexDataSource, String hostname) {
        this.writeLatexDataSource = writeLatexDataSource;
        this.hostname = hostname;
    }

    @Override
    public void onPreReceive(ReceivePack receivePack, Collection<ReceiveCommand> receiveCommands) {
        for (ReceiveCommand receiveCommand : receiveCommands) {
            try {
                handleReceiveCommand(receivePack.getRepository(), receiveCommand);
            } catch (IOException e) {
                receivePack.sendError(e.getMessage());
                receiveCommand.setResult(Result.REJECTED_OTHER_REASON, e.getMessage());
            } catch (OutOfDateException e) {
                receiveCommand.setResult(Result.REJECTED_NONFASTFORWARD);
            } catch (SnapshotPostException e) {
                handleSnapshotPostException(receivePack, receiveCommand, e);
            } catch (Throwable t) {
                t.printStackTrace();
                handleSnapshotPostException(receivePack, receiveCommand, new InternalErrorException());
            }
        }
    }

    private void handleSnapshotPostException(ReceivePack receivePack, ReceiveCommand receiveCommand, SnapshotPostException e) {
        String message = e.getMessage();
        receivePack.sendError(message);
        for (String line : e.getDescriptionLines()) {
            receivePack.sendMessage("hint: " + line);
        }
        receiveCommand.setResult(Result.REJECTED_OTHER_REASON, message);
    }

    private void handleReceiveCommand(Repository repository, ReceiveCommand receiveCommand) throws IOException, SnapshotPostException, FailedConnectionException {
        checkBranch(receiveCommand);
        checkForcedPush(receiveCommand);
        writeLatexDataSource.putDirectoryContentsToProjectWithName(repository.getWorkTree().getName(),
                getPushedDirectoryContents(repository,
                        receiveCommand),
                hostname);
    }

    private void checkBranch(ReceiveCommand receiveCommand) throws WrongBranchException {
        if (!receiveCommand.getRefName().equals("refs/heads/master")) {
            throw new WrongBranchException();
        }
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
