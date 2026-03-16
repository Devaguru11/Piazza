# Project Context: Piazza — Employee Reward System

## What this project is
A full-stack employee gamification and rewards platform called **RewardIQ / Piazza**.
- Employees earn points by completing KPIs, joining challenges, and earning badges
- Admins manage employees, assign KPIs, create challenges, approve rewards, and view analytics
- Real-time updates via Socket.io

---

## Tech Stack

### Backend (`apps/api/`)
- **Runtime**: Node.js + Express + TypeScript
- **ORM**: Prisma with PostgreSQL
- **Auth**: JWT (stored in Redis with TTL), bcrypt for passwords
- **Storage**: AWS S3 for badge/reward images (via `s3Service`)
- **Real-time**: Socket.io
- **Response format**: ALL responses use these utilities from `src/utils/response.ts`:
  - `sendSuccess(res, data, message?, statusCode?)` → `{ success: true, data, message }`
  - `sendPaginated(res, data[], pagination, message?)` → `{ success: true, data: [], pagination: { page, limit, total }, message }`
  - `sendError(res, error, code?)` → `{ success: false, error, code }`

### Frontend (`apps/web/`)
- **Framework**: React + Vite + TypeScript
- **Styling**: Tailwind CSS + custom classes (`glass-panel`, `stat-card`)
- **State**: Zustand with `persist` middleware (key: `piazza-auth`)
- **Routing**: React Router v6 with role-based protected routes
- **Charts**: Recharts
- **Icons**: Font Awesome (`fa-solid fa-...`)
- **Fonts**: Syne (headings, `font-syne`), DM Sans (body)
- **Theme**: Dark — `#0a0c14` bg, `#111420` panels, `#1f2540` borders, `#6c63ff` accent purple, `#ff6584` accent pink, `#43e97b` green, `#f7b731` yellow

---

## Critical: API response unwrapping

`apps/web/src/services/api.ts` uses an Axios response interceptor:
```ts
(response) => response.data  // strips Axios wrapper
```

So `api.get('/any-endpoint')` resolves to the **raw JSON body**:
- `sendSuccess` → `{ success, message, data: T }`
- `sendPaginated` → `{ success, message, data: T[], pagination }`

**Always unwrap like this in frontend components:**
```ts
function unwrap<T>(envelope: any, fallback: T): T {
    if (envelope && 'data' in envelope) return (envelope.data as T) ?? fallback;
    return (envelope as T) ?? fallback;
}

// sendSuccess:
const item = unwrap<MyType>(await api.get('/endpoint'), defaultVal);

// sendPaginated:
const payload = await api.get('/endpoint') as any;
const list: MyType[] = Array.isArray(payload?.data) ? payload.data : [];
const pagination = payload?.pagination ?? {};
```

**NEVER do `response.data` or `res.data` in frontend — the interceptor already did it.**

---

## Auth system

### Backend
- `POST /api/auth/login` → returns `{ success, message, data: { token, employee } }`
- `POST /api/auth/register`
- Roles: `ADMIN` | `EMPLOYEE`
- Admin accounts need `isAdminApproved: true` to login
- Super admin email: `adminsample123@admin.com`

### Frontend store (`src/store/authStore.ts`)
```ts
// Zustand persisted store
interface AuthState {
    user: User | null;
    token: string | null;
    _hasHydrated: boolean;
    setAuth: (user, token) => void;
    clearAuth: () => void;
    setHasHydrated: (val) => void;
}
// persist key: "piazza-auth"
// partialize: only { user, token } persisted — NOT _hasHydrated
// onRehydrateStorage: sets _hasHydrated = true after localStorage read
```

