package com.gops;

import android.app.Application;

import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactNativeApplicationEntryPoint;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultReactHost;

import java.util.Collections;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  private ReactHost reactHost;

  @Override
  public synchronized ReactHost getReactHost() {
    if (reactHost == null) {
      List<ReactPackage> packages = new PackageList(this).getPackages();
      // Our own Java TurboModules (Wi-Fi, LAN scanner, traffic, DNS monitor, device).
      packages.add(new GOpsPackage());

      // DefaultReactHost is Kotlin without @JvmOverloads -> all arguments must be passed.
      reactHost =
          DefaultReactHost.getDefaultReactHost(
              getApplicationContext(),
              packages,
              "index", // jsMainModulePath
              "index.android.bundle", // jsBundleAssetPath
              null, // jsBundleFilePath
              null, // jsRuntimeFactory (null = Hermes)
              BuildConfig.DEBUG, // useDevSupport
              Collections.emptyList(), // cxxReactPackageProviders
              e -> {
                throw new RuntimeException(e);
              },
              null); // bindingsInstaller
    }
    return reactHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    ReactNativeApplicationEntryPoint.loadReactNative(this);
  }
}
