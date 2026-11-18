package com.gops.device;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.gops.specs.NativeDeviceInfoSpec;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Device / OS detection + tiny key-value store (theme, last scan target, ...). */
public class DeviceModule extends NativeDeviceInfoSpec {
  public static final String NAME = NativeDeviceInfoSpec.NAME;

  private static final String PREFS = "gops_prefs";
  /** Pixel 10 / 10 Pro / 10 Pro XL / 10 Pro Fold codenames. */
  private static final List<String> PIXEL_10_CODENAMES =
      Arrays.asList("frankel", "blazer", "mustang", "rango");
  /** Packages that ship only with GrapheneOS. */
  private static final String[] GRAPHENE_PACKAGES = {
    "app.grapheneos.apps", "app.grapheneos.info", "app.grapheneos.setupwizard"
  };

  private final SharedPreferences prefs;

  public DeviceModule(ReactApplicationContext ctx) {
    super(ctx);
    prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  @Override
  public void getInfo(Promise promise) {
    Context ctx = getReactApplicationContext();
    WritableMap m = Arguments.createMap();
    m.putString("manufacturer", Build.MANUFACTURER);
    m.putString("model", Build.MODEL);
    m.putString("device", Build.DEVICE);
    m.putInt("sdkInt", Build.VERSION.SDK_INT);
    m.putString("release", Build.VERSION.RELEASE);
    m.putString("buildId", Build.ID);
    m.putString("fingerprint", Build.FINGERPRINT);
    m.putString("securityPatch", Build.VERSION.SECURITY_PATCH);
    m.putBoolean("isGrapheneOS", isGrapheneOS(ctx));
    m.putBoolean("isPixel10Family", PIXEL_10_CODENAMES.contains(Build.DEVICE.toLowerCase(Locale.ROOT)));
    String version = "?";
    try {
      version = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName;
    } catch (PackageManager.NameNotFoundException ignored) {
      // cannot happen for our own package
    }
    m.putString("appVersion", version);
    promise.resolve(m);
  }

  private static boolean isGrapheneOS(Context ctx) {
    PackageManager pm = ctx.getPackageManager();
    for (String pkg : GRAPHENE_PACKAGES) {
      try {
        pm.getPackageInfo(pkg, 0);
        return true;
      } catch (PackageManager.NameNotFoundException ignored) {
        // try next
      }
    }
    String hints = (Build.HOST + " " + Build.DISPLAY + " " + Build.FINGERPRINT).toLowerCase(Locale.ROOT);
    return hints.contains("grapheneos");
  }

  @Override
  public void getPref(String key, Promise promise) {
    promise.resolve(prefs.getString(key, null));
  }

  @Override
  public void setPref(String key, String value) {
    prefs.edit().putString(key, value).apply();
  }

  @Override
  public void openAppSettings() {
    Context ctx = getReactApplicationContext();
    Intent i =
        new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.getPackageName()))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    ctx.startActivity(i);
  }
}
