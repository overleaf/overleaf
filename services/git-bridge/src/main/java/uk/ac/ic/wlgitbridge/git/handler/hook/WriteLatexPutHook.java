package uk.ac.ic.wlgitbridge.git.handler.hook;

import com.google.api.client.auth.oauth2.Credential;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.transport.PreReceiveHook;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceiveCommand.Result;
import org.eclipse.jgit.transport.ReceivePack;
import uk.ac.ic.wlgitbridge.bridge.BridgeAPI;
import uk.ac.ic.wlgitbridge.data.filestore.RawDirectory;
import uk.ac.ic.wlgitbridge.git.handler.hook.exception.ForcedPushException;
import uk.ac.ic.wlgitbridge.git.handler.hook.exception.WrongBranchException;
import uk.ac.ic.wlgitbridge.git.util.RepositoryObjectTreeWalker;
import uk.ac.ic.wlgitbridge.snapshot.base.ForbiddenException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.InternalErrorException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.OutOfDateException;
import uk.ac.ic.wlgitbridge.snapshot.push.exception.SnapshotPostException;
import uk.ac.ic.wlgitbridge.util.Log;

import java.io.IOException;
import java.util.Collection;
import java.util.Iterator;

/**
 * Created by Winston on 03/11/14.
 */
public class WriteLatexPutHook implements PreReceiveHook {

    private final BridgeAPI bridgeAPI;
    private final String hostname;
    private final Credential oauth2;

    public WriteLatexPutHook(BridgeAPI bridgeAPI, String hostname, Credential oauth2) {
        this.bridgeAPI = bridgeAPI;
        this.hostname = hostname;
        this.oauth2 = oauth2;
    }

    @Override
    public void onPreReceive(ReceivePack receivePack, Collection<ReceiveCommand> receiveCommands) {
        for (ReceiveCommand receiveCommand : receiveCommands) {
            try {
                handleReceiveCommand(oauth2, receivePack.getRepository(), receiveCommand);
            } catch (IOException e) {
                receivePack.sendError(e.getMessage());
                receiveCommand.setResult(Result.REJECTED_OTHER_REASON, e.getMessage());
            } catch (OutOfDateException e) {
                receiveCommand.setResult(Result.REJECTED_NONFASTFORWARD);
            } catch (SnapshotPostException e) {
                handleSnapshotPostException(receivePack, receiveCommand, e);
            } catch (Throwable t) {
                Log.warn("Throwable on pre receive: ", t);
                handleSnapshotPostException(receivePack, receiveCommand, new InternalErrorException());
            }
        }
    }

    private void handleSnapshotPostException(ReceivePack receivePack, ReceiveCommand receiveCommand, SnapshotPostException e) {
        String message = e.getMessage();
        receivePack.sendError(message);
        StringBuilder msg = new StringBuilder();
        for (Iterator<String> it = e.getDescriptionLines().iterator(); it.hasNext();) {
            String line = it.next();
            msg.append("hint: ");
            msg.append(line);
            if (it.hasNext()) {
                msg.append('\n');
            }
        }
        receivePack.sendMessage("");
        receivePack.sendMessage(msg.toString());
        receiveCommand.setResult(Result.REJECTED_OTHER_REASON, message);
    }

    private void handleReceiveCommand(Credential oauth2, Repository repository, ReceiveCommand receiveCommand) throws IOException, SnapshotPostException, ForbiddenException {
        checkBranch(receiveCommand);
        checkForcedPush(receiveCommand);
        bridgeAPI.putDirectoryContentsToProjectWithName(
                oauth2,
                repository.getWorkTree().getName(),
                getPushedDirectoryContents(repository,
                        receiveCommand),
                getOldDirectoryContents(repository),
                hostname
        );
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

    private RawDirectory getPushedDirectoryContents(Repository repository, ReceiveCommand receiveCommand) throws IOException, SnapshotPostException {
        return new RepositoryObjectTreeWalker(repository,
                                              receiveCommand.getNewId())
               .getDirectoryContents();
    }

    private RawDirectory getOldDirectoryContents(Repository repository) throws IOException, SnapshotPostException {
        return new RepositoryObjectTreeWalker(repository).getDirectoryContents();
    }

}
