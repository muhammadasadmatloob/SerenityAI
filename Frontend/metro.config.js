const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Force 'default' transform profile so Babel fully downcompiles class syntax,
// private fields, etc. before Hermes (hermesc) processes them.
// The bundled hermesc binary doesn't support ES2022 class features in modules.
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// Override the Hermes transform profile to force full ES5 transformation
// instead of the 'hermes-stable' profile which leaves class syntax intact
config.serializer = {
  ...config.serializer,
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force default transform profile (full Babel transforms including classes)
  projectRoot: __dirname,
});
