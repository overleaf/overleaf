package uk.ac.ic.wlgitbridge.util;

import java.util.TimerTask;

/*
 * Created by winston on 23/08/2016.
 */
public class TimerUtils {

  public static TimerTask makeTimerTask(Runnable lamb) {
    return new TimerTask() {
      @Override
      public void run() {
        try {
          lamb.run();
        } catch (Throwable t) {
          Log.warn("Error on timer", t);
        }
      }
    };
  }
}
