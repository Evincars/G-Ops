import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DeviceInfo } from '../native';
import { DEFAULT_THEME, THEMES, Theme, ThemeId } from './themes';

type ThemeState = {
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  scanlines: boolean;
  setScanlines: (on: boolean) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

const PREF_THEME = 'ui.theme';
const PREF_SCANLINES = 'ui.scanlines';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
  const [scanlines, setScanlinesState] = useState(true);

  useEffect(() => {
    DeviceInfo.getPref(PREF_THEME).then(v => {
      if (v && v in THEMES) setThemeIdState(v as ThemeId);
    });
    DeviceInfo.getPref(PREF_SCANLINES).then(v => {
      if (v != null) setScanlinesState(v === '1');
    });
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    DeviceInfo.setPref(PREF_THEME, id);
  }, []);

  const setScanlines = useCallback((on: boolean) => {
    setScanlinesState(on);
    DeviceInfo.setPref(PREF_SCANLINES, on ? '1' : '0');
  }, []);

  const value = useMemo(
    () => ({
      theme: THEMES[themeId],
      themeId,
      setThemeId,
      scanlines,
      setScanlines,
    }),
    [themeId, setThemeId, scanlines, setScanlines],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** `const s = useStyles(makeStyles)` – memoised per theme. */
export function useStyles<T>(factory: (t: Theme) => T): T {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
