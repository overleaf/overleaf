package uk.ac.ic.wlgitbridge.bridge.db.sqlite.update.alter;

import uk.ac.ic.wlgitbridge.bridge.db.sqlite.SQLUpdate;

public class SetSoftHeapLimitPragma implements SQLUpdate {
  private int heapLimitBytes = 0;

  public SetSoftHeapLimitPragma(int heapLimitBytes) {
    this.heapLimitBytes = heapLimitBytes;
  }

  @Override
  public String getSQL() {
    return "PRAGMA soft_heap_limit=" + this.heapLimitBytes + ";";
  }
}
