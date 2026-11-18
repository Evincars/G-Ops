package com.gops.core;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Process;

import java.util.concurrent.ConcurrentHashMap;

/** UID -> (packageName, label) with a cache. Needs QUERY_ALL_PACKAGES for full visibility. */
public final class AppResolver {
  /** AID_DNS – netd's DnsResolver when it can't attribute a query to an app. */
  private static final int AID_DNS = 1051;
  /** NetworkStats.Bucket.UID_REMOVED / UID_TETHERING. */
  private static final int UID_REMOVED = -4;
  private static final int UID_TETHERING = -5;

  public static final class App {
    public final String packageName;
    public final String label;

    App(String packageName, String label) {
      this.packageName = packageName;
      this.label = label;
    }
  }

  private final PackageManager pm;
  private final ConcurrentHashMap<Integer, App> cache = new ConcurrentHashMap<>();

  public AppResolver(Context ctx) {
    this.pm = ctx.getApplicationContext().getPackageManager();
  }

  public App resolve(int uid) {
    App cached = cache.get(uid);
    if (cached != null) return cached;
    App app = lookup(uid);
    cache.put(uid, app);
    return app;
  }

  private App lookup(int uid) {
    switch (uid) {
      case Process.INVALID_UID:
        return new App("", "unknown");
      case Process.ROOT_UID:
        return new App("root", "Kernel / root");
      case Process.SYSTEM_UID:
        return new App("android", "Android System");
      case AID_DNS:
        return new App("dns", "System DNS resolver");
      case UID_REMOVED:
        return new App("removed", "Removed apps");
      case UID_TETHERING:
        return new App("tethering", "Tethering / hotspot");
      default:
        break;
    }
    String[] pkgs = pm.getPackagesForUid(uid);
    if (pkgs == null || pkgs.length == 0) return new App("uid:" + uid, "UID " + uid);
    String pkg = pkgs[0];
    String label = pkg;
    try {
      ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
      label = pm.getApplicationLabel(info).toString();
    } catch (PackageManager.NameNotFoundException ignored) {
      // keep package name as label
    }
    if (pkgs.length > 1) label = label + " (+" + (pkgs.length - 1) + " shared)";
    return new App(pkg, label);
  }
}
