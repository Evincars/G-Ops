# G-Ops

Modulární „field kit“ pro **GrapheneOS na Google Pixel 10** (frankel / blazer / mustang / rango).
Backend = nativní **Java TurboModuly** v `/android`, frontend = **React Native 0.88** (TypeScript, New Architecture).
UI je terminál/HUD styl se 3 přepínatelnými skiny: `NEON//GRID`, `MATRIX//PHOSPHOR`, `AMBER//CRT`.

## Moduly

| #  | Modul          | Stav    | Co dělá |
|----|----------------|---------|---------|
| 01 | **WiFi Recon** | ready   | scan AP v okolí, SSID/BSSID, dBm, kanál, šířka (20–320 MHz), zabezpečení (OPEN/WEP/WPA/WPA2/WPA3/OWE/EAP), Wi-Fi standard (4/5/6/6E/7, MLO), WPS, graf kanálů pro 2.4 / 5 / 6 GHz, auto-scan |
| 02 | **LAN Portscan** | ready | info o LAN (IP, maska, GW, DNS), host discovery (ICMP + TCP probe), TCP connect scan (presety `homelab`, `top100`, `1-1024`, `all`, vlastní), banner grabbing (HTTP `Server:`, SSH, FTP…), reverse DNS, živá konzole |
| 03 | **Paranoid**   | beta    | živý throughput (TrafficStats), per-app traffic (NetworkStatsManager), vytížení kanálů v okolí, **lokální DNS monitor přes VpnService** – živý seznam domén + aplikace, blokace jedním klepnutím |
| 04 | Sys Config     | ready   | skiny, CRT scanlines, GrapheneOS checklist |
| 05 | BLE Recon      | planned | – |
| 06 | Cell Intel     | planned | – |

## Architektura

```
.
├── index.js                      # registrace RN komponenty "GOps"
├── src/
│   ├── App.tsx                   # providery (safe-area, theme, router) + shell + dock
│   ├── native/
│   │   ├── specs/Native*.ts      # TurboModule specifikace -> codegen -> com.gops.specs.*Spec (Java)
│   │   ├── index.ts              # moduly + typované eventy (DeviceEventEmitter)
│   │   └── permissions.ts
│   ├── theme/                    # 3 skiny + ThemeContext (perzistence přes SharedPreferences)
│   ├── navigation/Router.tsx     # mini stack router (bez react-navigation), Android back
│   ├── ui/                       # Mono, Panel, TButton, Segmented, Sparkline, SignalBars, ...
│   └── features/
│       ├── catalog.ts            # metadata modulů (home grid + dock)
│       ├── registry.ts           # id -> obrazovka
│       ├── wifi/  lan/  paranoid/  settings/  home/
└── android/app/src/main/java/com/gops/
    ├── MainApplication.java / MainActivity.java / GOpsPackage.java
    ├── core/      Events, Net (IPv4 + LAN network lookup), AppResolver (UID -> app)
    ├── device/    DeviceModule       – detekce GrapheneOS / Pixel 10, prefs
    ├── wifi/      WifiScannerModule, WifiParser
    ├── lan/       PortScannerModule, PortScanEngine, TargetParser, ServiceRegistry
    ├── traffic/   TrafficMonitorModule
    └── dns/       DnsVpnService, DnsMonitorModule, DnsPacket, IpPacket, DnsBlocklist, DnsLog
```

**Nativní → JS eventy:** `GOps.WifiScan`, `GOps.PortScan`, `GOps.Dns` (viz `core/Events.java` ↔ `src/native/index.ts`).

### Přidání nové featury
1. `src/native/specs/NativeXyz.ts` – TS spec (`TurboModuleRegistry.getEnforcing<Spec>('GOpsXyz')`).
2. Build (nebo `npm run codegen`) vygeneruje `com.gops.specs.NativeXyzSpec`.
3. `android/.../xyz/XyzModule.java extends NativeXyzSpec` + registrace v `GOpsPackage`.
4. `src/features/xyz/XyzScreen.tsx` + záznam v `catalog.ts` a `registry.ts`.

## Build

Požadavky: Node ≥ 22.11, **JDK 17 nebo 21** (Gradle 9.4 s JDK 27 nepoběží), Android SDK
(platform 37, build-tools 37.0.0, NDK 27.1.12297006, CMake – nejjednodušeji přes Android Studio).

```bash
npm install
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
export ANDROID_HOME=$HOME/Android/Sdk
npm start                 # Metro
npm run android           # debug build + instalace přes adb (USB debugging na Pixelu)
npm run android:release   # APK v android/app/build/outputs/apk/release (podepsané debug klíčem!)
```

Jen `arm64-v8a` (Tensor G5). Pro emulátor přidej `x86_64` do `reactNativeArchitectures` v `android/gradle.properties`.
Před reálným release si vygeneruj vlastní keystore a nastav `signingConfigs.release` v `android/app/build.gradle`.

Kontroly: `npm run typecheck`, `npm run lint`, `npm test`.

## Nastavení na GrapheneOS

- **Network** permission (GrapheneOS toggle) pro G-Ops musí být zapnutá.
- **Location (precise) + Nearby devices** a zapnutá poloha – Android bez toho nevrátí výsledky Wi-Fi scanu.
- **Developer options → Wi-Fi scan throttling → OFF** – jinak max. 4 scany / 2 min.
- **Special app access → Usage access → G-Ops** – per-app statistiky provozu.
- **Private DNS** na *Off* nebo *Automatic*, když běží DNS monitor (strict DoT ho obchází).
- DNS monitor je VPN → nemůže běžet zároveň s jinou VPN (Mullvad, Proton, …).

## Jak to funguje / omezení

- **Port scanner** je vlastní Java implementace (`nmap -sT` styl, žádný root ani nativní binárka). Hotový `nmap`
  by šel přibalit jako `libnmap.so` do `jniLibs`, ale bez rootu umí stejně jen connect scan a přidal by ~10 MB
  a GPL závislost. Scanner **odmítá veřejné IP** – jen 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10 (Tailscale).
- Android 10+ appkám blokuje `/proc/net/arp` → MAC adresy/výrobci zařízení v LAN nejsou dostupné.
- **TrafficStats** per-UID od Androidu 7 vrací jen vlastní appku, proto per-app data jdou přes `NetworkStatsManager`
  (systém je flushuje průběžně → „téměř“ real-time; sloupec `+delta` ukazuje přírůstek od posledního pollu).
- **DNS monitor**: VPN směruje do TUN jen virtuální DNS `10.111.222.53/32`, ostatní provoz jde mimo. Dotazy se
  přeposílají na DNS podkladové sítě (nebo zadaný upstream), blokované dostanou `NXDOMAIN`. Přiřazení k aplikaci
  přes `ConnectivityManager.getConnectionOwnerUid()` je best-effort – dotazy přes systémový resolver se mohou
  objevit jako „System DNS resolver“. Aplikace s vlastním DoH (např. prohlížeče se „Secure DNS“) monitor obchází.
  Blokace domény blokuje i subdomény; long-press blokuje základní doménu.
