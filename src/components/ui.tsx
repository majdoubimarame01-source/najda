import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = C.white }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { C, F, R } from '../lib/theme';

type BtnProps = {
  title: string;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  variant?: 'red' | 'blue' | 'dark' | 'green' | 'ghost';
  big?: boolean;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: IconName;
};

const BG = { red: C.red, blue: C.blue, dark: C.cardHi, green: C.green, ghost: 'transparent' };

export function Btn({ title, onPress, onLongPress, delayLongPress, variant = 'dark', big, loading, disabled, style, textStyle, icon }: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: BG[variant], minHeight: big ? 76 : 58, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: C.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'green' ? '#000' : '#fff'} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {icon && (
            <Icon
              name={icon}
              size={big ? 24 : 19}
              color={(textStyle?.color as string) ?? (variant === 'green' ? '#000' : C.white)}
            />
          )}
          <Text
            style={[
              styles.btnTxt,
              big && { fontSize: 22, fontFamily: F.title, letterSpacing: 0.5 },
              variant === 'green' && { color: '#000' },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Label({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export const styles = StyleSheet.create({
  btn: { borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnTxt: { color: C.white, fontFamily: F.bold, fontSize: 18 },
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 16 },
  label: { color: C.grey, fontFamily: F.semi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  h1: { color: C.white, fontFamily: F.title, fontSize: 30 },
  body: { color: C.text2, fontFamily: F.body, fontSize: 16 },
  screen: { flex: 1, backgroundColor: C.bg },
});
