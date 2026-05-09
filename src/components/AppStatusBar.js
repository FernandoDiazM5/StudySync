import React, { useEffect } from "react";
import { AppState, Platform } from "react-native";
import {
  StatusBar as ExpoStatusBar,
  setStatusBarBackgroundColor,
  setStatusBarStyle,
  setStatusBarTranslucent,
} from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import { useTheme } from "../contexts/ThemeContext";

export default function AppStatusBar() {
  const { theme } = useTheme();
  const bg = theme.headerBg;
  const style = theme.statusBarStyle ?? (theme.dark ? "light" : "dark");

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const apply = () => {
      setStatusBarTranslucent(false);
      setStatusBarBackgroundColor(bg);
      setStatusBarStyle(style);
      NavigationBar.setBackgroundColorAsync(theme.tabBg).catch(() => {});
      NavigationBar.setButtonStyleAsync(theme.dark ? "light" : "dark").catch(() => {});
    };

    apply();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") apply();
    });
    return () => sub.remove();
  }, [bg, style, theme.tabBg, theme.dark]);

  return (
    <ExpoStatusBar
      style={style}
      backgroundColor={Platform.OS === "android" ? bg : undefined}
      translucent={false}
    />
  );
}
