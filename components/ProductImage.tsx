import React, { useEffect, useState, useRef } from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle, StyleSheet, Animated } from 'react-native';
import { supabase } from '../lib/supabase';

interface ProductImageProps {
  path?: string | null;
  bucket?: string | null;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function ProductImage({ 
  path, 
  bucket = 'booking_products',
  style, 
  containerStyle,
  resizeMode = 'cover',
}: ProductImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadUrl = async () => {
      if (!path) {
        setImageSrc(null);
        setLoading(false);
        return;
      }

      if (path.startsWith('http')) {
        setImageSrc(path);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const bucketName = bucket || 'booking_products';
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
        resizeMode={resizeMode}
      />
    );
  }

  // Shimmer placeholder while loading
  const bgColor = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#e5e7eb', '#f3f4f6', '#e5e7eb'],
  });

  return (
    <Animated.View style={[styles.placeholder, containerStyle, style, { backgroundColor: bgColor }]} />
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
    backgroundColor: '#e5e7eb',
  },
});
