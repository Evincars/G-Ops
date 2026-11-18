package com.gops;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.gops.device.DeviceModule;
import com.gops.dns.DnsMonitorModule;
import com.gops.lan.PortScannerModule;
import com.gops.traffic.TrafficMonitorModule;
import com.gops.wifi.WifiScannerModule;

import java.util.HashMap;
import java.util.Map;

/**
 * Registers all G-Ops Java TurboModules. Each module extends a spec class that React Native
 * codegen generates from {@code src/native/specs/Native*.ts} into {@code com.gops.specs}.
 *
 * <p>Adding a new feature module = add a TS spec, run a build (codegen), implement the Java class,
 * register it here.
 */
public class GOpsPackage extends BaseReactPackage {

  @Nullable
  @Override
  public NativeModule getModule(@NonNull String name, @NonNull ReactApplicationContext ctx) {
    switch (name) {
      case DeviceModule.NAME:
        return new DeviceModule(ctx);
      case WifiScannerModule.NAME:
        return new WifiScannerModule(ctx);
      case PortScannerModule.NAME:
        return new PortScannerModule(ctx);
      case TrafficMonitorModule.NAME:
        return new TrafficMonitorModule(ctx);
      case DnsMonitorModule.NAME:
        return new DnsMonitorModule(ctx);
      default:
        return null;
    }
  }

  @NonNull
  @Override
  public ReactModuleInfoProvider getReactModuleInfoProvider() {
    return () -> {
      Map<String, ReactModuleInfo> infos = new HashMap<>();
      put(infos, DeviceModule.NAME, DeviceModule.class);
      put(infos, WifiScannerModule.NAME, WifiScannerModule.class);
      put(infos, PortScannerModule.NAME, PortScannerModule.class);
      put(infos, TrafficMonitorModule.NAME, TrafficMonitorModule.class);
      put(infos, DnsMonitorModule.NAME, DnsMonitorModule.class);
      return infos;
    };
  }

  private static void put(Map<String, ReactModuleInfo> infos, String name, Class<?> cls) {
    infos.put(
        name,
        new ReactModuleInfo(
            name,
            cls.getName(),
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // isCxxModule
            true)); // isTurboModule
  }
}
