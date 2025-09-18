# Spark - Productivity & Creativity Platform

A modern productivity platform built with Next.js, TypeScript, and Prisma.

## Features

- **Spark Management**: Create, organize, and evolve your ideas from seedlings to forests
- **Interactive Canvas**: Visual workspace with drag-and-drop functionality
- **Collaboration**: Real-time collaborative editing and presence indicators
- **Progress Tracking**: XP system, achievements, and streak tracking
- **Multiple Views**: Canvas, Kanban, and Timeline views
- **Search & Filter**: Advanced search with history and saved searches
- **Templates**: Save and share project templates
- **Authentication**: Secure user authentication with NextAuth.js

## Tech Stack

- **Framework**: Next.js 15 (App Router), TypeScript 5
- **UI**: Tailwind CSS 4, shadcn/ui, Framer Motion
- **Database**: Prisma ORM + SQLite, NextAuth.js
- **State**: Zustand, TanStack Query, React Hook Form + Zod
- **Testing**: Vitest (unit), Playwright (E2E), Testing Library
- **Components**: Radix UI, DND Kit, Recharts
- **Features**: i18n (Next Intl), drag-and-drop (DND Kit), charts (Recharts)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd spark-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Set up the database:
```bash
npm run db:generate
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Development Commands

### Core Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Database
- `npm run db:push` - Push schema changes
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Create and run migrations
- `npm run db:reset` - Reset database

### Testing

#### Unit Tests (Vitest)
- `npm run test` - Run unit tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

#### E2E Tests (Playwright)
- `npm run test:e2e` - Run E2E tests
- `npm run test:e2e:ui` - Run E2E tests with UI
- `npm run test:e2e:headed` - Run E2E tests in headed mode

#### All Tests
- `npm run test:all` - Run both unit and E2E tests

## Testing Setup

### Unit Testing
- **Framework**: Vitest with React Testing Library
- **Environment**: jsdom with global test utilities
- **Mocking**: MSW for API mocking, comprehensive mocks for Next.js
- **Coverage**: v8 coverage reporting

### E2E Testing
- **Framework**: Playwright
- **Browsers**: Chrome, Firefox, Safari (desktop + mobile)
- **Features**: Auto-retry, trace collection, screenshot on failure
- **Authentication**: Shared auth state across tests

### Test Databases
- **Local**: SQLite test database (`test.db`)
- **CI**: Separate CI test database (`ci-test.db`)
- **Utilities**: Database seeding and cleanup helpers

## Project Structure

```
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   └── ...             # Feature components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   ├── test/               # Test configuration & utilities
│   └── __tests__/          # Unit test files
├── e2e/                    # E2E test files
├── prisma/                 # Database schema and migrations
├── playwright.config.ts    # Playwright configuration
├── vitest.config.ts       # Vitest configuration
└── ...
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run test:all`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Quality

- All code must pass linting: `npm run lint`
- Unit tests are required for new features
- E2E tests should cover critical user flows
- Maintain test coverage above 80%

## CI/CD

The project uses GitHub Actions for continuous integration:

- **Linting**: ESLint checks on all PRs
- **Unit Tests**: Vitest with coverage reporting
- **E2E Tests**: Playwright across multiple browsers
- **Build**: Verification builds for all environments

Tests run automatically on:
- Pull requests to `main` and `develop`
- Pushes to `main` and `develop`

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

For testing, use `.env.test` which is automatically configured.

## License

This project is licensed under the MIT License.