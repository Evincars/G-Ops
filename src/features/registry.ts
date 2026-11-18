import type React from 'react';
import { FEATURES, Feature, HOME } from './catalog';
import { HomeScreen } from './home/HomeScreen';
import { PortScanScreen } from './lan/PortScanScreen';
import { ParanoidScreen } from './paranoid/ParanoidScreen';
import { SettingsScreen } from './settings/SettingsScreen';
import { WifiScreen } from './wifi/WifiScreen';

export { FEATURES, HOME };
export type { Feature };

/** Feature id -> screen component. Planned features have no screen yet. */
export const SCREENS: Record<string, React.ComponentType> = {
  [HOME.id]: HomeScreen,
  wifi: WifiScreen,
  lan: PortScanScreen,
  paranoid: ParanoidScreen,
  settings: SettingsScreen,
};
