package uk.ac.ic.wlgitbridge.application;

import uk.ac.ic.wlgitbridge.application.exception.InvalidProgramArgumentsException;

import javax.servlet.ServletException;

/**
 * Created by Winston on 02/11/14.
 */
public class WLGitBridgeApplication {

    public static final int EXIT_CODE_FAILED = 1;
    private static final String USAGE_MESSAGE = "usage: writelatex-git-bridge port root_git_directory_path";

    private int port;
    private String rootGitDirectoryPath;

    public WLGitBridgeApplication(String[] args) {
        try {
            parseArguments(args);
        } catch (InvalidProgramArgumentsException e) {
            printUsage();
            System.exit(EXIT_CODE_FAILED);
        }
    }

    public void run() {
        try {
            new WLGitBridgeServer(port, rootGitDirectoryPath).start();
        } catch (ServletException e) {
            e.printStackTrace();
        }
    }

    private void parseArguments(String[] args) throws InvalidProgramArgumentsException {
        checkArgumentsLength(args);
        parsePortNumber(args);
        parseRootGitDirectoryPath(args);
    }

    private void checkArgumentsLength(String[] args) throws InvalidProgramArgumentsException {
        if (args.length < 2) {
            throw new InvalidProgramArgumentsException();
        }
    }

    private void parsePortNumber(String[] args) throws InvalidProgramArgumentsException {
        try {
            port = Integer.parseInt(args[0]);
        } catch (NumberFormatException e) {
            throw new InvalidProgramArgumentsException();
        }
    }

    private void parseRootGitDirectoryPath(String[] args) {
        rootGitDirectoryPath = args[1];
    }

    private void printUsage() {
        System.out.println(USAGE_MESSAGE);
    }

}
