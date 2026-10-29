module.exports = {
  preset: '@react-native/jest-preset',
  // Preset only transforms react-native packages; these also ship untranspiled ESM.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[^/]+)?|@react-native(-community|-firebase)?|@react-navigation|@rn-primitives|@shopify/flash-list|nativewind)/)',
  ],
  moduleNameMapper: { '\\.css$': '<rootDir>/__mocks__/styleMock.js' },
};
