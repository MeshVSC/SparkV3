# Testing Documentation

## Overview

This project includes comprehensive testing coverage using Vitest for unit tests and Playwright for end-to-end testing.

## Testing Framework

### Unit Tests (Vitest)

#### Setup
- **Framework**: Vitest with jsdom environment
- **Testing Library**: @testing-library/react for component testing
- **Mocking**: Vi mocks for external dependencies
- **Configuration**: `vitest.config.ts` and `vitest.setup.ts`

#### Test Categories

##### Spark Lifecycle Tests (`tests/unit/spark-lifecycle.test.ts`)
Tests covering the complete lifecycle of Spark entities:
- **Creation**: Spark creation with default and custom parameters
- **State Transitions**: SEEDLING → SAPLING → TREE → FOREST
- **Position Updates**: Coordinate tracking during transitions  
- **Completion/Archival**: Marking sparks as complete and archiving
- **Deletion**: Safe deletion with cascade handling
- **Retrieval**: Finding and filtering sparks by various criteria

##### Gamification System Tests (`tests/unit/gamification-system.test.ts`)
Comprehensive testing of the XP and achievement system:

**XP Award System**:
- XP calculation for different event types (SPARK_CREATED, TODO_COMPLETED, etc.)
- Level progression based on XP thresholds (1000 XP per level)
- Level-up detection and notifications
- Error handling for invalid users and database failures

**Streak System**:
- Daily login streak calculation
- Consecutive day detection (1-day gap continues streak)
- Streak reset after gaps > 1 day
- First-time login handling

**Achievement System**:
- Milestone achievements (First Spark, 10 Sparks, 50 Sparks)
- Streak achievements (7-day, 30-day, 100-day streaks)
- Collection achievements (all statuses, achievement hunting)
- Multiple achievement unlocks in single check
- Preventing duplicate achievements

**Edge Cases**:
- Maximum level XP overflow handling
- Zero and negative XP amounts
- Concurrent achievement unlocks
- Database errors during processing

##### Progress Tracking Tests (`tests/unit/progress-tracking.test.ts`)
Advanced progress analytics and user behavior analysis:

**Progress Calculation**:
- Total progress across XP, level, streak, and achievements
- Progress velocity (sparks/XP per day)
- Trend analysis and growth patterns
- Progress anomaly detection and data cleaning

**Achievement Progress Tracking**:
- Progress toward milestone targets with percentage completion
- Streak achievement monitoring
- Collection achievement tracking (status variety, etc.)
- Dynamic unlock condition evaluation

**Complex Scenarios**:
- Exponential growth pattern analysis
- Plateau period detection and recovery tracking
- Personalized recommendation generation
- Real-time progress update handling
- Progress rollback and validation

**Analytics and Insights**:
- Weekly/monthly progress trend calculation
- Predictive modeling using linear regression
- Bottleneck identification (efficiency < 60%)
- Strength recognition (efficiency ≥ 80%)
- Performance optimization suggestions

##### Mocked Services Tests (`tests/unit/mocked-services.test.ts`)
Service layer testing with comprehensive mock implementations:

**MockSparkService**:
- CRUD operations with unique ID generation
- User and status-based filtering
- Update operations with timestamp tracking
- Safe deletion with proper error handling
- Query operations with empty result handling

**MockGamificationService**:
- XP award processing with level calculations
- Streak management with date-based logic
- Multi-user state isolation
- Progress state persistence

**Service Integration**:
- Spark creation combined with XP awards
- Status transitions with level progression
- Concurrent operation safety
- Data consistency during errors

### E2E Tests (Playwright)

#### Setup
- **Framework**: Playwright with Chromium, Firefox, and WebKit
- **Configuration**: `playwright.config.ts` 
- **Base URL**: http://localhost:3000 with dev server auto-start
- **Reporters**: HTML report generation

#### Test Categories

##### View Mode Tests (`tests/e2e/view-modes.spec.ts`)
Testing the three main view modes of the application:

**Kanban View**:
- Column rendering (Seedling, Sapling, Tree, Forest)
- Spark card display in correct columns
- Drag-and-drop between status columns
- Empty state handling
- Card structure validation (title, XP, status badges)

**Timeline View**:
- Chronological layout rendering
- Timeline line and item display
- Date-based ordering verification
- Date range filtering controls
- Progress indicator display

**Canvas View**:
- Spatial node positioning
- Zoom and pan interactions
- Connection line rendering between related sparks
- Node repositioning via drag-and-drop
- Interactive canvas controls

