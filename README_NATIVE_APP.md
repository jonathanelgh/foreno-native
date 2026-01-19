# Föreno Native - React Native Member App

## Project Overview

This is a React Native mobile application for **members** of Swedish associations using the Föreno platform. The app allows members to view news, events, and manage their profile across multiple organizations they belong to.

**Important**: This is a **member-only** app, not for administrators. Admins use the web dashboard at `minforening` project.

## Project Structure

```
foreno-native/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Home screen (news/events overview)
│   │   ├── news.tsx       # Full news feed
│   │   ├── events.tsx     # Events listing
│   │   ├── profile.tsx    # User profile & org switching
│   │   └── _layout.tsx    # Tab navigation layout
│   ├── login.tsx          # Login screen
│   ├── _layout.tsx        # Root app layout
│   └── +not-found.tsx     # 404 screen
├── lib/
│   └── supabase.ts        # Supabase client configuration
├── types/
│   └── database.ts        # TypeScript interfaces
├── contexts/
│   └── AuthContext.tsx    # Authentication context
├── assets/                # Images, fonts, etc.
└── components/            # Reusable components
```

## Tech Stack

- **Framework**: Expo (React Native)
- **Navigation**: Expo Router with tabs
- **Backend**: Supabase (shared with web app)
- **Authentication**: Supabase Auth
- **State Management**: React Context
- **Language**: TypeScript
- **Styling**: React Native StyleSheet

## Database Connection

The app connects to the same Supabase database as the web application:

- **URL**: `https://krhzxvquzbhhkogxldat.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaHp4dnF1emJoaGtvZ3hsZGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MzE5NzQsImV4cCI6MjA1MDAwNzk3NH0.Yb4G7jrTBcg9UcDiNIUOsXWK96V9H3dfSyeic60oCw4`

## Key Features to Implement

### 1. Authentication

- [x] Login screen with email/password
- [x] Authentication context with session management
- [ ] Logout functionality
- [ ] Session persistence

### 2. Multi-Organization Support

- [x] Fetch user memberships from database
- [x] Organization switching in profile
- [ ] Filter content by selected organization
- [ ] Handle users with multiple memberships

### 3. Home Screen (index.tsx)

- [ ] Recent news overview (latest 3-5 articles)
- [ ] Upcoming events overview (next 3-5 events)
- [ ] Pull-to-refresh functionality
- [ ] Quick navigation to full news/events

### 4. News Feed (news.tsx)

- [ ] List all published news (utskick) for current organization
- [ ] Display title, content preview, image thumbnails
- [ ] Handle attachments (PDF, images)
- [ ] Pull-to-refresh
- [ ] Infinite scroll or pagination

### 5. Events (events.tsx)

- [ ] List upcoming events for current organization
- [ ] Display date, time, location, description
- [ ] Swedish date formatting (e.g., "16 december 2024")
- [ ] Filter past/upcoming events
- [ ] Pull-to-refresh

### 6. Profile (profile.tsx)

- [ ] Display user information
- [ ] Organization switcher dropdown
- [ ] Logout button
- [ ] Settings/preferences

## Database Schema (Key Tables)

### Organizations

```sql
- id: string (UUID)
- name: string
- description: text
- organization_number: string
- address: string
- postal_code: string
- city: string
- created_at: timestamp
```

### Memberships

```sql
- id: string (UUID)
- user_id: string (foreign key)
- organization_id: string (foreign key)
- role: 'admin' | 'styrelse' | 'medlem'
- status: 'active' | 'inactive' | 'pending'
- joined_at: timestamp
```

### Utskick (News)

```sql
- id: string (UUID)
- organization_id: string (foreign key)
- title: string
- content: text
- image_url: string (optional)
- attachment_url: string (optional)
- attachment_name: string (optional)
- published: boolean
- created_by: string (foreign key)
- created_at: timestamp
```

### Events

```sql
- id: string (UUID)
- organization_id: string (foreign key)
- title: string
- description: text
- event_date: timestamp
- location: string (optional)
- created_by: string (foreign key)
- created_at: timestamp
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
cd foreno-native
npm install
```

### Development

```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web (for testing)
npm run web
```

## Design Guidelines

### Color Scheme

- **Primary**: `#2563eb` (Blue)
- **Secondary**: `#10b981` (Green)
- **Accent**: `#7c3aed` (Purple)
- **Background**: `#f8fafc` (Light gray)
- **Text**: `#1f2937` (Dark gray)

### Typography

