package com.gops.traffic;

import android.app.AppOpsManager;
import android.app.usage.NetworkStats;
import android.app.usage.NetworkStatsManager;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.TrafficStats;
import android.net.Uri;
import android.os.Process;
import android.provider.Settings;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.gops.core.AppResolver;
import com.gops.specs.NativeTrafficMonitorSpec;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Traffic stats for the Paranoid dashboard.
 *
 * <ul>
 *   <li>{@link TrafficStats}: device-wide byte counters, real time. Since Android 7 the per-UID
 *       variants only report the calling app, so they're useless for other apps.
 *   <li>{@link NetworkStatsManager}: per-UID totals for Wi-Fi / mobile / ethernet. Needs the
 *       "Usage access" app-op. The system flushes these buckets periodically, so treat them as
 *       near-real-time, not packet-accurate.
 * </ul>
 */
public class TrafficMonitorModule extends NativeTrafficMonitorSpec {
  public static final String NAME = NativeTrafficMonitorSpec.NAME;
  private static final int MAX_APPS = 150;

  private final AppResolver apps;
  private final ExecutorService io = Executors.newSingleThreadExecutor();

  public TrafficMonitorModule(ReactApplicationContext ctx) {
    super(ctx);
    apps = new AppResolver(ctx);
  }

  @Override
  public void getTotals(Promise promise) {
    WritableMap m = Arguments.createMap();
    m.putDouble("timestamp", System.currentTimeMillis());
    m.putDouble("rxBytes", TrafficStats.getTotalRxBytes());
    m.putDouble("txBytes", TrafficStats.getTotalTxBytes());
    m.putDouble("mobileRxBytes", TrafficStats.getMobileRxBytes());
    m.putDouble("mobileTxBytes", TrafficStats.getMobileTxBytes());
    m.putDouble("rxPackets", TrafficStats.getTotalRxPackets());
    m.putDouble("txPackets", TrafficStats.getTotalTxPackets());
    promise.resolve(m);
  }

  @Override
  public void hasUsageAccess(Promise promise) {
    promise.resolve(usageAccessGranted());
  }

  @Override
  public void openUsageAccessSettings() {
    Context ctx = getReactApplicationContext();
    Intent i =
        new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:" + ctx.getPackageName()))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      ctx.startActivity(i);
    } catch (RuntimeException e) {
      // some builds don't accept the package URI – open the generic list instead
      ctx.startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    }
  }

  @Override
  public void getAppUsage(double sinceMs, Promise promise) {
    if (!usageAccessGranted()) {
      promise.reject("E_USAGE_ACCESS", "Usage access not granted");
      return;
    }
    io.execute(
        () -> {
          try {
            promise.resolve(queryPerApp((long) sinceMs, System.currentTimeMillis()));
          } catch (RuntimeException e) {
            promise.reject("E_STATS", e);
          }
        });
  }

  @Override
  public void invalidate() {
    io.shutdownNow();
    super.invalidate();
  }

  // ------------------------------------------------------------------------------ internals

  private static final class Acc {
    long rx;
    long tx;
    long wifi;
    long mobile;
  }

  @SuppressWarnings("deprecation") // ConnectivityManager.TYPE_* is what querySummary() expects
  private WritableArray queryPerApp(long start, long end) {
    NetworkStatsManager nsm = getReactApplicationContext().getSystemService(NetworkStatsManager.class);
    Map<Integer, Acc> byUid = new HashMap<>();
    int[] types = {ConnectivityManager.TYPE_WIFI, ConnectivityManager.TYPE_MOBILE, ConnectivityManager.TYPE_ETHERNET};
    for (int type : types) {
      // subscriberId = null -> all mobile subscriptions (API 29+)
      try (NetworkStats stats = nsm.querySummary(type, null, start, end)) {
        NetworkStats.Bucket b = new NetworkStats.Bucket();
        while (stats.hasNextBucket()) {
          stats.getNextBucket(b);
          Acc a = byUid.get(b.getUid());
          if (a == null) {
            a = new Acc();
            byUid.put(b.getUid(), a);
          }
          a.rx += b.getRxBytes();
          a.tx += b.getTxBytes();
          long sum = b.getRxBytes() + b.getTxBytes();
          if (type == ConnectivityManager.TYPE_MOBILE) a.mobile += sum;
          else a.wifi += sum;
        }
      } catch (Exception ignored) {
        // RemoteException / SecurityException, no SIM, transport never seen – skip this type
      }
    }

    List<Map.Entry<Integer, Acc>> sorted = new ArrayList<>(byUid.entrySet());
    sorted.sort((x, y) -> Long.compare(y.getValue().rx + y.getValue().tx, x.getValue().rx + x.getValue().tx));
    WritableArray arr = Arguments.createArray();
    for (int i = 0; i < sorted.size() && i < MAX_APPS; i++) {
      int uid = sorted.get(i).getKey();
      Acc a = sorted.get(i).getValue();
      if (a.rx + a.tx == 0) continue;
      AppResolver.App app = apps.resolve(uid);
      WritableMap m = Arguments.createMap();
      m.putInt("uid", uid);
      m.putString("packageName", app.packageName);
      m.putString("label", app.label);
      m.putDouble("rxBytes", a.rx);
      m.putDouble("txBytes", a.tx);
      m.putDouble("wifiBytes", a.wifi);
      m.putDouble("mobileBytes", a.mobile);
      arr.pushMap(m);
    }
    return arr;
  }

  @SuppressWarnings("deprecation") // unsafeCheckOpNoThrow is deprecated in API 37, fine on 36
  private boolean usageAccessGranted() {
    Context ctx = getReactApplicationContext();
    AppOpsManager ops = ctx.getSystemService(AppOpsManager.class);
    int mode =
        ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), ctx.getPackageName());
    if (mode == AppOpsManager.MODE_DEFAULT) {
      return ctx.checkSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS)
          == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }
    return mode == AppOpsManager.MODE_ALLOWED;
  }
}
