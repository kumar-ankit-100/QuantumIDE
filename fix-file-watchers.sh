#!/bin/bash

# Fix for Linux file watcher limit issue
# Run this script with sudo if you encounter "OS file watch limit reached" errors

echo "🔧 Fixing Linux file watcher limit..."
echo ""

# Check current limit
CURRENT_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
echo "Current limit: $CURRENT_LIMIT"

# Recommended limit for development
NEW_LIMIT=524288

if [ "$CURRENT_LIMIT" -lt "$NEW_LIMIT" ]; then
    echo "Increasing limit to: $NEW_LIMIT"
    
    # Temporary fix (until reboot)
    echo $NEW_LIMIT | sudo tee /proc/sys/fs/inotify/max_user_watches
    
    # Permanent fix
    echo "fs.inotify.max_user_watches=$NEW_LIMIT" | sudo tee -a /etc/sysctl.conf
    sudo sysctl -p
    
    echo "✅ File watcher limit increased successfully!"
else
    echo "✅ File watcher limit is already sufficient!"
fi

echo ""
echo "📝 Note: If you don't have sudo access, use 'npm run dev' instead of 'npm run dev:turbo'"
echo "   Regular webpack mode is more stable on Linux systems."
