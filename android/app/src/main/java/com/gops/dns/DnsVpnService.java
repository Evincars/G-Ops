package com.gops.dns;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.VpnService;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.system.ErrnoException;
import android.system.Os;
import android.system.OsConstants;
import android.system.StructPollfd;
import android.util.Log;

import com.gops.R;
import com.gops.core.AppResolver;

import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.SocketTimeoutException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * "DNS-only" local VPN. The tunnel announces a virtual DNS server (10.111.222.53) and routes ONLY
 * that /32 into the TUN, so regular traffic is untouched. Every UDP/53 packet is:
 *
 * <ol>
 *   <li>parsed (domain, qtype),
 *   <li>attributed to an app via {@link ConnectivityManager#getConnectionOwnerUid},
 *   <li>answered with NXDOMAIN if blocked, otherwise forwarded to the real upstream resolver,
 *   <li>logged to {@link DnsLog} -> React Native live list.
 * </ol>
 *
 * Caveats: Android "Private DNS" in strict mode and apps using their own DoH bypass system DNS and
 * therefore this monitor. Only one VPN can be active at a time.
 */
public class DnsVpnService extends VpnService {
  private static final String TAG = "GOpsDnsVpn";
  public static final String ACTION_START = "com.gops.dns.START";
  public static final String ACTION_STOP = "com.gops.dns.STOP";
  public static final String EXTRA_UPSTREAM = "upstream";

  static final String TUN_ADDRESS = "10.111.222.1";
  static final String VIRTUAL_DNS = "10.111.222.53";
  private static final String FALLBACK_UPSTREAM = "9.9.9.9";
  private static final int UPSTREAM_TIMEOUT_MS = 4000;

  private ParcelFileDescriptor tun;
  private FileOutputStream tunOut;
  private Thread reader;
  private ExecutorService workers;
  private volatile boolean running;
  private InetAddress upstream;
  private AppResolver apps;
  private DnsBlocklist blocklist;

  @Override
  public void onCreate() {
    super.onCreate();
    apps = new AppResolver(this);
    blocklist = DnsBlocklist.get(this);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String action = intent == null ? ACTION_START : intent.getAction();
    if (ACTION_STOP.equals(action)) {
      shutdown();
      stopSelf();
      return START_NOT_STICKY;
    }
    String up = intent == null ? "" : intent.getStringExtra(EXTRA_UPSTREAM);
    try {
      startTunnel(up == null ? "" : up);
    } catch (Exception e) {
      Log.e(TAG, "Failed to start DNS VPN", e);
      shutdown();
      stopSelf();
      return START_NOT_STICKY;
    }
    return START_STICKY;
  }

  @Override
  public void onRevoke() {
    // user disabled the VPN in Settings or another VPN took over
    shutdown();
    super.onRevoke();
  }

  @Override
  public void onDestroy() {
    shutdown();
    super.onDestroy();
  }

  // ------------------------------------------------------------------------------ tunnel

  private synchronized void startTunnel(String upstreamOverride) throws Exception {
    if (running) return;
    upstream = InetAddress.getByName(pickUpstream(upstreamOverride));

    Builder b =
        new Builder()
            .setSession(getString(R.string.vpn_session_name))
            .addAddress(TUN_ADDRESS, 32)
            .addDnsServer(VIRTUAL_DNS)
            .addRoute(VIRTUAL_DNS, 32)
            .setMtu(1500)
            .setBlocking(true)
            .setMetered(false);
    try {
      // our own sockets (upstream DNS, port scanner) must not loop through the tunnel
      b.addDisallowedApplication(getPackageName());
    } catch (PackageManager.NameNotFoundException ignored) {
      // impossible for our own package
    }

    tun = b.establish();
    if (tun == null) throw new IllegalStateException("VPN not prepared (consent missing)");
    tunOut = new FileOutputStream(tun.getFileDescriptor());
    workers = Executors.newFixedThreadPool(8);
    running = true;
    reader = new Thread(this::readLoop, "gops-dns-tun");
    reader.start();
    DnsLog.setRunning(true, upstream.getHostAddress());
  }

  /** Explicit override -> first IPv4 DNS of the underlying network -> Quad9 fallback. */
  private String pickUpstream(String override) {
    if (!override.trim().isEmpty()) return override.trim();
    ConnectivityManager cm = getSystemService(ConnectivityManager.class);
    Network n = cm.getActiveNetwork(); // we are excluded from our VPN -> underlying network
    LinkProperties lp = n == null ? null : cm.getLinkProperties(n);
    if (lp != null) {
      for (InetAddress d : lp.getDnsServers()) {
        if (d instanceof Inet4Address && !VIRTUAL_DNS.equals(d.getHostAddress())) {
          return d.getHostAddress();
        }
      }
    }
    return FALLBACK_UPSTREAM;
  }

  private synchronized void shutdown() {
    if (!running && tun == null) return;
    running = false;
    try {
      if (tun != null) tun.close(); // unblocks the reader thread
    } catch (IOException ignored) {
      // closing anyway
    }
    tun = null;
    tunOut = null;
    if (reader != null) reader.interrupt();
    reader = null;
    if (workers != null) workers.shutdownNow();
    workers = null;
    DnsLog.setRunning(false, "");
  }

  /**
   * poll() with a timeout instead of a plain blocking read: closing the fd from another thread
   * does not reliably wake up a blocked read() on a TUN device.
   */
  private void readLoop() {
    ParcelFileDescriptor pfd = tun;
    if (pfd == null) return;
    FileDescriptor fd = pfd.getFileDescriptor(); // owned by `tun`, never closed here
    StructPollfd poll = new StructPollfd();
    poll.fd = fd;
    poll.events = (short) OsConstants.POLLIN;
    StructPollfd[] polls = {poll};
    byte[] buf = new byte[32767];
    while (running) {
      try {
        poll.revents = 0;
        if (Os.poll(polls, 500) <= 0) continue;
        if ((poll.revents & (OsConstants.POLLERR | OsConstants.POLLHUP | OsConstants.POLLNVAL)) != 0) break;
        int n = Os.read(fd, buf, 0, buf.length);
        if (n <= 0) continue;
        IpPacket.Udp pkt = IpPacket.parseIpv4Udp(buf, n);
        if (pkt == null || pkt.dstPort != 53) continue; // e.g. DoT probes to :853 – ignored
        ExecutorService w = workers;
        if (w != null) w.execute(() -> handleQuery(pkt));
      } catch (ErrnoException e) {
        if (e.errno == OsConstants.EINTR || e.errno == OsConstants.EAGAIN) continue;
        if (running) Log.w(TAG, "TUN read failed", e);
        break;
      } catch (InterruptedIOException e) {
        break;
      } catch (RuntimeException e) {
        Log.w(TAG, "TUN reader stopped", e); // RejectedExecution during shutdown
        break;
      }
    }
  }

  // ------------------------------------------------------------------------------ DNS

  private void handleQuery(IpPacket.Udp pkt) {
    DnsPacket.Question q = DnsPacket.parseQuery(pkt.payload);
    int uid = ownerUid(pkt);
    AppResolver.App app = apps.resolve(uid);
    long t0 = System.nanoTime();

    String domain = q == null ? "?" : q.name;
    String qtype = q == null ? "?" : DnsPacket.typeName(q.qtype);
    boolean isBlocked = q != null && blocklist.isBlocked(q.name);
    byte[] response;
    String rcode;
    List<String> answers = Collections.emptyList();

    if (isBlocked) {
      response = DnsPacket.buildErrorResponse(pkt.payload, q, DnsPacket.RCODE_NXDOMAIN);
      rcode = "BLOCKED";
    } else {
      response = forward(pkt.payload);
      if (response == null) {
        rcode = "TIMEOUT";
        if (q != null) response = DnsPacket.buildErrorResponse(pkt.payload, q, DnsPacket.RCODE_SERVFAIL);
      } else {
        DnsPacket.Response r = DnsPacket.parseResponse(response);
        rcode = DnsPacket.rcodeName(r.rcode);
        answers = r.answers;
      }
    }

    if (response != null) {
      writeTun(IpPacket.buildIpv4Udp(pkt.dstIp, pkt.srcIp, 53, pkt.srcPort, response));
    }
    long latency = (System.nanoTime() - t0) / 1_000_000;
    DnsLog.add(domain, qtype, uid, app.packageName, app.label, isBlocked, rcode, answers, latency);
  }

  private byte[] forward(byte[] query) {
    try (DatagramSocket s = new DatagramSocket()) {
      protect(s);
      s.setSoTimeout(UPSTREAM_TIMEOUT_MS);
      s.send(new DatagramPacket(query, query.length, upstream, 53));
      byte[] buf = new byte[4096];
      DatagramPacket resp = new DatagramPacket(buf, buf.length);
      s.receive(resp);
      return Arrays.copyOf(buf, resp.getLength());
    } catch (SocketTimeoutException e) {
      return null;
    } catch (IOException e) {
      Log.w(TAG, "upstream DNS failed", e);
      return null;
    }
  }

  /**
   * Best effort: works for apps resolving directly. Queries proxied by the system resolver may be
   * attributed to the requesting app (netd re-owns the socket) or to the DNS resolver UID.
   */
  private int ownerUid(IpPacket.Udp pkt) {
    try {
      ConnectivityManager cm = getSystemService(ConnectivityManager.class);
      return cm.getConnectionOwnerUid(
          OsConstants.IPPROTO_UDP,
          new InetSocketAddress(InetAddress.getByAddress(pkt.srcIp), pkt.srcPort),
          new InetSocketAddress(InetAddress.getByAddress(pkt.dstIp), pkt.dstPort));
    } catch (Exception e) {
      return Process.INVALID_UID;
    }
  }

  private void writeTun(byte[] packet) {
    FileOutputStream out = tunOut;
    if (out == null) return;
    synchronized (this) {
      try {
        out.write(packet);
      } catch (IOException e) {
        if (running) Log.w(TAG, "TUN write failed", e);
      }
    }
  }
}