### ProtectedRoute logic
1. `_hasHydrated` false → show spinner (don't redirect yet)
2. No token/user → redirect to `/login`
3. Wrong role → redirect to correct dashboard
4. Correct role → render

---

## File structure

```
apps/
├── api/src/
│   ├── controllers/     # authController, kpiController, rewardController,
│   │                    # employeeController, gamificationController,
│   │                    # analyticsController, auditController,
│   │                    # notificationController, redemptionController
│   ├── routes/          # auth, kpis, rewards, employees, gamification,
│   │                    # analytics, audit, notifications, redemptions
│   ├── services/        # gamificationService, scoringEngine,
│   │                    # notificationService, s3Service
│   ├── middleware/       # verifyJWT, roleGuard
│   ├── prisma/          # schema.prisma, client.ts
│   └── utils/           # response.ts, redis.ts, logger.ts
│
└── web/src/
    ├── pages/
    │   ├── admin/       # Dashboard, Kpis, Employees, Approvals, Rewards,
    │   │                # Badges, Challenges, Analytics, Leaderboard, Audit
    │   ├── employee/    # Dashboard, Kpis, Badges, Leaderboard, Challenges,
    │   │                # Rewards, Achievements, Profile, Analytics, Settings
    │   └── auth/        # Login, Register
    ├── layouts/         # AppLayout, AuthLayout
    ├── components/ui/   # Button, Card, Input, Modal, Badge, Avatar, Navbar, Sidebar
    ├── router/          # index.tsx (AppRouter + ProtectedRoute)
    ├── store/           # authStore.ts
    ├── services/        # api.ts
    └── socket/          # socket.ts
```

---

## Key API endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET  /api/auth/me`

### Employees
- `GET  /api/employees` → paginated
- `GET  /api/employees/:id`
- `GET  /api/employees/:id/stats` → `{ totalPoints, level, streakCount, badgesEarned, kpisCompleted, rank }`
- `POST /api/employees`
- `PUT  /api/employees/:id`
- `DELETE /api/employees/:id` (soft delete)

### KPIs
- `GET    /api/kpis` → paginated (employee sees own, admin sees all)
- `POST   /api/kpis`
- `GET    /api/kpis/:id`
- `PUT    /api/kpis/:id`
- `DELETE /api/kpis/:id`
- `POST   /api/kpis/:id/submit` → employee marks complete
- `POST   /api/kpis/:id/approve` → admin approves + triggers scoring
- `POST   /api/kpis/:id/reject`  → admin rejects with reason

### Gamification
- `GET  /api/gamification/badges`
- `GET  /api/gamification/badges/mine`
- `POST /api/gamification/badges` (admin, multipart/form-data)
- `GET  /api/gamification/leaderboard` → paginated, each entry: `{ id, employeeId, rank, monthlyPoints, employee: { id, name, department, level } }`
- `GET  /api/gamification/leaderboard/me` → `{ rank, monthlyPoints }`
- `GET  /api/gamification/challenges`
- `POST /api/gamification/challenges` (admin) → body: `{ title, description, targetPoints, startDate, endDate }`
- `GET  /api/gamification/challenges/:id/progress` → `{ challenge, participation, joined, earned, currentPoints, targetPoints, percentComplete, status }`
- `POST /api/gamification/challenges/:id/join`

### Analytics (ADMIN only)
- `GET /api/analytics/kpi-trends?period=week|month` → `{ "2025-03": 450, ... }`
- `GET /api/analytics/top-performers` → `[{ id, name, department, totalPoints, level }]`
- `GET /api/analytics/department-stats` → `[{ department, totalPoints, employeeCount }]`
- `GET /api/analytics/redemption-stats`

### Rewards & Redemptions
- `GET    /api/rewards` → paginated
- `POST   /api/rewards` (admin, multipart)
- `PUT    /api/rewards/:id` (admin)
- `DELETE /api/rewards/:id` (admin)
- `GET    /api/redemptions`
- `POST   /api/redemptions` → body: `{ rewardId }`

### Notifications
- `GET /api/notifications?limit=N` → paginated
- Notification types: `KPI_ASSIGNED`, `KPI_APPROVED`, `KPI_REJECTED`, `BADGE_UNLOCKED`, `REWARD_APPROVED`

### Audit
- `GET /api/audit?limit=N` → paginated, each: `{ action, targetTable, createdAt, admin: { name } }`

---

## Prisma models (key ones)
- `Employee` — id, name, email, passwordHash, role, department, level, totalPoints, streakCount, isAdminApproved, isSuperAdmin, isDeleted
- `Kpi` — id, title, description, pointValue, assignedTo, status (PENDING|COMPLETE|APPROVED|REJECTED), rejectReason, submittedAt, approvedAt
- `Reward` — id, name, description, pointCost, category, stock, imageUrl
- `Redemption` — id, employeeId, rewardId, status (PENDING|APPROVED|REJECTED)
- `Badge` — id, name, description, imageUrl, unlockCondition
- `EmployeeBadge` — id, employeeId, badgeId, unlockedAt
- `Leaderboard` — id, employeeId (unique), rank, monthlyPoints
- `Challenge` — id, title, description, targetPoints, startDate, endDate, isActive
- `ChallengeParticipation` — id, employeeId, challengeId, joinedAt, status @@unique([employeeId, challengeId])
- `PointsLedger` — id, employeeId, points, reason, createdAt
- `Notification` — id, employeeId, message, type, isRead, createdAt
- `AuditLog` — id, adminId, action, targetTable, targetId, metadata, createdAt

---

## Demo credentials
| Role     | Email                        | Password   |
|----------|------------------------------|------------|
| Admin    | adminsample123@admin.com     | admin123   |
| Employee | john@test.com                | sample123  |

---

## Known patterns / rules for this project
1. **Always use `Promise.allSettled`** not `Promise.all` for dashboard data fetching — one failing endpoint must not crash the whole page
2. **Envelope unwrap rule**: `sendSuccess` → read `payload.data`, `sendPaginated` → read `payload.data` (array) + `payload.pagination`
3. **gamificationService.joinChallenge** checks for existing participation before creating to avoid unique constraint crash
4. **All routes** in `Sidebar.tsx` must have a matching `<Route>` in `router/index.tsx` or the catch-all sends user to `/login`
5. **`_hasHydrated`** must never be persisted in Zustand — it resets to false on every page load and is set true by `onRehydrateStorage`
6. **Leaderboard fields**: `monthlyPoints` not `points`, `employee.name` not `user.name`
7. **KPI field**: `pointValue` not `pointsValue`
8. **Employee points field**: `totalPoints` not `pointsBalance`