import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

const SplashScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  // ─── Base Animations ───
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(20)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const textPulse = useRef(new Animated.Value(1)).current;

  // ─── Physical Tag Shape Animations ───
  const tagDrop = useRef(new Animated.Value(-150)).current; 
  const tagScale = useRef(new Animated.Value(0.2)).current;   
  const tagRotate = useRef(new Animated.Value(0)).current; 
  const tagFloat = useRef(new Animated.Value(0)).current; 

  // ─── Trail Dots Animations ───
  const dot1Scale = useRef(new Animated.Value(0)).current;
  const dot2Scale = useRef(new Animated.Value(0)).current;
  const dot3Scale = useRef(new Animated.Value(0)).current;
  const dot1X = useRef(new Animated.Value(50)).current;
  const dot2X = useRef(new Animated.Value(50)).current;
  const dot3X = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // 1. Base UI and Progress Bar load
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideY,  { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: 2500, useNativeDriver: false }), 
    ]).start();

    // 2. The Physical Tag drops, scales, and spins
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.spring(tagDrop, { toValue: 0, tension: 40, friction: 6, useNativeDriver: true }),
        Animated.spring(tagScale, { toValue: 1, tension: 40, friction: 6, useNativeDriver: true }),
        Animated.timing(tagRotate, { toValue: 1, duration: 800, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true })
      ])
    ]).start(() => {
      // 3. Once it lands, start the continuous floating effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(tagFloat, { toValue: -8, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(tagFloat, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ).start();
    });

    // 4. The Trail shoots out from behind the physical tag shape
    Animated.sequence([
      Animated.delay(400), 
      Animated.stagger(120, [
        Animated.parallel([
          Animated.spring(dot1Scale, { toValue: 1, tension: 60, friction: 5, useNativeDriver: true }),
          Animated.spring(dot1X, { toValue: 0, tension: 50, friction: 6, useNativeDriver: true })
        ]),
        Animated.parallel([
          Animated.spring(dot2Scale, { toValue: 1, tension: 60, friction: 5, useNativeDriver: true }),
          Animated.spring(dot2X, { toValue: 0, tension: 50, friction: 6, useNativeDriver: true })
        ]),
        Animated.parallel([
          Animated.spring(dot3Scale, { toValue: 1, tension: 60, friction: 5, useNativeDriver: true }),
          Animated.spring(dot3X, { toValue: 0, tension: 50, friction: 6, useNativeDriver: true })
        ]),
      ])
    ]).start();

    // 5. Pulsing status text
    Animated.loop(
      Animated.sequence([
        Animated.timing(textPulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(textPulse, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
    
    const t = setTimeout(() => navigation.replace('Main'), 2800);
    return () => clearTimeout(t);
  }, []);

  // ─── PRO ANIMATION INTERPOLATIONS ───
  
  // Progress Bar width
  const loadingWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  
  // Tag 3D Entrance Spin
  const spin = tagRotate.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] });

  // Windburst Particles (Triggers EXACTLY during the entrance spin!)
  const burstDistance = tagRotate.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const burstOpacity = tagRotate.interpolate({ inputRange: [0, 0.4, 0.8, 1], outputRange: [0, 1, 0.8, 0] });

  // COMBINED MATH: We combine the Entrance Drop and the Continuous Hover to drive the shadow dynamically!
  const combinedY = Animated.add(tagDrop, tagFloat);
  
  // 3D Shadow pulses based on distance from the ground
  const shadowScale = combinedY.interpolate({ 
    inputRange: [-150, -8, 0, 20], 
    outputRange: [0.2, 0.7, 1.2, 1.4], 
    extrapolate: 'clamp' 
  });
  const shadowOpacity = combinedY.interpolate({ 
    inputRange: [-150, -8, 0, 20], 
    outputRange: [0, 0.3, 0.7, 0.9], 
    extrapolate: 'clamp' 
  });

  return (
    <View style={s.container}>
      
      {/* ── The Animation Row ── */}
      <View style={s.animationRow}>
        
        {/* The Trail */}
        <View style={s.trailContainer}>
          <Animated.View style={[s.trailDot, { transform: [{ translateX: dot3X }, { scale: dot3Scale }] }]} />
          <Animated.View style={[s.trailDot, { transform: [{ translateX: dot2X }, { scale: dot2Scale }] }]} />
          <Animated.View style={[s.trailDot, { transform: [{ translateX: dot1X }, { scale: dot1Scale }] }]} />
        </View>

        {/* ── THE TAG & EFFECTS WRAPPER ── */}
        <View style={s.tagWrap}>
          
          {/* 1. Pulsing 3D Ground Shadow */}
          <Animated.View style={[s.groundShadow, { 
            opacity: shadowOpacity, 
            transform: [{ scaleX: shadowScale }, { scaleY: shadowScale }] 
          }]} />

          {/* 2. Entrance Windburst Particles */}
          <View style={s.burstContainer}>
            <Animated.View style={[s.particle, s.particleVert, { opacity: burstOpacity, transform: [{ translateY: Animated.multiply(burstDistance, -1) }] }]} />
            <Animated.View style={[s.particle, s.particleVert, { opacity: burstOpacity, transform: [{ translateY: burstDistance }] }]} />
            <Animated.View style={[s.particle, s.particleHoriz, { opacity: burstOpacity, transform: [{ translateX: Animated.multiply(burstDistance, -1) }] }]} />
            <Animated.View style={[s.particle, s.particleHoriz, { opacity: burstOpacity, transform: [{ translateX: burstDistance }] }]} />
          </View>

          {/* 3. The Physical Tag Shape */}
          <Animated.View style={[
            s.tagShapeContainer, 
            { transform: [
                { translateY: combinedY }, // Uses our combined math value!
                { scale: tagScale },
                { rotate: spin }
              ] 
            }
          ]}>
            <View style={s.tagTip} />
            <View style={s.tagHole} />
            <View style={s.tagBody} />
          </Animated.View>

        </View>
        
      </View>

      {/* ── Sliding & Pulsing Text ── */}
      <Animated.View style={{ opacity, transform: [{ translateY: slideY }], alignItems: 'center', marginTop: 30 }}>
        <Text style={s.title}>
          TagAnd<Text style={{ color: '#F5D1B0' }}>Trail</Text>
        </Text>
        <Animated.Text style={[s.subtitle, { opacity: textPulse }]}>
          Establishing data trails...
        </Animated.Text>
      </Animated.View>

      {/* ── Active Progress Bar ── */}
      <Animated.View style={[s.loaderTrack, { opacity }]}>
        <Animated.View style={[s.loaderFill, { width: loadingWidth }]} />
      </Animated.View>
    </View>
  );
};

