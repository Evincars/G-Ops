package com.gops.dns;

import androidx.annotation.Nullable;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Process-wide bridge between {@link DnsVpnService} and {@link DnsMonitorModule}: keeps a ring
 * buffer of recent queries (survives JS reloads) and forwards new entries to a listener.
 */
public final class DnsLog {
  private static final int CAPACITY = 1000;

  public static final class Entry {
    public final long id;
    public final long timestamp;
    public final String domain;
    public final String qtype;
    public final int uid;
    public final String packageName;
    public final String appLabel;
    public final boolean blocked;
    public final String rcode;
    public final List<String> answers;
    public final long latencyMs;

    Entry(long id, long timestamp, String domain, String qtype, int uid, String packageName,
        String appLabel, boolean blocked, String rcode, List<String> answers, long latencyMs) {
      this.id = id;
      this.timestamp = timestamp;
      this.domain = domain;
      this.qtype = qtype;
      this.uid = uid;
      this.packageName = packageName;
      this.appLabel = appLabel;
      this.blocked = blocked;
      this.rcode = rcode;
      this.answers = answers;
      this.latencyMs = latencyMs;
    }
  }

  public interface Listener {
    void onQuery(Entry e);

    void onStateChanged(boolean running);
  }

  private static final ArrayDeque<Entry> buffer = new ArrayDeque<>();
  private static final AtomicLong ids = new AtomicLong();
  private static final AtomicLong queries = new AtomicLong();
  private static final AtomicLong blocked = new AtomicLong();
  private static volatile Listener listener;
  private static volatile boolean running;
  private static volatile String upstream = "";

  private DnsLog() {}

  public static void setListener(@Nullable Listener l) {
    listener = l;
  }

  static void add(String domain, String qtype, int uid, String pkg, String label, boolean isBlocked,
      String rcode, List<String> answers, long latencyMs) {
    Entry e = new Entry(ids.incrementAndGet(), System.currentTimeMillis(), domain, qtype, uid, pkg,
        label, isBlocked, rcode, answers, latencyMs);
    queries.incrementAndGet();
    if (isBlocked) blocked.incrementAndGet();
    synchronized (buffer) {
      buffer.addFirst(e);
      while (buffer.size() > CAPACITY) buffer.removeLast();
    }
    Listener l = listener;
    if (l != null) l.onQuery(e);
  }

  static void setRunning(boolean isRunning, String upstreamDns) {
    running = isRunning;
    upstream = upstreamDns;
    Listener l = listener;
    if (l != null) l.onStateChanged(isRunning);
  }

  public static boolean isRunning() {
    return running;
  }

  public static String upstream() {
    return upstream;
  }

  public static long queryCount() {
    return queries.get();
  }

  public static long blockedCount() {
    return blocked.get();
  }

  public static List<Entry> recent(int limit) {
    List<Entry> out = new ArrayList<>();
    synchronized (buffer) {
      Iterator<Entry> it = buffer.iterator();
      while (it.hasNext() && out.size() < limit) out.add(it.next());
    }
    return out;
  }

  public static void clear() {
    synchronized (buffer) {
      buffer.clear();
    }
  }
}
