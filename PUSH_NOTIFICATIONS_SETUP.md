# Push Notifications Setup Guide

## What I've Created

I've implemented a complete push notification system with the following components:

### 1. Database Tables & Functions

- **`push_notifications` table**: Stores notification data and Expo push tokens
- **`expo_push_token` field**: Added to `user_profiles` table to store device tokens
- **`push_notifications` preference**: Added to `user_profiles` table for user control

### 2. Database Triggers

- **Utskick trigger**: Automatically creates push notifications when new utskick are inserted
- **Events trigger**: Automatically creates push notifications when new events are inserted
- **Push notification trigger**: Calls the edge function when new push notifications are created

### 3. Edge Function

- **`send-push-notification`**: Handles sending notifications to Expo push service

### 4. Helper Functions

- **`get_organization_expo_tokens()`**: Gets all valid push tokens for an organization
- **`process_pending_push_notifications()`**: Manually processes pending notifications
- **`test_push_notification()`**: Creates test notifications
- **`get_push_notification_stats()`**: Returns statistics about notifications

## Enhanced Permission Handling ✨

The system now includes comprehensive permission handling with:

- ✅ **Smart permission checking**: Different handling for denied, granted, and undetermined states
- ✅ **Detailed error messages**: Platform-specific guidance for users
- ✅ **Status monitoring**: Real-time checking of permission and token status
- ✅ **Graceful error handling**: No more sudden alerts, proper error management
- ✅ **User-friendly UI component**: Ready-to-use permission handler component

## React Native Integration

### 1. Install Required Packages

```bash
expo install expo-notifications expo-device expo-constants
```

### 2. Enhanced Notifications Service

The `lib/notifications.ts` file now includes:

```typescript
// New enhanced functions:
- initializeNotifications(): Complete setup with error handling
- requestNotificationPermissions(): Detailed permission handling
- areNotificationsEnabled(): Check current status
- getNotificationPermissionStatus(): Get permission state
```

### 3. Simple Integration in App Component

Update your main app component (`app/_layout.tsx`):

```typescript
import { useEffect } from "react";
import { initializeNotifications } from "../lib/notifications";

export default function RootLayout() {
  useEffect(() => {
    // Simple one-line initialization with comprehensive error handling
    initializeNotifications().then((result) => {
      if (result.success) {
        console.log("✅ Push notifications enabled");
      } else {
        console.log("❌ Push notifications failed:", result.error);
        // Handle error as needed - no intrusive alerts
      }
    });
  }, []);

  // ... rest of your layout component
}
```

### 4. Permission Handler Component

Use the ready-made component for managing permissions:

```typescript
import NotificationPermissionHandler from "../components/NotificationPermissionHandler";

// In your settings screen or onboarding:
<NotificationPermissionHandler />;
```

This component provides:

- ✅ Real-time permission status
- ✅ User-friendly enable button
- ✅ Clear error messages
- ✅ Platform-specific guidance
- ✅ Debug information (removable in production)

### 5. User Preferences Component

Create a component to let users control their notification preferences:

```typescript
import { useState, useEffect } from "react";
import { Switch, View, Text } from "react-native";
import { supabase } from "../lib/supabase";

export function NotificationSettings() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("push_notifications, email_notifications, sms_notifications")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setPushEnabled(data.push_notifications);
      setEmailEnabled(data.email_notifications);
      setSmsEnabled(data.sms_notifications);
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  };

  const updatePreference = async (field: string, value: boolean) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_profiles")
        .update({ [field]: value })
        .eq("id", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating preference:", error);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 15,
        }}
      >
        <Text>Push Notifications</Text>
        <Switch
          value={pushEnabled}
          onValueChange={(value) => {
            setPushEnabled(value);
            updatePreference("push_notifications", value);
          }}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 15,
        }}
      >
        <Text>Email Notifications</Text>
        <Switch
          value={emailEnabled}
          onValueChange={(value) => {
            setEmailEnabled(value);
            updatePreference("email_notifications", value);
          }}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 15,
        }}
      >
        <Text>SMS Notifications</Text>
        <Switch
          value={smsEnabled}
          onValueChange={(value) => {
            setSmsEnabled(value);
            updatePreference("sms_notifications", value);
          }}
        />
      </View>
    </View>
  );
}
```

## Testing the System

### 1. Test with SQL Function

```sql
-- Test push notification for an organization
SELECT test_push_notification(
  'your-organization-id-here',
  'Test Title',
  'Test message body'
);

-- Check push notification statistics
SELECT * FROM get_push_notification_stats('your-organization-id-here');

-- Manually process pending notifications (if needed)
SELECT * FROM process_pending_push_notifications();
```

### 2. Test by Creating Content

Just create a new utskick or event through your app - notifications should be sent automatically!

### 3. Test Permission Handling

The `NotificationPermissionHandler` component will show you exactly what's happening with permissions in real-time.

## Configuration Notes

### 1. App Configuration (app.json)

