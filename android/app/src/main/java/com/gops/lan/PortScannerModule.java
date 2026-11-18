package com.gops.lan;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.os.SystemClock;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.gops.core.Events;
import com.gops.core.Net;
import com.gops.specs.NativePortScannerSpec;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** LAN info + host discovery + TCP port scanning. Progress is streamed as GOps.PortScan events. */
public class PortScannerModule extends NativePortScannerSpec {
  public static final String NAME = NativePortScannerSpec.NAME;
  private static final long PROGRESS_INTERVAL_MS = 200;

  private final Map<String, PortScanEngine> active = new ConcurrentHashMap<>();
  private final ExecutorService runner = Executors.newCachedThreadPool();

  public PortScannerModule(ReactApplicationContext ctx) {
    super(ctx);
  }

  @Override
  public void getLanInfo(Promise promise) {
    Context ctx = getReactApplicationContext();
    ConnectivityManager cm = ctx.getSystemService(ConnectivityManager.class);
    Network n = Net.findLanNetwork(ctx);
    LinkProperties lp = n == null ? null : cm.getLinkProperties(n);
    WritableMap m = Arguments.createMap();
    WritableArray dns = Arguments.createArray();
    LinkAddress la = Net.firstIpv4(lp);

    m.putBoolean("connected", la != null);
    m.putString("interfaceName", lp != null && lp.getInterfaceName() != null ? lp.getInterfaceName() : "");
    m.putString("transport", Net.transportName(n == null ? null : cm.getNetworkCapabilities(n)));
    if (la != null) {
      int ip = Net.toInt(la.getAddress().getAddress());
      int prefix = la.getPrefixLength();
      m.putString("ipAddress", Net.toString(ip));
      m.putInt("prefixLength", prefix);
      m.putString("cidr", Net.toString(ip & Net.mask(prefix)) + "/" + prefix);
    } else {
      m.putString("ipAddress", "");
      m.putInt("prefixLength", 0);
      m.putString("cidr", "");
    }
    InetAddress gw = Net.defaultGateway4(lp);
    m.putString("gateway", gw == null ? "" : gw.getHostAddress());
    if (lp != null) {
      for (InetAddress d : lp.getDnsServers()) {
        if (d instanceof Inet4Address) dns.pushString(d.getHostAddress());
      }
    }
    m.putArray("dnsServers", dns);
    promise.resolve(m);
  }

  @Override
  public void discoverHosts(String scanId, String target, ReadableMap options, Promise promise) {
    final List<Integer> ips;
    try {
      ips = TargetParser.parse(target);
    } catch (RuntimeException e) {
      promise.reject("E_TARGET", e.getMessage());
      return;
    }
    int timeout = optInt(options, "timeoutMs", 500);
    int threads = optInt(options, "threads", 64);
    boolean resolve = options.hasKey("resolveHostnames") && options.getBoolean("resolveHostnames");

    PortScanEngine engine = new PortScanEngine();
    active.put(scanId, engine);
    runner.execute(
        () -> {
          try {
            List<PortScanEngine.Host> hosts =
                engine.discover(ips, timeout, threads, resolve, new Emitter(scanId, "discovery"));
            WritableArray arr = Arguments.createArray();
            for (PortScanEngine.Host h : hosts) arr.pushMap(hostToMap(h));
            emitDone(scanId, "discovery", engine.isCancelled());
            promise.resolve(arr);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            promise.reject("E_INTERRUPTED", e);
          } catch (RuntimeException e) {
            promise.reject("E_SCAN", e);
          } finally {
            active.remove(scanId);
          }
        });
  }

