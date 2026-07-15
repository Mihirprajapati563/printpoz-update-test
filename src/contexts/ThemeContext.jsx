// src/contexts/ThemeContext.jsx
import { createContext, useState, useEffect, useContext } from 'react';
import { useSelector } from 'react-redux';
import { getEditorThemeColor } from "../store/slices/editorConfigurations"
const themes = [
  {
    name: "default"
  },
  {
    name: "blue"
  },
  {
    name: "green"
  },
  {
    name: "purple"
  },
  {
    name: "red"
  },

  {
    name: "cyan"
  },

]
const defaultTheme = "default"

function applyTheme(themeColors) {

  const palette = {
    "--background": themeColors["background"],
    "--foreground": themeColors["foreground"],
    "--primary": themeColors["primary"],
    "--primary-foreground": themeColors["primary-foreground"],
    "--secondary": themeColors["secondary"],
    "--secondary-foreground": themeColors["secondary-foreground"],
    "--muted-foreground": themeColors["muted-foreground"],
    "--accent-foreground": themeColors["accent-foreground"],

  };

  const root = document.documentElement;
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

// Create context
export const ThemeContext = createContext();

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme provider component
export const ThemeProvider = ({ children }) => {
  const requiredColors = ["background", "foreground", "primary", "primary-foreground", "secondary", "secondary-foreground", "muted-foreground", "accent-foreground"];
  // Get theme from localStorage or use default
  const [currentTheme, setCurrentTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return themes.includes(savedTheme) ? savedTheme : defaultTheme;
  });
  const themeColors = useSelector(getEditorThemeColor);
  useEffect(() => {
    if (themeColors && Object.keys(themeColors).length > 0 && requiredColors.every(color => themeColors[color])) {
      applyTheme(themeColors);
    } else {
      document.documentElement.setAttribute("data-theme", "default");
    }
  }, [themeColors]);

  // Function to change theme
  const changeTheme = (themeName) => {
    setCurrentTheme(themeName);
  };

  // Get available themes
  const getAvailableThemes = () => {
    return themes;
  };

  // Context value
  const value = {
    currentTheme,
    changeTheme,
    getAvailableThemes,
    themes
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
