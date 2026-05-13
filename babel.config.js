module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "babel-plugin-module-resolver",
        {
          alias: {
            "react-native-is-edge-to-edge": "./src/shims/react-native-is-edge-to-edge.js",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
