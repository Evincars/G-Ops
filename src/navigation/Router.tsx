import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BackHandler } from 'react-native';

/**
 * Tiny stack router – no react-navigation dependency. Feature screens are looked up by id in
 * the feature registry; `navigate('wifi')` pushes, Android back pops.
 */
type RouterState = {
  current: string;
  stack: string[];
  navigate: (id: string) => void;
  back: () => boolean;
  reset: (id?: string) => void;
};

const RouterContext = createContext<RouterState | null>(null);

export function RouterProvider({
  initial = 'home',
  children,
}: {
  initial?: string;
  children: React.ReactNode;
}) {
  const [stack, setStack] = useState<string[]>([initial]);

  const navigate = useCallback((id: string) => {
    setStack(s => (s[s.length - 1] === id ? s : [...s, id]));
  }, []);

  const back = useCallback(() => {
    let popped = false;
    setStack(s => {
      if (s.length <= 1) return s;
      popped = true;
      return s.slice(0, -1);
    });
    return popped;
  }, []);

  const reset = useCallback(
    (id: string = initial) => setStack([id]),
    [initial],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        setStack(s => s.slice(0, -1));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const value = useMemo(
    () => ({ current: stack[stack.length - 1], stack, navigate, back, reset }),
    [stack, navigate, back, reset],
  );
  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

export function useRouter(): RouterState {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>');
  return ctx;
}
