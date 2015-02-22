package uk.ac.ic.wlgitbridge.git.handler.hook;

import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.PreReceiveHook;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceiveCommand.Result;
import org.eclipse.jgit.transport.ReceivePack;
import uk.ac.ic.wlgitbridge.bridge.BridgeAPI;
import uk.ac.ic.wlgitbridge.git.handler.hook.exception.ForcedPushException;
import uk.ac.ic.wlgitbridge.git.handler.hook.exception.WrongBranchException;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.snapshot.exception.FailedConnectionException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InternalErrorException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.OutOfDateException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.util.Util;

import java.io.IOException;
import java.util.Collection;

/**
 * Created by Winston on 03/11/14.
 */
public class WriteLatexPutHook implements PreReceiveHook {

    private final BridgeAPI bridgeAPI;
    private final String hostname;

    public WriteLatexPutHook(BridgeAPI bridgeAPI, String hostname) {
        this.bridgeAPI = bridgeAPI;
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
                Util.printStackTrace(t);
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
        bridgeAPI.putDirectoryContentsToProjectWithName(repository.getWorkTree().getName(),
                getPushedDirectoryContents(repository,
                        receiveCommand),
                getOldDirectoryContents(repository),
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

    private RawDirectory getPushedDirectoryContents(Repository repository, ReceiveCommand receiveCommand) throws IOException {
        return new RepositoryObjectTreeWalker(repository,
                                              receiveCommand.getNewId())
               .getDirectoryContents();
    }

    private RawDirectory getOldDirectoryContents(Repository repository) throws IOException {
        return new RepositoryObjectTreeWalker(repository).getDirectoryContents();
    }

}