**View Mode Switching**:
- Navigation between modes preserving data
- URL state management for bookmarking
- Data consistency across view switches
- Responsive design adaptation

##### Guest Mode Tests (`tests/e2e/guest-mode.spec.ts`)
Comprehensive access control and guest experience testing:

**Authentication Flow**:
- Protected route redirects to sign-in
- Sign-in modal for restricted actions
- Modal interaction handling (close, sign-in buttons)
- Redirect preservation after authentication

**Read-Only Access**:
- Guest mode banner display
- Content visibility in read-only mode
- Edit functionality disabling
- Read-only indicator display
- Tooltip explanations for restrictions

**Upgrade Prompts**:
- Strategic upgrade prompt placement
- Premium feature limitation indicators
- Usage limit displays and progress bars
- Upgrade CTA interaction handling

**Demo Data Experience**:
- Demo content display and interactions
- Interactive demo tour functionality
- Demo data reset on page refresh
- Safe demo data interaction handling

**Edge Cases**:
- Network error handling in offline mode
- API error graceful degradation
- Session timeout detection and handling
- Navigation restriction enforcement

##### UI Interaction Tests (`tests/e2e/ui-interactions.spec.ts`)
Comprehensive user interface interaction testing:

**Spark Management**:
- Create spark modal opening/closing
- Form validation with required fields
- Successful spark creation with valid data
- Color picker and option selection

**Search and Filtering**:
- Text search functionality with results display
- Status-based filtering with result verification
- Search and filter clearing
- No results state handling

**Navigation**:
- Main menu navigation between sections
- Mobile menu toggle and responsive behavior
- Dropdown menu interactions (user menu)
- URL navigation verification

**Drag and Drop**:
- Kanban board spark repositioning
- Todo item reordering within spark details
- Visual feedback during drag operations
- Drop zone targeting and validation

**Form Interactions**:
- Spark editing modal and field updates
- Todo creation and completion toggling
- File attachment upload interface
- Form validation and error display

**Accessibility**:
- Theme toggling (dark/light mode)
- Keyboard navigation support
- Escape key modal dismissal
- Screen reader label compliance

**Real-time Features**:
- Loading state display during operations
- Error state handling with user feedback
- Success notification display
- Network delay simulation and handling

## Running Tests

### Unit Tests
```bash
# Watch mode for development
npm test

# Single run for CI
npm run test:run

# Visual test UI
npm run test:ui
```

### E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Visual test runner
npm run test:e2e:ui

# Install browser dependencies (first time)
npx playwright install
```

## Test Data and Mocking

### Unit Test Mocking
- **Database**: Prisma client mocked via vi.mock
- **Authentication**: NextAuth mocked for user sessions
- **External APIs**: Service calls intercepted with vi.mock
- **Environment**: Test-specific environment variables

### E2E Test Mocking
- **Authentication**: localStorage session simulation
- **API Responses**: Route interception for controlled responses
- **Network Conditions**: Offline/slow network simulation
- **Time**: Date manipulation for streak testing

## Coverage and Quality

### Coverage Targets
- **Unit Tests**: >90% line coverage for business logic
- **E2E Tests**: All critical user flows covered
- **Integration**: Service layer integration testing

### Quality Standards
- **Reliability**: Tests must be deterministic and stable
- **Performance**: Test execution under 5 minutes total
- **Maintainability**: Clear test structure and documentation
- **Reusability**: Shared test utilities and fixtures

## Continuous Integration

Tests are designed to run in CI environments with:
- **Parallel Execution**: Tests run in parallel for speed
- **Browser Matrix**: Multiple browser testing with Playwright
- **Retry Logic**: Automatic retry for flaky tests
- **Reporting**: HTML reports and test result artifacts
- **Coverage Reports**: Code coverage tracking and reporting

## Best Practices

### Unit Testing
- **Isolation**: Each test is independent and can run alone
- **Clarity**: Test names clearly describe the scenario
- **AAA Pattern**: Arrange, Act, Assert structure
- **Edge Cases**: Comprehensive edge case and error testing

### E2E Testing
- **User Focus**: Tests mirror real user interactions
- **Stability**: Robust selectors and wait strategies
- **Cleanup**: Proper test data cleanup and isolation
- **Documentation**: Clear test scenario documentation

### Maintenance
- **Regular Updates**: Tests updated with feature changes
- **Refactoring**: Test code refactored for maintainability
- **Performance**: Test performance monitored and optimized
- **Documentation**: Test documentation kept current