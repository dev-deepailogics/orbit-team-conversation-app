module.exports = {
  // nativewind/babel already includes the Reanimated/Worklets plugin.
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [['module-resolver', { root: ['.'], alias: { '@': './src' } }]],
};