- Use system fonts (San Francisco on iOS, Roboto on Android)
- Font sizes: 32px (titles), 16px (body), 14px (captions)

### Components

- Use cards with shadows for content blocks
- Consistent padding: 16px, 24px
- Border radius: 8px for buttons, 12px for cards
- Use Ionicons for consistent iconography

## Implementation Tasks

### Phase 1: Core Setup ✅

- [x] Project structure
- [x] Supabase configuration
- [x] Authentication context
- [x] Basic navigation
- [x] Login screen

### Phase 2: Data Layer

- [ ] Create API service functions
- [ ] Implement data fetching hooks
- [ ] Add error handling
- [ ] Add loading states

### Phase 3: Screen Implementation

- [ ] Home screen with overview
- [ ] News feed with full articles
- [ ] Events listing
- [ ] Profile management

### Phase 4: Polish

- [ ] Pull-to-refresh on all screens
- [ ] Image handling and caching
- [ ] Offline support
- [ ] Push notifications (future)

## API Endpoints (Supabase Queries)

### Get User Memberships

```javascript
const { data, error } = await supabase
  .from("memberships")
  .select(
    `
    *,
    organization:organizations(*)
  `
  )
  .eq("user_id", userId)
  .eq("status", "active");
```

### Get News for Organization

```javascript
const { data, error } = await supabase
  .from("utskick")
  .select("*")
  .eq("organization_id", orgId)
  .eq("published", true)
  .order("created_at", { ascending: false });
```

### Get Events for Organization

```javascript
const { data, error } = await supabase
  .from("events")
  .select("*")
  .eq("organization_id", orgId)
  .gte("event_date", new Date().toISOString())
  .order("event_date", { ascending: true });
```

## Swedish Localization

All text should be in Swedish:

- "Hem" (Home)
- "Nyheter" (News)
- "Evenemang" (Events)
- "Profil" (Profile)
- "Logga in" (Login)
- "Logga ut" (Logout)
- Date formatting: "16 december 2024, 14:30"

## Testing

### Test Users

Create test users in Supabase with memberships to test:

- Single organization membership
- Multiple organization memberships
- Different roles (medlem, styrelse, admin)

### Test Data

Ensure test organizations have:

- Published news articles with images
- Upcoming events
- Past events
- Various content types

## Deployment

### Development

- Use Expo Go app for testing
- Share via QR code for stakeholder testing

### Production

- Build standalone apps for iOS/Android
- Submit to App Store/Google Play
- Use EAS Build for CI/CD

## Notes for Developer

1. **Focus on Member Experience**: This app is for regular members, not administrators. Keep the interface simple and focused on consuming content.

2. **Organization Context**: Always filter content by the currently selected organization. Users can switch organizations in the profile screen.

3. **Swedish Language**: All UI text should be in Swedish. Use proper Swedish date/time formatting.

4. **Performance**: Implement proper loading states, error handling, and pull-to-refresh on all data screens.

5. **Offline Support**: Consider caching recent news and events for offline viewing.

6. **Image Handling**: News articles may have images. Implement proper image loading with placeholders and error states.

7. **File Attachments**: News may have PDF attachments. Handle file downloads appropriately for mobile.

## Contact

For questions about the backend/database structure, refer to the main `minforening` Next.js project or contact the web app development team.

## Related Projects

- **minforening**: Next.js web application for administrators
- **Database**: Shared Supabase instance for both web and mobile apps

## Organization Cover Images

Organizations can now have cover images that display as beautiful headers on the home screen.

### Adding Cover Images

Cover images can be added by updating the `cover_image_url` field in the organizations table:

```sql
UPDATE organizations
SET cover_image_url = 'https://example.com/your-cover-image.jpg'
WHERE id = 'your-organization-id';
```

### Cover Image Requirements

- **Format**: JPG, PNG, or WebP
- **Recommended Size**: 1200x400 pixels (3:1 aspect ratio)
- **File Size**: Under 2MB for optimal loading
- **Content**: Should represent the organization (building, landscape, logo, etc.)

### Display Behavior

- Cover images appear as a 200px tall header on the home screen
- Images are automatically cropped to fit using `cover` mode
- Organization name and description overlay the bottom of the image
- Text includes shadows for better readability
- If no cover image is set, the header is not displayed

### Example Cover Images

The following organizations have been set up with example cover images:

- **vitnäsuddens vägförening**: Community/meeting image
- **Föreno Fotbollsklubb**: Sports/football field image
- **Föreno Kulturförening**: Cultural/arts venue image

## Recent Updates
