import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import React from 'react';
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

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.tabBar,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            height: 64,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontFamily: 'DMSans_500Medium',
            fontSize: 11,
          },
          tabBarIcon: ({ color, size }) => {
            const map: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
              Dimensionamento: 'flash-outline',
              Modulos: 'grid-outline',
              Area: 'home-outline',
              Guia: 'book-outline',
              Config: 'settings-outline',
            };
            return <Ionicons name={map[route.name as keyof RootTabParamList]} size={size} color={color} />;
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
