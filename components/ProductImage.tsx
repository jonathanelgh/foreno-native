import React, { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

interface ProductImageProps {
  path?: string | null;
  bucket?: string | null;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export function ProductImage({ 
  path, 
  bucket = 'booking_products', // Default bucket if any? Or rely on prop
  style, 
  containerStyle 
}: ProductImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadUrl = async () => {
      if (!path) {
        setImageSrc(null);
        return;
      }

      if (path.startsWith('http')) {
        setImageSrc(path);
        return;
      }

      setLoading(true);
      try {
        const bucketName = bucket || 'booking_products'; // Fallback
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(path, 3600);

        if (error) {
          console.warn('Error signing product image URL:', error.message);
          if (isMounted) setImageSrc(null);
        } else if (data && isMounted) {
          setImageSrc(data.signedUrl);
        }
      } catch (e) {
        console.warn('Error loading product image:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUrl();

    return () => {
      isMounted = false;
    };
  }, [path, bucket]);

  if (imageSrc) {
    return (
      <Image
        source={{ uri: imageSrc }}
        style={[styles.image, style]}
      />
    );
  }

  return (
    <View style={[styles.placeholder, containerStyle]}>
      <Feather name="calendar" size={24} color="#2563eb" />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  placeholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
