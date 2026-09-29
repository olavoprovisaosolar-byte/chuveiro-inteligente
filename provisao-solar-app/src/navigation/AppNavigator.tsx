import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AreaTelhadoScreen } from '../screens/AreaTelhadoScreen';
import { ConfigAiScreen } from '../screens/ConfigAiScreen';
import { DimensionamentoScreen } from '../screens/DimensionamentoScreen';
import { GuiaScreen } from '../screens/GuiaScreen';
import { ModulosScreen } from '../screens/ModulosScreen';
import { useTheme } from '../theme/ThemeContext';

export type RootTabParamList = {
  Dimensionamento: undefined;
  Modulos: undefined;
  Area: undefined;
  Guia: undefined;
  Config: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function AppNavigator() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 600;
  // Tablets Android (ex.: TL10) precisam reservar a barra de navegação do sistema
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 0);
  const contentHeight = isTablet ? (isLandscape ? 56 : 64) : isLandscape ? 48 : 54;
  const tabBarHeight = contentHeight + bottomInset;

  const navTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.tabBar,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
      },
    }),
    [colors, isDark],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        safeAreaInsets={{ top: 0, left: 0, right: 0, bottom: 0 }}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            elevation: 16,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: -2 },
            height: tabBarHeight,
            minHeight: tabBarHeight,
            paddingBottom: bottomInset,
            paddingTop: isTablet ? 8 : 4,
            paddingHorizontal: isTablet ? 8 : 0,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
            minHeight: contentHeight - 4,
          },
          tabBarLabelStyle: {
            fontFamily: 'DMSans_500Medium',
            fontSize: isTablet ? 12 : isLandscape ? 10 : 11,
            marginTop: 2,
            marginBottom: 0,
          },
          tabBarIcon: ({ color, size }) => {
            const map: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
              Dimensionamento: 'flash-outline',
              Modulos: 'grid-outline',
              Area: 'home-outline',
              Guia: 'book-outline',
              Config: 'settings-outline',
            };
            const iconSize = isTablet ? 26 : isLandscape ? Math.max(18, size - 2) : size;
            return (
              <Ionicons
                name={map[route.name as keyof RootTabParamList]}
                size={iconSize}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen
          name="Dimensionamento"
          component={DimensionamentoScreen}
          options={{ title: 'Cálculo' }}
        />
        <Tab.Screen
          name="Modulos"
          component={ModulosScreen}
          options={{ title: 'Módulos' }}
        />
        <Tab.Screen
          name="Area"
          component={AreaTelhadoScreen}
          options={{ title: 'Telhado' }}
        />
        <Tab.Screen
          name="Guia"
          component={GuiaScreen}
          options={{ title: 'Guia' }}
        />
        <Tab.Screen
          name="Config"
          component={ConfigAiScreen}
          options={{ title: 'Config. IA' }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
