import React, { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface AvatarProps {
  url?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  placeholderColor?: string;
  name?: string; // For initials placeholder
}

export function Avatar({ 
  url, 
  size = 40, 
  style, 
  containerStyle,
  placeholderColor = '#f3f4f6',
  name 
}: AvatarProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    const loadUrl = async () => {
      if (!url) {
        setImageSrc(null);
        return;
      }

      if (url.startsWith('http') || url.startsWith('file:')) {
        setImageSrc(url);
        return;
      }

      setLoading(true);
      try {
        // Assume bucket is 'profile-images'
        let path = url;
        // Remove bucket name if present in path to get relative path
        if (path.startsWith('profile-images/')) {
          path = path.substring('profile-images/'.length);
        }

        const { data, error } = await supabase.storage
          .from('profile-images')
          .createSignedUrl(path, 3600);

        if (error) {
          console.warn('Error signing avatar URL:', error.message);
          if (isMounted) setImageSrc(null);
        } else if (data && isMounted) {
          setImageSrc(data.signedUrl);
        }
      } catch (e) {
        console.warn('Error loading avatar:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUrl();

    return () => {
      isMounted = false;
    };
  }, [url]);

  const initials = name 
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : null;

  if (imageSrc && !hasError) {
    return (
      <Image
        source={{ uri: imageSrc }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: placeholderColor 
        },
        containerStyle
      ]}
    >
      {initials ? (
        <Text style={{ fontSize: size * 0.4, fontWeight: '600', color: '#6b7280' }}>
          {initials}
        </Text>
      ) : (
        <Feather name="user" size={size * 0.5} color="#9ca3af" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});
