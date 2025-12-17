package uk.ac.ic.wlgitbridge.application;

import jakarta.servlet.ServletException;
import java.io.IOException;
import uk.ac.ic.wlgitbridge.application.config.Config;
import uk.ac.ic.wlgitbridge.application.exception.ArgsException;
import uk.ac.ic.wlgitbridge.application.exception.ConfigFileException;
import uk.ac.ic.wlgitbridge.server.GitBridgeServer;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by Winston on 02/11/14.
 */

/*
 * Class that represents the application. Parses arguments and gives them to the
 * server, or dies with a usage message.
 */
public class GitBridgeApp implements Runnable {

  public static final int EXIT_CODE_FAILED = 1;
  private static final String USAGE_MESSAGE = "usage: writelatex-git-bridge [config_file]";

  private String configFilePath;
  Config config;
  private GitBridgeServer server;

  /*
   * Constructs an instance of the WriteLatex-Git Bridge application.
   * @param args args from main, which should be in the format [config_file]
   */
  public GitBridgeApp(String[] args) {
    try {
      parseArguments(args);
      loadConfigFile();
      Log.info("Config loaded: {}", config.getSanitisedString());
    } catch (ArgsException e) {
      printUsage();
      System.exit(EXIT_CODE_FAILED);
    } catch (ConfigFileException e) {
      Log.error(
          "The property for " + e.getMissingMember() + " is invalid. Check your config file.");
      System.exit(EXIT_CODE_FAILED);
    } catch (IOException e) {
      Log.error("Invalid config file. Check the file path.");
      System.exit(EXIT_CODE_FAILED);
    }
    try {
      server = new GitBridgeServer(config);
    } catch (ServletException e) {
      Log.error("Servlet exception when instantiating GitBridgeServer", e);
    }
  }

  /*
   * Starts the server with the port number and root directory path given in
   * the command-line arguments.
   */
  @Override
  public void run() {
    server.start();
  }

  public void stop() {
    server.stop();
  }

  /* Helper methods */

  private void parseArguments(String[] args) throws ArgsException {
    checkArgumentsLength(args);
    parseConfigFilePath(args);
  }

  private void checkArgumentsLength(String[] args) throws ArgsException {
    if (args.length < 1) {
      throw new ArgsException();
    }
  }

  private void parseConfigFilePath(String[] args) throws ArgsException {
    configFilePath = args[0];
  }

  private void loadConfigFile() throws ConfigFileException, IOException {
    Log.info("Loading config file at path: " + configFilePath);
    config = new Config(configFilePath);
  }

  private void printUsage() {
    System.err.println(USAGE_MESSAGE);
  }
}
