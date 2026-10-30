module.exports = {
  preset: '@react-native/jest-preset',
  // Preset only transforms react-native packages; these also ship untranspiled ESM.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[^/]+)?|@react-native(-community|-firebase|-async-storage)?|@react-navigation|@rn-primitives|@shopify/flash-list|nativewind)/)',
  ],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/styleMock.js',
    // lucide's react-native entries are .mjs, which the preset doesn't transform; its CJS build needs no transform.
    // In-memory AsyncStorage (the native module doesn't exist under Jest).
    '^@react-native-async-storage/async-storage$': '<rootDir>/node_modules/@react-native-async-storage/async-storage/lib/module/jest/AsyncStorageMock.js',
    '^lucide-react-native/icons/(.*)$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
};
