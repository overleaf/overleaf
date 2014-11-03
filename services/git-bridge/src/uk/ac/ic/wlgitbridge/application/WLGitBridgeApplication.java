package uk.ac.ic.wlgitbridge.application;

import uk.ac.ic.wlgitbridge.application.exception.InvalidProgramArgumentsException;
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;

import javax.servlet.ServletException;

/**
 * Created by Winston on 02/11/14.
 */

/**
 * Class that represents the application. Parses arguments and gives them to the server, or dies with a usage message.
 */
public class WLGitBridgeApplication {

    public static final int EXIT_CODE_FAILED = 1;
    private static final String USAGE_MESSAGE = "usage: writelatex-git-bridge port root_git_directory_path";

    private int port;
    private String rootGitDirectoryPath;

    /**
     * Constructs an instance of the WriteLatex-Git Bridge application.
     * @param args args from main, which should be in the format "port root_git_directory_path"
     */
    public WLGitBridgeApplication(String[] args) {
        try {
            parseArguments(args);
        } catch (InvalidProgramArgumentsException e) {
            printUsage();
            System.exit(EXIT_CODE_FAILED);
        }
    }

    /**
     * Starts the server with the port number and root directory path given in the command-line arguments.
     */
    public void run() {
        try {
            new WLGitBridgeServer(port, rootGitDirectoryPath).start();
        } catch (ServletException e) {
            e.printStackTrace();
        } catch (InvalidRootDirectoryPathException e) {
            printUsage();
            System.exit(EXIT_CODE_FAILED);
        }
    }

    /* Helper methods */

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