  @Override
  public void scanPorts(
      String scanId, ReadableArray hosts, String ports, ReadableMap options, Promise promise) {
    final int[] portList;
    final List<String> hostList = new ArrayList<>();
    try {
      portList = ServiceRegistry.parsePorts(ports);
      for (int i = 0; i < hosts.size(); i++) {
        String h = hosts.getString(i);
        if (h == null) continue;
        // validates "private only" + literal IPv4
        for (int ip : TargetParser.parse(h)) hostList.add(Net.toString(ip));
      }
    } catch (RuntimeException e) {
      promise.reject("E_TARGET", e.getMessage());
      return;
    }
    int timeout = optInt(options, "timeoutMs", 400);
    int threads = optInt(options, "threads", 128);
    boolean banners = !options.hasKey("grabBanners") || options.getBoolean("grabBanners");

    PortScanEngine engine = new PortScanEngine();
    active.put(scanId, engine);
    runner.execute(
        () -> {
          try {
            List<PortScanEngine.HostScan> res =
                engine.scan(hostList, portList, timeout, threads, banners, new Emitter(scanId, "ports"));
            WritableArray arr = Arguments.createArray();
            for (PortScanEngine.HostScan hs : res) {
              WritableMap m = Arguments.createMap();
              m.putString("ip", hs.ip);
              WritableArray open = Arguments.createArray();
              for (PortScanEngine.OpenPort p : hs.openPorts) open.pushMap(portToMap(p));
              m.putArray("openPorts", open);
              m.putInt("scannedPorts", hs.scannedPorts);
              m.putDouble("durationMs", hs.durationMs);
              arr.pushMap(m);
            }
            emitDone(scanId, "ports", engine.isCancelled());
            promise.resolve(arr);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            promise.reject("E_INTERRUPTED", e);
          } catch (RuntimeException e) {
            promise.reject("E_SCAN", e);
          } finally {
            active.remove(scanId);
          }
        });
  }

  @Override
  public void cancel(String scanId) {
    PortScanEngine e = active.get(scanId);
    if (e != null) e.cancel();
  }

  @Override
  public void invalidate() {
    for (PortScanEngine e : active.values()) e.cancel();
    active.clear();
    runner.shutdownNow();
    super.invalidate();
  }

  // ------------------------------------------------------------------------------ events

  /** Streams engine callbacks to JS; progress is throttled to avoid flooding the bridge. */
  private final class Emitter implements PortScanEngine.Listener {
    private final String scanId;
    private final String phase;
    private volatile long lastProgress;

    Emitter(String scanId, String phase) {
      this.scanId = scanId;
      this.phase = phase;
    }

    @Override
    public void onProgress(int done, int total) {
      long now = SystemClock.elapsedRealtime();
      if (done != total && now - lastProgress < PROGRESS_INTERVAL_MS) return;
      lastProgress = now;
      WritableMap m = base(scanId, phase, "progress");
      m.putInt("done", done);
      m.putInt("total", total);
      Events.emit(getReactApplicationContext(), Events.PORT_SCAN, m);
    }

    @Override
    public void onHostUp(PortScanEngine.Host host) {
      WritableMap m = base(scanId, phase, "host");
      m.putMap("host", hostToMap(host));
      Events.emit(getReactApplicationContext(), Events.PORT_SCAN, m);
    }

    @Override
    public void onOpenPort(String ip, PortScanEngine.OpenPort port) {
      WritableMap m = base(scanId, phase, "port");
      m.putString("ip", ip);
      m.putMap("port", portToMap(port));
      Events.emit(getReactApplicationContext(), Events.PORT_SCAN, m);
    }
  }

  private void emitDone(String scanId, String phase, boolean cancelled) {
    WritableMap m = base(scanId, phase, "done");
    m.putBoolean("cancelled", cancelled);
    Events.emit(getReactApplicationContext(), Events.PORT_SCAN, m);
  }

  private static WritableMap base(String scanId, String phase, String type) {
    WritableMap m = Arguments.createMap();
    m.putString("scanId", scanId);
    m.putString("phase", phase);
    m.putString("type", type);
    return m;
  }

  private static WritableMap hostToMap(PortScanEngine.Host h) {
    WritableMap m = Arguments.createMap();
    m.putString("ip", h.ip);
    m.putString("hostname", h.hostname);
    m.putString("method", h.method);
    m.putDouble("latencyMs", h.latencyMs);
    return m;
  }

  private static WritableMap portToMap(PortScanEngine.OpenPort p) {
    WritableMap m = Arguments.createMap();
    m.putInt("port", p.port);
    m.putString("service", p.service);
    m.putString("banner", p.banner);
    m.putDouble("latencyMs", p.latencyMs);
    return m;
  }

  private static int optInt(ReadableMap m, String key, int def) {
    return m.hasKey(key) && !m.isNull(key) ? (int) m.getDouble(key) : def;
  }
}
