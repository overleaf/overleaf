package uk.ac.ic.wlgitbridge.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import uk.ac.ic.wlgitbridge.application.GitBridgeApp;

/*
 * Created by winston on 19/01/2016.
 */
public class Log {

  private static Logger logger = LoggerFactory.getLogger(GitBridgeApp.class);

  public static void trace(String msg) {
    logger.trace(msg);
  }

  public static void trace(String msg, Throwable t) {
    logger.trace(msg, t);
  }

  public static void debug(String msg) {
    logger.debug(msg);
  }

  public static void debug(String msg, Throwable t) {
    logger.debug(msg, t);
  }

  public static void debug(String format, Object... args) {
    logger.debug(format, args);
  }

  public static void info(String msg) {
    logger.info(msg);
  }

  public static void info(String format, Object arg) {
    logger.info(format, arg);
  }

  public static void info(String format, Object arg1, Object arg2) {
    logger.info(format, arg1, arg2);
  }

  public static void info(String format, Object... args) {
    logger.info(format, args);
  }

  public static void info(String msg, Throwable t) {
    logger.info(msg, t);
  }

  public static void warn(String msg) {
    logger.warn(msg);
  }

  public static void warn(String msg, Object arg) {
    logger.warn(msg, arg);
  }

  public static void warn(String msg, Object arg1, Object arg2) {
    logger.warn(msg, arg1, arg2);
  }

  public static void warn(String msg, Object... args) {
    logger.warn(msg, args);
  }

  public static void warn(String msg, Throwable t) {
    logger.warn(msg, t);
  }

  public static void error(String msg) {
    logger.error(msg);
  }

  public static void error(String msg, Object... args) {
    logger.error(msg, args);
  }

  public static void error(String msg, Throwable t) {
    logger.error(msg, t);
  }
}
