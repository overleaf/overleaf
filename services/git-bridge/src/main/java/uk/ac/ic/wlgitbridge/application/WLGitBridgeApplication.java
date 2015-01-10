package uk.ac.ic.wlgitbridge.application;

import uk.ac.ic.wlgitbridge.application.exception.InvalidConfigFileException;
import uk.ac.ic.wlgitbridge.application.exception.InvalidProgramArgumentsException;
import uk.ac.ic.wlgitbridge.git.exception.InvalidRootDirectoryPathException;
import uk.ac.ic.wlgitbridge.util.Util;

import javax.servlet.ServletException;
import java.io.IOException;

/**
 * Created by Winston on 02/11/14.
 */

/**
 * Class that represents the application. Parses arguments and gives them to the server, or dies with a usage message.
 */
public class WLGitBridgeApplication {

    public static final int EXIT_CODE_FAILED = 1;
    private static final String USAGE_MESSAGE = "usage: writelatex-git-bridge config_file";

    private String configFilePath;
    private Config config;
    private WLGitBridgeServer server;

    /**
     * Constructs an instance of the WriteLatex-Git Bridge application.
     * @param args args from main, which should be in the format [port, root_git_directory_path]
     */
    public WLGitBridgeApplication(String[] args) {
        try {
            parseArguments(args);
            loadConfigFile();
        } catch (InvalidProgramArgumentsException e) {
            printUsage();
            System.exit(EXIT_CODE_FAILED);
        } catch (InvalidConfigFileException e) {
            System.err.println("The property for " + e.getMissingMember() + " is invalid. Check your config file.");
            System.exit(EXIT_CODE_FAILED);
        } catch (IOException e) {
            System.err.println("Invalid config file. Check the file path.");
            System.exit(EXIT_CODE_FAILED);
        }
        try {
            server = new WLGitBridgeServer(config);
        } catch (ServletException e) {
            Util.printStackTrace(e);
        } catch (InvalidRootDirectoryPathException e) {
            System.out.println("Invalid root git directory path. Check your config file.");
            System.exit(EXIT_CODE_FAILED);
        }
    }

    /**
     * Starts the server with the port number and root directory path given in the command-line arguments.
     */
    public void run() {
        server.start();
    }

    public void stop() {
        server.stop();
    }

    /* Helper methods */

    private void parseArguments(String[] args) throws InvalidProgramArgumentsException {
        checkArgumentsLength(args);
        parseConfigFilePath(args);
    }

    private void checkArgumentsLength(String[] args) throws InvalidProgramArgumentsException {
        if (args.length < 1) {
            throw new InvalidProgramArgumentsException();
        }
    }

    private void parseConfigFilePath(String[] args) throws InvalidProgramArgumentsException {
        configFilePath = args[0];
    }

    private void loadConfigFile() throws InvalidConfigFileException, IOException {
        config = new Config(configFilePath);
    }

    private void printUsage() {
        System.out.println(USAGE_MESSAGE);
    }

}
