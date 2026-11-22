import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, F } from '../lib/theme';

/** Placeholder until the official logo files arrive: monochrome map pin with an eye cut out. */
export function LogoMark({ size = 36, color = C.red }: { size?: number; color?: string }) {
  return (
    <Svg width={size * 0.75} height={size} viewBox="0 0 24 32">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M12 0C5.4 0 0 5.2 0 11.7 0 20.5 12 32 12 32s12-11.5 12-20.3C24 5.2 18.6 0 12 0zM4.5 11.5C6.6 8 9.2 6.6 12 6.6s5.4 1.4 7.5 4.9C17.4 15 14.8 16.4 12 16.4S6.6 15 4.5 11.5z"
      />
      <Circle cx={12} cy={11.5} r={2.6} fill={color} />
    </Svg>
  );
}

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark size={size * 1.25} />
      <Text style={{ color: C.white, fontFamily: F.black, fontSize: size, letterSpacing: -0.5 }}>najda</Text>
    </View>
  );
}