export default SplashScreen;

const s = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#2D464C', 
    alignItems: 'center', 
    justifyContent: 'center', 
  },
  animationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -45, 
    height: 120, 
  },
  
  // ─── Tag Wrapper & Effects ───
  tagWrap: {
    width: 90,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  groundShadow: {
    position: 'absolute',
    bottom: -20, // Pushed below the tag
    width: 60,
    height: 12, // Oval shape
    backgroundColor: '#000000', 
    borderRadius: 100,
  },
  burstContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  particle: { position: 'absolute', backgroundColor: '#F5D1B0', borderRadius: 2 },
  particleVert: { width: 3, height: 16 },
  particleHoriz: { width: 16, height: 3 },

  // ─── Tag Shape Styles ───
  tagShapeContainer: { 
    width: 90, 
    height: 50, 
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#F5D1B0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 2, 
  },
  tagBody: { position: 'absolute', right: 0, width: 60, height: 50, backgroundColor: '#F5D1B0', borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  tagTip: { position: 'absolute', left: 25 - 17.5, top: 25 - 17.5, width: 35, height: 35, backgroundColor: '#F5D1B0', transform: [{ rotate: '45deg' }], borderRadius: 3 },
  tagHole: { position: 'absolute', left: 12, top: 25 - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#2D464C', zIndex: 10 },
  
  // ─── Trail Dots Styles ───
  trailContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 10, gap: 12, zIndex: 1 },
  trailDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ADE80', shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 4 },
  
  // ─── Text & Loader Styles ───
  title: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#4ADE80', marginTop: 10, textAlign: 'center', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  loaderTrack: { width: 52, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, marginTop: 35, overflow: 'hidden' },
  loaderFill: { height: '100%', backgroundColor: '#F5D1B0', borderRadius: 10 },
});