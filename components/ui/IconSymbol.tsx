// Using Feather icons for consistent modern look across all platforms.

import Feather from '@expo/vector-icons/Feather';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof Feather>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Modern Feather icons mapping for SF Symbols.
 * Feather icons provide a clean, consistent look across all platforms.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'newspaper.fill': 'file-text',
  'calendar': 'calendar',
  'person.2.fill': 'users',
  'folder.fill': 'folder',
  'person.fill': 'user',
} as IconMapping;

/**
 * An icon component that uses Feather icons for a modern, consistent look.
 * Feather icons provide excellent visual consistency across all platforms.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <Feather color={color} size={size} name={MAPPING[name]} style={style} />;
}
