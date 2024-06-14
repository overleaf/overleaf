package uk.ac.ic.wlgitbridge.bridge.swap.job;

import uk.ac.ic.wlgitbridge.bridge.swap.job.SwapJob.CompressionMethod;
import uk.ac.ic.wlgitbridge.util.Log;

/*
 * Created by winston on 23/08/2016.
 */
public class SwapJobConfig {

  private final int minProjects;
  private final int lowGiB;
  private final int highGiB;
  private final long intervalMillis;
  private final String compressionMethod;
  private final boolean allowUnsafeStores;

  public SwapJobConfig(
      int minProjects,
      int lowGiB,
      int highGiB,
      long intervalMillis,
      String compressionMethod,
      boolean allowUnsafeStores) {
    this.minProjects = minProjects;
    this.lowGiB = lowGiB;
    this.highGiB = highGiB;
    this.intervalMillis = intervalMillis;
    this.compressionMethod = compressionMethod;
    this.allowUnsafeStores = allowUnsafeStores;
  }

  public int getMinProjects() {
    return minProjects;
  }

  public int getLowGiB() {
    return lowGiB;
  }

  public int getHighGiB() {
    return highGiB;
  }

  public long getIntervalMillis() {
    return intervalMillis;
  }

  public boolean getAllowUnsafeStores() {
    return allowUnsafeStores;
  }

  public SwapJob.CompressionMethod getCompressionMethod() {
    CompressionMethod result = SwapJob.stringToCompressionMethod(compressionMethod);
    if (result == null) {
      Log.info(
          "SwapJobConfig: un-supported compressionMethod '{}', default to 'bzip2'",
          compressionMethod);
      result = CompressionMethod.Bzip2;
    }
    return result;
  }
}
