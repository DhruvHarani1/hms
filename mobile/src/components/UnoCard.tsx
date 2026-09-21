import { Pressable, Text, View } from 'react-native';

const COLOR_HEX: Record<string, string> = {
  red: '#e6392b',
  yellow: '#f2c40f',
  green: '#2ea043',
  blue: '#1b6ec2',
};

function valueLabel(value: string): string {
  if (value === 'skip') return '⊘';
  if (value === 'reverse') return '⇄';
  if (value === 'draw2') return '+2';
  if (value === 'draw4') return '+4';
  if (value === 'wild') return '★';
  return value;
}

export function parseUnoCard(cardId: string): { color: string; value: string } {
  const [color, value] = cardId.split('_');
  return { color, value };
}

export function UnoCard({
  cardId,
  size = 'md',
  onPress,
  disabled,
  faceDown,
}: {
  cardId: string;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  disabled?: boolean;
  faceDown?: boolean;
}) {
  const dims = size === 'sm' ? { w: 46, h: 66, font: 18, corner: 10 } : size === 'lg' ? { w: 84, h: 122, font: 34, corner: 15 } : { w: 62, h: 90, font: 24, corner: 12 };

  if (faceDown) {
    return (
      <View
        style={{
          width: dims.w,
          height: dims.h,
          borderRadius: 8,
          backgroundColor: '#1c1c2e',
          borderWidth: 2,
          borderColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#e6392b', fontWeight: '900', fontSize: dims.font * 0.8, fontStyle: 'italic' }}>UNO</Text>
      </View>
    );
  }

  const { color, value } = parseUnoCard(cardId);
  const label = valueLabel(value);
  const isWild = color === 'wild';

  const Content = (
    <View
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: 8,
        backgroundColor: isWild ? '#111' : COLOR_HEX[color],
        borderWidth: 2,
        borderColor: '#fff',
        padding: 4,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text style={{ position: 'absolute', top: 3, left: 5, color: '#fff', fontWeight: '800', fontSize: dims.corner }}>
        {label}
      </Text>

      {isWild ? (
        <View style={{ flex: 1, borderRadius: 40, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', margin: 4 }}>
          {(['red', 'yellow', 'green', 'blue'] as const).map((c) => (
            <View key={c} style={{ width: '50%', height: '50%', backgroundColor: COLOR_HEX[c] }} />
          ))}
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: dims.h,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: '-20deg' }],
            marginTop: 6,
          }}
        >
          <Text style={{ color: COLOR_HEX[color], fontWeight: '900', fontSize: dims.font }}>{label}</Text>
        </View>
      )}

      <Text
        style={{
          position: 'absolute',
          bottom: 3,
          right: 5,
          color: '#fff',
          fontWeight: '800',
          fontSize: dims.corner,
          transform: [{ rotate: '180deg' }],
        }}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return Content;
  return (
    <Pressable onPress={onPress} disabled={disabled}>
      {Content}
    </Pressable>
  );
}
