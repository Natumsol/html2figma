tell application "Figma" to activate

repeat 60 times
  try
    tell application "System Events"
      tell process "Figma"
        set pluginItem to menu item "html2figma Real E2E" of menu 1 of menu item "Development" of menu 1 of menu bar item "Plugins" of menu bar 1
        if exists pluginItem then
          click pluginItem
          return
        end if
      end tell
    end tell
  end try
  delay 1
end repeat

error "The html2figma Real E2E development plugin menu did not become available"
