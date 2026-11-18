package com.gops.lan;

import com.gops.core.Net;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NoRouteToHostException;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Self-contained "nmap -sT"-style engine in plain Java (no root, no native binary):
 *
 * <ul>
 *   <li>Host discovery: ICMP echo via {@link InetAddress#isReachable}, then TCP probes on common
 *       ports. A TCP RST ("connection refused") also proves the host is alive.
 *   <li>Port scan: full TCP connect() with timeout, thread pool, optional banner grabbing.
 * </ul>
 *
 * Android 10+ blocks /proc/net/arp, so MAC addresses / vendors are not available to apps.
 */
public final class PortScanEngine {

  public interface Listener {
    void onProgress(int done, int total);

    void onHostUp(Host host);

    void onOpenPort(String ip, OpenPort port);
  }

  public static final class Host {
    public final String ip;
    public final String hostname;
    public final String method;
    public final long latencyMs;

    Host(String ip, String hostname, String method, long latencyMs) {
      this.ip = ip;
      this.hostname = hostname;
      this.method = method;
      this.latencyMs = latencyMs;
    }
  }

  public static final class OpenPort implements Comparable<OpenPort> {
    public final int port;
    public final String service;
    public final String banner;
    public final long latencyMs;

    OpenPort(int port, String service, String banner, long latencyMs) {
      this.port = port;
      this.service = service;
      this.banner = banner;
      this.latencyMs = latencyMs;
    }

    @Override
    public int compareTo(OpenPort o) {
      return Integer.compare(port, o.port);
    }
  }

  public static final class HostScan {
    public final String ip;
    public final List<OpenPort> openPorts;
    public final int scannedPorts;
    public final long durationMs;

    HostScan(String ip, List<OpenPort> openPorts, int scannedPorts, long durationMs) {
      this.ip = ip;
      this.openPorts = openPorts;
      this.scannedPorts = scannedPorts;
      this.durationMs = durationMs;
    }
  }

  /** Ports used to wake up / detect hosts that drop ICMP. */
  private static final int[] DISCOVERY_PORTS = {80, 443, 22, 445, 8080, 53, 62078, 8009, 9100, 3389};

  private static final int BANNER_MAX = 160;

  private final AtomicBoolean cancelled = new AtomicBoolean(false);
  private volatile ExecutorService pool;

  public void cancel() {
    cancelled.set(true);
    ExecutorService p = pool;
    if (p != null) p.shutdownNow();
  }

  public boolean isCancelled() {
    return cancelled.get();
  }

  // ------------------------------------------------------------------------------ discovery

  public List<Host> discover(
      List<Integer> ips, int timeoutMs, int threads, boolean resolveNames, Listener listener)
      throws InterruptedException {
    List<Host> found = Collections.synchronizedList(new ArrayList<>());
    AtomicInteger done = new AtomicInteger();
    int total = ips.size();
    pool = Executors.newFixedThreadPool(clampThreads(threads));
    for (int ip : ips) {
      pool.execute(
          () -> {
            if (cancelled.get()) return;
            Host h = probeHost(ip, timeoutMs, resolveNames);
            if (h != null) {
              found.add(h);
              listener.onHostUp(h);
            }
            listener.onProgress(done.incrementAndGet(), total);
          });
    }
    awaitPool();
    List<Host> sorted = new ArrayList<>(found);
    sorted.sort((a, b) -> Integer.compareUnsigned(Net.parseIpv4(a.ip), Net.parseIpv4(b.ip)));
    return sorted;
  }

  private Host probeHost(int ip, int timeoutMs, boolean resolveNames) {
    String ipStr = Net.toString(ip);
    InetAddress addr;
    try {
      addr = InetAddress.getByAddress(Net.toBytes(ip));
    } catch (IOException e) {
      return null;
    }
    String method = null;
    long t0 = System.nanoTime();
    try {
      if (addr.isReachable(timeoutMs)) method = "icmp";
    } catch (IOException ignored) {
      // fall through to TCP probing
    }
    if (method == null) {
      for (int port : DISCOVERY_PORTS) {
        if (cancelled.get()) return null;
        t0 = System.nanoTime();
        ProbeResult r = tcpProbe(addr, port, timeoutMs);
        if (r == ProbeResult.OPEN) {
          method = "tcp-open:" + port;
          break;
        }
        if (r == ProbeResult.REFUSED) {
          method = "tcp-refused";
          break;
        }
        if (r == ProbeResult.UNREACHABLE) break; // ARP failed – host is down
      }
    }
    if (method == null) return null;
    long latency = (System.nanoTime() - t0) / 1_000_000;
    String hostname = "";
    if (resolveNames) {
      String name = addr.getCanonicalHostName(); // reverse DNS via the router
      if (name != null && !name.equals(ipStr)) hostname = name;
    }
    return new Host(ipStr, hostname, method, latency);
  }

  private enum ProbeResult {
    OPEN,
    REFUSED,
    TIMEOUT,
    UNREACHABLE
  }

  private static ProbeResult tcpProbe(InetAddress addr, int port, int timeoutMs) {
    try (Socket s = new Socket()) {
      s.connect(new InetSocketAddress(addr, port), timeoutMs);
      return ProbeResult.OPEN;
    } catch (NoRouteToHostException e) {
      return ProbeResult.UNREACHABLE;
    } catch (ConnectException e) {
      String msg = String.valueOf(e.getMessage());
      if (msg.contains("EHOSTUNREACH") || msg.contains("ENETUNREACH")) return ProbeResult.UNREACHABLE;
      return ProbeResult.REFUSED; // ECONNREFUSED = RST = host is alive
    } catch (SocketTimeoutException e) {
      return ProbeResult.TIMEOUT;
    } catch (IOException e) {
      return ProbeResult.TIMEOUT;
    }
  }

  // ------------------------------------------------------------------------------ port scan

  public List<HostScan> scan(
      List<String> hosts, int[] ports, int timeoutMs, int threads, boolean banners, Listener listener)
      throws InterruptedException {
    Map<String, List<OpenPort>> open = new ConcurrentHashMap<>();
    for (String h : hosts) open.put(h, Collections.synchronizedList(new ArrayList<>()));
    AtomicInteger done = new AtomicInteger();
    int total = hosts.size() * ports.length;
    long started = System.currentTimeMillis();
    pool = Executors.newFixedThreadPool(clampThreads(threads));

    // host-major order: results for the first host arrive first
    for (String host : hosts) {
      final InetAddress addr;
      try {
        addr = InetAddress.getByAddress(Net.toBytes(Net.parseIpv4(host)));
      } catch (IOException | IllegalArgumentException e) {
        done.addAndGet(ports.length);
        continue;
      }
      for (int port : ports) {
        pool.execute(
            () -> {
              if (cancelled.get()) return;
              OpenPort p = connectScan(addr, host, port, timeoutMs, banners);
              if (p != null) {
                open.get(host).add(p);
                listener.onOpenPort(host, p);
              }
              listener.onProgress(done.incrementAndGet(), total);
            });
      }
    }
    awaitPool();
    long duration = System.currentTimeMillis() - started;

    List<HostScan> out = new ArrayList<>();
    for (String h : hosts) {
      List<OpenPort> list = new ArrayList<>(open.get(h));
      Collections.sort(list);
      out.add(new HostScan(h, list, ports.length, duration));
    }
    return out;
  }

  private static OpenPort connectScan(
      InetAddress addr, String host, int port, int timeoutMs, boolean banners) {
    long t0 = System.nanoTime();
    try (Socket s = new Socket()) {
      s.connect(new InetSocketAddress(addr, port), timeoutMs);
      long latency = (System.nanoTime() - t0) / 1_000_000;
      String banner = banners ? grabBanner(s, host, port, timeoutMs) : "";
      return new OpenPort(port, ServiceRegistry.name(port), banner, latency);
    } catch (IOException e) {
      return null; // closed / filtered
    }
  }

  private static String grabBanner(Socket s, String host, int port, int timeoutMs) {
    if (ServiceRegistry.isTls(port)) return "tls";
    try {
      s.setSoTimeout(Math.max(600, timeoutMs));
      if (ServiceRegistry.isHttpLike(port)) {
        OutputStream os = s.getOutputStream();
        os.write(
            ("HEAD / HTTP/1.0\r\nHost: " + host + "\r\nUser-Agent: G-Ops\r\n\r\n")
                .getBytes(StandardCharsets.US_ASCII));
        os.flush();
      }
      InputStream is = s.getInputStream();
      byte[] buf = new byte[1024];
      int n = is.read(buf);
      if (n <= 0) return "";
      return summarizeBanner(new String(buf, 0, n, StandardCharsets.ISO_8859_1));
    } catch (IOException e) {
      return ""; // silent service (waits for client) – fine
    }
  }

  /** HTTP: "HTTP/1.1 200 OK | nginx/1.27"; others: first printable line (SSH-2.0-OpenSSH_9.9...). */
  static String summarizeBanner(String raw) {
    if (raw.startsWith("HTTP/")) {
      String status = raw.split("\r?\n", 2)[0].trim();
      String server = "";
      for (String line : raw.split("\r?\n")) {
        if (line.regionMatches(true, 0, "Server:", 0, 7)) {
          server = line.substring(7).trim();
          break;
        }
      }
      return truncate(server.isEmpty() ? status : status + " | " + server);
    }
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < raw.length(); i++) {
      char c = raw.charAt(i);
      if (c == '\n' || c == '\r') {
        if (sb.length() > 0) break;
        continue;
      }
      sb.append(c >= 0x20 && c < 0x7F ? c : '.');
    }
    return truncate(sb.toString().trim());
  }

  private static String truncate(String s) {
    return s.length() <= BANNER_MAX ? s : s.substring(0, BANNER_MAX) + "…";
  }

  // ------------------------------------------------------------------------------ helpers

  private static int clampThreads(int threads) {
    return Math.max(1, Math.min(256, threads));
  }

  private void awaitPool() throws InterruptedException {
    ExecutorService p = pool;
    p.shutdown();
    while (!p.awaitTermination(250, TimeUnit.MILLISECONDS)) {
      if (cancelled.get()) {
        p.shutdownNow();
        break;
      }
    }
  }
}