Make sure your `app.json` includes:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#ffffff"
        }
      ]
    ]
  }
}
```

### 2. Environment Variables

The edge function uses these environment variables (automatically available in Supabase):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Permission States Handled

The enhanced system handles all possible permission states:

| State                        | Description                         | User Experience                                  |
| ---------------------------- | ----------------------------------- | ------------------------------------------------ |
| ✅ **Granted + Token Saved** | Everything working                  | "Push notifications are enabled"                 |
| ⚠️ **Granted + No Token**    | Permission granted but token failed | "Notifications allowed but not fully configured" |
| ❌ **Denied**                | User denied permissions             | Clear instructions to enable in settings         |
| ❓ **Undetermined**          | User dismissed permission request   | Option to request again                          |
| 🚫 **Not Device**            | Running on simulator                | "Requires physical device" message               |

## System Flow

1. **User creates utskick/event** → Database trigger fires
2. **Trigger gets organization members** → Filters for users with push tokens enabled
3. **Creates push_notifications record** → Another trigger calls edge function
4. **Edge function sends to Expo** → Updates notification status
5. **User receives notification** → Can tap to navigate to content

## Message push notifications (new messages)

New messages (direct and group) trigger push notifications from the database:

1. **SQL**: Run `supabase-message-push-notifications.sql` in Supabase → SQL Editor.
2. **Prerequisites**: Enable the **pg_net** extension (Database → Extensions). Ensure `user_profiles` has `expo_push_token` and optionally `push_notifications`.
3. **Config**: After running the SQL, update the edge function URL:  
   `UPDATE app_settings SET value = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1' WHERE key = 'supabase_functions_url';`
4. **Edge function**: Use your existing **`send-push-notification`** function. The message flow POSTs to it with body:  
   `{ "expo_push_token": "...", "title": "Sender name", "body": "Message preview", "data": { "type": "message", "conversation_id": "...", "conversation_type": "direct"|"organization" } }`  
   If the request body contains **`expo_push_token`**, forward it to the Expo Push API (POST to `https://exp.host/--/api/v2/push/send` with `{ to: expo_push_token, title, body, data }`). If your function already handles other payloads (e.g. utskick/events from `push_notifications`), add this branch so one function handles both.
5. **Tap behaviour**: Tapping a message notification opens the conversation screen (handled in `lib/notifications.ts`).

---

## Option: Database Webhook instead of pg_net

You can trigger the Edge Function from **Database Webhooks** instead of pg_net. That avoids the pg_net extension and `message_push_queue` / `app_settings` setup.

### Why use a webhook?

- No **pg_net** or trigger that calls HTTP from the DB.
- Configure in Dashboard (Database → Webhooks): enable/disable or change URL without SQL.
- Supabase sends the new row to your Edge Function; the function does recipient lookup + Expo send.

### Setup (messages push via webhook)

1. **Create an Edge Function** that:
   - Accepts POST with Supabase webhook payload: `{ "type": "INSERT", "table": "messages", "record": { "id", "conversation_id", "sender_id", "content", ... } }` (and similarly for `organization_messages`).
   - For **messages**: get the other participant from `conversations` (where `id = record.conversation_id`), fetch their `expo_push_token` from `user_profiles`, build title/body/data, then POST to `https://exp.host/--/api/v2/push/send`.
   - For **organization_messages**: get member user_ids from `organization_conversation_members` (excluding `record.sender_id`), fetch their tokens, send one push per recipient.
   - Respect `user_profiles.push_notifications` (skip if false).

2. **Add Database Webhooks** (Supabase Dashboard → Database → Webhooks → Create):
   - **Table**: `messages` → **Events**: Insert → **URL**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-message-push` (or your function name).
   - Repeat for **Table**: `organization_messages` if you want group message pushes.

3. **Payload shape**: The webhook sends a JSON body like:
   ```json
   { "type": "INSERT", "table": "messages", "record": { "id": "...", "conversation_id": "...", "sender_id": "...", "content": "..." }, "old_record": null }
   ```
   Your Edge Function reads `record`, looks up recipient(s) and tokens, then calls Expo.

### Recommendation

- **Webhook**: Simpler DB (no pg_net, no queue table), all “who gets notified” logic in one place (Edge Function). Good default.
- **pg_net + queue**: Keeps recipient/token resolution in SQL and uses the Edge Function only to call Expo; useful if you want a DB audit trail (`message_push_queue`) or already have that setup.

## Troubleshooting

### Check Push Notification Status

```sql
SELECT * FROM push_notifications
WHERE organization_id = 'your-org-id'
ORDER BY created_at DESC;
```

### View Logs

Check the edge function logs in Supabase dashboard under Functions.

### Manual Processing

If automatic triggers aren't working:

```sql
SELECT * FROM process_pending_push_notifications();
```

### Check Permission Status in App

Use the notification functions to debug:

```typescript
import {
  areNotificationsEnabled,
  getNotificationPermissionStatus,
} from "../lib/notifications";

// Check detailed status
const status = await areNotificationsEnabled();
console.log("Notification status:", status);

// Check permission state
const permission = await getNotificationPermissionStatus();
console.log("Permission state:", permission);
```

## Key Improvements ✨

1. **No more intrusive alerts** - Graceful error handling
2. **Real-time status checking** - Know exactly what's happening
3. **Platform-specific guidance** - Different messages for iOS/Android
4. **Comprehensive error messages** - Clear instructions for users
5. **Ready-to-use components** - Drop-in permission handler
6. **Backwards compatibility** - Old functions still work

This system now provides a professional-grade notification experience with proper error handling and user guidance! 🚀
