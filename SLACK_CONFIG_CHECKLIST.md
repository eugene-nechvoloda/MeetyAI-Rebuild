# Slack App Configuration Checklist

Visit: https://api.slack.com/apps → Select "MeetyAI"

## ✅ Required Event Subscriptions

Go to **Event Subscriptions** → **Subscribe to bot events**

Make sure these events are subscribed:
- [ ] `app_home_opened` ← **CRITICAL for Home Tab!**
- [ ] `message.im` (for DMs)

## ✅ Required OAuth Scopes

Go to **OAuth & Permissions** → **Bot Token Scopes**

Required scopes:
- [ ] `chat:write` - Send messages
- [ ] `app_mentions:read` - Read mentions
- [ ] `im:history` - Read DM history
- [ ] `im:write` - Send DMs

## ✅ App Home Settings

Go to **App Home**

- [ ] **Home Tab** is enabled (checked)
- [ ] "Show Tabs" section shows "Home" tab

## ✅ Request URL

Go to **Event Subscriptions**

Request URL should be:
```
https://meetyai-rebuild-production.up.railway.app/slack/events
```

Status should show: **✓ Verified**

## 🔍 If Home Tab Still Shows "Work in Progress"

This means Slack is NOT receiving a custom view from your server.

Possible causes:
1. **Railway hasn't deployed** - Check Railway deployment status
2. **Event not subscribed** - Missing `app_home_opened` event
3. **Server error** - Check Railway logs for errors
4. **Database connection** - Check if DATABASE_URL is set in Railway

## 🚨 After Making Changes

If you change ANY of the above:
1. Click **"Save Changes"** in Slack app config
2. **Reinstall the app** to your workspace (if prompted)
3. Wait 1-2 minutes
4. Refresh the MeetyAI app in Slack
