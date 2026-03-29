module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // NOTE: Do NOT add react-native-reanimated/plugin here for SDK 54.
    // babel-preset-expo handles Reanimated v4 automatically.
  };
};
