module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          // Use 'default' instead of 'hermes-stable' so Babel fully
          // transforms class declarations, private fields, etc.
          // The bundled hermesc binary (0.12.0) requires fully downcompiled JS.
          unstable_transformProfile: "default",
        },
      ],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./",
          },
        },
      ],
      // Required for Moti / Reanimated
      "react-native-reanimated/plugin",
    ],
  };
};
