import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  KeyboardAvoidingView, Platform, StatusBar, Animated, Easing 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

const LoginScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  
  // ─── FORM STATE ───
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  // ─── ANIMATION SETUP ─────────────────────────────────────────
  const tagY = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  
  // Bouncing dots
  const dot1Y = useRef(new Animated.Value(0)).current;
  const dot2Y = useRef(new Animated.Value(0)).current;
  const dot3Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. MASTER CHOREOGRAPHY (6.5 second total loop)
    Animated.loop(
      Animated.sequence([
        // Normal gentle hover 1 (2.5s)
        Animated.timing(tagY, { toValue: -18, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(tagY, { toValue: 0, duration: 1000, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        
        // Normal gentle hover 2 (2.5s)
        Animated.timing(tagY, { toValue: -18, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(tagY, { toValue: 0, duration: 1000, easing: Easing.in(Easing.quad), useNativeDriver: true }),

        // THE BURST: Shoots up to -70, flips, and slams down (1s + 0.5s delay)
        Animated.timing(tagY, { toValue: -70, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tagY, { toValue: 0, duration: 600, easing: Easing.bounce, useNativeDriver: true }),
        
        Animated.delay(500) // Rest before looping
      ])
    ).start();

    // 2. Syncing the 3D Flip & Particles EXACTLY with the Burst Jump
    Animated.loop(
      Animated.sequence([
        Animated.delay(5000), // Wait exactly 5 seconds (Hover 1 + Hover 2)
        Animated.timing(flipAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(flipAnim, { toValue: 0, duration: 0, useNativeDriver: true }), // Reset instantly
        Animated.delay(700) // Fill the rest of the 6.5s loop
      ])
    ).start();

    // 3. Dancing Trail Dots
    const jump = (anim: Animated.Value) => Animated.sequence([
      Animated.timing(anim, { toValue: -12, duration: 250, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 400, easing: Easing.bounce, useNativeDriver: true }),
      Animated.delay(1200)
    ]);

    Animated.loop(
      Animated.stagger(150, [jump(dot3Y), jump(dot2Y), jump(dot1Y)])
    ).start();

  }, [tagY, flipAnim, dot1Y, dot2Y, dot3Y]);

  // ─── INTERPOLATIONS ───
  const spinY = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // 3D Shadow dynamically shrinks down to almost nothing when it hits -70 in the burst
  const shadowScale = tagY.interpolate({ 
    inputRange: [-70, -18, 0], 
    outputRange: [0.2, 0.6, 1.2], 
    extrapolate: 'clamp' 
  });
  const shadowOpacity = tagY.interpolate({ 
    inputRange: [-70, -18, 0], 
    outputRange: [0.05, 0.2, 0.6], 
    extrapolate: 'clamp' 
  });

  // Windburst Particles
  const burstDistance = flipAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] });
  const burstOpacity = flipAnim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 0.8, 0] });

  // ─── ACTIONS ───
  const handleSubmit = async () => {
    setError(''); 
    
    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    if (!API_URL) {
      setError("API URL is missing in .env file!");
      return;
    }
    
    // Local App Validations
    if (isLogin) {
      if (!phone || !password) {
        setError('Please enter phone and password.');
        return;
      }
    } else {
      if (!phone || !password || !confirmPass) {
        setError('Please fill out all fields.');
        return;
      }
      if (password !== confirmPass) {
        setError('Passwords do not match.');
        return;
      }
    }

    // Backend Connection
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: phone,
          password: password 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ Success! User Data:`, data);
        await AsyncStorage.setItem('userId', data._id);
        navigation.replace('Splash'); 
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      console.error("Network error:", err);
      setError("Server unreachable. Check your IP address!");
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[s.container, { paddingTop: insets.top }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />
      
      <View style={s.content}>
        {/* ─── BRAND HEADER ─── */}
        <View style={s.brandWrap}>
          
          <View style={s.logoWrapper}>
            {/* 1. Realistic 3D Ground Shadow */}
            <Animated.View style={[s.groundShadow, { 
              opacity: shadowOpacity, 
              transform: [{ scaleX: shadowScale }, { scaleY: shadowScale }, { translateX: 15 }] 
            }]} />

            {/* 2. The Bouncing Data Trail */}
            <View style={s.trailContainer}>
              <Animated.View style={[s.trailDot, { transform: [{ translateY: dot3Y }] }]} />
              <Animated.View style={[s.trailDot, { transform: [{ translateY: dot2Y }] }]} />
              <Animated.View style={[s.trailDot, { transform: [{ translateY: dot1Y }] }]} />
            </View>

            {/* 3. Windburst Particles */}
            <View style={s.burstContainer}>
              <Animated.View style={[s.particle, s.particleVert, { opacity: burstOpacity, transform: [{ translateY: Animated.multiply(burstDistance, -1) }] }]} />
              <Animated.View style={[s.particle, s.particleVert, { opacity: burstOpacity, transform: [{ translateY: burstDistance }] }]} />
              <Animated.View style={[s.particle, s.particleHoriz, { opacity: burstOpacity, transform: [{ translateX: Animated.multiply(burstDistance, -1) }] }]} />
              <Animated.View style={[s.particle, s.particleHoriz, { opacity: burstOpacity, transform: [{ translateX: burstDistance }] }]} />
            </View>

            {/* 4. The Choreographed Tag Shape */}
            <Animated.View style={[
              s.tagShapeContainer, 
              { transform: [{ translateY: tagY }, { rotateY: spinY }] }
            ]}>
              <View style={s.tagTip} />
              <View style={s.tagHole} />
              <View style={s.tagBody} />
            </Animated.View>
          </View>

          <Text style={s.brandName}>
            TagAnd<Text style={{ color: '#F5D1B0' }}>Trail</Text>
          </Text>
          <Text style={s.subhead}>Secure Intelligence Workspace</Text>
        </View>

        {/* ─── FORM CONTAINER ─── */}
        <View style={s.form}>
          
          {/* ─── LOGIN / NEW USER TOGGLE ─── */}
          <View style={s.tabWrap}>
            <TouchableOpacity onPress={() => { setIsLogin(true); setError(''); }} style={[s.tab, isLogin && s.tabActive]}>
              <Text style={[s.tabText, isLogin && s.tabTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setIsLogin(false); setError(''); }} style={[s.tab, !isLogin && s.tabActive]}>
              <Text style={[s.tabText, !isLogin && s.tabTextActive]}>New User</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={s.errorTxt}>{error}</Text> : null}

          {/* Phone Input */}
          <View style={s.inputWrap}>
            <Feather name="phone" size={20} color="rgba(255,255,255,0.4)" />
            <TextInput 
              style={s.input}
              placeholder="Phone Number"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(txt) => { setPhone(txt); setError(''); }}
            />
          </View>

          {/* Password Input */}
          <View style={s.inputWrap}>
            <Feather name="lock" size={20} color="rgba(255,255,255,0.4)" />
            <TextInput 
              style={s.input}
              placeholder={isLogin ? "Password" : "Create Password"}
              placeholderTextColor="rgba(255,255,255,0.4)"
              secureTextEntry={!showPass}
              value={password}
              onChangeText={(txt) => { setPassword(txt); setError(''); }}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
              <Feather name={showPass ? "eye" : "eye-off"} size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input (Only shows if "New User" is selected) */}
          {!isLogin && (
            <View style={s.inputWrap}>
              <Feather name="shield" size={20} color="rgba(255,255,255,0.4)" />
              <TextInput 
                style={s.input}
                placeholder="Retype Password"
                placeholderTextColor="rgba(255,255,255,0.4)"
                secureTextEntry={!showPass}
                value={confirmPass}
                onChangeText={(txt) => { setConfirmPass(txt); setError(''); }}
              />
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity style={s.loginBtn} onPress={handleSubmit} activeOpacity={0.8}>
            <Text style={s.loginBtnTxt}>{isLogin ? "Access Workspace" : "Create Account"}</Text>
            <Feather name={isLogin ? "arrow-right" : "check-circle"} size={20} color="#2D464C" />
          </TouchableOpacity>
          
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2D464C' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  brandWrap: { alignItems: 'center', marginBottom: 40 },
  
  // ─── Logo Wrapper ───
  logoWrapper: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 140, // Taller to fit the massive jump
    marginBottom: 0,
    marginLeft: -20, 
    position: 'relative'
  },

  groundShadow: {
    position: 'absolute',
    bottom: 20,
    width: 55,
    height: 10, 
    backgroundColor: '#000000', 
    borderRadius: 100,
  },

  burstContainer: {
    position: 'absolute',
    right: 35,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  particle: { position: 'absolute', backgroundColor: '#F5D1B0', borderRadius: 2 },
  particleVert: { width: 3, height: 16 },
  particleHoriz: { width: 16, height: 3 },

  trailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    gap: 10,
    zIndex: 2,
  },
  trailDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4ADE80', shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4,
  },

  tagShapeContainer: { 
    width: 70, height: 40, flexDirection: 'row', alignItems: 'center', position: 'relative',
    shadowColor: '#F5D1B0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8, zIndex: 5,
  },
  tagBody: { position: 'absolute', right: 0, width: 50, height: 40, backgroundColor: '#F5D1B0', borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  tagTip: { position: 'absolute', left: 20 - 14, top: 20 - 14, width: 28, height: 28, backgroundColor: '#F5D1B0', transform: [{ rotate: '45deg' }], borderRadius: 3 },
  tagHole: { position: 'absolute', left: 10, top: 20 - 5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#2D464C', zIndex: 10 },
  
  brandName: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  subhead: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 8 },
  
  // ─── Tabs & Form ───
  form: { width: '100%' },
  tabWrap: { 
    flexDirection: 'row', 
    backgroundColor: 'rgba(255,255,255,0.06)', 
    borderRadius: 12, 
    padding: 4, 
    marginBottom: 20 
  },
  tab: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderRadius: 10 
  },
  tabActive: { backgroundColor: '#F5D1B0' },
  tabText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  tabTextActive: { color: '#2D464C' },

  errorTxt: { color: '#FF8484', textAlign: 'center', marginBottom: 15, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, height: 60, paddingHorizontal: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  input: { flex: 1, marginLeft: 15, color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  loginBtn: { flexDirection: 'row', backgroundColor: '#F5D1B0', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  loginBtnTxt: { color: '#2D464C', fontSize: 18, fontWeight: '800' },
});