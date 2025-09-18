# E2E Test Suite Documentation

## Overview

This comprehensive Playwright E2E test suite covers the complete Spark productivity application workflows, from user registration through advanced task management and collaboration scenarios.

## Test Structure

### Core Test Categories

1. **Authentication (`e2e/auth/`)**
   - User registration with validation
   - Login/logout workflows
   - Password reset functionality
   - Session persistence
   - Concurrent login scenarios

2. **Task Management (`e2e/workflows/`)**
   - Complete spark lifecycle (creation → completion)
   - Status transitions (SEEDLING → SAPLING → TREE → FOREST)
   - Drag-and-drop positioning
   - Todo management within sparks
   - Search and filtering capabilities

3. **Keyboard Shortcuts (`e2e/keyboard/`)**
   - Global application shortcuts (Ctrl+N, Ctrl+S, Ctrl+F, etc.)
   - Spark manipulation shortcuts (Delete, Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y)
   - Multi-selection shortcuts (Ctrl+click, Shift+click)
   - Modal and navigation shortcuts
   - Context-sensitive shortcut behavior

4. **Collaboration (`e2e/collaboration/`)**
   - Cross-workspace sharing
   - Real-time collaborative editing
   - Concurrent editing conflict resolution
   - Workspace permissions and member management
   - Network interruption handling

5. **Bulk Operations (`e2e/bulk-operations/`)**
   - Multi-select using Ctrl+click and Shift+click
   - Bulk status changes
   - Bulk deletion with confirmation
   - Copy/paste operations
   - Export/import functionality
   - Boundary condition testing

## Performance Monitoring

### Built-in Performance Helpers

- **Page Load Time Tracking**: Monitors initial page loads and navigation
- **Memory Usage Monitoring**: Tracks JavaScript heap usage to detect memory leaks
- **Console Error Detection**: Captures and reports JavaScript errors
- **Network Request Timing**: Monitors API response times
- **Infinite Loop Detection**: Prevents tests from hanging on infinite loops

### Performance Thresholds

- Page load times: < 3 seconds
- User interactions: < 500ms response time
- Memory usage: < 100MB for normal operations
- Bulk operations: < 10 seconds for 20+ items

## Test Isolation and Setup

### Global Setup (`e2e/setup.spec.ts`)
- Database reset and seeding
- Test user creation with proper permissions
- Workspace initialization
- Test data preparation

### Test Helpers (`e2e/helpers/`)
- **AuthHelper**: Login, logout, registration, session management
- **SparkHelper**: Spark creation, editing, deletion, bulk operations
- **WorkspaceHelper**: Workspace switching, sharing, collaboration
- **PerformanceHelper**: Performance monitoring and reporting

### Test Data (`e2e/fixtures/`)
- Predefined test users, workspaces, and sparks
- Keyboard shortcut definitions
- Reusable test constants

## Edge Cases Covered

### Network Resilience
- Offline/online state handling
- Network interruption simulation
- Queued operation processing
- Connection retry logic

### Concurrent User Scenarios
- Simultaneous editing by multiple users
- Conflict resolution testing
- Real-time update synchronization
- Workspace permission enforcement

### Boundary Conditions
- Maximum selection limits
- Large dataset handling
- Empty state operations
- Special character input validation
- XSS prevention testing

## Running the Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode for debugging
npm run test:e2e:ui

# View test report
npm run test:e2e:report

# Run specific test suite
npx playwright test e2e/auth/
npx playwright test e2e/workflows/
npx playwright test e2e/keyboard/
npx playwright test e2e/collaboration/
npx playwright test e2e/bulk-operations/
```

## Browser Coverage

- **Chromium**: Primary testing browser
- **Firefox**: Cross-browser compatibility
- **WebKit**: Safari compatibility
- **Mobile Chrome**: Responsive design testing

## CI/CD Integration

The test suite is configured for:
- Headless execution in CI environments
- Automatic retries on failure
- Multiple output formats (HTML, JSON, JUnit)
- Screenshot and video capture on failures
- Test result archiving

## Performance Benchmarking

Each test includes performance assertions:
- Memory leak detection
- Response time validation
- Resource usage monitoring
- Error rate tracking

## Accessibility Testing

Keyboard navigation and screen reader compatibility testing included throughout the suite.

## Test Maintenance

- Tests are isolated and can run in any order
- Database state is reset between test suites
- No external dependencies or hardcoded data
- Comprehensive cleanup procedures

## Troubleshooting

### Common Issues
1. **Tests timing out**: Check network connectivity and server startup
2. **Element not found**: Verify data-testid attributes in components
3. **Performance thresholds**: Adjust limits based on hardware capabilities
4. **Database conflicts**: Ensure proper cleanup in teardown

### Debug Mode
Use `npm run test:e2e:ui` to run tests with Playwright's debug interface for step-by-step execution and troubleshooting.