import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from '../navigation/Router';
import { Header } from './Header';

type Props = {
  code: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  /** false for screens that manage their own scrolling (FlatList...) */
  scroll?: boolean;
};

/** Standard feature screen: header with back + scrollable content. */
export function Screen({ code, title, right, children, scroll = true }: Props) {
  const { stack, back } = useRouter();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex]}>{children}</View>
  );
  return (
    <View style={styles.flex}>
      <Header
        code={code}
        title={title}
        onBack={stack.length > 1 ? back : undefined}
        right={right}
      />
      <View style={styles.flex}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 12, paddingBottom: 32 },
});
