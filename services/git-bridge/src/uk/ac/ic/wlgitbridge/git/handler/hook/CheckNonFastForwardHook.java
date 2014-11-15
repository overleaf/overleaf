package uk.ac.ic.wlgitbridge.git.handler.hook;

import org.eclipse.jgit.lib.RefUpdate;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.transport.PreReceiveHook;
import org.eclipse.jgit.transport.ReceiveCommand;
import org.eclipse.jgit.transport.ReceivePack;
import org.eclipse.jgit.treewalk.TreeWalk;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Collection;

/**
 * Created by Winston on 03/11/14.
 */
public class CheckNonFastForwardHook implements PreReceiveHook {

    @Override
    public void onPreReceive(ReceivePack receivePack, Collection<ReceiveCommand> receiveCommands) {
        for (ReceiveCommand receiveCommand : receiveCommands) {
            receiveCommand.setResult(RefUpdate.Result.REJECTED);
            System.out.println(receiveCommand.getRef());
            try {

                // a RevWalk allows to walk over commits based on some filtering that is
                // defined
                RevWalk walk = new RevWalk(receivePack.getRepository());

                RevCommit commit = walk.parseCommit(receiveCommand.getNewId());
                RevTree tree = commit.getTree();
                System.out.println("Having tree: " + tree);

                // now use a TreeWalk to iterate over all files in the Tree recursively
                // you can set Filters to narrow down the results if needed
                TreeWalk treeWalk = new TreeWalk(receivePack.getRepository());
                treeWalk.addTree(tree);
                treeWalk.setRecursive(true);
                while (treeWalk.next()) {
                    File file = new File("/Users/Roxy/git/testing/" + treeWalk.getPathString());
                    file.getParentFile().mkdirs();
                    FileOutputStream out = new FileOutputStream(file);
                    receivePack.getRepository().open(treeWalk.getObjectId(0)).copyTo(out);

                }
            } catch (IOException e) {
                e.printStackTrace();
            }
            if (receiveCommand.getType() == ReceiveCommand.Type.UPDATE_NONFASTFORWARD) {
                receivePack.sendError("You can't do a force push");
                receiveCommand.setResult(RefUpdate.Result.REJECTED);
            }
        }
        System.out.println("Pre receive");
    }

}
