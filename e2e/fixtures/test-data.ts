export const TEST_USERS = {
  USER1: {
    id: 'test-user-1',
    email: 'test1@playwright.com',
    password: 'Test123!',
    name: 'Test User One',
  },
  USER2: {
    id: 'test-user-2',
    email: 'test2@playwright.com', 
    password: 'Test123!',
    name: 'Test User Two',
  }
};

export const TEST_WORKSPACES = {
  PRIMARY: {
    id: 'test-workspace-1',
    name: 'Primary Test Workspace',
  },
  COLLABORATION: {
    id: 'test-workspace-2',
    name: 'Collaboration Workspace',
  }
};

export const TEST_SPARKS = {
  SEEDLING: {
    id: 'spark-seedling-1',
    title: 'E2E Test Spark - Seedling',
  },
  SAPLING: {
    id: 'spark-sapling-1',
    title: 'E2E Test Spark - Sapling',
  },
  TREE: {
    id: 'spark-tree-1',
    title: 'E2E Test Spark - Tree',
  },
  SHARED: {
    id: 'spark-shared-1',
    title: 'Shared Collaboration Spark',
  }
};

export const TEST_TODOS = {
  HIGH_1: {
    id: 'todo-high-1',
    title: 'High Priority Todo 1',
  },
  HIGH_2: {
    id: 'todo-high-2', 
    title: 'High Priority Todo 2',
  },
  MEDIUM_1: {
    id: 'todo-medium-1',
    title: 'Medium Priority Todo',
  },
  LOW_1: {
    id: 'todo-low-1',
    title: 'Low Priority Todo',
  }
};

export const KEYBOARD_SHORTCUTS = {
  NEW_SPARK: { key: 'n', modifiers: ['Control'] },
  SAVE: { key: 's', modifiers: ['Control'] },
  DELETE: { key: 'Delete' },
  SELECT_ALL: { key: 'a', modifiers: ['Control'] },
  COPY: { key: 'c', modifiers: ['Control'] },
  PASTE: { key: 'v', modifiers: ['Control'] },
  UNDO: { key: 'z', modifiers: ['Control'] },
  REDO: { key: 'y', modifiers: ['Control'] },
  SEARCH: { key: 'f', modifiers: ['Control'] },
  ESCAPE: { key: 'Escape' },
};