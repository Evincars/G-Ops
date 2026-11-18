import { PermissionsAndroid } from 'react-native';

/** Wi-Fi scan results need FINE_LOCATION (+ location toggle on); NEARBY_WIFI_DEVICES for API 33+. */
export async function ensureWifiPermissions(): Promise<boolean> {
  const P = PermissionsAndroid.PERMISSIONS;
  const res = await PermissionsAndroid.requestMultiple([
    P.ACCESS_FINE_LOCATION,
    P.NEARBY_WIFI_DEVICES,
  ]);
  return res[P.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
}
